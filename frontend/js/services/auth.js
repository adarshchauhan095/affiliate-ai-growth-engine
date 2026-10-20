// Persistent Verified Operator Authentication Service
import { auth } from "../config/firebase.js";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const OPERATOR_EMAIL = "mybudgetdeal99@gmail.com";

let currentUser = null;
const authListeners = [];

export function initAuth(onStateChangedCallback) {
  if (onStateChangedCallback) {
    authListeners.push(onStateChangedCallback);
  }

  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    const isVerified = isOperatorVerified();
    authListeners.forEach((fn) => fn(user, isVerified));
  });
}

export function getCurrentUser() {
  return currentUser;
}

export function isOperatorVerified() {
  if (!currentUser) return false;
  // Check email matches operator and is verified
  const emailMatches = currentUser.email && currentUser.email.toLowerCase() === OPERATOR_EMAIL.toLowerCase();
  return emailMatches && currentUser.emailVerified;
}

export async function loginOperator(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function logoutOperator() {
  await signOut(auth);
}

export async function requestPasswordReset(email) {
  await sendPasswordResetEmail(auth, (email || OPERATOR_EMAIL).trim());
}

export { OPERATOR_EMAIL };
