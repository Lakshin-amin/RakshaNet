// src/location-share.js
// Live location sharing — bottom sheet with multiple share options

const modal       = document.getElementById("locationModal");
const coordsEl    = document.getElementById("coordsDisplay");
const linkBoxEl   = document.getElementById("shareLinkBox");
const copyBtn     = document.getElementById("copyLinkBtn");
const openMapsBtn = document.getElementById("openMapsBtn");
const waBtn       = document.getElementById("whatsappShareBtn");
const nativeBtn   = document.getElementById("nativeShareBtn");
const shareLocBtn = document.getElementById("shareLocationBtn");

let cachedLat = null;
let cachedLng = null;
let shareLink = "";

/* ─── Inject toast function (shared with script.js) ─── */
function toast(msg, type = "info", ms = 3000) {
  const el = document.getElementById("toast");
  if (!el) return;
  el.textContent = msg;
  el.className = `show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = el.className.replace("show","").trim(); }, ms);
}

/* ─── Build Google Maps link ─── */
function buildLink(lat, lng) {
  return `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

/* ─── Build display string ─── */
function buildCoordsStr(lat, lng) {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${latDir},  ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

/* ─── Open location sheet ─── */
async function openLocationSheet() {
  modal.classList.add("active");

  // Use cached coords if we have them
  if (cachedLat && cachedLng) {
    updateSheet(cachedLat, cachedLng);
    return;
  }

  coordsEl.textContent = "Getting your location…";
  linkBoxEl.textContent = "Generating link…";

  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, {
        enableHighAccuracy: true,
        timeout: 8000
      })
    );

    cachedLat = pos.coords.latitude;
    cachedLng = pos.coords.longitude;
    updateSheet(cachedLat, cachedLng);

  } catch (err) {
    coordsEl.textContent = "Location unavailable";
    linkBoxEl.textContent = "Please allow location access in your browser.";
    toast("📍 Location access denied", "error");
  }
}

function updateSheet(lat, lng) {
  shareLink = buildLink(lat, lng);
  coordsEl.textContent = buildCoordsStr(lat, lng);
  linkBoxEl.textContent = shareLink;
}

/* ─── Copy link ─── */
if (copyBtn) {
  copyBtn.addEventListener("click", async () => {
    if (!shareLink) return;
    try {
      await navigator.clipboard.writeText(shareLink);
      copyBtn.textContent = "✓ Copied!";
      toast("📋 Location link copied to clipboard", "success");
      setTimeout(() => { copyBtn.innerHTML = "📋 Copy Link"; }, 2000);
    } catch {
      toast("Could not copy — try manually", "error");
    }
  });
}

/* ─── Open in Google Maps ─── */
if (openMapsBtn) {
  openMapsBtn.addEventListener("click", () => {
    if (!shareLink) return;
    window.open(shareLink, "_blank");
  });
}

/* ─── WhatsApp share ─── */
if (waBtn) {
  waBtn.addEventListener("click", () => {
    if (!cachedLat || !cachedLng) { toast("Location not ready", "error"); return; }
    const msg = `🚨 My current location (RakshaNet):\n${shareLink}\n\nI'm sharing this so you know where I am. Please check in with me.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
  });
}

/* ─── Native share (mobile) ─── */
if (nativeBtn) {
  nativeBtn.addEventListener("click", async () => {
    if (!shareLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Location — RakshaNet",
          text: "Here's my current location. I'm sharing this for safety.",
          url: shareLink,
        });
      } catch (e) {
        if (e.name !== "AbortError") toast("Share failed", "error");
      }
    } else {
      // Fallback: copy
      await navigator.clipboard.writeText(shareLink).catch(() => {});
      toast("📋 Link copied (share not supported on this browser)", "info");
    }
  });
}

/* ─── Trigger from nav button ─── */
if (shareLocBtn) {
  shareLocBtn.addEventListener("click", openLocationSheet);
}

/* ─── Close on backdrop tap ─── */
modal.addEventListener("click", (e) => {
  if (e.target === modal) modal.classList.remove("active");
});