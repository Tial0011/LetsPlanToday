// Minimal Node-side sanity tests for pure logic extracted from the app.
// No DOM/Firebase here — just the date/format/timer math that's easy to
// get subtly wrong and easy to check without a browser.
const assert = require("assert");

// ---- Utils.formatTime-equivalent (mirrors Focus.formatTime) ----
function formatTime(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
assert.strictEqual(formatTime(0), "00:00");
assert.strictEqual(formatTime(59), "00:59");
assert.strictEqual(formatTime(60), "01:00");
assert.strictEqual(formatTime(25 * 60), "25:00");
assert.strictEqual(formatTime(3599), "59:59");
console.log("formatTime: OK");

// ---- todayKey / offsetDateKey (mirrors utils.js) ----
// Force a UTC+1 timezone (no DST) so this test actually exercises the bug:
// date.toISOString() converts to UTC first, so local midnight in any
// timezone ahead of UTC used to come out as the previous day's key.
process.env.TZ = "Africa/Lagos";
function pad2(n) { return String(n).padStart(2, "0"); }
function todayKey(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
const d = new Date(2026, 7, 24, 0, 5); // local midnight-ish, Aug 24 2026
assert.strictEqual(todayKey(d), "2026-08-24");
// The old (buggy) implementation would fail this exact case in UTC+1:
assert.notStrictEqual(d.toISOString().slice(0, 10), "2026-08-24");
console.log("todayKey: OK (local date, not shifted by UTC conversion)");

// ---- reminder HH:MM match logic (mirrors pwa.js startReminderWatcher) ----
function hhmm(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
const morning = new Date(2026, 7, 24, 8, 5);
assert.strictEqual(hhmm(morning), "08:05");
const evening = new Date(2026, 7, 24, 21, 0);
assert.strictEqual(hhmm(evening), "21:00");
console.log("hhmm: OK");

// ---- once-per-day reminder guard ----
let lastFired = "";
function shouldFire(todayKey) {
  if (lastFired === todayKey) return false;
  lastFired = todayKey;
  return true;
}
assert.strictEqual(shouldFire("2026-08-24"), true);
assert.strictEqual(shouldFire("2026-08-24"), false); // same day, no duplicate
assert.strictEqual(shouldFire("2026-08-25"), true);  // next day, fires again
console.log("once-per-day guard: OK");

// ---- Today's 3 cap (mirrors tasks.js toggleToday3) ----
function canAddToToday3(currentCount) { return currentCount < 3; }
assert.strictEqual(canAddToToday3(0), true);
assert.strictEqual(canAddToToday3(2), true);
assert.strictEqual(canAddToToday3(3), false);
console.log("Today's 3 cap: OK");

console.log("\nAll logic tests passed.");
