// reflection.js — evening reflection, all fields optional.
// One document per date under users/{uid}/reflections.

const Reflection = (() => {
  let cache = {};
  let unsubscribe = null;
  let onChange = () => {};

  const FIELDS = [
    { id: "wentWell", label: "What went well?" },
    { id: "didntGoAsPlanned", label: "What didn't go as planned?" },
    { id: "proudOf", label: "What are you proud of?" },
    { id: "carryIntoTomorrow", label: "What should you carry into tomorrow?" }
  ];

  function init(uid) {
    teardown();
    unsubscribe = FB.col(uid, "reflections").onSnapshot(snap => {
      cache = {};
      snap.docs.forEach(d => { cache[d.id] = d.data(); });
      onChange();
    }, err => console.error("reflections listener error:", err));
  }

  function teardown() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    cache = {};
  }

  function currentUid() { return Auth.getCurrentUser()?.uid; }

  function get(dateKey) {
    return cache[dateKey] || {};
  }

  async function setField(dateKey, fieldId, value) {
    const uid = currentUid();
    if (!uid) return;
    await FB.col(uid, "reflections").doc(dateKey).set({ [fieldId]: value, updatedAt: Date.now() }, { merge: true })
      .catch(() => Utils.showToast("We couldn't save that right now. Check your connection and try again."));
  }

  function completedCount() {
    return Object.keys(cache).filter(k => Object.values(cache[k]).some(v => typeof v === "string" && v.trim())).length;
  }

  function activeDates() {
    return Object.keys(cache).filter(k => Object.values(cache[k]).some(v => typeof v === "string" && v.trim()));
  }

  return { FIELDS, init, teardown, get, setField, completedCount, activeDates, set onChange(fn) { onChange = fn; } };
})();
