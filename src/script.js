// src/script.js — RakshaNet core logic

import { initMap, setUserLocation } from "./map.js";
import { getAISafetySuggestions }   from "./ai.js";
import { googleLogin, logoutUser, onUserStateChanged } from "./firebase-init.js";

const BACKEND_URL   = "https://rakshanetwork-backend.onrender.com";
const TIMER_MINUTES = 1;

/* ─── STATE ─── */
let safetyInterval = null;
let safetySeconds  = 0;
let currentUserId  = null;
let currentLat     = null;
let currentLng     = null;

/* ─── ELEMENTS ─── */
const startBtn    = document.getElementById("startTimerBtn");
const startBtn2   = document.getElementById("startTimerBtn2");
const checkInBtn  = document.getElementById("checkInBtn");
const timerBox    = document.getElementById("timerBox");
const timerText   = document.getElementById("timerText");
const alertsList  = document.getElementById("alertsList");
const loginBtn    = document.getElementById("loginBtn");
const userEmail   = document.getElementById("userEmail");
const sosBtn      = document.getElementById("sosBtn");
const aiHelpBtn   = document.getElementById("aiHelpBtn");

/* ─── FORMAT TIME ─── */
// Handles ISO format (2026-02-23T13:43:03+05:30) and DD-MM-YYYY format
function formatTime(raw) {
  if (!raw) return "—";
  try {
    const d = new Date(raw);
    if (isNaN(d)) return raw;
    return d.toLocaleString("en-IN", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    });
  } catch {
    return raw;
  }
}

/* ─── TOAST ─── */
function toast(msg, type = "info", ms = 3200) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = el.className.replace("show","").trim(); }, ms);
}

/* ─── MAP & GEO ─── */
initMap();

navigator.geolocation.getCurrentPosition(
  pos => {
    currentLat = pos.coords.latitude;
    currentLng = pos.coords.longitude;
    setUserLocation(currentLat, currentLng);
  },
  () => toast("📍 Location access denied", "error")
);

/* ─── BACKEND ─── */
async function backendPost(endpoint, extra = {}) {
  if (!currentUserId) { toast("⚠️ Login first", "error"); return null; }
  try {
    const res = await fetch(BACKEND_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: currentUserId, ...extra }),
    });
    return await res.json();
  } catch {
    toast("❌ Server unreachable", "error");
    return null;
  }
}

/* ─── ALERTS ─── */
function alertType(reason) {
  const r = reason.toLowerCase();
  if (r.includes("expired") || r.includes("sos")) return "danger";
  if (r.includes("safely")  || r.includes("safe")) return "success";
  return "info";
}

function renderAlert(reason, time) {
  if (!alertsList) return;
  const type = alertType(reason);
  const el = document.createElement("div");
  el.className = "alert-row";
  el.innerHTML = `
    <div class="alert-pip ${type}"></div>
    <div>
      <div class="alert-reason">${reason}</div>
      <div class="alert-time">${formatTime(time)}</div>
    </div>`;
  alertsList.prepend(el);
}

async function loadAlerts() {
  if (!alertsList || !currentUserId) return;
  try {
    const res  = await fetch(`${BACKEND_URL}/logs/${encodeURIComponent(currentUserId)}`);
    const data = await res.json();
    alertsList.innerHTML = "";
    if (!data.length) {
      alertsList.innerHTML = `<div class="alert-row">
        <div class="alert-pip neutral"></div>
        <div><div class="alert-reason">No activity yet</div>
        <div class="alert-time">Your SOS and timer events appear here</div></div></div>`;
      return;
    }
    // ✅ Fixed: backend returns a.created_at, fallback to a.time for older records
    [...data].reverse().forEach(a => renderAlert(a.reason, a.time || a.created_at));
  } catch { /* silent */ }
}

/* ─── SAFETY TIMER ─── */
function stopTimer() {
  if (safetyInterval) { clearInterval(safetyInterval); safetyInterval = null; }
  timerBox.classList.remove("visible");
}

function launchTimer() {
  if (!currentUserId) { toast("⚠️ Login first", "error"); return; }
  stopTimer();
  safetySeconds = TIMER_MINUTES * 60;
  timerText.textContent = safetySeconds;
  timerBox.classList.add("visible");
  backendPost("/start-timer", { minutes: TIMER_MINUTES });
  toast("⏱ Safety timer started — check in before it expires!", "info", 4000);

  safetyInterval = setInterval(() => {
    safetySeconds--;
    timerText.textContent = safetySeconds;
    if (safetySeconds <= 0) {
      stopTimer();
      toast("🚨 Timer expired — emergency alert sent!", "error", 6000);
      if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 800]);
      setTimeout(loadAlerts, 3000);
    }
  }, 1000);
}

if (startBtn)  startBtn.addEventListener("click", launchTimer);
if (startBtn2) startBtn2.addEventListener("click", launchTimer);

if (checkInBtn) {
  checkInBtn.addEventListener("click", async () => {
    if (!safetyInterval) { toast("ℹ No active timer", "info"); return; }
    stopTimer();
    await backendPost("/check-in");
    toast("✅ You checked in safely!", "success");
    loadAlerts();
  });
}

/* ─── SOS BUTTON ─── */
if (sosBtn) {
  sosBtn.addEventListener("click", async () => {
    let lat = currentLat, lng = currentLng;

    if (!lat || !lng) {
      toast("📍 Getting your location…", "info");
      try {
        const pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { timeout: 7000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        currentLat = lat; currentLng = lng;
      } catch {
        toast("❌ Location unavailable — share manually", "error");
        return;
      }
    }

    const link = `https://maps.google.com/?q=${lat},${lng}`;
    const msg  = `🚨 EMERGENCY! I need help. My location: ${link}`;

    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    backendPost("/sos", { lat, lng });
    toast("🚨 SOS alert sent!", "error", 5000);

    if (navigator.vibrate) navigator.vibrate([200,100,200,100,200,100,600]);
  });
}

/* ─── AI HELP ─── */
if (aiHelpBtn) {
  aiHelpBtn.addEventListener("click", async () => {
    toast("🤖 Fetching safety tips…", "info");
    const res  = await getAISafetySuggestions(
      "Give 5 short, practical safety tips for a woman walking alone at night. Use 1 emoji per tip. Be direct and actionable."
    );
    const text = res?.choices?.[0]?.message?.content;
    if (text) alert(text);
    else toast("AI unavailable right now", "error");
  });
}

/* ─── AUTH ─── */
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (loginBtn.dataset.logged === "yes") {
      await logoutUser();
      toast("Logged out", "info");
    } else {
      try { await googleLogin(); }
      catch { toast("Login cancelled", "error"); }
    }
  });

  onUserStateChanged(user => {
    if (user) {
      currentUserId = user.email;
      loginBtn.textContent    = "Logout";
      loginBtn.dataset.logged = "yes";
      userEmail.textContent   = user.displayName || user.email;
      toast(`👋 Welcome, ${user.displayName?.split(" ")[0] || "friend"}!`, "success");
      loadAlerts();
    } else {
      currentUserId = null;
      loginBtn.textContent    = "Login";
      loginBtn.dataset.logged = "no";
      userEmail.textContent   = "";
      if (alertsList) alertsList.innerHTML = `<div class="alert-row">
        <div class="alert-pip neutral"></div>
        <div><div class="alert-reason">Login to see your alerts</div></div></div>`;
    }
  });
}

/* ─── INIT ─── */
window.addEventListener("load", loadAlerts);