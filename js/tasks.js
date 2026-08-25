// tasks.js — task list + Today's 3, backed by Firestore.
// Local cache is kept in sync via onSnapshot; call Tasks.init(uid) after
// sign-in and Tasks.teardown() on sign-out. Render functions elsewhere
// read the cache synchronously, same as the Phase 3 localStorage version.

const Tasks = (() => {
  let cache = [];
  // Optimistic entries: shown instantly on add(), before the Firestore
  // round-trip resolves and onSnapshot brings back the real doc. Keeps
  // input -> visible task feeling real-time instead of network-bound.
  let optimistic = [];
  // Optimistic overrides for toggleToday3() on already-synced tasks, keyed
  // by task id -> the isToday3 value we're waiting on Firestore to confirm.
  // Without this, clicking "Add to Today's 3" only reflected on Today's
  // screen once the write round-tripped through onSnapshot — on a slow
  // connection it looked like the click did nothing.
  let toggleOverrides = {};
  let unsubscribe = null;
  let onChange = () => {};

  function init(uid) {
    teardown();
    unsubscribe = FB.col(uid, "tasks").onSnapshot(snap => {
      cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      // Reconcile: drop any optimistic row once a real doc with the same
      // title/date/createdAt-ish has landed, so it doesn't show twice.
      optimistic = optimistic.filter(o => !cache.some(c =>
        c.title === o.title && c.date === o.date && Math.abs((c.createdAt || 0) - o.createdAt) < 15000
      ));
      // Same idea for toggleToday3(): once the real doc agrees with what we
      // optimistically set, drop the override so cache is the source of truth again.
      Object.keys(toggleOverrides).forEach(id => {
        const real = cache.find(c => c.id === id);
        if (real && real.isToday3 === toggleOverrides[id]) delete toggleOverrides[id];
      });
      onChange();
    }, err => console.error("tasks listener error:", err));
  }

  function teardown() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    cache = [];
    optimistic = [];
    toggleOverrides = {};
  }

  // Effective isToday3 for a cached task, accounting for a pending toggle.
  function effectiveIsToday3(task) {
    return Object.prototype.hasOwnProperty.call(toggleOverrides, task.id) ? toggleOverrides[task.id] : task.isToday3;
  }

  // How many tasks are (optimistically) in Today's 3 for a date, excluding one id.
  function today3Count(dateKey, excludeId) {
    const real = cache.filter(t => t.date === dateKey && t.id !== excludeId && effectiveIsToday3(t)).length;
    const pending = optimistic.filter(t => t.date === dateKey && t.isToday3).length;
    return real + pending;
  }

  function forDate(dateKey) {
    const real = cache.filter(t => t.date === dateKey)
      .map(t => Object.prototype.hasOwnProperty.call(toggleOverrides, t.id) ? { ...t, isToday3: toggleOverrides[t.id] } : t);
    const pending = optimistic.filter(t => t.date === dateKey);
    return [...real, ...pending].sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  }

  function currentUid() {
    return Auth.getCurrentUser()?.uid;
  }

  async function add(title, dateKey, opts = {}) {
    const trimmed = title && title.trim();
    if (!trimmed) return;
    const uid = currentUid();
    if (!uid) return;

    let isToday3 = !!opts.isToday3;
    if (isToday3 && today3Count(dateKey, null) >= 3) {
      isToday3 = false;
      Utils.showToast("Today's 3 is full — added to your task list instead.");
    }

    const payload = { title: trimmed, date: dateKey, completed: false, isToday3, createdAt: Date.now() };
    const tempId = "pending-" + Utils.uid();
    optimistic.push({ id: tempId, _pending: true, ...payload });
    onChange(); // render immediately — don't wait on the network

    await FB.col(uid, "tasks").add(payload).catch(() => {
      optimistic = optimistic.filter(o => o.id !== tempId);
      onChange();
      Utils.showToast("We couldn't save that right now. Check your connection and try again.");
    });
  }

  // dateKeys with at least one task on them — planning your day counts as
  // showing up, not just checking boxes off.
  function activeDates() {
    return [...new Set(cache.map(t => t.date))];
  }

  // Total completed tasks across all dates — feeds the "tasks completed"
  // milestones on the Progress screen.
  function completedCount() {
    return cache.filter(t => t.completed).length;
  }

  async function toggleComplete(id) {
    const uid = currentUid();
    const t = cache.find(t => t.id === id);
    if (!uid || !t) return;
    await FB.col(uid, "tasks").doc(id).update({
      completed: !t.completed,
      completedAt: !t.completed ? Date.now() : null
    }).catch(() => Utils.showToast("We couldn't save that right now. Check your connection and try again."));
  }

  async function toggleToday3(id) {
    const uid = currentUid();
    const t = cache.find(t => t.id === id);
    if (!uid || !t) return;
    const current = effectiveIsToday3(t);
    if (!current && today3Count(t.date, id) >= 3) {
      Utils.showToast("Today's 3 is full — that's the point.");
      return;
    }
    const next = !current;
    toggleOverrides[id] = next;
    onChange(); // reflect immediately, e.g. on the Today screen — don't wait on the round-trip
    await FB.col(uid, "tasks").doc(id).update({ isToday3: next }).catch(() => {
      delete toggleOverrides[id];
      onChange();
      Utils.showToast("We couldn't save that right now. Check your connection and try again.");
    });
  }

  async function remove(id) {
    const uid = currentUid();
    if (!uid) return;
    await FB.col(uid, "tasks").doc(id).delete()
      .catch(() => Utils.showToast("We couldn't delete that right now. Check your connection and try again."));
  }

  // ---- render helpers (unchanged from Phase 3) ----

  function renderTaskRow(task, { showToday3Toggle = false } = {}) {
    const pending = !!task._pending;
    return `
      <li class="task-row ${task.completed ? "completed" : ""} ${pending ? "pending" : ""}" data-id="${task.id}">
        <button class="task-ring" data-action="toggle-complete" ${pending ? "disabled" : ""} aria-label="${task.completed ? "Mark not done" : "Mark done"}: ${Utils.escapeHtml(task.title)}"></button>
        <span class="task-title">${Utils.escapeHtml(task.title)}</span>
        ${showToday3Toggle ? `<button class="btn-ghost" style="padding:2px 8px;font-size:0.75rem;border-radius:8px;" data-action="toggle-today3" ${pending ? "disabled" : ""} aria-pressed="${task.isToday3}">${task.isToday3 ? "In Today's 3" : "Add to Today's 3"}</button>` : ""}
        <button class="task-delete" data-action="delete" ${pending ? "disabled" : ""} aria-label="Delete: ${Utils.escapeHtml(task.title)}">✕</button>
      </li>`;
  }

  function bindRowEvents(container) {
    container.querySelectorAll(".task-row").forEach(row => {
      const id = row.dataset.id;
      if (id.startsWith("pending-")) return; // not a real doc yet, nothing to bind
      row.querySelector('[data-action="toggle-complete"]').addEventListener("click", () => toggleComplete(id));
      const t3 = row.querySelector('[data-action="toggle-today3"]');
      if (t3) t3.addEventListener("click", () => toggleToday3(id));
      row.querySelector('[data-action="delete"]').addEventListener("click", () => remove(id));
    });
  }

  return {
    init, teardown, forDate, add, toggleComplete, toggleToday3, remove, activeDates, completedCount,
    renderTaskRow, bindRowEvents,
    set onChange(fn) { onChange = fn; }
  };
})();
