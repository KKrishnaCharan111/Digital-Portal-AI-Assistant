// ==================== "BOX" CAMPUS CHAT & HOME MARQUEE ENGINE ====================
// Real-Time Cross-Device Mesh with High-Speed PubSub, GunDB & BroadcastChannel

const CHAT_SYNC_TOPIC = 'fet_jain_ece_box_chat_2026';
const NOTICE_SYNC_TOPIC = 'fet_jain_ece_marquee_notice_2026';
const PRESENCE_SYNC_TOPIC = 'fet_jain_ece_presence_2026';
const AUTHORIZED_ADMIN_USNS = ['25BTREC020', '25BTREC09', '25BTREC009'];

// Mock and legacy message IDs to strictly suppress and permanently delete
const KNOWN_MOCK_MSG_IDS = [
  'BOX-INIT-001',
  'BOX-INIT-002',
  'BOX-VERIFY-001'
];

let gun = null;
let boxChatChannel = null;
let boxNoticeChannel = null;
let chatEventSource = null;
let noticeEventSource = null;
let presenceEventSource = null;
let boxMessages = [];
let activePinnedNotice = {
  tag: '📢',
  label: 'Notice',
  text: 'Welcome to Digital Portal! Stay updated on class routines, attendance, and campus announcements through BOX chat.',
  attachment: null,
  pinnedBy: 'System',
  timestamp: new Date().toISOString()
};

let currentDraftAttachment = null;
let currentNoticeDraftAttachment = null;
let currentBoxTheme = 'glass';
let activePresenceMap = {};

// ==================== PERMANENT DELETION & BLACKLIST SYSTEM ====================

function getDeletedMessageIds() {
  try {
    const raw = localStorage.getItem('fet_box_deleted_ids_v5');
    const arr = raw ? JSON.parse(raw) : [];
    return new Set([...KNOWN_MOCK_MSG_IDS, ...arr]);
  } catch (e) {
    return new Set(KNOWN_MOCK_MSG_IDS);
  }
}

function recordDeletedMessageId(id) {
  if (!id) return;
  try {
    const set = getDeletedMessageIds();
    set.add(id);
    localStorage.setItem('fet_box_deleted_ids_v5', JSON.stringify(Array.from(set)));
  } catch (e) {}
}

function isMessageDeleted(id) {
  if (!id) return false;
  if (id.startsWith('BOX-INIT-') || id.startsWith('BOX-VERIFY-')) return true;
  return getDeletedMessageIds().has(id);
}

// Auto-purge legacy browser cache & residual mock messages
function purgeLegacyChatCache() {
  const legacyKeys = [
    'portal_campus_chat_messages',
    'portal_chat_history',
    'portal_mock_chat_seeds',
    'fet_box_chat_legacy'
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));

  // Purge any mock/deleted messages from localStorage
  try {
    const raw = localStorage.getItem('fet_box_messages_v4') || localStorage.getItem('fet_box_messages_v3');
    if (raw) {
      const msgs = JSON.parse(raw);
      const cleaned = msgs.filter(m => m && m.id && !isMessageDeleted(m.id) && m.senderUsn !== 'PORTAL');
      localStorage.setItem('fet_box_messages_v4', JSON.stringify(cleaned));
    }
  } catch (e) {}
}

// Update connection status indicator in UI
function updateConnectionStatus(isOnline) {
  const statusEl = document.getElementById('box-connection-status');
  if (!statusEl) return;
  const parent = statusEl.parentElement;
  if (isOnline) {
    statusEl.textContent = "Live Connected";
    if (parent) {
      parent.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-500/30";
    }
  } else {
    statusEl.textContent = "Connecting...";
    if (parent) {
      parent.className = "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold border border-amber-500/30";
    }
  }
}

// Connect Real-Time Server-Sent Events (SSE) Streams
function connectRealtimeStreams() {
  // 1. Live Chat Message Stream
  if (chatEventSource) {
    try { chatEventSource.close(); } catch (e) {}
  }
  try {
    chatEventSource = new EventSource(`https://ntfy.sh/${CHAT_SYNC_TOPIC}/sse`);
    chatEventSource.onopen = () => {
      updateConnectionStatus(true);
    };
    chatEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message' && payload.message) {
          const data = JSON.parse(payload.message);
          if (data && data.type === 'DELETE_MESSAGE' && data.id) {
            handleRemoteDeleteMessage(data.id);
          } else if (data && (data.text || data.attachment) && data.id) {
            if (!isMessageDeleted(data.id)) {
              receiveBoxMessage(data, false);
            }
          }
        }
      } catch (err) {
        console.warn("Error processing chat SSE event:", err);
      }
    };
    chatEventSource.onerror = () => {
      updateConnectionStatus(false);
    };
  } catch (err) {
    console.warn("Chat SSE setup error:", err);
  }

  // 2. Live Pinned Marquee Notice Stream
  if (noticeEventSource) {
    try { noticeEventSource.close(); } catch (e) {}
  }
  try {
    noticeEventSource = new EventSource(`https://ntfy.sh/${NOTICE_SYNC_TOPIC}/sse`);
    noticeEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message' && payload.message) {
          const notice = JSON.parse(payload.message);
          if (notice && (notice.text || notice.attachment)) {
            applyPinnedNotice(notice, false);
          }
        }
      } catch (err) {}
    };
  } catch (err) {}

  // 3. Live Presence Stream
  if (presenceEventSource) {
    try { presenceEventSource.close(); } catch (e) {}
  }
  try {
    presenceEventSource = new EventSource(`https://ntfy.sh/${PRESENCE_SYNC_TOPIC}/sse`);
    presenceEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message' && payload.message) {
          const pres = JSON.parse(payload.message);
          recordStudentPresence(pres);
        }
      } catch (err) {}
    };
  } catch (err) {}
}

