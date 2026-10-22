/* ==========================================================================
   FLUX AI VIEW  |  flux-ai-page.js
   Drives the markup in flux-ai-page.html. Self-contained: no dependencies,
   nothing is added to the global scope except window.FluxAIPage.

   Backend contract (unchanged):
     POST {FLUX_DISCORD_BRIDGE_URL}/api/ai/chat
     Authorization: Bearer <await window.fluxGetToken()>
     body { messages: [{ role, content }] }  ->  { text }

   If the integration needs a different transport, replace it without editing
   this file:
     FluxAIPage.configure({ send: async (messages, signal) => 'reply text' });
   ========================================================================== */
(() => {
    'use strict';

    // The AI client is retained but makes no requests while this integration is paused.
    if (window.FLUX_INTEGRATIONS?.ai === false) return;

    const root = document.getElementById('fxa-root');
    if (!root) return;

    /* ---------- Config ---------- */

    const CFG = {
        maxHistory: 11,      // the bridge accepts at most 11 messages
        minThinkMs: 800,     // keep the indicator visible at least this long
        slowAfterMs: 14000,  // show the "server may be busy" label after this
        timeoutMs: 125000,
        endpoint: '/api/ai/chat'
    };

    /* ---------- DOM ---------- */

    const $ = (sel, scope = root) => scope.querySelector(sel);
    const els = {
        scroll: $('#fxa-scroll'),
        welcome: $('#fxa-welcome'),
        thread: $('#fxa-thread'),
        form: $('#fxa-form'),
        input: $('#fxa-input'),
        send: $('#fxa-send'),
        stop: $('#fxa-stop'),
        newChat: $('#fxa-new'),
        jump: $('#fxa-jump'),
        count: $('#fxa-count'),
        live: $('#fxa-status')
    };
    const tpl = {
        core: $('#fxa-tpl-core'),
        thinking: $('#fxa-tpl-thinking'),
        assistant: $('#fxa-tpl-assistant'),
        error: $('#fxa-tpl-error')
    };

    /* ---------- State ---------- */

    let messages = [];        // [{ role: 'user' | 'assistant', content }]
    let busy = false;
    let controller = null;
    let reqId = 0;
    let activeReveal = null;
    let transport = defaultTransport;
    const rawByEl = new WeakMap();

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const touchQuery = window.matchMedia('(hover: none)');
    const reduced = () => motionQuery.matches;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    class FluxAIError extends Error {
        constructor(kind, message) {
            super(message || kind);
            this.kind = kind;
        }
    }

    /* ======================================================================
       Atom mark
       ====================================================================== */

    function mountCore(host, still) {
        if (!host || host.querySelector('.fxa-core')) return;
        const svg = tpl.core.content.firstElementChild.cloneNode(true);
        if (still) {
            svg.querySelectorAll('animateMotion').forEach((a) => a.remove());
            svg.querySelectorAll('.fxa-electron').forEach((c) => c.setAttribute('transform', 'translate(44 24)'));
        }
        host.appendChild(svg);
        if (!still && reduced() && typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
    }

    function mountCores(scope) {
        scope.querySelectorAll('[data-fxa-core]').forEach((host) => {
            mountCore(host, host.hasAttribute('data-still'));
        });
    }

    /* ======================================================================
       Markdown (small, safe: everything is escaped before any tag is added)
       ====================================================================== */

    const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

    function inline(src) {
        const codes = [];
        let s = src.replace(/`([^`\n]+)`/g, (_, c) => {
            codes.push(c);
            return '\u0000' + (codes.length - 1) + '\u0000';
        });
        s = esc(s);
        s = s.replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
            '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
        s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
        s = s.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
        return s.replace(/\u0000(\d+)\u0000/g, (_, i) => '<code class="fxa-inline">' + esc(codes[+i]) + '</code>');
    }

    function blocks(src) {
        const lines = src.replace(/\r\n?/g, '\n').split('\n');
        let out = '';
        let para = [];
        let quote = [];
        let list = null;

        const flushPara = () => {
            if (para.length) out += '<p>' + inline(para.join('\n')).replace(/\n/g, '<br>') + '</p>';
            para = [];
        };
        const flushQuote = () => {
            if (quote.length) out += '<blockquote>' + inline(quote.join('\n')).replace(/\n/g, '<br>') + '</blockquote>';
            quote = [];
        };
        const flushList = () => {
            if (list) out += '<' + list.type + '>' + list.items.map((i) => '<li>' + inline(i) + '</li>').join('') + '</' + list.type + '>';
            list = null;
        };
        const flushAll = () => { flushPara(); flushQuote(); flushList(); };

        for (const line of lines) {
            let m;
            if (!line.trim()) { flushAll(); continue; }
            if ((m = line.match(/^(#{1,4})\s+(.+)$/))) {
                flushAll();
                const level = m[1].length + 2;
                out += '<h' + level + ' class="fxa-h">' + inline(m[2]) + '</h' + level + '>';
                continue;
            }
            if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { flushAll(); out += '<hr>'; continue; }
            if ((m = line.match(/^\s*[-*+]\s+(.+)$/))) {
                flushPara(); flushQuote();
                if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] }; }
                list.items.push(m[1]);
                continue;
            }
            if ((m = line.match(/^\s*\d+[.)]\s+(.+)$/))) {
                flushPara(); flushQuote();
                if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] }; }
                list.items.push(m[1]);
                continue;
            }
            if ((m = line.match(/^>\s?(.*)$/))) {
                flushPara(); flushList();
                quote.push(m[1]);
                continue;
            }
            flushList(); flushQuote();
            para.push(line);
        }
        flushAll();
        return out;
    }

    /* ---------- Syntax highlighting (generic, light) ---------- */

    const KW = new Set((
        'break case catch class const continue debugger default delete do else enum export extends false finally for from function if ' +
        'import in instanceof interface let new null of return static super switch this throw true try typeof undefined var void while ' +
        'with yield async await def elif except lambda None True False pass raise global nonlocal is not and or as print self ' +
        'int float double char bool boolean string long short byte public private protected void struct fn mut impl pub use mod match ' +
        'package func go chan defer select type var echo fi then done'
    ).split(' '));

    const HASH_LANGS = new Set(['py', 'python', 'sh', 'bash', 'shell', 'zsh', 'yaml', 'yml', 'rb', 'ruby', 'toml', 'ps1', 'powershell', 'ini', 'conf', 'r', 'dockerfile', 'makefile']);

    // groups: 1 comment, 2 string, 3 number, 4 identifier
    const RE_SLASH = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|<!--[\s\S]*?(?:-->|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w$]*\b)/g;
    const RE_HASH = /(#[^\n]*|<!--[\s\S]*?(?:-->|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?)|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w$]*\b)/g;

    function highlight(code, lang) {
        if (code.length > 20000) return esc(code);
        const re = HASH_LANGS.has(lang) ? RE_HASH : RE_SLASH;
        re.lastIndex = 0;
        let out = '';
        let last = 0;
        let m;
        while ((m = re.exec(code))) {
            out += esc(code.slice(last, m.index));
            if (m[1] !== undefined) out += '<span class="tk-c">' + esc(m[1]) + '</span>';
            else if (m[2] !== undefined) out += '<span class="tk-s">' + esc(m[2]) + '</span>';
            else if (m[3] !== undefined) out += '<span class="tk-n">' + esc(m[3]) + '</span>';
            else if (KW.has(m[4])) out += '<span class="tk-k">' + esc(m[4]) + '</span>';
            else if (code[re.lastIndex] === '(') out += '<span class="tk-f">' + esc(m[4]) + '</span>';
            else out += esc(m[4]);
            last = re.lastIndex;
        }
        return out + esc(code.slice(last));
    }

    function codeBlock(info, code) {
        const lang = (info.split(/\s+/)[0] || '').toLowerCase().replace(/[^a-z0-9+#-]/g, '');
        return '<figure class="fxa-code"><figcaption class="fxa-code-bar">' +
            '<span class="fxa-lang">' + esc(lang || 'text') + '</span>' +
            '<button type="button" class="fxa-act" data-act="copy-code"><i class="fa-regular fa-copy" aria-hidden="true"></i><span>Copy</span></button>' +
            '</figcaption><pre><code>' + highlight(code, lang) + '</code></pre></figure>';
    }

    function renderMarkdown(src) {
        let out = '';
        let last = 0;
        let m;
        const re = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g;
        while ((m = re.exec(src))) {
            out += blocks(src.slice(last, m.index));
            out += codeBlock(m[1].trim(), m[2].replace(/\n$/, ''));
            last = re.lastIndex;
            if (re.lastIndex === m.index) re.lastIndex++;
        }
        return out + blocks(src.slice(last));
    }

    /* ======================================================================
       Scrolling helpers
       ====================================================================== */

    const nearBottom = () => els.scroll.scrollHeight - els.scroll.scrollTop - els.scroll.clientHeight < 120;

    function scrollToBottom(smooth = true) {
        els.scroll.scrollTo({ top: els.scroll.scrollHeight, behavior: smooth && !reduced() ? 'smooth' : 'auto' });
    }

    function updateJump() {
        els.jump.hidden = root.dataset.state !== 'chat' || nearBottom();
    }

    /* ======================================================================
       Thinking indicator: the Flux logo and orbiting signal trace.
       ====================================================================== */

    const PHASES = ['Reading your message', 'Routing through the Flux core', 'Composing a reply'];
    const TRACE_BARS = 28;

    function mountThinking() {
        const wrap = document.createElement('div');
        wrap.className = 'fxa-msg fxa-msg--think';
        const node = tpl.thinking.content.firstElementChild.cloneNode(true);
        wrap.appendChild(node);
        mountCores(node);

        const label = $('.fxa-think-label', node);
        const trace = $('.fxa-trace', node);
        let bars = '';
        for (let i = 0; i < TRACE_BARS; i++) {
            const lens = Math.pow(Math.sin((Math.PI * (i + 0.5)) / TRACE_BARS), 0.8);
            const h = Math.min(1, 0.32 + 0.68 * lens + ((i * 37) % 7) / 60).toFixed(2);
            bars += '<i style="--i:' + i + ';--h:' + h + '"></i>';
        }
        trace.innerHTML = bars;

        const timers = [];
        const later = (fn, ms) => { timers.push(setTimeout(fn, ms)); };
        const startedAt = performance.now();
        let stopped = false;

        const setLabel = (text) => {
            label.classList.add('is-out');
            later(() => {
                label.textContent = text;
                label.classList.remove('is-out');
            }, reduced() ? 0 : 150);
        };

        const loop = PHASES.map((t) => ({ t, d: 1800 }));

        let step = 0;
        const play = () => {
            if (stopped) return;
            if (performance.now() - startedAt > CFG.slowAfterMs) {
                setLabel('Still working. The server may be busy.');
                return;
            }
            const s = loop[step % loop.length];
            if (step > 0) setLabel(s.t);
            step++;
            later(play, s.d);
        };
        later(play, 0);

        return {
            el: wrap,
            stop() {
                stopped = true;
                timers.forEach(clearTimeout);
            },
            remove() {
                this.stop();
                wrap.remove();
            }
        };
    }

    /* ======================================================================
       Messages
       ====================================================================== */

    function addUser(text, animate = true) {
        const el = document.createElement('article');
        el.className = 'fxa-msg fxa-msg--user' + (animate ? '' : ' is-static');
        const bubble = document.createElement('div');
        bubble.className = 'fxa-bubble';
        bubble.textContent = text;
        el.appendChild(bubble);
        els.thread.appendChild(el);
        return el;
    }

    function addAssistant(text, { animate = true, reveal = false, local = false } = {}) {
        const el = tpl.assistant.content.firstElementChild.cloneNode(true);
        if (local) el.dataset.local = 'true';
        if (!animate) el.classList.add('is-static');
        mountCores(el);
        const body = $('.fxa-bubble', el);
        rawByEl.set(el, text);
        els.thread.appendChild(el);
        if (reveal) activeReveal = revealInto(body, text, () => { activeReveal = null; refreshRetry(); });
        else body.innerHTML = renderMarkdown(text);
        refreshRetry();
        return el;
    }

    function addError(err) {
        const copy = {
            auth: ['Sign in to use Flux Assistant', 'Open your profile, sign in to your Flux account, then try again.'],
            network: ['Can\u2019t reach the Flux server', 'Check your connection, then try again.'],
            empty: ['The assistant sent an empty reply', 'Try again, or rephrase your message.'],
            server: ['The assistant ran into a problem', err && err.message ? err.message : 'Try again in a moment.']
        }[(err && err.kind) || 'server'];
        const el = tpl.error.content.firstElementChild.cloneNode(true);
        $('.fxa-err-title', el).textContent = copy[0];
        $('.fxa-err-text', el).textContent = copy[1];
        els.thread.appendChild(el);
        return el;
    }

    // Only the newest assistant reply offers "Try again".
    function refreshRetry() {
        const all = els.thread.querySelectorAll('.fxa-msg--ai:not(.fxa-msg--error)');
        all.forEach((el, i) => {
            const btn = $('[data-act="retry"]', el);
            if (btn) btn.hidden = i !== all.length - 1 || el.dataset.local === 'true';
        });
    }

    /* The typing cursor: the loading screen's flashing ">" at the end of the text. */
    function attachCaret(target) {
        const caret = document.createElement('span');
        caret.className = 'fxa-caret';
        caret.setAttribute('aria-hidden', 'true');
        caret.textContent = '>';
        let host = target.lastElementChild || target;
        if (host !== target) {
            if (host.matches('ul, ol')) host = host.lastElementChild || host;
            else if (host.matches('figure')) host = host.querySelector('code') || host;
        }
        host.appendChild(caret);
    }

    /* Types a reply in over a short, capped duration. Click or send to skip. */
    function revealInto(target, text, done) {
        if (reduced() || text.length < 2) {
            target.innerHTML = renderMarkdown(text);
            done();
            return { skip() {} };
        }
        const total = text.length;
        const duration = Math.min(2200, Math.max(500, total * 6));
        let start = null;
        let last = 0;
        let raf = 0;
        let finished = false;

        const finish = () => {
            if (finished) return;
            finished = true;
            cancelAnimationFrame(raf);
            const stick = nearBottom();
            target.innerHTML = renderMarkdown(text);
            if (stick) scrollToBottom(false);
            updateJump();
            done();
        };

        const step = (t) => {
            if (start === null) start = t;
            const p = Math.min(1, (t - start) / duration);
            if (p >= 1) return finish();
            if (t - last > 40) {
                last = t;
                const n = Math.floor(total * (1 - Math.pow(1 - p, 2)));
                const partial = text.slice(0, n).replace(/`{1,3}[^\n`]*$/, '');
                const stick = nearBottom();
                target.innerHTML = renderMarkdown(partial);
                attachCaret(target);
                if (stick) scrollToBottom(false);
            }
            raf = requestAnimationFrame(step);
        };
        raf = requestAnimationFrame(step);
        return { skip: finish };
    }

    /* ======================================================================
       Transport
       ====================================================================== */

    function profileName() {
        try {
            const profile = JSON.parse(window.localStorage.getItem('flux_profile') || '{}');
            return typeof profile.name === 'string' ? profile.name.replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').trim().slice(0, 40) : '';
        } catch (_) { return ''; }
    }

    async function defaultTransport(history, signal) {
        const base = String(window.FLUX_DISCORD_BRIDGE_URL || '').replace(/\/+$/, '');
        if (!base) throw new FluxAIError('server', 'The server assistant has not been connected yet.');
        const headers = { 'Content-Type': 'application/json' };
        let token;
        try {
            token = typeof window.fluxGetToken === 'function' ? await window.fluxGetToken() : null;
        } catch (_) { throw new FluxAIError('auth'); }
        if (!token) throw new FluxAIError('auth');
        headers.Authorization = 'Bearer ' + token;

        let res;
        try {
            res = await fetch(base + CFG.endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({ messages: history, displayName: profileName() }),
                signal
            });
        } catch (e) {
            if (e && e.name === 'AbortError') throw e;
            throw new FluxAIError('network');
        }

        if (res.status === 401) throw new FluxAIError('auth');
        let data = null;
        try { data = await res.json(); } catch (_) { /* non-JSON body */ }
        if (!res.ok) {
            throw new FluxAIError('server', (data && (data.error || data.message)) || 'The server returned status ' + res.status + '.');
        }
        const text = data && typeof data.text === 'string' ? data.text.trim() : '';
        if (!text) throw new FluxAIError('empty');
        return text;
    }

    /* ======================================================================
       Chat flow
       ====================================================================== */

    function setState(state) {
        root.dataset.state = state;
        els.newChat.disabled = state === 'empty';
        updateJump();
    }

    function setBusy(b) {
        busy = b;
        root.dataset.busy = String(b);
        els.thread.setAttribute('aria-busy', String(b));
        els.send.hidden = b;
        els.stop.hidden = !b;
        syncSend();
    }

    function syncSend() {
        els.send.disabled = busy || !els.input.value.trim();
    }

    function announce(text) {
        els.live.textContent = '';
        setTimeout(() => { els.live.textContent = text; }, 40);
    }

    async function leaveWelcome(version) {
        if (root.dataset.state === 'chat') return true;
        els.welcome.classList.add('is-leaving');
        await sleep(reduced() ? 0 : 170);
        if (version !== reqId) {
            els.welcome.classList.remove('is-leaving');
            return false;
        }
        setState('chat');
        els.welcome.classList.remove('is-leaving');
        return true;
    }

    function replayIntro() {
        els.welcome.classList.remove('is-intro');
        void els.welcome.offsetWidth;
        els.welcome.classList.add('is-intro');
    }

    function siteCatalogs() {
        return {
            games: typeof gameList !== 'undefined' ? gameList : [],
            movies: typeof movieData !== 'undefined' ? movieData : []
        };
    }

    function addSiteActions(el, actions) {
        if (!actions.length) return;
        const host = document.createElement('div');
        host.className = 'fxa-site-actions';
        actions.forEach(action => {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'fxa-site-action';
            button.textContent = 'Open ' + action.label;
            button.addEventListener('click', () => {
                if (!window.FluxAISite.execute(action, siteCatalogs(), window)) announce('That item is no longer available.');
            });
            host.appendChild(button);
        });
        $('.fxa-body', el).insertBefore(host, $('.fxa-actions', el));
    }

    async function send(text) {
        text = String(text || '').trim();
        if (!text || busy) return;
        if (activeReveal) activeReveal.skip();
        const version = reqId;
        setBusy(true);
        if (!await leaveWelcome(version)) return;

        messages.push({ role: 'user', content: text });
        addUser(text);
        els.input.value = '';
        autosize();
        syncSend();
        scrollToBottom();
        const plan = window.FluxAISite?.resolve(text, siteCatalogs());
        if (plan) {
            const opened = plan.runNow && window.FluxAISite.execute(plan.actions[0], siteCatalogs(), window);
            const reply = plan.runNow && !opened ? 'Sorry, that item is unavailable right now.' : plan.text;
            messages.push({ role: 'assistant', content: reply });
            const el = addAssistant(reply, { local: true });
            if (!plan.runNow) addSiteActions(el, plan.actions);
            setBusy(false);
            scrollToBottom();
            announce(reply);
            return;
        }
        await request({ restoreOnAbort: text });
    }

    async function request({ restoreOnAbort = null } = {}) {
        const myId = ++reqId;
        setBusy(true);
        announce('Flux is thinking');

        const thinking = mountThinking();
        els.thread.appendChild(thinking.el);
        scrollToBottom();

        controller = new AbortController();
        const requestController = controller;
        const { signal } = requestController;
        const startedAt = performance.now();
        let timedOut = false;
        const timeout = setTimeout(() => { timedOut = true; requestController.abort(); }, CFG.timeoutMs);

        try {
            const history = messages.slice(-CFG.maxHistory).map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
            const reply = await transport(history, signal);
            const wait = CFG.minThinkMs - (performance.now() - startedAt);
            if (wait > 0) await sleep(wait);
            if (myId !== reqId) return;
            if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

            thinking.remove();
            messages.push({ role: 'assistant', content: reply });
            addAssistant(reply, { reveal: true });
            scrollToBottom();
            announce('Reply received');
        } catch (err) {
            if (myId !== reqId) return;
            thinking.remove();
            if (err && err.name === 'AbortError' && !timedOut) {
                // Stopped by the user: put their message back so nothing is lost.
                if (restoreOnAbort !== null && messages.length && messages[messages.length - 1].role === 'user') {
                    messages.pop();
                    const last = els.thread.lastElementChild;
                    if (last && last.classList.contains('fxa-msg--user')) last.remove();
                    els.input.value = restoreOnAbort;
                    autosize();
                    if (!messages.length) { setState('empty'); replayIntro(); }
                }
                announce('Stopped');
            } else {
                const problem = timedOut ? new FluxAIError('server', 'The model took too long. Please try again.') : err;
                addError(problem instanceof FluxAIError ? problem : new FluxAIError((problem && problem.kind) || 'server', problem && problem.message));
                scrollToBottom();
            }
        } finally {
            clearTimeout(timeout);
            thinking.stop();
            if (myId === reqId) {
                controller = null;
                setBusy(false);
                syncSend();
            }
        }
    }

    function stopGenerating() {
        if (controller) controller.abort();
        else if (busy) {
            // A stop can arrive during the welcome-screen transition, before fetch starts.
            reqId++;
            els.welcome.classList.remove('is-leaving');
            setBusy(false);
            announce('Stopped');
        }
    }

    async function regenerate() {
        if (busy) return;
        if (activeReveal) activeReveal.skip();
        if (!messages.length || messages[messages.length - 1].role !== 'assistant') return;
        messages.pop();
        const all = els.thread.querySelectorAll('.fxa-msg--ai:not(.fxa-msg--error)');
        if (all.length) all[all.length - 1].remove();
        refreshRetry();
        await request();
    }

    function resetConversation(focus = false) {
        reqId++;
        if (controller) controller.abort();
        controller = null;
        if (activeReveal) { activeReveal.skip(); activeReveal = null; }
        els.thread.replaceChildren();
        els.thread.classList.remove('is-clearing');
        els.welcome.classList.remove('is-leaving');
        messages = [];
        els.input.value = '';
        autosize();
        updateCount();
        setBusy(false);
        setState('empty');
        replayIntro();
        announce('');
        if (focus) focusInput();
    }

    function newChat() { resetConversation(true); }

    /* ======================================================================
       Input
       ====================================================================== */

    function autosize() {
        els.input.style.height = 'auto';
        els.input.style.height = Math.min(els.input.scrollHeight, 180) + 'px';
    }

    function updateCount() {
        const len = els.input.value.length;
        const max = els.input.maxLength;
        if (len > max * 0.85) {
            els.count.textContent = len.toLocaleString() + ' / ' + max.toLocaleString();
            els.count.classList.toggle('is-near', len >= max);
        } else {
            els.count.textContent = '';
        }
    }

    function focusInput() {
        if (touchQuery.matches) return;
        els.input.focus({ preventScroll: true });
    }

    async function copyText(text) {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (_) {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
            document.body.appendChild(ta);
            ta.select();
            let ok = false;
            try { ok = document.execCommand('copy'); } catch (__) { ok = false; }
            ta.remove();
            return ok;
        }
    }

    function flashCopied(btn) {
        const label = $('span', btn);
        const icon = $('i', btn);
        if (!label || btn._busy) return;
        btn._busy = true;
        const before = label.textContent;
        const beforeIcon = icon ? icon.className : '';
        label.textContent = 'Copied';
        if (icon) icon.className = 'fa-solid fa-check';
        setTimeout(() => {
            label.textContent = before;
            if (icon) icon.className = beforeIcon;
            btn._busy = false;
        }, 1600);
    }

    /* ======================================================================
       Events
       ====================================================================== */

    els.form.addEventListener('submit', (e) => {
        e.preventDefault();
        send(els.input.value);
    });

    els.input.addEventListener('input', () => {
        autosize();
        syncSend();
        updateCount();
    });

    els.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && !touchQuery.matches) {
            e.preventDefault();
            if (!busy && els.input.value.trim()) els.form.requestSubmit();
        }
    });

    els.stop.addEventListener('click', stopGenerating);
    els.newChat.addEventListener('click', newChat);
    window.addEventListener('flux-auth-changed', () => resetConversation());
    els.jump.addEventListener('click', () => scrollToBottom());
    els.scroll.addEventListener('scroll', updateJump, { passive: true });

    els.welcome.addEventListener('click', (e) => {
        const btn = e.target.closest('.fxa-prompt');
        if (btn) send(btn.dataset.prompt);
    });

    els.thread.addEventListener('click', async (e) => {
        const btn = e.target.closest('[data-act]');
        if (btn) {
            const act = btn.dataset.act;
            if (act === 'copy') {
                const msg = btn.closest('.fxa-msg');
                if (msg && await copyText(rawByEl.get(msg) || msg.textContent)) flashCopied(btn);
            } else if (act === 'copy-code') {
                const code = btn.closest('.fxa-code');
                if (code && await copyText($('code', code).textContent)) flashCopied(btn);
            } else if (act === 'retry') {
                regenerate();
            } else if (act === 'retry-error') {
                const err = btn.closest('.fxa-msg--error');
                if (err) err.remove();
                if (!busy) request();
            }
            return;
        }
        if (activeReveal && e.target.closest('.fxa-bubble')) activeReveal.skip();
    });

    // Focus the box when the Assistant page becomes the active view.
    const view = root.closest('#view-ai');
    if (view && 'MutationObserver' in window) {
        let wasActive = view.classList.contains('active');
        new MutationObserver(() => {
            const now = view.classList.contains('active');
            if (now && !wasActive) {
                focusInput();
                if (root.dataset.state === 'chat') requestAnimationFrame(() => scrollToBottom(false));
            }
            wasActive = now;
        }).observe(view, { attributes: true, attributeFilter: ['class'] });
    }

    /* ======================================================================
       Init + public API
       ====================================================================== */

    mountCores(root);
    syncSend();

    window.FluxAIPage = {
        /** Swap the transport for a controlled design review. */
        configure(opts = {}) {
            if (typeof opts.send === 'function') transport = opts.send;
            return this;
        },
        send,
        newChat,
        /** Show a thinking indicator for design review. */
        previewThinking() {
            setState('chat');
            const t = mountThinking();
            els.thread.appendChild(t.el);
            scrollToBottom();
            return () => t.remove();
        }
    };
})();
