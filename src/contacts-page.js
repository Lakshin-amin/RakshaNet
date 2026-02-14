import { onUserStateChanged } from "./firebase-init.js";

/* Backend URL */
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

let currentUserId = null;

/* Elements */
const contactInput = document.getElementById("contactInput");
const saveBtn = document.getElementById("saveContactBtn");
const contactsList = document.getElementById("contactsList");

/* Load Contacts */
async function loadContacts() {
  if (!currentUserId) return;

  const res = await fetch(`${BACKEND_URL}/contacts/${currentUserId}`);
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
      "p-3 border rounded-lg bg-slate-50 text-sm font-medium";

    div.innerText = phone;

    contactsList.appendChild(div);
  });
}

/* Save Contact */
saveBtn.addEventListener("click", async () => {
  const phone = contactInput.value.trim();

  if (!phone.startsWith("+")) {
    alert("Enter number in format +91XXXXXXXXXX");
    return;
  }

  await fetch(`${BACKEND_URL}/add-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUserId,
      phone: phone,
    }),
  });

  alert("✅ Contact saved!");

  contactInput.value = "";
  loadContacts();
});

/* Firebase Login Detection */
onUserStateChanged((user) => {
  if (user) {
    currentUserId = user.email;
    loadContacts();
  } else {
    alert("Please login first to manage contacts.");
    window.location.href = "../index.html";
  }
});
