// ============================================
// APPLICATION BOOT SEQUENCE
// ============================================

let sessionStartTime = Date.now();
let panicKey = localStorage.getItem('aggw_panic') || "]";
window.panicKey = panicKey;

// ============================================
// BOOT SEQUENCE
// ============================================
window.addEventListener('load', () => {
    try {
        // Initialize components
        initializeSkeletonLoader();
        initializeTimeBoundThemes();
        updateChangelogVersionDisplay();

        // Hide skeleton loader after delay
        setTimeout(() => {
            const loader = document.getElementById('skeleton-loader');
            if (loader) {
                loader.classList.add('fade-out');
                setTimeout(() => loader.style.display = 'none', 800);
            }

            // Start metrics and refresh
            updateMetrics();
            initBatteryMetric();
            setInterval(updateMetrics, 1000);
            
            // Initialize archives
            if (typeof window.refreshArchives === 'function') {
                window.refreshArchives();
            }
            if (typeof window.refreshMostPlayed === 'function') {
                window.refreshMostPlayed();
            }
            if (typeof window.updateRecentPlayed === 'function') {
                window.updateRecentPlayed();
            }
            if (typeof window.initArchiveScrollHide === 'function') {
                setTimeout(() => window.initArchiveScrollHide(), 100);
            }
        }, 1800);
    } catch (err) {
        console.error("Boot sequence error:", err);
    }
});

// ============================================
// SKELETON LOADER
// ============================================
function initializeSkeletonLoader() {
    // Skeleton loader is already in the HTML and will be hidden by the boot sequence
}

// ============================================
// METRICS & UTILITIES
// ============================================
function updateMetrics() {
    const now = new Date();
    const timeEl = document.getElementById('val-time');
    if (timeEl) timeEl.innerText = now.toLocaleTimeString();

    const diff = Math.floor((Date.now() - sessionStartTime) / 60000);
    document.getElementById('stat-runtime').innerText = diff + "m";
}

function setBatteryIcon(level, charging, unavailable = false) {
    const iconEl = document.getElementById('footer-battery-icon');
    if (!iconEl) return;

    if (unavailable) {
        iconEl.className = 'fa-solid fa-plug-circle-bolt';
        iconEl.style.opacity = '0.55';
        return;
    }

    iconEl.style.opacity = '1';

    if (charging) {
        iconEl.className = 'fa-solid fa-battery-bolt';
        return;
    }

    let icon = 'fa-battery-full';
    if (level <= 5) icon = 'fa-battery-empty';
    else if (level <= 25) icon = 'fa-battery-quarter';
    else if (level <= 50) icon = 'fa-battery-half';
    else if (level <= 75) icon = 'fa-battery-three-quarters';

    iconEl.className = `fa-solid ${icon}`;
}

function updateBatteryMetric(bat) {
    const batteryLevel = Math.round(bat.level * 100);
    const batteryDisplay = document.getElementById('val-battery');
    if (!batteryDisplay) return;

    const isDesktopBattery = bat.charging && bat.level === 1 && bat.dischargingTime === Infinity;

    if (isDesktopBattery) {
        batteryDisplay.innerText = 'N/A';
        setBatteryIcon(100, false, true);
        return;
    }

    batteryDisplay.innerText = `${batteryLevel}%`;
    setBatteryIcon(batteryLevel, bat.charging, false);
}

function initBatteryMetric() {
    if (!navigator.getBattery) return;

    navigator.getBattery().then(bat => {
        updateBatteryMetric(bat);

        if (!window.__aggwBatteryListenersBound) {
            window.__aggwBatteryListenersBound = true;
            ['levelchange', 'chargingchange'].forEach(eventName => {
                bat.addEventListener(eventName, () => updateBatteryMetric(bat));
            });
        }
    });
}

// ============================================
// NAVIGATION
// ============================================
function showPage(id) {
    document.querySelectorAll('.container').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.sidebar-nav-btn').forEach(b => b.classList.remove('active'));

    const viewEl = document.getElementById('view-' + id);
    const btnEl = document.getElementById('btn-' + id);

    if (viewEl) viewEl.classList.add('active');
    if (btnEl) btnEl.classList.add('active');

    if (id === 'archives') refreshArchives();
    if (id === 'account') {
        if (typeof window.saveUserSettingsToCloud === 'function') {
            // no-op placeholder so account page always exists in nav flow
        }
    }
}

