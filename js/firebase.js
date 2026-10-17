// ============================================
// FIREBASE CONFIGURATION & IMPORTS
// ============================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    getDocs,
    deleteDoc,
    collection,
    addDoc,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";
import {
    getAuth,
    onAuthStateChanged,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyDcSoHg-3ZvmhF1N_ROn8yrpqfTfldZqDc",
    authDomain: "aggw-themes.firebaseapp.com",
    projectId: "aggw-themes",
    storageBucket: "aggw-themes.firebasestorage.app",
    messagingSenderId: "651619047980",
    appId: "1:651619047980:web:e19cb52860f53aa29d4f89",
    measurementId: "G-93Y4EWCLYL"
};

const app = initializeApp(firebaseConfig);
try { getAnalytics(app); } catch (err) { console.warn("Analytics unavailable:", err); }
const db = getFirestore(app);
const auth = getAuth(app);
let currentUser = null;

// ============================================
// THEME MANAGEMENT FUNCTIONS
// ============================================
function generateThemeCode(length = 6) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < length; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function openThemePreview(themeData, onLoad) {
    const overlay = document.getElementById('theme-preview-overlay');
    const modal = document.getElementById('theme-preview-modal');
    const body = document.getElementById('theme-preview-body');
    const name = document.getElementById('theme-preview-name');
    const accentText = document.getElementById('theme-preview-accent-text');
    const bgText = document.getElementById('theme-preview-bg-text');
    const pill1 = document.getElementById('theme-preview-pill-1');
    const pill2 = document.getElementById('theme-preview-pill-2');
    const loadBtn = document.getElementById('theme-preview-load-btn');

    if (!overlay || !modal || !body) return;

    name.textContent = themeData.name || 'Theme Preview';
    modal.style.background = themeData.bg || '#111';
    body.style.background = themeData.bg || '#111';
    accentText.style.color = themeData.accent || '#ffee00';
    accentText.textContent = 'Aggw Ultimate';
    bgText.textContent = `Accent: ${themeData.accent} • Background: ${themeData.bg}`;

    pill1.style.background = themeData.accent || '#ffee00';
    pill1.style.color = '#000';
    pill1.style.borderColor = 'transparent';

    pill2.style.color = themeData.accent || '#ffee00';
    pill2.style.borderColor = themeData.accent || '#ffee00';

    loadBtn.onclick = async () => {
        if (typeof onLoad === 'function') {
            await onLoad();
        }
        closeThemePreview();
    };

    overlay.style.display = 'flex';
}

function closeThemePreview() {
    const overlay = document.getElementById('theme-preview-overlay');
    if (overlay) overlay.style.display = 'none';
}

document.addEventListener('click', (e) => {
    const overlay = document.getElementById('theme-preview-overlay');
    if (e.target === overlay) {
        closeThemePreview();
    }
});

window.closeThemePreview = closeThemePreview;

async function saveTheme(themeCode, accent, bg) {
    if (!themeCode) {
        themeCode = generateThemeCode();
        document.getElementById('theme-code').value = themeCode;
    }

    try {
        await setDoc(doc(db, "themes", themeCode), {
            accent,
            bg,
            savedAt: new Date().toISOString()
        });
        alert("Theme saved! Your code is: " + themeCode);
    } catch (err) {
        console.error("SAVE ERROR:", err);
        alert("Save failed: " + err.message);
    }
}

async function loadTheme(themeCode) {
    if (!themeCode) return alert("You must enter a theme code!");

    try {
        const docRef = doc(db, "themes", themeCode);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            document.getElementById('set-accent').value = data.accent;
            document.getElementById('set-bg').value = data.bg;
            if (typeof window.applyThemeColors === 'function') {
                window.applyThemeColors();
            }
        } else {
            alert("Theme not found!");
        }
    } catch (err) {
        console.error("LOAD ERROR:", err);
        alert("Load failed: " + err.message);
    }
}

async function saveUserSettings() {
    if (!currentUser) return;

    const faviconPreset = document.getElementById('faviconPreset')?.value || '';
    const customTabName = document.getElementById('customTabName')?.value || '';
    const customFavicon = localStorage.getItem('aggw_custom_favicon') || '';

    await setDoc(doc(db, "users", currentUser.uid, "settings", "main"), {
        accent: document.getElementById('set-accent').value,
        bg: document.getElementById('set-bg').value,
        panic: window.panicKey || "]",
        faviconPreset,
        customTabName,
        customFavicon,
        updatedAt: new Date().toISOString()
    }, { merge: true });
}

