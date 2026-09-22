// ==================== "BOX" CAMPUS CHAT & HOME MARQUEE ENGINE ====================
// Serverless Peer-to-Peer Chat Engine with GunDB & BroadcastChannel Mesh

const AUTHORIZED_ADMIN_USNS = ['25BTREC020', '25BTREC09', '25BTREC009'];

let gun = null;
let boxChatChannel = null;
let boxNoticeChannel = null;
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

// Auto-purge legacy browser cache on load (wipes old bot/mock messages)
function purgeLegacyChatCache() {
  const legacyKeys = [
    'portal_campus_chat_messages',
    'portal_chat_history',
    'portal_mock_chat_seeds',
    'fet_box_chat_legacy'
  ];
  legacyKeys.forEach(k => localStorage.removeItem(k));
}

// Initialize GunDB Mesh & Cross-Tab BroadcastChannel
function initBoxChatEngine() {
  purgeLegacyChatCache();

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
    console.warn("BroadcastChannel not available:", e);
  }

  // Initialize GunDB with public WebSocket relays
  try {
    if (window.Gun) {
      gun = Gun({
        peers: [
          'https://gun-manhattan.herokuapp.com/gun',
          'https://peer.waller.asia/gun',
          'https://relay.peer.ooo/gun'
        ],
        localStorage: false
      });

      // Listen for peer chat messages
      gun.get('fet_box_campus_chat_room_v3').map().on((data, id) => {
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

      // Listen for pinned notices
      gun.get('fet_box_home_pinned_notice_v3').on((data) => {
        if (data && data.text) {
          applyPinnedNotice({
            tag: data.tag || '📢',
            label: data.label || 'Notice',
            text: data.text,
            pinnedBy: data.pinnedBy || 'Admin',
            timestamp: data.timestamp || new Date().toISOString()
          }, false);
        }
      });

      // Listen for peer presence
      gun.get('fet_box_presence_v3').map().on((data) => {
        if (data && data.usn && data.name) {
          recordStudentPresence(data);
        }
      });

      const statusEl = document.getElementById('box-connection-status');
      if (statusEl) statusEl.textContent = "Online Mesh";
    }
  } catch (err) {
    console.warn("GunDB initialization fallback:", err);
  }

  // Load clean cached messages (Pure active users only)
  loadBoxMessages();
  loadPinnedNotice();
  applyBoxTheme();

  // Listen for student session updates
  window.addEventListener('student-session-active', (e) => {
    checkAdminPermissions(e.detail);
    broadcastMyPresence();
  });

  if (typeof loggedInStudent !== 'undefined' && loggedInStudent) {
    checkAdminPermissions(loggedInStudent);
    broadcastMyPresence();
  }

  // Heartbeat presence broadcast every 30 seconds
  setInterval(broadcastMyPresence, 30000);
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
  if (gun) {
    try {
      gun.get('fet_box_presence_v3').get(loggedInStudent.usn).put(pData);
    } catch (e) {}
  }
}

function recordStudentPresence(p) {
  if (!p || !p.usn) return;
  activePresenceMap[p.usn] = { name: p.name, time: p.time || Date.now() };

  // Count active in last 5 minutes
  const now = Date.now();
  const activeCount = Object.values(activePresenceMap).filter(item => now - item.time < 300000).length;
  const countEl = document.getElementById('box-active-count-text');
  if (countEl) {
    countEl.textContent = activeCount > 1 ? `${activeCount} Students Online` : '1 Student Online';
  }
}

// --- Theme Management ---
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

// --- Media Drawer: Stickers, GIFs & Emojis ---
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

  if (gun) {
    try {
      gun.get('fet_box_campus_chat_room_v3').set(message);
    } catch (e) {
      console.warn("Gun broadcast error:", e);
    }
  }
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
    const raw = localStorage.getItem('fet_box_messages_v3');
    boxMessages = raw ? JSON.parse(raw) : [];
  } catch (e) {
    boxMessages = [];
  }
  renderBoxMessages();
}

function saveBoxMessages() {
  try {
    localStorage.setItem('fet_box_messages_v3', JSON.stringify(boxMessages.slice(-100)));
  } catch (e) {}
}

function receiveBoxMessage(msg, broadcast = true) {
  if (!msg || !msg.text) return;
  const exists = boxMessages.some(m => m.id === msg.id || (m.timestamp === msg.timestamp && m.senderUsn === msg.senderUsn && m.text === msg.text));
  if (exists) return;

  boxMessages.push(msg);
  saveBoxMessages();
  renderBoxMessages();

  if (broadcast && boxChatChannel) {
    boxChatChannel.postMessage({ type: 'NEW_MESSAGE', message: msg });
  }
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

  if (gun) {
    try {
      gun.get('fet_box_campus_chat_room_v3').set({
        senderName: message.senderName,
        senderUsn: message.senderUsn,
        text: message.text,
        timestamp: message.timestamp,
        photo: message.photo,
        isAdmin: message.isAdmin
      });
    } catch (e) {
      console.warn("Gun broadcast error:", e);
    }
  }

  if (shouldPinToHome) {
    pinMessageToHomeMarquee(message.text, '📢', 'Notice');
  }
}

// Render message body with support for Stickers, GIFs, Shouts, and Text
function formatMessageContent(rawText) {
  if (!rawText) return '';

  if (rawText.startsWith('STICKER:')) {
    const parts = rawText.split(':');
    const icon = parts[1] || '🎓';
    const title = parts[2] || 'Campus Sticker';
    const color = parts[3] || 'pink';
    return `
      <div class="inline-flex items-center gap-2.5 p-2.5 rounded-2xl bg-white/95 dark:bg-slate-900/90 border border-pink-500/40 shadow-md">
        <span class="text-3xl">${icon}</span>
        <div>
          <span class="text-[9px] uppercase font-black tracking-wider text-pink-600 dark:text-pink-400 block leading-none mb-0.5">College Sticker</span>
          <span class="text-xs font-black text-slate-900 dark:text-white leading-tight">${title}</span>
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
      <div class="p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-red-500/20 border-2 border-amber-500/60 shadow-md">
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
          No bot messages or broadcast notices. Only active students using the website can chat here. Tap <strong>🤪</strong> to send college stickers, GIFs & emojis!
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
  if (confirm("Delete this message?")) {
    boxMessages.splice(index, 1);
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

// --- Home Page Running Marquee Ticker & Notice Controls ---
function loadPinnedNotice() {
  try {
    const raw = localStorage.getItem('fet_box_pinned_notice_v3');
    if (raw) {
      activePinnedNotice = JSON.parse(raw);
    }
  } catch (e) {}
  updateMarqueeDisplay();
}

function savePinnedNotice() {
  try {
    localStorage.setItem('fet_box_pinned_notice_v3', JSON.stringify(activePinnedNotice));
  } catch (e) {}
}

function applyPinnedNotice(notice, broadcast = true) {
  if (!notice || !notice.text) return;
  activePinnedNotice = notice;
  savePinnedNotice();
  updateMarqueeDisplay();

  if (broadcast) {
    if (boxNoticeChannel) {
      boxNoticeChannel.postMessage({ notice: activePinnedNotice });
    }
    if (gun) {
      try {
        gun.get('fet_box_home_pinned_notice_v3').put(activePinnedNotice);
      } catch (e) {}
    }
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

// Manage Notice Modal
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
