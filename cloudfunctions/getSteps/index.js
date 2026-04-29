const cloud = require('wx-server-sdk')
const axios = require('axios')
const crypto = require('crypto')

cloud.init({ env: 'cloud1-d5gm01xjv12142933' })

const db = cloud.database()
const _ = db.command

const APP_ID = 'wx818c547cafacca28'
const APP_SECRET = '3b7041693e8d08239ab1aef5c3a84056'

const METERS_PER_STEP = 0.7
const STEPS_PER_KM = 1000 / METERS_PER_STEP // 1428.57

const TEAM_DATA = {
  'Team1': ['21B908040','23B308006','23B908051','24B908021','25B308027','21B908014','22B908026','23B908033','25B908031','25B308018','22B908036'],
  'Team2': ['20B908016','20B908054','21B908043','22B908022','23B308002','23B908038','23B908056','24B308009','24B908037','24B908045','25B308017','20B908061','22B308004','24B908040','25B308008','24B308016','22B908019','18B908028','18B908088','19B908065','21B908039'],
  'Team3': ['18B908105','20B908060','22B908035','22B908040','23B908031','24B908032','24B908041','23B908035','23B908061','25B308023','22B908037'],
  'Team4': ['19B908045','20B908059','20B908029','21B908038','21B908042','22B308007','22B908023','22B908044','23B908024','24B308008','26B308020','19B908063','19B908064','20B908022','22B908038','23B908022','24B908031','25B908046','26B308012','25B308022','25B908030','18B908014','19B908036','19B908046','20B908017','17B908042'],
}

