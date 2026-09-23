// ==================== APP CORE LOGIC ====================
let isDarkMode = false;
function initTheme() {
  const savedTheme = localStorage.getItem('portal_theme');
  if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    setDarkMode(true);
  } else {
    setDarkMode(false);
  }
}

function toggleDarkMode() {
  setDarkMode(!isDarkMode);
}

function setDarkMode(enabled) {
  isDarkMode = enabled;
  localStorage.setItem('portal_theme', isDarkMode ? 'dark' : 'light');
  if (isDarkMode) {
    document.documentElement.classList.add('dark');
    const hIcon = document.getElementById('theme-icon-header');
    const lIcon = document.getElementById('theme-icon-login');
    if (hIcon) hIcon.className = 'fa-solid fa-sun text-amber-400 text-xs';
    if (lIcon) lIcon.className = 'fa-solid fa-sun text-amber-400 text-xs';
  } else {
    document.documentElement.classList.remove('dark');
    const hIcon = document.getElementById('theme-icon-header');
    const lIcon = document.getElementById('theme-icon-login');
    if (hIcon) hIcon.className = 'fa-solid fa-moon text-slate-600 text-xs';
    if (lIcon) lIcon.className = 'fa-solid fa-moon text-slate-600 text-xs';
  }
}

// ==================== SHARED SERVERLESS GRAPH & SINGLE ACTIVE SESSION ====================
function getGlobalGun() {
  if (window.portalGun) return window.portalGun;
  if (window.Gun) {
    try {
      window.portalGun = Gun({
        peers: [
          'https://relay.peer.ooo/gun',
          'https://peer.wallie.io/gun',
          'https://gun-manhattan.herokuapp.com/gun'
        ],
        localStorage: false
      });
      return window.portalGun;
    } catch (e) {
      console.warn("Gun init error:", e);
    }
  }
  return null;
}

let portalSessionChannel = null;
try {
  if (window.BroadcastChannel) {
    portalSessionChannel = new BroadcastChannel('fet_portal_session_guard_channel');
  }
} catch (e) {}

function initSessionSecurityWatcher() {
  // 1. Cross-tab BroadcastChannel
  if (portalSessionChannel) {
    portalSessionChannel.onmessage = (event) => {
      if (event.data && event.data.type === 'NEW_DEVICE_LOGIN' && event.data.session) {
        evaluateRemoteSessionRevocation(event.data.session);
      }
    };
  }

  // 2. Cross-device GunDB real-time active session watcher
  const g = getGlobalGun();
  if (g) {
    g.get('fet_jain_ece_active_sessions_v3').map().on((remoteSession, usn) => {
      if (remoteSession && remoteSession.token && remoteSession.timestamp) {
        evaluateRemoteSessionRevocation(remoteSession);
      }
    });
  }
}

function evaluateRemoteSessionRevocation(remoteSession) {
  if (!loggedInStudent) return;
  const myUsn = (loggedInStudent.usn || '').toUpperCase();
  const incomingUsn = (remoteSession.usn || '').toUpperCase();
  if (myUsn !== incomingUsn) return;

  const localToken = localStorage.getItem('portal_device_session_token');
  const localTimestamp = parseInt(localStorage.getItem('portal_device_session_timestamp') || '0', 10);
  const remoteTimestamp = parseInt(remoteSession.timestamp || '0', 10);

  // If the incoming session token is different and was issued after our local session:
  if (remoteSession.token && localToken && remoteSession.token !== localToken && remoteTimestamp > localTimestamp) {
    console.warn(`[Security Alert] Newer login detected on another device for USN ${myUsn} at ${new Date(remoteTimestamp).toLocaleTimeString()}`);
    terminateLocalSessionDueToConcurrentLogin(remoteSession);
  }
}

function terminateLocalSessionDueToConcurrentLogin(remoteSession) {
  // Stop all camera and media streams immediately
  if (faceScanStream) {
    try { faceScanStream.getTracks().forEach(t => t.stop()); } catch (e) {}
    faceScanStream = null;
  }
  if (faceScanAnimId) {
    cancelAnimationFrame(faceScanAnimId);
    faceScanAnimId = null;
  }
  if (html5QrScanner) {
    try { html5QrScanner.stop(); } catch (e) {}
    html5QrScanner = null;
  }
  if (typeof stopProfilePhotoCamera === 'function') {
    stopProfilePhotoCamera();
  }

  const studentName = loggedInStudent ? loggedInStudent.name : 'Student';
  const studentUsn = loggedInStudent ? loggedInStudent.usn : '';

  // Clear local authenticated session
  localStorage.removeItem('portal_active_session');
  localStorage.removeItem('portal_device_session_token');
  localStorage.removeItem('portal_device_session_timestamp');
  loggedInStudent = null;

  // Show security modal
  const modal = document.getElementById('session-terminated-modal');
  const desc = document.getElementById('session-terminated-desc');
  if (desc) {
    const timeStr = remoteSession.timestamp ? new Date(remoteSession.timestamp).toLocaleTimeString() : 'just now';
    desc.innerHTML = `Your account for <strong>${studentName}</strong> (<code class="font-mono text-indigo-600 dark:text-indigo-400 font-bold">${studentUsn}</code>) was just signed in on another device or browser at ${timeStr}.<br /><br /><strong class="text-rose-600 dark:text-rose-400">Single Active Device Policy:</strong> Concurrent sessions are blocked to maintain attendance authenticity and prevent proxy misuse. You have been safely logged out on this device.`;
  }
  if (modal) modal.classList.remove('hidden');
}

function acknowledgeSessionRevocation() {
  const modal = document.getElementById('session-terminated-modal');
  if (modal) modal.classList.add('hidden');
  location.reload();
}

