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
  // writes) on flaky connections, synced across tabs. Firebase's newer
  // FirestoreSettings.cache API (persistentLocalCache/persistentMultipleTabManager)
  // is only exported from the modular `firebase/firestore` import, not from
  // the compat build loaded here (firebase-firestore-compat.js) — calling it
  // throws "is not a function". enablePersistence() logs a deprecation
  // notice in the console but works correctly, so we keep it until this
  // project migrates off the compat SDK. Fails quietly in unsupported
  // contexts (e.g. private browsing) rather than blocking the app.
  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    console.warn("Offline persistence not enabled:", err.code || err.message);
  });

  function userDoc(uid) { return db.collection("users").doc(uid); }
  function col(uid, name) { return userDoc(uid).collection(name); }

  // Messaging isn't supported everywhere (e.g. Safari < 16.4, some private
  // browsing modes) — guard so the rest of the app can check FB.messaging
  // truthiness instead of catching exceptions everywhere.
  let messaging = null;
  try {
    if (firebase.messaging && firebase.messaging.isSupported) {
      firebase.messaging.isSupported().then(supported => {
        if (supported) messaging = firebase.messaging();
      });
    } else if (firebase.messaging) {
      messaging = firebase.messaging();
    }
  } catch (err) {
    console.warn("Firebase Messaging not available:", err.message);
  }

  return { auth, db, userDoc, col, get messaging() { return messaging; } };
})();
