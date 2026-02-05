import { initMap, setUserLocation } from "./map.js";
import { getAISafetySuggestions } from "./ai.js";
import { googleLogin, logoutUser, onUserStateChanged } from "./firebase-init.js";

/* --- BACKEND URL --- */
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

/* --- STATE --- */
let safetyInterval = null;
let safetySeconds = 0;

/* --- ELEMENTS --- */
const startBtn = document.getElementById("startTimerBtn");
const checkInBtn = document.getElementById("checkInBtn");
const timerBox = document.getElementById("timerBox");
const timerText = document.getElementById("timerText");
const alertsList = document.getElementById("alertsList");

const loginBtn = document.getElementById("loginBtn");
const userEmail = document.getElementById("userEmail");

const sosBtn = document.getElementById("sosBtn");
const aiHelpBtn = document.getElementById("aiHelpBtn");

/* --- ALERT TYPE DETECTOR --- */
function getAlertType(reason) {
  reason = reason.toLowerCase();

  if (reason.includes("expired")) return "danger";
  if (reason.includes("checked in")) return "success";
  if (reason.includes("started")) return "info";

  return "info";
}

/* --- SHOW ALERT UI --- */
function showAlert(reason, time) {
  if (!alertsList) return;

  const type = getAlertType(reason);

  const colors = {
    info: "bg-slate-50 border-slate-200",
    success: "bg-green-50 border-green-200",
    danger: "bg-red-50 border-red-200",
  };

  const el = document.createElement("div");
  el.className = `p-4 border rounded-xl shadow-sm ${colors[type]}`;

  el.innerHTML = `
    <div class="text-sm font-semibold">⚠️ ${reason}</div>
    <div class="text-xs text-slate-500">${time}</div>
  `;

  alertsList.prepend(el);
}

/* --- BACKEND CALL --- */
async function tryBackend(endpoint, payload = {}) {
  try {
    const res = await fetch(BACKEND_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "demoUser", ...payload }),
    });

    return await res.json();
  } catch (err) {
    console.log("Backend unavailable (demo mode)");
    return null;
  }
}

/* --- LOAD ALERTS FROM SQLITE --- */
async function loadAlerts() {
  if (!alertsList) return;

  try {
    const res = await fetch(BACKEND_URL + "/logs");
    const data = await res.json();

    alertsList.innerHTML = "";

    if (data.length === 0) {
      alertsList.innerHTML =
        "<p class='text-sm text-slate-500'>No alerts yet.</p>";
      return;
    }

    // Latest first
    data.reverse().forEach((alert) => {
      showAlert(alert.reason, alert.time);
    });
  } catch (err) {
    console.log("Could not load alerts:", err);
  }
}

/* --- MAP INIT --- */
initMap();

navigator.geolocation.getCurrentPosition(
  (pos) => setUserLocation(pos.coords.latitude, pos.coords.longitude),
  () => console.log("Location not allowed")
);

/* --- SAFETY TIMER --- */
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    if (safetyInterval) clearInterval(safetyInterval);

    safetySeconds = 60;
    timerBox.classList.remove("hidden");
    timerText.innerText = safetySeconds;

    // Backend timer start (Python + SQLite + datetime)
    await tryBackend("/start-timer", { minutes: 1 });

    // Refresh UI alerts
    loadAlerts();

    // Countdown UI
    safetyInterval = setInterval(() => {
      safetySeconds--;
      timerText.innerText = safetySeconds;

      if (safetySeconds <= 0) {
        clearInterval(safetyInterval);
        safetyInterval = null;
        timerBox.classList.add("hidden");

        alert("🚨 Timer expired! Emergency triggered!");

        // Reload alerts from backend after expiry
        setTimeout(loadAlerts, 2000);
      }
    }, 1000);
  });
}

/* --- CHECK-IN BUTTON --- */
if (checkInBtn) {
  checkInBtn.addEventListener("click", async () => {
    if (!safetyInterval) {
      alert("No active timer running.");
      return;
    }

    clearInterval(safetyInterval);
    safetyInterval = null;
    timerBox.classList.add("hidden");

    // Backend check-in (cancel timer + save SQLite log)
    await tryBackend("/check-in");

    // Refresh UI alerts
    loadAlerts();
  });
}

/* --- SOS BUTTON --- */
if (sosBtn) {
  sosBtn.addEventListener("click", async () => {
    try {
      const pos = await new Promise((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej)
      );

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const msg = `🚨 SOS! My location: https://maps.google.com/?q=${lat},${lng}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");

      alert("🚨 SOS sent successfully!");
    } catch {
      alert("Location permission required for SOS");
    }
  });
}

/* --- AI HELP --- */
if (aiHelpBtn) {
  aiHelpBtn.addEventListener("click", async () => {
    const res = await getAISafetySuggestions(
      "Give 5 short safety tips for a woman walking alone at night."
    );

    alert(res?.choices?.[0]?.message?.content || "AI unavailable");
  });
}

/* --- LOGIN --- */
if (loginBtn) {
  loginBtn.addEventListener("click", async () => {
    if (loginBtn.dataset.logged === "yes") {
      await logoutUser();
    } else {
      await googleLogin();
    }
  });

  onUserStateChanged((user) => {
    if (user) {
      loginBtn.innerText = "Logout";
      loginBtn.dataset.logged = "yes";
      userEmail.innerText = user.email;
    } else {
      loginBtn.innerText = "Login";
      loginBtn.dataset.logged = "no";
      userEmail.innerText = "";
    }
  });
}

/* --- LOAD ALERTS ON REFRESH --- */
window.addEventListener("load", loadAlerts);
