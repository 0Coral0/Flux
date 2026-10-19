(() => {
    const clock = document.getElementById('sidebar-clock');
    const batteryText = document.getElementById('sidebar-battery');
    const batteryIcon = document.getElementById('sidebar-battery-icon');
    const updateClock = () => {
        const now = new Date();
        clock.textContent = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(now);
        clock.dateTime = now.toISOString();
        clock.title = new Intl.DateTimeFormat(undefined, { dateStyle: 'full' }).format(now);
    };
    updateClock();
    setInterval(updateClock, 1000);
    if (typeof navigator.getBattery !== 'function') return;
    navigator.getBattery().then(battery => {
        const updateBattery = () => {
            // The web API uses the same values for no battery, unavailable status and a full battery.
            const ambiguous = battery.charging && battery.level === 1 && battery.chargingTime === 0 && battery.dischargingTime === Infinity;
            const level = Math.round(battery.level * 100);
            batteryText.textContent = ambiguous ? 'N/A' : `${level}%`;
            batteryText.title = ambiguous ? 'Battery status unavailable or fully charged' : battery.charging ? `${level}% and charging` : `${level}% remaining`;
            batteryIcon.className = `fa-solid ${ambiguous ? 'fa-battery-half' : battery.charging ? 'fa-bolt' : level <= 15 ? 'fa-battery-quarter' : level <= 40 ? 'fa-battery-half' : 'fa-battery-full'}`;
        };
        updateBattery();
        ['levelchange', 'chargingchange', 'chargingtimechange', 'dischargingtimechange'].forEach(event => battery.addEventListener(event, updateBattery));
    }).catch(() => {});
})();
