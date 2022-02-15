import "./App.css"

import React, { useState, useEffect } from "react"
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "firebase/auth"

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyB6n3-CCg0yxCqqZ9EpxH_ArScDkK6axcY",
  authDomain: "calendarapiexample-849b8.firebaseapp.com",
  projectId: "calendarapiexample-849b8",
  storageBucket: "calendarapiexample-849b8.appspot.com",
  messagingSenderId: "552664563294",
  appId: "1:552664563294:web:eefc9b6a16939b1f7a7ecf",
}

let API_URL =
  "http://localhost:5001/calendarapiexample-849b8/us-central1/generateLink"

if (process.env.FUNCTIONS_EMULATOR) {
  API_URL =
    "https://us-central1-calendarapiexample-849b8.cloudfunctions.net/generateLink"
}

// Initialize Firebase
const app = initializeApp(firebaseConfig)

const auth = getAuth()
const provider = new GoogleAuthProvider()

function App() {
  const [user, setUser] = useState(null)
  const [token, setToken] = useState(null)
  const [isSignedIn, setIsSignedIn] = useState(false)

  const handleSignOutRequest = () => {
    signOut(auth)
      .then(() => {
        setUser(null)
      })
      .catch((error) => {})
  }

  const handleSignInRequest = () => {
    console.log("In sign in request")
    signInWithPopup(auth, provider)
      .then((result) => {
        console.log("Got PopUp Result")
        const credential = GoogleAuthProvider.credentialFromResult(result)
        if (credential) {
          setToken(credential.accessToken)
          setUser(result.user)
        }
      })
      .catch((error) => {
        const errorCode = error.code
        const errorMessage = error.message

        alert(errorMessage + ":" + errorCode)
      })
  }

  const generateAuthLink = async () => {
    const request = await fetch(API_URL)
    const data = await request.json()
    console.log(data)
    return data
  }

  const handleAuthButtonClick = () => {
    const prom = generateAuthLink()
    prom.then((data) => {
      console.log(data.url)
    })
  }

  useEffect(() => {
    onAuthStateChanged(auth, (aUser) => {
      if (aUser != null) {
        setIsSignedIn(true)
        console.log("Auth state changed: " + aUser.email)
      } else {
        setIsSignedIn(false)
      }
      setUser(aUser)
    })
  }, [])

  return (
    <div className="App">
      {isSignedIn ? (
        <button onClick={handleSignOutRequest}>Sign Out</button>
      ) : (
        <button onClick={handleSignInRequest}>Sign In</button>
      )}
      <span>
        {isSignedIn && user ? JSON.stringify(user.email) : "Not signed in"}
      </span>
      <span>{token ? JSON.stringify(token) : "/no token"}</span>
      <p />
      <button onClick={handleAuthButtonClick}>Generate Auth Link</button>
    </div>
  )
}

export default App
