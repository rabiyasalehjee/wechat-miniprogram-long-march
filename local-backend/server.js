const express = require("express");
const cors = require("cors");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

// REPLACE THESE WITH YOUR WECHAT TEST ACCOUNT CREDENTIALS
// You get these from the WeChat Developer Sandbox (Test Account) page
const APP_ID = "wx818c547cafacca28";
const APP_SECRET = "3b7041693e8d08239ab1aef5c3a84056";

function decryptWeChatData(appId, sessionKey, encryptedData, iv) {
  const sessionKeyBuffer = Buffer.from(sessionKey, "base64");
  const encryptedDataBuffer = Buffer.from(encryptedData, "base64");
  const ivBuffer = Buffer.from(iv, "base64");

  let decoded;
  try {
    const decipher = crypto.createDecipheriv(
      "aes-128-cbc",
      sessionKeyBuffer,
      ivBuffer,
    );
    decipher.setAutoPadding(true);
    decoded = decipher.update(encryptedDataBuffer, "binary", "utf8");
    decoded += decipher.final("utf8");
    decoded = JSON.parse(decoded);
  } catch (err) {
    throw new Error("Decryption failed: " + err.message);
  }

  if (decoded.watermark.appid !== appId) {
    throw new Error("AppID watermark mismatch");
  }

  return decoded;
}

app.post("/decrypt-steps", async (req, res) => {
  const { code, encryptedData, iv } = req.body;

  if (!code || !encryptedData || !iv) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  if (APP_ID === "YOUR_TEST_APP_ID_HERE") {
    return res.status(500).json({
      error:
        "Please set your Test AppID and AppSecret in the server.js file first.",
    });
  }

  try {
    // 1. Get session_key using the code from wx.login
    const tokenUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${APP_ID}&secret=${APP_SECRET}&js_code=${code}&grant_type=authorization_code`;
    const tokenResponse = await axios.get(tokenUrl);

    if (tokenResponse.data.errcode) {
      return res.status(400).json({ error: tokenResponse.data.errmsg });
    }

    const sessionKey = tokenResponse.data.session_key;

    // 2. Decrypt the WeRun data using the session_key
    const decrypted = decryptWeChatData(APP_ID, sessionKey, encryptedData, iv);

    // 3. Extract today's steps
    const stepInfoList = decrypted.stepInfoList;
    const todayData = stepInfoList[stepInfoList.length - 1];

    res.json({
      success: true,
      steps: todayData.step,
    });
  } catch (error) {
    console.error("Decryption error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Local WeChat Crypto Server running on http://localhost:${PORT}`);
  console.log(`Waiting for Mini Program to connect...`);
});
