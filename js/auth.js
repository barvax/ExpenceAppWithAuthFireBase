import { firebaseConfig, ALLOWED_EMAILS } from "./config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  GoogleAuthProvider as GAP,
} from "https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js";

// UI refs
const signinView = document.getElementById("signinView");
const appRoot = document.getElementById("appRoot");
const btnGoogle = document.getElementById("btnGoogle");
const signinMsg = document.getElementById("signinMsg");

// Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Google provider with Sheets scope
const provider = new GoogleAuthProvider();
provider.addScope("https://www.googleapis.com/auth/spreadsheets");
provider.setCustomParameters({ prompt: "select_account" }); // don't force consent loop

// State
let accessToken = null;

function showApp(show) {
  if (show) {
    signinView.classList.add("hidden");
    appRoot.classList.remove("hidden");
  } else {
    appRoot.classList.add("hidden");
    signinView.classList.remove("hidden");
  }
}

function isAllowed(user) {
  if (!ALLOWED_EMAILS || ALLOWED_EMAILS.length === 0) return true;
  return !!user?.email && ALLOWED_EMAILS.includes(user.email);
}

export function currentUser() {
  return auth.currentUser;
}

export async function signInGoogle() {
  signinMsg.textContent = "";
  try {
    const result = await signInWithPopup(auth, provider);
    const cred = GAP.credentialFromResult(result);
    accessToken = cred?.accessToken || null;
    if (!isAllowed(result.user)) {
      await signOut(auth);
      throw new Error("This account is not allowed.");
    }
    dispatchSheetsReady();
  } catch (e) {
    console.error(e);
    signinMsg.textContent = e.message || "Sign-in failed";
    throw e;
  }
}

export async function signOutGoogle() {
  accessToken = null;
  await signOut(auth);
}


let popupPromise = null;

export async function getSheetsToken() {
  if (accessToken) return accessToken;
  if (popupPromise) return popupPromise; // כבר בתהליך

  popupPromise = signInWithPopup(auth, provider)
    .then(result => {
      const cred = GAP.credentialFromResult(result);
      accessToken = cred?.accessToken || null;
      return accessToken;
    })
    .finally(() => { popupPromise = null; });

  return popupPromise;
}


function dispatchAuthState(user) {
  document.dispatchEvent(new CustomEvent("auth:state", { detail: { user } }));
}

function dispatchSheetsReady() {
  const user = currentUser();
  if (!user || !accessToken) return;
  document.dispatchEvent(
    new CustomEvent("sheets:ready", { detail: { token: accessToken, user } })
  );
}

btnGoogle?.addEventListener("click", signInGoogle);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    if (!isAllowed(user)) {
      await signOut(auth);
      signinMsg.textContent = "This account is not allowed.";
      showApp(false);
      dispatchAuthState(null);
      return;
    }
    showApp(true);
    dispatchAuthState(user);
    // We might not have a Sheets token yet (first load). The app can call getSheetsToken() when needed
  } else {
    accessToken = null;
    showApp(false);
    dispatchAuthState(null);
  }
});

// Expose for debugging (optional)
window.Auth = { currentUser, signInGoogle, signOutGoogle, getSheetsToken };
