import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAwps0sHc_Ys1Aj5ABWGxJQRhA0VrUjIuA",
  authDomain: "aestrytfyguh.firebaseapp.com",
  projectId: "aestrytfyguh",
  storageBucket: "aestrytfyguh.firebasestorage.app",
  messagingSenderId: "240522717377",
  appId: "1:240522717377:web:9e3b1bcdb3cff8faa74c40",
  measurementId: "G-ZZXXNRCX9D"
};

// Singleton pattern to ensure app is only initialized once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;