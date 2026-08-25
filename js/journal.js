// journal.js — daily journal entries, backed by Firestore.
// One document per date (doc ID = YYYY-MM-DD) under users/{uid}/journal.

const Journal = (() => {
  let cache = {}; // { [dateKey]: {text, mood, promptUsed, updatedAt} }
  let unsubscribe = null;
  let onChange = () => {};

  const PROMPTS = [
    "How are you feeling today?",
    "What's on your mind?",
    "What's one thing you're grateful for?",
    "What would make today a good day?",
    "What are you looking forward to?",
    "What's worrying you?",
    "What's one thing you want to improve?"
  ];

  function init(uid) {
    teardown();
    unsubscribe = FB.col(uid, "journal").onSnapshot(snap => {
      cache = {};
      snap.docs.forEach(d => { cache[d.id] = d.data(); });
      onChange();
    }, err => console.error("journal listener error:", err));
  }

  function teardown() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    cache = {};
  }

  function currentUid() { return Auth.getCurrentUser()?.uid; }

  function get(dateKey) {
    return cache[dateKey] || null;
  }

  async function setText(dateKey, text) {
    const uid = currentUid();
    if (!uid) return;
    await FB.col(uid, "journal").doc(dateKey).set({ text, updatedAt: Date.now() }, { merge: true })
      .catch(() => Utils.showToast("We couldn't save that right now. Check your connection and try again."));
  }

  async function setMood(dateKey, mood) {
    const uid = currentUid();
    if (!uid) return;
    await FB.col(uid, "journal").doc(dateKey).set({ mood, updatedAt: Date.now() }, { merge: true })
      .catch(() => Utils.showToast("We couldn't save that right now. Check your connection and try again."));
  }

  function randomPrompt() {
    return PROMPTS[Math.floor(Math.random() * PROMPTS.length)];
  }

  function entriesSorted() {
    return Object.keys(cache)
      .filter(k => cache[k].text && cache[k].text.trim())
      .sort((a, b) => b.localeCompare(a))
      .map(k => ({ date: k, ...cache[k] }));
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return entriesSorted();
    return entriesSorted().filter(e => e.text.toLowerCase().includes(q));
  }

  // dateKeys that have anything worth marking on a calendar (text or mood)
  function activeDates() {
    return Object.keys(cache).filter(k => (cache[k].text && cache[k].text.trim()) || cache[k].mood);
  }

  return { init, teardown, get, setText, setMood, randomPrompt, entriesSorted, search, activeDates, set onChange(fn) { onChange = fn; } };
})();