function dateKey(date) {
  const d = date || new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${day}`
}

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

function normalizeStudentId(studentId) {
  return String(studentId || '').trim().toUpperCase()
}

async function findStudentOwner(studentId) {
  const normalized = normalizeStudentId(studentId)
  if (!normalized) return null
  const res = await db.collection('userSteps').get()
  return res.data.find(item => normalizeStudentId(item.studentId) === normalized) || null
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

  // ── Link student ID to this user ──
  if (event.action === 'saveTeamMember') {
    const studentId = normalizeStudentId(event.studentId)
    if (!studentId) return { success: false, msg: 'No studentId' }

    const claimedByOther = await findStudentOwner(studentId)
    if (claimedByOther && claimedByOther._openid !== openid) {
      return { success: false, msg: '该学工号已被其他用户绑定' }
    }

    const userRecord = await db.collection('userSteps').where({ _openid: openid }).get()
    if (userRecord.data.length > 0) {
      await db.collection('userSteps').doc(userRecord.data[0]._id).update({
        data: { studentId }
      })
    } else {
      await db.collection('userSteps').add({
        data: { _openid: openid, studentId, todaySteps: 0, totalSteps: 0, dailySteps: {}, createdAt: db.serverDate() }
      })
    }
    return { success: true }
  }

  // ── Unlink student ID from this user ──
  if (event.action === 'clearTeamMember') {
    const userRecord = await db.collection('userSteps').where({ _openid: openid }).get()
    if (userRecord.data.length > 0) {
      await db.collection('userSteps').doc(userRecord.data[0]._id).update({
        data: { studentId: _.remove() }
      })
    }
    return { success: true }
  }

  // ── Update profile only ──
  if (event.action === 'updateProfile') {
    const nickname = String(event.nickname || '').trim()
    const avatarUrl = String(event.avatarUrl || '').trim()
    const userRecord = await db.collection('userSteps').where({ _openid: openid }).get()

    if (userRecord.data.length > 0) {
      await db.collection('userSteps').doc(userRecord.data[0]._id).update({
        data: {
          nickname,
          avatarUrl
        }
      })
      return { success: true }
    }

    await db.collection('userSteps').add({
      data: {
        _openid: openid,
        nickname,
        avatarUrl,
        todaySteps: 0,
        totalSteps: 0,
        dailySteps: {},
        createdAt: db.serverDate()
      }
    })
    return { success: true }
  }

  // ── Fetch team data ──
  if (event.action === 'getTeamData') {
    const { teamName } = event
    const memberIds = TEAM_DATA[teamName]
    if (!memberIds) return { success: false, msg: 'Unknown team' }
    const normalizedMemberIds = memberIds.map(normalizeStudentId)

    const res = await db.collection('userSteps').limit(1000).get()

    const members = res.data
      .filter(m => normalizedMemberIds.includes(normalizeStudentId(m.studentId)))
      .map(m => {
      const dailySteps = m.dailySteps || {}
      const cumulativeSteps = Object.values(dailySteps).reduce((a, b) => a + b, 0)
      const todayKey = dateKey()
      return {
        studentId: normalizeStudentId(m.studentId),
        nickname: m.nickname || m.studentId,
        avatarUrl: m.avatarUrl || '',
        todaySteps: dailySteps[todayKey] || 0,
        cumulativeSteps,
        cumulativeKm: parseFloat((cumulativeSteps / STEPS_PER_KM).toFixed(1)),
        todayKm: parseFloat(((dailySteps[todayKey] || 0) / STEPS_PER_KM).toFixed(1)),
      }
    })

    const cloudFileIds = members
      .map(item => item.avatarUrl)
      .filter(url => url && url.startsWith('cloud://'))

    if (cloudFileIds.length > 0) {
      try {
        const tempRes = await cloud.getTempFileURL({ fileList: cloudFileIds })
        const urlMap = {}
        tempRes.fileList.forEach(f => { if (f.tempFileURL) urlMap[f.fileID] = f.tempFileURL })
        members.forEach(item => {
          item.avatarUrl = urlMap[item.avatarUrl] || item.avatarUrl
        })
      } catch (e) {}
    }

    const totalKm = parseFloat(members.reduce((a, m) => a + m.cumulativeKm, 0).toFixed(1))
    return { success: true, members, totalKm }
  }

  // ── Sync WeRun steps ──
  if (event.action === 'syncSteps') {
    const { code, encryptedData, iv, nickname, studentId } = event
    const avatarUrl = (event.avatarUrl || '').startsWith('cloud://') ? event.avatarUrl : ''

    try {
      const tokenRes = await axios.get(
        `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`
      )

      if (tokenRes.data.errcode) {
        return { success: false, msg: tokenRes.data.errmsg }
      }

      const sessionKey = tokenRes.data.session_key

      const decrypted = decryptWeRunData(sessionKey, encryptedData, iv)
      const stepInfoList = decrypted.stepInfoList
      const todaySteps = stepInfoList[stepInfoList.length - 1].step

      const todayDateKey = dateKey()
      const userRecord = await db.collection('userSteps').where({ _openid: openid }).get()
      let totalSteps = todaySteps

      const updateData = {
        todaySteps,
        lastUpdate: db.serverDate(),
        nickname: nickname || '',
        avatarUrl: avatarUrl || '',
        [`dailySteps.${todayDateKey}`]: todaySteps,
      }
      if (studentId) {
        const normalizedStudentId = normalizeStudentId(studentId)
        const claimedByOther = await findStudentOwner(normalizedStudentId)
        if (claimedByOther && claimedByOther._openid !== openid) {
          return { success: false, msg: '该学工号已被其他用户绑定' }
        }
        updateData.studentId = normalizedStudentId
      }

      if (userRecord.data.length > 0) {
        const docId = userRecord.data[0]._id
        const existingDaily = userRecord.data[0].dailySteps || {}
        totalSteps = Object.values({ ...existingDaily, [todayDateKey]: todaySteps })
          .reduce((a, b) => a + b, 0)
        await db.collection('userSteps').doc(docId).update({
          data: { ...updateData, totalSteps }
        })
      } else {
        await db.collection('userSteps').add({
          data: {
            _openid: openid,
            totalSteps: todaySteps,
            dailySteps: { [todayDateKey]: todaySteps },
            ...updateData,
            createdAt: db.serverDate()
          }
        })
      }

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
