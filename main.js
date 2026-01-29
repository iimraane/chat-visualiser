// DOM Elements
const uploadScreen = document.getElementById('upload-screen');
const chatScreen = document.getElementById('chat-screen');
const fileInput = document.getElementById('file-input');
const mediaInput = document.getElementById('media-input');
const startBtn = document.getElementById('start-btn');
const chatFileName = document.getElementById('chat-file-name');
const mediaCountEl = document.getElementById('media-count');
const statusText = document.getElementById('status');
const chatArea = document.getElementById('chat-area');
const backBtn = document.getElementById('back-btn');
const settingsBtn = document.getElementById('settings-btn');
const settingsPanel = document.getElementById('settings-panel');
const closeSettings = document.getElementById('close-settings');
const themeBtn = document.getElementById('theme-btn');
const themeText = document.getElementById('theme-text');
const themeIcon = document.getElementById('theme-icon');
const viewpointSelect = document.getElementById('viewpoint-select');
const chatName = document.getElementById('chat-name');
const participantsInfo = document.getElementById('participants-info');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchResults = document.getElementById('search-results');
const searchCount = document.getElementById('search-count');
const searchPrev = document.getElementById('search-prev');
const searchNext = document.getElementById('search-next');
const floatingDate = document.getElementById('floating-date');
const chatBackground = document.getElementById('chat-background');
const bgInput = document.getElementById('bg-input');
const bgReset = document.getElementById('bg-reset');

// Love popup elements
const lovePopup = document.getElementById('love-popup');
const lovePopupEmoji = document.getElementById('love-popup-emoji');
const lovePopupText = document.getElementById('love-popup-text');
const lovePopupBtn = document.getElementById('love-popup-btn');
const renameSection = document.getElementById('rename-section');
const renameContainer = document.getElementById('rename-container');

// State
let chatText = '';
let allMessages = [];
let participants = [];
let currentUser = '';
let isDark = false;
let predefinedMediaMap = {};
let participantRenames = {};
let starredMessages = [];

// Virtual scroll - optimized
const ITEM_HEIGHT = 70;
const BUFFER = 30;
let visibleStart = 0;
let visibleEnd = 0;
let spacerTop, spacerBottom, contentContainer;
let scrollTicking = false;
let lastScrollTop = 0;

// Search
let searchMatches = [];
let currentMatchIndex = -1;
let searchTimeout = null;

// Media organized by date
let mediaByDate = {};
let mediaCounters = {};

// Floating date
let floatingDateTimeout = null;
let currentFloatingDate = '';

const senderColors = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#00acc1'];

// Initialize saved preferences
function initPreferences() {
    // Theme
    const savedTheme = localStorage.getItem('chat-theme');
    if (savedTheme === 'dark') {
        isDark = true;
        document.body.classList.add('dark');
        themeIcon.textContent = '☀️';
        themeText.textContent = 'Light Mode';
    }

    // Background
    const savedBg = localStorage.getItem('chat-background');
    if (savedBg) {
        chatBackground.style.backgroundImage = `url(${savedBg})`;
    }
}

initPreferences();

// File Upload
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        chatFileName.textContent = '✓ ' + file.name;
        file.text().then(text => {
            chatText = text;
            startBtn.disabled = false;
        });
    }
});

// Media Folder
mediaInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
        mediaCountEl.textContent = `✓ ${files.length} files`;
        indexMediaFiles(files);
    }
});

function indexMediaFiles(files) {
    mediaByDate = {};
    let counts = { photo: 0, video: 0, audio: 0, sticker: 0 };

    files.forEach(file => {
        const match = file.name.match(/^(\d+)-(PHOTO|VIDEO|AUDIO|STICKER)-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})/i);

        if (match) {
            const type = match[2].toLowerCase();
            const dateKey = match[3];
            const hour = parseInt(match[4]);
            const minute = parseInt(match[5]);
            const second = parseInt(match[6]);
            const timeInSeconds = hour * 3600 + minute * 60 + second;

            if (!mediaByDate[dateKey]) {
                mediaByDate[dateKey] = { photo: [], video: [], audio: [], sticker: [] };
            }

            mediaByDate[dateKey][type].push({
                file,
                timeInSeconds,
                hour,
                minute,
                second
            });
            counts[type]++;
        }
    });

    // Sort by filename (which includes timestamp)
    for (let date in mediaByDate) {
        for (let type in mediaByDate[date]) {
            mediaByDate[date][type].sort((a, b) => a.file.name.localeCompare(b.file.name));
        }
    }

    console.log('Media indexed:', counts);
}

function resetMediaCounters() {
    mediaCounters = {};
}

function getNextMedia(dateKey, type) {
    const key = dateKey + '-' + type;
    if (!mediaCounters[key]) mediaCounters[key] = 0;

    const dateMedia = mediaByDate[dateKey];
    if (!dateMedia || !dateMedia[type]) return null;

    const arr = dateMedia[type];
    if (mediaCounters[key] >= arr.length) return null;

    return arr[mediaCounters[key]++];
}

// Smart media matching - search nearby dates
function findNearbyMedia(dateKey, type, msgTime) {
    // First try exact date
    let media = getNextMedia(dateKey, type);
    if (media) return { media, uncertain: false };

    // Parse the dateKey to get a Date object
    const [year, month, day] = dateKey.split('-').map(Number);
    const baseDate = new Date(year, month - 1, day);

    // Try adjacent dates (±1 day)
    for (let offset of [-1, 1]) {
        const nearDate = new Date(baseDate);
        nearDate.setDate(nearDate.getDate() + offset);
        const nearKey = nearDate.toISOString().split('T')[0];

        const nearMedia = mediaByDate[nearKey];
        if (nearMedia && nearMedia[type] && nearMedia[type].length > 0) {
            // Find closest by time if possible
            const msgTimeSeconds = parseTimeToSeconds(msgTime);
            let bestMatch = null;
            let bestDiff = Infinity;

            for (const m of nearMedia[type]) {
                const diff = Math.abs(m.timeInSeconds - msgTimeSeconds);
                if (diff < bestDiff) {
                    bestDiff = diff;
                    bestMatch = m;
                }
            }

            if (bestMatch) {
                // Remove from array to avoid reuse
                const idx = nearMedia[type].indexOf(bestMatch);
                if (idx > -1) nearMedia[type].splice(idx, 1);
                return { media: bestMatch, uncertain: true };
            }
        }
    }

    return null;
}

function parseTimeToSeconds(timeStr) {
    const match = timeStr.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*(AM|PM))?/i);
    if (!match) return 12 * 3600; // Default to noon

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const seconds = parseInt(match[3]) || 0;
    const period = match[4];

    if (period) {
        if (period.toUpperCase() === 'PM' && hours !== 12) hours += 12;
        if (period.toUpperCase() === 'AM' && hours === 12) hours = 0;
    }

    return hours * 3600 + minutes * 60 + seconds;
}

function convertDateToKey(dateStr) {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return null;

    let [day, month, year] = parts;
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');
    if (year.length === 2) year = '20' + year;

    return `${year}-${month}-${day}`;
}

// Start button
startBtn.addEventListener('click', () => {
    if (!chatText) return;
    statusText.textContent = 'Parsing...';

    setTimeout(() => {
        parseMessages(chatText);
        if (allMessages.length === 0) {
            statusText.textContent = 'No messages found.';
            return;
        }

        assignMediaToMessages();
        currentUser = participants[0] || '';
        updateParticipantsList();
        setupRenameInputs();

        uploadScreen.classList.remove('active');
        chatScreen.classList.add('active');

        // Check if this is a chat between Imrane and Habhoub
        checkForSpecialChat();

        setupVirtualScroll();
        requestAnimationFrame(() => updateVirtualScroll());
    }, 50);
});

