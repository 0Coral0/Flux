(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) { root.FluxReviewData = api; root.fluxReviewData = api.create(root); }
})(typeof window === 'undefined' ? null : window, function () {
  'use strict';
  function validate(rating, text) {
    const score = Number(rating), body = String(text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim();
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error('Choose a rating from 1 to 5 stars.');
    if (body.length > 1200) throw new Error('Keep your review under 1,200 characters.');
    return { rating: score, text: body };
  }
  function review(record) {
    const data = record.data();
    if (!data || data.uid !== record.id || !Number.isInteger(data.rating) || data.rating < 1 || data.rating > 5 || typeof data.text !== 'string' || data.text.length > 1200) return null;
    return { uid: record.id, authorName: String(data.authorName || 'Flux member').slice(0, 40), rating: data.rating, text: data.text,
      updatedAt: typeof data.updatedAt?.toMillis === 'function' ? data.updatedAt.toMillis() : 0 };
  }
  function create(win, options = {}) {
    const fetchSummary = options.fetch || ((...args) => win.fetch(...args));
    const id = value => { if (typeof value !== 'string' || !/^[a-z0-9][a-z0-9-]{0,99}$/.test(value)) throw new Error('That game is unavailable.'); return value; };
    const account = () => { if (!win.fluxAuthState?.uid) throw new Error('Sign in to write a review.'); return win.fluxAuthState; };
    async function store() { const db = win.fluxFirebaseDb || await win.fluxFirebaseReady; if (!db || !win.fluxFirebase) throw new Error('Reviews are temporarily unavailable. Please try again.'); return db; }
    const stamp = () => win.fluxFirebase.firestore.FieldValue.serverTimestamp();
    const collection = (db, gameId) => db.collection('game_reviews').doc(id(gameId)).collection('reviews');
    return {
      async list(gameId, { after = null } = {}) {
        const db = await store(); let query = collection(db, gameId).orderBy('updatedAt', 'desc').limit(12);
        if (after) query = query.startAfter(after);
        const result = await query.get(); return { reviews: result.docs.map(review).filter(Boolean), cursor: result.docs.at(-1) || null, hasMore: result.docs.length === 12 };
      },
      async summary(gameId) {
        await store();
        const config = win.fluxFirebase.app().options;
        const endpoint = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(config.projectId) + '/databases/(default)/documents/game_reviews/' + id(gameId) + ':runAggregationQuery?key=' + encodeURIComponent(config.apiKey);
        const response = await fetchSummary(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ structuredAggregationQuery: {
          structuredQuery: { from: [{ collectionId: 'reviews' }] }, aggregations: [{ alias: 'reviewCount', count: {} }, { alias: 'ratingAverage', avg: { field: { fieldPath: 'rating' } } }]
        } }) });
        if (!response.ok) throw new Error('Rating summary is temporarily unavailable.');
        const results = await response.json(), fields = results.find(result => result.result?.aggregateFields)?.result.aggregateFields || {};
        const count = Number(fields.reviewCount?.integerValue) || 0, value = fields.ratingAverage;
        return { count, average: value?.doubleValue !== undefined ? Number(value.doubleValue) : value?.integerValue !== undefined ? Number(value.integerValue) : null };
      },
      async mine(gameId) {
        if (!win.fluxAuthState?.uid) return null;
        const uid = account().uid, db = await store(), result = await collection(db, gameId).doc(uid).get();
        return result.exists ? review(result) : null;
      },
      async save(game, rating, text) {
        const me = account(), value = validate(rating, text), db = await store();
        if (win.fluxChatModeration && !win.fluxChatModeration.check(value.text).allowed) throw new Error('Please remove harmful or hateful language from your review.');
        const profile = await db.collection('chat_users').doc(me.uid).get();
        const authorName = profile.exists && typeof profile.data().username === 'string' ? profile.data().username : 'Flux member';
        const ref = collection(db, game.id).doc(me.uid);
        await db.runTransaction(async transaction => {
          const previous = await transaction.get(ref);
          transaction.set(ref, { uid: me.uid, gameId: id(game.id), gameName: String(game.game.name).slice(0, 120), authorName,
            ...value, createdAt: previous.exists ? previous.data().createdAt : stamp(), updatedAt: stamp() });
        });
      },
      async remove(gameId, uid) { const me = account(), db = await store(); await collection(db, gameId).doc(uid || me.uid).delete(); },
      async report(gameId, authorUid, reason) {
        const me = account(), body = String(reason || '').trim();
        if (!body || body.length > 500) throw new Error('Add a reason with 1–500 characters.');
        const db = await store();
        await db.collection('game_review_reports').doc(id(gameId) + '_' + authorUid + '_' + me.uid).set({ gameId: id(gameId), authorUid, reporterUid: me.uid, reason: body, createdAt: stamp() });
      }
    };
  }
  return { create, validate, review };
});