async function loadUserSettings() {
    if (!currentUser) return;

    const snap = await getDoc(doc(db, "users", currentUser.uid, "settings", "main"));
    if (!snap.exists()) return;

    const data = snap.data();

    if (data.accent) document.getElementById('set-accent').value = data.accent;
    if (data.bg) document.getElementById('set-bg').value = data.bg;

    if (data.panic) {
        window.panicKey = data.panic;
        const panicDisplay = document.getElementById('panic-display');
        if (panicDisplay) panicDisplay.innerText = data.panic;
    }

    const dropdown = document.getElementById('faviconPreset');
    if (dropdown) dropdown.value = data.faviconPreset || '';

    const customTabNameInput = document.getElementById('customTabName');
    if (customTabNameInput) customTabNameInput.value = data.customTabName || '';

    if (typeof window.applyThemeColors === 'function') {
        window.applyThemeColors();
    }

    if (data.customFavicon) {
        localStorage.setItem('aggw_custom_favicon', data.customFavicon);
        if (typeof window.setFavicon === 'function') window.setFavicon(data.customFavicon);
    } else if (data.faviconPreset) {
        if (typeof window.applyFaviconPreset === 'function') window.applyFaviconPreset();
    }

    if (data.customTabName) {
        document.title = data.customTabName;
    }
}

// ============================================
// ACCOUNT MANAGEMENT FUNCTIONS
// ============================================
async function registerAccount() {
    const email = document.getElementById('account-email').value.trim();
    const password = document.getElementById('account-password').value.trim();

    if (!email || !password) return alert("Enter an email and password.");

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        alert("Account created!");
    } catch (err) {
        console.error("REGISTER ERROR:", err);
        alert(err.message);
    }
}

async function loginAccount() {
    const email = document.getElementById('account-email').value.trim();
    const password = document.getElementById('account-password').value.trim();

    if (!email || !password) return alert("Enter an email and password.");

    try {
        await signInWithEmailAndPassword(auth, email, password);
        alert("Logged in!");
    } catch (err) {
        console.error("LOGIN ERROR:", err);
        alert(err.message);
    }
}

async function logoutAccount() {
    try {
        await signOut(auth);
        alert("Logged out!");
    } catch (err) {
        console.error("LOGOUT ERROR:", err);
        alert(err.message);
    }
}

function slugifyPresetName(name) {
    return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'preset';
}

async function saveThemePreset() {
    if (!currentUser) return alert("Log in first.");

    const name = prompt("Preset name?");
    if (!name) return;

    const presetId = slugifyPresetName(name);

    try {
        await setDoc(doc(db, "users", currentUser.uid, "themePresets", presetId), {
            name,
            accent: document.getElementById('set-accent').value,
            bg: document.getElementById('set-bg').value,
            savedAt: new Date().toISOString()
        });
        await loadThemePresets();
        await saveUserSettings();
        alert("Theme preset saved!");
    } catch (err) {
        console.error("SAVE THEME PRESET ERROR:", err);
        alert("Failed to save theme preset: " + err.message);
    }
}

async function loadThemePresets() {
    const wrap = document.getElementById('theme-presets-list');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!currentUser) {
        wrap.innerHTML = '<div class="config-row"><div class="config-info"><span class="config-desc">Log in to see your saved theme presets.</span></div></div>';
        return;
    }

    const snap = await getDocs(collection(db, "users", currentUser.uid, "themePresets"));
    if (snap.empty) {
        wrap.innerHTML = '<div class="config-row"><div class="config-info"><span class="config-desc">No saved theme presets yet.</span></div></div>';
        return;
    }

    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const row = document.createElement('div');
        row.className = 'config-row';

        row.innerHTML = `
            <div class="config-info" style="flex-direction:row; align-items:center; gap:12px;">
                <div class="theme-swatch" style="background:${data.accent}; box-shadow: 12px 0 0 0 ${data.bg}; margin-right:12px;"></div>
                <div style="display:flex; flex-direction:column; gap:4px;">
                    <span class="config-label">${data.name}</span>
                    <span class="config-desc">${data.accent} • ${data.bg}</span>
                </div>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="action-btn btn-outline">Preview</button>
                <button class="action-btn btn-outline">Load</button>
                <button class="action-btn btn-outline">Delete</button>
            </div>
        `;

        const [previewBtn, loadBtn, deleteBtn] = row.querySelectorAll('button');

        const applyPreset = async () => {
            document.getElementById('set-accent').value = data.accent;
            document.getElementById('set-bg').value = data.bg;
            if (typeof window.applyThemeColors === 'function') {
                window.applyThemeColors();
            }
            await saveUserSettings();
        };

        previewBtn.onclick = () => {
            openThemePreview(data, applyPreset);
        };

        loadBtn.onclick = async () => {
            await applyPreset();
        };

        deleteBtn.onclick = async () => {
            await deleteDoc(doc(db, "users", currentUser.uid, "themePresets", docSnap.id));
            await loadThemePresets();
        };

        wrap.appendChild(row);
    });
}

