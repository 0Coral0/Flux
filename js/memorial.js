// ============================================
// 9/11 MEMORIAL WALL
// ============================================

const MEMORIAL_COLLECTION = 'memorial_entries';
let memorialClientId = localStorage.getItem('aggw_memorial_client_id');
if (!memorialClientId) {
    memorialClientId = (crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}`);
    localStorage.setItem('aggw_memorial_client_id', memorialClientId);
}

function escapeMemorialHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderMemorialEntries(entries) {
    const listEl = document.getElementById('memorial-entries-list');
    const countEl = document.getElementById('memorial-count');
    if (!listEl) return;

    if (countEl) {
        countEl.textContent = `${entries.length} ${entries.length === 1 ? 'name' : 'names'}`;
    }

    if (!entries.length) {
        listEl.innerHTML = '<p class="memorial-empty">No names yet. Be the first to honor someone.</p>';
        return;
    }

    listEl.innerHTML = entries.map(entry => {
        const canRemove = entry.clientId && entry.clientId === memorialClientId;
        return `
            <article class="memorial-entry" role="listitem" title="${escapeMemorialHtml(entry.note || entry.name)}">
                <span class="memorial-entry-name">${escapeMemorialHtml(entry.name)}</span>
                ${entry.note ? `<span class="memorial-entry-note">${escapeMemorialHtml(entry.note)}</span>` : ''}
                <div class="memorial-entry-actions">
                    ${canRemove ? `<button type="button" class="memorial-entry-remove" onclick="removeMemorialEntry('${entry.id}')" aria-label="Remove ${escapeMemorialHtml(entry.name)}">&times;</button>` : ''}
                    <button type="button" class="memorial-entry-report" onclick="reportMemorialEntry('${entry.id}')" aria-label="Report ${escapeMemorialHtml(entry.name)}" title="Report inappropriate content">
                        <i class="fa-solid fa-flag"></i>
                    </button>
                </div>
            </article>
        `;
    }).join('');
}

function subscribeMemorialWall() {
    return onSnapshot(collection(db, MEMORIAL_COLLECTION), (snapshot) => {
        const entries = snapshot.docs
            .map(docSnap => ({ id: docSnap.id, ...docSnap.data() }))
            .sort((a, b) => String(b.addedAt || '').localeCompare(String(a.addedAt || '')))
            .slice(0, 100);
        renderMemorialEntries(entries);
    }, (error) => {
        console.error('Memorial wall sync failed:', error);
        const listEl = document.getElementById('memorial-entries-list');
        if (listEl) {
            listEl.innerHTML = '<p class="memorial-empty">Unable to load memorial entries right now.</p>';
        }
    });
}

// ============================================
// AI CONTENT MODERATION SYSTEM
// ============================================

// Rate limiting to prevent spam
const rateLimitData = {
    lastSubmission: 0,
    submissionsInLastMinute: 0,
    resetInterval: null
};

function checkRateLimit() {
    const now = Date.now();
    const oneMinute = 60000;

    // Reset counter if minute has passed
    if (now - rateLimitData.lastSubmission > oneMinute) {
        rateLimitData.submissionsInLastMinute = 0;
    }

    // More lenient limit for memorial content (max 10 per minute)
    if (rateLimitData.submissionsInLastMinute >= 10) {
        return {
            allowed: false,
            reason: 'Too many submissions. Please wait a moment before trying again.'
        };
    }

    rateLimitData.lastSubmission = now;
    rateLimitData.submissionsInLastMinute++;
    return { allowed: true };
}

// Smart pattern detection for actual hate speech
function detectHateSpeechPatterns(text) {
    const lowerText = text.toLowerCase();
    
    // Detect actual racial slurs with common obfuscations
    const slurPatterns = [
        /n[i1!]+[gq]+[e3]+[rri]+[s5z]+/gi,
        /f[a4]+[gq]+[o0]+[t7]+/gi,
        /k[i1!]+[kq]+/gi,
        /sw[a4]+[s5]+[t7]+[i1!]+[kq]+[a4]+/gi,
        /h[o0]+[l1!]+[o0]+[c4]+[a4]+[u]+[s5]+[t7]+/gi,
        /g[e3]+[n]+[o0]+[c4]+[i1!]+[d]+[e3]+/gi,
    ];

    for (const pattern of slurPatterns) {
        if (pattern.test(lowerText)) {
            return true;
        }
    }

    // Detect hate speech patterns
    const hatePhrases = [
        /\b(all |every |these )+(people|folks|humans|ones)+\s+(should|must|need to|deserve to)\s+(die|be killed|be eliminated|go away)/gi,
        /\b(i hate|i despise|i loathe)\s+(all|every|these)\s+(people|folks|humans|ones)/gi,
        /\b(white power|black power|race war|ethnic cleansing)/gi,
        /\b(gas|kill|murder|shoot|lynch|hang)\s+(them|all|everyone|these people)/gi,
        /\b(sie heil|white pride|black pride|supremacist|neo.nazi)/gi,
    ];

    for (const phrase of hatePhrases) {
        if (phrase.test(lowerText)) {
            return true;
        }
    }

    return false;
}

// Detect actual threats or harmful content
function detectThreats(text) {
    const lowerText = text.toLowerCase();
    
    const threatPatterns = [
        /\b(i will|i'm going to|i plan to)\s+(kill|murder|hurt|harm|attack|shoot|bomb)/gi,
        /\b(destroy|eliminate|exterminate)\s+(all|everyone|them|these people)/gi,
        /\b(death to|kill all|murder all)\s+(them|everyone|these)/gi,
        /\b(make them (die|suffer|pay|burn))/gi,
    ];

    for (const pattern of threatPatterns) {
        if (pattern.test(lowerText)) {
            return true;
        }
    }

    return false;
}

// Detect spam/bot patterns
function detectSpamPatterns(text) {
    const repeatedChars = text.match(/(.)\1{8,}/g);
    if (repeatedChars && repeatedChars.length > 3) {
        return true;
    }

    const randomChars = text.match(/[a-z]{10,}/gi);
    if (randomChars && randomChars.some(str => !isReadableString(str))) {
        return true;
    }

    const urlCount = (text.match(/http[s]?:\/\/[^\s]+/g) || []).length;
    if (urlCount > 2) {
        return true;
    }

    return false;
}

function isReadableString(str) {
    if (/(.)\1{5,}/.test(str)) return false;
    const vowelCount = (str.match(/[aeiou]/gi) || []).length;
    return vowelCount / str.length > 0.2;
}

// Context-aware analysis for memorial content
function analyzeMemorialContext(text) {
    const lowerText = text.toLowerCase();
    
    const memorialPhrases = [
        /\b(rest in peace|rip|in loving memory|forever remembered|never forgotten)\b/gi,
        /\b(gone but not forgotten|always in our hearts|taken too soon)\b/gi,
        /\b(angel|hero|brave|innocent|victim|survivor)\b/gi,
        /\b(september 11|9/11|world trade center|pentagon|flight)\b/gi,
        /\b(firefighter|police|first responder|emergency services)\b/gi,
    ];

    for (const phrase of memorialPhrases) {
        if (phrase.test(lowerText)) {
            return { isMemorial: true, confidence: 0.8 };
        }
    }

    return { isMemorial: false, confidence: 0 };
}

async function moderateContent(text) {
    const rateLimit = checkRateLimit();
    if (!rateLimit.allowed) {
        return {
            flagged: true,
            reason: rateLimit.reason,
            category: 'rate_limit'
        };
    }

    if (detectHateSpeechPatterns(text)) {
        return {
            flagged: true,
            reason: 'This content contains hate speech and cannot be posted.',
            category: 'hate_speech'
        };
    }

    if (detectThreats(text)) {
        return {
            flagged: true,
            reason: 'This content contains threats and cannot be posted.',
            category: 'threat'
        };
    }

    if (detectSpamPatterns(text)) {
        return {
            flagged: true,
            reason: 'This appears to be spam or automated content.',
            category: 'spam'
        };
    }

    const context = analyzeMemorialContext(text);
    if (context.isMemorial && context.confidence > 0.7) {
        return {
            flagged: false,
            reason: null,
            category: null,
            context: 'memorial_content'
        };
    }

    if (text.length > 2000) {
        return {
            flagged: true,
            reason: 'Message is too long. Please keep it under 2000 characters.',
            category: 'length'
        };
    }

    return {
        flagged: false,
        reason: null,
        category: null
    };
}

function showModerationError(reason) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'moderation-error';
    errorDiv.innerHTML = `
        <div class="moderation-error-content">
            <i class="fa-solid fa-shield-halved"></i>
            <h3>Content Not Allowed</h3>
            <p>${reason}</p>
            <p class="moderation-subtext">This content violates our community guidelines and cannot be posted to the memorial wall.</p>
            <button onclick="this.parentElement.parentElement.remove()" class="action-btn">Got it</button>
        </div>
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.classList.add('show');
    }, 10);

    setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => errorDiv.remove(), 300);
    }, 5000);
}

