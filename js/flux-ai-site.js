/* Site actions are resolved against Flux's own navigation and catalogs, never model output. */
(function (global) {
    'use strict';

    const pages = [
        { id: 'dashboard', label: 'Home', aliases: ['home', 'dashboard', 'main page'] },
        { id: 'browser', label: 'Browser', aliases: ['browser', 'web browser'] },
        { id: 'ai', label: 'Assistant', aliases: ['assistant', 'flux ai', 'ai'] },
        { id: 'chat', label: 'Chat', aliases: ['chat', 'discord', 'discord chat', 'messages'] },
        { id: 'archives', label: 'Games', aliases: ['games', 'game', 'archives', 'game library', 'games library'] },
        { id: 'movies', label: 'Movies', aliases: ['movies', 'movie', 'films', 'film', 'movie library'] },
        { id: 'records', label: 'Records', aliases: ['records', 'stats', 'statistics'] },
        { id: 'settings', label: 'Settings', aliases: ['settings', 'preferences'] },
        { id: 'account', label: 'Profile', aliases: ['profile', 'account', 'my profile', 'my account'] },
        { id: 'changelog', label: 'Changelog', aliases: ['changelog', 'updates'] },
        { id: 'credits', label: 'Credits', aliases: ['credits'] }
    ];
    const normalize = value => String(value || '').toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');

    function resolve(input, catalogs = {}) {
        const text = String(input || '').trim();
        const command = text.match(/^(?:please\s+)?(?:can you\s+|could you\s+)?(open|launch|play|watch|go to|take me to|find|show me)\s+(.+?)\s*[?.!]*$/i);
        const question = text.match(/^(?:where (?:is|are|do i find|can i find)|how (?:do i|can i) (?:find|get to))\s+(.+?)\s*[?.!]*$/i);
        if (!command && !question) return null;
        const verb = command ? command[1].toLowerCase() : '';
        let target = normalize(command ? command[2] : question[1]).replace(/\s+please$/, '');
        if (!target || /^(how|why|what|when|whether)\b/.test(target)) return null;
        const pageTarget = target.replace(/^(?:the|a) /, '');
        const page = pages.find(item => item.aliases.includes(pageTarget));
        if (page) {
            const action = { type: 'page', id: page.id, label: page.label };
            return { text: question ? `You can find ${page.label} using the Flux navigation.` : `Opening ${page.label}.`, actions: [action], runNow: !!command && !['find', 'show me'].includes(verb) };
        }
        const kind = /^(?:the |a )?(game|movie|film)\s+/.exec(target);
        if (kind) target = target.slice(kind[0].length);
        const types = kind ? [kind[1] === 'game' ? 'game' : 'movie'] : verb === 'watch' ? ['movie'] : ['game', 'movie'];
        const choices = [];
        for (const type of types) {
            const list = type === 'game' ? catalogs.games : catalogs.movies;
            if (!Array.isArray(list)) continue;
            list.forEach((item, index) => {
                if (!item || typeof item.name !== 'string') return;
                const name = normalize(item.name);
                if (name === target || (target.length >= 3 && name.includes(target))) {
                    choices.push({ type, index, label: item.name, exact: name === target });
                }
            });
        }
        const exact = choices.filter(action => action.exact);
        const results = (exact.length ? exact : choices).slice(0, 6);
        if (!results.length) {
            if (!kind && !['play', 'watch', 'launch'].includes(verb)) return null;
            return { text: 'I couldn’t find that title in the Flux catalog. Check the spelling or browse Games or Movies.', actions: [], runNow: false };
        }
        const runNow = !!command && !['find', 'show me'].includes(verb) && results.length === 1 && results[0].exact;
        return {
            text: runNow ? `Opening ${results[0].label}.` : 'Choose a result to open it in Flux:',
            actions: results,
            runNow
        };
    }

    function execute(action, catalogs, site = global) {
        if (!action || !site) return false;
        if (action.type === 'page') {
            if (!pages.some(page => page.id === action.id) || typeof site.showPage !== 'function') return false;
            site.showPage(action.id);
            return true;
        }
        const list = action.type === 'game' ? catalogs.games : action.type === 'movie' ? catalogs.movies : null;
        const item = Array.isArray(list) && Number.isInteger(action.index) ? list[action.index] : null;
        if (!item || item.name !== action.label) return false;
        if (action.type === 'movie' && typeof site.openMovie === 'function' && item.url) {
            site.openMovie(item);
            return true;
        }
        if (action.type === 'game' && typeof site.openGame === 'function' && (item.url || item.file || item.link)) {
            site.openGame(item.url || item.file || item.link, item.name, item.description);
            return true;
        }
        return false;
    }

    const api = { resolve, execute };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    if (global) global.FluxAISite = api;
})(typeof window !== 'undefined' ? window : null);