// Fetch Remote Chat History (Sync past messages when opening portal)
async function syncRemoteChatHistory() {
  try {
    const res = await fetch(`https://ntfy.sh/${CHAT_SYNC_TOPIC}/json?poll=1&since=all`, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      let changed = false;

      // Pass 1: Collect any remote DELETE_MESSAGE events first
      lines.forEach(line => {
        if (!line) return;
        try {
          const item = JSON.parse(line);
          if (item.event === 'message' && item.message) {
            const data = JSON.parse(item.message);
            if (data && data.type === 'DELETE_MESSAGE' && data.id) {
              recordDeletedMessageId(data.id);
            }
          }
        } catch (e) {}
      });

      // Pass 2: Process messages that are NOT deleted or blacklisted
      lines.forEach(line => {
        if (!line) return;
        try {
          const item = JSON.parse(line);
          if (item.event === 'message' && item.message) {
            const data = JSON.parse(item.message);
            if (data && data.id && (data.text || data.attachment)) {
              if (!isMessageDeleted(data.id) && data.senderUsn !== 'PORTAL') {
                const exists = boxMessages.some(m => m.id === data.id || (m.timestamp === data.timestamp && m.senderUsn === data.senderUsn && m.text === data.text));
                if (!exists) {
                  boxMessages.push(data);
                  changed = true;
                }
              }
            }
          }
        } catch (e) {}
      });

      // Pass 3: Purge any messages from boxMessages that are in deleted list
      const originalLength = boxMessages.length;
      boxMessages = boxMessages.filter(m => m && m.id && !isMessageDeleted(m.id) && m.senderUsn !== 'PORTAL');
      if (boxMessages.length !== originalLength) {
        changed = true;
      }

      if (changed) {
        saveBoxMessages();
        renderBoxMessages();
      }
    }
  } catch (err) {
    console.warn("History poll error:", err);
  }
}

// Fetch Remote Pinned Notice
async function syncRemotePinnedNotice() {
  try {
    const res = await fetch(`https://ntfy.sh/${NOTICE_SYNC_TOPIC}/json?poll=1&since=all`, { cache: 'no-store' });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i]) continue;
        try {
          const item = JSON.parse(lines[i]);
          if (item.event === 'message' && item.message) {
            const notice = JSON.parse(item.message);
            if (notice && (notice.text || notice.attachment)) {
              applyPinnedNotice(notice, false);
              break;
            }
          }
        } catch (e) {}
      }
    }
  } catch (err) {}
}

// Initialize BOX Chat Engine
function initBoxChatEngine() {
  purgeLegacyChatCache();

  // 1. Cross-Tab Local BroadcastChannel
  try {
    if (window.BroadcastChannel) {
      boxChatChannel = new BroadcastChannel('fet_box_campus_chat_channel');
      boxChatChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'NEW_MESSAGE') {
          if (!isMessageDeleted(event.data.message?.id)) {
            receiveBoxMessage(event.data.message, false);
          }
        } else if (event.data && event.data.type === 'NOTICE_UPDATE') {
          applyPinnedNotice(event.data.notice, false);
        } else if (event.data && event.data.type === 'CLEAR_CHAT') {
          boxMessages = [];
          saveBoxMessages();
          renderBoxMessages();
        } else if (event.data && event.data.type === 'DELETE_MESSAGE') {
          handleRemoteDeleteMessage(event.data.id);
        } else if (event.data && event.data.type === 'PRESENCE') {
          recordStudentPresence(event.data.presence);
        }
      };

      boxNoticeChannel = new BroadcastChannel('fet_box_home_pinned_notice_channel');
      boxNoticeChannel.onmessage = (event) => {
        if (event.data && event.data.notice) {
          applyPinnedNotice(event.data.notice, false);
        }
      };
    }
  } catch (e) {
    console.warn("BroadcastChannel note:", e);
  }

  // 2. Connect Real-time SSE Streams
  connectRealtimeStreams();

  // 3. GunDB Real-Time Campus Mesh
  try {
    if (typeof getGlobalGun === 'function') {
      gun = getGlobalGun();
    } else if (window.portalGun) {
      gun = window.portalGun;
    } else if (window.Gun) {
      gun = Gun({
        peers: [
          'https://relay.peer.ooo/gun',
          'https://peer.wallie.io/gun',
          'https://gun-manhattan.herokuapp.com/gun'
        ],
        localStorage: false
      });
      window.portalGun = gun;
    }

    if (gun) {
      gun.get('fet_box_campus_chat_room_v4').map().on((data, id) => {
        if (data && data.senderUsn && (data.text || data.attachment)) {
          if (!isMessageDeleted(id) && !isMessageDeleted(data.id) && data.senderUsn !== 'PORTAL') {
            const incoming = {
              id: id || data.id,
              senderName: data.senderName,
              senderUsn: data.senderUsn,
              text: data.text || '',
              attachment: data.attachment || null,
              timestamp: data.timestamp,
              photo: data.photo || '',
              isAdmin: data.isAdmin || false
            };
            receiveBoxMessage(incoming, false);
          }
        }
      });
    }
  } catch (err) {
    console.warn("GunDB auxiliary layer note:", err);
  }

  // 4. Load local messages and pinned notice
  loadBoxMessages();
  loadPinnedNotice();
  applyBoxTheme();

  // 5. Fetch recent global messages from remote relay
  syncRemoteChatHistory();
  syncRemotePinnedNotice();

  // 6. Setup Drag and drop + clipboard paste listeners
  setupMediaPasteAndDrop();

  // Listen for student login session
  window.addEventListener('student-session-active', (e) => {
    checkAdminPermissions(e.detail);
    broadcastMyPresence();
  });

  if (typeof loggedInStudent !== 'undefined' && loggedInStudent) {
    checkAdminPermissions(loggedInStudent);
    broadcastMyPresence();
  }

  // 7. Dynamic Marquee speed on screen resize / orientation change
  window.addEventListener('resize', updateMarqueeSpeed);

  // Broadcast presence heartbeat every 25 seconds
  setInterval(broadcastMyPresence, 25000);
}