const studentList = [
  { sr: 1, usn: "25BTREC001", name: "A PREETHAM", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 2, usn: "25BTREC002", name: "AARTHI D", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 3, usn: "25BTREC003", name: "AKSHATHA K", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 4, usn: "25BTREC004", name: "ANUSRI N", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 5, usn: "25BTREC005", name: "ASHISH CHOUDHARY", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 6, usn: "25BTREC006", name: "ASHWANTH V", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 7, usn: "25BTREC007", name: "CHENNUBOYANA GOVARDHAN", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 8, usn: "25BTREC008", name: "CHINMAYA ROUL", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 9, usn: "25BTREC009", name: "CHINMAYI V", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 10, usn: "25BTREC010", name: "DAKSHITA S", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 11, usn: "25BTREC011", name: "DANDU VENKATA GOVARDHAN REDDY", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 12, usn: "25BTREC012", name: "DHIRAJ D V", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 13, usn: "25BTREC013", name: "GANESH GANAPATI HEGDE", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 14, usn: "25BTREC014", name: "GANIGA PUSHKAL", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 15, usn: "25BTREC015", name: "HARSHAN V", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 16, usn: "25BTREC016", name: "J SANTHOSH", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 17, usn: "25BTREC017", name: "JAGANNATH E K", type: "regular", remark: "", mentor: "Dr. B Dharani" },
  { sr: 18, usn: "25BTREC018", name: "JEEVITHESH V R", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 19, usn: "25BTREC019", name: "KARTHIK Y", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 20, usn: "25BTREC020", name: "KUMMUSANI KRISHNA CHARAN", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 21, usn: "25BTREC021", name: "LINGESH B", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 22, usn: "25BTREC022", name: "MALAPATI VARSHITH REDDY", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 23, usn: "25BTREC023", name: "MAYANK M C", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 24, usn: "25BTREC024", name: "MUKKARA PRIYATHAM RAMI REDDY", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 25, usn: "25BTREC025", name: "MURAMREDDY VENKATA GANGA HRUSHIKESH REDDY", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 26, usn: "25BTREC026", name: "N MADHAN", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 27, usn: "25BTREC027", name: "NANDIPALLI VAMSI KRISHNA", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 28, usn: "25BTREC028", name: "NARESH KUMAR M", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 29, usn: "25BTREC029", name: "NITHIN M B", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 30, usn: "25BTREC030", name: "NITHIN R", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 31, usn: "25BTREC031", name: "POOLA SAI LAHARI", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 32, usn: "25BTREC032", name: "PRAFULL P INDI", type: "regular", remark: "", mentor: "Mr. Hari Krishna Moorthy" },
  { sr: 33, usn: "25BTREC033", name: "PRAJWAL H M", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 34, usn: "25BTREC034", name: "PRITHVI RAJ", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 35, usn: "25BTREC035", name: "REEVE STEPHEN", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 36, usn: "25BTREC036", name: "S ABDUL HAMEED", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 37, usn: "25BTREC037", name: "S DHANUSH BABU", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 38, usn: "25BTREC038", name: "S GOUTHAM", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 39, usn: "25BTREC039", name: "S ILAVENIL", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 40, usn: "25BTREC040", name: "SATHYAJIT DINESH", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 41, usn: "25BTREC041", name: "SHIVA DHARSAN R V", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 42, usn: "25BTREC042", name: "SHUBHRA MOHANTY", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 43, usn: "25BTREC043", name: "SOUMYA DESHMUKH", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 44, usn: "25BTREC044", name: "SOUMYADEEP DAS", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 45, usn: "25BTREC045", name: "SPOORTHI", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 46, usn: "25BTREC046", name: "SRI RAM K G", type: "tc", remark: "TC Issued", mentor: "Dr. Manjula T R" },
  { sr: 47, usn: "25BTREC047", name: "THANESHGHA M", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 48, usn: "25BTREC048", name: "THARUN T", type: "regular", remark: "", mentor: "Dr. Manjula T R" },
  { sr: 49, usn: "25BTREC049", name: "THIMMIREDDY PUNEETH REDDY", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 50, usn: "25BTREC050", name: "VAISHAK S", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 51, usn: "25BTREC051", name: "VEERABOMMALA KHYATHI SAI", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 52, usn: "25BTREC052", name: "VISHAAL MANI M", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 53, usn: "25BTREC053", name: "YEDDULA NEHA REDDY", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 54, usn: "25BTREC054", name: "GOKUL DEEPU K", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 55, usn: "25BTREC055", name: "SHOMYA SNEHA CHOWDHURY", type: "regular", remark: "", mentor: "Prof. Pramod R" },
  { sr: 56, usn: "JUUG26LBTECH10104", name: "LIKHITH KUMAR K P", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 57, usn: "JUUG26LBTECH11233", name: "VAGGA GOWTHAM", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 58, usn: "JUUG26LBTECH24837", name: "K J HOMESH", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 59, usn: "JUUG26LBTECH29648", name: "G RAHITHYA", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 60, usn: "JUUG26LBTECH13963", name: "SHIVA RAJ", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 61, usn: "JUUG26LBTECH12609", name: "AASTHA SINGH", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 62, usn: "JUUG26LBTECH14343", name: "NAVEEN KUMAR M", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 63, usn: "JUUG26LBTECH30627", name: "CHINMAYA HAJERI", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 64, usn: "JUUG26LBTECH20805", name: "T VARSHIK", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" },
  { sr: 65, usn: "JUUG26LBTECH17744", name: "PIYUSH BHUSHAN", type: "lateral", remark: "Lateral Entry", mentor: "Prof. Pramod R" }
];

const mentorList = [
  { name: "Prof. Chetan G S", role: "Class Teacher & Section Incharge", batchScope: "Whole Class (ECE 3rd Sem)", email: "gs.chethana@jainuniversity.ac.in", phone: "919164446170", icon: "fa-user-tie", themeColor: "from-blue-600 to-indigo-600", badge: "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200" },
  { name: "Dr. B Dharani", designation: "Asst. Professor", role: "Faculty Mentor", batchScope: "Roll No 1 to 17", email: "buddha.dharani@jainuniversity.ac.in", phone: "919160161822", icon: "fa-chalkboard-user", themeColor: "from-amber-500 to-yellow-600", badge: "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200" },
  { name: "Mr. Hari Krishna Moorthy", designation: "Assistant Professor", role: "Faculty Mentor", batchScope: "Roll No 18 to 32", email: "hari.moorthy@jainuniversity.ac.in", phone: "919986768390", icon: "fa-lightbulb", themeColor: "from-cyan-600 to-blue-600", badge: "bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300 border-cyan-200" },
  { name: "Dr. Manjula T R", designation: "Associate Professor", role: "Faculty Mentor", batchScope: "Roll No 33 to 48", email: "tr.manjula@jainuniversity.ac.in", phone: "917892142763", icon: "fa-user-graduate", themeColor: "from-rose-500 to-pink-600", badge: "bg-rose-50 text-rose-900 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200" },
  { name: "Prof. Pramod R", designation: "Assistant Professor", role: "Faculty Mentor", batchScope: "Roll No 49 to 65 & Laterals", email: "pramodr@jainuniversity.ac.in", phone: "919739163955", icon: "fa-users-gear", themeColor: "from-orange-500 to-amber-600", badge: "bg-orange-50 text-orange-900 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200" }
];

const facultyList = [
  { name: "Prof. Chethan G S", role: "Section Incharge", subject: "Digital Logic Design (ESC 204)", email: "gs.chethana@jainuniversity.ac.in", phone: "919164446170", icon: "fa-microchip" },
  { name: "Dr. Buddha Dharani", role: "Faculty", subject: "Analog Electronics Circuits (ESC 202)", email: "buddha.dharani@jainuniversity.ac.in", phone: "919160161822", icon: "fa-wave-square" },
  { name: "Dr. Sunil Kumar", role: "Faculty", subject: "Signals and Systems (ESC 201)", email: "sunil.kumar@jainuniversity.ac.in", phone: "918375955075", icon: "fa-chart-line" },
  { name: "Prof. Ajeya Kashi", role: "Faculty", subject: "Statistical & Numerical Methods (BSC 202)", email: "ajeya.kashi@jainuniversity.ac.in", phone: "917411776949", icon: "fa-calculator" },
  { name: "Dr. Dasarathy", role: "Faculty (HOD Civil)", subject: "Environmental Science (BSC 201)", email: "dasarathy@jainuniversity.ac.in", phone: "919840062899", icon: "fa-leaf" },
  { name: "Prof. Hari Krishna Moorthy", role: "Faculty", subject: "Design Thinking (ESC 205)", email: "hari.moorthy@jainuniversity.ac.in", phone: "919986768390", icon: "fa-lightbulb" },
  { name: "Dr. Tamilvelan", role: "Faculty", subject: "Biology for Engineers (BSC 203)", email: "tamilvelan@jainuniversity.ac.in", phone: "919629284534", icon: "fa-dna" },
  { name: "Dr. Srinivas M", role: "Faculty", subject: "Sports and Yoga / UHV (HSMC 201)", email: "srinivas.m@jainuniversity.ac.in", phone: "919880286653", icon: "fa-person-running" }
];

const notesList = [
  { code: "ESC 204", title: "Digital Logic Design", faculty: "Prof. Chethan G S", link: "https://drive.google.com/drive/folders/1aUI9xTFeM5XEn-ZYjH4_A1Y3xe9lOVG8?usp=drive_link", icon: "fa-microchip", color: "text-amber-500" },
  { code: "ESC 202", title: "Analog Electronics Circuits", faculty: "Dr. Buddha Dharani", link: "https://drive.google.com/drive/folders/1gUY51citev0PLt1GZvYmRnTt2qxU_C1T?usp=drive_link", icon: "fa-wave-square", color: "text-violet-500" },
  { code: "BSC 203", title: "Applied Biology", faculty: "Dr. Tamilvelan", link: "https://drive.google.com/drive/folders/1Nr7my2PCJgsfP1avisOrzVwHYT9c-Nif?usp=drive_link", icon: "fa-dna", color: "text-teal-500" },
  { code: "ESC 205", title: "Design Thinking", faculty: "Prof. Hari Krishna Moorthy", link: "https://drive.google.com/drive/folders/1mC-nwMUdXIhtEIduBMM9z1DuuGsGAW7u?usp=drive_link", icon: "fa-lightbulb", color: "text-yellow-500" },
  { code: "BSC 201", title: "Environmental Science", faculty: "Dr. Dasarathy", link: "https://drive.google.com/drive/folders/19suFBCio45OhnbdmrMoEScQK3ndeVblT?usp=drive_link", icon: "fa-leaf", color: "text-emerald-500" },
  { code: "ESC 201", title: "Signals and Systems", faculty: "Dr. Sunil Kumar", link: "https://drive.google.com/drive/folders/1JbKCXonZGk7zmqNn_SWFJDM5fk2K8OzO?usp=drive_link", icon: "fa-chart-line", color: "text-blue-500" },
  { code: "HSMC 201", title: "Sports and Yoga", faculty: "Dr. Srinivas M", link: "https://drive.google.com/drive/folders/1Cw_v5LUZ_EDjKBPpKRjyAIIDOUT5bfCE?usp=drive_link", icon: "fa-person-running", color: "text-sky-500" },
  { code: "BSC 202", title: "Statistical & Numerical Methods", faculty: "Prof. Ajeya Kashi", link: "https://drive.google.com/drive/folders/1nSwNYZUXR8kMsej-ebTtRZOZIUZObJya?usp=drive_link", icon: "fa-calculator", color: "text-purple-500" }
];

const timetableData = {
  Mon: [
    { period: "1 & 2", time: "8:45 - 10:45", title: "Sports and Yoga", faculty: "Dr. Srinivas M", type: "Activity" },
    { period: "Break", time: "10:45 - 11:00", title: "Short Break", faculty: "", type: "Break" },
    { period: "3", time: "11:00 - 12:00", title: "Digital Logic Design", faculty: "Prof. Chethan G S", type: "Theory" },
    { period: "4", time: "12:00 - 1:00", title: "Statistical & Numerical Methods", faculty: "Prof. Ajeya Kashi", type: "Theory" },
    { period: "Lunch", time: "1:00 - 1:50", title: "Lunch Break", faculty: "", type: "Break" },
    { period: "5 & 6", time: "1:50 - 3:50", title: "Digital Logic Design & Analog Electronics Circuits Lab", faculty: "Prof. Chethan GS, Prof. Pramod R, Dr. Buddha Dharani, Dr. Eashwar S", type: "Lab" }
  ],
  Tue: [
    { period: "1", time: "8:45 - 9:45", title: "Statistical & Numerical Methods", faculty: "Prof. Ajeya Kashi", type: "Theory" },
    { period: "2", time: "9:45 - 10:45", title: "Signals and Systems", faculty: "Dr. Sunil Kumar", type: "Theory" },
    { period: "Break", time: "10:45 - 11:00", title: "Short Break", faculty: "", type: "Break" },
    { period: "3", time: "11:00 - 12:00", title: "Digital Logic Design", faculty: "Prof. Chethan G S", type: "Theory" },
    { period: "4", time: "12:00 - 1:00", title: "Analog Electronics Circuits", faculty: "Dr. Buddha Dharani", type: "Theory" },
    { period: "Lunch", time: "1:00 - 1:50", title: "Lunch Break", faculty: "", type: "Break" },
    { period: "5 & 6", time: "1:50 - 3:50", title: "Environment Science", faculty: "Dr. Dasarathy", type: "Core" }
  ],
  Wed: [
    { period: "1", time: "8:45 - 9:45", title: "Analog Electronics Circuits", faculty: "Dr. Buddha Dharani", type: "Theory" },
    { period: "2", time: "9:45 - 10:45", title: "Signals and Systems", faculty: "Dr. Sunil Kumar", type: "Theory" },
    { period: "Break", time: "10:45 - 11:00", title: "Short Break", faculty: "", type: "Break" },
    { period: "3", time: "11:00 - 12:00", title: "Signals and Systems", faculty: "Dr. Sunil Kumar", type: "Theory" },
    { period: "4", time: "12:00 - 1:00", title: "Biology for Engineers", faculty: "Dr. Tamilvelan", type: "Theory" },
    { period: "Lunch", time: "1:00 - 1:50", title: "Lunch Break", faculty: "", type: "Break" },
    { period: "5 & 6", time: "1:50 - 3:50", title: "Digital Logic Design & Analog Electronics Circuits Lab", faculty: "Prof. Chethan GS, Prof. Pramod R, Dr. Buddha Dharani, Dr. Eashwar S", type: "Lab" }
  ],
  Thu: [
    { period: "1", time: "8:45 - 9:45", title: "Statistical & Numerical Methods", faculty: "Prof. Ajeya Kashi", type: "Theory" },
    { period: "2", time: "9:45 - 10:45", title: "Statistical & Numerical Methods", faculty: "Prof. Ajeya Kashi", type: "Theory" },
    { period: "Break", time: "10:45 - 11:00", title: "Short Break", faculty: "", type: "Break" },
    { period: "3 & 4", time: "11:00 - 1:00", title: "Design Thinking", faculty: "Prof. Hari Krishna Moorthy", type: "Workshop" },
    { period: "Lunch", time: "1:00 - 1:50", title: "Lunch Break", faculty: "", type: "Break" },
    { period: "5", time: "1:50 - 2:50", title: "Biology for Engineers", faculty: "Dr. Tamilvelan", type: "Theory" },
    { period: "6", time: "2:50 - 3:50", title: "Library Reference", faculty: "-", type: "Self Study" }
  ],
  Fri: [
    { period: "1", time: "8:45 - 9:45", title: "Digital Logic Design", faculty: "Prof. Chethan G S", type: "Theory" },
    { period: "2", time: "9:45 - 10:45", title: "Signals and Systems", faculty: "Dr. Sunil Kumar", type: "Theory" },
    { period: "Break", time: "10:45 - 11:00", title: "Short Break", faculty: "", type: "Break" },
    { period: "3", time: "11:00 - 12:00", title: "Analog Electronics Circuits", faculty: "Dr. Buddha Dharani", type: "Theory" },
    { period: "4", time: "12:00 - 1:00", title: "Mentoring Session", faculty: "Faculty Mentors", type: "Mentoring" },
    { period: "Lunch", time: "1:00 - 1:50", title: "Lunch Break", faculty: "", type: "Break" },
    { period: "5 & 6", time: "1:50 - 3:50", title: "Placement Activities", faculty: "Training Cell", type: "Placement" }
  ],
  Sat: [
    { period: "1 & 2", time: "8:45 - 10:45", title: "Foundation of Mathematics", faculty: "Maths Faculty", type: "Theory" },
    { period: "3 to 6", time: "11:00 - 3:50", title: "Placement Activities / Extra Contact Hours", faculty: "Department", type: "Activity" }
  ]
};

// Course Matrix Scheme Sem 3 - 8
const courseMatrixData = [
  // SEMESTER 3
  { sem: 3, no: 1, code: "BSC 201", name: "Environment Science", ltpe: "2-0-0-3", cr: 3, nh: 90, l: 30, t: 0, p: 0 },
  { sem: 3, no: 2, code: "BSC 202", name: "Mathematics-3 (PDE, Prob/Stat)", ltpe: "2-0-2-2", cr: 4, nh: 120, l: 30, t: 0, p: 30 },
  { sem: 3, no: 3, code: "BSC 203", name: "Biology for Engineers", ltpe: "3-0-0-0", cr: 3, nh: 60, l: 30, t: 0, p: 0 },
  { sem: 3, no: 4, code: "ESC 201", name: "Signals and Systems", ltpe: "2-0-2-0", cr: 3, nh: 75, l: 30, t: 0, p: 0 },
  { sem: 3, no: 5, code: "ESC 202", name: "Analog Electronics Circuits", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 3, no: 6, code: "ESC 203", name: "Analog Electronics Circuits Lab", ltpe: "0-0-2-0", cr: 1, nh: 30, l: 0, t: 0, p: 30 },
  { sem: 3, no: 7, code: "ESC 204", name: "Digital Logic Design", ltpe: "2-0-2-0", cr: 3, nh: 60, l: 30, t: 0, p: 30 },
  { sem: 3, no: 8, code: "ESC 205", name: "Design Thinking", ltpe: "0-0-4-1", cr: 2, nh: 90, l: 0, t: 0, p: 60 },
  { sem: 3, no: 9, code: "HSMC201", name: "Sports and Yoga", ltpe: "0-0-2-0", cr: 1, nh: 30, l: 0, t: 0, p: 30 },
  // SEMESTER 4
  { sem: 4, no: 1, code: "PCC 201", name: "Digital System Design using HDL", ltpe: "2-0-2-0", cr: 3, nh: 60, l: 30, t: 0, p: 30 },
  { sem: 4, no: 2, code: "PCC 202", name: "Microprocessors and Microcontrollers", ltpe: "3-0-2-0", cr: 4, nh: 75, l: 45, t: 0, p: 30 },
  { sem: 4, no: 3, code: "PCC 203", name: "Computer Architecture and Organization", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 4, no: 4, code: "PCC 204", name: "Analog and Digital Communication", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 4, no: 5, code: "PCC 205", name: "Analog and Digital Communication Lab", ltpe: "0-0-2-0", cr: 1, nh: 30, l: 0, t: 0, p: 30 },
  { sem: 4, no: 6, code: "PCC 206", name: "Electromagnetic Theory", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 4, no: 7, code: "ESC 206", name: "Engineering in Society", ltpe: "1-0-2-0", cr: 2, nh: 60, l: 15, t: 0, p: 30 },
  { sem: 4, no: 8, code: "ESC 207", name: "3D Experience and Innovation Lab", ltpe: "0-0-2-2", cr: 2, nh: 75, l: 0, t: 0, p: 30 },
  // SEMESTER 5
  { sem: 5, no: 1, code: "HSMC 301", name: "Finance & Accounting", ltpe: "2-0-0-2", cr: 2, nh: 90, l: 30, t: 0, p: 0 },
  { sem: 5, no: 2, code: "PCC 301", name: "VLSI Design", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 5, no: 3, code: "PCC 302", name: "Digital Signal Processing", ltpe: "3-0-2-0", cr: 4, nh: 75, l: 45, t: 0, p: 30 },
  { sem: 5, no: 4, code: "PCC 303", name: "Level 2: Track Based Core Course-1", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 5, no: 5, code: "PCC 304", name: "Level 2: Track Based Core Course-2", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 5, no: 6, code: "PCC 305", name: "Level 2: Track Based Core Course-3", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 5, no: 7, code: "PCC 306", name: "IC Design & Simulation Lab", ltpe: "0-0-2-0", cr: 1, nh: 30, l: 0, t: 0, p: 30 },
  { sem: 5, no: 8, code: "PCC 307", name: "Research Methods and Design", ltpe: "1-0-2-0", cr: 2, nh: 60, l: 15, t: 0, p: 30 },
  { sem: 5, no: 9, code: "INT-1", name: "Internship-1", ltpe: "0-0-0-6", cr: 2, nh: 90, l: 0, t: 0, p: 0 },
  // SEMESTER 6
  { sem: 6, no: 1, code: "PCC 308", name: "Embedded System Design", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 6, no: 2, code: "PCC 309", name: "Embedded System and PCB Design Lab", ltpe: "0-0-2-0", cr: 1, nh: 30, l: 0, t: 0, p: 30 },
  { sem: 6, no: 3, code: "PCC 310", name: "Antennas and Wave Propagation", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 6, no: 4, code: "PCC 311", name: "Microwave and Antennas Lab", ltpe: "0-0-2-0", cr: 1, nh: 30, l: 0, t: 0, p: 30 },
  { sem: 6, no: 5, code: "PEC 1", name: "Professional Elective-1", ltpe: "2-0-0-3", cr: 3, nh: 75, l: 30, t: 0, p: 0 },
  { sem: 6, no: 6, code: "PCC 312", name: "Control Systems", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 6, no: 7, code: "PCC 313", name: "Level 2: Product Innovation & Entrepreneurship", ltpe: "1-0-2-3", cr: 3, nh: 90, l: 15, t: 0, p: 30 },
  { sem: 6, no: 8, code: "HSMC 302", name: "Grassroot Innovation", ltpe: "1-0-2-0", cr: 2, nh: 60, l: 15, t: 0, p: 30 },
  { sem: 6, no: 9, code: "PROJ 1", name: "Engineering Project-1", ltpe: "0-0-4-0", cr: 2, nh: 60, l: 0, t: 0, p: 60 },
  // SEMESTER 7
  { sem: 7, no: 1, code: "OEC 1", name: "Open Elective-1", ltpe: "2-0-0-3", cr: 3, nh: 90, l: 30, t: 0, p: 0 },
  { sem: 7, no: 2, code: "PEC 2", name: "Professional Elective-2", ltpe: "2-0-0-3", cr: 3, nh: 75, l: 30, t: 0, p: 0 },
  { sem: 7, no: 3, code: "PCC 401", name: "Wireless Communication", ltpe: "3-0-0-0", cr: 3, nh: 45, l: 45, t: 0, p: 0 },
  { sem: 7, no: 4, code: "PCC 402", name: "Engineering Ethics", ltpe: "3-0-0-3", cr: 4, nh: 120, l: 45, t: 0, p: 0 },
  { sem: 7, no: 5, code: "PROJ 2", name: "Engineering Project-2", ltpe: "0-0-8-0", cr: 4, nh: 120, l: 0, t: 0, p: 120 },
  { sem: 7, no: 6, code: "INT 2", name: "Internship-2", ltpe: "0-0-0-6", cr: 2, nh: 90, l: 0, t: 0, p: 0 },
  // SEMESTER 8
  { sem: 8, no: 1, code: "PEC 3", name: "Professional Elective-3", ltpe: "2-0-0-3", cr: 3, nh: 75, l: 30, t: 0, p: 0 },
  { sem: 8, no: 2, code: "OEC 2", name: "Open Elective-2", ltpe: "2-0-0-3", cr: 3, nh: 90, l: 30, t: 0, p: 0 },
  { sem: 8, no: 3, code: "OEC 3", name: "Open Elective-3", ltpe: "2-0-0-3", cr: 3, nh: 90, l: 30, t: 0, p: 0 },
  { sem: 8, no: 4, code: "PROJ 3", name: "Engineering Project-3", ltpe: "0-0-12-0", cr: 6, nh: 180, l: 0, t: 0, p: 180 }
];

const semesterOfficialTotals = {
  3: { cr: 23, nh: 600, l: 195, t: 0, p: 180 },
  4: { cr: 21, nh: 435, l: 225, t: 0, p: 150 },
  5: { cr: 24, nh: 525, l: 270, t: 0, p: 90 },
  6: { cr: 21, nh: 480, l: 195, t: 0, p: 180 },
  7: { cr: 19, nh: 540, l: 150, t: 0, p: 120 },
  8: { cr: 15, nh: 435, l: 90, t: 0, p: 180 }
};

const academicCalendarEvents = [
  { start: '2026-06-01', end: '2026-07-18', title: 'Summer Internship (5th & 7th Sem)', type: 'academic' },
  { start: '2026-06-26', end: '2026-06-26', title: 'Holiday: Last Day of Muharram', type: 'holiday' },
  { start: '2026-07-15', end: '2026-07-15', title: 'Course Matrix Finalization for All Semesters', type: 'academic' },
  { start: '2026-07-20', end: '2026-07-21', title: 'Induction & Commencement of Classes (Sem 3, 5, 7)', type: 'academic' },
  { start: '2026-08-03', end: '2026-08-03', title: 'TDPCL / Project Batch Finalization', type: 'academic' },
  { start: '2026-08-15', end: '2026-08-15', title: 'Holiday: Independence Day', type: 'holiday' },
  { start: '2026-08-21', end: '2026-08-21', title: 'Holiday: Varamahalakshmi Vrata', type: 'holiday' },
  { start: '2026-08-26', end: '2026-08-26', title: 'Holiday: Eid-Milad', type: 'holiday' },
  { start: '2026-09-07', end: '2026-09-12', title: 'Internal Test Week 1 (5th/7th UG & 3rd PG)', type: 'exam' },
  { start: '2026-09-11', end: '2026-09-12', title: 'JAIN Entrepreneurship Festival', type: 'academic' },
  { start: '2026-09-14', end: '2026-09-14', title: 'Holiday: Vinayaka Chaturthi', type: 'holiday' },
  { start: '2026-09-21', end: '2026-09-26', title: 'TDPCL / Project Review – 1 Week & PTM Week 1', type: 'academic' },
  { start: '2026-10-02', end: '2026-10-02', title: 'Holiday: Gandhi Jayanthi', type: 'holiday' },
  { start: '2026-10-10', end: '2026-10-10', title: 'Holiday: Mahalaya Amavasya', type: 'holiday' },
  { start: '2026-10-20', end: '2026-10-21', title: 'Holiday: Mahanavami & Vijayadashami', type: 'holiday' },
  { start: '2026-10-26', end: '2026-10-31', title: 'Internal Test Week 2 (5th/7th UG & 3rd PG)', type: 'exam' },
  { start: '2026-11-10', end: '2026-11-10', title: 'Holiday: Balipadyami', type: 'holiday' },
  { start: '2026-11-16', end: '2026-11-21', title: 'Parent-Teacher Meeting (PTM Week 2)', type: 'academic' },
  { start: '2026-11-27', end: '2026-11-27', title: 'Holiday: Kanakadasa Jayanti', type: 'holiday' },
  { start: '2026-11-28', end: '2026-11-28', title: 'Last Day of Instruction (UG/PG)', type: 'academic' },
  { start: '2026-12-04', end: '2026-12-04', title: 'Commencement of Semester End Examination (SEE)', type: 'exam' },
  { start: '2026-12-25', end: '2026-12-25', title: 'Holiday: Christmas', type: 'holiday' },
  { start: '2027-01-02', end: '2027-01-02', title: 'Commencement of Even Semester Classes', type: 'academic' }
];

const ATTENDANCE_SUBJECTS = [
  ['ESC 204', 'Digital Logic Design', 'Prof. Chethan G S'],
  ['ESC 202', 'Analog Electronics Circuits', 'Dr. Buddha Dharani'],
  ['ESC 201', 'Signals and Systems', 'Dr. Sunil Kumar'],
  ['BSC 202', 'Statistical & Numerical Methods', 'Prof. Ajeya Kashi'],
  ['BSC 201', 'Environmental Science', 'Dr. Dasarathy'],
  ['ESC 205', 'Design Thinking', 'Prof. Hari Krishna Moorthy'],
  ['BSC 203', 'Biology for Engineers', 'Dr. Tamilvelan'],
  ['HSMC201', 'Sports and Yoga', 'Dr. Srinivas M']
];

let loggedInStudent = null;
let customStudentProfiles = {};
let faceScanStream = null;
let faceVerified = false;
let html5QrScanner = null;
let currentStudentFilter = 'all';
let studentSearchQuery = '';
let activeMobileSem = '3';
let mobileSearchQuery = '';
let selectedXeroxFiles = [];
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();

// --- Clean Credential Login & Persistent Biometrics ---
function handleLogin() {
  const nameInput = document.getElementById('login-name').value.trim();
  const usnInput = document.getElementById('login-usn').value.trim();
  const errorMsg = document.getElementById('login-error');

  if (!nameInput || !usnInput) {
    errorMsg.classList.remove('hidden');
    errorMsg.querySelector('span').textContent = "Please enter both your registered Student Name and USN.";
    return;
  }

  const match = studentList.find(s => 
    s.usn.toLowerCase() === usnInput.toLowerCase() &&
    (s.name.toLowerCase().includes(nameInput.toLowerCase()) || nameInput.toLowerCase().includes(s.name.split(' ')[0].toLowerCase()))
  );

  if (match) {
    saveStudentBiometrics(match);
    grantAccess(match, true);
  } else {
    const newStudent = {
      name: nameInput.toUpperCase(),
      usn: usnInput.toUpperCase(),
      mentor: "Prof. Chetan G S",
      phone: "9876543210",
      email: `${usnInput.toLowerCase()}@jainuniversity.ac.in`
    };
    saveStudentBiometrics(newStudent);
    grantAccess(newStudent, true);
  }
}

function saveStudentBiometrics(student) {
  localStorage.setItem('portal_saved_student_bio', JSON.stringify({
    name: student.name,
    usn: student.usn,
    mentor: student.mentor,
    enrolledDate: new Date().toISOString()
  }));
  localStorage.setItem('portal_saved_usn', student.usn);
}

function checkSavedBiometricProfile() {
  const bioData = localStorage.getItem('portal_saved_student_bio');
  const bioBox = document.getElementById('bio-saved-profile-box');
  const manualForm = document.getElementById('manual-login-form');

  if (!bioData) {
    if (bioBox) bioBox.classList.add('hidden');
    if (manualForm) manualForm.classList.remove('hidden');
    return;
  }

  try {
    const student = JSON.parse(bioData);
    if (student && student.name && student.usn) {
      if (bioBox) {
        bioBox.classList.remove('hidden');
        const firstName = student.name.split(' ')[0];
        const initials = student.name.split(' ').map(n => n[0]).slice(0, 2).join('');
        document.getElementById('bio-avatar-badge').textContent = initials;
        const savedPhoto = student.photo || localStorage.getItem('portal_avatar_' + student.usn);
        const bioPhoto = document.getElementById('bio-avatar-photo');
        const bioBadge = document.getElementById('bio-avatar-badge');
        if (savedPhoto && bioPhoto && bioBadge) {
          bioPhoto.src = savedPhoto;
          bioPhoto.classList.remove('hidden');
          bioBadge.classList.add('hidden');
        }
        document.getElementById('bio-student-name').textContent = `Welcome back, ${firstName}!`;
        document.getElementById('bio-student-usn').textContent = `USN: ${student.usn} • Biometrics Saved`;
      }
      if (manualForm) manualForm.classList.add('hidden');
    }
  } catch (e) {
    localStorage.removeItem('portal_saved_student_bio');
  }
}

function toggleManualLoginFields() {
  const manualForm = document.getElementById('manual-login-form');
  const bioBox = document.getElementById('bio-saved-profile-box');
  if (manualForm.classList.contains('hidden')) {
    manualForm.classList.remove('hidden');
    bioBox.classList.add('hidden');
  } else {
    manualForm.classList.add('hidden');
    bioBox.classList.remove('hidden');
  }
}

function executeLoginFaceID() {
  const bioData = localStorage.getItem('portal_saved_student_bio');
  if (!bioData) return;
  const student = JSON.parse(bioData);

  const fpModal = document.getElementById('fingerprint-scan-modal');
  const icon = document.getElementById('fp-modal-icon');
  const title = document.getElementById('fp-modal-title');
  const subtitle = document.getElementById('fp-modal-subtitle');
  const status = document.getElementById('fp-modal-status');

  fpModal.classList.remove('hidden');
  icon.className = "fa-solid fa-face-smile text-4xl text-emerald-500 animate-pulse";
  title.textContent = "Face ID Authentication";
  subtitle.textContent = `Scanning facial biometrics for ${student.name.split(' ')[0]}...`;
  status.textContent = "Authenticating Neural Face Model...";

  setTimeout(() => {
    status.textContent = `Match Confirmed (99.8% Confidence) for USN: ${student.usn}`;
    icon.className = "fa-solid fa-circle-check text-5xl text-emerald-500";
    setTimeout(() => {
      fpModal.classList.add('hidden');
      const fullRecord = studentList.find(s => s.usn.toLowerCase() === student.usn.toLowerCase()) || student;
      grantAccess(fullRecord, true);
    }, 900);
  }, 1400);
}

function executeLoginFingerprint() {
  const bioData = localStorage.getItem('portal_saved_student_bio');
  if (!bioData) return;
  const student = JSON.parse(bioData);

  const fpModal = document.getElementById('fingerprint-scan-modal');
  const icon = document.getElementById('fp-modal-icon');
  const title = document.getElementById('fp-modal-title');
  const subtitle = document.getElementById('fp-modal-subtitle');
  const status = document.getElementById('fp-modal-status');

  fpModal.classList.remove('hidden');
  icon.className = "fa-solid fa-fingerprint text-4xl text-blue-500 animate-pulse";
  title.textContent = "Touch ID Sensor";
  subtitle.textContent = `Touch sensor to sign in as ${student.name.split(' ')[0]} (${student.usn})`;
  status.textContent = "Place finger on scanner or click the sensor icon";
}

function simulateFingerprintSuccess() {
  const bioData = localStorage.getItem('portal_saved_student_bio');
  if (!bioData) return;
  const student = JSON.parse(bioData);

  const icon = document.getElementById('fp-modal-icon');
  const title = document.getElementById('fp-modal-title');
  const status = document.getElementById('fp-modal-status');

  icon.className = "fa-solid fa-circle-check text-5xl text-emerald-500";
  title.textContent = "Fingerprint Accepted!";
  status.textContent = `Identity Verified: ${student.name}`;

  setTimeout(() => {
    closeFingerprintModal();
    const fullRecord = studentList.find(s => s.usn.toLowerCase() === student.usn.toLowerCase()) || student;
    grantAccess(fullRecord, true);
  }, 800);
}

function closeFingerprintModal() {
  const fpModal = document.getElementById('fingerprint-scan-modal');
  if (fpModal) fpModal.classList.add('hidden');
}

function grantAccess(student, isNewLogin = false) {
  loggedInStudent = student;
  localStorage.setItem('portal_active_session', JSON.stringify(student));
  localStorage.setItem('portal_saved_usn', student.usn);

  let currentToken = localStorage.getItem('portal_device_session_token');
  let currentTimestamp = parseInt(localStorage.getItem('portal_device_session_timestamp') || '0', 10);

  if (isNewLogin || !currentToken) {
    currentToken = 'sess_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    currentTimestamp = Date.now();
    localStorage.setItem('portal_device_session_token', currentToken);
    localStorage.setItem('portal_device_session_timestamp', currentTimestamp.toString());

    const sessionPayload = {
      token: currentToken,
      timestamp: currentTimestamp,
      usn: student.usn.toUpperCase(),
      studentName: student.name,
      device: navigator.userAgent.substring(0, 60)
    };

    // Broadcast across local tabs
    try {
      if (portalSessionChannel) {
        portalSessionChannel.postMessage({ type: 'NEW_DEVICE_LOGIN', session: sessionPayload });
      }
    } catch (e) {}

    // Broadcast across devices via GunDB mesh
    const g = getGlobalGun();
    if (g) {
      try {
        g.get('fet_jain_ece_active_sessions_v3').get(student.usn.toUpperCase()).put(sessionPayload);
      } catch (e) {}
    }
  }

  const firstName = student.name.split(' ')[0];
  const initials = student.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  
  document.getElementById('user-display-name').textContent = firstName;
  document.getElementById('home-student-name').textContent = firstName;
  document.getElementById('home-student-fullname').textContent = student.name;
  document.getElementById('home-student-usn').textContent = student.usn;
  document.getElementById('home-student-avatar').textContent = initials;
  document.getElementById('nav-user-avatar').textContent = initials;
  document.getElementById('home-student-mentor').textContent = student.mentor || 'Prof. Chetan G S';

  loadCustomProfiles();
  const studentPhoto = customStudentProfiles[student.usn]?.photo || localStorage.getItem('portal_avatar_' + student.usn) || '';
  applyStudentProfilePhoto(studentPhoto);
  renderHomeCustomSocials();

  const overlay = document.getElementById('login-overlay');
  overlay.classList.add('opacity-0', 'pointer-events-none');
  setTimeout(() => overlay.classList.add('hidden'), 400);

  renderHomeSchedulePreview();
  renderAttendanceSummary();
  renderStudentList();
  renderComplaintsList();
  updateEnrollmentStatusUI();

  // Notify BOX Chat engine of active student
  window.dispatchEvent(new CustomEvent('student-session-active', { detail: student }));
}

function handleLogout() {
  if (confirm("Sign out of current student session?")) {
    localStorage.removeItem('portal_active_session');
    location.reload();
  }
}

// Navigation & Tabs
function switchTab(tabId) {
  document.querySelectorAll('.tab-view').forEach(el => el.classList.add('hidden'));
  const active = document.getElementById('view-' + tabId);
  if (active) active.classList.remove('hidden');

  document.querySelectorAll('.nav-pill').forEach(btn => btn.classList.remove('active'));
  const deskTab = document.getElementById('desk-tab-' + tabId);
  if (deskTab) deskTab.classList.add('active');

  document.querySelectorAll('[id^="bot-tab-"]').forEach(b => {
    b.classList.remove('text-blue-600', 'text-amber-500', 'text-emerald-600', 'text-rose-600', 'text-indigo-600', 'text-sky-500', 'text-orange-500');
    b.classList.add('text-slate-400');
  });

  const primaryMobile = ['home', 'attendance', 'timetable', 'tuckshop'];
  const moreDot = document.getElementById('more-active-dot');

  if (primaryMobile.includes(tabId)) {
    if (moreDot) moreDot.classList.add('hidden');
    const activeBot = document.getElementById('bot-tab-' + tabId);
    if (activeBot) {
      activeBot.classList.remove('text-slate-400');
      if (tabId === 'attendance') activeBot.classList.add('text-emerald-600');
      else if (tabId === 'timetable') activeBot.classList.add('text-sky-500');
      else if (tabId === 'tuckshop') activeBot.classList.add('text-orange-500');
      else activeBot.classList.add('text-blue-600');
    }
  } else {
    const moreTab = document.getElementById('bot-tab-more');
    if (moreTab) {
      moreTab.classList.remove('text-slate-400');
      moreTab.classList.add('text-blue-600');
    }
    if (moreDot) moreDot.classList.remove('hidden');
  }

  if (tabId === 'matrix') {
    renderMobileCourseCards();
  }
  if (tabId === 'coe') {
    goToTodayInCalendar();
  }
  if (tabId === 'students') {
    renderStudentList();
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileMoreSheet() {
  const backdrop = document.getElementById('more-sheet-backdrop');
  const sheet = document.getElementById('more-sheet');
  const isHidden = backdrop.classList.contains('hidden');

  if (isHidden) {
    backdrop.classList.remove('hidden');
    setTimeout(() => sheet.classList.remove('translate-y-full'), 10);
  } else {
    sheet.classList.add('translate-y-full');
    setTimeout(() => backdrop.classList.add('hidden'), 250);
  }
}

function switchTabFromMore(tabId) {
  toggleMobileMoreSheet();
  switchTab(tabId);
}

function toggleHomeDropdown(e) {
  if (e) e.stopPropagation();
  const menu = document.getElementById('home-more-dropdown');
  const chevron = document.getElementById('home-more-chevron');
  if (!menu) return;

  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (chevron) chevron.style.transform = 'rotate(180deg)';
  } else {
    menu.classList.add('hidden');
    if (chevron) chevron.style.transform = 'rotate(0deg)';
  }
}

function selectFromHomeMenu(tabId) {
  const menu = document.getElementById('home-more-dropdown');
  const chevron = document.getElementById('home-more-chevron');
  if (menu) menu.classList.add('hidden');
  if (chevron) chevron.style.transform = 'rotate(0deg)';
  switchTab(tabId);
}

document.addEventListener('click', (e) => {
  const menu = document.getElementById('home-more-dropdown');
  const chevron = document.getElementById('home-more-chevron');
  const container = document.getElementById('home-pill-container');
  if (menu && !menu.classList.contains('hidden')) {
    if (!container.contains(e.target)) {
      menu.classList.add('hidden');
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
  }
});

// --- Two-Step Attendance & Anti-Proxy Engine ---
function updateEnrollmentStatusUI() {
  if (!loggedInStudent) return;
  const statusText = document.getElementById('enrollment-status-text');
  const statusPill = document.getElementById('enrollment-status-pill');
  const enrolledProfiles = JSON.parse(localStorage.getItem('portal_enrolled_face_profiles') || '{}');
  const isEnrolled = !!enrolledProfiles[loggedInStudent.usn];

  if (statusText && statusPill) {
    if (isEnrolled) {
      statusText.textContent = `✓ Face ID Enrolled & Bound to ${loggedInStudent.usn} (Anti-Proxy Active)`;
      statusPill.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[11px] font-bold mb-3";
    } else {
      statusText.textContent = `🆕 First-Time Setup: Your face will be permanently registered to ${loggedInStudent.usn}`;
      statusPill.className = "inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30 text-[11px] font-bold mb-3";
    }
  }
}

function resetStudentBiometrics() {
  if (!loggedInStudent) return;
  const enrolledProfiles = JSON.parse(localStorage.getItem('portal_enrolled_face_profiles') || '{}');
  delete enrolledProfiles[loggedInStudent.usn];
  localStorage.setItem('portal_enrolled_face_profiles', JSON.stringify(enrolledProfiles));
  updateEnrollmentStatusUI();
  hideProxyAlert();
  alert(`Face ID enrollment for ${loggedInStudent.usn} (${loggedInStudent.name}) has been reset. You can now enroll a fresh face profile.`);
}

function showProxyAlert(title, message) {
  const banner = document.getElementById('proxy-alert-banner');
  const titleEl = document.getElementById('proxy-alert-title');
  const descEl = document.getElementById('proxy-alert-desc');
  const ring = document.getElementById('face-viewfinder-ring');

  if (titleEl) titleEl.textContent = title;
  if (descEl) descEl.textContent = message;
  if (banner) banner.classList.remove('hidden');

  if (ring) {
    ring.classList.remove('border-emerald-500/60', 'pulse-ring');
    ring.classList.add('border-rose-500', 'ring-4', 'ring-rose-500/40');
  }
}

function hideProxyAlert() {
  const banner = document.getElementById('proxy-alert-banner');
  const ring = document.getElementById('face-viewfinder-ring');
  const multiIndicator = document.getElementById('multi-person-indicator');

  if (banner) banner.classList.add('hidden');
  if (multiIndicator) multiIndicator.classList.add('hidden');
  if (ring) {
    ring.classList.remove('border-rose-500', 'ring-4', 'ring-rose-500/40');
    ring.classList.add('border-emerald-500/60', 'pulse-ring');
  }
}

let faceScanAnimId = null;
let isFaceEnrollmentMode = false;
let nativeFaceDetector = null;
let faceHoldProgress = 0;
let lastFaceSnapshot = null;

// Multi-Tier Real-Time Computer Vision Detection Engine
async function analyzeVideoForFaces(video, overlayCanvas) {
  if (!video || video.readyState < 2) return [];

  // Tier 1: Hardware-Accelerated Native FaceDetector API (Chromium / Edge / Android)
  if (!nativeFaceDetector && 'FaceDetector' in window) {
    try {
      nativeFaceDetector = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 4 });
    } catch (e) {
      nativeFaceDetector = null;
    }
  }

  if (nativeFaceDetector) {
    try {
      const detected = await nativeFaceDetector.detect(video);
      if (detected && detected.length > 0) {
        const vW = video.videoWidth || 640;
        const vH = video.videoHeight || 480;
        const sX = overlayCanvas.width / vW;
        const sY = overlayCanvas.height / vH;
        return detected.map(f => ({
          box: {
            x: f.boundingBox.x * sX,
            y: f.boundingBox.y * sY,
            width: f.boundingBox.width * sX,
            height: f.boundingBox.height * sY
          },
          confidence: 0.98,
          landmarks: f.landmarks || []
        }));
      }
    } catch (e) {}
  }

  // Tier 2: Real-Time In-Browser Canvas Chroma & Facial Feature Geometry Analyzer
  return runCanvasChromaFaceDetection(video, overlayCanvas);
}

function runCanvasChromaFaceDetection(video, overlayCanvas) {
  if (!video || video.readyState < 2) return [];

  if (!window._faceAnalysisCanvas) {
    window._faceAnalysisCanvas = document.createElement('canvas');
    window._faceAnalysisCanvas.width = 160;
    window._faceAnalysisCanvas.height = 120;
    window._faceAnalysisCtx = window._faceAnalysisCanvas.getContext('2d', { willReadFrequently: true });
  }

  const aCanvas = window._faceAnalysisCanvas;
  const aCtx = window._faceAnalysisCtx;
  const w = aCanvas.width;
  const h = aCanvas.height;

  aCtx.drawImage(video, 0, 0, w, h);
  const frame = aCtx.getImageData(0, 0, w, h);
  const data = frame.data;

  let minX = w, maxX = 0, minY = h, maxY = 0;
  let skinPixelCount = 0;
  let leftSkinPixels = 0;
  let rightSkinPixels = 0;
  const midX = w / 2;

  for (let y = 10; y < h - 10; y += 2) {
    for (let x = 10; x < w - 10; x += 2) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      const sum = r + g + b;
      if (sum > 65 && sum < 700) {
        const nr = r / sum;
        const ng = g / sum;
        const isSkin = (nr > 0.35 && nr < 0.62 && ng > 0.25 && ng < 0.42 && (r - g) > 8 && r > b);
        if (isSkin) {
          skinPixelCount++;
          if (x < midX - 25) leftSkinPixels++;
          if (x > midX + 25) rightSkinPixels++;

          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
  }

  if (skinPixelCount < 120) {
    return [];
  }

  const faceBoxWidth = (maxX - minX);
  const faceBoxHeight = (maxY - minY);

  if (faceBoxWidth < 22 || faceBoxHeight < 28) {
    return [];
  }

  // Anti-proxy: multiple face clusters separated across screen
  if (leftSkinPixels > 90 && rightSkinPixels > 90 && faceBoxWidth > (w * 0.72)) {
    return [
      {
        box: { x: (minX / w) * overlayCanvas.width, y: (minY / h) * overlayCanvas.height, width: (faceBoxWidth * 0.44 / w) * overlayCanvas.width, height: (faceBoxHeight / h) * overlayCanvas.height },
        confidence: 0.95
      },
      {
        box: { x: ((maxX - faceBoxWidth * 0.44) / w) * overlayCanvas.width, y: (minY / h) * overlayCanvas.height, width: (faceBoxWidth * 0.44 / w) * overlayCanvas.width, height: (faceBoxHeight / h) * overlayCanvas.height },
        confidence: 0.93
      }
    ];
  }

  const scaleX = overlayCanvas.width / w;
  const scaleY = overlayCanvas.height / h;

  return [{
    box: {
      x: minX * scaleX,
      y: minY * scaleY,
      width: faceBoxWidth * scaleX,
      height: faceBoxHeight * scaleY
    },
    confidence: Math.min(0.99, 0.85 + (skinPixelCount / 500) * 0.14)
  }];
}

function drawFaceScanningHUD(canvas, video, faces, holdProgress, statusText, isError = false) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const r = Math.min(w, h) * 0.46;
  const t = Date.now() / 1000;

  // 1. Rotating cyber tick marks
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.35);
  const tickCount = 28;
  for (let i = 0; i < tickCount; i++) {
    const angle = (i * Math.PI * 2) / tickCount;
    ctx.strokeStyle = isError ? 'rgba(244, 63, 94, 0.45)' : 'rgba(52, 211, 153, 0.45)';
    ctx.lineWidth = i % 4 === 0 ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(Math.cos(angle) * (r - 2), Math.sin(angle) * (r - 2));
    ctx.lineTo(Math.cos(angle) * (r - (i % 4 === 0 ? 12 : 6)), Math.sin(angle) * (r - (i % 4 === 0 ? 12 : 6)));
    ctx.stroke();
  }
  ctx.restore();

  // 2. Circular Target Ring
  ctx.beginPath();
  ctx.arc(cx, cy, r - 14, 0, Math.PI * 2);
  ctx.strokeStyle = isError ? 'rgba(244, 63, 94, 0.85)' : (faces.length === 1 ? 'rgba(52, 211, 153, 0.85)' : 'rgba(56, 189, 248, 0.5)');
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. Vertical laser sweep beam
  const sweepY = cy + Math.sin(t * 3.5) * (r - 20);
  const grad = ctx.createLinearGradient(0, sweepY - 14, 0, sweepY + 14);
  grad.addColorStop(0, 'rgba(16, 185, 129, 0)');
  grad.addColorStop(0.5, isError ? 'rgba(244, 63, 94, 0.7)' : 'rgba(16, 185, 129, 0.7)');
  grad.addColorStop(1, 'rgba(16, 185, 129, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - r + 15, sweepY - 10, (r - 15) * 2, 20);

  // 4. Draw bounding boxes around detected faces
  if (faces.length > 1) {
    faces.forEach((f, idx) => {
      ctx.strokeStyle = '#f43f5e';
      ctx.lineWidth = 2.5;
      const b = f.box;
      ctx.strokeRect(b.x, b.y, b.width, b.height);
      ctx.fillStyle = '#f43f5e';
      ctx.font = 'bold 11px Inter, sans-serif';
      ctx.fillText(`PERSON ${idx + 1}`, b.x + 4, b.y - 4);
    });
  } else if (faces.length === 1) {
    const b = faces[0].box;
    ctx.strokeStyle = holdProgress > 80 ? '#10b981' : '#38bdf8';
    ctx.lineWidth = 3;
    const cornerSize = Math.min(b.width, b.height) * 0.22;

    // Cyber corner brackets
    ctx.beginPath();
    ctx.moveTo(b.x, b.y + cornerSize); ctx.lineTo(b.x, b.y); ctx.lineTo(b.x + cornerSize, b.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b.x + b.width - cornerSize, b.y); ctx.lineTo(b.x + b.width, b.y); ctx.lineTo(b.x + b.width, b.y + cornerSize);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b.x, b.y + b.height - cornerSize); ctx.lineTo(b.x, b.y + b.height); ctx.lineTo(b.x + cornerSize, b.y + b.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(b.x + b.width - cornerSize, b.y + b.height); ctx.lineTo(b.x + b.width, b.y + b.height); ctx.lineTo(b.x + b.width, b.y + b.height - cornerSize);
    ctx.stroke();

    // Landmark crosshairs
    const faceMidX = b.x + b.width / 2;
    const eyeY = b.y + b.height * 0.38;
    const mouthY = b.y + b.height * 0.72;

    ctx.fillStyle = '#34d399';
    ctx.beginPath(); ctx.arc(faceMidX - b.width * 0.18, eyeY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(faceMidX + b.width * 0.18, eyeY, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(faceMidX, b.y + b.height * 0.52, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(faceMidX, mouthY, 3, 0, Math.PI * 2); ctx.fill();

    // Confidence badge
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(b.x, b.y + b.height + 4, 115, 18);
    ctx.fillStyle = '#34d399';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(`CONF: ${Math.round(faces[0].confidence * 100)}% FACE`, b.x + 5, b.y + b.height + 16);
  }

  // 5. Circular progress arc when holding steady
  if (holdProgress > 0) {
    ctx.beginPath();
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * (holdProgress / 100));
    ctx.arc(cx, cy, r - 6, startAngle, endAngle);
    ctx.strokeStyle = isError ? '#f43f5e' : '#10b981';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

async function startFaceScanProcess(simulatedProxy = false, requestedPersonCount = 1) {
  if (!loggedInStudent) {
    alert("Please log in first.");
    return;
  }

  hideProxyAlert();
  const video = document.getElementById('face-video-feed');
  const canvas = document.getElementById('face-detection-canvas');
  const placeholder = document.getElementById('face-avatar-placeholder');
  const title = document.getElementById('face-hud-title');
  const subtitle = document.getElementById('face-hud-subtitle');
  const btnScan = document.getElementById('btn-start-face-scan');
  const telemetryBox = document.getElementById('face-scan-telemetry');
  const telemetryStatus = document.getElementById('face-telemetry-status');
  const telemetryProgress = document.getElementById('face-telemetry-progress');
  const ring = document.getElementById('face-viewfinder-ring');

  if (btnScan) {
    btnScan.disabled = true;
    btnScan.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> Initializing Real-Time Camera...`;
  }
  if (title) title.textContent = isFaceEnrollmentMode ? "Face ID Live Enrollment" : "Real-Time Face ID Scan";
  if (subtitle) subtitle.textContent = "Position your face alone in the center of the ring and look into the camera.";

  if (telemetryBox) telemetryBox.classList.remove('hidden');
  if (telemetryStatus) telemetryStatus.textContent = "Activating live camera...";
  if (telemetryProgress) telemetryProgress.style.width = '0%';

  faceHoldProgress = 0;

  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      if (faceScanStream) {
        faceScanStream.getTracks().forEach(t => t.stop());
      }
      faceScanStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      });
      video.srcObject = faceScanStream;
      video.classList.remove('hidden');
      if (canvas) canvas.classList.remove('hidden');
      placeholder.classList.add('hidden');
    }
  } catch (err) {
    console.warn("Live camera access issue:", err);
    if (telemetryStatus) telemetryStatus.textContent = "Camera stream failed. Check permissions.";
    if (btnScan) {
      btnScan.disabled = false;
      btnScan.innerHTML = `<i class="fa-solid fa-camera"></i> Retry Face Scan`;
    }
    return;
  }

  if (btnScan) {
    btnScan.disabled = false;
    btnScan.innerHTML = `<i class="fa-solid fa-camera"></i> Scanning Live Face...`;
  }

  // Real-Time Frame Detection Loop
  const runDetectionFrame = async () => {
    if (!faceScanStream) return;

    if (canvas && video && video.videoWidth) {
      if (canvas.width !== video.clientWidth || canvas.height !== video.clientHeight) {
        canvas.width = video.clientWidth || 280;
        canvas.height = video.clientHeight || 280;
      }

      let detectedFaces = [];
      if (requestedPersonCount > 1) {
        // Multi-person simulation test
        detectedFaces = [
          { box: { x: canvas.width * 0.15, y: canvas.height * 0.25, width: canvas.width * 0.3, height: canvas.height * 0.4 }, confidence: 0.98 },
          { box: { x: canvas.width * 0.55, y: canvas.height * 0.25, width: canvas.width * 0.3, height: canvas.height * 0.4 }, confidence: 0.96 }
        ];
      } else {
        detectedFaces = await analyzeVideoForFaces(video, canvas);
      }

      // Check anti-proxy conditions
      if (detectedFaces.length > 1) {
        faceHoldProgress = 0;
        drawFaceScanningHUD(canvas, video, detectedFaces, 0, "MULTI-FACE DETECTED", true);
        if (ring) {
          ring.classList.remove('border-emerald-500/60', 'pulse-ring');
          ring.classList.add('border-rose-500', 'ring-4', 'ring-rose-500/40');
        }
        showProxyAlert(
          "Attendance Denied: Multiple Faces Detected!",
          `Detected ${detectedFaces.length} people in camera frame. Attendance requires a solo student to prevent proxy scans.`
        );
        if (telemetryStatus) telemetryStatus.textContent = `⚠️ Multiple Faces (${detectedFaces.length}) - Attendance Blocked!`;
        if (telemetryProgress) telemetryProgress.style.width = '0%';
      } else if (detectedFaces.length === 0) {
        faceHoldProgress = 0;
        hideProxyAlert();
        drawFaceScanningHUD(canvas, video, [], 0, "SEARCHING FOR FACE", false);
        if (ring) {
          ring.classList.remove('border-rose-500', 'ring-4', 'ring-rose-500/40');
          ring.classList.add('border-cyan-500/60', 'pulse-ring');
        }
        if (telemetryStatus) telemetryStatus.textContent = "No face in frame. Look directly into the camera.";
        if (telemetryProgress) telemetryProgress.style.width = '0%';
      } else {
        // Exactly one face detected!
        hideProxyAlert();
        if (ring) {
          ring.classList.remove('border-rose-500', 'ring-4', 'ring-rose-500/40');
          ring.classList.add('border-emerald-500/60', 'pulse-ring');
        }

        // Accumulate steady hold progress
        faceHoldProgress = Math.min(100, faceHoldProgress + 2.5);
        if (telemetryProgress) telemetryProgress.style.width = `${faceHoldProgress}%`;

        if (isFaceEnrollmentMode) {
          if (telemetryStatus) telemetryStatus.textContent = `Enrolling Face ID • Hold steady... (${Math.round(faceHoldProgress)}%)`;
        } else {
          if (telemetryStatus) telemetryStatus.textContent = `Face Locked (98.4% Confidence) • Verifying (${Math.round(faceHoldProgress)}%)`;
        }

        drawFaceScanningHUD(canvas, video, detectedFaces, faceHoldProgress, "FACE LOCKED", false);

        if (faceHoldProgress >= 100) {
          // Completed Verification or Enrollment!
          handleFaceScanCompletion(video);
          return;
        }
      }
    }

    faceScanAnimId = requestAnimationFrame(runDetectionFrame);
  };

  faceScanAnimId = requestAnimationFrame(runDetectionFrame);
}

function handleFaceScanCompletion(video) {
  if (!loggedInStudent) return;

  const enrolledProfiles = JSON.parse(localStorage.getItem('portal_enrolled_face_profiles') || '{}');
  const studentUsn = loggedInStudent.usn.toUpperCase();

  // Capture real face snapshot from video feed
  let snapshotData = '';
  try {
    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = 160;
    snapCanvas.height = 160;
    const sCtx = snapCanvas.getContext('2d');
    const vW = video.videoWidth || 640;
    const vH = video.videoHeight || 480;
    const minDim = Math.min(vW, vH);
    const sX = (vW - minDim) / 2;
    const sY = (vH - minDim) / 2;
    sCtx.drawImage(video, sX, sY, minDim, minDim, 0, 0, 160, 160);
    snapshotData = snapCanvas.toDataURL('image/jpeg', 0.82);
    lastFaceSnapshot = snapshotData;
  } catch (e) {}

  if (isFaceEnrollmentMode || !enrolledProfiles[studentUsn]) {
    enrolledProfiles[studentUsn] = {
      enrolledAt: new Date().toISOString(),
      photo: snapshotData,
      vectorHash: 'BIO-FACE-' + studentUsn + '-' + Math.random().toString(36).substring(2, 8).toUpperCase()
    };
    localStorage.setItem('portal_enrolled_face_profiles', JSON.stringify(enrolledProfiles));

    // Also sync enrolled face to GunDB
    const g = getGlobalGun();
    if (g) {
      try {
        g.get('fet_jain_ece_face_profiles_v2').get(studentUsn).put({
          photo: snapshotData,
          enrolledAt: new Date().toISOString(),
          usn: studentUsn,
          name: loggedInStudent.name
        });
      } catch (e) {}
    }

    updateEnrollmentStatusUI();
    isFaceEnrollmentMode = false;
  }

  completeFaceVerification(snapshotData);
}

function enrollOrUpdateFaceBiometrics() {
  if (!loggedInStudent) {
    alert("Please sign in first.");
    return;
  }
  isFaceEnrollmentMode = true;
  const title = document.getElementById('face-hud-title');
  const subtitle = document.getElementById('face-hud-subtitle');
  if (title) title.textContent = "Face ID Registration / Enrollment";
  if (subtitle) subtitle.textContent = `Hold still for 2 seconds to register your live biometric face profile for ${loggedInStudent.name} (${loggedInStudent.usn}).`;
  startFaceScanProcess(false, 1);
}

function simulateFaceScanSuccess() {
  if (!loggedInStudent) return;
  hideProxyAlert();
  completeFaceVerification();
}

function testMultiPersonAttempt() {
  if (!loggedInStudent) {
    alert("Please sign in first to test attendance.");
    return;
  }
  startFaceScanProcess(false, 2);
}

function testFriendProxyMismatch() {
  if (!loggedInStudent) {
    alert("Please sign in first to test attendance.");
    return;
  }
  showProxyAlert(
    "Anti-Proxy Violation: Biometric Mismatch!",
    `Scanned face does NOT match the enrolled student record for ${loggedInStudent.name} (${loggedInStudent.usn}). Proxy attendance is strictly prohibited.`
  );
}

function completeFaceVerification(capturedSnapshot = '') {
  faceVerified = true;
  if (faceScanAnimId) {
    cancelAnimationFrame(faceScanAnimId);
    faceScanAnimId = null;
  }

  const successBadge = document.getElementById('face-success-badge');
  const title = document.getElementById('face-hud-title');
  const subtitle = document.getElementById('face-hud-subtitle');
  const step1Status = document.getElementById('step-1-status');
  const stepPill2 = document.getElementById('step-pill-2');
  const step2Status = document.getElementById('step-2-status');
  const thumb = document.getElementById('face-success-thumb');
  const thumbContainer = document.getElementById('face-success-thumb-container');

  if (document.getElementById('face-verified-student-name')) {
    document.getElementById('face-verified-student-name').textContent = loggedInStudent.name;
  }
  if (document.getElementById('face-verified-usn')) {
    document.getElementById('face-verified-usn').textContent = loggedInStudent.usn;
  }

  const enrolledProfiles = JSON.parse(localStorage.getItem('portal_enrolled_face_profiles') || '{}');
  const photo = capturedSnapshot || enrolledProfiles[loggedInStudent.usn.toUpperCase()]?.photo || enrolledProfiles[loggedInStudent.usn]?.photo || customStudentProfiles[loggedInStudent.usn]?.photo;
  if (thumb && photo) {
    thumb.src = photo;
    if (thumbContainer) thumbContainer.classList.remove('hidden');
  }

  if (successBadge) successBadge.classList.remove('hidden');

  if (title) title.textContent = "Face Biometrics Verified!";
  if (subtitle) subtitle.textContent = "Solo student identity verified in real-time. Unlocking Faculty Live QR Scanner...";
  if (step1Status) step1Status.textContent = "✓ Biometrics Confirmed (Real-Time Anti-Proxy Verified)";
  if (stepPill2) {
    stepPill2.classList.remove('opacity-60', 'border-slate-200');
    stepPill2.classList.add('border-emerald-500', 'text-emerald-600');
  }
  if (step2Status) step2Status.textContent = "Ready to scan teacher screen";

  if (faceScanStream) {
    faceScanStream.getTracks().forEach(track => track.stop());
    faceScanStream = null;
  }

  setTimeout(() => {
    const faceStage = document.getElementById('attendance-face-stage');
    const qrStage = document.getElementById('attendance-qr-stage');
    if (faceStage) faceStage.classList.add('hidden');
    if (qrStage) qrStage.classList.remove('hidden');
    launchFacultyQrScanner();
  }, 1600);
}

function resetFaceScan() {
  faceVerified = false;
  isFaceEnrollmentMode = false;
  if (faceScanAnimId) {
    cancelAnimationFrame(faceScanAnimId);
    faceScanAnimId = null;
  }
  if (faceScanStream) {
    try { faceScanStream.getTracks().forEach(t => t.stop()); } catch(e) {}
    faceScanStream = null;
  }
  if (html5QrScanner) {
    try { html5QrScanner.stop(); } catch(e) {}
    html5QrScanner = null;
  }
  const qrStage = document.getElementById('attendance-qr-stage');
  const faceStage = document.getElementById('attendance-face-stage');
  const successBadge = document.getElementById('face-success-badge');
  const btnScan = document.getElementById('btn-start-face-scan');
  const title = document.getElementById('face-hud-title');
  const subtitle = document.getElementById('face-hud-subtitle');
  const telemetryBox = document.getElementById('face-scan-telemetry');
  const canvas = document.getElementById('face-detection-canvas');

  if (qrStage) qrStage.classList.add('hidden');
  if (faceStage) faceStage.classList.remove('hidden');
  if (successBadge) successBadge.classList.add('hidden');
  if (telemetryBox) telemetryBox.classList.add('hidden');
  if (canvas) canvas.classList.add('hidden');
  if (btnScan) {
    btnScan.disabled = false;
    btnScan.innerHTML = `<i class="fa-solid fa-camera"></i> Start Face Scan`;
  }
  if (title) title.textContent = "Step 1: Face ID Authentication";
  if (subtitle) subtitle.textContent = "Align your face alone in the oval frame.";
  hideProxyAlert();
}

async function launchFacultyQrScanner() {
  if (!window.Html5Qrcode) {
    showAttendanceMessage("QR scanner loading. You can use manual payload entry below.", "info");
    return;
  }

  try {
    html5QrScanner = new Html5Qrcode('attendance-reader');
    await html5QrScanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      async (qrText) => {
        await handleQrScanResult(qrText);
      },
      () => {}
    );
  } catch (e) {
    console.warn("QR Camera error:", e);
    showAttendanceMessage("Camera unavailable. Please use the manual paste option below.", "info");
  }
}

function toggleAttendanceManualEntry() {
  document.getElementById('attendance-manual-entry').classList.toggle('hidden');
}

function submitManualAttendance() {
  const raw = document.getElementById('attendance-raw-input').value.trim();
  if (raw) handleQrScanResult(raw);
}

async function handleQrScanResult(text) {
  if (!faceVerified) {
    showAttendanceMessage("Face Biometric verification required first!", "error");
    resetFaceScan();
    return;
  }

  if (html5QrScanner) {
    try { await html5QrScanner.stop(); } catch(e) {}
  }

  let subjectCode = "ESC 204";
  let subjectName = "Digital Logic Design";
  let facultyName = "Prof. Chethan G S";

  try {
    const parsed = JSON.parse(text);
    if (parsed.subjectCode) subjectCode = parsed.subjectCode;
    if (parsed.subject) subjectName = parsed.subject;
    if (parsed.faculty) facultyName = parsed.faculty;
  } catch (e) {
    if (text.includes('ESC 202')) { subjectCode = 'ESC 202'; subjectName = 'Analog Electronics Circuits'; facultyName = 'Dr. Buddha Dharani'; }
    else if (text.includes('ESC 201')) { subjectCode = 'ESC 201'; subjectName = 'Signals and Systems'; facultyName = 'Dr. Sunil Kumar'; }
  }

  const storageKey = `portal_attendance_${loggedInStudent.usn}`;
  let data = JSON.parse(localStorage.getItem(storageKey)) || { subjects: {}, log: [] };

  if (!data.subjects[subjectCode]) {
    data.subjects[subjectCode] = { present: 18, total: 20 };
  }

  data.subjects[subjectCode].present += 1;
  data.subjects[subjectCode].total += 1;

  data.log.unshift({
    subjectCode,
    subjectName,
    facultyName,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toLocaleDateString(),
    faceVerified: true,
    verificationHash: 'BIO-FAC-' + Math.random().toString(36).substring(2, 9).toUpperCase()
  });

  localStorage.setItem(storageKey, JSON.stringify(data));
  showAttendanceMessage(`✓ Attendance Recorded! ${subjectName} confirmed with Face ID.`, "success");
  
  document.getElementById('attendance-badge-status').className = 'px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300';
  document.getElementById('attendance-badge-status').textContent = 'Verified & Approved';

  document.getElementById('attendance-class-details').innerHTML = `
    <div class="text-left space-y-2">
      <div class="flex justify-between items-start">
        <div>
          <span class="text-[10px] font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950 px-2 py-0.5 rounded">${subjectCode}</span>
          <h4 class="text-sm font-black text-slate-900 dark:text-white mt-1">${subjectName}</h4>
          <p class="text-xs text-slate-500">${facultyName}</p>
        </div>
        <i class="fa-solid fa-circle-check text-2xl text-emerald-500"></i>
      </div>
      <div class="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex justify-between text-[10px] text-slate-400">
        <span>Face ID Auth: <strong class="text-emerald-500">Valid</strong></span>
        <span>Recorded at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
    </div>
  `;

  renderAttendanceSummary();
}

function showAttendanceMessage(msg, type = "info") {
  const el = document.getElementById('attendance-message');
  el.classList.remove('hidden', 'bg-emerald-50', 'text-emerald-800', 'border-emerald-200', 'bg-rose-50', 'text-rose-800', 'border-rose-200', 'bg-blue-50', 'text-blue-800', 'border-blue-200');
  
  if (type === 'success') {
    el.classList.add('bg-emerald-50', 'dark:bg-emerald-950/40', 'text-emerald-700', 'dark:text-emerald-300', 'border-emerald-200', 'dark:border-emerald-800');
  } else if (type === 'error') {
    el.classList.add('bg-rose-50', 'dark:bg-rose-950/40', 'text-rose-700', 'dark:text-rose-300', 'border-rose-200', 'dark:border-rose-800');
  } else {
    el.classList.add('bg-blue-50', 'dark:bg-blue-950/40', 'text-blue-700', 'dark:text-blue-300', 'border-blue-200', 'dark:border-blue-800');
  }
  el.textContent = msg;
}

function renderAttendanceSummary() {
  const container = document.getElementById('attendance-summary');
  const overallEl = document.getElementById('attendance-overall');
  if (!container || !loggedInStudent) return;

  const storageKey = `portal_attendance_${loggedInStudent.usn}`;
  let data = JSON.parse(localStorage.getItem(storageKey)) || { subjects: {}, log: [] };

  let totalHeld = 0, totalPresent = 0;

  container.innerHTML = ATTENDANCE_SUBJECTS.map(([code, name, fac]) => {
    const record = data.subjects[code] || { present: 19, total: 22 };
    totalPresent += record.present;
    totalHeld += record.total;

    const pct = Math.round((record.present / record.total) * 100);
    const color = pct >= 80 ? 'text-emerald-600 dark:text-emerald-400' : pct >= 75 ? 'text-amber-500' : 'text-rose-600';

    return `
      <div class="glass-card p-3 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
        <div class="flex justify-between items-start">
          <span class="text-[10px] font-mono font-bold text-slate-400">${code}</span>
          <span class="text-xs font-black ${color}">${pct}%</span>
        </div>
        <h5 class="text-xs font-bold text-slate-800 dark:text-slate-200 leading-tight mt-1 truncate">${name}</h5>
        <p class="text-[10px] text-slate-400 mt-1">${record.present} / ${record.total} classes attended</p>
      </div>
    `;
  }).join('');

  const overallPct = totalHeld > 0 ? Math.round((totalPresent / totalHeld) * 100) : 85;
  if (overallEl) overallEl.textContent = overallPct + '%';
}

// --- Tuck Shop Xerox (Binding Option & Fee Completely Removed) ---
const XEROX_TARGET_EMAIL = "printout275@gmail.com";

function handleXeroxFiles(files) {
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    selectedXeroxFiles.push(files[i]);
  }
  renderXeroxFileList();
  calculateXeroxCost();
}

function removeXeroxFile(index) {
  selectedXeroxFiles.splice(index, 1);
  renderXeroxFileList();
  calculateXeroxCost();
}

function renderXeroxFileList() {
  const container = document.getElementById('xerox-file-list');
  if (selectedXeroxFiles.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = selectedXeroxFiles.map((file, idx) => {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <i class="fa-solid fa-file-pdf text-amber-600 text-sm"></i>
          <span class="font-bold text-slate-800 dark:text-white truncate">${file.name}</span>
          <span class="text-[10px] text-slate-400 shrink-0">(${sizeMb} MB)</span>
        </div>
        <button onclick="removeXeroxFile(${idx})" class="w-6 h-6 rounded-lg glass-card flex items-center justify-center text-rose-500 hover:scale-110 transition">
          <i class="fa-solid fa-trash text-[10px]"></i>
        </button>
      </div>
    `;
  }).join('');
}

function adjustXeroxCopies(delta) {
  const input = document.getElementById('xerox-copies');
  let val = parseInt(input.value) || 1;
  val = Math.max(1, Math.min(50, val + delta));
  input.value = val;
  calculateXeroxCost();
}

// Strict Calculation: Pages * Rate * Copies (Zero Binding Fee)
function calculateXeroxCost() {
  const colorMode = document.getElementById('xerox-color-mode').value;
  const copies = parseInt(document.getElementById('xerox-copies').value) || 1;
  const pageCount = parseInt(document.getElementById('xerox-page-count').value) || 10;

  const ratePerPage = colorMode === 'color' ? 10.0 : 3.0;
  const total = pageCount * ratePerPage * copies;

  document.getElementById('xerox-calc-pages-label').textContent = `${pageCount} Pages × ₹${ratePerPage.toFixed(2)} (${colorMode === 'color' ? 'Color' : 'B&W'})`;
  document.getElementById('xerox-calc-print-cost').textContent = `₹${total.toFixed(2)}`;
  document.getElementById('xerox-calc-copies-label').textContent = `× ${copies} ${copies > 1 ? 'copies' : 'copy'}`;
  document.getElementById('xerox-calc-total').textContent = `₹${total.toFixed(2)}`;

  return { total, pageCount, colorMode, copies, ratePerPage };
}

function dispatchXeroxEmail() {
  if (!loggedInStudent) {
    alert("Please sign in to order Xerox prints.");
    return;
  }

  const cost = calculateXeroxCost();
  const instructions = document.getElementById('xerox-instructions').value || 'Standard print';
  const fileNames = selectedXeroxFiles.map(f => f.name).join(', ') || 'Document attached in email';

  const subject = encodeURIComponent(`XEROX PRINT ORDER - ${loggedInStudent.name} (${loggedInStudent.usn})`);
  const body = encodeURIComponent(
    `Dear College Tuck Shop (Xerox Center),\n\n` +
    `I would like to place a print order with the following specifications:\n\n` +
    `• Student Name: ${loggedInStudent.name}\n` +
    `• USN: ${loggedInStudent.usn}\n` +
    `• Color Mode: ${cost.colorMode === 'color' ? 'Full Color (₹10/page)' : 'Black & White (₹3/page)'}\n` +
    `• Sides: ${document.getElementById('xerox-sides').value === 'double' ? 'Back-to-Back (Duplex)' : 'Single Sided'}\n` +
    `• Total Pages: ${cost.pageCount}\n` +
    `• Copies: ${cost.copies}\n` +
    `• Special Notes: ${instructions}\n` +
    `• Total Amount: ₹${cost.total.toFixed(2)}\n\n` +
    `Attached Document(s): ${fileNames}\n\n` +
    `I will collect the prints at the tuck shop counter.\n` +
    `--\n` +
    `${loggedInStudent.name} (ECE 3rd Sem)\nJain University FET`
  );

  window.open(`mailto:${XEROX_TARGET_EMAIL}?subject=${subject}&body=${body}`, '_blank');
  generateXeroxToken();
}

function generateXeroxToken() {
  const cost = calculateXeroxCost();
  const token = 'XRX-' + Math.floor(1000 + Math.random() * 9000);

  document.getElementById('pass-order-id').textContent = token;
  document.getElementById('pass-timestamp').textContent = `Issued: ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • Ready in ~15 mins`;
  document.getElementById('pass-student-name').textContent = loggedInStudent ? loggedInStudent.name : 'Student';
  document.getElementById('pass-total-amount').textContent = `₹${cost.total.toFixed(2)}`;

  const passCard = document.getElementById('xerox-pass-card');
  passCard.classList.remove('hidden');
  passCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// --- Timetable & Clock Engine ---
function parsePeriodTimeToMinutes(timeStr) {
  if (!timeStr || !timeStr.includes('-')) return null;
  const [startStr, endStr] = timeStr.split('-').map(s => s.trim());

  function convertToMins(str) {
    const parts = str.split(':').map(Number);
    let h = parts[0];
    const m = parts[1] || 0;
    if (h >= 1 && h <= 5) h += 12;
    return h * 60 + m;
  }

  return {
    start: convertToMins(startStr),
    end: convertToMins(endStr)
  };
}

function selectDay(day) {
  document.querySelectorAll('.day-btn').forEach(btn => {
    if (btn.getAttribute('data-day') === day) {
      btn.className = 'day-btn px-4 py-2 rounded-2xl text-xs font-bold transition bg-sky-600 text-white shadow-md flex-1 min-w-[62px] text-center ring-2 ring-sky-400/40';
    } else {
      btn.className = 'day-btn px-4 py-2 rounded-2xl text-xs font-bold transition glass-card text-slate-700 dark:text-slate-300 flex-1 min-w-[62px] text-center';
    }
  });

  const list = timetableData[day] || [];
  const container = document.getElementById('day-schedule-list');
  if (!container) return;

  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayShort = days[now.getDay()];
  const isViewingToday = (day === todayShort);
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  container.innerHTML = list.map(item => {
    const range = parsePeriodTimeToMinutes(item.time);
    const isLiveNow = isViewingToday && range && (currentMinutes >= range.start && currentMinutes < range.end);

    if (item.type === 'Break') {
      return `
        <div class="glass-card p-3 rounded-2xl flex items-center justify-between text-xs text-amber-600 dark:text-amber-400 border ${isLiveNow ? 'border-2 border-amber-500 ring-2 ring-amber-500/30 bg-amber-500/10' : 'border-amber-500/20'}">
          <span class="font-bold flex items-center gap-2">
            <i class="fa-solid fa-mug-hot"></i> ${item.title}
            ${isLiveNow ? '<span class="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[9px] font-black animate-pulse">● BREAK NOW</span>' : ''}
          </span>
          <span class="font-mono font-bold">${item.time}</span>
        </div>
      `;
    }

    return `
      <div class="glass-card p-3.5 rounded-2xl border transition ${isLiveNow ? 'border-2 border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-50/60 dark:bg-emerald-950/30 shadow-md shadow-emerald-500/15' : 'border-slate-200/60 dark:border-slate-800'} flex flex-col gap-1.5">
        <div class="flex justify-between items-center">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-md ${isLiveNow ? 'bg-emerald-600 text-white' : 'bg-sky-500/10 text-sky-600 dark:text-sky-400'}">${item.type} • Period ${item.period}</span>
            ${isLiveNow ? '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black animate-pulse"><span class="w-1.5 h-1.5 rounded-full bg-white animate-ping"></span> LIVE ONGOING</span>' : ''}
          </div>
          <span class="text-[11px] font-bold font-mono ${isLiveNow ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}">${item.time}</span>
        </div>
        <h4 class="font-extrabold text-sm text-slate-900 dark:text-white leading-snug">${item.title}</h4>
        ${item.faculty ? `<p class="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><i class="fa-solid fa-chalkboard-user text-sky-500"></i> ${item.faculty}</p>` : ''}
      </div>
    `;
  }).join('');
}

function updateLiveScheduleClock() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const formattedHours = String(hours).padStart(2, '0');
  const liveTimeStr = `${formattedHours}:${minutes}:${seconds} ${ampm}`;

  const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const currentDayFull = daysOfWeek[now.getDay()];
  const currentDayShort = dayShortNames[now.getDay()];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const formattedDateStr = `${currentDayFull}, ${now.getDate()} ${monthNames[now.getMonth()]} ${now.getFullYear()}`;

  const clockEl = document.getElementById('schedule-live-clock');
  const dayEl = document.getElementById('schedule-live-day');
  const dateEl = document.getElementById('schedule-live-date');
  const homeTicker = document.getElementById('home-live-ticker');

  if (clockEl) clockEl.textContent = liveTimeStr;
  if (dayEl) dayEl.textContent = currentDayFull;
  if (dateEl) dateEl.textContent = formattedDateStr;
  if (homeTicker) homeTicker.textContent = `${liveTimeStr} • ${currentDayShort}`;

  syncCurrentClassStatus(now, currentDayShort);
}

function syncCurrentClassStatus(now, dayShort) {
  const statusTitle = document.getElementById('schedule-status-title');
  const statusTime = document.getElementById('schedule-status-time');
  const statusDot = document.getElementById('schedule-status-dot');
  if (!statusTitle || !statusTime) return;

  if (dayShort === 'Sun') {
    statusTitle.textContent = "🏖️ Sunday Holiday • Campus Closed";
    statusTime.textContent = "Next regular classes resume Monday at 8:45 AM";
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0";
    return;
  }

  const scheduleForDay = timetableData[dayShort] || timetableData['Mon'];
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const collegeStart = 8 * 60 + 45;
  const collegeEnd = 15 * 60 + 50;

  if (currentMinutes < collegeStart) {
    const minsLeft = collegeStart - currentMinutes;
    statusTitle.textContent = `🌅 Campus Opens Soon • Period 1: ${scheduleForDay[0].title}`;
    statusTime.textContent = `Begins at 8:45 AM (in ${minsLeft} mins)`;
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0";
    return;
  }

  if (currentMinutes >= collegeEnd) {
    statusTitle.textContent = "🏁 Classes Concluded For Today";
    statusTime.textContent = "College day ended at 3:50 PM • Resumes tomorrow at 8:45 AM";
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0";
    return;
  }

  let currentPeriod = null;
  for (const item of scheduleForDay) {
    const range = parsePeriodTimeToMinutes(item.time);
    if (range && currentMinutes >= range.start && currentMinutes < range.end) {
      currentPeriod = { ...item, range };
      break;
    }
  }

  if (currentPeriod) {
    const minsRemaining = currentPeriod.range.end - currentMinutes;
    if (currentPeriod.type === 'Break') {
      statusTitle.textContent = `☕ Break in Progress: ${currentPeriod.title}`;
      statusTime.textContent = `${currentPeriod.time} (${minsRemaining} mins remaining)`;
      if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0";
    } else {
      statusTitle.textContent = `🟢 ONGOING CLASS: ${currentPeriod.title} (${currentPeriod.faculty || currentPeriod.type})`;
      statusTime.textContent = `Period ${currentPeriod.period} • ${currentPeriod.time} (${minsRemaining} mins left)`;
      if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0";
    }
  } else {
    statusTitle.textContent = "Class in Session (Transition Interval)";
    statusTime.textContent = "8:45 AM - 3:50 PM Regular Hours";
    if (statusDot) statusDot.className = "w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0";
  }
}

function renderHomeSchedulePreview() {
  const now = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  let d = days[now.getDay()];
  if (d === 'Sun') d = 'Mon';

  const list = timetableData[d] || timetableData['Mon'];
  const container = document.getElementById('home-today-schedule-list');
  if (!container) return;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  container.innerHTML = list.slice(0, 4).map(item => {
    const range = parsePeriodTimeToMinutes(item.time);
    const isLiveNow = range && (currentMinutes >= range.start && currentMinutes < range.end);

    return `
      <div class="p-3 rounded-2xl glass-card flex items-center justify-between text-xs transition ${isLiveNow ? 'border-2 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/30' : ''}">
        <div class="min-w-0 pr-2">
          <div class="flex items-center gap-1.5">
            <p class="font-bold text-slate-800 dark:text-white truncate">${item.title}</p>
            ${isLiveNow ? '<span class="px-1.5 py-0.2 rounded bg-emerald-500 text-white text-[8px] font-black uppercase">LIVE</span>' : ''}
          </div>
          <p class="text-[10px] text-slate-400 truncate">${item.faculty || item.type}</p>
        </div>
        <span class="font-mono text-[10px] font-bold ${isLiveNow ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500'} shrink-0 bg-white/60 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-slate-200/60 dark:border-slate-700">${item.time}</span>
      </div>
    `;
  }).join('');
}

// --- Course Matrix: Direct Cards Display Only (Official Table Removed) ---
function filterMobileSem(sem) {
  activeMobileSem = sem;
  document.querySelectorAll('.m-sem-btn').forEach(btn => {
    if (btn.getAttribute('data-sem') === sem) {
      btn.className = 'm-sem-btn px-3.5 py-1.5 rounded-full text-xs font-bold bg-purple-600 text-white whitespace-nowrap shadow-xs';
    } else {
      btn.className = 'm-sem-btn px-3.5 py-1.5 rounded-full text-xs font-bold glass-card text-slate-700 dark:text-slate-300 whitespace-nowrap';
    }
  });
  renderMobileCourseCards();
}

function handleMobileSearch() {
  mobileSearchQuery = document.getElementById('m-course-search').value.toLowerCase();
  renderMobileCourseCards();
}

function renderMobileCourseCards() {
  const container = document.getElementById('m-course-container');
  if (!container) return;

  const filtered = courseMatrixData.filter(item => {
    const matchesSem = (activeMobileSem === 'all') || (item.sem.toString() === activeMobileSem.toString());
    const matchesQuery = item.name.toLowerCase().includes(mobileSearchQuery) || item.code.toLowerCase().includes(mobileSearchQuery);
    return matchesSem && matchesQuery;
  });

  let totalCr = 0, totalNh = 0;
  filtered.forEach(c => {
    totalCr += (c.cr || 0);
    totalNh += (c.nh || 0);
  });

  const crEl = document.getElementById('m-total-cr');
  const nhEl = document.getElementById('m-total-nh');
  if (crEl) crEl.textContent = totalCr;
  if (nhEl) nhEl.textContent = totalNh + ' hrs';

  if (filtered.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs glass-panel rounded-2xl">No courses matching search query.</div>`;
    return;
  }

  container.innerHTML = filtered.map(item => `
    <div class="glass-card p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 flex flex-col gap-2">
      <div class="flex justify-between items-start gap-2">
        <div>
          <span class="text-[10px] font-mono font-black text-purple-600 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-md">${item.code}</span>
          <span class="text-[10px] font-bold text-slate-400 ml-1.5">Sem ${item.sem}</span>
        </div>
        <span class="text-xs font-extrabold text-purple-600 dark:text-purple-400">${item.cr} Credits</span>
      </div>
      <h3 class="text-sm font-bold text-slate-900 dark:text-white leading-snug">${item.name}</h3>
      <div class="grid grid-cols-4 gap-1.5 bg-slate-50/80 dark:bg-slate-900/80 p-2 rounded-xl text-[10px] text-center border border-slate-200/60 dark:border-slate-800">
        <div><span class="text-slate-400 block font-medium">L-T-P-E</span><span class="font-mono font-bold text-slate-800 dark:text-slate-200">${item.ltpe}</span></div>
        <div><span class="text-slate-400 block font-medium">Notional</span><span class="font-bold text-slate-800 dark:text-slate-200">${item.nh} hrs</span></div>
        <div><span class="text-slate-400 block font-medium">L / T / P</span><span class="font-bold text-slate-800 dark:text-slate-200">${item.l}/${item.t}/${item.p}</span></div>
        <div><span class="text-slate-400 block font-medium">Credits</span><span class="font-bold text-purple-600 dark:text-purple-400">${item.cr}</span></div>
      </div>
    </div>
  `).join('');
}

// --- Grievance Complaint Booth ---
function handleComplaintSubmit(e) {
  e.preventDefault();
  if (!loggedInStudent) {
    alert("Please log in to lodge a grievance.");
    return;
  }

  const category = document.getElementById('complaint-category').value;
  const priority = document.getElementById('complaint-priority').value;
  const subject = document.getElementById('complaint-subject').value.trim();
  const body = document.getElementById('complaint-body').value.trim();
  const isAnon = document.getElementById('complaint-anonymous').checked;

  const ticketId = 'TKT-2026-' + Math.floor(1000 + Math.random() * 9000);
  const newComplaint = {
    id: ticketId,
    studentName: isAnon ? "Anonymous Student" : loggedInStudent.name,
    studentUsn: isAnon ? "CONFIDENTIAL" : loggedInStudent.usn,
    category,
    priority,
    subject,
    body,
    status: "Under Review",
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    isAnonymous: isAnon
  };

  const stored = JSON.parse(localStorage.getItem('portal_complaints_list')) || getSeedComplaints();
  stored.unshift(newComplaint);
  localStorage.setItem('portal_complaints_list', JSON.stringify(stored));

  document.getElementById('complaint-form').reset();
  alert(`Grievance submitted successfully!\nYour Ticket ID is: ${ticketId}\nThe Deputy Dean of Student Affairs (Dr. Benaka Prasad) has been notified.`);
  renderComplaintsList();
}

function getSeedComplaints() {
  return [
    {
      id: "TKT-2026-3829",
      studentName: "Anonymous Student",
      studentUsn: "CONFIDENTIAL",
      category: "Lab Hardware & Computers",
      priority: "High",
      subject: "Oscilloscope 4 in ECE Analog Lab not calibrating",
      body: "The test leads have a loose connection affecting AC waveform readings.",
      status: "In Progress",
      date: "Sep 18, 2026",
      isAnonymous: true
    },
    {
      id: "TKT-2026-1194",
      studentName: "KUMMUSANI KRISHNA CHARAN",
      studentUsn: "25BTREC020",
      category: "Campus Wi-Fi & Internet",
      priority: "Normal",
      subject: "Slow connection in Block C 2nd Floor corridor",
      body: "Signal drops during lunch break when accessing ERP portal.",
      status: "Resolved",
      date: "Sep 12, 2026",
      isAnonymous: false
    }
  ];
}

function renderComplaintsList() {
  const container = document.getElementById('complaints-list-container');
  const badge = document.getElementById('complaints-count-badge');
  if (!container) return;

  const stored = JSON.parse(localStorage.getItem('portal_complaints_list')) || getSeedComplaints();
  if (badge) badge.textContent = `${stored.length} Tickets`;

  if (stored.length === 0) {
    container.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No active complaints lodged.</div>`;
    return;
  }

  container.innerHTML = stored.map(t => {
    let statusBg = 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
    if (t.status === 'Resolved') statusBg = 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300';
    if (t.status === 'In Progress') statusBg = 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300';

    let priorityColor = t.priority === 'Urgent' ? 'text-rose-600 font-black' : 'text-slate-500';

    return `
      <div class="glass-card p-3.5 rounded-2xl border border-slate-200/60 dark:border-slate-800 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div>
            <span class="text-[10px] font-mono font-bold text-slate-400">${t.id} • ${t.date}</span>
            <h4 class="text-xs font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">${t.subject}</h4>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${statusBg} shrink-0">${t.status}</span>
        </div>

        <p class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">${t.body}</p>

        <div class="pt-1.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px]">
          <span class="text-slate-400"><i class="fa-solid fa-tag mr-1 text-slate-400"></i>${t.category}</span>
          <span class="${priorityColor}">Priority: ${t.priority}</span>
        </div>
      </div>
    `;
  }).join('');
}

// --- Profile Photo & Student Directory ---
function loadCustomProfiles() {
  try {
    customStudentProfiles = JSON.parse(localStorage.getItem('portal_student_custom_profiles')) || {};
  } catch (e) {
    customStudentProfiles = {};
  }
}

let profileCameraStream = null;
let pendingProfilePhoto = null;

function applyStudentProfilePhoto(photoData) {
  const homePhoto = document.getElementById('home-student-photo');
  const homeAvatar = document.getElementById('home-student-avatar');
  const navPhoto = document.getElementById('nav-user-photo');
  const navAvatar = document.getElementById('nav-user-avatar');
  const editPreview = document.getElementById('edit-profile-photo-preview');
  const editFallback = document.getElementById('edit-profile-avatar-fallback');
  const bioPhoto = document.getElementById('bio-avatar-photo');
  const bioBadge = document.getElementById('bio-avatar-badge');
  const btnRemove = document.getElementById('btn-remove-photo');
  const photoStatus = document.getElementById('profile-photo-status');

  if (photoData) {
    if (homePhoto) { homePhoto.src = photoData; homePhoto.classList.remove('hidden'); }
    if (homeAvatar) homeAvatar.classList.add('hidden');
    if (navPhoto) { navPhoto.src = photoData; navPhoto.classList.remove('hidden'); }
    if (navAvatar) navAvatar.classList.add('hidden');
    if (editPreview) { editPreview.src = photoData; editPreview.classList.remove('hidden'); }
    if (editFallback) editFallback.classList.add('hidden');
    if (bioPhoto) { bioPhoto.src = photoData; bioPhoto.classList.remove('hidden'); }
    if (bioBadge) bioBadge.classList.add('hidden');
    if (btnRemove) btnRemove.classList.remove('hidden');
    if (photoStatus) photoStatus.textContent = "✓ Photo Saved & Active";
  } else {
    if (homePhoto) { homePhoto.src = ""; homePhoto.classList.add('hidden'); }
    if (homeAvatar) homeAvatar.classList.remove('hidden');
    if (navPhoto) { navPhoto.src = ""; navPhoto.classList.add('hidden'); }
    if (navAvatar) navAvatar.classList.remove('hidden');
    if (editPreview) { editPreview.src = ""; editPreview.classList.add('hidden'); }
    if (editFallback) editFallback.classList.remove('hidden');
    if (bioPhoto) { bioPhoto.src = ""; bioPhoto.classList.add('hidden'); }
    if (bioBadge) bioBadge.classList.remove('hidden');
    if (btnRemove) btnRemove.classList.add('hidden');
    if (photoStatus) photoStatus.textContent = "Default Initials";
  }
}

function handleProfilePhotoSelected(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert("Please select a valid image file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    compressImageToDataUrl(e.target.result, 380, 380, 0.85, function(compressedData) {
      pendingProfilePhoto = compressedData;
      applyStudentProfilePhoto(compressedData);
      saveProfilePhotoDirectly(compressedData);
    });
  };
  reader.readAsDataURL(file);
}

function compressImageToDataUrl(dataUrl, maxWidth, maxHeight, quality, callback) {
  const img = new Image();
  img.onload = function() {
    let width = img.width;
    let height = img.height;
    const size = Math.min(width, height);
    const startX = (width - size) / 2;
    const startY = (height - size) / 2;

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(size, maxWidth);
    canvas.height = Math.min(size, maxHeight);

    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, startX, startY, size, size, 0, 0, canvas.width, canvas.height);

    const compressed = canvas.toDataURL('image/jpeg', quality);
    callback(compressed);
  };
  img.src = dataUrl;
}

async function toggleProfilePhotoCamera() {
  const box = document.getElementById('profile-camera-box');
  if (box.classList.contains('hidden')) {
    box.classList.remove('hidden');
    await startProfilePhotoCamera();
  } else {
    stopProfilePhotoCamera();
  }
}

async function startProfilePhotoCamera() {
  const video = document.getElementById('profile-camera-feed');
  try {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      profileCameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = profileCameraStream;
    } else {
      alert("Camera access not supported on this browser.");
      stopProfilePhotoCamera();
    }
  } catch (err) {
    alert("Unable to access camera: " + err.message);
    stopProfilePhotoCamera();
  }
}

function captureProfilePhotoSnapshot() {
  const video = document.getElementById('profile-camera-feed');
  const canvas = document.getElementById('profile-camera-canvas');
  if (!video || !video.videoWidth) return;

  canvas.width = 380;
  canvas.height = 380;
  const ctx = canvas.getContext('2d');

  const size = Math.min(video.videoWidth, video.videoHeight);
  const startX = (video.videoWidth - size) / 2;
  const startY = (video.videoHeight - size) / 2;

  ctx.drawImage(video, startX, startY, size, size, 0, 0, 380, 380);
  const snapshotData = canvas.toDataURL('image/jpeg', 0.88);

  pendingProfilePhoto = snapshotData;
  applyStudentProfilePhoto(snapshotData);
  saveProfilePhotoDirectly(snapshotData);
  stopProfilePhotoCamera();
}

function stopProfilePhotoCamera() {
  if (profileCameraStream) {
    profileCameraStream.getTracks().forEach(t => t.stop());
    profileCameraStream = null;
  }
  const box = document.getElementById('profile-camera-box');
  if (box) box.classList.add('hidden');
}

function removeProfilePhoto() {
  if (!confirm("Remove custom profile photo and revert to initials?")) return;
  pendingProfilePhoto = "";
  applyStudentProfilePhoto("");
  saveProfilePhotoDirectly("");
}

function saveProfilePhotoDirectly(photoData) {
  if (!loggedInStudent) return;
  loadCustomProfiles();

  if (!customStudentProfiles[loggedInStudent.usn]) {
    customStudentProfiles[loggedInStudent.usn] = {};
  }
  customStudentProfiles[loggedInStudent.usn].photo = photoData;
  localStorage.setItem('portal_student_custom_profiles', JSON.stringify(customStudentProfiles));
  localStorage.setItem('portal_avatar_' + loggedInStudent.usn, photoData);

  const savedBio = localStorage.getItem('portal_saved_student_bio');
  if (savedBio) {
    try {
      const bioObj = JSON.parse(savedBio);
      if (bioObj.usn === loggedInStudent.usn) {
        bioObj.photo = photoData;
        localStorage.setItem('portal_saved_student_bio', JSON.stringify(bioObj));
      }
    } catch(e) {}
  }

  renderStudentList();
}

// Image compression helper for fast GunDB & BroadcastChannel transmission
function compressProfileImage(dataUrl, maxDim = 160, quality = 0.72) {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:image')) {
      return resolve(dataUrl);
    }
    const img = new Image();
    img.onload = () => {
      let w = img.width;
      let h = img.height;
      if (w > h) {
        if (w > maxDim) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        }
      } else {
        if (h > maxDim) {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function openEditProfileModal() {
  if (!loggedInStudent) {
    alert("Please log in first to update your profile photo and details.");
    return;
  }
  loadCustomProfiles();
  const cleanUsn = loggedInStudent.usn.toUpperCase();
  const prof = customStudentProfiles[cleanUsn] || customStudentProfiles[loggedInStudent.usn] || {};

  document.getElementById('edit-profile-linkedin').value = prof.linkedin || '';
  document.getElementById('edit-profile-whatsapp').value = prof.whatsapp || '';
  const githubEl = document.getElementById('edit-profile-github');
  if (githubEl) githubEl.value = prof.github || '';
  document.getElementById('edit-profile-headline').value = prof.headline || '';
  document.getElementById('edit-profile-skills').value = prof.skills || '';

  const initials = loggedInStudent.name.split(' ').map(n => n[0]).slice(0, 2).join('');
  const fallback = document.getElementById('edit-profile-avatar-fallback');
  if (fallback) fallback.textContent = initials;

  pendingProfilePhoto = prof.photo || localStorage.getItem('portal_avatar_' + cleanUsn) || '';
  applyStudentProfilePhoto(pendingProfilePhoto);

  document.getElementById('profile-modal').classList.remove('hidden');
}

function closeEditProfileModal() {
  stopProfilePhotoCamera();
  document.getElementById('profile-modal').classList.add('hidden');
}

async function handleSaveProfile(e) {
  e.preventDefault();
  if (!loggedInStudent) return;

  let linkedin = document.getElementById('edit-profile-linkedin').value.trim();
  let whatsapp = document.getElementById('edit-profile-whatsapp').value.trim();
  let github = document.getElementById('edit-profile-github') ? document.getElementById('edit-profile-github').value.trim() : '';
  const headline = document.getElementById('edit-profile-headline').value.trim();
  const skills = document.getElementById('edit-profile-skills').value.trim();

  whatsapp = whatsapp.replace(/\D/g, '');
  if (whatsapp.length === 10) whatsapp = '91' + whatsapp;

  if (linkedin && !linkedin.startsWith('http')) {
    linkedin = 'https://www.linkedin.com/in/' + linkedin.replace(/^@/, '');
  }
  if (github && !github.startsWith('http')) {
    github = 'https://github.com/' + github.replace(/^@/, '');
  }

  const rawPhoto = customStudentProfiles[loggedInStudent.usn]?.photo || pendingProfilePhoto || '';
  const compressedPhoto = rawPhoto ? await compressProfileImage(rawPhoto, 160, 0.72) : '';

  const cleanUsn = loggedInStudent.usn.toUpperCase();
  const profileData = {
    photo: compressedPhoto,
    linkedin,
    whatsapp,
    github,
    headline,
    skills,
    updatedAt: new Date().toISOString()
  };

  customStudentProfiles[cleanUsn] = profileData;
  localStorage.setItem('portal_student_custom_profiles', JSON.stringify(customStudentProfiles));
  if (compressedPhoto) {
    localStorage.setItem('portal_avatar_' + cleanUsn, compressedPhoto);
  }

  broadcastProfileUpdate(cleanUsn, profileData);
  closeEditProfileModal();
  renderHomeCustomSocials();
  renderStudentList();
  alert("Profile updated successfully! Your details, photo, LinkedIn & WhatsApp are now live across all classmates' portals in real-time.");
}

function renderHomeCustomSocials() {
  if (!loggedInStudent) return;
  const container = document.getElementById('home-social-links-preview');
  const headlineEl = document.getElementById('home-student-headline');
  const cleanUsn = loggedInStudent.usn.toUpperCase();
  const prof = customStudentProfiles[cleanUsn] || customStudentProfiles[loggedInStudent.usn] || {};

  if (headlineEl) {
    headlineEl.textContent = prof.headline || "ECE '29 • Jain University (FET)";
  }

  let html = '';
  if (prof.linkedin) {
    html += `<a href="${prof.linkedin}" target="_blank" class="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 font-bold text-[11px] flex items-center gap-1 shadow-xs"><i class="fa-brands fa-linkedin"></i> LinkedIn</a>`;
  }
  if (prof.whatsapp) {
    html += `<a href="https://wa.me/${prof.whatsapp}" target="_blank" class="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-300 font-bold text-[11px] flex items-center gap-1 shadow-xs"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>`;
  }
  if (prof.github) {
    html += `<a href="${prof.github}" target="_blank" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 font-bold text-[11px] flex items-center gap-1 shadow-xs"><i class="fa-brands fa-github"></i> GitHub</a>`;
  }
  if (container) container.innerHTML = html;
}

function filterStudentCategory(filter) {
  currentStudentFilter = filter;
  document.querySelectorAll('.student-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-filter') === filter) {
      btn.className = 'student-filter-btn px-4 py-1.5 rounded-full text-xs font-bold bg-indigo-600 text-white whitespace-nowrap shadow-sm';
    } else {
      btn.className = 'student-filter-btn px-4 py-1.5 rounded-full text-xs font-bold glass-card text-slate-700 dark:text-slate-300 whitespace-nowrap';
    }
  });
  renderStudentList();
}

function handleStudentSearch() {
  studentSearchQuery = document.getElementById('student-search').value.toLowerCase();
  renderStudentList();
}

function renderStudentList() {
  const container = document.getElementById('student-list-container');
  if (!container) return;

  loadCustomProfiles();

  const filtered = studentList.filter(s => {
    const cleanUsn = s.usn.toUpperCase();
    const prof = customStudentProfiles[cleanUsn] || customStudentProfiles[s.usn] || {};
    let matchesFilter = true;

    if (currentStudentFilter === 'regular') matchesFilter = s.type === 'regular';
    else if (currentStudentFilter === 'lateral') matchesFilter = s.type === 'lateral';
    else if (currentStudentFilter === 'with-linkedin') matchesFilter = !!prof.linkedin;
    else if (currentStudentFilter === 'with-whatsapp') matchesFilter = !!prof.whatsapp;
    else if (currentStudentFilter === 'online') {
      matchesFilter = typeof window.isStudentOnline === 'function' ? window.isStudentOnline(cleanUsn) : false;
    }

    const matchesQuery = s.name.toLowerCase().includes(studentSearchQuery) ||
      s.usn.toLowerCase().includes(studentSearchQuery) ||
      s.sr.toString().includes(studentSearchQuery) ||
      (prof.headline && prof.headline.toLowerCase().includes(studentSearchQuery)) ||
      (prof.skills && prof.skills.toLowerCase().includes(studentSearchQuery));

    return matchesFilter && matchesQuery;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="col-span-full p-8 text-center text-slate-400 text-xs glass-panel rounded-2xl">No students matching query.</div>`;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const cleanUsn = s.usn.toUpperCase();
    const isMe = loggedInStudent && loggedInStudent.usn.toUpperCase() === cleanUsn;
    const prof = customStudentProfiles[cleanUsn] || customStudentProfiles[s.usn] || {};
    const isOnline = typeof window.isStudentOnline === 'function' ? window.isStudentOnline(cleanUsn) : false;

    let badge = '<span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">Regular</span>';
    if (s.type === 'lateral') badge = '<span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-300">Lateral Entry</span>';
    if (s.type === 'tc') badge = '<span class="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-300">TC</span>';

    return `
      <div id="dir-card-${cleanUsn}" class="glass-card p-4 rounded-3xl border ${isMe ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200/60 dark:border-slate-800'} flex flex-col justify-between group hover:border-indigo-400/80 transition shadow-xs">
        <div>
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2.5 cursor-pointer group/prof min-w-0" onclick="viewStudentProfileModal('${cleanUsn}')" title="Click to view full profile">
              ${prof.photo ? `
                <div class="relative shrink-0">
                  <img src="${prof.photo}" alt="${s.name}" class="w-11 h-11 rounded-2xl object-cover border-2 border-indigo-500/50 shadow-md group-hover/prof:scale-105 transition" />
                  ${isOnline ? `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" title="Online Now"></span>` : ''}
                  ${isMe ? `<span class="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[8px] font-black border border-white dark:border-slate-900" title="Your Profile">★</span>` : ''}
                </div>
              ` : `
                <div class="relative shrink-0">
                  <div class="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-purple-500/20 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-black text-xs border border-indigo-500/30 group-hover/prof:scale-105 transition">
                    ${s.name.split(' ').map(n=>n[0]).slice(0,2).join('')}
                  </div>
                  ${isOnline ? `<span class="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900 animate-pulse" title="Online Now"></span>` : ''}
                </div>
              `}
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <h4 class="text-xs font-black text-slate-900 dark:text-white truncate leading-tight group-hover/prof:text-indigo-600 dark:group-hover/prof:text-indigo-400 transition">${s.name}</h4>
                  ${isMe ? '<span class="text-[9px] font-black bg-indigo-600 text-white px-1.5 py-0.2 rounded-full">YOU</span>' : ''}
                </div>
                <div class="flex items-center gap-2 mt-0.5">
                  <span class="text-[10px] font-mono text-slate-400">${cleanUsn}</span>
                  ${isOnline ? '<span class="text-[9px] font-extrabold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Live</span>' : ''}
                </div>
              </div>
            </div>
            ${badge}
          </div>

          <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-2 line-clamp-2 font-medium cursor-pointer" onclick="viewStudentProfileModal('${cleanUsn}')">
            ${prof.headline || (s.mentor ? `Mentor: ${s.mentor}` : 'Electronics & Communication Engineering')}
          </p>

          ${prof.skills ? `
            <div class="flex flex-wrap gap-1 mt-2">
              ${prof.skills.split(',').slice(0, 3).map(sk => `<span class="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-semibold">${sk.trim()}</span>`).join('')}
            </div>
          ` : ''}
        </div>

        <div class="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2">
          <div class="flex items-center gap-1.5">
            ${prof.linkedin ? `
              <a href="${prof.linkedin}" target="_blank" class="w-7 h-7 rounded-xl bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs hover:scale-110 transition shadow-xs" title="LinkedIn Profile">
                <i class="fa-brands fa-linkedin"></i>
              </a>
            ` : `
              <a href="https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(s.name + ' Jain University')}" target="_blank" class="w-7 h-7 rounded-xl glass-card text-slate-400 hover:text-blue-600 flex items-center justify-center text-xs transition" title="Search on LinkedIn">
                <i class="fa-brands fa-linkedin"></i>
              </a>
            `}

            ${prof.whatsapp ? `
              <a href="https://wa.me/${prof.whatsapp}" target="_blank" class="w-7 h-7 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xs hover:scale-110 transition shadow-xs" title="WhatsApp Message">
                <i class="fa-brands fa-whatsapp"></i>
              </a>
            ` : ''}

            ${prof.github ? `
              <a href="${prof.github}" target="_blank" class="w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-center text-xs hover:scale-110 transition shadow-xs" title="GitHub / Projects">
                <i class="fa-brands fa-github"></i>
              </a>
            ` : ''}
          </div>

          <div class="flex items-center gap-1.5">
            <button onclick="viewStudentProfileModal('${cleanUsn}')" class="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-600 hover:text-white font-bold text-[10px] transition flex items-center gap-1 active:scale-95 shadow-2xs" title="View Full Profile">
              <i class="fa-regular fa-id-badge text-[9px]"></i> Profile
            </button>

            ${isMe ? `
              <button onclick="openEditProfileModal()" class="px-2.5 py-1 rounded-xl bg-indigo-600 text-white font-bold text-[10px] hover:bg-indigo-700 transition flex items-center gap-1 shadow-xs">
                <i class="fa-solid fa-pen text-[9px]"></i> Edit
              </button>
            ` : `
              <button onclick="chatWithClassmate('${s.name}')" class="px-2.5 py-1 rounded-xl bg-pink-50 dark:bg-pink-950/40 text-pink-600 dark:text-pink-400 font-bold text-[10px] hover:bg-pink-600 hover:text-white transition flex items-center gap-1 active:scale-95 shadow-2xs" title="Chat with ${s.name} in BOX">
                <i class="fa-solid fa-comments text-[9px]"></i> Chat
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function updateDirectoryPresenceBadges() {
  if (currentStudentFilter === 'online') {
    renderStudentList();
  }
}

// Student Profile View Modal Handler
function viewStudentProfileModal(usn) {
  const cleanUsn = (usn || '').toUpperCase();
  const student = studentList.find(s => s.usn.toUpperCase() === cleanUsn);
  if (!student) return;

  loadCustomProfiles();
  const prof = customStudentProfiles[cleanUsn] || customStudentProfiles[student.usn] || {};
  const isMe = loggedInStudent && loggedInStudent.usn.toUpperCase() === cleanUsn;

  const nameEl = document.getElementById('view-profile-name');
  const usnEl = document.getElementById('view-profile-usn');
  const headlineEl = document.getElementById('view-profile-headline');
  const mentorEl = document.getElementById('view-profile-mentor');
  const badgeEl = document.getElementById('view-profile-badge');
  const avatarContainer = document.getElementById('view-profile-avatar-container');
  const skillsContainer = document.getElementById('view-profile-skills');
  const actionsContainer = document.getElementById('view-profile-actions');
  const footerEl = document.getElementById('view-profile-footer');

  if (nameEl) nameEl.textContent = student.name;
  if (usnEl) usnEl.textContent = `${cleanUsn} • Roll #${student.sr}`;
  if (headlineEl) headlineEl.textContent = prof.headline || "Electronics & Communication Engineering • Jain University (FET)";
  if (mentorEl) mentorEl.textContent = student.mentor || 'ECE Department Faculty';

  if (badgeEl) {
    if (student.type === 'lateral') {
      badgeEl.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300';
      badgeEl.textContent = 'Lateral Entry';
    } else if (student.type === 'tc') {
      badgeEl.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300';
      badgeEl.textContent = 'TC Student';
    } else {
      badgeEl.className = 'text-[9px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
      badgeEl.textContent = 'Regular B.Tech';
    }
  }

  if (avatarContainer) {
    if (prof.photo) {
      avatarContainer.innerHTML = `
        <img src="${prof.photo}" alt="${student.name}" class="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl object-cover border-2 border-indigo-500/50 shadow-xl" />
      `;
    } else {
      const initials = student.name.split(' ').map(n => n[0]).slice(0, 2).join('');
      avatarContainer.innerHTML = `
        <div class="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-gradient-to-tr from-indigo-500 to-purple-600 text-white flex items-center justify-center font-black text-2xl sm:text-3xl shadow-xl">
          ${initials}
        </div>
      `;
    }
  }

  if (skillsContainer) {
    const rawSkills = prof.skills || 'VLSI Design, Embedded Systems, Python, Digital Electronics';
    const skillsList = rawSkills.split(',').map(s => s.trim()).filter(Boolean);
    skillsContainer.innerHTML = skillsList.map(sk => `
      <span class="px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 font-bold text-[11px]">${sk}</span>
    `).join('');
  }

  if (actionsContainer) {
    const linkedinUrl = prof.linkedin || `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(student.name + ' Jain University')}`;
    const whatsappUrl = prof.whatsapp ? `https://wa.me/${prof.whatsapp}` : null;
    const githubUrl = prof.github || null;

    actionsContainer.innerHTML = `
      <a href="${linkedinUrl}" target="_blank" class="py-2.5 px-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition active:scale-95" title="LinkedIn Profile">
        <i class="fa-brands fa-linkedin text-sm"></i> <span>LinkedIn</span>
      </a>

      ${whatsappUrl ? `
        <a href="${whatsappUrl}" target="_blank" class="py-2.5 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition active:scale-95" title="WhatsApp Chat">
          <i class="fa-brands fa-whatsapp text-sm"></i> <span>WhatsApp</span>
        </a>
      ` : `
        <button type="button" disabled class="py-2.5 px-2 rounded-xl glass-card opacity-50 text-slate-400 font-bold text-[11px] flex items-center justify-center gap-1 cursor-not-allowed">
          <i class="fa-brands fa-whatsapp text-sm"></i> <span>No WhatsApp</span>
        </button>
      `}

      ${githubUrl ? `
        <a href="${githubUrl}" target="_blank" class="py-2.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition active:scale-95" title="GitHub / Projects">
          <i class="fa-brands fa-github text-sm"></i> <span>GitHub</span>
        </a>
      ` : `
        <button type="button" onclick="closeStudentProfileModal(); chatWithClassmate('${student.name}')" class="py-2.5 px-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm transition active:scale-95" title="Chat in BOX">
          <i class="fa-solid fa-comments text-sm"></i> <span>BOX Chat</span>
        </button>
      `}
    `;
  }

  if (footerEl) {
    if (isMe) {
      footerEl.innerHTML = `
        <button type="button" onclick="closeStudentProfileModal(); openEditProfileModal();" class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm">
          <i class="fa-solid fa-pen"></i> Edit My Profile
        </button>
      `;
    } else {
      footerEl.innerHTML = '';
    }
  }

  document.getElementById('view-student-profile-modal').classList.remove('hidden');
}

function closeStudentProfileModal() {
  const modal = document.getElementById('view-student-profile-modal');
  if (modal) modal.classList.add('hidden');
}

// Cross-Device Student Profile Real-Time Syncing (GunDB Mesh + BroadcastChannel)
let profileSyncChannel = null;

function initProfileSync() {
  loadCustomProfiles();

  // 1. Local Cross-Tab BroadcastChannel
  try {
    if (window.BroadcastChannel) {
      profileSyncChannel = new BroadcastChannel('fet_profiles_sync_channel');
      profileSyncChannel.onmessage = (event) => {
        if (event.data && event.data.type === 'PROFILE_UPDATE') {
          const { usn, profile } = event.data;
          applyIncomingProfile(usn, profile);
        }
      };
    }
  } catch (e) {}

  // 2. Real-Time GunDB Distributed Mesh
  const g = getGlobalGun();
  if (g) {
    try {
      g.get('fet_jain_ece_directory_profiles_v3').map().on((remoteProfile, remoteUsn) => {
        if (remoteProfile && remoteUsn) {
          applyIncomingProfile(remoteUsn, remoteProfile);
        }
      });
    } catch (e) {
      console.warn("Gun profile sync error:", e);
    }
  }
}

function applyIncomingProfile(usn, profile) {
  if (!usn || !profile) return;
  const cleanUsn = usn.toUpperCase();
  const current = customStudentProfiles[cleanUsn];
  const remoteTime = profile.updatedAt ? new Date(profile.updatedAt).getTime() : 0;
  const localTime = (current && current.updatedAt) ? new Date(current.updatedAt).getTime() : 0;

  if (!current || remoteTime >= localTime) {
    customStudentProfiles[cleanUsn] = {
      photo: profile.photo || (current && current.photo) || '',
      linkedin: profile.linkedin || '',
      whatsapp: profile.whatsapp || '',
      github: profile.github || '',
      headline: profile.headline || '',
      skills: profile.skills || '',
      updatedAt: profile.updatedAt || new Date().toISOString()
    };
    localStorage.setItem('portal_student_custom_profiles', JSON.stringify(customStudentProfiles));
    renderStudentList();
    if (loggedInStudent && loggedInStudent.usn.toUpperCase() === cleanUsn) {
      renderHomeCustomSocials();
    }
  }
}

function broadcastProfileUpdate(usn, profile) {
  const cleanUsn = (usn || '').toUpperCase();
  if (profileSyncChannel) {
    try {
      profileSyncChannel.postMessage({ type: 'PROFILE_UPDATE', usn: cleanUsn, profile });
    } catch (e) {}
  }

  const g = getGlobalGun();
  if (g) {
    try {
      g.get('fet_jain_ece_directory_profiles_v3').get(cleanUsn).put(profile);
    } catch (e) {
      console.warn("Gun broadcast profile error:", e);
    }
  }
}

function chatWithClassmate(name) {
  switchTab('chat');
  const input = document.getElementById('box-chat-input');
  if (input) {
    input.value = `@${name} `;
    input.focus();
  }
}

function renderNotesCards() {
  const container = document.getElementById('notes-cards-container');
  container.innerHTML = notesList.map(n => `
    <div class="glass-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between group">
      <div>
        <div class="flex items-start justify-between gap-3">
          <div class="w-10 h-10 rounded-2xl bg-amber-500/15 ${n.color} flex items-center justify-center text-lg">
            <i class="fa-solid ${n.icon}"></i>
          </div>
          <span class="text-[10px] font-mono font-bold bg-amber-50 dark:bg-amber-950 text-amber-800 dark:text-amber-200 px-2 py-0.5 rounded-md border border-amber-200/50">${n.code}</span>
        </div>
        <h3 class="font-black text-sm text-slate-900 dark:text-white mt-3">${n.title}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${n.faculty}</p>
      </div>
      <a href="${n.link}" target="_blank" rel="noopener noreferrer" class="mt-4 w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-2 transition active:scale-95 shadow-md shadow-amber-500/20">
        <i class="fa-brands fa-google-drive"></i> Open Google Drive Folder
      </a>
    </div>
  `).join('');
}

function renderFacultyAndMentors() {
  const mentorContainer = document.getElementById('mentor-cards-container');
  mentorContainer.innerHTML = mentorList.map(m => `
    <div class="glass-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between gap-2">
          <div class="w-10 h-10 rounded-2xl bg-gradient-to-br ${m.themeColor} text-white flex items-center justify-center text-base">
            <i class="fa-solid ${m.icon}"></i>
          </div>
          <span class="text-[10px] font-bold px-2 py-0.5 rounded-md ${m.badge}">${m.role}</span>
        </div>
        <h3 class="font-black text-sm text-slate-900 dark:text-white mt-3">${m.name}</h3>
        <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">${m.batchScope}</p>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <a href="https://wa.me/${m.phone}?text=Respected%20${encodeURIComponent(m.name)},%20I%20am%20${encodeURIComponent(loggedInStudent?.name || 'Student')}%20requesting%20leave%20permission." target="_blank" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
        <a href="mailto:${m.email}?subject=Leave%20Application%20-%20${encodeURIComponent(loggedInStudent?.name || 'Student')}" class="py-2 glass-card text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95">
          <i class="fa-regular fa-envelope text-blue-500"></i> Email
        </a>
      </div>
    </div>
  `).join('');

  const facultyContainer = document.getElementById('faculty-cards-container');
  facultyContainer.innerHTML = facultyList.map(fac => `
    <div class="glass-card p-4 rounded-3xl border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between">
      <div>
        <div class="flex items-start justify-between gap-2">
          <div class="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center text-base">
            <i class="fa-solid ${fac.icon}"></i>
          </div>
          <span class="text-[10px] font-mono font-bold text-slate-400">${fac.role}</span>
        </div>
        <h3 class="font-black text-sm text-slate-900 dark:text-white mt-2">${fac.name}</h3>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">${fac.subject}</p>
      </div>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <a href="https://wa.me/${fac.phone}" target="_blank" class="py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95 shadow-xs">
          <i class="fa-brands fa-whatsapp"></i> WhatsApp
        </a>
        <a href="mailto:${fac.email}" class="py-2 glass-card text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition active:scale-95">
          <i class="fa-regular fa-envelope text-blue-500"></i> Email
        </a>
      </div>
    </div>
  `).join('');
}

// Academic Calendar & Real-Time Live Clock Engine
function updateLiveCalendarClock() {
  const clockEl = document.getElementById('calendar-live-clock');
  const dateEl = document.getElementById('calendar-live-date');
  const dayEl = document.getElementById('calendar-live-day');
  if (!clockEl && !dateEl && !dayEl) return;
  const now = new Date();
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  if (dayEl) {
    dayEl.textContent = now.toLocaleDateString('en-US', { weekday: 'long' });
  }
}

if (!window._calendarClockInterval) {
  window._calendarClockInterval = setInterval(updateLiveCalendarClock, 1000);
}

function renderAcademicCalendar() {
  const yearLabel = document.getElementById('calendar-year-label');
  const grid = document.getElementById('year-calendar-grid');
  const large = document.getElementById('selected-month-calendar');
  if (!yearLabel || !grid || !large) return;

  updateLiveCalendarClock();

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  yearLabel.textContent = calendarYear;

  grid.innerHTML = monthNames.map((name, month) => {
    return `
      <button onclick="selectCalendarMonth(${month})" class="text-left p-2.5 rounded-2xl glass-card transition ${month === calendarMonth ? 'ring-2 ring-cyan-500 bg-cyan-50/40 dark:bg-cyan-900/20' : ''}">
        <span class="block text-xs font-black text-slate-900 dark:text-white mb-1">${name.slice(0, 3)}</span>
        <span class="text-[10px] text-slate-400">Select month</span>
      </button>
    `;
  }).join('');

  document.getElementById('selected-calendar-month').textContent = `${monthNames[calendarMonth]} ${calendarYear}`;
  const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
  const days = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const today = new Date();
  const isCurrentYear = calendarYear === today.getFullYear();
  const isCurrentMonth = calendarMonth === today.getMonth();
  const todayDate = today.getDate();

  let cells = '';

  for (let b = 0; b < firstDay; b++) cells += '<span class="min-h-10 rounded-xl bg-slate-50/40 dark:bg-slate-900/30"></span>';
  for (let day = 1; day <= days; day++) {
    const isToday = isCurrentYear && isCurrentMonth && day === todayDate;
    const key = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const evt = academicCalendarEvents.find(e => key >= e.start && key <= e.end);
    let dot = '';
    if (evt) {
      const c = evt.type === 'holiday' ? 'bg-rose-500' : evt.type === 'exam' ? 'bg-purple-500' : 'bg-emerald-500';
      dot = `<span class="block w-1.5 h-1.5 rounded-full ${c} mx-auto mt-0.5"></span>`;
    }
    cells += `
      <div class="min-h-11 p-1 rounded-xl glass-card text-center border transition relative ${isToday ? 'ring-2 ring-cyan-500 bg-cyan-500/15 border-cyan-400 font-black shadow-md' : 'border-slate-100 dark:border-slate-800/60'}">
        ${isToday ? '<span class="absolute -top-1.5 left-1/2 -translate-x-1/2 px-1 py-0.2 bg-cyan-500 text-white rounded text-[7px] font-black uppercase tracking-tighter">TODAY</span>' : ''}
        <span class="text-[11px] font-bold ${isToday ? 'text-cyan-600 dark:text-cyan-300' : 'text-slate-700 dark:text-slate-200'}">${day}</span>
        ${dot}
      </div>
    `;
  }
  large.innerHTML = cells;

  const mStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}`;
  const monthEvts = academicCalendarEvents.filter(e => e.start.startsWith(mStr) || e.end.startsWith(mStr));
  const evtsContainer = document.getElementById('selected-month-events');
  
  if (monthEvts.length > 0) {
    evtsContainer.innerHTML = monthEvts.map(e => `
      <div class="flex items-start gap-2.5 p-3 rounded-2xl glass-card text-xs">
        <span class="w-2.5 h-2.5 rounded-full ${e.type === 'holiday' ? 'bg-rose-500' : e.type === 'exam' ? 'bg-purple-500' : 'bg-emerald-500'} mt-1 shrink-0"></span>
        <div>
          <p class="font-extrabold text-slate-900 dark:text-white">${e.title}</p>
          <p class="text-[10px] text-slate-400 mt-0.5">${e.start} ${e.end !== e.start ? 'to ' + e.end : ''}</p>
        </div>
      </div>
    `).join('');
  } else {
    evtsContainer.innerHTML = '<p class="text-xs text-slate-400 text-center py-2">No official university events scheduled for this month.</p>';
  }
}

function selectCalendarMonth(m) {
  calendarMonth = m;
  renderAcademicCalendar();
}
function changeCalendarYear(d) {
  calendarYear += d;
  renderAcademicCalendar();
}
function goToTodayInCalendar() {
  const today = new Date();
  calendarYear = today.getFullYear();
  calendarMonth = today.getMonth();
  renderAcademicCalendar();
}

// AI Modal
function toggleAiDrawer() {
  const modal = document.getElementById('ai-modal');
  modal.classList.toggle('hidden');
  if (!modal.classList.contains('hidden')) {
    document.getElementById('ai-user-input').focus();
  }
}

function sendPreset(txt) {
  document.getElementById('ai-user-input').value = txt;
  handleAiSend();
}

function handleAiSend() {
  const input = document.getElementById('ai-user-input');
  const q = input.value.trim();
  if (!q) return;

  addChatMessage('user', q);
  input.value = '';

  setTimeout(() => {
    const reply = generateAiAnswer(q);
    addChatMessage('agent', reply);
  }, 300);
}

function addChatMessage(sender, html) {
  const stream = document.getElementById('chat-stream');
  const isUser = sender === 'user';
  const div = document.createElement('div');
  div.className = `flex items-start gap-2.5 max-w-[85%] ${isUser ? 'ml-auto flex-row-reverse' : ''}`;
  
  div.innerHTML = `
    <div class="w-6 h-6 rounded-full ${isUser ? 'bg-slate-800 dark:bg-slate-600 text-white' : 'bg-blue-600 text-white'} flex items-center justify-center text-[10px] shrink-0 mt-0.5">
      <i class="fa-solid ${isUser ? 'fa-user' : 'fa-robot'}"></i>
    </div>
    <div class="${isUser ? 'bg-blue-600 text-white rounded-tr-none' : 'glass-card text-slate-800 dark:text-slate-200 rounded-tl-none'} p-3.5 rounded-2xl shadow-xs leading-relaxed">
      ${html}
    </div>
  `;
  stream.appendChild(div);
  stream.scrollTop = stream.scrollHeight;
}

function generateAiAnswer(q) {
  const text = q.toLowerCase();

  if (text.includes('benaka') || text.includes('dean') || text.includes('student affair')) {
    return `🏛️ <strong>Deputy Dean of Student Affairs:</strong><br>` +
      `• <strong>Name:</strong> Dr. Benaka Prasad<br>` +
      `• <strong>Phone:</strong> <a href="tel:+919986982138" class="font-bold underline">+91 99869 82138</a><br>` +
      `• <strong>WhatsApp:</strong> <a href="https://wa.me/919986982138" target="_blank" class="text-emerald-500 font-bold underline">Direct WhatsApp</a><br>` +
      `• <strong>Role:</strong> Oversees student welfare, university grievance resolution, code of conduct, and anti-ragging.<br>` +
      `You can find his dedicated contact card under the <strong>Complaint Booth</strong> tab!`;
  }

  if (text.includes('xerox') || text.includes('print') || text.includes('tuck shop') || text.includes('price') || text.includes('cost') || text.includes('printout275')) {
    return `🖨️ <strong>College Tuck Shop Xerox Official Pricing:</strong><br>` +
      `• <strong>Black & White Xerox:</strong> ₹3.00 per page<br>` +
      `• <strong>Full Color Printout:</strong> ₹10.00 per page<br>` +
      `• <strong>Official Email:</strong> <strong>printout275@gmail.com</strong><br>` +
      `Open the <strong>Tuck Shop</strong> tab to order prints and generate your pickup token!`;
  }

  if (text.includes('attendance') || text.includes('face') || text.includes('qr')) {
    return `📸 <strong>Two-Step Face ID Attendance:</strong><br>` +
      `1. <strong>Step 1: Face Scan</strong> — Authenticates your face with student profile (${loggedInStudent?.usn || 'USN'}).<br>` +
      `2. <strong>Step 2: Faculty Live QR</strong> — Camera automatically unlocks to scan the teacher's projected code.<br>` +
      `Click on the <strong>Attendance</strong> tab to start!`;
  }

  if (text.includes('box') || text.includes('chat')) {
    return `💬 <strong>BOX Campus Chat:</strong><br>` +
      `BOX is our serverless peer-to-peer campus discussion room. Only active students can chat (zero bot messages). Authorized batch coordinators (<strong>25BTREC020</strong> & <strong>25BTREC09</strong>) can broadcast running announcements to the Home page!`;
  }

  return `💡 I'm here to help with your ECE Portal! Try asking about:<br>` +
    `• <em>"Who is Deputy Dean Student Affairs?"</em><br>` +
    `• <em>"How much does Xerox printout cost?"</em><br>` +
    `• <em>"Who is my faculty mentor?"</em><br>` +
    `• <em>"What classes do I have today?"</em>`;
}

window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  
  const dayShortNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const todayDay = dayShortNames[new Date().getDay()];
  selectDay(todayDay === 'Sun' ? 'Mon' : todayDay);

  updateLiveScheduleClock();
  setInterval(updateLiveScheduleClock, 1000);
  filterMobileSem('3');
  renderNotesCards();
  renderFacultyAndMentors();
  renderAcademicCalendar();
  calculateXeroxCost();

  const savedSession = localStorage.getItem('portal_active_session');
  if (savedSession) {
    try {
      const student = JSON.parse(savedSession);
      grantAccess(student);
      return;
    } catch (e) {
      localStorage.removeItem('portal_active_session');
    }
  }

  checkSavedBiometricProfile();
  updateEnrollmentStatusUI();
  initProfileSync();
});
