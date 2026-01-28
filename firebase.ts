import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDcznITN8srAO2jc9iUJCBLU6nhMSgxFkQ",
  authDomain: "aestrytfyguh.firebaseapp.com",
  projectId: "aestrytfyguh",
  storageBucket: "aestrytfyguh.appspot.com",
  messagingSenderId: "240522717377",
  appId: "1:240522717377:web:9e3b1bcdb3cff8faa74c40",
  measurementId: "G-ZZXXNRCX9D"
};

// Ensure Firebase initializes only once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);

// 🔥 THIS FIXES LOGIN STUCK AFTER REFRESH
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase auth persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });

export default app;