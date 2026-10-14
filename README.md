# Digital Portal • FET Jain University (ECE Department)

A modern, serverless, mobile-optimized Progressive Web Application (PWA) designed for the **Department of Electronics & Communication Engineering (ECE)**, Faculty of Engineering & Technology, Jain (Deemed-to-be University).

---

## 🚀 Live Demo & GitHub Pages Hosting

This web application is **100% serverless and static**, requiring **zero backend servers, zero npm dependencies, and zero build steps**. It is built to run directly from GitHub Pages or any static web host.

### How to Deploy on GitHub Pages (In 3 Simple Steps):
1. **Create a GitHub Repository**:
   - Go to [github.com/new](https://github.com/new) and create a repository (e.g., `digital-portal` or `<your-username>.github.io`).
2. **Upload Files**:
   - Upload all files from this folder (`index.html`, `app.js`, `box-chat.js`, `README.md`, `.nojekyll`).
   - Commit the changes to the `main` branch.
3. **Enable GitHub Pages**:
   - Go to repository **Settings** &rarr; **Pages** (in the left sidebar).
   - Under **Build and deployment** &rarr; **Branch**, select `main` and folder `/ (root)`.
   - Click **Save**.
   - Your portal will be live in ~60 seconds at:  
     `https://<your-username>.github.io/<repository-name>/`

---

## ✨ Features Overview

### 1. 💬 "BOX" Real-Time Online Campus Chat Engine
- **Serverless Peer-to-Peer Mesh**: Powered by **GunDB** (`gun.js`), public WebSocket relays (`wss://relay.peer.ooo/gun`), and `BroadcastChannel` for instant 0ms cross-tab sync.
- **Pure Active Students Only**: Wipes legacy caches automatically; no bots or simulated messages.
- **Media Drawer (🤪 Button)**:
  - **College Stickers**: 8 campus-themed stickers (*100% Attendance Gang*, *Notes Uploaded!*, *Need Chai Break*, *Proxy Lagao Yaar!*, *Lab Viva Panic!*, *Xerox Queue Long*, *HOD on Rounds!*, *Semester End Vibe*).
  - **Reaction GIFs**: Curated campus reaction GIFs plus custom GIF/image URL sender.
  - **Campus Emojis**: Quick one-tap insertion grid.
- **Theme Wallpapers**: Apple Glass, Cyber Neon, Sunset Ember, Deep Ocean, and Fresh Mint.

### 2. 🔬 ECE Virtual Labs & Circuit Simulation Studio
- **CircuitVerse Studio Integration**: Direct access to the live online laboratory website at **`https://loquacious-cocada-8c6bb4.netlify.app`**.
- **Interactive Workbench**: Embedded responsive CAD & SPICE workspace right inside the portal with reload and fullscreen popout buttons.
- **6 Curated ECE Practicals**:
  1. *Analog OP-AMP 741 Inverting/Non-Inverting & Active Filters*
  2. *Combinational Logic Gates & Multiplexers (74xx Series)*
  3. *Sequential JK Flip-Flops & Asynchronous Counters*
  4. *Microcontroller Sensor Interfacing & PWM Motor Control*
  5. *SPICE Transient Waveforms & Diode Bridge Rectifiers*
  6. *VLSI CMOS Inverter Transfer Characteristics & Timing Delays*
- **Home Page Spotlight**: Featured banner and quick action pill on the Home page dashboard.

### 3. 📢 Slow & Accessible Marquee Announcement Ticker
- **Comfortable Reading Speed**: Smooth, slow scroll calibrated between 36s to 95s based on message length (no more rushing text!).
- **Accessible Controls**:
  - Auto-pauses on hover and touch.
  - Dedicated **Pause / Play** toggle button right on the ticker card.
  - Dedicated **"Read Notice"** button to open the full announcement modal.
- **Full Notice Reader Modal**: View complete lengthy announcements, verified timestamps, broadcast author, and attached files/media with download links.

### 4. 🔐 Smart Name & USN Authentication
- **Fault-Tolerant Matching**: Accepts any variant of student name (e.g., *K Krishna Charan*, *Krishna Charan*, *Krishna*) and USN (*25BTREC020*, *25BTREC20*, *20*).
- **Zero-Normalization**: Automatically maps leading zeros and nicknames to the verified university directory record.
- **Graceful Onboarding**: New students entering their credentials can sign in immediately with zero blocking errors.
- **Persistent Biometrics Hub**:
  - Automatically saves credentials to `portal_saved_student_bio` on first sign-in.
  - Subsequent visits feature **Face ID** and **Touch ID Fingerprint** quick-access biometric buttons.
  - Includes a "Switch Student / Sign In Manually" toggle.

### 5. 📸 Two-Step Face ID Attendance & Faculty QR
- **Step 1: Face Scan**: Authenticates the student's face with anti-proxy multi-person detection.
- **Step 2: Faculty Live QR Reader**: Automatically unlocks the camera to scan the faculty projector QR code.
- Anti-Proxy Edge Security rejects multiple people in the camera frame and blocks proxy scans.

### 6. 🖨️ Tuck Shop Xerox (Printout Express)
- **Direct Email Dispatch**: Auto-composes print orders directly to **`printout275@gmail.com`**.
- **Accurate Pricing**: Strictly calculates `Pages × Rate × Copies` (B&W: **₹3/page**, Color: **₹10/page**) without any extra binding fee overhead.
- Generates digital pickup tokens with timestamps.

### 6. 📚 Course Matrix (Cards View)
- Renders curriculum scheme directly in responsive cards view (`#m-course-container`).
- Complete semester filters (Sem 3 to 8, All) and instant course code/name search.
- Displays credit counts, notional hours, and L-T-P-E distribution.

### 7. 📱 Mobile Bottom Floating Dock & Services Sheet
- Centered geometry with `max-w-md mx-auto` and `pb-32` bottom clearance.
- High-blur Apple glassmorphism navigation dock with fluid tap animations.
- "More" drawer sheet with smooth touch scrolling and zero horizontal overflow.

---

## 👥 Authorized Administrative USNs

Only the following student USNs have broadcast and announcement management privileges:
- **`25BTREC020`** — Kummusani Krishna Charan
- **`25BTREC09` / `25BTREC009`** — Chinmayi V

---

## 📂 Repository File Structure

```
├── index.html       # Complete, self-contained single-page application
├── app.js           # Core JavaScript logic (timetable, attendance, directory, etc.)
├── box-chat.js      # GunDB real-time chat & marquee engine
├── .nojekyll        # Disables Jekyll processing on GitHub Pages
└── README.md        # Project documentation & deployment guide
```

---

## 🛠️ Technology Stack
- **HTML5 & Vanilla CSS**: Custom Apple Liquid Glass design system, spring physics easing, and ambient floating orbs.
- **Tailwind CSS**: Utility-first CSS via CDN with dark mode support.
- **FontAwesome 6.5**: Crisp iconography.
- **GunDB (`gun.js`)**: Decentralized, serverless real-time graph synchronization.
- **HTML5 QR Code**: In-browser camera QR code reader.
- **BroadcastChannel API**: 0ms cross-tab state synchronization.
- **Web Storage API**: Local biometric profile and cache persistence.