// Presence Tracking
function broadcastMyPresence() {
  if (typeof loggedInStudent === 'undefined' || !loggedInStudent) return;
  const pData = {
    name: loggedInStudent.name,
    usn: loggedInStudent.usn,
    time: Date.now()
  };
  recordStudentPresence(pData);

  if (boxChatChannel) {
    boxChatChannel.postMessage({ type: 'PRESENCE', presence: pData });
  }

  fetch(`https://ntfy.sh/${PRESENCE_SYNC_TOPIC}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(pData)
  }).catch(e => {});

  if (gun) {
    try {
      gun.get('fet_box_presence_v4').get(loggedInStudent.usn).put(pData);
    } catch (e) {}
  }
}

function recordStudentPresence(p) {
  if (!p || !p.usn) return;
  const usnKey = p.usn.toUpperCase();
  activePresenceMap[usnKey] = { name: p.name, time: p.time || Date.now() };
  window.activePresenceMap = activePresenceMap;

  // Count active students in last 3 minutes
  const now = Date.now();
  const activeCount = Object.values(activePresenceMap).filter(item => now - item.time < 180000).length;
  const countEl = document.getElementById('box-active-count-text');
  if (countEl) {
    countEl.textContent = activeCount > 1 ? `${activeCount} Students Online` : '1 Student Online';
  }

  // Live update presence dot in Student Directory if active
  if (typeof updateDirectoryPresenceBadges === 'function') {
    updateDirectoryPresenceBadges();
  }
}

window.isStudentOnline = function(usn) {
  if (!usn) return false;
  const entry = activePresenceMap[usn.toUpperCase()];
  if (!entry) return false;
  return (Date.now() - entry.time) < 180000;
};

// Theme Management - Glass only permanently
function applyBoxTheme() {
  const stream = document.getElementById('box-message-stream');
  if (!stream) return;
  stream.className = 'flex-1 overflow-y-auto p-4 space-y-3 text-xs box-theme-glass transition-all duration-300';
}

function setBoxTheme(themeKey) {
  // Retained for backward-compatibility; keeps glass theme
  currentBoxTheme = 'glass';
  applyBoxTheme();
}

// Media Drawer (🤪 Stickers, GIFs & Emojis)
function toggleMediaDrawer() {
  const drawer = document.getElementById('media-drawer-popover');
  if (drawer) drawer.classList.toggle('hidden');
}

function switchMediaTab(tab) {
  ['stickers', 'gifs', 'emojis'].forEach(t => {
    const content = document.getElementById(`media-content-${t}`);
    const btn = document.getElementById(`media-tab-btn-${t}`);
    if (content) content.classList.toggle('hidden', t !== tab);
    if (btn) {
      if (t === tab) {
        btn.className = "px-2.5 py-1 rounded-xl text-xs font-black bg-pink-600 text-white shadow-xs transition";
      } else {
        btn.className = "px-2.5 py-1 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-black/5 transition";
      }
    }
  });
}

function sendCollegeSticker(name, icon, color) {
  if (!loggedInStudent) {
    alert("Please sign in to send college stickers.");
    return;
  }
  toggleMediaDrawer();
  sendSpecialBoxMessage(`STICKER:${icon}:${name}:${color}`);
}

function sendGif(url) {
  if (!loggedInStudent) {
    alert("Please sign in to send reaction GIFs.");
    return;
  }
  toggleMediaDrawer();
  sendSpecialBoxMessage(`GIF:${url}`);
}

function sendCustomGifUrl() {
  const input = document.getElementById('gif-url-input');
  const url = input ? input.value.trim() : '';
  if (!url) return;
  input.value = '';
  sendGif(url);
}

function insertEmoji(emoji) {
  const input = document.getElementById('box-chat-input');
  if (input) {
    input.value += emoji;
    input.focus();
  }
}

function quickShoutPrompt() {
  if (!loggedInStudent) {
    alert("Please sign in to shout to all students.");
    return;
  }
  const shoutText = prompt("📢 Enter high-priority shoutout to all classmates in BOX chat:");
  if (shoutText && shoutText.trim()) {
    sendSpecialBoxMessage(`SHOUT:${shoutText.trim()}`);
  }
}

// Outbound Message Broadcaster
function broadcastOutboundMessage(message) {
  // 1. Cross-tab BroadcastChannel
  if (boxChatChannel) {
    boxChatChannel.postMessage({ type: 'NEW_MESSAGE', message: message });
  }

  // 2. High-speed Serverless Push
  fetch(`https://ntfy.sh/${CHAT_SYNC_TOPIC}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  }).catch(err => console.warn("Sync push error:", err));

  // 3. GunDB secondary mesh
  if (gun) {
    try {
      gun.get('fet_box_campus_chat_room_v4').set(message);
    } catch (e) {}
  }
}

function sendSpecialBoxMessage(customPayload) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msgId = 'BOX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  const customProfiles = JSON.parse(localStorage.getItem('portal_student_custom_profiles') || '{}');
  const studentPhoto = customProfiles[loggedInStudent.usn]?.photo || localStorage.getItem('portal_avatar_' + loggedInStudent.usn) || '';

  const message = {
    id: msgId,
    senderName: loggedInStudent.name,
    senderUsn: loggedInStudent.usn,
    text: customPayload,
    attachment: null,
    timestamp: timeStr,
    photo: studentPhoto,
    isAdmin: isAuthorizedAdmin(loggedInStudent)
  };

  receiveBoxMessage(message, true);
  broadcastOutboundMessage(message);
}

// ==================== FILE & MEDIA UPLOAD ENGINE ====================

function triggerChatFileUpload() {
  if (!loggedInStudent) {
    alert("Please sign in to upload images or documents.");
    return;
  }
  const fileInput = document.getElementById('box-file-upload-input');
  if (fileInput) {
    fileInput.click();
  }
}

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// Client-side image compression to keep sync ultrafast
function compressImageFile(file, maxWidth = 1000, quality = 0.8) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

async function handleChatFileSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  // Maximum 5MB limit
  if (file.size > 5 * 1024 * 1024) {
    alert("File is too large. Please select files or documents under 5 MB for peer sync.");
    event.target.value = '';
    return;
  }

  const isImage = file.type.startsWith('image/');
  let dataUrl = '';

  if (isImage) {
    dataUrl = await compressImageFile(file, 1000, 0.8);
  } else {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  if (!dataUrl) {
    alert("Could not read the selected file.");
    event.target.value = '';
    return;
  }

  currentDraftAttachment = {
    type: isImage ? 'image' : 'file',
    name: file.name,
    size: formatFileSize(file.size),
    mimeType: file.type || 'application/octet-stream',
    data: dataUrl
  };

  renderDraftAttachmentPreview();
  event.target.value = '';
}

function clearDraftAttachment() {
  currentDraftAttachment = null;
  renderDraftAttachmentPreview();
}