// Detect if chat is between Imrane and Habhoub
function checkForSpecialChat() {
    const participantNames = participants.map(p => p.toLowerCase());
    const isImraneHabhoub = participantNames.some(p => p.includes('imrane') || p.includes('imran')) &&
        participantNames.some(p => p.includes('habhoub') || p.includes('habib') || p.includes('houb'));

    if (isImraneHabhoub && lovePopup) {
        // Show love popup after a short delay
        setTimeout(() => showLovePopup('💕', 'Bienvenue dans votre chat secret ! 💖'), 1500);
    }
}

// Show love popup with message
function showLovePopup(emoji, message) {
    if (!lovePopup) return;

    if (lovePopupEmoji) lovePopupEmoji.textContent = emoji;
    if (lovePopupText) lovePopupText.textContent = message;
    lovePopup.classList.remove('hidden');
}

if (lovePopupBtn) {
    lovePopupBtn.addEventListener('click', () => {
        lovePopup.classList.add('hidden');
    });
}

// Parse messages
function parseMessages(text) {
    allMessages = [];
    participants = [];
    const participantSet = new Set();

    const patterns = [
        /^\[(\d{1,2}\/\d{1,2}\/\d{2,4}),\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]\s*([^:]+):\s*(.*)$/,
        /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*-\s*([^:]+):\s*(.*)$/,
        /^[\u200e\u200f]*\[?(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s*(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]?\s*[-–]?\s*([^:]+):\s*(.*)$/
    ];

    const lines = text.split('\n');
    let currentMessage = null;

    for (let line of lines) {
        line = line.replace(/[\u200e\u200f\u202a\u202c]/g, '').trim();
        if (!line) continue;

        let match = null;
        for (let p of patterns) {
            match = line.match(p);
            if (match) break;
        }

        if (match) {
            if (currentMessage) allMessages.push(currentMessage);
            const sender = match[3].trim();
            participantSet.add(sender);
            let msgText = match[4].replace(/<Ce message a été modifié>/g, '').trim();
            currentMessage = { date: match[1], time: match[2], sender, text: msgText, media: null, mediaUncertain: false };
        } else if (currentMessage) {
            let clean = line.replace(/<Ce message a été modifié>/g, '').trim();
            if (clean) currentMessage.text += '\n' + clean;
        }
    }
    if (currentMessage) allMessages.push(currentMessage);
    participants = Array.from(participantSet);
    console.log('Parsed messages:', allMessages.length);
}

function detectMediaType(text) {
    const t = text.toLowerCase();
    if (t.includes('image') || t.includes('photo')) return 'photo';
    if (t.includes('vidéo') || t.includes('video')) return 'video';
    if (t.includes('audio') || t.includes('vocal') || t.includes('ptt') || t.includes('message vocal') || t.includes('voice message') || t.includes('.opus')) return 'audio';
    if (t.includes('sticker') || t.includes('gif animé')) return 'sticker';
    return null;
}

function assignMediaToMessages() {
    resetMediaCounters();

    allMessages.forEach((msg, i) => {
        const isOmitted = /omis|omitted|absente?|<media|<média/i.test(msg.text);
        if (isOmitted) {
            const dateKey = convertDateToKey(msg.date);
            const mediaType = detectMediaType(msg.text);

            if (dateKey && mediaType) {
                // First try exact match
                const exactMedia = getNextMedia(dateKey, mediaType);
                if (exactMedia) {
                    msg.media = exactMedia.file;
                    msg.mediaUrl = URL.createObjectURL(exactMedia.file);
                    msg.mediaUncertain = false;
                } else {
                    // Try smart matching
                    const result = findNearbyMedia(dateKey, mediaType, msg.time);
                    if (result) {
                        msg.media = result.media.file;
                        msg.mediaUrl = URL.createObjectURL(result.media.file);
                        msg.mediaUncertain = result.uncertain;
                    }
                }
            }
        }
    });
}

// Setup virtual scroll containers
function setupVirtualScroll() {
    chatArea.innerHTML = `
        <div id="spacer-top"></div>
        <div id="content-container"></div>
        <div id="spacer-bottom"></div>
    `;
    spacerTop = document.getElementById('spacer-top');
    spacerBottom = document.getElementById('spacer-bottom');
    contentContainer = document.getElementById('content-container');
    visibleStart = -1;
    visibleEnd = -1;
}

// Smooth scroll update with momentum preservation
function updateVirtualScroll() {
    if (!contentContainer) return;

    const scrollTop = chatArea.scrollTop;
    const viewportHeight = chatArea.clientHeight;

    const newStart = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER);
    const newEnd = Math.min(allMessages.length, Math.ceil((scrollTop + viewportHeight) / ITEM_HEIGHT) + BUFFER);

    // Only re-render if range changed
    if (newStart === visibleStart && newEnd === visibleEnd) return;

    visibleStart = newStart;
    visibleEnd = newEnd;

    spacerTop.style.height = (visibleStart * ITEM_HEIGHT) + 'px';
    spacerBottom.style.height = ((allMessages.length - visibleEnd) * ITEM_HEIGHT) + 'px';

    renderVisibleMessages();
    updateFloatingDate();
    lastScrollTop = scrollTop;
}

function createMessageElement(msg, i) {
    const div = document.createElement('div');
    div.className = 'message ' + (msg.sender === currentUser ? 'outgoing' : 'incoming');
    div.dataset.index = i;

    // Sender name (with rename support)
    if (msg.sender !== currentUser) {
        const s = document.createElement('div');
        s.className = 'message-sender';
        s.textContent = getDisplayName(msg.sender);
        s.style.color = senderColors[participants.indexOf(msg.sender) % senderColors.length];
        div.appendChild(s);
    }

    // Content
    if (msg.media) {
        const ext = msg.media.name.split('.').pop().toLowerCase();
        const url = msg.mediaUrl || URL.createObjectURL(msg.media);

        // Create wrapper for consistent sizing (prevents layout shift)
        const wrapper = document.createElement('div');
        wrapper.className = 'media-wrapper';

        if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
            const img = document.createElement('img');
            img.src = url;
            img.loading = 'lazy';
            img.decoding = 'async';
            wrapper.appendChild(img);
            div.appendChild(wrapper);
        } else if (ext === 'webp') {
            wrapper.className = 'media-wrapper sticker-wrapper';
            const img = document.createElement('img');
            img.src = url;
            img.className = 'sticker';
            img.loading = 'lazy';
            img.decoding = 'async';
            wrapper.appendChild(img);
            div.appendChild(wrapper);
        } else if (['mp4', 'mov', '3gp', 'avi'].includes(ext)) {
            wrapper.className = 'media-wrapper video-wrapper';
            const video = document.createElement('video');
            video.src = url;
            video.controls = true;
            video.preload = 'metadata';
            wrapper.appendChild(video);
            div.appendChild(wrapper);
        } else if (['opus', 'mp3', 'm4a', 'ogg', 'aac', 'wav'].includes(ext)) {
            wrapper.className = 'media-wrapper audio-wrapper';
            const audio = document.createElement('audio');
            audio.src = url;
            audio.controls = true;
            wrapper.appendChild(audio);
            div.appendChild(wrapper);
        } else {
            const p = document.createElement('div');
            p.className = 'media-placeholder';
            p.textContent = '📎 ' + msg.media.name;
            div.appendChild(p);
        }

        // Add uncertainty badge if needed
        if (msg.mediaUncertain) {
            const badge = document.createElement('div');
            badge.className = 'media-uncertain-badge';
            badge.innerHTML = '⚠️ Approximatif';
            div.appendChild(badge);
        }
    } else if (/omis|omitted|absente?|<média|<media/i.test(msg.text)) {
        // Media not found - with debug button
        const container = document.createElement('div');
        container.className = 'media-placeholder-container';

        const p = document.createElement('div');
        p.className = 'media-placeholder';
        p.textContent = '📎 Media not found';
        container.appendChild(p);

        const debugBtn = document.createElement('button');
        debugBtn.className = 'debug-btn';
        debugBtn.textContent = '🔍 Debug';
        debugBtn.onclick = (e) => {
            e.stopPropagation();
            showMediaDebug(msg, i);
        };
        container.appendChild(debugBtn);

        div.appendChild(container);
    } else {
        const span = document.createElement('span');
        span.textContent = msg.text;
        div.appendChild(span);
    }

    // Time
    const time = document.createElement('span');
    time.className = 'message-time';
    time.textContent = msg.time.substring(0, 5);
    div.appendChild(time);

    // Star badge if starred
    if (isMessageStarred(i)) {
        const star = document.createElement('span');
        star.className = 'message-star';
        star.textContent = '⭐';
        div.appendChild(star);
    }

    return div;
}

