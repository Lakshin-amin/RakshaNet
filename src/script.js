import { initMap, setUserLocation } from "./map.js";
import { getAISafetySuggestions } from "./ai.js";
import { googleLogin, logoutUser, onUserStateChanged } from "./firebase-init.js";

/* --- BACKEND URL --- */
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

/* --- STATE --- */
let safetyInterval = null;
let safetySeconds = 0;
let currentUserId = null;

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

/* --- ALERT COLOR TYPE --- */
function getAlertType(reason) {
  reason = reason.toLowerCase();

  if (reason.includes("expired")) return "danger";
  if (reason.includes("checked in")) return "success";

  return "info";
}

/* --- SHOW ALERT UI --- */
function renderAlert(reason, time) {
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
    <div class="text-sm font-semibold">${reason}</div>
    <div class="text-xs text-slate-500">${time}</div>
  `;

  alertsList.prepend(el);
}

/* --- BACKEND POST CALL --- */
async function backendPost(endpoint, payload = {}) {
  if (!currentUserId) {
    alert("Please login first!");
    return null;
  }

  try {
    const res = await fetch(BACKEND_URL + endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        ...payload,
      }),
    });

    return await res.json();
  } catch (err) {
    console.log("Backend unavailable:", err);
    return null;
  }
}

/* --- LOAD ALERTS (User Specific) --- */
async function loadAlerts() {
  if (!alertsList) return;

  if (!currentUserId) {
    alertsList.innerHTML =
      "<p class='text-sm text-slate-500'>Login to see your alerts.</p>";
    return;
  }

  try {
    const res = await fetch(BACKEND_URL + "/logs/" + currentUserId);
    const data = await res.json();

    alertsList.innerHTML = "";

    if (data.length === 0) {
      alertsList.innerHTML =
        "<p class='text-sm text-slate-500'>No alerts yet.</p>";
      return;
    }

    // Latest first
    data.reverse().forEach((alert) => {
      renderAlert(alert.reason, alert.time);
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

/* --- START SAFETY TIMER --- */
if (startBtn) {
  startBtn.addEventListener("click", async () => {
    if (!currentUserId) {
      alert("Please login first!");
      return;
    }

    if (safetyInterval) clearInterval(safetyInterval);

    safetySeconds = 60;
    timerBox.classList.remove("hidden");
    timerText.innerText = safetySeconds;

    alert("⏱ Safety timer started!");

    // Start backend timer
    await backendPost("/start-timer", { minutes: 1 });

    // Countdown UI
    safetyInterval = setInterval(() => {
      safetySeconds--;
      timerText.innerText = safetySeconds;

      if (safetySeconds <= 0) {
        clearInterval(safetyInterval);
        safetyInterval = null;
        timerBox.classList.add("hidden");

        alert("🚨 Timer expired! Emergency alert triggered!");

        // Reload alerts after backend saves expiry
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

    // Cancel timer in backend + save check-in
    await backendPost("/check-in");

    alert("✅ You checked in safely!");

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

      // ✅ Store real user ID
      currentUserId = user.email;

      alert("👤 Logged in as " + currentUserId);

      loadAlerts();
    } else {
      loginBtn.innerText = "Login";
      loginBtn.dataset.logged = "no";
      userEmail.innerText = "";

      currentUserId = null;

      alertsList.innerHTML =
        "<p class='text-sm text-slate-500'>Login to see your alerts.</p>";
    }
  });
}

/* ---------------- CONTACTS UI ---------------- */

const contactInput = document.getElementById("contactInput");
const saveContactBtn = document.getElementById("saveContactBtn");
const contactsList = document.getElementById("contactsList");

/* Load Contacts from Backend */
async function loadContacts() {
  if (!contactsList) return;

  try {
    const res = await fetch(`${BACKEND_URL}/contacts/demoUser`);
    const data = await res.json();

    contactsList.innerHTML = "";

    if (data.contacts.length === 0) {
      contactsList.innerHTML =
        "<p class='text-sm text-slate-500'>No contacts added yet.</p>";
      return;
    }

    data.contacts.forEach((phone) => {
      const div = document.createElement("div");
      div.className =
        "p-2 border rounded-lg bg-slate-50 flex justify-between items-center";

      div.innerHTML = `
        <span class="text-sm font-medium">${phone}</span>
      `;

      contactsList.appendChild(div);
    });
  } catch (err) {
    console.log("Failed to load contacts:", err);
  }
}

/* Save Contact */
if (saveContactBtn) {
  saveContactBtn.addEventListener("click", async () => {
    const phone = contactInput.value.trim();

    if (!phone.startsWith("+")) {
      alert("Please enter number in format +91XXXXXXXXXX");
      return;
    }

    await tryBackend("/add-contact", { phone });

    contactInput.value = "";
    alert("✅ Emergency contact saved!");

    loadContacts();
  });
}

/* Load Contacts on Page Refresh */
window.addEventListener("load", loadContacts);

/* --- LOAD ON REFRESH --- */
window.addEventListener("load", loadAlerts);