function renderDraftAttachmentPreview() {
  const bar = document.getElementById('box-attachment-preview-bar');
  if (!bar) return;

  if (!currentDraftAttachment) {
    bar.classList.add('hidden');
    bar.innerHTML = '';
    return;
  }

  bar.classList.remove('hidden');

  const isImg = currentDraftAttachment.type === 'image';
  const docMeta = getDocumentMeta(currentDraftAttachment.name, currentDraftAttachment.mimeType);

  bar.innerHTML = `
    <div class="flex items-center justify-between gap-3 p-2 px-3 rounded-2xl bg-pink-500/10 dark:bg-pink-950/40 border border-pink-500/30 text-xs">
      <div class="flex items-center gap-2.5 min-w-0">
        ${isImg ? `
          <img src="${currentDraftAttachment.data}" alt="Preview" class="w-9 h-9 rounded-xl object-cover border border-pink-400/40 shrink-0" />
        ` : `
          <div class="w-9 h-9 rounded-xl ${docMeta.bg} ${docMeta.color} flex items-center justify-center text-sm shrink-0">
            <i class="${docMeta.icon}"></i>
          </div>
        `}
        <div class="min-w-0">
          <div class="font-bold text-slate-800 dark:text-slate-100 truncate text-[11px] max-w-[200px] sm:max-w-xs">${escapeHtml(currentDraftAttachment.name)}</div>
          <div class="text-[9px] text-pink-600 dark:text-pink-400 font-semibold">${currentDraftAttachment.size} • Ready to send</div>
        </div>
      </div>
      <button type="button" onclick="clearDraftAttachment()" class="w-6 h-6 rounded-full glass-card hover:bg-rose-500 hover:text-white flex items-center justify-center text-slate-400 text-xs transition" title="Remove attachment">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
}

// Drag & drop and clipboard paste listeners
function setupMediaPasteAndDrop() {
  const chatPanel = document.getElementById('box-chat-panel');
  const chatInput = document.getElementById('box-chat-input');

  if (chatPanel) {
    chatPanel.addEventListener('dragover', (e) => {
      e.preventDefault();
      chatPanel.classList.add('ring-2', 'ring-pink-500', 'ring-offset-2');
    });

    chatPanel.addEventListener('dragleave', (e) => {
      e.preventDefault();
      chatPanel.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2');
    });

    chatPanel.addEventListener('drop', async (e) => {
      e.preventDefault();
      chatPanel.classList.remove('ring-2', 'ring-pink-500', 'ring-offset-2');
      if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        await processDroppedOrPastedFile(file);
      }
    });
  }

  if (chatInput) {
    chatInput.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData)?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processDroppedOrPastedFile(file);
            break;
          }
        }
      }
    });
  }
}

async function processDroppedOrPastedFile(file) {
  if (!loggedInStudent) {
    alert("Please sign in to upload files or documents.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    alert("File is too large. Please select files under 5 MB.");
    return;
  }
  const isImage = file.type.startsWith('image/');
  let dataUrl = '';
  if (isImage) {
    dataUrl = await compressImageFile(file, 1000, 0.8);
  } else {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  if (dataUrl) {
    currentDraftAttachment = {
      type: isImage ? 'image' : 'file',
      name: file.name || (isImage ? 'pasted-image.png' : 'document-file'),
      size: formatFileSize(file.size),
      mimeType: file.type || 'application/octet-stream',
      data: dataUrl
    };
    renderDraftAttachmentPreview();
  }
}

function getDocumentMeta(filename = '', mimeType = '') {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf' || mimeType.includes('pdf')) {
    return { icon: 'fa-solid fa-file-pdf', color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/15 border border-rose-500/30' };
  }
  if (['doc', 'docx'].includes(ext) || mimeType.includes('word')) {
    return { icon: 'fa-solid fa-file-word', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/15 border border-blue-500/30' };
  }
  if (['xls', 'xlsx', 'csv'].includes(ext) || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
    return { icon: 'fa-solid fa-file-excel', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/15 border border-emerald-500/30' };
  }
  if (['ppt', 'pptx'].includes(ext) || mimeType.includes('presentation')) {
    return { icon: 'fa-solid fa-file-powerpoint', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/15 border border-amber-500/30' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext) || mimeType.includes('zip') || mimeType.includes('archive')) {
    return { icon: 'fa-solid fa-file-zipper', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-500/15 border border-purple-500/30' };
  }
  if (['txt', 'md', 'json', 'py', 'c', 'cpp', 'java', 'js', 'html', 'css'].includes(ext)) {
    return { icon: 'fa-solid fa-file-code', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-500/15 border border-indigo-500/30' };
  }
  return { icon: 'fa-solid fa-file', color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-500/15 border border-slate-500/30' };
}

// Lightbox full-size image viewer
function openLightboxImage(imgSrc, title = 'Image Preview') {
  let modal = document.getElementById('image-lightbox-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'image-lightbox-modal';
    modal.className = 'fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-xl flex flex-col items-center justify-center p-4 transition-all duration-300';
    modal.innerHTML = `
      <div class="relative max-w-4xl max-h-[90vh] flex flex-col items-center">
        <div class="w-full flex items-center justify-between pb-3 text-white">
          <span id="lightbox-title" class="text-xs font-bold truncate max-w-xs sm:max-w-md"></span>
          <div class="flex items-center gap-2">
            <a id="lightbox-download-btn" href="#" download="campus-image.png" class="px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-bold flex items-center gap-1.5 transition">
              <i class="fa-solid fa-download"></i> <span>Download</span>
            </a>
            <button onclick="closeLightboxImage()" class="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center text-sm transition">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        </div>
        <img id="lightbox-img" src="" alt="Full view" class="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/20" />
      </div>
    `;
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeLightboxImage();
    });
    document.body.appendChild(modal);
  }

  const imgEl = modal.querySelector('#lightbox-img');
  const titleEl = modal.querySelector('#lightbox-title');
  const dwnEl = modal.querySelector('#lightbox-download-btn');

  if (imgEl) imgEl.src = imgSrc;
  if (titleEl) titleEl.textContent = title;
  if (dwnEl) {
    dwnEl.href = imgSrc;
    dwnEl.download = title || 'campus-media.png';
  }

  modal.classList.remove('hidden');
}

function closeLightboxImage() {
  const modal = document.getElementById('image-lightbox-modal');
  if (modal) modal.classList.add('hidden');
}

// Check if current user is an authorized admin (25BTREC020 or 25BTREC09)
function isAuthorizedAdmin(student) {
  if (!student || !student.usn) return false;
  const usnUpper = student.usn.toUpperCase();
  return AUTHORIZED_ADMIN_USNS.includes(usnUpper);
}

function checkAdminPermissions(student) {
  const adminBroadcastBar = document.getElementById('box-admin-broadcast-bar');
  const adminPinToggle = document.getElementById('box-admin-pin-toggle');
  const badgeEl = document.getElementById('box-admin-usn-badge');

  if (isAuthorizedAdmin(student)) {
    if (adminBroadcastBar) adminBroadcastBar.classList.remove('hidden');
    if (adminPinToggle) adminPinToggle.classList.remove('hidden');
    if (badgeEl) badgeEl.textContent = student.usn;
  } else {
    if (adminBroadcastBar) adminBroadcastBar.classList.add('hidden');
    if (adminPinToggle) adminPinToggle.classList.add('hidden');
  }

  renderBoxMessages();
}

function loadBoxMessages() {
  try {
    const raw = localStorage.getItem('fet_box_messages_v4') || localStorage.getItem('fet_box_messages_v3');
    const parsed = raw ? JSON.parse(raw) : [];
    boxMessages = parsed.filter(m => m && m.id && !isMessageDeleted(m.id) && m.senderUsn !== 'PORTAL');
  } catch (e) {
    boxMessages = [];
  }
  renderBoxMessages();
}

function saveBoxMessages() {
  try {
    const cleanList = boxMessages.filter(m => m && m.id && !isMessageDeleted(m.id) && m.senderUsn !== 'PORTAL');
    localStorage.setItem('fet_box_messages_v4', JSON.stringify(cleanList.slice(-120)));
  } catch (e) {}
}

function receiveBoxMessage(msg, isOutbound = false) {
  if (!msg || (!msg.text && !msg.attachment)) return;
  if (isMessageDeleted(msg.id) || msg.senderUsn === 'PORTAL') return;

  const exists = boxMessages.some(m => m.id === msg.id || (m.timestamp === msg.timestamp && m.senderUsn === msg.senderUsn && m.text === msg.text));
  if (exists) return;

  boxMessages.push(msg);
  saveBoxMessages();
  renderBoxMessages();
}

function handleSendBoxMessage() {
  if (!loggedInStudent) {
    alert("Please sign in to send messages in BOX chat.");
    return;
  }

  const input = document.getElementById('box-chat-input');
  const text = input ? input.value.trim() : '';

  if (!text && !currentDraftAttachment) {
    return;
  }

  const pinCheckbox = document.getElementById('box-pin-as-marquee-checkbox');
  const shouldPinToHome = isAuthorizedAdmin(loggedInStudent) && pinCheckbox && pinCheckbox.checked;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msgId = 'BOX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  const customProfiles = JSON.parse(localStorage.getItem('portal_student_custom_profiles') || '{}');
  const studentPhoto = customProfiles[loggedInStudent.usn]?.photo || localStorage.getItem('portal_avatar_' + loggedInStudent.usn) || '';

  const attachmentToSend = currentDraftAttachment ? { ...currentDraftAttachment } : null;

  const message = {
    id: msgId,
    senderName: loggedInStudent.name,
    senderUsn: loggedInStudent.usn,
    text: text,
    attachment: attachmentToSend,
    timestamp: timeStr,
    photo: studentPhoto,
    isAdmin: isAuthorizedAdmin(loggedInStudent)
  };

  if (input) input.value = '';
  clearDraftAttachment();
  if (pinCheckbox) pinCheckbox.checked = false;

  receiveBoxMessage(message, true);
  broadcastOutboundMessage(message);

  if (shouldPinToHome) {
    let pinTitle = message.text || (attachmentToSend ? (attachmentToSend.type === 'image' ? 'Pinned Image' : attachmentToSend.name) : 'Campus Notice');
    pinMessageToHomeMarquee(pinTitle, '📢', 'Notice', attachmentToSend);
  }
}

// Format message body with vibrant badges for Stickers, GIFs, Shouts, Attachments, and Text
function formatMessageContent(rawText, attachment) {
  let attachmentHtml = '';

  if (attachment) {
    if (attachment.type === 'image') {
      attachmentHtml = `
        <div class="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 max-w-[280px] shadow-sm my-1.5 bg-black/5 dark:bg-black/30">
          <img src="${escapeHtml(attachment.data)}" alt="${escapeHtml(attachment.name)}" class="w-full max-h-56 object-cover rounded-t-2xl cursor-pointer hover:opacity-95 transition" onclick="openLightboxImage('${escapeHtml(attachment.data)}', '${escapeHtml(attachment.name)}')" loading="lazy" />
          <div class="p-2 bg-white/95 dark:bg-slate-900/95 flex items-center justify-between text-[10px] gap-2 border-t border-slate-100 dark:border-slate-800">
            <span class="truncate font-bold text-slate-800 dark:text-slate-200" title="${escapeHtml(attachment.name)}">${escapeHtml(attachment.name)}</span>
            <a href="${escapeHtml(attachment.data)}" download="${escapeHtml(attachment.name)}" class="p-1 px-2 rounded-lg bg-pink-500/10 hover:bg-pink-500/20 text-pink-600 dark:text-pink-400 font-extrabold flex items-center gap-1 shrink-0" title="Download">
              <i class="fa-solid fa-download text-[9px]"></i> <span>${attachment.size || ''}</span>
            </a>
          </div>
        </div>
      `;
    } else {
      const meta = getDocumentMeta(attachment.name, attachment.mimeType);
      attachmentHtml = `
        <div class="flex items-center gap-2.5 p-2.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 shadow-xs my-1.5 max-w-sm">
          <div class="w-9 h-9 rounded-xl ${meta.bg} ${meta.color} flex items-center justify-center text-sm shrink-0">
            <i class="${meta.icon}"></i>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-black text-slate-900 dark:text-white truncate" title="${escapeHtml(attachment.name)}">${escapeHtml(attachment.name)}</div>
            <div class="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">${attachment.size || 'Document'}</div>
          </div>
          <a href="${escapeHtml(attachment.data)}" download="${escapeHtml(attachment.name)}" class="px-2.5 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-[11px] font-bold shrink-0 flex items-center gap-1 shadow-xs transition active:scale-95" title="Download ${escapeHtml(attachment.name)}">
            <i class="fa-solid fa-download text-[10px]"></i>
          </a>
        </div>
      `;
    }
  }

  if (!rawText) {
    return attachmentHtml;
  }

  if (rawText.startsWith('STICKER:')) {
    const parts = rawText.split(':');
    const icon = parts[1] || '🎓';
    const title = parts[2] || 'Campus Sticker';
    const color = parts[3] || 'pink';

    const colorMap = {
      emerald: { border: 'border-emerald-500/50', text: 'text-emerald-600 dark:text-emerald-400' },
      amber: { border: 'border-amber-500/50', text: 'text-amber-600 dark:text-amber-400' },
      orange: { border: 'border-orange-500/50', text: 'text-orange-600 dark:text-orange-400' },
      purple: { border: 'border-purple-500/50', text: 'text-purple-600 dark:text-purple-400' },
      rose: { border: 'border-rose-500/50', text: 'text-rose-600 dark:text-rose-400' },
      sky: { border: 'border-sky-500/50', text: 'text-sky-600 dark:text-sky-400' },
      red: { border: 'border-red-600/50', text: 'text-red-600 dark:text-red-400' },
      teal: { border: 'border-teal-500/50', text: 'text-teal-600 dark:text-teal-400' }
    };
    const c = colorMap[color] || { border: 'border-pink-500/50', text: 'text-pink-600 dark:text-pink-400' };

    return `
      <div class="inline-flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 border ${c.border} shadow-md my-1">
        <span class="text-3xl">${icon}</span>
        <div>
          <span class="text-[9px] uppercase font-black tracking-wider ${c.text} block leading-none mb-0.5">College Sticker</span>
          <span class="text-xs font-black text-slate-900 dark:text-white leading-tight">${escapeHtml(title)}</span>
        </div>
      </div>
      ${attachmentHtml}
    `;
  }

  if (rawText.startsWith('GIF:')) {
    const gifUrl = rawText.substring(4).trim();
    return `
      <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-w-[280px] shadow-sm my-1">
        <img src="${escapeHtml(gifUrl)}" alt="Reaction GIF" class="w-full max-h-56 object-cover rounded-2xl" loading="lazy" onerror="this.src='https://media.giphy.com/media/LmN8OYiY4m0X85K0Zz/giphy.gif'" />
      </div>
      ${attachmentHtml}
    `;
  }

  if (rawText.startsWith('SHOUT:')) {
    const shoutBody = rawText.substring(6).trim();
    return `
      <div class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border-2 border-amber-500/60 shadow-md my-1">
        <div class="flex items-center gap-1.5 mb-1 text-amber-600 dark:text-amber-400">
          <i class="fa-solid fa-bullhorn text-xs"></i>
          <span class="text-[10px] font-black uppercase tracking-wider">Campus Shoutout</span>
        </div>
        <p class="text-xs font-extrabold text-slate-900 dark:text-white leading-snug">${escapeHtml(shoutBody)}</p>
      </div>
      ${attachmentHtml}
    `;
  }

  return `
    <p class="text-xs break-words leading-relaxed">${escapeHtml(rawText)}</p>
    ${attachmentHtml}
  `;
}

function renderBoxMessages() {
  const container = document.getElementById('box-message-stream');
  if (!container) return;

  // Filter out any mock or deleted messages
  const displayableMessages = boxMessages.filter(m => m && m.id && !isMessageDeleted(m.id) && m.senderUsn !== 'PORTAL');

  if (displayableMessages.length === 0) {
    container.innerHTML = `
      <div id="box-empty-state" class="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
        <div class="w-16 h-16 rounded-3xl bg-pink-500/10 text-pink-500 flex items-center justify-center text-2xl mb-1">
          <i class="fa-solid fa-comments"></i>
        </div>
        <h4 class="text-sm font-black text-slate-700 dark:text-slate-200">Welcome to BOX Campus Chat!</h4>
        <p class="text-xs max-w-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Real-time peer student discussion. Send messages, attach documents or images, and share college stickers & GIFs!
        </p>
      </div>
    `;
    return;
  }

  const currentUsn = loggedInStudent ? loggedInStudent.usn.toUpperCase() : '';
  const currentIsAdmin = loggedInStudent ? isAuthorizedAdmin(loggedInStudent) : false;

  container.innerHTML = displayableMessages.map((m, idx) => {
    const isMe = m.senderUsn && m.senderUsn.toUpperCase() === currentUsn;
    const msgIsAdmin = m.isAdmin || AUTHORIZED_ADMIN_USNS.includes((m.senderUsn || '').toUpperCase());
    const initials = m.senderName ? m.senderName.split(' ').map(n => n[0]).slice(0, 2).join('') : 'ST';

    return `
      <div class="flex items-start gap-2.5 max-w-[90%] sm:max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''} group">
        <!-- Avatar -->
        <div class="w-7 h-7 rounded-xl bg-gradient-to-tr from-pink-500 to-rose-600 text-white flex items-center justify-center text-[10px] font-black shrink-0 shadow-xs overflow-hidden mt-0.5 border border-white/60 dark:border-slate-800">
          ${m.photo ? `<img src="${m.photo}" alt="${m.senderName}" class="w-full h-full object-cover" />` : initials}
        </div>

        <!-- Bubble -->
        <div class="${isMe ? 'bg-gradient-to-r from-pink-600 to-rose-600 text-white rounded-tr-none' : 'glass-card text-slate-800 dark:text-slate-100 rounded-tl-none border border-slate-200/60 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90'} p-3 rounded-2xl shadow-xs leading-relaxed max-w-full">
          <div class="flex items-center gap-1.5 mb-1">
            <span class="font-extrabold text-[11px] ${isMe ? 'text-pink-100' : 'text-slate-900 dark:text-white'} leading-tight">${m.senderName}</span>
            <span class="text-[9px] font-mono opacity-70">(${m.senderUsn})</span>
            ${msgIsAdmin ? '<span class="text-[8px] font-black px-1.5 py-0.2 rounded bg-amber-400 text-slate-950 uppercase shadow-2xs">ADMIN</span>' : ''}
          </div>

          ${formatMessageContent(m.text, m.attachment)}

          <div class="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t ${isMe ? 'border-white/20' : 'border-slate-100 dark:border-slate-800'} text-[9px] opacity-75">
            <span>${m.timestamp}</span>

            <div class="flex items-center gap-2">
              ${currentIsAdmin ? `
                <button type="button" onclick="pinMessageByIndex(${idx})" class="hover:underline font-bold flex items-center gap-0.5 ${isMe ? 'text-white' : 'text-amber-600 dark:text-amber-400'}" title="Pin this message and any attachment to Home Marquee">
                  <span>📌 Pin to Home</span>
                </button>
              ` : ''}

              ${(isMe || currentIsAdmin) ? `
                <button type="button" onclick="deleteBoxMessage(${idx})" class="hover:text-rose-400 opacity-60 hover:opacity-100 transition" title="Delete message">
                  <i class="fa-solid fa-trash-can text-[9px]"></i>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.scrollTop = container.scrollHeight;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function deleteBoxMessage(index) {
  const msg = boxMessages[index];
  if (!msg) return;

  if (confirm("Delete this message?")) {
    recordDeletedMessageId(msg.id);
    boxMessages.splice(index, 1);
    saveBoxMessages();
    renderBoxMessages();

    if (boxChatChannel) {
      boxChatChannel.postMessage({ type: 'DELETE_MESSAGE', id: msg.id });
    }

    fetch(`https://ntfy.sh/${CHAT_SYNC_TOPIC}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'DELETE_MESSAGE', id: msg.id })
    }).catch(e => {});

    if (gun) {
      try {
        gun.get('fet_box_campus_chat_room_v4').get(msg.id).put(null);
      } catch (e) {}
    }
  }
}

