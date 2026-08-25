// firebase-config.js
//
// IMPORTANT: paste ONLY the config object below — nothing else.
// Firebase Console's "Add app → Web" screen now shows the *modular* SDK
// snippet by default, which starts with an `import { initializeApp } from
// "firebase/app"` line. This project uses the classic compat SDK (loaded
// via plain <script> tags in index.html, no bundler/module system), so an
// `import` statement here will throw "Cannot use import statement outside
// a module" and every Firebase call after it (auth, Firestore) will fail
// with "firebaseConfig is not defined" / "FB is not defined".
//
// So: open Firebase Console → Project Settings → General → Your apps →
// (your web app) → SDK setup and configuration → "Config" (not "npm" or
// the default snippet). Copy just the object literal — the part that
// looks like the block below — and replace the placeholder values.
// Do NOT copy any `import` or `initializeApp(...)` lines into this file.
//
// Safe to keep in the client bundle either way — these are public
// identifiers, not secrets; real protection comes from firestore.rules.

const firebaseConfig = {
  apiKey: "AIzaSyBt_JOy6kQZ9u0dbNOH81NIeYhKBPolngU",
  authDomain: "signuppage-soun.firebaseapp.com",
  projectId: "signuppage-soun",
  storageBucket: "signuppage-soun.firebasestorage.app",
  messagingSenderId: "753481675025",
  appId: "1:753481675025:web:639ff3399bba672a35dcb0",
};

// Needed for real push notifications (Firebase Cloud Messaging), separate
// from the config above. Get this from Firebase Console → Project Settings
// → Cloud Messaging → "Web configuration" → Web Push certificates →
// "Generate key pair". Paste the key string below. Push notifications
// silently no-op until this is filled in.
const firebaseVapidKey =
  "BFYuaoU53DFCc9yFvvKsDQRIu7QQeLIUp-mKlqiaiGCKi6Nes-Wi3GqO5cxRMgDWqB0MCKZG1fQPp50xJdzXgwcE";
