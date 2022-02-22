const functions = require("firebase-functions")
const admin = require("firebase-admin")
const cors = require("cors")({ origin: "*" })
const { google } = require("googleapis")
const OAuth2 = google.auth.OAuth2
const calendar = google.calendar("v3")

let REDIR_URL
let APP_URL

const serviceAccount = require("./serviceaccount.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

if (process.env.FUNCTIONS_EMULATOR === "true") {
  functions.logger.info("running on emulator")
  REDIR_URL =
    "http://localhost:5001/calendarapiexample-849b8/us-central1/postEventRedirect"
  APP_URL = "http://localhost:3000"
} else {
  functions.logger.info("running on server")
  REDIR_URL =
    "https://us-central1-calendarapiexample-849b8.cloudfunctions.net/postEventRedirect"
  APP_URL = "https://calendarapiexample-849b8.web.app"
}

const db = admin.firestore()

const oAuth2Client = new OAuth2(
  "552664563294-9vitc92divm2b5hm4k8bir54orjvetqt.apps.googleusercontent.com",
  "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",
  REDIR_URL
)

const addTokenToDatabase = async (tokens, email) => {
  return await db
    .doc(`tokens/${email}`)
    .set({ refresh_token: tokens.refresh_token })
}

exports.postEventRedirect = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    const { tokens } = await oAuth2Client.getToken(req.query.code)
    oAuth2Client.setCredentials(tokens)
    const oauthc = google.oauth2({ version: "v2", auth: oAuth2Client })
    const userInfo = await oauthc.userinfo.get()
    await addTokenToDatabase(tokens, userInfo.data.email)

    let msg = { error: "user not found" }
    try {
      const userRecord = await admin.auth().getUserByEmail(userInfo.data.email)
      functions.logger.info("got user record", {
        structuredData: true,
        userRecord: userRecord,
      })
      const customToken = await admin.auth().createCustomToken(userRecord.uid)
      msg = {
        id_token: customToken,
        access_token: tokens.access_token,
        uid: userRecord.uid,
      }
    } catch (err) {
      if (err.code === "auth/user-not-found") {
        const userRecord = await admin.auth().createUser({
          email: userInfo.data.email,
          displayName: userInfo.data.name,
          providerToLink: "google.com",
        })
        const customToken = await admin.auth().createCustomToken(userRecord.uid)
        msg = {
          id_token: customToken,
          access_token: tokens.access_token,
          uid: userRecord.uid,
        }
      } else {
        msg = {
          error: "user not found and caught error:" + JSON.stringify(err),
        }
      }
    }
    res.redirect(`${APP_URL}/?code=${encodeURIComponent(JSON.stringify(msg))}`)
  })
})

function addEvent(event, auth) {
  return new Promise((resolve, reject) => {
    calendar.events.insert(
      {
        auth: auth,
        calendarId: "primary",
        resource: {
          summary: event.eventName,
          description: event.description,
          start: {
            dateTime: event.startTime,
            timeZone: "America/New_York",
          },
          end: {
            dateTime: event.endTime,
            timeZone: "America/New_York",
          },
        },
      },
      (err, res) => {
        if (err) {
          console.log("Addevent: rejecting" + err)
          reject(err)
        } else {
          console.log("resolving!")
          resolve(res)
        }
      }
    )
  })
}

function checkBusy(auth, email) {
  return new Promise((resolve, reject) => {
    functions.logger.info("in checkBusy" + email)
    calendar.freebusy.query(
      {
        auth: auth,
        resource: {
          timeMin: "2022-02-22T07:00:00+0000",
          timeMax: "2022-02-23T23:00:00+0000",
          items: [
            {
              id: "primary",
            },
          ],
        },
      },
      (err, res) => {
        functions.logger.info("before check")
        if (err) {
          functions.logger.info(
            "query free/busy: rejecting" + JSON.stringify(err)
          )
          reject(err)
        } else {
          functions.logger.info(
            "query free/busy resolving!" + JSON.stringify(res)
          )
          resolve(res)
        }
      }
    )
  })
}

const anEvent = {
  eventName: "Firebase Event",
  description: "This is a sample description",
  startTime: "2022-02-22T10:00:00",
  endTime: "2022-02-22T13:00:00",
}

exports.constructAuthURL = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    const scopes = [
      "profile",
      "email",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ]

    const url = oAuth2Client.generateAuthUrl({
      access_type: "offline",
      scope: scopes,
      prompt: "consent",
    })
    response.json({ authLink: url })
  })
})

exports.postEvent = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    functions.logger.info("post event called", {
      structuredData: true,
      method: request.method,
      blah: request.body,
    })
    if (request.body.selectedEmail) {
      db.doc("tokens/" + request.body.selectedEmail)
        .get()
        .then((doc) => {
          if (doc.exists) {
            const data = doc.data()
            const refreshToken = data.refresh_token

            oAuth2Client.setCredentials({
              refresh_token: refreshToken,
            })

            addEvent(anEvent, oAuth2Client)
              .then((data) => {
                response.send(data)
              })
              .catch((err) => {
                response.send(err)
              })
          } else {
            response.send(JSON.stringify({ error: "No document found" }))
          }
        })
    } else {
      response.send(JSON.stringify({ error: "No email selected" }))
    }
  })
})

exports.checkBusy = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    functions.logger.info("check busy called", {
      structuredData: true,
      method: request.method,
      selectedEmail: request.body.selectedEmail,
    })
    if (request.body.selectedEmail) {
      db.doc("tokens/" + request.body.selectedEmail)
        .get()
        .then((doc) => {
          if (doc.exists) {
            const data = doc.data()
            const refreshToken = data.refresh_token

            oAuth2Client.setCredentials({
              refresh_token: refreshToken,
            })
            functions.logger.info("got refresh token, calling checkBusy")
            checkBusy(oAuth2Client, request.body.selectedEmail)
              .then((data) => {
                functions.logger.info("in data response")
                response.json(data)
              })
              .catch((err) => {
                functions.logger.info("in error response" + JSON.stringify(err))
                response.json(err)
              })
          } else {
            response.send(JSON.stringify({ error: "No document found" }))
          }
        })
    } else {
      response.send(JSON.stringify({ error: "No email selected" }))
    }
  })
})