function renderVisibleMessages() {
    const fragment = document.createDocumentFragment();
    let lastDate = visibleStart > 0 ? allMessages[visibleStart - 1].date : null;

    for (let i = visibleStart; i < visibleEnd; i++) {
        const msg = allMessages[i];

        // Date bubble
        if (msg.date !== lastDate) {
            const dateBubble = document.createElement('div');
            dateBubble.className = 'date-bubble';
            dateBubble.textContent = msg.date;
            fragment.appendChild(dateBubble);
            lastDate = msg.date;
        }

        fragment.appendChild(createMessageElement(msg, i));
    }

    contentContainer.innerHTML = '';
    contentContainer.appendChild(fragment);
}

// Floating date pill
function updateFloatingDate() {
    if (visibleStart < 0 || visibleStart >= allMessages.length) return;

    const currentDate = allMessages[visibleStart].date;

    if (currentDate !== currentFloatingDate) {
        currentFloatingDate = currentDate;
        floatingDate.textContent = currentDate;
    }

    // Show the pill
    floatingDate.classList.add('visible');

    // Hide after 1.5 seconds of no scrolling
    clearTimeout(floatingDateTimeout);
    floatingDateTimeout = setTimeout(() => {
        floatingDate.classList.remove('visible');
    }, 1500);
}

// Passive scroll listener for smooth native scrolling
chatArea.addEventListener('scroll', () => {
    if (!scrollTicking) {
        requestAnimationFrame(() => {
            updateVirtualScroll();
            scrollTicking = false;
        });
        scrollTicking = true;
    }
}, { passive: true });

// Search
searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    searchClear.classList.toggle('hidden', !query);

    if (!query) {
        searchResults.classList.add('hidden');
        searchMatches = [];
        return;
    }

    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => performSearch(query), 300);
});

function performSearch(query) {
    searchMatches = [];
    for (let i = 0; i < allMessages.length; i++) {
        const msg = allMessages[i];
        if (msg.text.toLowerCase().includes(query) || msg.date.includes(query)) {
            searchMatches.push(i);
        }
    }

    searchCount.textContent = `${searchMatches.length} results`;
    searchResults.classList.toggle('hidden', searchMatches.length === 0);

    if (searchMatches.length > 0) {
        currentMatchIndex = 0;
        goToMatch(0);
    }
}

function goToMatch(idx) {
    const msgIndex = searchMatches[idx];

    // Calculate scroll position to center the message
    const scrollPosition = Math.max(0, msgIndex * ITEM_HEIGHT - chatArea.clientHeight / 2 + ITEM_HEIGHT / 2);
    chatArea.scrollTop = scrollPosition;

    // Wait for render then highlight and scroll into view
    requestAnimationFrame(() => {
        updateVirtualScroll();
        setTimeout(() => {
            const el = contentContainer.querySelector(`[data-index="${msgIndex}"]`);
            if (el) {
                // Scroll element to center of viewport
                el.scrollIntoView({ block: 'center', behavior: 'auto' });

                // Add highlight with delay for visual effect
                setTimeout(() => {
                    el.classList.add('highlight');
                    setTimeout(() => el.classList.remove('highlight'), 1500);
                }, 100);
            }
        }, 50);
    });

    searchCount.textContent = `${idx + 1} / ${searchMatches.length}`;
}

searchClear.addEventListener('click', () => {
    searchInput.value = '';
    searchClear.classList.add('hidden');
    searchResults.classList.add('hidden');
});

searchPrev.addEventListener('click', () => {
    if (!searchMatches.length) return;
    currentMatchIndex = (currentMatchIndex - 1 + searchMatches.length) % searchMatches.length;
    goToMatch(currentMatchIndex);
});

searchNext.addEventListener('click', () => {
    if (!searchMatches.length) return;
    currentMatchIndex = (currentMatchIndex + 1) % searchMatches.length;
    goToMatch(currentMatchIndex);
});

// UI helpers
function updateParticipantsList() {
    viewpointSelect.innerHTML = '<option value="">Select...</option>';
    participants.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.textContent = p;
        if (p === currentUser) opt.selected = true;
        viewpointSelect.appendChild(opt);
    });
    participantsInfo.textContent = participants.join(', ');
    chatName.textContent = `Chat (${participants.length})`;
}

viewpointSelect.addEventListener('change', (e) => {
    currentUser = e.target.value;
    visibleStart = visibleEnd = 0;
    updateVirtualScroll();
});

themeBtn.addEventListener('click', () => {
    isDark = !isDark;
    document.body.classList.toggle('dark', isDark);
    themeIcon.textContent = isDark ? '☀️' : '🌙';
    themeText.textContent = isDark ? 'Light Mode' : 'Dark Mode';
    localStorage.setItem('chat-theme', isDark ? 'dark' : 'light');
});

settingsBtn.addEventListener('click', () => settingsPanel.classList.add('open'));
closeSettings.addEventListener('click', () => settingsPanel.classList.remove('open'));

// Background image handling
bgInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            const dataUrl = event.target.result;
            chatBackground.style.backgroundImage = `url(${dataUrl})`;
            localStorage.setItem('chat-background', dataUrl);
        };
        reader.readAsDataURL(file);
    }
});

bgReset.addEventListener('click', () => {
    chatBackground.style.backgroundImage = '';
    localStorage.removeItem('chat-background');
});

backBtn.addEventListener('click', () => {
    chatScreen.classList.remove('active');
    uploadScreen.classList.add('active');
    allMessages = [];
    if (contentContainer) contentContainer.innerHTML = '';
    fileInput.value = '';
    mediaInput.value = '';
    chatFileName.textContent = '';
    mediaCountEl.textContent = '';
    startBtn.disabled = true;
    chatText = '';
    searchInput.value = '';
    floatingDate.classList.remove('visible');

    // Show predefined button again
    predefinedBtn.style.display = 'block';
});

