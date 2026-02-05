import { initMap, setUserLocation } from "./map.js";
import { getAISafetySuggestions } from "./ai.js";
import { googleLogin, logoutUser, onUserStateChanged } from "./firebase-init.js";

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
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";


/* --- MAP --- */
initMap();

navigator.geolocation.getCurrentPosition(
  pos => setUserLocation(pos.coords.latitude, pos.coords.longitude),
  () => console.log("Location not allowed")
);

/* --- HELPERS --- */
function showAlert(message, type = "info") {
  const colors = {
    info: "bg-slate-50 border-slate-200",
    success: "bg-green-50 border-green-200",
    danger: "bg-red-50 border-red-200"
  };

  const el = document.createElement("div");
  el.className = `p-3 border rounded ${colors[type]}`;
  el.innerHTML = `
    <div class="text-sm font-semibold">${message}</div>
    <div class="text-xs text-slate-500">${new Date().toLocaleString()}</div>
  `;
  alertsList.prepend(el);
}

function tryBackend(endpoint, payload = {}) {
  fetch(BACKEND_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId: "demoUser", ...payload })
  }).catch(() => {
    console.log("Backend unavailable (demo mode)");
  });
}

/* --- SAFETY TIMER --- */
startBtn.addEventListener("click", () => {
  if (safetyInterval) clearInterval(safetyInterval);

  safetySeconds = 60;
  timerBox.classList.remove("hidden");
  timerText.innerText = safetySeconds;

  showAlert("⏱ Safety timer started", "info");

  // ✅ Start backend timer immediately
  tryBackend("/start-timer", { minutes: 1 });

  // Frontend countdown UI
  safetyInterval = setInterval(() => {
    safetySeconds--;
    timerText.innerText = safetySeconds;

    if (safetySeconds <= 0) {
      clearInterval(safetyInterval);
      safetyInterval = null;
      timerBox.classList.add("hidden");

      showAlert("🚨 Timer expired! Alert sent.", "danger");

      // ❌ Do NOT call /start-timer here again
    }
  }, 1000);
});


checkInBtn.addEventListener("click", () => {
  if (!safetyInterval) {
    showAlert("ℹ No active safety timer");
    return;
  }

  clearInterval(safetyInterval);
  safetyInterval = null;
  safetySeconds = 0;

  timerBox.classList.add("hidden");

  showAlert("✅ You checked in safely. Timer cancelled.", "success");
  tryBackend("/check-in");
});

/* --- SOS ---- */
document.getElementById("sosBtn").addEventListener("click", async () => {
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
    alert("Location permission required");
  }
});

/* --- AI HELP --- */
document.getElementById("aiHelpBtn").addEventListener("click", async () => {
  const res = await getAISafetySuggestions(
    "Give 5 short safety tips for a woman walking alone at night."
  );

  alert(res?.choices?.[0]?.message?.content || "AI unavailable");
});

/* --- LOGIN --- */
loginBtn.addEventListener("click", async () => {
  if (loginBtn.dataset.logged === "yes") {
    await logoutUser();
  } else {
    await googleLogin();
  }
});

onUserStateChanged(user => {
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
