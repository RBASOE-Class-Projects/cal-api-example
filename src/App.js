import "./App.css"

import { initializeApp } from "firebase/app"
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  connectFirestoreEmulator,
} from "firebase/firestore"

import React, { useState, useEffect } from "react"
import {
  getAuth,
  GoogleAuthProvider,
  signOut,
  signInWithCredential,
} from "firebase/auth"

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB6n3-CCg0yxCqqZ9EpxH_ArScDkK6axcY",
  authDomain: "calendarapiexample-849b8.firebaseapp.com",
  projectId: "calendarapiexample-849b8",
  storageBucket: "calendarapiexample-849b8.appspot.com",
  messagingSenderId: "552664563294",
  appId: "1:552664563294:web:eefc9b6a16939b1f7a7ecf",
}

let PE_URL =
  "http://localhost:5001/calendarapiexample-849b8/us-central1/postEvent"

const CA_URL =
  "http://localhost:5001/calendarapiexample-849b8/us-central1/constructAuthURL"

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)
connectFirestoreEmulator(db, "localhost", 8080)

const provider = new GoogleAuthProvider()
provider.addScope("https://www.googleapis.com/auth/calendar.readonly")
provider.addScope("https://www.googleapis.com/auth/calendar.events")
provider.setCustomParameters({ prompt: "select_account" })

export async function fetchList(
  db,
  collection,
  list_id,
  list_attr,
  setter,
  mapper
) {
  /*
   ** return a list of values from a collection containing a document with
   ** the id `list_id` with an attribute `list_attr`.
   ** mapper is a function that can transform the list before calling the setter.
   */
  const docRef = doc(db, collection, list_id)
  const docSnap = await getDoc(docRef)
  if (docSnap.exists()) {
    const data = docSnap.data()
    if (mapper) {
      setter(data[list_attr].map(mapper))
    } else {
      setter(data[list_attr])
    }
  }
}

function SelectEmail({ emails, handleSelect }) {
  const [selected, setSelect] = useState("")
  const doSelect = (e) => {
    setSelect(e.target.value)
    if (e.target.value !== "nothing") {
      handleSelect(e.target.value)
    }
  }

  return (
    <select onChange={doSelect} value={selected}>
      <option value="nothing">Select an email</option>
      {emails.map((email) => (
        <option key={email} value={email}>
          {email}
        </option>
      ))}
    </select>
  )
}

function App(props) {
  const [user, setUser] = useState(null)
  const [emails, setEmails] = useState([])
  const [authURL, setAuthURL] = useState("")
  const [authCode, setAuthCode] = useState(null)
  const [listsRead, setListsRead] = useState(false)

  const handleSignOutRequest = () => {
    signOut(auth)
      .then(() => {
        setUser(null)
      })
      .catch((error) => {})
  }

  useEffect(() => {
    getAuthURL()
  }, [])

  useEffect(() => {
    const doClientAuth = async (msg) => {
      const idToken = msg.id_token
      const access_token = msg.access_token
      const uid = msg.uid
      if (!idToken || !access_token || !uid) {
        console.log("Error: missing idToken, access_token, or uid")
      } else {
        const credential = GoogleAuthProvider.credential(null, access_token)
        const newCred = await signInWithCredential(auth, credential)
        setUser(newCred.user)
        if (emails.indexOf(newCred.user.email) === -1) {
          // email not in list, add it now.
          const docRef = doc(db, "config", "lists")
          const newEmails = [...emails, newCred.user.email]
          setDoc(docRef, { emails: newEmails }, { merge: true })
          setEmails(newEmails)
        } else {
          console.log("Found email in emails list")
        }
      }
    }
    if (listsRead && authCode) {
      doClientAuth(authCode)
    }
  }, [authCode, listsRead, emails])

  useEffect(() => {
    const doCode = async () => {
      let code
      if (
        window.location.search &&
        window.location.search.length > 1 &&
        window.location.search.split("?").length > 1 &&
        window.location.search.split("?")[1].slice(0, 5) === "code="
      ) {
        try {
          code = JSON.parse(
            decodeURIComponent(window.location.search.split("?")[1].slice(5))
          )
        } catch (e) {
          alert("Invalid code")
          code = null
        }
        if (code) {
          setAuthCode(code)
        }
      }
    }
    doCode()
  }, [emails])

  useEffect(() => {
    const doFetch = async () => {
      await fetchList(db, "config", "lists", "emails", setEmails)
      setListsRead(true)
    }
    doFetch()
  }, [])

  const getAuthURL = async () => {
    const request = await fetch(CA_URL)
    const response = await request.json()
    setAuthURL(response.authLink)
  }

  const doAuthRedirect = () => {
    window.location.href = authURL
  }

  const postSelectedEvent = async (email) => {
    const jsonData = { userEmail: user.email, selectedEmail: email }
    const request = await fetch(PE_URL, {
      method: "POST",
      body: JSON.stringify(jsonData),
      headers: {
        "Content-Type": "application/json",
      },
    })
    const response = await request.json()
    console.log(response)
  }

  return (
    <div className="App">
      <span> Test Calendar API </span>
      <p />
      {user ? (
        <>
          <button onClick={handleSignOutRequest}>Sign Out</button>
          <p />
          <span>{user.email}</span>
          <p />
          <SelectEmail emails={emails} handleSelect={postSelectedEvent} />
        </>
      ) : (
        <>
          <span>{authURL ? "ready" : "not ready"}</span>
          <p />
          {authURL ? <button onClick={doAuthRedirect}>Sign In</button> : null}
        </>
      )}
      <p />
      <span>Emails: [{emails && emails.join(", ")}]</span>

      <p />
      <button onClick={postSelectedEvent}>Post</button>
    </div>
  )
}

export default App
