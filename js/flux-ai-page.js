/*
 * Flux AI page controller (browser only).
 * Talks to the EXISTING backend: POST {FLUX_DISCORD_BRIDGE_URL}/api/ai/chat
 *   body: { messages: [{role, content}, ...] }   response: { text }
 *   auth: Authorization: Bearer <await window.fluxGetToken()>
 * Globals are read at send time, so script order only matters for them to exist by then.
 * The system prompt is added server-side; this file never sends one.
 */
(() => {
  'use strict';

  const CFG = { path: '/api/ai/chat', maxHistory: 20, timeoutMs: 120000 };
  const $ = (id) => document.getElementById(id);
  const els = {
    log: $('fxai-log'), thread: $('fxai-thread'), welcome: $('fxai-welcome'),
    form: $('fxai-form'), input: $('fxai-input'), send: $('fxai-send'),
    newChat: $('fxai-new'), status: $('fxai-status'), statusText: $('fxai-status-text'),
    banner: $('fxai-banner'),
  };
  const state = { messages: [], busy: false, controller: null, sid: 0 };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  class FluxError extends Error {
    constructor(kind, message) { super(message); this.kind = kind; }
  }

  /* ---------- helpers ---------- */
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function h(tag, cls, html) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------- minimal, safe Markdown (input is escaped first) ---------- */
  function inline(s) {
    return s.split(/(`[^`\n]+`)/).map((part, i) => {
      if (i % 2) return '<code>' + esc(part.slice(1, -1)) + '</code>';
      return esc(part)
        .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>')
        .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    }).join('');
  }

  function blocks(text) {
    let out = '', para = [], list = null;
    const flushP = () => { if (para.length) { out += '<p>' + para.map(inline).join('<br>') + '</p>'; para = []; } };
    const flushL = () => {
      if (!list) return;
      const start = list.t === 'ol' && list.start !== 1 ? ` start="${list.start}"` : '';
      out += `<${list.t}${start}>` + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + `</${list.t}>`;
      list = null;
    };
    for (const raw of text.split('\n')) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { flushP(); flushL(); continue; }
      if ((m = line.match(/^(#{1,3})\s+(.*)/))) {
        flushP(); flushL();
        const lvl = m[1].length + 2;
        out += `<h${lvl}>${inline(m[2])}</h${lvl}>`;
      } else if ((m = line.match(/^\s*[-*•]\s+(.*)/))) {
        flushP();
        if (!list || list.t !== 'ul') { flushL(); list = { t: 'ul', items: [] }; }
        list.items.push(m[1]);
      } else if ((m = line.match(/^\s*(\d+)[.)]\s+(.*)/))) {
        flushP();
        if (!list || list.t !== 'ol') { flushL(); list = { t: 'ol', start: parseInt(m[1], 10), items: [] }; }
        list.items.push(m[2]);
      } else if ((m = line.match(/^>\s?(.*)/))) {
        flushP(); flushL();
        out += '<blockquote>' + inline(m[1]) + '</blockquote>';
      } else { flushL(); para.push(line); }
    }
    flushP(); flushL();
    return out;
  }

  function renderMarkdown(text) {
    return text.split('```').map((part, i) => {
      if (i % 2 === 0) return blocks(part);
      let lang = '', code = part;
      const nl = part.indexOf('\n');
      if (nl > -1 && /^[\w+#.-]*$/.test(part.slice(0, nl).trim())) {
        lang = part.slice(0, nl).trim();
        code = part.slice(nl + 1);
      }
      return `<div class="fxai-code"><div class="fxai-code-head"><span>${esc(lang || 'code')}</span>` +
        `<button type="button" class="fxai-iconbtn" data-copy-code>Copy</button></div>` +
        `<pre><code>${esc(code.replace(/\n$/, ''))}</code></pre></div>`;
    }).join('');
  }

  /* ---------- clipboard ---------- */
  async function copyText(text, btn) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const ta = h('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
      document.body.append(ta); ta.select();
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    const old = btn.textContent;
    btn.textContent = 'Copied';
    setTimeout(() => { btn.textContent = old; }, 1400);
  }

  /* ---------- UI ---------- */
  function scrollTo(node, mode) {
    const behavior = reduceMotion ? 'auto' : 'smooth';
    if (mode === 'auto' && node.offsetHeight > els.log.clientHeight * 0.75) {
      els.log.scrollTo({ top: Math.max(0, node.offsetTop - 16), behavior }); // long reply: start at its top
    } else {
      els.log.scrollTo({ top: els.log.scrollHeight, behavior });
    }
  }
  function add(node, mode = 'bottom') {
    els.welcome.hidden = true;
    els.thread.append(node);
    requestAnimationFrame(() => scrollTo(node, mode));
    return node;
  }

  function addUser(text) {
    const m = h('article', 'fxai-msg fxai-msg--user');
    const body = h('div', 'fxai-body');
    const c = h('div', 'fxai-content');
    c.innerHTML = '<span class="fxai-sr">You: </span>';
    c.append(document.createTextNode(text));
    body.append(c); m.append(body);
    add(m);
  }

  function addAI(text) {
    const m = h('article', 'fxai-msg fxai-msg--ai');
    m.dataset.raw = text;
    m.innerHTML = '<div class="fxai-avatar" aria-hidden="true">F</div><div class="fxai-body">' +
      '<div class="fxai-name">Flux AI</div>' +
      '<div class="fxai-content">' + renderMarkdown(text) + '</div>' +
      '<div class="fxai-actions"><button type="button" class="fxai-iconbtn" data-copy-msg>Copy</button></div></div>';
    add(m, 'auto');
  }

  function addProblem(title, message, retryText) {
    const m = h('article', 'fxai-msg fxai-msg--ai fxai-msg--error');
    m.setAttribute('role', 'alert');
    m.innerHTML = '<div class="fxai-avatar" aria-hidden="true">!</div><div class="fxai-body">' +
      `<div class="fxai-name">${esc(title)}</div><div class="fxai-content"><p>${esc(message)}</p></div>` +
      '<div class="fxai-actions"><button type="button" class="fxai-retry">Try again</button></div></div>';
    m.querySelector('.fxai-retry').addEventListener('click', () => {
      if (state.busy) return;
      m.remove();
      submit(retryText, true);
    });
    add(m);
  }

  function showTyping() {
    const m = h('div', 'fxai-msg fxai-msg--ai fxai-typing');
    m.innerHTML = '<div class="fxai-avatar" aria-hidden="true">F</div><div class="fxai-body"><div class="fxai-content">' +
      '<span class="fxai-dots" aria-hidden="true"><span></span><span></span><span></span></span>' +
      '<span>Flux AI is thinking…</span></div></div>';
    return add(m);
  }

  function updateStatus() {
    const offline = !navigator.onLine;
    const s = offline ? 'offline' : state.busy ? 'busy' : 'ready';
    els.status.dataset.state = s;
    els.statusText.textContent = offline ? 'Offline' : state.busy ? 'Generating…' : 'Ready';
    els.banner.hidden = !offline;
  }
  function updateSend() {
    els.send.classList.toggle('is-stop', state.busy);
    els.send.setAttribute('aria-label', state.busy ? 'Stop generating' : 'Send message');
    els.send.disabled = !state.busy && !els.input.value.trim();
    els.thread.setAttribute('aria-busy', String(state.busy));
  }
  function setBusy(v) { state.busy = v; updateStatus(); updateSend(); }

  function autosize() {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 200) + 'px';
    updateSend();
  }

  /* ---------- backend ---------- */
  async function requestReply(signal) {
    const base = String(window.FLUX_DISCORD_BRIDGE_URL || '').replace(/\/+$/, '');
    if (!base) throw new FluxError('config', "Flux AI isn't connected on this page yet (the bridge URL isn't set).");
    if (!navigator.onLine) throw new FluxError('network', "You're offline right now. Check your connection and try again.");

    let token = null;
    if (typeof window.fluxGetToken === 'function') {
      try { token = await window.fluxGetToken(); } catch { token = null; }
    }
    if (!token) throw new FluxError('auth', 'Please sign in to Flux to chat with Flux AI.');

    let history = state.messages.slice(-CFG.maxHistory);
    while (history.length && history[0].role !== 'user') history.shift();

    let res;
    try {
      res = await fetch(base + CFG.path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ messages: history }),
        signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') throw e;
      throw new FluxError('network', "I can't reach Flux AI's server right now. The local AI might be switched off. Try again in a bit.");
    }

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) throw new FluxError('auth', 'Your session expired. Sign in again and retry.');
      if (res.status === 429) throw new FluxError('rate', "You're sending messages a bit fast. Give it a moment and try again.");
      if (res.status >= 500) throw new FluxError('server', "Flux AI's server isn't responding properly. The local AI may be down or busy. Try again shortly.");
      throw new FluxError('server', `Something unexpected happened (error ${res.status}).`);
    }

    let data;
    try { data = await res.json(); } catch { throw new FluxError('server', 'The server sent back something I could not read.'); }
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    if (!text) throw new FluxError('empty', 'Flux AI came back with an empty reply. Try again.');
    return text;
  }

  async function submit(raw, isRetry = false) {
    const text = String(raw || '').trim();
    if (!text || state.busy) return;

    els.thread.querySelectorAll('.fxai-msg--error').forEach((n) => n.remove());
    if (!isRetry) addUser(text);
    state.messages.push({ role: 'user', content: text });
    setBusy(true);

    const sid = state.sid;
    const typing = showTyping();
    const controller = new AbortController();
    state.controller = controller;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, CFG.timeoutMs);

    try {
      const reply = await requestReply(controller.signal);
      if (sid !== state.sid) return;
      typing.remove();
      state.messages.push({ role: 'assistant', content: reply });
      addAI(reply);
    } catch (err) {
      if (sid !== state.sid) return;
      typing.remove();
      state.messages.pop(); // drop the unanswered user turn so history stays clean
      if (err.name === 'AbortError' && !timedOut) {
        addProblem('Stopped', "You stopped that reply. Want me to try again?", text);
      } else if (timedOut) {
        addProblem('Taking too long', 'That took longer than expected. The AI server may be busy. Try again.', text);
      } else {
        addProblem('Something went wrong', err instanceof FluxError ? err.message : 'An unexpected error occurred.', text);
      }
    } finally {
      clearTimeout(timer);
      if (sid === state.sid) { state.controller = null; setBusy(false); els.input.focus(); }
    }
  }

  function stop() { if (state.controller) state.controller.abort(); }

  function newConversation() {
    state.sid++;
    if (state.controller) state.controller.abort();
    state.controller = null;
    state.messages = [];
    els.thread.querySelectorAll('.fxai-msg').forEach((n) => n.remove());
    els.welcome.hidden = false;
    els.input.value = '';
    setBusy(false);
    autosize();
    els.log.scrollTo({ top: 0 });
    els.input.focus();
  }

  /* ---------- events ---------- */
  els.form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (state.busy) { stop(); return; }
    const text = els.input.value;
    if (!text.trim()) return;
    els.input.value = '';
    autosize();
    submit(text);
  });

  els.input.addEventListener('input', autosize);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      if (!state.busy) els.form.requestSubmit();
    } else if (e.key === 'Escape' && state.busy) stop();
  });

  els.newChat.addEventListener('click', newConversation);

  els.thread.addEventListener('click', (e) => {
    const chip = e.target.closest('.fxai-chip');
    if (chip) { submit(chip.dataset.prompt); return; }
    const codeBtn = e.target.closest('[data-copy-code]');
    if (codeBtn) { copyText(codeBtn.closest('.fxai-code').querySelector('code').textContent, codeBtn); return; }
    const msgBtn = e.target.closest('[data-copy-msg]');
    if (msgBtn) copyText(msgBtn.closest('.fxai-msg').dataset.raw || '', msgBtn);
  });

  window.addEventListener('online', updateStatus);
  window.addEventListener('offline', updateStatus);

  updateStatus();
  autosize();
  els.input.focus();
})();