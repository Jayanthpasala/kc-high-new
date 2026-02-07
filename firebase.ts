import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  setPersistence, 
  browserLocalPersistence 
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Updated with your project credentials
const firebaseConfig = {
  apiKey: "AIzaSyAwps0sHc_Ys1Aj5ABWGxJQRhA0VrUjIuA",
  authDomain: "aestrytfyguh.firebaseapp.com",
  projectId: "aestrytfyguh",
  storageBucket: "aestrytfyguh.appspot.com",
  messagingSenderId: "240522717377",
  appId: "1:240522717377:web:9e3b1bcdb3cff8faa74c40",
  measurementId: "G-ZZXXNRCX9D"
};

// Initialize Firebase App
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Persist user sessions across refreshes
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("Firebase auth persistence set to LOCAL");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });

export default app;