function handleRemoteDeleteMessage(msgId) {
  if (!msgId) return;
  recordDeletedMessageId(msgId);
  const idx = boxMessages.findIndex(m => m.id === msgId);
  if (idx !== -1) {
    boxMessages.splice(idx, 1);
    saveBoxMessages();
    renderBoxMessages();
  }
}

function clearBoxChatHistory() {
  if (confirm("Clear local chat messages on this device?")) {
    boxMessages.forEach(m => {
      if (m && m.id) recordDeletedMessageId(m.id);
    });
    boxMessages = [];
    saveBoxMessages();
    renderBoxMessages();
    if (boxChatChannel) {
      boxChatChannel.postMessage({ type: 'CLEAR_CHAT' });
    }
  }
}

// ==================== HOME RUNNING MARQUEE & PINNED NOTICE ENGINE ====================

function loadPinnedNotice() {
  try {
    const raw = localStorage.getItem('fet_box_pinned_notice_v5') || localStorage.getItem('fet_box_pinned_notice_v4');
    if (raw) {
      activePinnedNotice = JSON.parse(raw);
    }
  } catch (e) {}
  updateMarqueeDisplay();
}

function savePinnedNotice() {
  try {
    localStorage.setItem('fet_box_pinned_notice_v5', JSON.stringify(activePinnedNotice));
  } catch (e) {}
}