// Debug function for media not found
function showMediaDebug(msg, index) {
    const dateKey = convertDateToKey(msg.date);
    const detectedType = detectMediaType(msg.text);
    const availableMedia = mediaByDate[dateKey] || {};

    let debugInfo = `📋 DEBUG INFO - Message #${index}\n\n`;
    debugInfo += `📅 Date: ${msg.date}\n`;
    debugInfo += `🔑 Date Key: ${dateKey || 'INVALID'}\n`;
    debugInfo += `⏰ Time: ${msg.time}\n`;
    debugInfo += `👤 Sender: ${msg.sender}\n`;
    debugInfo += `📝 Original text: "${msg.text}"\n\n`;
    debugInfo += `🎯 Detected media type: ${detectedType || 'NONE DETECTED'}\n\n`;

    if (dateKey && availableMedia) {
        debugInfo += `📁 Available media for ${dateKey}:\n`;
        debugInfo += `   • Photos: ${availableMedia.photo?.length || 0}\n`;
        debugInfo += `   • Videos: ${availableMedia.video?.length || 0}\n`;
        debugInfo += `   • Audio: ${availableMedia.audio?.length || 0}\n`;
        debugInfo += `   • Stickers: ${availableMedia.sticker?.length || 0}\n\n`;

        if (detectedType && availableMedia[detectedType]?.length > 0) {
            debugInfo += `📌 First 3 ${detectedType} files for this date:\n`;
            availableMedia[detectedType].slice(0, 3).forEach((m, i) => {
                debugInfo += `   ${i + 1}. ${m.file.name}\n`;
            });
        }
    } else {
        debugInfo += `❌ No media indexed for this date\n`;
    }

    // Check adjacent dates
    if (dateKey) {
        const [year, month, day] = dateKey.split('-').map(Number);
        const baseDate = new Date(year, month - 1, day);

        debugInfo += `\n📆 Checking adjacent dates:\n`;
        for (let offset of [-1, 1]) {
            const nearDate = new Date(baseDate);
            nearDate.setDate(nearDate.getDate() + offset);
            const nearKey = nearDate.toISOString().split('T')[0];
            const nearMedia = mediaByDate[nearKey];

            if (nearMedia && detectedType && nearMedia[detectedType]?.length > 0) {
                debugInfo += `   ${nearKey}: ${nearMedia[detectedType].length} ${detectedType}(s) available\n`;
            }
        }
    }

    debugInfo += `\n💡 Possible issues:\n`;
    if (!dateKey) {
        debugInfo += `   • Date format not recognized\n`;
    }
    if (!detectedType) {
        debugInfo += `   • Media type could not be detected from message text\n`;
    }
    if (dateKey && !availableMedia[detectedType]?.length) {
        debugInfo += `   • No ${detectedType || 'matching'} files found for this date\n`;
    }
    if (dateKey && detectedType && availableMedia[detectedType]?.length) {
        debugInfo += `   • Media counter may have exceeded available files\n`;
    }

    alert(debugInfo);
}

// ========== PREDEFINED CHAT SYSTEM ==========

const PREDEFINED_PASSWORD = 'patate douche';
const FIRST_DAY_DATE = '06/10/25';

// Load participant renames from localStorage
function loadRenames() {
    const saved = localStorage.getItem('chat-renames');
    if (saved) {
        participantRenames = JSON.parse(saved);
    }
}

function saveRenames() {
    localStorage.setItem('chat-renames', JSON.stringify(participantRenames));
}

// Show rename inputs in settings
function setupRenameInputs() {
    if (!participants.length) return;

    renameSection.style.display = 'block';
    renameContainer.innerHTML = '';

    participants.forEach(p => {
        const row = document.createElement('div');
        row.className = 'rename-row';

        const label = document.createElement('span');
        label.className = 'rename-original';
        label.textContent = p;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'rename-input';
        input.placeholder = p;
        input.value = participantRenames[p] || '';
        input.addEventListener('input', (e) => {
            const newName = e.target.value.trim();
            if (newName) {
                participantRenames[p] = newName;
            } else {
                delete participantRenames[p];
            }
            saveRenames();
            // Re-render visible messages
            if (visibleStart >= 0) {
                renderVisibleMessages();
            }
        });

        row.appendChild(label);
        row.appendChild(input);
        renameContainer.appendChild(row);
    });
}

// Get display name for participant
function getDisplayName(sender) {
    return participantRenames[sender] || sender;
}

// Password modal handlers
predefinedBtn.addEventListener('click', () => {
    passwordModal.classList.remove('hidden');
    passwordInput.value = '';
    passwordError.classList.add('hidden');
    passwordInput.focus();
});

// Close button handler
document.getElementById('password-close')?.addEventListener('click', () => {
    passwordModal.classList.add('hidden');
});

passwordModal.addEventListener('click', (e) => {
    if (e.target === passwordModal) {
        passwordModal.classList.add('hidden');
    }
});

passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        validatePassword();
    }
});

passwordSubmit.addEventListener('click', validatePassword);

async function validatePassword() {
    const pwd = passwordInput.value.trim();

    if (pwd === PREDEFINED_PASSWORD) {
        // Success! Heart confetti
        launchHeartConfetti();
        passwordModal.classList.add('hidden');

        // Check if we have cached data
        const hasCached = await hasCachedPredefinedChat();
        if (hasCached) {
            loadCachedPredefinedChat();
        } else {
            showLoadingModal();
        }
    } else {
        // Wrong password - broken hearts
        launchBrokenHeartConfetti();
        passwordError.classList.remove('hidden');
        passwordInput.value = '';
        passwordInput.focus();
    }
}

// ========== INDEXEDDB CACHE SYSTEM ==========

const DB_NAME = 'ChatVisualizerCache';
const DB_VERSION = 1;
const STORE_CHAT = 'chatData';
const STORE_MEDIA = 'mediaFiles';

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;

            if (!db.objectStoreNames.contains(STORE_CHAT)) {
                db.createObjectStore(STORE_CHAT, { keyPath: 'id' });
            }
            if (!db.objectStoreNames.contains(STORE_MEDIA)) {
                db.createObjectStore(STORE_MEDIA, { keyPath: 'name' });
            }
        };
    });
}

async function hasCachedPredefinedChat() {
    try {
        const db = await openDatabase();
        return new Promise((resolve) => {
            const tx = db.transaction(STORE_CHAT, 'readonly');
            const store = tx.objectStore(STORE_CHAT);
            const request = store.get('predefined-chat');

            request.onsuccess = () => resolve(!!request.result);
            request.onerror = () => resolve(false);
        });
    } catch (e) {
        return false;
    }
}

async function saveChatToCache(chatContent) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CHAT, 'readwrite');
        const store = tx.objectStore(STORE_CHAT);
        store.put({ id: 'predefined-chat', content: chatContent });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function saveMediaToCache(name, blob) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readwrite');
        const store = tx.objectStore(STORE_MEDIA);
        store.put({ name, blob });
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
    });
}

async function getChatFromCache() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_CHAT, 'readonly');
        const store = tx.objectStore(STORE_CHAT);
        const request = store.get('predefined-chat');

        request.onsuccess = () => resolve(request.result?.content || null);
        request.onerror = () => reject(request.error);
    });
}

async function getMediaFromCache(name) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readonly');
        const store = tx.objectStore(STORE_MEDIA);
        const request = store.get(name);

        request.onsuccess = () => resolve(request.result?.blob || null);
        request.onerror = () => reject(request.error);
    });
}

async function getAllMediaFromCache() {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_MEDIA, 'readonly');
        const store = tx.objectStore(STORE_MEDIA);
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

// ========== GOOGLE DRIVE DIRECT STREAMING ==========

// Store the media file list for URL generation
let driveMediaFiles = [];

function showLoadingModal() {
    const modal = document.createElement('div');
    modal.id = 'loading-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 380px;">
            <div class="modal-emoji" id="loading-emoji">�</div>
            <h2 id="loading-title">Chargement...</h2>
            <p id="loading-message">Connexion à la discussion secrète...</p>
            <div class="loading-spinner" style="margin: 20px auto; width: 40px; height: 40px; border: 3px solid var(--bg-secondary); border-top-color: #ff6b8a; border-radius: 50%; animation: spin 1s linear infinite;"></div>
            <p id="loading-status" style="font-size: 13px; color: var(--text-secondary);"></p>
        </div>
    `;

    // Add spinner animation
    if (!document.getElementById('spinner-styles')) {
        const style = document.createElement('style');
        style.id = 'spinner-styles';
        style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`;
        document.head.appendChild(style);
    }

    document.body.appendChild(modal);
    loadFromGoogleDrive();
}

