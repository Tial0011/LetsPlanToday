// sw.js — Phase 5: app-shell caching + offline support for "Let's Plan Today".
//
// Strategy:
//   - App shell (HTML/CSS/JS/icons/manifest): cache-first, precached on install.
//     These are versioned by CACHE_VERSION below — bump it on every deploy so
//     clients pick up new files instead of serving stale ones forever.
//   - Cross-origin static assets (Google Fonts, Firebase SDK scripts):
//     stale-while-revalidate — serve from cache instantly if present, refresh
//     in the background. Keeps the app usable offline after the first visit.
//   - Firestore/Firebase API calls are NEVER intercepted here — Firestore has
//     its own offline persistence (see firebase.js) and handles queueing/sync
//     far better than a generic SW cache would.
//   - Navigation requests fall back to the cached index.html shell if the
//     network is unavailable, so opening the app offline still works.

// ---------- Firebase Cloud Messaging: background push ----------
// Wrapped in try/catch — importScripts is synchronous, so if the device is
// offline when this worker wakes up, letting it throw would break the whole
// service worker (including the offline caching below). A missed push
// handler registration is a much smaller loss than that.
try {
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
  importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");
  importScripts("./js/firebase-config.js");

  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Fires when a push arrives while no tab has focus (or the browser is
  // backgrounded) — this is what makes reminders work with the app closed.
  // Foreground messages are handled separately in js/pwa.js via onMessage().
  messaging.onBackgroundMessage(payload => {
    const title = (payload.notification && payload.notification.title) || "Let's Plan Today";
    const body = (payload.notification && payload.notification.body) || "Check in on your day?";
    self.registration.showNotification(title, {
      body,
      icon: "./assets/icons/icon-192.png",
      badge: "./assets/icons/icon-192.png",
      tag: "plan-today-reminder"
    });
  });
} catch (err) {
  // Offline cold-start, or firebase-messaging just isn't supported here —
  // the rest of the service worker (caching) still needs to run below.
  console.warn("Push messaging unavailable in this service worker context:", err && err.message);
}

const CACHE_VERSION = "v9";
const SHELL_CACHE = `plan-today-shell-${CACHE_VERSION}`;
const RUNTIME_CACHE = `plan-today-runtime-${CACHE_VERSION}`;

const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/global.css",
  "./css/components.css",
  "./css/responsive.css",
  "./js/firebase-config.js",
  "./js/firebase.js",
  "./js/utils.js",
  "./js/icons.js",
  "./js/calendar.js",
  "./js/auth.js",
  "./js/tasks.js",
  "./js/journal.js",
  "./js/focus.js",
  "./js/reflection.js",
  "./js/pwa.js",
  "./js/app.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-192-maskable.png",
  "./assets/icons/icon-512-maskable.png",
  "./assets/icons/favicon-32.png"
];

// Never intercept these — let them hit the network / Firestore's own SDK-level
// offline handling untouched.
const NEVER_CACHE_PATTERNS = [
  /firestore\.googleapis\.com/,
  /identitytoolkit\.googleapis\.com/,
  /securetoken\.googleapis\.com/,
  /\/__\/auth\//
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
          .map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

function isNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some(re => re.test(url));
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkFetch = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await networkFetch) || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    return cached || Response.error();
  }
}

self.addEventListener("fetch", event => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (!request.url.startsWith("http")) return; // skip chrome-extension://, data:, etc.
  const url = request.url;
  if (isNeverCache(url)) return; // let the browser handle it natively

  // Navigations: try network first (fresh app), fall back to cached shell offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match("./index.html")) || Response.error();
      })
    );
    return;
  }

  const sameOrigin = url.startsWith(self.location.origin);
  if (sameOrigin) {
    event.respondWith(cacheFirst(request));
  } else {
    // Google Fonts, Firebase SDK CDN scripts, etc.
    event.respondWith(staleWhileRevalidate(request));
  }
});

// ---------- notification clicks ----------
// Handles clicks for BOTH kinds of notification this app shows: the local
// ones scheduled by js/pwa.js while a tab is open, and the background push
// ones shown by onBackgroundMessage() above when the app is closed.
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(clientsArr => {
      const existing = clientsArr.find(c => "focus" in c);
      if (existing) return existing.focus();
      return self.clients.openWindow("./");
    })
  );
});
