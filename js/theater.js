// ============================================
// NEW THEATER MODE FUNCTIONS
// ============================================

let currentGameData = null;
let autoClickerInterval = null;
let isAutoClickerRunning = false;
let cursorX = 0;
let cursorY = 0;
let hotkeyBinding = null;
let clickerStartKey = localStorage.getItem('aggw_clicker_start') || 'F6';
let clickerStopKey = localStorage.getItem('aggw_clicker_stop') || 'F7';

function openTheaterNew(gameFile, gameName, gameDescription) {
    const theater = document.getElementById('theater-new');
    const viewport = document.getElementById('game-viewport-new');
    const titleDisplay = document.getElementById('game-title-display');
    const descContent = document.getElementById('game-description-content');

    viewport.src = gameFile;
    titleDisplay.textContent = gameName;
    descContent.textContent = gameDescription || 'No description available for this game.';

    currentGameData = { file: gameFile, name: gameName, description: gameDescription };

    // Update favorite button state
    const btn = document.querySelector('.game-control-btn[onclick="toggleFavorite()"]');
    if (btn) {
        const isFavorited = checkIfFavorited(gameName);
        if (isFavorited) {
            btn.style.color = '#ff4444';
            btn.querySelector('i').classList.remove('fa-regular');
            btn.querySelector('i').classList.add('fa-solid');
        } else {
            btn.style.color = 'var(--text)';
            btn.querySelector('i').classList.remove('fa-solid');
            btn.querySelector('i').classList.add('fa-regular');
        }
    }

    populateRecommendedGames(gameName);

    theater.style.display = 'block';
    theater.classList.add('active');
    document.body.style.overflow = 'hidden';

    const list = (typeof gameList !== 'undefined' ? gameList : []);
    const fullGame = list.find(g => g.file === gameFile);
    localStorage.setItem('aggw_last_played', JSON.stringify(fullGame || { name: gameName, file: gameFile }));
    if (typeof window.updateRecentPlayed === 'function') {
        window.updateRecentPlayed();
    }
}

function closeTheaterNew() {
    const theater = document.getElementById('theater-new');
    const viewport = document.getElementById('game-viewport-new');

    viewport.src = '';
    theater.style.display = 'none';
    theater.classList.remove('active');
    document.body.style.overflow = '';

    stopAutoClicker();
    document.getElementById('auto-clicker-widget')?.classList.remove('active');
}

function refreshGameNew() {
    const iframe = document.getElementById('game-viewport-new');
    if (iframe) iframe.src = iframe.src;
}

function toggleFullscreen() {
    const wrapper = document.querySelector('.game-viewport-wrapper');
    const target = wrapper || document.getElementById('game-viewport-new');
    if (target.requestFullscreen) {
        target.requestFullscreen();
    } else if (target.webkitRequestFullscreen) {
        target.webkitRequestFullscreen();
    }
}

function toggleFavorite() {
    if (!currentGameData) return;
    let favorites = JSON.parse(localStorage.getItem('aggw_favorites') || '[]');
    const index = favorites.findIndex(f => f.name === currentGameData.name);
    const btn = document.querySelector('.game-control-btn[onclick="toggleFavorite()"]');

    if (index > -1) {
        favorites.splice(index, 1);
        if (btn) {
            btn.style.color = 'var(--text)';
            btn.querySelector('i').classList.remove('fa-solid');
            btn.querySelector('i').classList.add('fa-regular');
        }
        showToast('Removed from favorites');
    } else {
        favorites.push(currentGameData);
        if (btn) {
            btn.style.color = '#ff4444';
            btn.querySelector('i').classList.remove('fa-regular');
            btn.querySelector('i').classList.add('fa-solid');
        }
        showToast('Added to favorites');
    }

    localStorage.setItem('aggw_favorites', JSON.stringify(favorites));
}

function checkIfFavorited(gameName) {
    const favorites = JSON.parse(localStorage.getItem('aggw_favorites') || '[]');
    return favorites.some(f => f.name === gameName);
}

function reportGame() {
    if (!currentGameData) return;
    
    const reason = prompt(`Why are you reporting "${currentGameData.name}"? Please provide a reason:`);
    if (!reason) return;
    
    // Prepare report for Discord bot to DM @CoralDaProot
    const reportMessage = `🚨 Game Report for @CoralDaProot\n\nGame: ${currentGameData.name}\nReason: ${reason}\nFile: ${currentGameData.file}\n\nReported from Aggw Ultimate`;
    
    // Copy to clipboard for easy pasting
    navigator.clipboard.writeText(reportMessage).then(() => {
        alert(`Report prepared for: ${currentGameData.name}\n\nThe report has been copied to your clipboard.\nThe Aggw bot will DM this report to @CoralDaProot.\n\nMessage:\n${reportMessage}`);
    }).catch(() => {
        alert(`Report prepared for: ${currentGameData.name}\n\nThe Aggw bot will DM this report to @CoralDaProot.\n\nMessage:\n${reportMessage}`);
    });
}

