// utils.js — small shared helpers, no dependencies.

const Utils = (() => {
  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // Local calendar date as YYYY-MM-DD. Deliberately NOT date.toISOString()
  // — that converts to UTC first, so anyone in a timezone ahead of UTC
  // (e.g. UTC+1 and beyond) got the previous day's key at local midnight,
  // throwing off the calendar, "today" highlighting, and streaks by a day.
  function todayKey(date = new Date()) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function offsetDateKey(days) {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return todayKey(d);
  }

  function dateKeyFromParts(year, month, day) {
    return todayKey(new Date(year, month, day));
  }

  function formatDisplayDate(dateKey) {
    const d = new Date(dateKey + "T00:00:00");
    return d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  }

  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function debounce(fn, wait) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  function greeting() {
    const h = new Date().getHours();
    if (h < 5) return "Still up?";
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    if (h < 21) return "Good evening";
    return "Winding down?";
  }

  // Returns a CSS gradient string representing the current time of day,
  // reused for the Today header, task rings, and the focus timer.
  function dayArcGradient(hour = new Date().getHours()) {
    const stops = {
      dawn: "#7FA6B0",
      midday: "#E2A33D",
      dusk: "#C97B84",
      night: "#1B2E2A"
    };
    if (hour < 6) return `linear-gradient(135deg, ${stops.night}, ${stops.dawn})`;
    if (hour < 11) return `linear-gradient(135deg, ${stops.dawn}, ${stops.midday})`;
    if (hour < 17) return `linear-gradient(135deg, ${stops.midday}, ${stops.midday})`;
    if (hour < 21) return `linear-gradient(135deg, ${stops.midday}, ${stops.dusk})`;
    return `linear-gradient(135deg, ${stops.dusk}, ${stops.night})`;
  }

  // Minimal local persistence stand-in for Firestore (replaced in Phase 4).
  const Store = {
    get(key, fallback) {
      try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, JSON.stringify(value));
      } catch (e) {
        console.warn("Couldn't save locally:", e);
      }
    }
  };

  function showToast(message) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => el.classList.remove("show"), 2600);
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  return { todayKey, offsetDateKey, dateKeyFromParts, formatDisplayDate, uid, debounce, greeting, dayArcGradient, Store, showToast, escapeHtml };
})();