async function loadFromGoogleDrive() {
    const statusEl = document.getElementById('loading-status');
    const emojiEl = document.getElementById('loading-emoji');
    const titleEl = document.getElementById('loading-title');
    const messageEl = document.getElementById('loading-message');

    try {
        // Step 1: Get file list from Google Drive
        statusEl.textContent = '📋 Récupération des fichiers...';

        const listResponse = await fetch('/.netlify/functions/download-drive?action=list');
        if (!listResponse.ok) {
            throw new Error('Impossible de se connecter à Google Drive');
        }

        const fileList = await listResponse.json();

        if (!fileList.success || !fileList.chat) {
            throw new Error('Fichier chat non trouvé dans le dossier');
        }

        // Store media files for later URL generation
        driveMediaFiles = fileList.media || [];
        console.log(`Found ${driveMediaFiles.length} media files`);

        // Step 2: Load chat content
        statusEl.textContent = '💬 Chargement de la conversation...';

        const chatResponse = await fetch('/.netlify/functions/download-drive?action=chat');
        if (!chatResponse.ok) {
            throw new Error('Erreur chargement du chat');
        }

        const chatContent = await chatResponse.text();

        // Close modal
        document.getElementById('loading-modal')?.remove();

        // Load the chat directly (no caching)
        loadPredefinedChatDirect(chatContent);

    } catch (error) {
        console.error('Loading error:', error);

        emojiEl.textContent = '❌';
        titleEl.textContent = 'Erreur';
        messageEl.textContent = error.message;
        statusEl.innerHTML = `
            <button id="retry-load" class="modal-btn" style="margin-top: 10px;">🔄 Réessayer</button>
            <button id="manual-upload" class="modal-btn" style="margin-top: 10px; background: var(--bg-secondary); color: var(--text-primary);">📁 Upload manuel</button>
        `;

        document.getElementById('retry-load')?.addEventListener('click', () => {
            emojiEl.textContent = '💕';
            titleEl.textContent = 'Chargement...';
            messageEl.textContent = 'Nouvelle tentative...';
            statusEl.innerHTML = '<div class="loading-spinner" style="margin: 10px auto; width: 30px; height: 30px; border: 3px solid var(--bg-secondary); border-top-color: #ff6b8a; border-radius: 50%; animation: spin 1s linear infinite;"></div>';
            loadFromGoogleDrive();
        });

        document.getElementById('manual-upload')?.addEventListener('click', () => {
            document.getElementById('loading-modal')?.remove();
            showManualUploadModal();
        });
    }
}

// Load predefined chat directly without caching
function loadPredefinedChatDirect(chatContent) {
    uploadScreen.classList.remove('active');
    chatScreen.classList.add('active');
    predefinedBtn.style.display = 'none';

    chatText = chatContent;
    isPredefinedChat = true;

    // Parse messages
    parseMessages(chatText);

    if (allMessages.length === 0) {
        statusText.textContent = 'No messages found.';
        return;
    }

    // Index Google Drive media files for matching
    indexDriveMedia(driveMediaFiles);

    // Assign media to messages with streaming URLs
    assignDriveMediaToMessages();

    currentUser = participants[0] || '';
    updateParticipantsList();
    loadRenames();
    setupRenameInputs();

    setupVirtualScroll();
    requestAnimationFrame(() => updateVirtualScroll());

    // Start love popup timers
    startLovePopupTimers();
    setupFirstDayWatcher();
}

// Index Google Drive media files by date and type
function indexDriveMedia(files) {
    mediaByDate = {};

    files.forEach(file => {
        const match = file.name.match(/^(\d+)-(PHOTO|VIDEO|AUDIO|STICKER)-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})/i);

        if (match) {
            const type = match[2].toLowerCase();
            const dateKey = match[3];
            const hour = parseInt(match[4]);
            const minute = parseInt(match[5]);
            const second = parseInt(match[6]);
            const timeInSeconds = hour * 3600 + minute * 60 + second;

            if (!mediaByDate[dateKey]) {
                mediaByDate[dateKey] = { photo: [], video: [], audio: [], sticker: [] };
            }

            mediaByDate[dateKey][type].push({
                file: { name: file.name }, // Fake file object for compatibility
                fileId: file.id,
                fileName: file.name,
                timeInSeconds,
                hour, minute, second
            });
        }
    });

    // Sort by filename
    for (let date in mediaByDate) {
        for (let type in mediaByDate[date]) {
            mediaByDate[date][type].sort((a, b) => a.fileName.localeCompare(b.fileName));
        }
    }

    console.log('Media indexed from Google Drive:', Object.keys(mediaByDate).length, 'dates');
}

// Assign media to messages using streaming URLs
function assignDriveMediaToMessages() {
    resetMediaCounters();

    allMessages.forEach((msg) => {
        const isOmitted = /omis|omitted|absente?|<media|<média/i.test(msg.text);
        if (isOmitted) {
            const dateKey = convertDateToKey(msg.date);
            const mediaType = detectMediaType(msg.text);

            if (dateKey && mediaType) {
                const media = getNextMedia(dateKey, mediaType);
                if (media) {
                    // Create streaming URL
                    msg.media = media.file;
                    msg.mediaUrl = `/.netlify/functions/download-drive?action=media&fileName=${encodeURIComponent(media.fileName)}`;
                    msg.mediaUncertain = false;
                }
            }
        }
    });
}

