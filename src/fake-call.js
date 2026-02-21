// src/fake-call.js
// Realistic fake call — iOS/Android lock screen feel

const CALLERS = [
  { name: "Mom",    number: "+91 98765 43210", emoji: "👩" },
  { name: "Priya",  number: "+91 87654 32109", emoji: "👧" },
  { name: "Anjali", number: "+91 76543 21098", emoji: "👩‍🦱" },
  { name: "Dad",    number: "+91 65432 10987", emoji: "👨" },
  { name: "Sister", number: "+91 54321 09876", emoji: "👩‍🦰" },
];

const overlay       = document.getElementById("fakeCallOverlay");
const callerNameEl  = document.getElementById("callerName");
const callerNumEl   = document.getElementById("callerNumber");
const callerEmoji   = document.getElementById("callerEmoji");
const callStatusEl  = document.getElementById("callStatusLabel");
const callTimerEl   = document.getElementById("callTimer");
const endBtn        = document.getElementById("endFakeCall");
const fakeCallBtn   = document.getElementById("fakeCallBtn");
const realTimeEl    = document.getElementById("realTimeStr");
const muteBtn       = document.getElementById("muteBtn");

let callInterval    = null;
let ringInterval    = null;
let callSecs        = 0;
let isMuted         = false;
let callAnswered    = false;
let audioCtx        = null;
let gainNode        = null;

/* ─── Live real-time clock in status bar ─── */
function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  const displayH = ((h % 12) || 12);
  if (realTimeEl) realTimeEl.textContent = `${displayH}:${m} ${ampm}`;
}
setInterval(updateClock, 1000);
updateClock();

/* ─── Format call duration ─── */
function fmt(s) {
  return `${Math.floor(s / 60).toString().padStart(2,"0")}:${(s % 60).toString().padStart(2,"0")}`;
}

/* ─── Web Audio ringtone ─── */
function playRingtone() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    gainNode = audioCtx.createGain();
    gainNode.connect(audioCtx.destination);

    const RING_PATTERN = [
      [880, 0, 0.3], [1108, 0.35, 0.3],
      [880, 0.7, 0.3], [1108, 1.05, 0.3],
      // silence then repeat
      [880, 2.0, 0.3], [1108, 2.35, 0.3],
      [880, 2.7, 0.3], [1108, 3.05, 0.3],
    ];

    function scheduleRing() {
      const now = audioCtx?.currentTime;
      if (!audioCtx || isMuted) return;
      RING_PATTERN.forEach(([freq, offset, dur]) => {
        const osc = audioCtx.createOscillator();
        const env = audioCtx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        env.gain.setValueAtTime(0, now + offset);
        env.gain.linearRampToValueAtTime(0.18, now + offset + 0.04);
        env.gain.linearRampToValueAtTime(0, now + offset + dur - 0.04);
        osc.connect(env);
        env.connect(gainNode);
        osc.start(now + offset);
        osc.stop(now + offset + dur);
      });
    }

    scheduleRing();
    // Repeat ring every 4.2s
    ringInterval = setInterval(() => {
      if (callAnswered || isMuted) return;
      scheduleRing();
    }, 4200);

  } catch (e) { /* audio not available */ }
}

function stopRingtone() {
  if (ringInterval) { clearInterval(ringInterval); ringInterval = null; }
  if (audioCtx) { try { audioCtx.close(); } catch(e){} audioCtx = null; }
}

/* ─── Start call ─── */
function startFakeCall() {
  const caller = CALLERS[Math.floor(Math.random() * CALLERS.length)];
  callerNameEl.textContent = caller.name;
  callerNumEl.textContent  = caller.number;
  callerEmoji.textContent  = caller.emoji;
  callStatusEl.textContent = "Incoming Call…";
  callStatusEl.classList.remove("connected");
  callTimerEl.textContent  = "";
  callSecs     = 0;
  isMuted      = false;
  callAnswered = false;

  overlay.classList.add("active");
  document.body.style.overflow = "hidden";

  // Vibrate ringtone pattern
  if (navigator.vibrate) {
    navigator.vibrate([600, 400, 600, 400, 600]);
  }

  playRingtone();

  // Auto-answer after 2.5s (realistic)
  setTimeout(() => {
    if (!overlay.classList.contains("active")) return;
    callAnswered = true;
    callStatusEl.textContent = "Connected";
    callStatusEl.classList.add("connected");
    stopRingtone();
    if (navigator.vibrate) navigator.vibrate(100);

    callInterval = setInterval(() => {
      callSecs++;
      callTimerEl.textContent = fmt(callSecs);
    }, 1000);
  }, 2500);
}

/* ─── End call ─── */
function endFakeCall() {
  overlay.classList.remove("active");
  document.body.style.overflow = "";
  callAnswered = false;

  if (callInterval) { clearInterval(callInterval); callInterval = null; }
  stopRingtone();

  if (navigator.vibrate) navigator.vibrate(80);
}

/* ─── Mute toggle ─── */
if (muteBtn) {
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    const circle = muteBtn.querySelector(".call-action-circle");
    circle.textContent = isMuted ? "🔕" : "🔇";
    muteBtn.querySelector("span").textContent = isMuted ? "Unmute" : "Mute";
    if (gainNode) gainNode.gain.value = isMuted ? 0 : 1;
  });
}

/* ─── Event listeners ─── */
if (fakeCallBtn) fakeCallBtn.addEventListener("click", startFakeCall);
if (endBtn)      endBtn.addEventListener("click", endFakeCall);

document.addEventListener("keydown", e => {
  if (e.key === "Escape") endFakeCall();
});