// ============================================
// FLUX APPLICATION LOGIC
// ============================================

let sessionStartTime = Date.now();
let panicKey = localStorage.getItem('flux_panic') || "]";
window.panicKey = panicKey;

// ============================================
// BOOT SEQUENCE
// ============================================
window.addEventListener('load', () => {
    console.log("Flux boot sequence started");
    try {
        // Hide skeleton loader after 2 seconds (forced delay)
        setTimeout(() => {
            const loader = document.getElementById('skeleton-loader');
            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => loader.style.display = 'none', 800);
            }

            // Start metrics
            updateMetrics();
            setInterval(updateMetrics, 1000);
            
            // Initialize data
            refreshArchives();
            refreshRecords();
            loadTheme();
            loadPanicKey();
        }, 2000);
        console.log("Boot sequence completed successfully");
    } catch (err) {
        console.error("Boot sequence error:", err);
        alert("Error loading application: " + err.message);
    }
});

// ============================================
// METRICS
// ============================================
function updateMetrics() {
    const now = new Date();
    const timeEl = document.getElementById('val-time');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString();

    const diff = Math.floor((Date.now() - sessionStartTime) / 60000);
    document.getElementById('stat-runtime').innerText = diff + "m";
}

// ============================================
// NAVIGATION
// ============================================
function showPage(id) {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));

    const viewEl = document.getElementById('view-' + id);
    const btnEl = document.getElementById('btn-' + id);

    if (viewEl) viewEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (id === 'archives') refreshArchives();
    if (id === 'records') refreshRecords();
}

// ============================================
// ARCHIVE ENGINE
// ============================================
function refreshArchives() {
    const grid = document.getElementById('main-grid');
    const search = document.getElementById('archive-search').value.toLowerCase();
    grid.innerHTML = "";

    const list = (typeof gameList !== 'undefined' ? gameList : []);

    // Update total games count
    document.getElementById('stat-count').innerText = list.length;

    list.forEach(game => {
        if (game.name.toLowerCase().includes(search)) {
            const card = document.createElement('div');
            card.className = "game-node";
            card.innerHTML = `
                <img src="${game.thumb}" loading="lazy">
                <div class="game-info">
                    <h3 class="game-name">${game.name}</h3>
                </div>
            `;
            card.onclick = () => openGame(game.file, game.name, game.description);
            grid.appendChild(card);
        }
    });
}

function openGame(gameFile, gameName, gameDescription) {
    console.log("Opening game:", gameName);
    const fullGame = {
        file: gameFile,
        name: gameName,
        description: gameDescription,
        thumb: (typeof gameList !== 'undefined' ? gameList.find(g => g.file === gameFile)?.thumb : 'AggwLogo.png')
    };
    
    localStorage.setItem('flux_last_played', JSON.stringify(fullGame));
    
    // Open in theater mode
    openTheater(fullGame);
}

function openTheater(game) {
    showPage('theater');
    const viewport = document.getElementById('game-viewport');
    if (viewport) {
        viewport.src = game.file;
    }
}

function closeTheater() {
    const viewport = document.getElementById('game-viewport');
    if (viewport) {
        viewport.src = '';
    }
    showPage('archives');
}

function refreshTheater() {
    const viewport = document.getElementById('game-viewport');
    if (viewport) {
        viewport.src = viewport.src;
    }
}

// ============================================
// RECORDS DISPLAY
// ============================================
function refreshRecords() {
    const container = document.getElementById('records-container');
    if (!container) return;

    const recordsData = (typeof records !== 'undefined' ? records : []);
    
    if (recordsData.length === 0) {
        container.innerHTML = '<p style="color: var(--text-dim); text-align: center;">No records yet. Be the first to set a record!</p>';
        return;
    }

    recordsData.forEach(record => {
        const row = document.createElement('div');
        row.className = 'record-row';
        row.innerHTML = `
            <div class="record-game-title">${record.game}</div>
            <div class="record-score-val">${record.score}</div>
        `;
        container.appendChild(row);
    });
}

// ============================================
// SETTINGS
// ============================================
function switchTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.tab-panel').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const tabContent = document.getElementById(`tab-${tabName}`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

function applyTheme() {
    const accent = document.getElementById('set-accent').value;
    const root = document.documentElement;
    
    // Convert hex to RGB
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '34, 197, 94';
    };
    
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-rgb', hexToRgb(accent));
    
    localStorage.setItem('flux_accent', accent);
}

function loadTheme() {
    const savedAccent = localStorage.getItem('flux_accent');
    if (savedAccent) {
        document.getElementById('set-accent').value = savedAccent;
        applyTheme();
    }
}

function applyFaviconPreset() {
    const preset = document.getElementById('faviconPreset').value;
    if (!preset) return;

    const [icon, title] = preset.split('|');
    const link = document.querySelector("link[rel*='icon']");
    if (link) link.href = icon;
    document.title = title;
}

function updatePanicKey(val) {
    if (!val) return;
    panicKey = val;
    window.panicKey = val;
    localStorage.setItem('flux_panic', val);
}

function loadPanicKey() {
    const saved = localStorage.getItem('flux_panic');
    if (saved) {
        document.getElementById('set-panic').value = saved;
        panicKey = saved;
        window.panicKey = saved;
    }
}

// ============================================
// PANIC KEY HANDLER
// ============================================
window.handleGlobalKeys = function(e) {
    if (e.key === panicKey) {
        window.location.href = "https://classroom.google.com";
    }
};

// ============================================
// EXPORT FUNCTIONS
// ============================================
window.refreshArchives = refreshArchives;
window.openGame = openGame;
window.refreshRecords = refreshRecords;
window.showPage = showPage;
window.switchTab = switchTab;
window.applyTheme = applyTheme;
window.applyFaviconPreset = applyFaviconPreset;
window.handleGlobalKeys = window.handleGlobalKeys;
window.openTheater = openTheater;
window.closeTheater = closeTheater;
window.refreshTheater = refreshTheater;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadPanicKey();
    refreshArchives();
    refreshRecords();
});