function broadcastOutboundNotice(notice) {
  if (boxNoticeChannel) {
    boxNoticeChannel.postMessage({ notice: notice });
  }

  fetch(`https://ntfy.sh/${NOTICE_SYNC_TOPIC}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(notice)
  }).catch(e => {});

  if (gun) {
    try {
      gun.get('fet_box_home_pinned_notice_v4').put(notice);
    } catch (e) {}
  }
}

function applyPinnedNotice(notice, broadcast = true) {
  if (!notice || (!notice.text && !notice.attachment)) return;
  activePinnedNotice = notice;
  savePinnedNotice();
  updateMarqueeDisplay();

  if (broadcast) {
    broadcastOutboundNotice(activePinnedNotice);
  }
}

function updateMarqueeDisplay() {
  const iconEl = document.getElementById('marquee-urgency-icon');
  const labelEl = document.getElementById('marquee-urgency-label');
  const textEl = document.getElementById('marquee-text-content');
  const attachmentBadgeEl = document.getElementById('marquee-attachment-indicator');

  if (iconEl) iconEl.textContent = activePinnedNotice.tag || '📢';
  if (labelEl) labelEl.textContent = activePinnedNotice.label || 'Notice';

  let marqueeText = activePinnedNotice.text || 'Welcome to Digital Portal!';
  if (activePinnedNotice.attachment) {
    const mediaName = activePinnedNotice.attachment.name || 'Media';
    marqueeText = `${marqueeText} • 📎 [${mediaName}]`;
    if (attachmentBadgeEl) attachmentBadgeEl.classList.remove('hidden');
  } else {
    if (attachmentBadgeEl) attachmentBadgeEl.classList.add('hidden');
  }

  if (textEl) {
    textEl.textContent = marqueeText;
    updateMarqueeSpeed();
  }
}

// Dynamically calibrate marquee scrolling speed based on message length and device viewport
function updateMarqueeSpeed() {
  const textEl = document.getElementById('marquee-text-content');
  if (!textEl) return;
  const len = (textEl.textContent || '').trim().length;
  const isMobile = window.innerWidth <= 640;

  // On mobile: keep speed brisk and responsive (6s to 15s)
  // On desktop: comfortable reading speed (8s to 22s)
  let duration;
  if (isMobile) {
    duration = Math.max(6, Math.min(15, Math.round(len * 0.08) + 3));
  } else {
    duration = Math.max(8, Math.min(22, Math.round(len * 0.10) + 4));
  }
  textEl.style.animationDuration = `${duration}s`;
}

// Clicking the running marquee ticker opens attached media directly or switches to BOX chat
function handleMarqueeClick(event) {
  if (activePinnedNotice && activePinnedNotice.attachment) {
    const att = activePinnedNotice.attachment;
    if (att.type === 'image') {
      openLightboxImage(att.data, att.name);
      return;
    } else {
      const a = document.createElement('a');
      a.href = att.data;
      a.download = att.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      return;
    }
  }
  switchTab('chat');
}

function pinMessageByIndex(idx) {
  const msg = boxMessages[idx];
  if (!msg) return;
  let cleanText = msg.text || '';
  if (cleanText.startsWith('SHOUT:')) cleanText = cleanText.substring(6);
  if (cleanText.startsWith('STICKER:')) cleanText = cleanText.split(':')[2] || cleanText;

  if (!cleanText && msg.attachment) {
    cleanText = (msg.attachment.type === 'image' ? 'Pinned Image: ' : 'Pinned Document: ') + msg.attachment.name;
  }

  pinMessageToHomeMarquee(cleanText, '📢', 'Notice', msg.attachment || null);
}

function pinMessageToHomeMarquee(text, tag = '📢', label = 'Notice', attachment = null) {
  if (!loggedInStudent || !isAuthorizedAdmin(loggedInStudent)) {
    alert("Only authorized admins (25BTREC020 & 25BTREC09) can pin notices.");
    return;
  }

  const notice = {
    tag,
    label,
    text: text || (attachment ? attachment.name : 'Campus Announcement'),
    attachment: attachment || null,
    pinnedBy: loggedInStudent.name,
    timestamp: new Date().toISOString()
  };

  applyPinnedNotice(notice, true);
  alert(`Notice successfully pinned to Home Page:\n"${notice.text}"`);
}

// Manage Notice Modal for Admins
let selectedNoticeTag = { icon: '📢', label: 'Notice' };

function openManageNoticeModal() {
  if (!loggedInStudent || !isAuthorizedAdmin(loggedInStudent)) {
    alert("Only authorized batch admins (25BTREC020 & 25BTREC09) can manage Home notices.");
    return;
  }

  const input = document.getElementById('manage-notice-input');
  if (input) input.value = activePinnedNotice.text || '';
  selectNoticeTag(activePinnedNotice.tag || '📢', activePinnedNotice.label || 'Notice');

  currentNoticeDraftAttachment = activePinnedNotice.attachment ? { ...activePinnedNotice.attachment } : null;
  renderNoticeModalAttachmentPreview();
  updateNoticePreview();

  document.getElementById('manage-notice-modal').classList.remove('hidden');
}

function closeManageNoticeModal() {
  document.getElementById('manage-notice-modal').classList.add('hidden');
}

function selectNoticeTag(icon, label) {
  selectedNoticeTag = { icon, label };
  document.querySelectorAll('.notice-tag-btn').forEach(btn => {
    if (btn.getAttribute('data-tag') === label) {
      btn.className = 'notice-tag-btn p-2 rounded-xl border border-amber-500 bg-amber-100 dark:bg-amber-950/60 text-amber-900 dark:text-amber-200 font-black text-center shadow-xs';
    } else {
      btn.className = 'notice-tag-btn p-2 rounded-xl glass-card text-slate-600 dark:text-slate-300 font-bold text-center';
    }
  });
  updateNoticePreview();
}

function updateNoticePreview() {
  const input = document.getElementById('manage-notice-input');
  const badge = document.getElementById('notice-preview-badge');
  const preview = document.getElementById('notice-preview-text');

  if (badge) badge.textContent = `${selectedNoticeTag.icon} ${selectedNoticeTag.label}`;
  let txt = (input && input.value.trim()) ? input.value.trim() : 'Preview text will appear here';
  if (currentNoticeDraftAttachment) {
    txt += ` • 📎 [${currentNoticeDraftAttachment.name}]`;
  }
  if (preview) preview.textContent = txt;
}

async function handleNoticeAttachmentSelect(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("File is too large. Please select files under 5 MB.");
    event.target.value = '';
    return;
  }

  const isImage = file.type.startsWith('image/');
  let dataUrl = '';
  if (isImage) {
    dataUrl = await compressImageFile(file, 1000, 0.8);
  } else {
    dataUrl = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  if (dataUrl) {
    currentNoticeDraftAttachment = {
      type: isImage ? 'image' : 'file',
      name: file.name,
      size: formatFileSize(file.size),
      mimeType: file.type || 'application/octet-stream',
      data: dataUrl
    };
    renderNoticeModalAttachmentPreview();
    updateNoticePreview();
  }
  event.target.value = '';
}

function clearNoticeDraftAttachment() {
  currentNoticeDraftAttachment = null;
  renderNoticeModalAttachmentPreview();
  updateNoticePreview();
}

function renderNoticeModalAttachmentPreview() {
  const container = document.getElementById('manage-notice-attachment-preview');
  if (!container) return;

  if (!currentNoticeDraftAttachment) {
    container.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  const isImg = currentNoticeDraftAttachment.type === 'image';
  const meta = getDocumentMeta(currentNoticeDraftAttachment.name, currentNoticeDraftAttachment.mimeType);

  container.innerHTML = `
    <div class="flex items-center justify-between gap-2 p-2 rounded-xl bg-amber-500/10 border border-amber-500/30">
      <div class="flex items-center gap-2 min-w-0">
        ${isImg ? `
          <img src="${currentNoticeDraftAttachment.data}" class="w-8 h-8 rounded-lg object-cover" />
        ` : `
          <div class="w-8 h-8 rounded-lg ${meta.bg} ${meta.color} flex items-center justify-center text-xs">
            <i class="${meta.icon}"></i>
          </div>
        `}
        <div class="min-w-0">
          <div class="text-[11px] font-bold text-slate-800 dark:text-slate-100 truncate">${escapeHtml(currentNoticeDraftAttachment.name)}</div>
          <div class="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">${currentNoticeDraftAttachment.size}</div>
        </div>
      </div>
      <button type="button" onclick="clearNoticeDraftAttachment()" class="w-5 h-5 rounded-full hover:bg-rose-500 hover:text-white flex items-center justify-center text-slate-400 text-xs">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
  `;
}

function handleSaveNotice(e) {
  e.preventDefault();
  const input = document.getElementById('manage-notice-input');
  const text = input ? input.value.trim() : '';
  if (!text && !currentNoticeDraftAttachment) return;

  pinMessageToHomeMarquee(text, selectedNoticeTag.icon, selectedNoticeTag.label, currentNoticeDraftAttachment);
  closeManageNoticeModal();
}

function resetNoticeToDefault() {
  const defaultNotice = {
    tag: '📢',
    label: 'Notice',
    text: 'Welcome to Digital Portal! Stay updated on class routines, attendance, and campus announcements through BOX chat.',
    attachment: null,
    pinnedBy: 'System',
    timestamp: new Date().toISOString()
  };
  applyPinnedNotice(defaultNotice, true);
  closeManageNoticeModal();
  alert("Marquee and home notice reset to default announcement.");
}

document.addEventListener('DOMContentLoaded', () => {
  const noticeInput = document.getElementById('manage-notice-input');
  if (noticeInput) {
    noticeInput.addEventListener('input', updateNoticePreview);
  }
  initBoxChatEngine();
});
