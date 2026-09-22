// ==================== "BOX" CAMPUS CHAT & HOME MARQUEE ENGINE ====================
// Real-Time Cross-Device Mesh with High-Speed PubSub, GunDB & BroadcastChannel

const CHAT_SYNC_TOPIC = 'fet_jain_ece_box_chat_2026';
const NOTICE_SYNC_TOPIC = 'fet_jain_ece_marquee_notice_2026';
const PRESENCE_SYNC_TOPIC = 'fet_jain_ece_presence_2026';
const AUTHORIZED_ADMIN_USNS = ['25BTREC020', '25BTREC09', '25BTREC009'];

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
  pinnedBy: 'System',
  timestamp: new Date().toISOString()
};

let currentBoxTheme = localStorage.getItem('box_chat_theme') || 'glass';
let activePresenceMap = {};

// Auto-purge legacy browser cache on load
function purgeLegacyChatCache() {
  const legacyKeys = [
    'portal_campus_chat_messages',
    'portal_chat_history',
    'portal_mock_chat_seeds',
    'fet_box_chat_legacy'
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));
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
    try { chatEventSource.close(); } catch(e) {}
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
          } else if (data && data.text) {
            receiveBoxMessage(data, false);
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
    try { noticeEventSource.close(); } catch(e) {}
  }
  try {
    noticeEventSource = new EventSource(`https://ntfy.sh/${NOTICE_SYNC_TOPIC}/sse`);
    noticeEventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.event === 'message' && payload.message) {
          const notice = JSON.parse(payload.message);
          if (notice && notice.text) {
            applyPinnedNotice(notice, false);
          }
        }
      } catch (err) {}
    };
  } catch (err) {}

  // 3. Live Presence Stream
  if (presenceEventSource) {
    try { presenceEventSource.close(); } catch(e) {}
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
      let newCount = 0;
      lines.forEach(line => {
        if (!line) return;
        try {
          const item = JSON.parse(line);
          if (item.event === 'message' && item.message) {
            const msg = JSON.parse(item.message);
            if (msg && msg.text && msg.id) {
              const exists = boxMessages.some(m => m.id === msg.id || (m.timestamp === msg.timestamp && m.senderUsn === msg.senderUsn && m.text === msg.text));
              if (!exists) {
                boxMessages.push(msg);
                newCount++;
              }
            }
          }
        } catch(e) {}
      });
      if (newCount > 0) {
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
            if (notice && notice.text) {
              applyPinnedNotice(notice, false);
              break;
            }
          }
        } catch(e) {}
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
          receiveBoxMessage(event.data.message, false);
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

  // 3. Optional GunDB Secondary Mesh
  try {
    if (window.Gun) {
      gun = Gun({
        peers: [
          'https://relay.peer.ooo/gun'
        ],
        localStorage: false
      });

      gun.get('fet_box_campus_chat_room_v4').map().on((data, id) => {
        if (data && data.senderUsn && data.text) {
          const incoming = {
            id: id,
            senderName: data.senderName,
            senderUsn: data.senderUsn,
            text: data.text,
            timestamp: data.timestamp,
            photo: data.photo || '',
            isAdmin: data.isAdmin || false
          };
          receiveBoxMessage(incoming, false);
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

  // Listen for student login session
  window.addEventListener('student-session-active', (e) => {
    checkAdminPermissions(e.detail);
    broadcastMyPresence();
  });

  if (typeof loggedInStudent !== 'undefined' && loggedInStudent) {
    checkAdminPermissions(loggedInStudent);
    broadcastMyPresence();
  }

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
  activePresenceMap[p.usn] = { name: p.name, time: p.time || Date.now() };

  // Count active students in last 3 minutes
  const now = Date.now();
  const activeCount = Object.values(activePresenceMap).filter(item => now - item.time < 180000).length;
  const countEl = document.getElementById('box-active-count-text');
  if (countEl) {
    countEl.textContent = activeCount > 1 ? `${activeCount} Students Online` : '1 Student Online';
  }
}

// Theme Management
function setBoxTheme(themeKey) {
  currentBoxTheme = themeKey;
  localStorage.setItem('box_chat_theme', themeKey);
  applyBoxTheme();
}

function applyBoxTheme() {
  const stream = document.getElementById('box-message-stream');
  if (!stream) return;
  const themes = ['glass', 'cyber', 'sunset', 'ocean', 'mint'];
  themes.forEach(t => {
    stream.classList.remove(`box-theme-${t}`);
    const btn = document.getElementById(`theme-btn-${t}`);
    if (btn) {
      if (t === currentBoxTheme) {
        btn.className = "px-2 py-1 rounded-xl text-[10px] font-black transition bg-pink-600 text-white shadow-xs";
      } else {
        btn.className = "px-2 py-1 rounded-xl text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-black/10 transition";
      }
    }
  });
  stream.classList.add(`box-theme-${currentBoxTheme}`);
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

// Outbound Message Broadcaster (Dispatches to local tabs, ntfy.sh relay, and GunDB)
function broadcastOutboundMessage(message) {
  // 1. Cross-tab BroadcastChannel
  if (boxChatChannel) {
    boxChatChannel.postMessage({ type: 'NEW_MESSAGE', message: message });
  }

  // 2. High-speed HTTP Serverless Push (ntfy.sh)
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
    timestamp: timeStr,
    photo: studentPhoto,
    isAdmin: isAuthorizedAdmin(loggedInStudent)
  };

  receiveBoxMessage(message, true);
  broadcastOutboundMessage(message);
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
    boxMessages = raw ? JSON.parse(raw) : [];
  } catch (e) {
    boxMessages = [];
  }
  renderBoxMessages();
}

function saveBoxMessages() {
  try {
    localStorage.setItem('fet_box_messages_v4', JSON.stringify(boxMessages.slice(-120)));
  } catch (e) {}
}

function receiveBoxMessage(msg, isOutbound = false) {
  if (!msg || !msg.text) return;
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
  const text = input.value.trim();
  if (!text) return;

  const pinCheckbox = document.getElementById('box-pin-as-marquee-checkbox');
  const shouldPinToHome = isAuthorizedAdmin(loggedInStudent) && pinCheckbox && pinCheckbox.checked;

  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const msgId = 'BOX-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

  const customProfiles = JSON.parse(localStorage.getItem('portal_student_custom_profiles') || '{}');
  const studentPhoto = customProfiles[loggedInStudent.usn]?.photo || localStorage.getItem('portal_avatar_' + loggedInStudent.usn) || '';

  const message = {
    id: msgId,
    senderName: loggedInStudent.name,
    senderUsn: loggedInStudent.usn,
    text: text,
    timestamp: timeStr,
    photo: studentPhoto,
    isAdmin: isAuthorizedAdmin(loggedInStudent)
  };

  input.value = '';
  if (pinCheckbox) pinCheckbox.checked = false;

  receiveBoxMessage(message, true);
  broadcastOutboundMessage(message);

  if (shouldPinToHome) {
    pinMessageToHomeMarquee(message.text, '📢', 'Notice');
  }
}

// Format message body with vibrant badges for Stickers, GIFs, Shouts, and Text
function formatMessageContent(rawText) {
  if (!rawText) return '';

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
    `;
  }

  if (rawText.startsWith('GIF:')) {
    const gifUrl = rawText.substring(4).trim();
    return `
      <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 max-w-[280px] shadow-sm my-1">
        <img src="${escapeHtml(gifUrl)}" alt="Reaction GIF" class="w-full max-h-56 object-cover rounded-2xl" loading="lazy" onerror="this.src='https://media.giphy.com/media/LmN8OYiY4m0X85K0Zz/giphy.gif'" />
      </div>
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
    `;
  }

  return `<p class="text-xs break-words leading-relaxed">${escapeHtml(rawText)}</p>`;
}

function renderBoxMessages() {
  const container = document.getElementById('box-message-stream');
  if (!container) return;

  if (boxMessages.length === 0) {
    container.innerHTML = `
      <div id="box-empty-state" class="h-full flex flex-col items-center justify-center text-center p-6 space-y-2 text-slate-400">
        <div class="w-16 h-16 rounded-3xl bg-pink-500/10 text-pink-500 flex items-center justify-center text-2xl mb-1">
          <i class="fa-solid fa-comments"></i>
        </div>
        <h4 class="text-sm font-black text-slate-700 dark:text-slate-200">Welcome to BOX!</h4>
        <p class="text-xs max-w-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Real-time cross-device campus chat active. Send messages or tap <strong>🤪</strong> to send college stickers, GIFs & emojis!
        </p>
      </div>
    `;
    return;
  }

  const currentUsn = loggedInStudent ? loggedInStudent.usn.toUpperCase() : '';
  const currentIsAdmin = loggedInStudent ? isAuthorizedAdmin(loggedInStudent) : false;

  container.innerHTML = boxMessages.map((m, idx) => {
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

          ${formatMessageContent(m.text)}

          <div class="flex items-center justify-between gap-2 mt-1.5 pt-1 border-t ${isMe ? 'border-white/20' : 'border-slate-100 dark:border-slate-800'} text-[9px] opacity-75">
            <span>${m.timestamp}</span>

            <div class="flex items-center gap-2">
              ${currentIsAdmin ? `
                <button type="button" onclick="pinMessageByIndex(${idx})" class="hover:underline font-bold flex items-center gap-0.5 ${isMe ? 'text-white' : 'text-amber-600 dark:text-amber-400'}" title="Pin this message to Home Marquee">
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
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function deleteBoxMessage(index) {
  const msg = boxMessages[index];
  if (!msg) return;

  if (confirm("Delete this message?")) {
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
  }
}

function handleRemoteDeleteMessage(msgId) {
  if (!msgId) return;
  const idx = boxMessages.findIndex(m => m.id === msgId);
  if (idx !== -1) {
    boxMessages.splice(idx, 1);
    saveBoxMessages();
    renderBoxMessages();
  }
}

function clearBoxChatHistory() {
  if (confirm("Clear local chat messages on this device?")) {
    boxMessages = [];
    saveBoxMessages();
    renderBoxMessages();
    if (boxChatChannel) {
      boxChatChannel.postMessage({ type: 'CLEAR_CHAT' });
    }
  }
}

// Home Page Running Marquee Ticker & Notice Controls
function loadPinnedNotice() {
  try {
    const raw = localStorage.getItem('fet_box_pinned_notice_v4') || localStorage.getItem('fet_box_pinned_notice_v3');
    if (raw) {
      activePinnedNotice = JSON.parse(raw);
    }
  } catch (e) {}
  updateMarqueeDisplay();
}

function savePinnedNotice() {
  try {
    localStorage.setItem('fet_box_pinned_notice_v4', JSON.stringify(activePinnedNotice));
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
  if (!notice || !notice.text) return;
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

  if (iconEl) iconEl.textContent = activePinnedNotice.tag || '📢';
  if (labelEl) labelEl.textContent = activePinnedNotice.label || 'Notice';
  if (textEl) textEl.textContent = activePinnedNotice.text || 'Welcome to Digital Portal!';
}

function pinMessageByIndex(idx) {
  const msg = boxMessages[idx];
  if (!msg) return;
  let cleanText = msg.text;
  if (cleanText.startsWith('SHOUT:')) cleanText = cleanText.substring(6);
  if (cleanText.startsWith('STICKER:')) cleanText = cleanText.split(':')[2] || cleanText;
  pinMessageToHomeMarquee(cleanText, '📢', 'Notice');
}

function pinMessageToHomeMarquee(text, tag = '📢', label = 'Notice') {
  if (!loggedInStudent || !isAuthorizedAdmin(loggedInStudent)) {
    alert("Only authorized admins (25BTREC020 & 25BTREC09) can pin notices.");
    return;
  }

  const notice = {
    tag,
    label,
    text,
    pinnedBy: loggedInStudent.name,
    timestamp: new Date().toISOString()
  };

  applyPinnedNotice(notice, true);
  alert(`Notice successfully pinned to Home Page Running Marquee:\n"${text}"`);
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
  if (preview) preview.textContent = (input && input.value.trim()) ? input.value.trim() : 'Preview text will appear here';
}

document.addEventListener('DOMContentLoaded', () => {
  const noticeInput = document.getElementById('manage-notice-input');
  if (noticeInput) {
    noticeInput.addEventListener('input', updateNoticePreview);
  }
  initBoxChatEngine();
});

function handleSaveNotice(e) {
  e.preventDefault();
  const input = document.getElementById('manage-notice-input');
  const text = input ? input.value.trim() : '';
  if (!text) return;

  pinMessageToHomeMarquee(text, selectedNoticeTag.icon, selectedNoticeTag.label);
  closeManageNoticeModal();
}

function resetNoticeToDefault() {
  const defaultNotice = {
    tag: '📢',
    label: 'Notice',
    text: 'Welcome to Digital Portal! Stay updated on class routines, attendance, and campus announcements through BOX chat.',
    pinnedBy: 'System',
    timestamp: new Date().toISOString()
  };
  applyPinnedNotice(defaultNotice, true);
  closeManageNoticeModal();
  alert("Marquee reset to default announcement.");
}