// Fallback manual upload modal
function showManualUploadModal() {
    const modal = document.createElement('div');
    modal.id = 'upload-predefined-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 480px;">
            <div class="modal-emoji">📁</div>
            <h2>Upload manuel</h2>
            <p>Télécharge les fichiers depuis Google Drive et sélectionne-les ici.</p>
            
            <a href="https://drive.google.com/drive/folders/1eBlTsDxnTwpM7BNABTgnVDdQ-blksoPw?usp=sharing" 
               target="_blank" 
               class="modal-btn" 
               style="display: inline-block; margin: 10px 0; text-decoration: none;">
                📂 Ouvrir Google Drive
            </a>
            
            <div style="margin: 20px 0; padding: 15px; background: var(--bg-secondary); border-radius: 12px;">
                <p style="margin: 0 0 10px 0; font-size: 13px;">1. Fichier chat (.txt)</p>
                <input type="file" id="predefined-chat-file" accept=".txt" style="width: 100%;">
                
                <p style="margin: 15px 0 10px 0; font-size: 13px;">2. Dossier média (optionnel)</p>
                <input type="file" id="predefined-media-files" multiple style="width: 100%;">
            </div>
            
            <button id="install-predefined-btn" class="modal-btn">💾 Installer</button>
            <p id="install-status" style="margin-top: 10px; font-size: 12px; color: var(--text-secondary);"></p>
        </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('install-predefined-btn').addEventListener('click', installPredefinedData);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

async function installPredefinedData() {
    const chatFileInput = document.getElementById('predefined-chat-file');
    const mediaFilesInput = document.getElementById('predefined-media-files');
    const statusEl = document.getElementById('install-status');

    const chatFile = chatFileInput.files[0];
    if (!chatFile) {
        statusEl.textContent = '❌ Sélectionne le fichier chat .txt';
        return;
    }

    statusEl.textContent = '⏳ Installation en cours...';

    try {
        // Save chat file
        const chatContent = await chatFile.text();
        await saveChatToCache(chatContent);

        // Save media files
        const mediaFiles = Array.from(mediaFilesInput.files || []);
        let mediaCount = 0;

        for (const file of mediaFiles) {
            statusEl.textContent = `⏳ Média ${++mediaCount}/${mediaFiles.length}...`;
            await saveMediaToCache(file.name, file);
        }

        statusEl.textContent = '✅ Installation terminée !';

        // Close modal and load chat
        setTimeout(() => {
            document.getElementById('upload-predefined-modal').remove();
            loadCachedPredefinedChat();
        }, 500);

    } catch (error) {
        console.error('Installation error:', error);
        statusEl.textContent = '❌ Erreur: ' + error.message;
    }
}

// ========== LOAD CACHED CHAT ==========

async function loadCachedPredefinedChat() {
    statusText.textContent = 'Chargement du chat...';
    uploadScreen.classList.remove('active');
    chatScreen.classList.add('active');

    // Hide the predefined button
    predefinedBtn.style.display = 'none';

    try {
        // Get chat from cache
        const cachedChat = await getChatFromCache();
        if (!cachedChat) {
            throw new Error('Chat non trouvé dans le cache');
        }

        chatText = cachedChat;
        isPredefinedChat = true;

        // Parse messages
        parseMessages(chatText);

        if (allMessages.length === 0) {
            statusText.textContent = 'No messages found.';
            return;
        }

        // Load cached media
        const cachedMedia = await getAllMediaFromCache();
        indexCachedMedia(cachedMedia);

        // Assign media to messages
        assignMediaToMessages();

        currentUser = participants[0] || '';
        updateParticipantsList();
        loadRenames();
        setupRenameInputs();

        setupVirtualScroll();
        requestAnimationFrame(() => updateVirtualScroll());

        // Start love popup timers
        startLovePopupTimers();

        // Watch for first day date
        setupFirstDayWatcher();

    } catch (error) {
        console.error('Error loading cached chat:', error);
        statusText.textContent = 'Erreur de chargement';
        chatScreen.classList.remove('active');
        uploadScreen.classList.add('active');
        predefinedBtn.style.display = 'block';
    }
}

// Index cached media files
function indexCachedMedia(mediaFiles) {
    mediaByDate = {};

    mediaFiles.forEach(item => {
        const match = item.name.match(/^(\d+)-(PHOTO|VIDEO|AUDIO|STICKER)-(\d{4}-\d{2}-\d{2})-(\d{2})-(\d{2})-(\d{2})/i);

        if (match) {
            const type = match[2].toLowerCase();
            const dateKey = match[3];
            const hour = parseInt(match[4]);
            const minute = parseInt(match[5]);
            const second = parseInt(match[6]);
            const timeSeconds = hour * 3600 + minute * 60 + second;

            if (!mediaByDate[dateKey]) {
                mediaByDate[dateKey] = [];
            }

            mediaByDate[dateKey].push({
                file: item.blob,
                name: item.name,
                type,
                timeSeconds
            });
        }
    });

    // Sort by time
    Object.keys(mediaByDate).forEach(date => {
        mediaByDate[date].sort((a, b) => a.timeSeconds - b.timeSeconds);
    });
}

function getMediaExtension(type) {
    switch (type) {
        case 'photo': return 'jpg';
        case 'video': return 'mp4';
        case 'audio': return 'opus';
        case 'sticker': return 'webp';
        default: return 'jpg';
    }
}

// [Old love popup system removed - replaced by advanced system at end of file]

// Load renames on init
loadRenames();

// ========== MESSAGE STARRING SYSTEM ==========

const starredSection = document.getElementById('starred-section');
const starredContainer = document.getElementById('starred-container');
const noStarredMsg = document.getElementById('no-starred');

function loadStarred() {
    const saved = localStorage.getItem('chat-starred');
    if (saved) {
        starredMessages = JSON.parse(saved);
    }
}

function saveStarred() {
    localStorage.setItem('chat-starred', JSON.stringify(starredMessages));
}

function isMessageStarred(index) {
    return starredMessages.some(s => s.index === index);
}

function toggleStar(index) {
    const existing = starredMessages.findIndex(s => s.index === index);
    if (existing >= 0) {
        starredMessages.splice(existing, 1);
    } else {
        const msg = allMessages[index];
        if (msg) {
            starredMessages.push({
                index,
                sender: msg.sender,
                text: msg.text.substring(0, 100),
                date: msg.date,
                time: msg.time
            });
        }
    }
    saveStarred();
    renderVisibleMessages();
    updateStarredList();
}

function updateStarredList() {
    if (!starredContainer) return;

    starredSection.style.display = allMessages.length > 0 ? 'block' : 'none';
    starredContainer.innerHTML = '';

    if (starredMessages.length === 0) {
        noStarredMsg.style.display = 'block';
        return;
    }

    noStarredMsg.style.display = 'none';

    starredMessages.forEach((starred, i) => {
        const item = document.createElement('div');
        item.className = 'starred-item';
        item.onclick = () => goToStarredMessage(starred.index);

        const content = document.createElement('div');
        content.className = 'starred-item-content';

        const sender = document.createElement('div');
        sender.className = 'starred-item-sender';
        sender.textContent = getDisplayName(starred.sender);
        content.appendChild(sender);

        const text = document.createElement('div');
        text.className = 'starred-item-text';
        text.textContent = starred.text || '📎 Média';
        content.appendChild(text);

        item.appendChild(content);

        const date = document.createElement('div');
        date.className = 'starred-item-date';
        date.textContent = starred.date;
        item.appendChild(date);

        const remove = document.createElement('button');
        remove.className = 'starred-item-remove';
        remove.textContent = '✕';
        remove.onclick = (e) => {
            e.stopPropagation();
            toggleStar(starred.index);
        };
        item.appendChild(remove);

        starredContainer.appendChild(item);
    });
}

function goToStarredMessage(index) {
    if (index < 0 || index >= allMessages.length) return;

    settingsPanel.classList.remove('open');

    // Scroll to message position
    chatArea.scrollTop = index * ITEM_HEIGHT - chatArea.clientHeight / 2;

    requestAnimationFrame(() => {
        updateVirtualScroll();
        requestAnimationFrame(() => {
            const el = contentContainer.querySelector(`[data-index="${index}"]`);
            if (el) {
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 2000);
            }
        });
    });
}

// Context menu for starring
let contextMenu = null;
let longPressTimer = null;
let longPressTriggered = false;

function showContextMenu(x, y, messageIndex) {
    hideContextMenu();

    const isStarred = isMessageStarred(messageIndex);

    contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';

    const starItem = document.createElement('div');
    starItem.className = 'context-menu-item';
    starItem.innerHTML = `<span>${isStarred ? '⭐' : '☆'}</span><span>${isStarred ? 'Retirer des favoris' : 'Ajouter aux favoris'}</span>`;
    starItem.onclick = () => {
        toggleStar(messageIndex);
        hideContextMenu();
    };
    contextMenu.appendChild(starItem);

    // Position menu
    contextMenu.style.left = Math.min(x, window.innerWidth - 180) + 'px';
    contextMenu.style.top = Math.min(y, window.innerHeight - 60) + 'px';

    document.body.appendChild(contextMenu);
}

function hideContextMenu() {
    if (contextMenu) {
        contextMenu.remove();
        contextMenu = null;
    }
}

// Right-click on PC
chatArea.addEventListener('contextmenu', (e) => {
    const messageEl = e.target.closest('.message');
    if (messageEl) {
        e.preventDefault();
        const index = parseInt(messageEl.dataset.index);
        if (!isNaN(index)) {
            showContextMenu(e.clientX, e.clientY, index);
        }
    }
});

// Long press on mobile
chatArea.addEventListener('touchstart', (e) => {
    const messageEl = e.target.closest('.message');
    if (messageEl) {
        const index = parseInt(messageEl.dataset.index);
        if (!isNaN(index)) {
            longPressTriggered = false;
            longPressTimer = setTimeout(() => {
                longPressTriggered = true;
                const touch = e.touches[0];
                showContextMenu(touch.clientX, touch.clientY, index);

                // Vibrate if available
                if (navigator.vibrate) {
                    navigator.vibrate(50);
                }
            }, 500);
        }
    }
}, { passive: true });

chatArea.addEventListener('touchend', () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
});

chatArea.addEventListener('touchmove', () => {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
});

// Close context menu on click outside
document.addEventListener('click', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
        hideContextMenu();
    }
});

document.addEventListener('touchstart', (e) => {
    if (contextMenu && !contextMenu.contains(e.target)) {
        hideContextMenu();
    }
}, { passive: true });

