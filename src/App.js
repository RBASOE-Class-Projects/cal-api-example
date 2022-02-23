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

import { useLocation, useNavigate, useSearchParams } from "react-router-dom"

// Your web app's Firebase configuration
import firebaseConfig from "./firebaseConfig.json"

let BASE_URL // base url

// Initialize Firebase
const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const db = getFirestore(app)

if (!process.env.REACT_APP_STAGE || process.env.REACT_APP_STAGE === "local") {
  BASE_URL = "http://localhost:5001/calendarapiexample-849b8/us-central1/"
  connectFirestoreEmulator(db, "localhost", 8080)
} else {
  BASE_URL = "https://us-central1-calendarapiexample-849b8.cloudfunctions.net/"
}

const PE_URL = BASE_URL + "postEvent"
const CA_URL = BASE_URL + "constructAuthURL"
const FB_URL = BASE_URL + "checkBusy"

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
  const [selectedEmail, setSelectedEmail] = useState("")
  const [freeBusy, setFreeBusy] = useState(null)

  const location = useLocation()
  const history = useNavigate()
  const [params, setParams] = useSearchParams()

  const handleSignOutRequest = () => {
    signOut(auth)
      .then(() => {
        setUser(null)
        window.location.search = ""
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
        console.log(
          "Error: missing idToken, access_token, or uid:" + JSON.stringify(msg)
        )
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
      const codeString = params.get("code")
      if (codeString) {
        let code
        try {
          code = JSON.parse(decodeURIComponent(codeString))
        } catch (e) {
          alert("Invalid code")
          code = null
        }
        setParams({ code: "" })
        if (code) {
          setAuthCode(code)
        }
      }
    }
    doCode()
  }, [params, setParams])

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

  const handleSelect = (email) => {
    setSelectedEmail(email)
  }

  const postSelectedEvent = async () => {
    const jsonData = { userEmail: user.email, selectedEmail: selectedEmail }
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

  const queryFreeBusy = async () => {
    const jsonData = { userEmail: user.email, selectedEmail: selectedEmail }
    const request = await fetch(FB_URL, {
      method: "POST",
      body: JSON.stringify(jsonData),
      headers: {
        "Content-Type": "application/json",
      },
    })
    const response = await request.json()
    setFreeBusy(response)
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
          <span>Logged in: {user.email}</span>
          <p />
          <SelectEmail emails={emails} handleSelect={handleSelect} />
        </>
      ) : (
        <>
          <span>{authURL ? "ready" : "not ready"}</span>
          <p />
          {authURL ? <button onClick={doAuthRedirect}>Sign In</button> : null}
        </>
      )}
      <p />
      <span>Optional Emails: [{emails && emails.join(", ")}]</span>

      {selectedEmail ? (
        <>
          <p />
          <button onClick={postSelectedEvent}>Post</button>

          <p />
          <button onClick={queryFreeBusy}>Query Free</button>
          <p />
        </>
      ) : null}
      <div>{freeBusy && "free:" + JSON.stringify(freeBusy.data.calendars)}</div>

      <p />
      <span>Application is running in: {process.env.REACT_APP_STAGE} mode</span>
    </div>
  )
}

export function Foo() {
  useEffect(() => {}, [])

  return <>Component</>
}

export default App
