const functions = require("firebase-functions")
const admin = require("firebase-admin")
const cors = require("cors")({ origin: "*" })
const { google } = require("googleapis")
const OAuth2 = google.auth.OAuth2
const calendar = google.calendar("v3")
const serviceAccount = require("./serviceaccount.json")

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})
const db = admin.firestore()

const oAuth2Client = new OAuth2(
  "552664563294-9vitc92divm2b5hm4k8bir54orjvetqt.apps.googleusercontent.com",
  "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",
  "http://localhost:5001/calendarapiexample-849b8/us-central1/postEventRedirect"
)

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

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
      msg = { error: "user not found and caught error" }
    }
    res.redirect(
      `http://localhost:3000/?code=${encodeURIComponent(JSON.stringify(msg))}`
    )
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

const anEvent = {
  eventName: "Firebase Event",
  description: "This is a sample description",
  startTime: "2022-02-20T10:00:00",
  endTime: "2022-02-20T13:00:00",
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
