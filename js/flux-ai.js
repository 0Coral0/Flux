(() => {
  const form = document.getElementById('flux-ai-form');
  const status = document.getElementById('ai-status');
  const feed = document.getElementById('ai-messages');
  const history = [];
  let busy = false, generation = 0;
  const append = (role, text) => {
    const row = document.createElement('div'); row.className = 'ai-message';
    const label = document.createElement('strong'); label.textContent = role === 'user' ? 'You' : 'Flux';
    const body = document.createElement('p'); body.textContent = text;
    row.append(label, body); feed.append(row); row.scrollIntoView({ block: 'nearest' });
  };
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy) return;
    const base = (window.FLUX_DISCORD_BRIDGE_URL || '').replace(/\/$/, '');
    if (!base) { status.textContent = 'The server assistant has not been connected yet.'; return; }
    const input = document.getElementById('ai-prompt');
    const text = input.value.trim(); if (!text) return;
    const id = generation;
    busy = true; form.querySelector('button').disabled = true; status.textContent = 'Thinking…';
    try {
      if (!window.fluxGetToken) throw Error('Sign in from Profile first.');
      const token = await window.fluxGetToken();
      const response = await fetch(base + '/api/ai/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ messages: [...history.slice(-10), {role:'user',content:text}] }), signal: AbortSignal.timeout(125000) });
      const data = await response.json(); if (!response.ok) throw Error(data.error || 'Assistant unavailable.');
      if (id !== generation) return;
      append('user', text); append('assistant', data.text);
      history.push({role:'user',content:text},{role:'assistant',content:data.text});
      input.value = ''; status.textContent = '';
    } catch (error) { status.textContent = error.name === 'TimeoutError' ? 'The model took too long. Please try again.' : error.message; }
    finally { busy = false; form.querySelector('button').disabled = false; }
  });
  window.addEventListener('flux-auth-changed', () => { generation++; history.length = 0; feed.replaceChildren(); status.textContent = ''; });
})();
