// Firebase Modular Web SDK v10 Initialization
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, browserLocalPersistence, setPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Default public Firebase project configuration
const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCfrTrfiGzFMnEVNdAPPtQ4uyWuEMeSyo8",
  authDomain: "affiliate-growth-ai-engine.firebaseapp.com",
  projectId: "affiliate-growth-ai-engine",
  storageBucket: "affiliate-growth-ai-engine.firebasestorage.app",
  messagingSenderId: "78149769083",
  appId: "1:78149769083:web:9614b859cfdf6e35d14fde",
  measurementId: "G-SXQX7X9NK5"
};

// Retrieve any custom user-provided overrides from localStorage
function getActiveConfig() {
  try {
    const custom = localStorage.getItem("bd99_firebase_config");
    if (custom) {
      const parsed = JSON.parse(custom);
      return { ...DEFAULT_FIREBASE_CONFIG, ...parsed };
    }
  } catch (e) {
    console.warn("Could not parse custom firebase config:", e);
  }
  return DEFAULT_FIREBASE_CONFIG;
}

const firebaseConfig = getActiveConfig();

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

// Configure persistent authentication
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.warn("Could not set browserLocalPersistence:", err);
});

export { app, auth, db, firebaseConfig, DEFAULT_FIREBASE_CONFIG };
