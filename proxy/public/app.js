import { resolveAddress } from './address.js';
import { getEngine } from './engine.js';

const $ = selector => document.querySelector(selector);
const tabsElement = $('#tabs');
const frames = $('#frames');
const startPage = $('#start-page');
const address = $('#address');
const newTabAddress = $('#new-tab-address');
const notice = $('#notice');
const status = $('#engine-status');
const statusDot = $('#status-dot');
const controls = { back: $('#back'), forward: $('#forward'), reload: $('#reload') };
const tabs = [];
let activeId;
let engineReady = false;

function svg(icon, className = '') {
  const element = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
  use.setAttribute('href', `#i-${icon}`);
  element.setAttribute('aria-hidden', 'true');
  if (className) element.setAttribute('class', className);
  element.append(use);
  return element;
}

function currentTab() { return tabs.find(tab => tab.id === activeId); }
function showNotice(message) { $('#notice-text').textContent = message; notice.hidden = false; }
function hideNotice() { notice.hidden = true; }

function setStatus(text, state = '') {
  status.textContent = text;
  statusDot.className = `status-dot ${state}`.trim();
}

function render() {
  const active = currentTab();
  const scrollLeft = tabsElement.scrollLeft;
  const hadTabFocus = tabsElement.contains(document.activeElement);
  tabsElement.replaceChildren();
  for (const tab of tabs) {
    const item = document.createElement('div');
    item.className = 'tab';
    item.setAttribute('role', 'tab');
    item.setAttribute('aria-selected', String(tab.id === activeId));
    item.setAttribute('tabindex', tab.id === activeId ? '0' : '-1');
    item.append(svg('globe', 'tab-icon'));
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.label;
    item.append(title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tab-close';
    close.setAttribute('aria-label', `Close ${tab.label} tab`);
    close.append(svg('close'));
    close.addEventListener('click', event => { event.stopPropagation(); closeTab(tab.id); });
    item.append(close);
    item.addEventListener('click', () => activateTab(tab.id));
    item.addEventListener('keydown', event => {
      if (event.target !== item) return;
      const index = tabs.findIndex(candidate => candidate.id === tab.id);
      let next = null;
      if (event.key === 'ArrowRight') next = tabs[(index + 1) % tabs.length];
      if (event.key === 'ArrowLeft') next = tabs[(index - 1 + tabs.length) % tabs.length];
      if (event.key === 'Home') next = tabs[0];
      if (event.key === 'End') next = tabs[tabs.length - 1];
      if (next) { event.preventDefault(); activateTab(next.id, true); }
      else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activateTab(tab.id, true); }
      else if (event.key === 'Delete') { event.preventDefault(); closeTab(tab.id); }
    });
    tabsElement.append(item);
    if (tab.element) tab.element.hidden = tab.id !== activeId;
  }
  const hasPage = Boolean(active?.url);
  startPage.hidden = hasPage;
  frames.hidden = !hasPage;
  tabsElement.scrollLeft = scrollLeft;
  if (hadTabFocus) tabsElement.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
  if (document.activeElement !== address) address.value = active?.url || '';
  for (const button of Object.values(controls)) button.disabled = !active?.frame;
  $('#loading-bar').classList.toggle('active', Boolean(active?.loading));
  if (active?.loading) setStatus('LOADING PAGE', 'busy');
  else setStatus(engineReady ? 'ENGINE READY' : 'READY TO CONNECT');
}

function showActiveTab() {
  const item = tabsElement.querySelector('[aria-selected="true"]');
  if (!item) return;
  const strip = tabsElement.getBoundingClientRect();
  const tab = item.getBoundingClientRect();
  if (tab.left < strip.left) tabsElement.scrollLeft += tab.left - strip.left;
  else if (tab.right > strip.right) tabsElement.scrollLeft += tab.right - strip.right;
}

function createTab(initialUrl) {
  const tab = { id: crypto.randomUUID(), label: 'New tab', url: '', frame: null, framePromise: null, element: null, loading: false, timer: null, sequence: 0 };
  tabs.push(tab);
  activeId = tab.id;
  address.value = '';
  newTabAddress.value = '';
  hideNotice();
  render();
  showActiveTab();
  if (initialUrl) navigate(initialUrl, tab);
  else address.focus();
  return tab;
}

function activateTab(id, focus = false) {
  activeId = id;
  hideNotice();
  render();
  showActiveTab();
  if (focus) tabsElement.querySelector('[aria-selected="true"]')?.focus({ preventScroll: true });
}

