// firebase.js — initializes the Firebase app once and exposes auth/db
// to the rest of the app via the global FB namespace. Uses the compat
// SDK (loaded as classic <script> tags in index.html) so it fits the
// same non-module architecture as the rest of the app.

const FB = (() => {
  if (typeof firebaseConfig === "undefined" || firebaseConfig.apiKey === "YOUR_API_KEY") {
    console.error(
      "firebaseConfig is missing or still has placeholder values. " +
      "Open js/firebase-config.js and paste in your real Firebase project config " +
      "(the object literal only — see the comment at the top of that file)."
    );
  }

  firebase.initializeApp(firebaseConfig);
  const auth = firebase.auth();
  const db = firebase.firestore();

  // Best-effort offline cache — lets the app keep working (read + queue
  // writes) on flaky connections. Fails quietly in unsupported contexts
  // (e.g. multiple tabs) rather than blocking the app.
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn("Offline persistence not enabled:", err.code);
  });

  function userDoc(uid) { return db.collection("users").doc(uid); }
  function col(uid, name) { return userDoc(uid).collection(name); }

  return { auth, db, userDoc, col };
})();
