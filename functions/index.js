const express = require("express")
const cors = require("cors")

const app = express()

// Automatically allow cross-origin requests
app.use(cors({ origin: true }))

const { google } = require("googleapis")

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  "http://localhost:8080/handleGoogleRedirect" // server redirect url handler
)
const fetch = require("node-fetch")

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

app.post("/createAuthLink", cors(), (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/userinfo.email",
      "https://www.googleapis.com/auth/calendar",
    ],
    prompt: "consent",
  })
  res.send({ url })
})

app.get("/handleGoogleRedirect", async (req, res) => {
  // get code from url
  const code = req.query.code
  console.log("server 36 | code", code)
  // get access token
  oauth2Client.getToken(code, (err, tokens) => {
    if (err) {
      console.log("server 39 | error", err)
      throw new Error("Issue with Login", err.message)
    }
    const accessToken = tokens.access_token
    const refreshToken = tokens.refresh_token

    res.redirect(
      `http://localhost:3000?accessToken=${accessToken}&refreshToken=${refreshToken}`
    )
  })
})

app.post("/getValidToken", async (req, res) => {
  try {
    const request = await fetch("https://www.googleapis.com/oauth2/v4/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: req.body.refreshToken,
        grant_type: "refresh_token",
      }),
    })

    const data = await request.json()
    console.log("server 74 | data", data.access_token)

    res.json({
      accessToken: data.access_token,
    })
  } catch (error) {
    res.json({ error: error.message })
  }
})
