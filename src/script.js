import { initMap, setUserLocation } from "./map.js";
import { getAISafetySuggestions } from "./ai.js";
import { googleLogin, logoutUser, onUserStateChanged } from "./firebase-init.js";

/* --- BACKEND URL (Render Deployment) --- */
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

/* ---   STATE --- */
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

/* --- SAFE ALERT UI --- */
function showAlert(message, type = "info") {
  if (!alertsList) return;

  const colors = {
    info: "bg-slate-50 border-slate-200",
    success: "bg-green-50 border-green-200",
    danger: "bg-red-50 border-red-200",
  };

  const el = document.createElement("div");
  el.className = `p-3 border rounded ${colors[type]}`;
  el.innerHTML = `
    <div class="text-sm font-semibold">${message}</div>
    <div class="text-xs text-slate-500">${new Date().toLocaleString()}</div>
  `;

  alertsList.prepend(el);
}

/* --- BACKEND CALL HELPER --- */
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

/* --- LOAD ALERTS FROM BACKEND (SQLite) --- */
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

    data.reverse().forEach((a) => {
      showAlert(`${a.reason}`, "info");
    });
  } catch {
    console.log("Could not load alerts from backend.");
  }
}

/* --- MAP INIT --- */
initMap();

navigator.geolocation.getCurrentPosition(
  (pos) => setUserLocation(pos.coords.latitude, pos.coords.longitude),
  () => console.log("Location not allowed")
);

/* --- SAFETY TIMER LOGIC --- */
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    if (safetyInterval) clearInterval(safetyInterval);

    safetySeconds = 60;
    timerBox.classList.remove("hidden");
    timerText.innerText = safetySeconds;

    showAlert("⏱ Safety timer started", "info");

    //  Start backend timer (Python + SQLite + Datetime)
    await tryBackend("/start-timer", { minutes: 1 });

    // Frontend countdown UI
    safetyInterval = setInterval(() => {
      safetySeconds--;
      timerText.innerText = safetySeconds;

      if (safetySeconds <= 0) {
        clearInterval(safetyInterval);
        safetyInterval = null;
        timerBox.classList.add("hidden");

        showAlert("🚨 Timer expired! Emergency alert triggered.", "danger");

        // Reload alerts from SQLite logs
        loadAlertsFromBackend();

      }
    }, 1000);
  });
}

/* --- CHECK-IN BUTTON --- */
if (checkInBtn) {
  checkInBtn.addEventListener("click", async () => {
    if (!safetyInterval) {
      showAlert("ℹ No active safety timer running.", "info");
      return;
    }

    clearInterval(safetyInterval);
    safetyInterval = null;
    safetySeconds = 0;

    timerBox.classList.add("hidden");

    showAlert("✅ You checked in safely. Timer cancelled.", "success");

    // Backend cancel timer + save alert
    await tryBackend("/check-in");
    loadAlertsFromBackend();

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
      setUserLocation(lat, lng);

      const msg = `🚨 SOS! My location: https://maps.google.com/?q=${lat},${lng}`;

      window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");

      showAlert("🚨 SOS sent with live location", "danger");
    } catch {
      alert("Location permission required for SOS");
    }
  });
}

/* --- AI HELP BUTTON --- */
if (aiHelpBtn) {
  aiHelpBtn.addEventListener("click", async () => {
    const res = await getAISafetySuggestions(
      "Give 5 short safety tips for a woman walking alone at night."
    );

    alert(res?.choices?.[0]?.message?.content || "AI unavailable");
  });
}

/* --- LOGIN SYSTEM --- */
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

/* ---LOAD ALERTS ON PAGE LOAD --- */

loadAlerts();



/* --- LOAD ALERTS FROM BACKEND (SQLite) --- */
async function loadAlertsFromBackend() {
  if (!alertsList) return;

  try {
    const res = await fetch(BACKEND_URL + "/logs");
    const data = await res.json();

    // Clear old UI alerts
    alertsList.innerHTML = "";

    // If no alerts yet
    if (data.length === 0) {
      alertsList.innerHTML =
        "<p class='text-sm text-slate-500'>No alerts yet.</p>";
      return;
    }

    // Show latest alerts first
    data.reverse().forEach((alert) => {
      const div = document.createElement("div");
      div.className =
        "p-3 border rounded bg-white shadow-sm";

      div.innerHTML = `
        <div class="font-semibold text-sm">⚠️ ${alert.reason}</div>
        <div class="text-xs text-slate-500">${alert.time}</div>
      `;

      alertsList.appendChild(div);
    });
  } catch (err) {
    console.log("Could not load alerts:", err);
  }
}
// Load saved alerts automatically on refresh
window.addEventListener("load", loadAlertsFromBackend);
