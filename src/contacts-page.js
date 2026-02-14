import { onUserStateChanged } from "./firebase-init.js";

/* --- BACKEND URL --- */
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

/* --- ELEMENTS (from your HTML) --- */
const contactInput = document.getElementById("contactInput");
const saveContactBtn = document.getElementById("saveContactBtn");
const contactsList = document.getElementById("contactsList");

/* --- STATE --- */
let currentUserId = null;

/* ======================================================
   Render Contact
====================================================== */
function renderContact(phone) {
  const div = document.createElement("div");

  div.className =
    "p-3 border rounded-lg bg-slate-50 flex justify-between items-center";

  div.innerHTML = `
    <span class="text-sm font-medium">${phone}</span>
    <span class="text-xs text-green-600">Saved</span>
  `;

  contactsList.appendChild(div);
}

/* ======================================================
   Load Contacts from Backend
====================================================== */
async function loadContacts() {
  if (!contactsList) return;

  if (!currentUserId) {
    contactsList.innerHTML =
      "<p class='text-sm text-slate-500'>⚠️ Please login first.</p>";
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/contacts/${currentUserId}`);
    const data = await res.json();

    const contacts = data.contacts || [];

    contactsList.innerHTML = "";

    if (contacts.length === 0) {
      contactsList.innerHTML =
        "<p class='text-sm text-slate-500'>No contacts added yet.</p>";
      return;
    }

    contacts.forEach((phone) => renderContact(phone));
  } catch (err) {
    console.log("Failed to load contacts:", err);

    contactsList.innerHTML =
      "<p class='text-sm text-red-500'>Error loading contacts.</p>";
  }
}

/* ======================================================
   Save Contact to Backend
====================================================== */
async function saveContact(phone) {
  if (!currentUserId) {
    alert("⚠️ Please login first!");
    return;
  }

  try {
    await fetch(`${BACKEND_URL}/add-contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: currentUserId,
        phone: phone,
      }),
    });

    alert("✅ Contact Saved!");

    loadContacts();
  } catch (err) {
    console.log("Failed to save contact:", err);
    alert("❌ Could not save contact");
  }
}

/* ======================================================
   Button Click (Save Contact)
====================================================== */
if (saveContactBtn) {
  saveContactBtn.addEventListener("click", async () => {
    const phone = contactInput.value.trim();

    if (!phone.startsWith("+")) {
      alert("Enter number like +91XXXXXXXXXX");
      return;
    }

    await saveContact(phone);

    contactInput.value = "";
  });
}

/* ======================================================
   Firebase Auth Listener
====================================================== */
onUserStateChanged((user) => {
  if (user) {
    currentUserId = user.email;
    console.log("✅ Logged in:", currentUserId);

    loadContacts();
  } else {
    currentUserId = null;

    contactsList.innerHTML =
      "<p class='text-sm text-slate-500'>⚠️ Please login first.</p>";
  }
});
