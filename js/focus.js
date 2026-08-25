// focus.js — focus session timer. The countdown itself is purely local
// (no reason to round-trip a server every second); completed sessions
// are written to users/{uid}/focusSessions for the Progress screen.

const Focus = (() => {
  const RADIUS = 108;
  const CIRC = 2 * Math.PI * RADIUS;

  let state = null; // { taskTitle, totalSeconds, remaining, intervalId }
  let sessionCache = [];
  let unsubscribe = null;
  let onChange = () => {};

  function init(uid) {
    teardown();
    unsubscribe = FB.col(uid, "focusSessions").onSnapshot(snap => {
      sessionCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      onChange();
    }, err => console.error("focusSessions listener error:", err));
  }

  function teardown() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    sessionCache = [];
  }

  function circumference() { return CIRC; }
  function radius() { return RADIUS; }

  function start(taskTitle, minutes, onTick, onComplete) {
    stopTimer();
    state = { taskTitle, totalSeconds: minutes * 60, remaining: minutes * 60 };
    state.intervalId = setInterval(() => {
      state.remaining -= 1;
      onTick(state);
      if (state.remaining <= 0) {
        const finished = state;
        stopTimer();
        persistSession(taskTitle, minutes);
        onComplete(finished);
      }
    }, 1000);
    return state;
  }

  function pause() {
    if (state && state.intervalId) { clearInterval(state.intervalId); state.intervalId = null; }
  }

  function resume(onTick, onComplete) {
    if (!state || state.intervalId) return;
    state.intervalId = setInterval(() => {
      state.remaining -= 1;
      onTick(state);
      if (state.remaining <= 0) {
        const finished = state;
        const plannedMinutes = Math.round(state.totalSeconds / 60);
        stopTimer();
        persistSession(state.taskTitle, plannedMinutes);
        onComplete(finished);
      }
    }, 1000);
  }

  function stopTimer() {
    if (state && state.intervalId) clearInterval(state.intervalId);
    state = null;
  }

  function stop() { stopTimer(); }

  async function persistSession(taskTitle, plannedMinutes) {
    const uid = Auth.getCurrentUser()?.uid;
    if (!uid) return;
    await FB.col(uid, "focusSessions").add({
      taskTitle, durationPlanned: plannedMinutes, completedAt: Date.now()
    }).catch(() => Utils.showToast("We couldn't save that focus session. Check your connection."));
  }

  function sessionCount() { return sessionCache.length; }

  function activeDates() {
    return sessionCache.filter(s => s.completedAt).map(s => Utils.todayKey(new Date(s.completedAt)));
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }

  return {
    init, teardown, start, pause, resume, stop, sessionCount, activeDates, formatTime,
    circumference, radius, getState: () => state,
    set onChange(fn) { onChange = fn; }
  };
})();