function closeTab(id) {
  const index = tabs.findIndex(tab => tab.id === id);
  if (index < 0) return;
  const [tab] = tabs.splice(index, 1);
  clearTimeout(tab.timer);
  if (tab.frame) {
    const registered = tab.frame.controller.frames.indexOf(tab.frame);
    if (registered !== -1) tab.frame.controller.frames.splice(registered, 1);
    tab.element.remove();
  }
  if (!tabs.length) { createTab(); return; }
  if (activeId === id) activeId = tabs[Math.max(0, index - 1)].id;
  address.value = currentTab()?.url || '';
  hideNotice();
  render();
  showActiveTab();
}

function updateUrl(tab, url) {
  if (!tabs.includes(tab)) return;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return;
    tab.url = parsed.href;
    tab.label = parsed.hostname.replace(/^www\./, '');
    render();
  } catch { /* Ignore transient internal engine URLs. */ }
}

function startLoading(tab) {
  tab.loading = true;
  clearTimeout(tab.timer);
  tab.timer = setTimeout(() => {
    tab.loading = false;
    if (tab.id === activeId) showNotice('This page is taking a while. It may be unavailable or incompatible.');
    render();
  }, 30000);
  render();
}

function stopLoading(tab) { clearTimeout(tab.timer); tab.loading = false; render(); }

async function ensureFrame(tab) {
  if (tab.frame) return tab.frame;
  if (!tab.framePromise) tab.framePromise = (async () => {
    const controller = await getEngine();
    engineReady = true;
    if (!tabs.includes(tab)) return null;
    const element = document.createElement('iframe');
    element.className = 'browser-frame';
    element.title = 'Website content';
    element.hidden = tab.id !== activeId;
    const cache = new window.$scramjetUtils.HttpCachePlugin();
    const watcher = new window.$scramjetUtils.UrlWatcherPlugin(url => updateUrl(tab, url));
    const escapedLinks = new window.$scramjetUtils.CatchEscapedLinksPlugin(url => new URL(`/?${document.documentElement.classList.contains('flux-embedded') ? 'embed=1&' : ''}goto=${encodeURIComponent(url.href)}`, location.origin));
    const frame = controller.createFrame(element, { plugins: [cache, watcher, escapedLinks] });
    tab.frame = frame;
    tab.element = element;
    element.addEventListener('load', () => {
      // Appending the empty iframe can emit a load before the requested page starts.
      try { if (element.contentWindow.location.href === 'about:blank') return; } catch { /* A real page can be cross-origin. */ }
      if (tab.loading) stopLoading(tab);
    });
    frames.append(element);
    return frame;
  })().catch(error => { tab.framePromise = null; throw error; });
  return tab.framePromise;
}

async function navigate(input, tab = currentTab()) {
  if (!tab) return;
  let url;
  try { url = resolveAddress(input); }
  catch (error) { showNotice(error.message || 'Please enter a valid address.'); return; }
  if (!url) return;
  const sequence = ++tab.sequence;
  hideNotice();
  tab.url = url;
  tab.label = new URL(url).hostname.replace(/^www\./, '');
  if (tab.id === activeId) address.value = url;
  newTabAddress.value = '';
  startLoading(tab);
  try {
    const frame = await ensureFrame(tab);
    if (!frame || !tabs.includes(tab) || sequence !== tab.sequence) return;
    frame.go(url);
    render();
  } catch (error) {
    if (!tabs.includes(tab) || sequence !== tab.sequence) return;
    stopLoading(tab);
    if (tab.id === activeId) {
      showNotice(`Could not start the browser: ${error.message || 'unknown error'}`);
      setStatus('CONNECTION ERROR', 'error');
    }
  }
}

$('#address-form').addEventListener('submit', event => { event.preventDefault(); navigate(address.value); });
$('#new-tab-form').addEventListener('submit', event => { event.preventDefault(); navigate(newTabAddress.value); });
$('#new-tab').addEventListener('click', () => createTab());
$('#dismiss-notice').addEventListener('click', hideNotice);
for (const button of document.querySelectorAll('[data-url]')) button.addEventListener('click', () => navigate(button.dataset.url));
for (const [action, button] of Object.entries(controls)) {
  button.addEventListener('click', () => {
    const tab = currentTab();
    if (!tab?.frame) return;
    hideNotice();
    if (action === 'reload') startLoading(tab);
    try { tab.frame[action](); }
    catch { stopLoading(tab); showNotice('This page could not be navigated.'); }
  });
}
document.addEventListener('keydown', event => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return;
  if (event.key.toLowerCase() === 'l') {
    event.preventDefault(); address.focus(); address.select();
  } else if (event.key.toLowerCase() === 't') {
    event.preventDefault(); createTab();
  } else if (event.key.toLowerCase() === 'w') {
    event.preventDefault(); closeTab(activeId);
  }
});

const goto = new URL(location.href).searchParams.get('goto');
if (goto) history.replaceState(null, '', location.pathname + (document.documentElement.classList.contains('flux-embedded') ? '?embed=1' : ''));
createTab(goto);
