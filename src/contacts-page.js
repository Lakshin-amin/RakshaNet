/* --- BACKEND URL --- */
const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

/* --- ELEMENTS --- */
const form = document.getElementById("contactForm");
const nameInput = document.getElementById("name");
const phoneInput = document.getElementById("phone");
const contactList = document.getElementById("contactList");

/* --- Current User (for now demoUser) --- */
let currentUserId = "demoUser";

/* --- Render Contact UI --- */
function renderContact(phone) {
  const div = document.createElement("div");

  div.className =
    "p-3 border rounded-lg bg-slate-50 flex justify-between items-center";

  div.innerHTML = `
    <span class="text-sm font-medium">${phone}</span>
  `;

  contactList.appendChild(div);
}

/* --- Load Contacts from Backend --- */
async function loadContacts() {
  contactList.innerHTML = "";

  try {
    const res = await fetch(
      `${BACKEND_URL}/get-contacts?userId=${currentUserId}`
    );

    const data = await res.json();

    if (data.length === 0) {
      contactList.innerHTML =
        "<p class='text-sm text-slate-500'>No contacts added yet.</p>";
      return;
    }

    data.forEach((c) => renderContact(c.phone));
  } catch (err) {
    console.log("Failed to load contacts:", err);
  }
}

/* --- Add Contact Form Submit --- */
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const phone = phoneInput.value.trim();

  if (!phone.startsWith("+")) {
    alert("Phone must include country code, e.g. +91xxxxxxxxxx");
    return;
  }

  // Save contact into backend
  await fetch(`${BACKEND_URL}/add-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUserId,
      phone: phone,
    }),
  });

  phoneInput.value = "";
  nameInput.value = "";

  alert("✅ Contact saved successfully!");

  loadContacts();
});

/* --- Load Automatically on Page Open --- */
window.addEventListener("load", loadContacts);
