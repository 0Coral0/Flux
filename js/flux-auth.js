import { getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
const status = document.getElementById('flux-auth-status');
try {
  const auth = getAuth(getApp());
  window.fluxGetToken = async () => {
    await auth.authStateReady();
    if (!auth.currentUser) throw new Error('Sign in from Profile to continue.');
    return auth.currentUser.getIdToken();
  };
  onAuthStateChanged(auth, user => {
    status.textContent = user ? `Signed in as ${user.email}` : 'Sign in to connect to Discord and the assistant.';
    document.getElementById('flux-auth-password').value = '';
    window.dispatchEvent(new Event('flux-auth-changed'));
  });
  async function login(register = false) {
    try {
      const email = document.getElementById('flux-auth-email').value.trim();
      const password = document.getElementById('flux-auth-password').value;
      await (register ? createUserWithEmailAndPassword : signInWithEmailAndPassword)(auth, email, password);
    } catch (error) { status.textContent = error.message; }
  }
  document.getElementById('flux-auth-form').addEventListener('submit', event => { event.preventDefault(); login(); });
  document.getElementById('flux-auth-register').onclick = () => login(true);
  document.getElementById('flux-auth-logout').onclick = () => signOut(auth).catch(error => { status.textContent = error.message; });
} catch (_) { status.textContent = 'Accounts are unavailable. Please reload or try again later.'; }
