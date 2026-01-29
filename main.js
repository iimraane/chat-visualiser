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

// Predefined chat elements
const predefinedBtn = document.getElementById('predefined-btn');
const passwordModal = document.getElementById('password-modal');
const passwordInput = document.getElementById('password-input');
const passwordSubmit = document.getElementById('password-submit');
const passwordError = document.getElementById('password-error');
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
let isPredefinedChat = false;
let predefinedMediaMap = {};
let participantRenames = {};
let lovePopupTimers = [];
let firstDayTriggered = false;
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

        // Hide the predefined chat button
        predefinedBtn.style.display = 'none';

        setupVirtualScroll();
        requestAnimationFrame(() => updateVirtualScroll());
    }, 50);
});

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
    // Scroll to the message position
    chatArea.scrollTop = msgIndex * ITEM_HEIGHT - chatArea.clientHeight / 2;

    // Wait for render then highlight
    requestAnimationFrame(() => {
        updateVirtualScroll();
        requestAnimationFrame(() => {
            const el = contentContainer.querySelector(`[data-index="${msgIndex}"]`);
            if (el) {
                el.classList.add('highlight');
                setTimeout(() => el.classList.remove('highlight'), 2000);
            }
        });
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
            showDownloadModal();
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

// ========== AUTO DOWNLOAD FROM GOOGLE DRIVE ==========

function showDownloadModal() {
    const modal = document.createElement('div');
    modal.id = 'download-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-card" style="max-width: 420px;">
            <div class="modal-emoji" id="download-emoji">📥</div>
            <h2 id="download-title">Téléchargement des données</h2>
            <p id="download-message">Première utilisation ! Téléchargement automatique en cours...</p>
            
            <div class="download-progress-container" style="margin: 20px 0;">
                <div class="download-progress-bar" id="download-progress" style="width: 0%;"></div>
            </div>
            
            <p id="download-status" style="font-size: 13px; color: var(--text-secondary);">Connexion...</p>
        </div>
    `;

    document.body.appendChild(modal);

    // Add progress bar styles if not present
    if (!document.getElementById('download-progress-styles')) {
        const style = document.createElement('style');
        style.id = 'download-progress-styles';
        style.textContent = `
            .download-progress-container {
                width: 100%;
                height: 8px;
                background: var(--bg-secondary);
                border-radius: 4px;
                overflow: hidden;
            }
            .download-progress-bar {
                height: 100%;
                background: linear-gradient(90deg, #ff6b8a, #ff8fa3);
                border-radius: 4px;
                transition: width 0.3s ease;
            }
        `;
        document.head.appendChild(style);
    }

    // Start download
    downloadFromDrive();
}

async function downloadFromDrive() {
    const statusEl = document.getElementById('download-status');
    const progressEl = document.getElementById('download-progress');
    const emojiEl = document.getElementById('download-emoji');
    const titleEl = document.getElementById('download-title');
    const messageEl = document.getElementById('download-message');

    try {
        // Step 1: Get file list from Netlify Function
        statusEl.textContent = '📋 Récupération de la liste des fichiers...';
        progressEl.style.width = '5%';

        const listResponse = await fetch('/.netlify/functions/download-drive?type=list');
        if (!listResponse.ok) {
            throw new Error('FALLBACK_TO_MANUAL');
        }

        const fileList = await listResponse.json();

        // Check if chat ID is configured
        if (!fileList.chat?.id || fileList.chat.id === 'YOUR_CHAT_FILE_ID_HERE' || fileList.error) {
            // IDs not configured, switch to manual upload
            document.getElementById('download-modal')?.remove();
            showManualUploadModal();
            return;
        }

        // Step 2: Download chat file
        statusEl.textContent = '💬 Téléchargement du chat...';
        progressEl.style.width = '10%';

        const chatResponse = await fetch('/.netlify/functions/download-drive?type=chat');
        if (!chatResponse.ok) {
            const errorData = await chatResponse.json().catch(() => ({}));
            throw new Error(errorData.error || 'Erreur téléchargement chat');
        }

        const chatContent = await chatResponse.text();
        await saveChatToCache(chatContent);

        progressEl.style.width = '30%';

        // Step 3: Download media files
        const mediaFiles = fileList.media || [];
        const totalMedia = mediaFiles.length;

        if (totalMedia > 0) {
            for (let i = 0; i < mediaFiles.length; i++) {
                const file = mediaFiles[i];
                statusEl.textContent = `📷 Média ${i + 1}/${totalMedia}: ${file.name}`;

                const progress = 30 + (i / totalMedia) * 65;
                progressEl.style.width = `${progress}%`;

                try {
                    const mediaResponse = await fetch(`/.netlify/functions/download-drive?type=download&fileId=${file.id}`);
                    if (mediaResponse.ok) {
                        const blob = await mediaResponse.blob();
                        await saveMediaToCache(file.name, blob);
                    }
                } catch (mediaError) {
                    console.warn(`Failed to download ${file.name}:`, mediaError);
                    // Continue with other files
                }
            }
        }

        // Success!
        progressEl.style.width = '100%';
        emojiEl.textContent = '✅';
        titleEl.textContent = 'Téléchargement terminé !';
        messageEl.textContent = 'Les données ont été installées avec succès.';
        statusEl.textContent = 'Chargement de la conversation...';

        // Close modal and load chat
        setTimeout(() => {
            const modal = document.getElementById('download-modal');
            if (modal) modal.remove();
            loadCachedPredefinedChat();
        }, 1000);

    } catch (error) {
        console.error('Download error:', error);

        // If fallback requested or network error, go directly to manual upload
        if (error.message === 'FALLBACK_TO_MANUAL' || error.message.includes('fetch')) {
            document.getElementById('download-modal')?.remove();
            showManualUploadModal();
            return;
        }

        emojiEl.textContent = '❌';
        titleEl.textContent = 'Erreur de téléchargement';
        messageEl.textContent = error.message;
        statusEl.innerHTML = `
            <button id="retry-download" class="modal-btn" style="margin-top: 10px;">🔄 Réessayer</button>
            <button id="manual-upload" class="modal-btn" style="margin-top: 10px; background: var(--bg-secondary); color: var(--text-primary);">📁 Upload manuel</button>
        `;

        document.getElementById('retry-download')?.addEventListener('click', () => {
            progressEl.style.width = '0%';
            emojiEl.textContent = '📥';
            titleEl.textContent = 'Téléchargement des données';
            messageEl.textContent = 'Nouvelle tentative...';
            downloadFromDrive();
        });

        document.getElementById('manual-upload')?.addEventListener('click', () => {
            document.getElementById('download-modal')?.remove();
            showManualUploadModal();
        });
    }
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

// ========== LOVE POPUP SYSTEM ==========

const LOVE_POPUPS = [
    {
        delay: 5 * 60 * 1000, // 5 minutes
        emoji: '💖',
        text: 'Je t\'aime ma chérie et tu es la plus belle femme du monde',
        button: 'Oui j\'en suis persuadée',
        confetti: true
    },
    {
        delay: 15 * 60 * 1000, // 15 minutes
        emoji: '😍',
        text: 'T\'aimes bien nos petites conv hein, moi aussi je les adore',
        button: 'J\'adore toujours voir nos discussions',
        confetti: false
    }
];

const FIRST_DAY_POPUP = {
    emoji: '🥰',
    text: 'Oh waw le premier jour, le meilleur de ma vie',
    button: 'Je suis d\'accord',
    confetti: true
};

function startLovePopupTimers() {
    // Clear any existing timers
    lovePopupTimers.forEach(t => clearTimeout(t));
    lovePopupTimers = [];

    // Check localStorage for shown popups
    const shownPopups = JSON.parse(localStorage.getItem('love-popups-shown') || '[]');

    LOVE_POPUPS.forEach((popup, index) => {
        if (!shownPopups.includes(index)) {
            const timer = setTimeout(() => {
                showLovePopup(popup, index);
            }, popup.delay);
            lovePopupTimers.push(timer);
        }
    });
}

function showLovePopup(popup, index) {
    lovePopupEmoji.textContent = popup.emoji;
    lovePopupText.textContent = popup.text;
    lovePopupBtn.textContent = popup.button;

    lovePopup.classList.remove('hidden');

    // One-time handler for close
    const closeHandler = () => {
        lovePopup.classList.add('hidden');
        if (popup.confetti) {
            launchHeartConfetti();
        }

        // Mark as shown
        const shownPopups = JSON.parse(localStorage.getItem('love-popups-shown') || '[]');
        if (index !== undefined && !shownPopups.includes(index)) {
            shownPopups.push(index);
            localStorage.setItem('love-popups-shown', JSON.stringify(shownPopups));
        }

        lovePopupBtn.removeEventListener('click', closeHandler);
    };

    lovePopupBtn.addEventListener('click', closeHandler);
}

function setupFirstDayWatcher() {
    // Check if first day popup has been shown
    if (localStorage.getItem('first-day-popup-shown')) {
        firstDayTriggered = true;
        return;
    }

    // Override the goToMatch function to check for first day
    const originalGoToMatch = goToMatch;
    window.goToMatch = function (idx) {
        originalGoToMatch(idx);
        checkFirstDay();
    };

    // Also check on scroll
    const originalUpdateVirtualScroll = updateVirtualScroll;
    window.updateVirtualScroll = function () {
        originalUpdateVirtualScroll();
        if (isPredefinedChat) {
            checkFirstDay();
        }
    };
}

function checkFirstDay() {
    if (firstDayTriggered) return;

    // Check if current visible messages include the first day
    for (let i = visibleStart; i < Math.min(visibleEnd, allMessages.length); i++) {
        const msg = allMessages[i];
        if (msg && msg.date === FIRST_DAY_DATE) {
            firstDayTriggered = true;
            showFirstDayPopup();
            break;
        }
    }
}

function showFirstDayPopup() {
    lovePopupEmoji.textContent = FIRST_DAY_POPUP.emoji;
    lovePopupText.textContent = FIRST_DAY_POPUP.text;
    lovePopupBtn.textContent = FIRST_DAY_POPUP.button;

    lovePopup.classList.remove('hidden');

    const closeHandler = () => {
        lovePopup.classList.add('hidden');
        if (FIRST_DAY_POPUP.confetti) {
            launchHeartConfetti();
        }
        localStorage.setItem('first-day-popup-shown', 'true');
        lovePopupBtn.removeEventListener('click', closeHandler);
    };

    lovePopupBtn.addEventListener('click', closeHandler);
}

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
};
