const cloud = require('wx-server-sdk')
const axios = require('axios')
const crypto = require('crypto')

cloud.init({ env: 'cloud1-1gs1ugxif2016ac5' })

const db = cloud.database()
const _ = db.command

const APP_ID = 'wx03c3b2cd82654864'
const APP_SECRET = 'b748e42527de23dd2e401b42c47d7cb2'

function decryptWeRunData(sessionKey, encryptedData, iv) {
  const sessionKeyBuffer = Buffer.from(sessionKey, 'base64')
  const encryptedDataBuffer = Buffer.from(encryptedData, 'base64')
  const ivBuffer = Buffer.from(iv, 'base64')

  const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKeyBuffer, ivBuffer)
  decipher.setAutoPadding(true)
  let decoded = decipher.update(encryptedDataBuffer, 'binary', 'utf8')
  decoded += decipher.final('utf8')
  return JSON.parse(decoded)
}

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  // ── Leaderboard fetch ──
  if (event.action === 'getLeaderboard') {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const res = await db.collection('userSteps')
      .where({ lastUpdate: _.gte(today) })
      .orderBy('todaySteps', 'desc')
      .limit(50)
      .get()

    const list = res.data

    // Resolve cloud:// avatar file IDs to temp URLs server-side.
    // Cloud functions have admin-level storage access, so they can generate
    // temp URLs for any user's file — unlike the client, which can only get
    // temp URLs for files it uploaded itself.
    const cloudFileIds = list
      .map(item => item.avatarUrl)
      .filter(url => url && url.startsWith('cloud://'))

    if (cloudFileIds.length === 0) {
      return { success: true, list }
    }

    try {
      const tempRes = await cloud.getTempFileURL({ fileList: cloudFileIds })
      const urlMap = {}
      tempRes.fileList.forEach(f => { if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
      const listWithUrls = list.map(item => ({
        ...item,
        avatarUrl: urlMap[item.avatarUrl] || item.avatarUrl
      }))
      return { success: true, list: listWithUrls }
    } catch (e) {
      return { success: true, list }
    }
  }

  // ── Decrypt WeRun data directly in cloud function ──
  if (event.action === 'syncSteps') {
    const { code, encryptedData, iv, nickname } = event
    // Only accept cloud:// URLs — wxfile:// paths are device-local temp files
    const avatarUrl = (event.avatarUrl || '').startsWith('cloud://') ? event.avatarUrl : ''

    try {
      // 1. Exchange code for session_key
      const tokenRes = await axios.get(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`
      )

      if (tokenRes.data.errcode) {
        return { success: false, msg: tokenRes.data.errmsg }
      }

      const sessionKey = tokenRes.data.session_key

      // 2. Decrypt
      const decrypted = decryptWeRunData(sessionKey, encryptedData, iv)
      const stepInfoList = decrypted.stepInfoList
      const todaySteps = stepInfoList[stepInfoList.length - 1].step

      // 3. Save to database
      const userRecord = await db.collection('userSteps').where({ _openid: openid }).get()

      const updateData = {
        todaySteps,
        lastUpdate: db.serverDate(),
        nickname: nickname || '',
        avatarUrl: avatarUrl || '',
      }

      let totalSteps
      if (userRecord.data.length > 0) {
        const docId = userRecord.data[0]._id
        const prevTotal = userRecord.data[0].totalSteps || 0
        totalSteps = prevTotal + todaySteps
        await db.collection('userSteps').doc(docId).update({
          data: { ...updateData, totalSteps }
        })
      } else {
        totalSteps = todaySteps
        await db.collection('userSteps').add({
          data: { _openid: openid, totalSteps, ...updateData, createdAt: db.serverDate() }
        })
      }

      // Calculate today's rank: count users with more steps today
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const rankRes = await db.collection('userSteps')
        .where({ lastUpdate: _.gte(today), todaySteps: _.gt(todaySteps) })
        .count()
      const rank = rankRes.total + 1

      return { success: true, todaySteps, totalSteps, rank }
    } catch (err) {
      console.error('syncSteps error:', err)
      return { success: false, error: err.message }
    }
  }

  return { success: false, msg: 'Unknown action' }
}
