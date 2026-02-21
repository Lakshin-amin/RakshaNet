import { onUserStateChanged } from "./firebase-init.js";

const BACKEND_URL = "https://rakshanetwork-backend.onrender.com";

let currentUserId = null;

const nameInput = document.getElementById("nameInput");
const phoneInput = document.getElementById("phoneInput");
const saveBtn = document.getElementById("saveContactBtn");
const contactsList = document.getElementById("contactsList");


/* ✅ LOAD CONTACTS */
async function loadContacts() {
  if (!currentUserId) return;

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

    contacts.forEach((c) => {
      const div = document.createElement("div");

      div.className =
        "p-3 border rounded-lg bg-slate-50 flex justify-between items-center";

      div.innerHTML = `
        <div>
          <p class="font-semibold">${c.name}</p>
          <p class="text-sm text-slate-600">${c.phone}</p>
        </div>

        <button
          class="text-red-600 font-bold hover:text-red-800"
          data-id="${c.id}"
        >
          ❌
        </button>
      `;

      // ✅ Delete button click
      div.querySelector("button").addEventListener("click", async () => {
        await deleteContact(c.id);
      });

      contactsList.appendChild(div);
    });
  } catch (err) {
    console.log("Failed to load contacts:", err);
  }
}


/* ✅ SAVE CONTACT */
saveBtn.addEventListener("click", async () => {
  if (!currentUserId) {
    alert("Please login first!");
    return;
  }

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();

  if (!name) return alert("Enter name!");
  if (!phone.startsWith("+")) return alert("Enter valid phone with +91");

  await fetch(`${BACKEND_URL}/add-contact`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: currentUserId,
      name,
      phone,
    }),
  });

  alert("✅ Contact saved!");

  nameInput.value = "";
  phoneInput.value = "";

  loadContacts();
});


/* ✅ DELETE CONTACT */
async function deleteContact(id) {
  await fetch(`${BACKEND_URL}/delete-contact/${id}`, {
    method: "DELETE",
  });

  alert("🗑 Contact deleted!");

  loadContacts();
}


/* ✅ AUTH STATE */
onUserStateChanged((user) => {
  if (user) {
    currentUserId = user.email;
    console.log("Logged in:", currentUserId);

    loadContacts();
  } else {
    alert("Please login first!");
    window.location.href = "../index.html";
  }
});