// ============================================
// TAB CLOAK FUNCTIONS
// ============================================
async function saveTabCloakPreset() {
    if (!currentUser) return alert("Log in first.");

    const presetValue = document.getElementById('faviconPreset').value;
    if (!presetValue) return alert("Pick a tab cloak preset first.");

    const name = prompt("Tab cloak preset name?");
    if (!name) return;

    const presetId = slugifyPresetName(name);
    const [icon, title] = presetValue.split('|');

    try {
        await setDoc(doc(db, "users", currentUser.uid, "tabCloakPresets", presetId), {
            name,
            icon,
            title,
            presetValue,
            savedAt: new Date().toISOString()
        });
        await loadTabCloakPresets();
        await saveUserSettings();
        alert("Tab cloak preset saved!");
    } catch (err) {
        console.error("SAVE CLOAK PRESET ERROR:", err);
        alert("Failed to save tab cloak preset: " + err.message);
    }
}

async function loadTabCloakPresets() {
    const wrap = document.getElementById('tab-cloak-presets-list');
    if (!wrap) return;
    wrap.innerHTML = '';

    if (!currentUser) {
        wrap.innerHTML = '<div class="config-row"><div class="config-info"><span class="config-desc">Log in to see your saved tab cloak presets.</span></div></div>';
        return;
    }

    const snap = await getDocs(collection(db, "users", currentUser.uid, "tabCloakPresets"));
    if (snap.empty) {
        wrap.innerHTML = '<div class="config-row"><div class="config-info"><span class="config-desc">No saved tab cloak presets yet.</span></div></div>';
        return;
    }

    snap.forEach((docSnap) => {
        const data = docSnap.data();
        const row = document.createElement('div');
        row.className = 'config-row';
        row.innerHTML = `
            <div class="config-info">
                <span class="config-label">${data.name}</span>
                <span class="config-desc">${data.title}</span>
            </div>
            <div style="display:flex; gap:10px; flex-wrap:wrap;">
                <button class="action-btn btn-outline">Load</button>
                <button class="action-btn btn-outline">Delete</button>
            </div>
        `;

        const [loadBtn, deleteBtn] = row.querySelectorAll('button');

        loadBtn.onclick = async () => {
            const dropdown = document.getElementById('faviconPreset');
            if (dropdown) dropdown.value = data.presetValue || `${data.icon}|${data.title}`;
            if (typeof window.setFavicon === 'function') window.setFavicon(data.icon);
            document.title = data.title;
            await saveUserSettings();
        };

        deleteBtn.onclick = async () => {
            await deleteDoc(doc(db, "users", currentUser.uid, "tabCloakPresets", docSnap.id));
            await loadTabCloakPresets();
        };

        wrap.appendChild(row);
    });
}

// Auth state listener
onAuthStateChanged(auth, async (user) => {
    currentUser = user || null;

    const status = document.getElementById('account-status');
    const emailInput = document.getElementById('account-email');
    const passwordInput = document.getElementById('account-password');

    if (user) {
        if (status) status.textContent = `Signed in as ${user.email}`;
        if (emailInput) emailInput.value = user.email || '';
        if (passwordInput) passwordInput.value = '';
        await loadUserSettings();
        await loadThemePresets();
        await loadTabCloakPresets();
    } else {
        if (status) status.textContent = 'Not signed in';
        if (passwordInput) passwordInput.value = '';
        await loadThemePresets();
        await loadTabCloakPresets();
    }
});

// Export functions to window for global access
window.saveTheme = saveTheme;
window.loadTheme = loadTheme;
window.registerAccount = registerAccount;
window.loginAccount = loginAccount;
window.logoutAccount = logoutAccount;
window.saveThemePreset = saveThemePreset;
window.saveTabCloakPreset = saveTabCloakPreset;
window.saveUserSettingsToCloud = () => saveUserSettings().catch(console.error);