// Load starred on init
loadStarred();

// Update starred list when chat loads
const originalSetupVirtualScroll = setupVirtualScroll;
setupVirtualScroll = function () {
    originalSetupVirtualScroll();
    updateStarredList();

    // Start love popup system if Imrane/Habhoub chat detected
    checkForSpecialChatAndStartLove();
};

// ========== LOVE POPUP INTERACTIVE SYSTEM ==========

let lovePopupTimer = null;
let isSpecialChat = false;
let chatStats = { totalMessages: 0, amourCount: 0, mdrCount: 0, jetaimeCount: 0 };
let scrollSpeed = { lastPosition: 0, lastTime: 0, speed: 0 };
let hasScrolledToTop = false;

// Check if this is a special Imrane/Habhoub chat
function checkForSpecialChatAndStartLove() {
    const participantNames = participants.map(p => p.toLowerCase());
    isSpecialChat = participantNames.some(p => p.includes('imrane') || p.includes('imran')) &&
        participantNames.some(p => p.includes('habhoub') || p.includes('habib') || p.includes('houb'));

    if (isSpecialChat) {
        // Calculate chat stats
        calculateChatStats();

        // Start all love triggers
        startLovePopupTimer();
        setupSearchEasterEggs();
        setupScrollTriggers();
        setupShakeDetection();
        checkTimeBasedPopups();
    }
}

// Calculate chat statistics
function calculateChatStats() {
    chatStats.totalMessages = allMessages.length;
    allMessages.forEach(msg => {
        const text = msg.text.toLowerCase();
        chatStats.amourCount += (text.match(/amour/gi) || []).length;
        chatStats.mdrCount += (text.match(/mdr|lol|haha|😂|🤣/gi) || []).length;
        chatStats.jetaimeCount += (text.match(/je t'?aime|jtm|i love you/gi) || []).length;
    });
}

// ========== LOVE POPUP DISPLAY ==========

function showLovePopupAdvanced(config) {
    if (!lovePopup) return;

    const { emoji, text, subtext, buttons, onButton, autoClose } = config;

    // Set content
    if (lovePopupEmoji) lovePopupEmoji.textContent = emoji || '💕';
    if (lovePopupText) lovePopupText.textContent = text || '';

    const subtextEl = document.getElementById('love-popup-subtext');
    if (subtextEl) subtextEl.textContent = subtext || '';

    // Create buttons
    const buttonsContainer = document.getElementById('love-popup-buttons');
    if (buttonsContainer) {
        buttonsContainer.innerHTML = '';

        const buttonList = buttons || [{ label: 'OK ❤️', action: 'close' }];
        buttonList.forEach((btn, idx) => {
            const button = document.createElement('button');
            button.className = `love-popup-btn ${btn.secondary ? 'secondary' : ''}`;
            button.textContent = btn.label;
            button.addEventListener('click', () => {
                if (onButton) onButton(btn.action, idx);
                if (btn.action === 'close' || !btn.keepOpen) {
                    lovePopup.classList.add('hidden');
                }
            });
            buttonsContainer.appendChild(button);
        });
    }

    lovePopup.classList.remove('hidden');

    // Auto-close
    if (autoClose) {
        setTimeout(() => lovePopup.classList.add('hidden'), autoClose);
    }

    // Trigger confetti for special popups
    if (config.confetti && typeof confetti !== 'undefined') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
}

// ========== RANDOM POPUPS (5-15 minutes) ==========

const LOVE_POPUPS = [
    // Quiz Compliment
    {
        emoji: '🎯',
        text: "Alerte ! Tu viens de passer trop de temps à lire nos bêtises.",
        subtext: "Quel est le truc que je préfère chez toi ?",
        buttons: [
            { label: 'Mon sourire 😊', action: 'quiz' },
            { label: 'Mon rire 😄', action: 'quiz' },
            { label: 'Mon intelligence 🧠', action: 'quiz' }
        ],
        onButton: () => {
            setTimeout(() => {
                showLovePopupAdvanced({
                    emoji: '❤️',
                    text: "Mauvaise réponse...",
                    subtext: "C'est TOUT TOI que je préfère ! 💖",
                    confetti: true
                });
            }, 300);
        }
    },
    // Rappel de stats
    {
        emoji: '📊',
        text: `Tu savais qu'on s'est envoyé plus de ${chatStats.totalMessages || '50000'} messages ?`,
        subtext: "Ça fait beaucoup de 'on mange quoi ?' ça...",
        buttons: [{ label: "Et c'est pas fini ! 🥰", action: 'close' }],
        confetti: true
    },
    // La Prédiction
    {
        emoji: '🔮',
        text: "Je prédis qu'à cet instant précis...",
        subtext: "Tu es en train de sourire devant ton écran.",
        buttons: [
            { label: "C'est vrai 😊", action: 'close' },
            { label: "Grillée 🙈", action: 'close' }
        ]
    },
    // Question éclair
    {
        emoji: '⚡',
        text: "Question éclair !",
        subtext: "Quelle est ma couleur préférée ?",
        buttons: [
            { label: 'Bleu 💙', action: 'quiz' },
            { label: 'Rouge ❤️', action: 'quiz' },
            { label: 'Vert 💚', action: 'quiz' }
        ],
        onButton: () => {
            setTimeout(() => {
                showLovePopupAdvanced({
                    emoji: '🤷‍♂️',
                    text: "On s'en fiche de la couleur...",
                    subtext: "Par contre, je t'aime ❤️",
                    confetti: true
                });
            }, 300);
        }
    },
    // Bon pour un câlin
    {
        emoji: '🎫',
        text: "Félicitations !",
        subtext: "En lisant jusqu'ici, tu as débloqué un coupon 'Massage de 10 minutes'",
        buttons: [{ label: "Je capture l'écran pour preuve ! 📸", action: 'close' }]
    },
    // Data Love
    {
        emoji: '💝',
        get text() { return `Petite stat inutile : Le mot 'amour' apparaît ${chatStats.amourCount || '1428'} fois dans cette conversation.`; },
        subtext: "C'est beau non ?",
        buttons: [{ label: "On est trop mignons 🥰", action: 'close' }]
    },
    // La Roulette
    {
        emoji: '🎰',
        text: "Tu veux voir un message au hasard ?",
        buttons: [
            { label: "Non ça ira je lis là ! 📖", action: 'close' },
            { label: "Téléporte-moi ! 🚀", action: 'teleport' }
        ],
        onButton: (action) => {
            if (action === 'teleport' && allMessages.length > 0) {
                const randomIdx = Math.floor(Math.random() * allMessages.length);
                goToMessageIndex(randomIdx);
            }
        }
    },
    // Jet'aime stats
    {
        emoji: '💕',
        get text() { return `J'ai écrit 'Je t'aime' ${chatStats.jetaimeCount || '850'} fois dans cette conversation.`; },
        subtext: "Et ce n'est toujours pas assez !",
        buttons: [{ label: "Moi aussi je t'aime 💖", action: 'close' }],
        confetti: true
    }
];

function startLovePopupTimer() {
    // Random interval between 5-15 minutes (300000-900000 ms)
    const randomDelay = () => Math.floor(Math.random() * (15 - 5 + 1) + 5) * 60 * 1000;

    function scheduleNext() {
        const delay = randomDelay();
        console.log(`Next love popup in ${Math.round(delay / 60000)} minutes`);

        lovePopupTimer = setTimeout(() => {
            if (isSpecialChat && chatScreen.classList.contains('active')) {
                const popup = LOVE_POPUPS[Math.floor(Math.random() * LOVE_POPUPS.length)];
                showLovePopupAdvanced(popup);
            }
            scheduleNext();
        }, delay);
    }

    scheduleNext();
}

// ========== TIME-BASED POPUPS ==========

function checkTimeBasedPopups() {
    const hour = new Date().getHours();
    const day = new Date().getDate();

    // Moiniversaire (le 6 de chaque mois)
    if (day === 6) {
        setTimeout(() => {
            showLovePopupAdvanced({
                emoji: '🎂',
                text: "Joyeux Moiniversaire mon cœur !",
                subtext: "Encore un mois de bonheur ❤️",
                confetti: true
            });
        }, 3000);
        return;
    }

    // Message de minuit (23h+)
    if (hour >= 23) {
        setTimeout(() => {
            showLovePopupAdvanced({
                emoji: '🌙',
                text: "Il est tard, qu'est-ce que tu fais encore ici ?",
                subtext: "Va dormir (mais sache que je t'aime même quand tu es fatiguée)",
                buttons: [{ label: "D'accord mon amour 🌙", action: 'close' }]
            });
        }, 3000);
        return;
    }

    // Oiseau de nuit (1h-5h du matin)
    if (hour >= 1 && hour < 5) {
        setTimeout(() => {
            showLovePopupAdvanced({
                emoji: '😴',
                text: "Tu n'arrives pas à dormir ?",
                subtext: "Viens on se retrouve dans nos rêves. Bonne nuit mon ange 💫",
                buttons: [{ label: "À tout à l'heure dans mes rêves 💕", action: 'close' }]
            });
        }, 2000);
        return;
    }

    // Bonjour mon amour (6h-9h)
    if (hour >= 6 && hour < 9) {
        setTimeout(() => {
            showLovePopupAdvanced({
                emoji: '☀️',
                text: "Bien dormi ?",
                subtext: "Rien de mieux que de commencer la journée avec nos souvenirs ✨",
                buttons: [{ label: "Bonjour mon amour ☕", action: 'close' }]
            });
        }, 2000);
    }
}

// ========== SEARCH EASTER EGGS ==========

const SEARCH_TRIGGERS = {
    'mariage': { emoji: '💍', text: "Un jour...", confetti: true },
    'enfant': { emoji: '👶', text: "Un jour peut-être... 🥹", confetti: true },
    'je t\'aime': { emoji: '💖', text: "Moi aussi je t'aime ! 💕", confetti: true },
    'coquine': { emoji: '😳', effect: 'flashRed' },
    'coquin': { emoji: '😏', effect: 'flashRed' },
    'preuve': { emoji: '⚖️', text: "Ah, tu cherches des dossiers ? J'ai le droit à un avocat ?" },
    'menteur': { emoji: '🕵️', text: "Tu fais ta détective ? 🔍" },
    'faim': { emoji: '🍕', effect: 'foodRain' },
    'manger': { emoji: '🍔', effect: 'foodRain' },
    'burger': { emoji: '🍔', effect: 'foodRain' },
    'sushi': { emoji: '🍣', effect: 'foodRain' },
    'pizza': { emoji: '🍕', effect: 'foodRain' },
    'bisou': { emoji: '💋', text: "Un bisou pour toi ! 💋💋💋", confetti: true },
    'baiser': { emoji: '💋', text: "Des bisous partout ! 💋", confetti: true }
};

function setupSearchEasterEggs() {
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();

        for (const [trigger, config] of Object.entries(SEARCH_TRIGGERS)) {
            if (query.includes(trigger)) {
                handleSearchEasterEgg(config);
                break;
            }
        }
    });
}

