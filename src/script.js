import { initMap, setUserLocation } from "./map.js";
import { renderContacts } from "./contacts.js";
import { getAISafetySuggestions } from "./ai.js";
import { googleLogin, logoutUser, onUserStateChanged, db } from "./firebase-init.js";
import { collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

initMap();// already in your code

navigator.geolocation.getCurrentPosition(
  pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setUserLocation(lat, lng);
  },
  err => {
    console.log("Location not allowed yet");
  }
);

//renderContacts();


function getContacts() {
  const raw = localStorage.getItem("safe_contacts");
  return raw ? JSON.parse(raw) : [];
}


document.getElementById("sosBtn").addEventListener("click", async () => {
  const alertsList = document.getElementById("alertsList");
  try {
    const pos = await new Promise((res, rej) => {
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 });
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setUserLocation(lat, lng);

    
    const msg = `⚠️ SOS! I need help. My location: https://maps.google.com/?q=${lat},${lng}`;

   
    const contacts = getContacts();
    contacts.forEach(c => {
      const wa = `https://wa.me/${c.phone.replace(/\+/g,'')}?text=${encodeURIComponent(msg)}`;
      
      window.open(wa, "_blank");
    });

   
    const el = document.createElement("div");
    el.className = "p-3 bg-red-50 border border-red-100 rounded";
    el.innerHTML = `<div class="text-sm">SOS sent at ${new Date().toLocaleString()}</div><div class="text-xs text-slate-600 mt-1">${msg}</div>`;
    alertsList.prepend(el);

    
    if (navigator.vibrate) navigator.vibrate([300, 100, 300]);

  } catch (err) {
    alert("Failed to get location. Please enable location permissions.");
    console.warn(err);
  }
});


document.getElementById("shareLocationBtn").addEventListener("click", async () => {
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej));
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    setUserLocation(lat, lng);

    const msg = `My location: https://maps.google.com/?q=${lat},${lng}`;
    
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  } catch (err) {
    alert("Could not fetch location.");
  }
});


document.getElementById("fakeCallBtn").addEventListener("click", () => {
 
  setTimeout(() => {
    const audio = new Audio("https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg");
    audio.play();
  }, 2500);
  alert("Fake call will ring in 3 seconds—answer to use as an escape!");
});


document.getElementById("aiHelpBtn").addEventListener("click", async () => {
  const prompt = "Give 5 short safety tips for a woman walking alone at night.";
  
  const res = await getAISafetySuggestions(prompt);

  if (res.error) {
    alert("AI service unavailable.");
    console.error(res);
    return;
  }

  const text = res.choices?.[0]?.message?.content || "No response from AI.";
  
  alert("AI Safety Tips:\n\n" + text);
});

const loginBtn = document.getElementById("loginBtn");
const userEmail = document.getElementById("userEmail");

loginBtn.addEventListener("click", async () => {
  if (loginBtn.dataset.logged === "yes") {
    await logoutUser();
    loginBtn.innerText = "Login";
    loginBtn.dataset.logged = "no";
    userEmail.innerText = "";
  } else {
    try {
      await googleLogin();
    } catch (err) {
      alert("Login failed: " + err.message);
    }
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

function startSafetyTimer() {
  console.log("Start Safety Timer clicked");

  // Local demo only (Python)
  fetch("http://localhost:5001/start-timer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "demoUser",
      minutes: 5
    })
  }).catch(() => {
    console.log("Python backend not available (expected on GitHub Pages)");
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const startBtn = document.getElementById("startTimerBtn");
  const checkInBtn = document.getElementById("checkInBtn");

  // START SAFETY TIMER
  if (startBtn) {
    startBtn.addEventListener("click", () => {
      console.log("Start Safety Timer clicked");

      // Frontend demo countdown (works on GitHub Pages)
      let seconds = 60;
      alert("Safety timer started (demo mode)");

      const interval = setInterval(() => {
        seconds--;
        console.log("Time left:", seconds);

        if (seconds <= 0) {
          clearInterval(interval);
          alert("⏰ Safety timer expired (demo)");
        }
      }, 1000);

      // Backend call (works locally only)
      fetch("http://localhost:5001/start-timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demoUser", minutes: 1 })
      }).catch(() => {
        console.warn("Backend not available (expected on GitHub Pages)");
      });
    });
  }

  // CHECK-IN (I'M SAFE)
  if (checkInBtn) {
    checkInBtn.addEventListener("click", () => {
      console.log("User checked in");

      alert("You are marked SAFE ✅");

      fetch("http://localhost:5001/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "demoUser" })
      }).catch(() => {
        console.warn("Backend not available (expected on GitHub Pages)");
      });
    });
  }
});
