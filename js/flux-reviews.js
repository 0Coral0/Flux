(function (win) {
  'use strict';
  const doc = win.document, el = id => doc.getElementById(id), dialog = el('game-reviews-dialog');
  if (!dialog) return;
  let game = null, generation = 0, rating = 0, cursor = null, hasMore = false, busy = false, mine = null, rows = [], reportTarget = null;
  const node = (tag, className, text) => { const item = doc.createElement(tag); if (className) item.className = className; if (text !== undefined) item.textContent = text; return item; };
  const buttons = [...el('review-rating').querySelectorAll('button')];
  function setRating(value, focus = false) {
    rating = value;
    buttons.forEach((button, index) => { button.classList.toggle('selected', index < value); button.setAttribute('aria-checked', String(index + 1 === value)); button.tabIndex = index === (value ? value - 1 : 0) ? 0 : -1; });
    el('review-rating-label').textContent = value ? value + ' out of 5 stars' : 'Choose a rating';
    if (focus && value) buttons[value - 1].focus();
  }
  buttons.forEach((button, index) => { button.onclick = () => setRating(index + 1); button.onkeydown = event => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault(); setRating(event.key === 'Home' ? 1 : event.key === 'End' ? 5 : Math.max(1, Math.min(5, (rating || 1) + (['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : -1))), true);
  }; });
  function auth() {
    const signedIn = !!win.fluxAuthState?.uid;
    el('review-form').hidden = !signedIn; el('review-signin').hidden = signedIn;
    el('review-delete-own').hidden = !mine;
  }
  function render() {
    const list = el('review-list');
    if (!rows.length) { list.replaceChildren(node('p', 'feature-empty', 'No reviews yet. Be the first to rate this game.')); return; }
    list.replaceChildren(...rows.map(row => {
      const card = node('article', 'game-review'), header = node('div', 'game-review-header');
      const author = node('strong', '', row.authorName), stars = node('span', 'review-stars-display', '★'.repeat(row.rating) + '☆'.repeat(5 - row.rating));
      stars.setAttribute('aria-label', row.rating + ' out of 5 stars'); header.append(author, stars);
      const content = node('p', '', row.text || 'Left a star rating.');
      const footer = node('div', 'game-review-footer');
      if (row.updatedAt) { const time = node('time', '', new Date(row.updatedAt).toLocaleDateString()); time.dateTime = new Date(row.updatedAt).toISOString(); footer.append(time); }
      if (win.fluxAuthState?.uid && row.uid !== win.fluxAuthState.uid) {
        const report = node('button', 'feature-text-button', 'Report'); report.type = 'button'; report.onclick = () => { reportTarget = row.uid; el('review-report-panel').hidden = false; el('review-report-reason').focus(); }; footer.append(report);
      }
      if (win.fluxAuthState?.owner && row.uid !== win.fluxAuthState.uid) {
        const remove = node('button', 'feature-text-button', 'Remove'); remove.type = 'button'; remove.onclick = () => removeReview(row.uid); footer.append(remove);
      }
      card.append(header, content, footer); return card;
    }));
  }
  const errorText = error => error?.code === 'permission-denied' ? 'Reviews are temporarily unavailable. Please try again later.' : error?.message || 'Could not load reviews. Please try again.';
  async function load(more = false) {
    if (!game) return;
    const token = ++generation, selected = game; busy = true; el('review-refresh').disabled = true; el('review-more').disabled = true;
    el('review-status').textContent = more ? 'Loading more reviews…' : 'Loading reviews…';
    let timeout;
    try {
      const result = await Promise.race([Promise.allSettled([win.fluxReviewData.list(selected.id, { after: more ? cursor : null }), ...(more ? [] : [win.fluxReviewData.summary(selected.id), win.fluxReviewData.mine(selected.id)])]),
        new Promise((_, reject) => { timeout = win.setTimeout(() => reject(new Error('Reviews took too long to load. Try refreshing.')), 12000); })]);
      if (token !== generation) return;
      if (result[0].status === 'rejected') throw result[0].reason;
      const page = result[0].value; cursor = page.cursor; hasMore = page.hasMore;
      rows = more ? [...new Map([...rows, ...page.reviews].map(row => [row.uid, row])).values()] : page.reviews;
      if (!more) {
        const summary = result[1].status === 'fulfilled' ? result[1].value : null;
        el('review-summary').textContent = summary ? summary.count && Number.isFinite(summary.average) ? summary.average.toFixed(1) + ' ★ · ' + summary.count + (summary.count === 1 ? ' review' : ' reviews') : 'No ratings yet' : 'Rating summary unavailable';
        mine = result[2].status === 'fulfilled' ? result[2].value : null;
        setRating(mine?.rating || 0); el('review-text').value = mine?.text || '';
        el('review-submit').textContent = mine ? 'Update review' : 'Publish review'; auth();
      }
      render(); el('review-status').textContent = '';
    } catch (error) {
      if (token === generation) { el('review-status').textContent = errorText(error); if (!more) el('review-list').replaceChildren(node('p', 'feature-empty', 'Reviews could not be loaded. Refresh to try again.')); }
    } finally {
      win.clearTimeout(timeout);
      if (token === generation) { busy = false; el('review-refresh').disabled = false; el('review-more').disabled = false; el('review-more').hidden = !hasMore; }
    }
  }
  async function removeReview(uid) {
    if (!game || busy || !win.confirm('Delete this review?')) return;
    const selected = game; busy = true;
    try { await win.fluxReviewData.remove(selected.id, uid); if (game?.id === selected.id) { await load(); el('review-status').textContent = 'Review deleted.'; } }
    catch (error) { el('review-status').textContent = errorText(error); }
    finally { busy = false; }
  }
  el('theater-reviews').onclick = () => { if (game) { dialog.showModal(); auth(); load(); } };
  el('review-close').onclick = () => dialog.close(); el('review-refresh').onclick = () => { if (!busy) load(); };
  el('review-more').onclick = () => { if (!busy) load(true); };
  el('review-signin-button').onclick = () => { dialog.close(); win.closeTheater(); win.showPage('account'); el('flux-auth-email')?.focus(); };
  el('review-form').onsubmit = async event => {
    event.preventDefault(); if (!game || busy) return;
    const selected = game; el('review-submit').disabled = true; busy = true;
    try { await win.fluxReviewData.save(selected, rating, el('review-text').value); if (game?.id === selected.id) { await load(); el('review-status').textContent = 'Your review was published.'; } }
    catch (error) { el('review-status').textContent = errorText(error); }
    finally { busy = false; el('review-submit').disabled = false; }
  };
  el('review-delete-own').onclick = () => removeReview(win.fluxAuthState?.uid);
  el('review-report-cancel').onclick = () => { el('review-report-panel').hidden = true; reportTarget = null; };
  el('review-report-form').onsubmit = async event => {
    event.preventDefault(); if (!game || !reportTarget || busy) return; busy = true;
    try { await win.fluxReviewData.report(game.id, reportTarget, el('review-report-reason').value); el('review-report-panel').hidden = true; el('review-report-reason').value = ''; el('review-status').textContent = 'Report sent for review.'; }
    catch (error) { el('review-status').textContent = errorText(error); }
    finally { busy = false; }
  };
  win.addEventListener('flux-auth-changed', () => { mine = null; setRating(0); el('review-text').value = ''; auth(); if (dialog.open) load(); });
  win.fluxReviews = { setGame(value) { generation++; game = value; rows = []; mine = null; cursor = null; hasMore = false; busy = false; el('review-game-title').textContent = value.game.name; el('review-report-panel').hidden = true; }, close() { generation++; dialog.close(); } };
})(window);