function handleSearchEasterEgg(config) {
    if (config.effect === 'flashRed') {
        document.body.classList.add('flash-red');
        setTimeout(() => document.body.classList.remove('flash-red'), 600);
    } else if (config.effect === 'foodRain') {
        emojiRain(['🍕', '🍔', '🍟', '🍣', '🌮', '🍩', '🍪', '🧁']);
    } else if (config.text) {
        showLovePopupAdvanced({
            emoji: config.emoji,
            text: config.text,
            confetti: config.confetti,
            autoClose: 3000
        });
    }

    if (config.confetti && typeof confetti !== 'undefined') {
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.7 } });
    }
}

// ========== SCROLL TRIGGERS ==========

function setupScrollTriggers() {
    let scrollTimer = null;

    chatArea.addEventListener('scroll', () => {
        // Track scroll speed
        const now = Date.now();
        const currentPos = chatArea.scrollTop;
        const timeDiff = now - scrollSpeed.lastTime;
        const posDiff = Math.abs(currentPos - scrollSpeed.lastPosition);

        scrollSpeed.speed = timeDiff > 0 ? posDiff / timeDiff : 0;
        scrollSpeed.lastPosition = currentPos;
        scrollSpeed.lastTime = now;

        // Fast scroll detection (5000px in less than 3 seconds)
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(() => {
            if (scrollSpeed.speed > 5) { // pixels per ms
                showLovePopupAdvanced({
                    emoji: '🏎️',
                    text: "Wow doucement Flash McQueen !",
                    subtext: "Tu cherches un truc précis ou tu revisses toute notre vie en accéléré ? 😂",
                    buttons: [{ label: "Je cherche une pépite 💎", action: 'close' }]
                });
            }
        }, 500);

        // First message (Big Bang)
        if (visibleStart === 0 && !hasScrolledToTop) {
            hasScrolledToTop = true;
            setTimeout(() => {
                showLovePopupAdvanced({
                    emoji: '💥',
                    text: "Le Big Bang de notre relation !",
                    subtext: "Tout a commencé ici... ✨",
                    confetti: true
                });
            }, 1000);
        }
    }, { passive: true });
}

// ========== SHAKE DETECTION (Mobile) ==========

function setupShakeDetection() {
    let lastX = 0, lastY = 0, lastZ = 0;
    let lastShake = 0;
    const threshold = 15;

    if (window.DeviceMotionEvent) {
        window.addEventListener('devicemotion', (e) => {
            const x = e.accelerationIncludingGravity?.x || 0;
            const y = e.accelerationIncludingGravity?.y || 0;
            const z = e.accelerationIncludingGravity?.z || 0;

            const change = Math.abs(x - lastX) + Math.abs(y - lastY) + Math.abs(z - lastZ);

            if (change > threshold && Date.now() - lastShake > 3000) {
                lastShake = Date.now();
                emojiRain(['❤️', '💕', '💗', '💖', '💝', '✨', '🌟']);
            }

            lastX = x; lastY = y; lastZ = z;
        });
    }
}

// ========== EMOJI RAIN EFFECT ==========

function emojiRain(emojis) {
    const container = document.createElement('div');
    container.className = 'emoji-rain';
    document.body.appendChild(container);

    for (let i = 0; i < 30; i++) {
        setTimeout(() => {
            const drop = document.createElement('div');
            drop.className = 'emoji-drop';
            drop.textContent = emojis[Math.floor(Math.random() * emojis.length)];
            drop.style.left = Math.random() * 100 + 'vw';
            drop.style.animationDuration = (Math.random() * 2 + 2) + 's';
            container.appendChild(drop);

            setTimeout(() => drop.remove(), 4000);
        }, i * 100);
    }

    setTimeout(() => container.remove(), 5000);
}

// ========== HELPER: Go to message index ==========

function goToMessageIndex(idx) {
    const scrollPosition = Math.max(0, idx * ITEM_HEIGHT - chatArea.clientHeight / 2 + ITEM_HEIGHT / 2);
    chatArea.scrollTop = scrollPosition;

    requestAnimationFrame(() => {
        updateVirtualScroll();
        setTimeout(() => {
            const el = contentContainer.querySelector(`[data-index="${idx}"]`);
            if (el) {
                el.scrollIntoView({ block: 'center', behavior: 'auto' });
                setTimeout(() => {
                    el.classList.add('highlight');
                    setTimeout(() => el.classList.remove('highlight'), 1500);
                }, 100);
            }
        }, 50);
    });

    lovePopup?.classList.add('hidden');
}
