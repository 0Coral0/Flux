(() => {
  'use strict';
  const status = document.getElementById('flux-auth-status');
  const ownerEmails = new Set(['z.werner1@lodiusd.org', 'xboxmaster83412@gmail.com', 'coralsemail0@gmail.com']);
  const isOwner = person => ownerEmails.has(String(person?.email || '').trim().toLowerCase());
  try {
    const auth = window.fluxFirebase?.auth?.();
    if (!auth) throw new Error('Firebase Auth did not load.');
    window.fluxGetToken = async () => {
      if (!auth.currentUser) throw new Error('Sign in from Profile to continue.');
      return auth.currentUser.getIdToken();
    };
    auth.onAuthStateChanged(person => {
      const owner = isOwner(person);
      window.fluxChatIdentity = { owner, uid: person?.uid || null };
      window.fluxAuthState = person
        ? { status: 'signed-in', uid: person.uid, email: person.email || '', name: person.displayName || (person.email || '').split('@')[0] || 'Gamer', owner }
        : { status: 'signed-out', uid: null, email: '', owner: false };
      if (status) status.textContent = person ? `Signed in as ${person.email}` : 'Sign in to save your Flux profile.';
      const password = document.getElementById('flux-auth-password'); if (password) password.value = '';
      window.dispatchEvent(new Event('flux-auth-changed'));
    });
    async function login(register = false) {
      try {
        const email = document.getElementById('flux-auth-email').value.trim();
        const password = document.getElementById('flux-auth-password').value;
        await (register ? auth.createUserWithEmailAndPassword(email, password) : auth.signInWithEmailAndPassword(email, password));
      } catch (error) { if (status) status.textContent = error.message; }
    }
    document.getElementById('flux-auth-form')?.addEventListener('submit', event => { event.preventDefault(); login(); });
    document.getElementById('flux-auth-register')?.addEventListener('click', () => login(true));
    document.getElementById('flux-auth-logout')?.addEventListener('click', () => auth.signOut().catch(error => { if (status) status.textContent = error.message; }));
    window.fluxAuthReady = true;
  } catch (error) {
    window.fluxChatIdentity = { owner: false, uid: null };
    window.fluxAuthState = { status: 'unavailable', uid: null, email: '', owner: false };
    window.dispatchEvent(new Event('flux-auth-changed'));
    if (status) status.textContent = 'Accounts are unavailable. Please reload or try again later.';
    console.warn('Firebase Auth startup failed.', error);
  }
})();
