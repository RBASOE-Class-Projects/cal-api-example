const functions = require("firebase-functions")
const admin = require("firebase-admin")
const cors = require("cors")({ origin: "*" })

admin.initializeApp()

// Create and Deploy Your First Cloud Functions
// https://firebase.google.com/docs/functions/write-firebase-functions

exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info("Hello logs!", { structuredData: true })
  response.send("Hello from Firebase!")
})

exports.generateLink = functions.https.onRequest((request, response) => {
  cors(request, response, () => {
    // your function body here - use the provided req and res from cors
    response.send(JSON.stringify({ url: "http://foo.bar.com/baz" }))
  })
})