function populateRecommendedGames(currentGameName) {
    const grid = document.getElementById('recommended-grid');
    grid.innerHTML = '';

    const list = (typeof gameList !== 'undefined' ? gameList : []);
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    const recommended = shuffled.filter(g => g.name !== currentGameName).slice(0, 6);

    recommended.forEach(game => {
        const card = document.createElement('div');
        card.className = 'recommended-card';
        card.onclick = () => {
            if (typeof window.openGame === 'function') {
                window.openGame(game.file, game.name, game.description);
            }
        };
        card.innerHTML = `
            <img src="${game.thumb}" alt="${game.name}">
            <div class="recommended-card-name">${game.name}</div>
        `;
        grid.appendChild(card);
    });
}

// ============================================
// AUTO CLICKER FUNCTIONS
// ============================================
function toggleAutoClicker() {
    const widget = document.getElementById('auto-clicker-widget');
    widget.classList.toggle('active');
}

function startAutoClicker() {
    if (isAutoClickerRunning) return;

    const interval = parseInt(document.getElementById('click-interval').value) || 100;
    const mode = document.getElementById('click-mode').value;
    const statusEl = document.getElementById('auto-clicker-status');

    if (mode === 'fixed') {
        const x = parseInt(document.getElementById('click-x').value) || 500;
        const y = parseInt(document.getElementById('click-y').value) || 500;
        autoClickerInterval = setInterval(() => {
            simulateClick(x, y);
        }, interval);
    } else {
        autoClickerInterval = setInterval(() => {
            simulateClickAtCursor();
        }, interval);
    }

    isAutoClickerRunning = true;
    if (statusEl) {
        statusEl.textContent = 'Running';
        statusEl.classList.remove('idle');
        statusEl.classList.add('running');
    }
}

function stopAutoClicker() {
    if (autoClickerInterval) {
        clearInterval(autoClickerInterval);
        autoClickerInterval = null;
    }
    isAutoClickerRunning = false;
    const statusEl = document.getElementById('auto-clicker-status');
    if (statusEl) {
        statusEl.textContent = 'Idle';
        statusEl.classList.remove('running');
        statusEl.classList.add('idle');
    }
}

function simulateClick(x, y) {
    const viewport = document.getElementById('game-viewport-new');
    if (!viewport) return;

    // Create and dispatch click event on the iframe itself
    const event = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: x,
        clientY: y,
        view: window
    });

    viewport.dispatchEvent(event);
}

function simulateClickAtCursor() {
    const viewport = document.getElementById('game-viewport-new');
    if (!viewport) return;

    const rect = viewport.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

    simulateClick(x, y);
}

// Click mode change handler
document.getElementById('click-mode')?.addEventListener('change', function() {
    const fixedCoords = document.getElementById('fixed-coords-control');
    fixedCoords.style.display = this.value === 'fixed' ? 'block' : 'none';
});

function bindHotkey(type) {
    const key = prompt(`Press a key to bind as ${type} hotkey:`);
    if (!key) return;
    
    if (type === 'start') {
        clickerStartKey = key;
        document.getElementById('clicker-start-key').value = key;
        localStorage.setItem('aggw_clicker_start', key);
    } else {
        clickerStopKey = key;
        document.getElementById('clicker-stop-key').value = key;
        localStorage.setItem('aggw_clicker_stop', key);
    }
}

// Global hotkey listeners
document.addEventListener('keydown', (e) => {
    if (e.key === clickerStartKey) {
        e.preventDefault();
        startAutoClicker();
    } else if (e.key === clickerStopKey) {
        e.preventDefault();
        stopAutoClicker();
    }
});

// Export functions to window
window.openTheaterNew = openTheaterNew;
window.closeTheaterNew = closeTheaterNew;
window.refreshGameNew = refreshGameNew;
window.toggleFullscreen = toggleFullscreen;
window.toggleFavorite = toggleFavorite;
window.reportGame = reportGame;
window.toggleAutoClicker = toggleAutoClicker;
window.startAutoClicker = startAutoClicker;
window.stopAutoClicker = stopAutoClicker;
window.bindHotkey = bindHotkey;
