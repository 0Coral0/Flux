// ============================================
// ARCHIVE ENGINE
// ============================================

function refreshArchives() {
    const grid = document.getElementById('main-grid');
    const search = document.getElementById('archive-search').value.toLowerCase();
    grid.innerHTML = "";

    const list = (typeof gameList !== 'undefined' ? gameList : []);
    const favorites = JSON.parse(localStorage.getItem('aggw_favorites') || '[]');

    // Update total games count
    document.getElementById('stat-count').innerText = list.length;

    // Sort: favorited games first, then alphabetically
    const sortedList = list.slice().sort((a, b) => {
        const aFavorited = favorites.some(f => f.name === a.name);
        const bFavorited = favorites.some(f => f.name === b.name);
        
        if (aFavorited && !bFavorited) return -1;
        if (!aFavorited && bFavorited) return 1;
        return a.name.localeCompare(b.name);
    });

    sortedList.forEach(game => {
        if (game.name.toLowerCase().includes(search)) {
            const isFavorited = favorites.some(f => f.name === game.name);
            const card = document.createElement('div');
            card.className = "archive-card";
            if (isFavorited) card.style.border = "2px solid var(--accent)";
            card.innerHTML = `
                <button class="favorite-btn ${isFavorited ? 'favorited' : ''}" onclick="event.stopPropagation(); toggleFavoriteByName('${game.name}')" title="${isFavorited ? 'Remove from favorites' : 'Add to favorites'}">
                    <i class="fa-${isFavorited ? 'solid' : 'regular'} fa-star"></i>
                </button>
                <img src="${game.thumb}" loading="lazy">
                <div class="archive-meta">
                    <span class="archive-tag">${isFavorited ? '⭐ Favorited' : 'Game'}</span>
                    <h3 class="archive-title">${game.name}</h3>
                </div>
            `;
            card.onclick = () => openGame(game.file, game.name, game.description);
            grid.appendChild(card);
        }
    });

    // Update Latest Game dynamically
    if (list.length > 0) {
        const latest = list[list.length - 1];
        document.getElementById("latest-game").innerText = latest.name;
    }
}

function toggleFavoriteByName(gameName) {
    const list = (typeof gameList !== 'undefined' ? gameList : []);
    const game = list.find(g => g.name === gameName);
    if (!game) return;

    let favorites = JSON.parse(localStorage.getItem('aggw_favorites') || '[]');
    const index = favorites.findIndex(f => f.name === gameName);

    if (index > -1) {
        favorites.splice(index, 1);
        showToast('Removed from favorites');
    } else {
        favorites.push(game);
        showToast('Added to favorites');
    }

    localStorage.setItem('aggw_favorites', JSON.stringify(favorites));
    refreshArchives();
}

function openGame(gameFile, gameName, gameDescription) {
    const list = (typeof gameList !== 'undefined' ? gameList : []);
    const fullGame = list.find(g => g.file === gameFile) || {
        file: gameFile,
        name: gameName,
        description: gameDescription,
        thumb: 'AggwLogo.png'
    };

    incrementPlayCount(gameName);
    refreshMostPlayed();

    if (document.body.classList.contains('original-edition')) {
        launchTheater(fullGame);
        return;
    }

    if (typeof window.openTheaterNew === 'function') {
        window.openTheaterNew(gameFile, gameName, gameDescription);
    }
}

function launchTheater(game) {
    localStorage.setItem('aggw_last_played', JSON.stringify(game));
    document.getElementById('active-game-name').innerText = game.name;
    document.getElementById('game-viewport').src = game.file;
    document.getElementById('theater').style.display = 'flex';
    document.body.style.overflow = 'hidden';
    updateRecentPlayed();
}

function closeTheater() {
    document.getElementById('game-viewport').src = "";
    document.getElementById('theater').style.display = 'none';
    document.body.style.overflow = '';
}

function refreshGame() {
    const iframe = document.getElementById('game-viewport');
    iframe.src = iframe.src;
}

function refreshMostPlayed() {
    const grids = document.querySelectorAll('.dashboard-mostplayed-grid');
    if (!grids.length) return;

    const playCounts = JSON.parse(localStorage.getItem('aggw_play_counts') || '{}');
    const list = (typeof gameList !== 'undefined' ? gameList : []);

    // Sort games by play count and limit to top 5
    const sortedGames = list
        .map(game => ({
            ...game,
            playCount: playCounts[game.name] || 0
        }))
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, 5);

    grids.forEach(grid => {
        grid.innerHTML = "";
        sortedGames.forEach(game => {
            const card = document.createElement('div');
            card.className = "archive-card";
            card.onclick = () => openGame(game.file, game.name, game.description);
            card.innerHTML = `
                <img src="${game.thumb}" loading="lazy">
                <div class="archive-meta">
                    <span class="archive-tag">${game.playCount} plays</span>
                    <h3 class="archive-title">${game.name}</h3>
                </div>
            `;
            grid.appendChild(card);
        });
    });
}

function incrementPlayCount(gameName) {
    const playCounts = JSON.parse(localStorage.getItem('aggw_play_counts') || '{}');
    playCounts[gameName] = (playCounts[gameName] || 0) + 1;
    localStorage.setItem('aggw_play_counts', JSON.stringify(playCounts));
}

function updateRecentPlayed() {
    const last = JSON.parse(localStorage.getItem('aggw_last_played'));
    const anchor = document.getElementById('quick-resume-anchor');

    if (last) {
        const list = (typeof gameList !== 'undefined' ? gameList : []);
        const fullGame = list.find(g => g.name === last.name || g.file === last.file) || last;
        anchor.innerHTML = `
            <h3 style="font-size: 0.8rem; opacity: 0.4; letter-spacing: 2px; text-transform: uppercase;">Quick Resume</h3>
            <div class="info-card" style="display: flex; align-items: center; gap: 25px; cursor: pointer; margin-top: 15px;" onclick="openGame('${fullGame.file}', '${fullGame.name.replace(/'/g, "\\'")}', '${(fullGame.description || '').replace(/'/g, "\\'")}')">
                <img src="${fullGame.thumb || last.thumb}" style="width: 80px; height: 50px; border-radius: var(--card-radius); object-fit: cover;">
                <div>
                    <span class="info-title" style="color: var(--accent)">Continue Playing</span>
                    <span class="brand-main" style="display: block; font-size: 1.2rem;">${fullGame.name}</span>
                </div>
            </div>
        `;
    }
}

function initArchiveScrollHide() {
    const container = document.getElementById('view-archives');
    const searchBar = document.querySelector('.search-engine-wrap');

    let lastScroll = 0;

    container.addEventListener('scroll', () => {
        const currentScroll = container.scrollTop;

        if (currentScroll > lastScroll && currentScroll > 50) {
            searchBar.classList.add('search-hidden');
        } else {
            searchBar.classList.remove('search-hidden');
        }

        lastScroll = currentScroll;
    });
}

// Export functions to window
window.refreshArchives = refreshArchives;
window.toggleFavoriteByName = toggleFavoriteByName;
window.openGame = openGame;
window.closeTheater = closeTheater;
window.refreshGame = refreshGame;
window.refreshMostPlayed = refreshMostPlayed;
window.updateRecentPlayed = updateRecentPlayed;
window.initArchiveScrollHide = initArchiveScrollHide;

// Initialize archives when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    refreshArchives();
    refreshMostPlayed();
    updateRecentPlayed();
    setTimeout(initArchiveScrollHide, 100);
});
