import { currentUser, signOutGoogle, getSheetsToken } from "./auth.js";

// Minimal header with sign-out (optional)
function mountBasicHeader() {
  const hdr = document.createElement("div");
  hdr.className = "max-w-3xl mx-auto p-4 flex items-center justify-between";
  hdr.innerHTML = `
    <div class="text-sm text-gray-600" id="whoami"></div>
    <button id="btnLogout" class="px-3 py-1.5 rounded-lg bg-gray-200 text-sm">Sign out</button>
  `;
  document.getElementById("appRoot").prepend(hdr);
  document.getElementById("btnLogout").addEventListener("click", signOutGoogle);
  const u = currentUser();
  document.getElementById("whoami").textContent = u?.email || "";
}

function notifyExistingApp() {
  const u = currentUser();
  document.dispatchEvent(new CustomEvent("auth:state", { detail: { user: u } }));
  // proactively obtain a token once (optional)
//   getSheetsToken().then((token) => {
//     document.dispatchEvent(new CustomEvent("sheets:ready", { detail: { token, user: u } }
      
//     )
//   );
//   }
// ).catch(() => {});
// 
}

document.addEventListener("auth:state", (e) => {
  const el = document.getElementById("whoami");
  if (el) el.textContent = e.detail.user?.email || "";
});

mountBasicHeader();
notifyExistingApp();