// ============================================
// CHANGELOG SYSTEM
// ============================================
function updateChangelogVersionDisplay() {
    if (typeof changelogData !== 'undefined' && changelogData.length > 0) {
        const display = document.getElementById('current-version-display');
        if (display) {
            display.innerText = 'v' + changelogData[0].v;
        }
    }
}

function openChangelog() {
    const list = document.getElementById('changelog-list');
    if (!list) return;

    list.innerHTML = '';

    if (typeof changelogData !== 'undefined') {
        changelogData.forEach((log, index) => {
            const li = document.createElement('li');
            li.className = 'changelog-item';
            li.onclick = () => openDetail(log.v, log.name, log.large);
            li.innerHTML = `
                <span class="cl-ver">v${log.v}</span>
                <span class="cl-name">${log.name}</span>
                <p class="cl-mini">${log.mini}</p>
            `;
            list.appendChild(li);

            if (index === 0) {
                setTimeout(() => openDetail(log.v, log.name, log.large), 100);
            }
        });

        updateChangelogVersionDisplay();
    }

    document.getElementById('changelog-overlay').style.display = 'flex';
}

function closeChangelog() {
    document.getElementById('changelog-overlay').style.display = 'none';
}

function openDetail(v, name, body) {
    const titleEl = document.getElementById('detail-title');
    const contentEl = document.getElementById('detail-content');

    if (titleEl && contentEl) {
        titleEl.innerText = 'v' + v + ': ' + name;
        contentEl.innerText = body;
        document.getElementById('detail-overlay').style.display = 'flex';
    }
}

function closeDetail() {
    document.getElementById('detail-overlay').style.display = 'none';
}

// Close when clicking outside of any modal
window.addEventListener('click', (e) => {
    if (e.target.id === 'detail-overlay') {
        closeDetail();
    } else if (e.target.id === 'changelog-overlay') {
        closeChangelog();
    } else if (e.target.classList.contains('theme-preview-overlay')) {
        e.target.style.display = 'none';
    }
});

// ============================================
// PANIC KEY HANDLER
// ============================================
function handleGlobalKeys(e) {
    if (e.key === panicKey) {
        window.location.href = "https://classroom.google.com";
    }
}

function updatePanicKey(val) {
    if (!val) return;
    panicKey = val;
    window.panicKey = val;
    document.getElementById('panic-display').innerText = val;
    saveConfiguration();
}

function purgeSystem() {
    if (confirm("This will wipe all custom themes and saved 'Last Played' data. Proceed?")) {
        localStorage.clear();
        window.location.reload();
    }
}

// ============================================
// TIME-BOUND THEME MANAGEMENT
// ============================================
const LIMITED_THEME_STORAGE_KEY = 'aggw_limited_theme_preferences';
const ANNIVERSARY_CAMPAIGN_END = new Date(2026, 8, 30, 23, 59, 59, 999);
const MEMORIAL_CAMPAIGN_END = new Date(2026, 8, 15, 23, 59, 59, 999);
const MEMORIAL_THEME_TEST_MODE = false;
let limitedThemePreferencesRestored = false;
const dismissedBanners = new Set();

function isAnniversaryPeriod(now = new Date()) {
    return now <= ANNIVERSARY_CAMPAIGN_END;
}

function isMemorialPeriod(now = new Date()) {
    if (MEMORIAL_THEME_TEST_MODE) return now <= MEMORIAL_CAMPAIGN_END;
    const start = new Date(now.getFullYear(), 8, 8, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), 8, 15, 23, 59, 59, 999);
    return now >= start && now <= end;
}

function getMemorialCampaignEnd(now = new Date()) {
    if (MEMORIAL_THEME_TEST_MODE) return MEMORIAL_CAMPAIGN_END;
    return new Date(now.getFullYear(), 8, 15, 23, 59, 59, 999);
}

