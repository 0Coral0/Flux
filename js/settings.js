// ============================================
// THEME ENGINE & UI SETTINGS
// ============================================

function applyUiScale() {
    const slider = document.getElementById('set-ui-scale');
    const display = document.getElementById('ui-scale-display');
    const scaleValue = Number(slider?.value || 100);
    const scale = scaleValue / 100;

    document.documentElement.style.setProperty('--ui-scale', String(scale));
    if (display) display.textContent = `${scaleValue}%`;

    const saved = JSON.parse(localStorage.getItem('aggw_Ultimate_config') || '{}');
    saved.uiScale = scaleValue;
    localStorage.setItem('aggw_Ultimate_config', JSON.stringify(saved));
}

function applyThemeColors() {
    const acc = document.getElementById('set-accent').value;
    const bg = document.getElementById('set-bg').value;
    const cardBg = document.getElementById('set-card-bg')?.value || '#121212';
    const borderColor = document.getElementById('set-border')?.value || '#1e1e1e';
    const textColor = document.getElementById('set-text')?.value || '#ffffff';
    const blurIntensity = document.getElementById('set-blur')?.value || '5';
    const borderRadius = document.getElementById('set-radius')?.value || '16';
    const root = document.documentElement;

    // Convert hex to RGB for rgba usage
    const hexToRgb = (hex) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 238, 0';
    };

    root.style.setProperty('--accent', acc);
    root.style.setProperty('--accent-rgb', hexToRgb(acc));
    root.style.setProperty('--bg', bg);
    root.style.setProperty('--card', cardBg);
    root.style.setProperty('--border', borderColor);
    root.style.setProperty('--text', textColor);
    root.style.setProperty('--glass', `blur(${blurIntensity}px) saturate(180%)`);
    root.style.setProperty('--card-radius', `${borderRadius}px`);
    root.style.setProperty('--control-radius', `${Math.max(4, Math.round(borderRadius * 0.6))}px`);
    root.style.setProperty('--content-padding', `${Math.max(10, Math.round(borderRadius * 0.75))}px`);

    const saved = {
        accent: acc,
        bg: bg,
        cardBg: cardBg,
        borderColor: borderColor,
        textColor: textColor,
        blurIntensity: blurIntensity,
        borderRadius: borderRadius,
        particlesEnabled: document.getElementById('set-particles').checked
    };
    localStorage.setItem('aggw_config', JSON.stringify(saved));
}

// ============================================
// TAB CLOAK / FAVICON & TITLE LOGIC
// ============================================
function setFavicon(src) {
    let link = document.querySelector("link[rel*='icon']");
    if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
    }
    link.href = src;
}

function applyFaviconPreset() {
    const preset = document.getElementById("faviconPreset").value;
    if (!preset) return;

    const [icon, title] = preset.split('|');
    setFavicon(icon);
    document.title = title;
    saveConfiguration();
}

function applyCustomTabCloak() {
    const tabName = document.getElementById("customTabName")?.value?.trim();
    if (tabName) {
        document.title = tabName;
    }
    saveConfiguration();
}

function applyCustomFavicon(input) {
    if (!input.files || !input.files[0]) return;

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = function (e) {
        const faviconData = e.target.result;
        setFavicon(faviconData);

        const tabName = document.getElementById("customTabName")?.value?.trim();
        if (tabName) document.title = tabName;

        localStorage.setItem("aggw_custom_favicon", faviconData);
        saveConfiguration();
    };

    reader.readAsDataURL(file);
}

function resetTabCloak() {
    document.title = "Aggw Ultimate";
    setFavicon("AggwLogo.png");

    const presetDropdown = document.getElementById("faviconPreset");
    const customTabName = document.getElementById("customTabName");

    if (presetDropdown) presetDropdown.value = "";
    if (customTabName) customTabName.value = "";

    localStorage.removeItem("aggw_custom_favicon");
    saveConfiguration();
}

// ============================================
// THEME EXPORT/IMPORT
// ============================================
function exportTheme() {
    const data = {
        name: "AGGW Ultimate Theme",
        accent: document.getElementById('set-accent').value,
        bg: document.getElementById('set-bg').value,
        timestamp: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aggw_theme_${Date.now()}.json`;
    a.click();
}

function importTheme(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const theme = JSON.parse(e.target.result);
            document.getElementById('set-accent').value = theme.accent;
            document.getElementById('set-bg').value = theme.bg;
            applyThemeColors();
            alert("Theme applied successfully!");
        } catch (err) {
            alert("Error: Invalid theme file format.");
        }
    };
    reader.readAsText(file);
}

// Export functions to window
window.applyUiScale = applyUiScale;
window.applyThemeColors = applyThemeColors;
window.setFavicon = setFavicon;
window.applyFaviconPreset = applyFaviconPreset;
window.applyCustomTabCloak = applyCustomTabCloak;
window.applyCustomFavicon = applyCustomFavicon;
window.resetTabCloak = resetTabCloak;
window.exportTheme = exportTheme;
window.importTheme = importTheme;