// Add moderation error styles
const moderationStyles = `
    .moderation-error {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100000;
        opacity: 0;
        transition: opacity 0.3s ease;
    }
    
    .moderation-error.show {
        opacity: 1;
    }
    
    .moderation-error-content {
        background: var(--card);
        border: 1px solid var(--accent);
        border-radius: 16px;
        padding: 30px;
        max-width: 400px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5);
    }
    
    .moderation-error-content i {
        font-size: 3rem;
        color: var(--accent);
        margin-bottom: 15px;
    }
    
    .moderation-error-content h3 {
        color: var(--accent);
        margin: 0 0 10px 0;
        font-size: 1.3rem;
    }
    
    .moderation-error-content p {
        color: var(--text);
        margin: 10px 0;
        line-height: 1.5;
    }
    
    .moderation-subtext {
        font-size: 0.85rem;
        color: var(--text-dim) !important;
    }
    
    .moderation-error-content .action-btn {
        margin-top: 20px;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = moderationStyles;
document.head.appendChild(styleSheet);

window.addMemorialEntry = async function addMemorialEntry(event) {
    event.preventDefault();

    const nameInput = document.getElementById('memorial-name-input');
    const noteInput = document.getElementById('memorial-note-input');
    const name = nameInput?.value.trim();
    const note = noteInput?.value.trim();

    if (!name) return;

    const nameModeration = await moderateContent(name);
    if (nameModeration.flagged) {
        showModerationError(nameModeration.reason);
        return;
    }

    if (note) {
        const noteModeration = await moderateContent(note);
        if (noteModeration.flagged) {
            showModerationError(noteModeration.reason);
            return;
        }
    }

    try {
        await addDoc(collection(db, MEMORIAL_COLLECTION), {
            name,
            note: note || '',
            addedAt: new Date().toISOString(),
            clientId: memorialClientId,
            moderated: true,
            moderationStatus: 'approved'
        });

        if (nameInput) nameInput.value = '';
        if (noteInput) noteInput.value = '';
        if (typeof showToast === 'function') {
            showToast(`${name} added to the memorial wall`);
        }
    } catch (error) {
        console.error('Failed to add memorial entry:', error);
        alert('Could not add memorial entry. Please try again.');
    }
};

window.removeMemorialEntry = async function removeMemorialEntry(entryId) {
    try {
        const entryRef = doc(db, MEMORIAL_COLLECTION, entryId);
        const entrySnap = await getDoc(entryRef);
        if (!entrySnap.exists()) return;

        if (entrySnap.data().clientId !== memorialClientId) {
            alert('You can only remove entries you added from this device.');
            return;
        }

        await deleteDoc(entryRef);
    } catch (error) {
        console.error('Failed to remove memorial entry:', error);
        alert('Could not remove memorial entry.');
    }
};

window.reportMemorialEntry = async function reportMemorialEntry(entryId) {
    const reason = prompt('Please describe why this content is inappropriate:');
    if (!reason) return;

    try {
        await addDoc(collection(db, 'memorial_reports'), {
            entryId,
            reason,
            reportedAt: new Date().toISOString(),
            reporterId: memorialClientId
        });

        if (typeof showToast === 'function') {
            showToast('Content reported for review');
        }
    } catch (error) {
        console.error('Failed to report entry:', error);
        alert('Could not report content. Please try again.');
    }
};

// Initialize memorial wall
initializeMemorialWallVisibility();
subscribeMemorialWall();
setInterval(initializeMemorialWallVisibility, 60 * 1000);