function formatThemeCountdown(endDate, now = new Date()) {
    const diff = endDate.getTime() - now.getTime();
    if (diff <= 0) return 'Expired';

    const totalSeconds = Math.floor(diff / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    return `${minutes}m ${seconds}s`;
}

function updateThemeCountdowns() {
    const now = new Date();
    const anniversaryEl = document.getElementById('anniversary-theme-countdown');
    const memorialEl = document.getElementById('memorial-theme-countdown');

    if (anniversaryEl) {
        anniversaryEl.textContent = isAnniversaryPeriod(now)
            ? formatThemeCountdown(ANNIVERSARY_CAMPAIGN_END, now)
            : 'Expired';
    }

    if (memorialEl) {
        memorialEl.textContent = isMemorialPeriod(now)
            ? formatThemeCountdown(getMemorialCampaignEnd(now), now)
            : 'Expired';
    }
}

function isBannerDismissed(theme) {
    return dismissedBanners.has(theme);
}

function dismissBanner(theme) {
    if (!['anniversary', 'memorial'].includes(theme)) return;
    dismissedBanners.add(theme);
    initializeTimeBoundThemes();
}

function initializeMemorialWallVisibility() {
    const wall = document.getElementById('memorial-remembrance-section');
    if (!wall) return;
    wall.style.display = isMemorialPeriod() ? '' : 'none';
}

function getLimitedThemePreferences() {
    try {
        return JSON.parse(localStorage.getItem(LIMITED_THEME_STORAGE_KEY)) || {};
    } catch (error) {
        return {};
    }
}

function saveLimitedThemePreferences() {
    localStorage.setItem(LIMITED_THEME_STORAGE_KEY, JSON.stringify({
        anniversary: document.body.classList.contains('original-edition'),
        memorial: document.body.classList.contains('memorial-theme')
    }));
}

function setOriginalEditionBrandCopy(enabled) {
    const copy = [
        ['.sidebar-brand-main', 'Aggw Ultimate'],
        ['.sidebar-brand-sub', '1st Anniversary']
    ];

    copy.forEach(([selector, originalText]) => {
        const element = document.querySelector(selector);
        if (!element) return;
        element.dataset.defaultLabel ||= element.textContent.trim();
        element.textContent = enabled ? originalText : element.dataset.defaultLabel;
    });
}

function syncLimitedThemeControls() {
    const originalEnabled = document.body.classList.contains('original-edition');
    const memorialEnabled = document.body.classList.contains('memorial-theme');
    const originalAction = document.getElementById('anniversary-banner-action');
    const memorialAction = document.getElementById('memorial-banner-action');

    if (originalAction) {
        originalAction.textContent = originalEnabled ? 'Original Edition Applied' : 'Apply Original Edition';
        originalAction.classList.toggle('is-active', originalEnabled);
        originalAction.setAttribute('aria-pressed', String(originalEnabled));
    }

    if (memorialAction) {
        memorialAction.textContent = memorialEnabled ? 'Memorial Theme Applied' : 'Apply Memorial Theme';
        memorialAction.classList.toggle('is-active', memorialEnabled);
        memorialAction.setAttribute('aria-pressed', String(memorialEnabled));
    }
}

function updateTimeBoundBannerLayout() {
    requestAnimationFrame(() => {
        const anniversaryBanner = document.getElementById('anniversary-banner');
        const memorialBanner = document.getElementById('memorial-banner');
        const anniversaryHeight = anniversaryBanner?.offsetParent !== null ? anniversaryBanner.offsetHeight : 0;
        const memorialHeight = memorialBanner?.offsetParent !== null ? memorialBanner.offsetHeight : 0;

        document.body.style.setProperty('--anniversary-banner-height', `${anniversaryHeight || 60}px`);
        document.body.style.setProperty('--memorial-banner-height', `${memorialHeight || 60}px`);
    });
}

function setLimitedTheme(theme, enabled, { announce = false, persist = true } = {}) {
    const isOriginal = theme === 'anniversary';
    const enabledClass = isOriginal ? 'original-edition' : 'memorial-theme';
    const otherClass = isOriginal ? 'memorial-theme' : 'original-edition';
    const isAvailable = isOriginal ? isAnniversaryPeriod() : isMemorialPeriod();

    if (enabled && !isAvailable) {
        initializeTimeBoundThemes();
        return;
    }

    document.body.classList.toggle(enabledClass, enabled);
    if (enabled) document.body.classList.remove(otherClass);

    if (isOriginal) {
        setOriginalEditionBrandCopy(enabled);
        enabled ? startTypewriter() : stopTypewriter();
    } else if (enabled) {
        setOriginalEditionBrandCopy(false);
        stopTypewriter();
    }

    if (persist) saveLimitedThemePreferences();
    syncLimitedThemeControls();

    if (announce && typeof showToast === 'function') {
        const name = isOriginal ? 'Original Edition' : '9/11 Memorial';
        showToast(`${name} theme ${enabled ? 'enabled' : 'disabled'}`);
    }
}

function applyOriginalEdition() {
    setLimitedTheme('anniversary', true, { announce: true });
}

function applyMemorialTheme() {
    setLimitedTheme('memorial', true, { announce: true });
}

function toggleAnniversaryTheme() {
    const toggle = document.getElementById('toggle-anniversary-theme');
    setLimitedTheme('anniversary', Boolean(toggle?.checked), { announce: true });
}

function toggleMemorialTheme() {
    const toggle = document.getElementById('toggle-memorial-theme');
    setLimitedTheme('memorial', Boolean(toggle?.checked), { announce: true });
}

// Typewriter effect
let typewriterInterval = null;
const typewriterPhrases = [
    'AGGW ULTIMATE EDITION',
    'Endless Games All In One Place',
    'Your Escape From Classroom Boredom',
    'YOUR GATEWAY TO GAMING',
    'YOUR DIGITAL HAVEN'
];
let typewriterWordIdx = 0;
let typewriterCharIdx = 0;
let typewriterIsDeleting = false;

function startTypewriter() {
    if (typewriterInterval) return;
    typewriterEffect();
}

function stopTypewriter() {
    if (typewriterInterval) clearTimeout(typewriterInterval);
    typewriterInterval = null;
    const target = document.getElementById('typewriter');
    if (target) target.textContent = '';
}

function typewriterEffect() {
    const target = document.getElementById('typewriter');
    if (!target || !document.body.classList.contains('original-edition')) {
        typewriterInterval = null;
        return;
    }

    const currentWord = typewriterPhrases[typewriterWordIdx];
    if (typewriterIsDeleting) {
        target.textContent = currentWord.substring(0, --typewriterCharIdx);
    } else {
        target.textContent = currentWord.substring(0, ++typewriterCharIdx);
    }

    let speed = typewriterIsDeleting ? 50 : 150;
    if (!typewriterIsDeleting && typewriterCharIdx === currentWord.length) {
        typewriterIsDeleting = true;
        speed = 3000;
    } else if (typewriterIsDeleting && typewriterCharIdx === 0) {
        typewriterIsDeleting = false;
        typewriterWordIdx = (typewriterWordIdx + 1) % typewriterPhrases.length;
        speed = 500;
    }
    typewriterInterval = setTimeout(typewriterEffect, speed);
}

function restoreLimitedThemePreference() {
    if (limitedThemePreferencesRestored) return;
    limitedThemePreferencesRestored = true;
    const preferences = getLimitedThemePreferences();

    if (preferences.memorial && isMemorialPeriod()) {
        setLimitedTheme('memorial', true, { persist: false });
    } else if (preferences.anniversary && isAnniversaryPeriod()) {
        setLimitedTheme('anniversary', true, { persist: false });
    }
}

function initializeTimeBoundThemes() {
    const anniversaryAvailable = isAnniversaryPeriod();
    const memorialAvailable = isMemorialPeriod();
    const anniversaryRow = document.getElementById('anniversary-theme-row');
    const memorialRow = document.getElementById('memorial-theme-row');
    const settingsBlock = document.getElementById('timebound-themes-block');
    const anniversaryBanner = document.getElementById('anniversary-banner');
    const memorialBanner = document.getElementById('memorial-banner');
    const anniversaryBannerVisible = anniversaryAvailable && !isBannerDismissed('anniversary');
    const memorialBannerVisible = memorialAvailable && !isBannerDismissed('memorial');

    if (anniversaryRow) anniversaryRow.style.display = anniversaryAvailable ? 'flex' : 'none';
    if (memorialRow) memorialRow.style.display = memorialAvailable ? 'flex' : 'none';
    if (settingsBlock) settingsBlock.style.display = anniversaryAvailable || memorialAvailable ? 'block' : 'none';
    if (anniversaryBanner) anniversaryBanner.style.display = anniversaryBannerVisible ? 'flex' : 'none';
    if (memorialBanner) memorialBanner.style.display = memorialBannerVisible ? 'flex' : 'none';

    document.body.classList.toggle('has-anniversary-banner', anniversaryBannerVisible);
    document.body.classList.toggle('has-memorial-banner', memorialBannerVisible);
    updateTimeBoundBannerLayout();

    if (!anniversaryAvailable && document.body.classList.contains('original-edition')) {
        setLimitedTheme('anniversary', false, { persist: true });
    }
    if (!memorialAvailable && document.body.classList.contains('memorial-theme')) {
        setLimitedTheme('memorial', false, { persist: true });
    }

    restoreLimitedThemePreference();
    syncLimitedThemeControls();
    updateThemeCountdowns();
}

// Re-check active campaigns periodically
setInterval(initializeTimeBoundThemes, 60 * 1000);
setInterval(updateThemeCountdowns, 1000);
window.addEventListener('resize', updateTimeBoundBannerLayout);

// ============================================
// CONFIGURATION MANAGEMENT
// ============================================
function saveConfiguration() {
    const config = {
        accent: document.getElementById('set-accent').value,
        bg: document.getElementById('set-bg').value,
        cardBg: document.getElementById('set-card-bg')?.value || '#121212',
        borderColor: document.getElementById('set-border')?.value || '#1e1e1e',
        textColor: document.getElementById('set-text')?.value || '#ffffff',
        blurIntensity: document.getElementById('set-blur')?.value || '5',
        borderRadius: document.getElementById('set-radius')?.value || '16',
        uiScale: document.getElementById('set-ui-scale')?.value || '100',
        panic: panicKey,
        faviconPreset: document.getElementById('faviconPreset')?.value || '',
        customTabName: document.getElementById('customTabName')?.value || '',
        customFavicon: localStorage.getItem('aggw_custom_favicon') || ''
    };

    window.panicKey = panicKey;
    localStorage.setItem('aggw_Ultimate_config', JSON.stringify(config));

    if (typeof window.applyThemeColors === 'function') {
        window.applyThemeColors();
    }

    if (typeof window.saveUserSettingsToCloud === 'function') {
        window.saveUserSettingsToCloud();
    }
}

function loadConfiguration() {
    const saved = JSON.parse(localStorage.getItem('aggw_Ultimate_config') || '{}');

    document.getElementById('set-accent').value = saved.accent || '#ffee00';
    document.getElementById('set-bg').value = saved.bg || '#050505';
    document.getElementById('set-card-bg').value = saved.cardBg || '#121212';
    document.getElementById('set-border').value = saved.borderColor || '#1e1e1e';
    document.getElementById('set-text').value = saved.textColor || '#ffffff';
    document.getElementById('set-blur').value = saved.blurIntensity || '5';
    document.getElementById('set-radius').value = saved.borderRadius || '16';
    document.getElementById('set-ui-scale').value = saved.uiScale || '100';

    panicKey = saved.panic || ']';
    window.panicKey = panicKey;

    const panicDisplay = document.getElementById('panic-display');
    if (panicDisplay) panicDisplay.innerText = panicKey;

    const presetDropdown = document.getElementById('faviconPreset');
    if (presetDropdown) presetDropdown.value = saved.faviconPreset || '';

    const customTabName = document.getElementById('customTabName');
    if (customTabName) customTabName.value = saved.customTabName || '';

    if (saved.customFavicon) {
        if (typeof window.setFavicon === 'function') window.setFavicon(saved.customFavicon);
        localStorage.setItem('aggw_custom_favicon', saved.customFavicon);
    } else if (saved.faviconPreset) {
        if (typeof window.applyFaviconPreset === 'function') window.applyFaviconPreset();
    }

    if (saved.customTabName) {
        document.title = saved.customTabName;
    } else if (!saved.faviconPreset) {
        document.title = "Aggw Ultimate";
    }

    if (typeof window.applyUiScale === 'function') {
        window.applyUiScale();
    }
    if (typeof window.applyThemeColors === 'function') {
        window.applyThemeColors();
    }
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: var(--accent);
        color: #000;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 600;
        z-index: 10002;
        animation: slideUp 0.3s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

// ============================================
// SETTINGS TAB NAVIGATION
// ============================================
function switchSettingsTab(tabName) {
    // Hide all tab contents
    document.querySelectorAll('.settings-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Remove active class from all tab buttons
    document.querySelectorAll('.settings-tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // Show selected tab content
    const tabContent = document.getElementById(`settings-tab-${tabName}`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Add active class to clicked button
    event.target.classList.add('active');
}

// Load configuration on boot
loadConfiguration();

// Export time-bound theme functions to window
window.toggleAnniversaryTheme = toggleAnniversaryTheme;
window.toggleMemorialTheme = toggleMemorialTheme;
