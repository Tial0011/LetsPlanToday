// pwa.js — Phase 5. Everything PWA-shaped that isn't Firebase:
// service worker registration, the install prompt, local daily-reminder
// notifications, and Wake Lock during focus sessions.
//
// Deliberately honest about limits: a browser tab can't reliably notify a
// user once the app is fully closed (no push server here — see README),
// and a PWA can't lock a phone or block a user from leaving the tab.
// Deep Focus Mode uses the strongest thing browsers actually offer
// (Wake Lock + fullscreen + visibility awareness), nothing more.

const PWA = (() => {
  let deferredInstallPrompt = null;
  let wakeLockSentinel = null;
  let reminderIntervalId = null;
  let visibilityWakeLockHandlerBound = false;
  let eligibleCallback = null;
  let awaitingKeyMoment = false; // true right after signup/login, until the banner has shown once
  let installReminderIntervalId = null;

  // ---------- service worker ----------
  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => {
        console.warn("Service worker registration failed:", err);
      });
    });
  }

  // ---------- install prompt ----------
  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches
      || window.navigator.standalone === true; // iOS Safari
  }

  function initInstallPrompt({ onEligible } = {}) {
    if (isStandalone()) return;
    eligibleCallback = onEligible || null;

    window.addEventListener("beforeinstallprompt", e => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const visits = Utils.Store.get("visitCount", 0);
      const dismissed = Utils.Store.get("installBannerDismissed", false);
      if (dismissed) return;
      if ((visits >= 3 || awaitingKeyMoment) && eligibleCallback) {
        awaitingKeyMoment = false;
        eligibleCallback();
      }
    });

    window.addEventListener("appinstalled", () => {
      deferredInstallPrompt = null;
      awaitingKeyMoment = false;
      Utils.Store.set("installBannerDismissed", true);
    });
  }

  // Called right after a successful signup or login (see auth.js). If the
  // browser has already handed us the deferred prompt, show the banner now;
  // otherwise remember to show it the moment beforeinstallprompt does fire,
  // instead of making the user stumble onto it later in some other screen.
  function notePostAuthMoment() {
    if (isStandalone()) return;
    const dismissed = Utils.Store.get("installBannerDismissed", false);
    if (dismissed) return;
    if (deferredInstallPrompt && eligibleCallback) {
      eligibleCallback();
    } else {
      awaitingKeyMoment = true;
    }
  }

  function canPromptInstall() {
    return !!deferredInstallPrompt;
  }

  async function promptInstall() {
    if (!deferredInstallPrompt) return "unavailable";
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    return outcome; // "accepted" | "dismissed"
  }

  function dismissInstallBanner() {
    Utils.Store.set("installBannerDismissed", true);
  }

  // Gently keeps reminding someone who hasn't installed yet, every 10
  // minutes, for as long as the app stays open — on top of (not instead
  // of) the always-visible install icon, for whenever they feel like it.
  // Deliberately ignores the one-time "Not now" dismissal on the banner
  // itself, since the point here is a slower, recurring nudge rather than
  // a one-shot prompt.
  function startInstallReminders({ onEligible, onNudge } = {}) {
    if (installReminderIntervalId) return;
    installReminderIntervalId = setInterval(() => {
      if (isStandalone()) return;
      if (deferredInstallPrompt && onEligible) { onEligible(); return; }
      if (onNudge) onNudge();
    }, 10 * 60 * 1000);
  }

  function recordVisit() {
    const visits = Utils.Store.get("visitCount", 0) + 1;
    Utils.Store.set("visitCount", visits);
    return visits;
  }

  // ---------- local reminder notifications ----------
  // No push server, so this only fires while the app/tab is open (even if
  // backgrounded). Settings copy should say so plainly — see app.js.
  function notificationsSupported() {
    return "Notification" in window && "serviceWorker" in navigator;
  }

  async function requestNotificationPermission() {
    if (!notificationsSupported()) return "unsupported";
    if (Notification.permission === "granted") return "granted";
    if (Notification.permission === "denied") return "denied";
    return Notification.requestPermission();
  }

  function notificationPermission() {
    return notificationsSupported() ? Notification.permission : "unsupported";
  }

  // ---------- real push notifications (Firebase Cloud Messaging) ----------
  // Unlike startReminderWatcher() below (which only fires while this tab is
  // open), this lets a server-side Cloud Function push a notification to
  // the device at the right time even if the browser is fully closed.
  // Requires: firebaseVapidKey set in js/firebase-config.js, and the
  // Cloud Function in /functions deployed (see functions/README.md).
  async function enablePushNotifications(uid) {
    if (!notificationsSupported()) return "unsupported";
    const perm = await requestNotificationPermission();
    if (perm !== "granted") return perm;
    if (!FB.messaging) return "unsupported";
    if (!firebaseVapidKey || firebaseVapidKey.startsWith("PASTE_")) {
      console.warn("firebaseVapidKey isn't set in js/firebase-config.js — push notifications can't register.");
      return "unconfigured";
    }
    try {
      const reg = await navigator.serviceWorker.ready;
      const token = await FB.messaging.getToken({ vapidKey: firebaseVapidKey, serviceWorkerRegistration: reg });
      if (!token) return "denied";
      await FB.col(uid, "fcmTokens").doc(token).set({
        token,
        createdAt: Date.now(),
        userAgent: navigator.userAgent,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      }, { merge: true });
      // Foreground messages don't auto-show a system notification — the tab
      // is already open, so surface it as an in-app toast instead.
      FB.messaging.onMessage(payload => {
        const body = (payload.notification && payload.notification.body) || "Check in on your day?";
        Utils.showToast(body);
      });
      return "granted";
    } catch (err) {
      console.warn("Push registration failed:", err);
      return "error";
    }
  }

  async function disablePushNotifications(uid) {
    if (!FB.messaging) return;
    try {
      const token = await FB.messaging.getToken().catch(() => null);
      if (token) {
        await FB.col(uid, "fcmTokens").doc(token).delete().catch(() => {});
        await FB.messaging.deleteToken().catch(() => {});
      }
    } catch (err) { /* best-effort */ }
  }

  async function fireReminder(title, body) {
    if (!notificationsSupported() || Notification.permission !== "granted") return;
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body,
        icon: "assets/icons/icon-192.png",
        badge: "assets/icons/icon-192.png",
        tag: "plan-today-reminder"
      });
    } catch (err) {
      // showNotification needs an active SW registration; fail quietly offline-first.
    }
  }

  function startReminderWatcher(getSettings, getContext) {
    if (reminderIntervalId) return;
    reminderIntervalId = setInterval(() => {
      const s = getSettings();
      if (!s.reminderTime || Notification.permission !== "granted") return;
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (hhmm !== s.reminderTime) return;
      const todayKey = Utils.todayKey();
      const lastFired = Utils.Store.get("reminderLastFired", "");
      if (lastFired === todayKey) return;
      Utils.Store.set("reminderLastFired", todayKey);
      const ctx = typeof getContext === "function" ? getContext() : null;
      let body = "One thing at a time — want to check in?";
      if (ctx && ctx.today3Total > 0) {
        const remaining = ctx.today3Total - ctx.today3Done;
        body = remaining <= 0
          ? "You wrapped up all of Today's 3 already — nice. Journal or reflect before you're done?"
          : `${remaining} of your Today's 3 ${remaining === 1 ? "is" : "are"} still open.`;
      }
      fireReminder("Let's Plan Today", body);
    }, 20000);
  }

  // ---------- Wake Lock (Deep Focus Mode) ----------
  function wakeLockSupported() {
    return "wakeLock" in navigator;
  }

  async function acquireWakeLock() {
    if (!wakeLockSupported()) return;
    try {
      wakeLockSentinel = await navigator.wakeLock.request("screen");
      if (!visibilityWakeLockHandlerBound) {
        visibilityWakeLockHandlerBound = true;
        document.addEventListener("visibilitychange", async () => {
          if (document.visibilityState === "visible" && wakeLockSentinel === null && Focus.getState()) {
            await acquireWakeLock();
          }
        });
      }
      wakeLockSentinel.addEventListener("release", () => { wakeLockSentinel = null; });
    } catch (err) {
      wakeLockSentinel = null; // e.g. low battery, unsupported context — fail silently
    }
  }

  function releaseWakeLock() {
    if (wakeLockSentinel) {
      wakeLockSentinel.release().catch(() => {});
      wakeLockSentinel = null;
    }
  }

  // ---------- online/offline ----------
  function initConnectivityToast() {
    window.addEventListener("offline", () => Utils.showToast("You're offline. Changes will sync when you're back."));
    window.addEventListener("online", () => Utils.showToast("Back online."));
  }

  return {
    registerServiceWorker, isStandalone,
    initInstallPrompt, notePostAuthMoment, canPromptInstall, promptInstall, dismissInstallBanner, recordVisit,
    startInstallReminders,
    notificationsSupported, requestNotificationPermission, notificationPermission, startReminderWatcher,
    enablePushNotifications, disablePushNotifications,
    wakeLockSupported, acquireWakeLock, releaseWakeLock,
    initConnectivityToast
  };
})();
