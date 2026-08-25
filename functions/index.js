// functions/index.js — the server half of real push notifications.
//
// The client (js/pwa.js) only registers a device for push and stores an
// FCM token in Firestore. Something still has to actually send the push at
// the right time, even while every browser tab is closed — that's this
// file. It runs on a schedule (Cloud Scheduler, wired up automatically by
// onSchedule below) and sends via the Firebase Admin SDK.
//
// Deploy with: firebase deploy --only functions
// Requires the Blaze (pay-as-you-go) plan — Cloud Scheduler needs billing
// enabled, though a single user checking in once a day costs, in practice,
// nothing (well within the free tier quotas).

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();
const messaging = admin.messaging();

setGlobalOptions({ maxInstances: 5 });

// Returns { dateKey: "YYYY-MM-DD", hhmm: "HH:MM" } for "right now", in the
// given IANA timezone. Mirrors Utils.todayKey()'s local-date logic on the
// client, just computed server-side per user instead of assuming one
// server timezone for everybody.
function nowPartsInTZ(tz) {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-CA", {
        timeZone: tz, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit"
      }).formatToParts(new Date()).map(p => [p.type, p.value])
    );
    return { dateKey: `${parts.year}-${parts.month}-${parts.day}`, hhmm: `${parts.hour}:${parts.minute}` };
  } catch (err) {
    // Unknown/invalid IANA zone string — fall back rather than crash the run.
    return nowPartsInTZ("UTC");
  }
}

// Fixed 4x/day check-in schedule (opt-in via the "Check-in reminders" toggle
// in Settings) — kept in sync with CHECK_IN_TIMES in js/pwa.js, which runs
// the same schedule locally as a fallback while a tab is open.
const CHECK_IN_TIMES = ["07:00", "12:00", "16:00", "19:00"];

async function sendToUser(userRef, uid, dateKey, title) {
  const tokensSnap = await userRef.collection("fcmTokens").get();
  if (tokensSnap.empty) return;                         // nobody registered a device
  const tokens = tokensSnap.docs.map(d => d.id);

  // Same "Today's 3" phrasing the client used for its local-only reminder.
  const tasksSnap = await userRef.collection("tasks")
    .where("date", "==", dateKey).where("isToday3", "==", true).get();
  const total = tasksSnap.size;
  const done = tasksSnap.docs.filter(d => d.data().completed).length;

  let body = "One thing at a time — want to check in?";
  if (total > 0) {
    const remaining = total - done;
    body = remaining <= 0
      ? "You wrapped up all of Today's 3 already — nice. Journal or reflect before you're done?"
      : `${remaining} of your Today's 3 ${remaining === 1 ? "is" : "are"} still open.`;
  }

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body },
    webpush: {
      notification: { icon: "/assets/icons/icon-192.png", badge: "/assets/icons/icon-192.png" },
      fcmOptions: { link: "/" }
    }
  });

  // Prune tokens that are dead (uninstalled, permission revoked, etc.) so
  // this collection doesn't grow forever and every send doesn't keep
  // retrying a device that's gone for good.
  const deadTokenCodes = new Set(["messaging/registration-token-not-registered", "messaging/invalid-argument"]);
  const cleanup = response.responses
    .map((r, i) => (!r.success && deadTokenCodes.has(r.error && r.error.code)) ? tokens[i] : null)
    .filter(Boolean)
    .map(token => userRef.collection("fcmTokens").doc(token).delete());
  await Promise.all(cleanup);
}

async function processOneUser(settingsDoc) {
  const uid = settingsDoc.ref.parent.parent.id;
  const data = settingsDoc.data() || {};
  const tz = data.timezone || "UTC";
  const { dateKey, hhmm } = nowPartsInTZ(tz);
  const userRef = db.collection("users").doc(uid);

  // Custom daily reminder (user-picked time).
  if (data.reminderTime && hhmm === data.reminderTime && data.lastReminderSentDate !== dateKey) {
    await sendToUser(userRef, uid, dateKey, "Let's Plan Today");
    await settingsDoc.ref.set({ lastReminderSentDate: dateKey }, { merge: true });
  }

  // Fixed 4x/day check-ins, opt-in via Settings. Tracked per-slot so all
  // four can fire on the same day without clobbering each other.
  if (data.checkInReminders && CHECK_IN_TIMES.includes(hhmm)) {
    const sentMap = data.lastCheckinSent || {};
    if (sentMap[hhmm] !== dateKey) {
      await sendToUser(userRef, uid, dateKey, "Let's Plan Today");
      await settingsDoc.ref.set({ lastCheckinSent: { ...sentMap, [hhmm]: dateKey } }, { merge: true });
    }
  }
}

// Cloud Scheduler resolution is 1 minute — matches the precision the
// Settings screen's <input type="time"> already implies.
exports.sendDailyReminders = onSchedule("every 1 minutes", async () => {
  const settingsSnap = await db.collectionGroup("settings").get();
  const jobs = settingsSnap.docs
    .filter(doc => doc.id === "preferences" && (doc.data().reminderTime || doc.data().checkInReminders))
    .map(doc => processOneUser(doc).catch(err => console.error(`Reminder failed for ${doc.ref.path}:`, err)));
  await Promise.all(jobs);
});
