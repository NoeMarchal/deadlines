import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDL9uGQAzor_sVUSi1l5sIsiAeEH0tFmCg",
  authDomain: "mes-deadlines.firebaseapp.com",
  projectId: "mes-deadlines",
  storageBucket: "mes-deadlines.firebasestorage.app",
  messagingSenderId: "365959927461",
  appId: "1:365959927461:web:39c83a098b330102911f4c",
  measurementId: "G-3TTTRJC3QD",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const projectsCollection = collection(db, "projects");

// --- SYSTÈME D'ALERTES PERSONNALISÉES (Code copié pour les archives) ---
const modalOverlay = document.getElementById("custom-modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalText = document.getElementById("modal-text");
const modalInput = document.getElementById("modal-input");
const btnOk = document.getElementById("modal-btn-ok");
const btnCancel = document.getElementById("modal-btn-cancel");

function showCustomModal(type, message, placeholder = "") {
  return new Promise((resolve) => {
    if (!modalOverlay) {
      // Fallback si le HTML n'est pas chargé
      if (type === "confirm") return resolve(confirm(message));
      alert(message);
      return resolve(true);
    }
    modalOverlay.style.display = "flex";
    modalText.textContent = message;

    if (modalInput) {
      modalInput.value = "";
      modalInput.style.display = "none";
    }

    if (btnCancel) btnCancel.style.display = "none";
    if (btnOk) btnOk.textContent = "OK";

    if (type === "confirm") {
      if (modalTitle) modalTitle.textContent = "CONFIRMATION REQUISE";
      if (btnCancel) btnCancel.style.display = "block";
      if (btnOk) btnOk.textContent = "OUI";
    } else {
      if (modalTitle) modalTitle.textContent = "MESSAGE SYSTÈME";
    }

    // Remplacement des boutons pour supprimer les anciens écouteurs
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnOk.addEventListener("click", () => {
      modalOverlay.style.display = "none";
      resolve(true);
    });

    newBtnCancel.addEventListener("click", () => {
      modalOverlay.style.display = "none";
      resolve(false);
    });
  });
}

const myConfirm = (msg) => showCustomModal("confirm", msg);

// --- LOGIQUE PRINCIPALE DES ARCHIVES ---
document.addEventListener("DOMContentLoaded", () => {
  const archiveGrid = document.getElementById("archive-grid");
  const projectStatsDiv = document.getElementById("project-stats");
  const completedCountSpan = document.getElementById("completed-count");
  const totalCountSpan = document.getElementById("total-count");
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userDetails = document.getElementById("user-details");

  let unsubscribeFromProjects = null;

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      signInWithPopup(auth, provider).catch((error) => console.error(error));
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      signOut(auth).catch((error) => console.error(error));
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      uiForLoggedIn(user);
      if (unsubscribeFromProjects) unsubscribeFromProjects();
      unsubscribeFromProjects = listenToProjects(user.uid);
    } else {
      uiForLoggedOut();
      if (unsubscribeFromProjects) unsubscribeFromProjects();
      if (archiveGrid)
        archiveGrid.innerHTML =
          "<p>Veuillez vous connecter pour voir vos archives.</p>";
    }
  });

  function listenToProjects(userId) {
    const q = query(
      projectsCollection,
      where("userId", "==", userId),
      orderBy("end", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      if (!archiveGrid) return;
      archiveGrid.innerHTML = "";

      let completedCount = 0;
      let totalProjects = snapshot.size;

      if (snapshot.empty) {
        archiveGrid.innerHTML = "<p>Aucun projet terminé.</p>";
        if (completedCountSpan) completedCountSpan.textContent = 0;
        if (totalCountSpan) totalCountSpan.textContent = 0;
        return;
      }

      snapshot.forEach((doc) => {
        const status = doc.data().status || "pending";
        const projectCard = renderProject(doc);

        if (projectCard) {
          if (status === "completed") {
            archiveGrid.appendChild(projectCard);
            completedCount++;
          }
        } else {
          totalProjects--;
        }
      });

      if (completedCount === 0) {
        archiveGrid.innerHTML = "<p>Aucun projet terminé.</p>";
      }

      if (completedCountSpan) completedCountSpan.textContent = completedCount;
      if (totalCountSpan) totalCountSpan.textContent = totalProjects;
    });
  }

  function renderProject(doc) {
    const project = doc.data();
    const projectId = doc.id;

    const projectCard = document.createElement("div");
    projectCard.className = "project-card is-completed";

    projectCard.innerHTML = `
            <div class="project-header">
                <h3>${project.name}</h3>
                <span class="project-dates">
                    ${new Date(
                      project.start
                    ).toLocaleDateString()} - ${new Date(
      project.end
    ).toLocaleDateString()}
                </span>
            </div>
            <div class="progress-bar-container">
                <div class="progress-bar-inner is-completed" style="width: 100%;">
                    100%
                </div>
            </div>
            <div class="project-actions">
                 <span class="project-completed-text">TERMINÉ</span>
                 <button class="delete-btn" data-id="${projectId}">Supprimer</button>
            </div>
        `;
    return projectCard;
  }

  // GESTION DU CLIC (Suppression)
  if (archiveGrid) {
    archiveGrid.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-btn")) {
        const idToDelete = e.target.getAttribute("data-id");

        // ICI ON UTILISE NOTRE MODALE PERSONNALISÉE
        const confirmed = await myConfirm(
          "Êtes-vous sûr de vouloir supprimer ce projet archivé ?"
        );

        if (!confirmed) return;

        try {
          const docRef = doc(db, "projects", idToDelete);
          await deleteDoc(docRef);
        } catch (error) {
          console.error("Erreur lors de la suppression: ", error);
        }
      }
    });
  }

  function uiForLoggedIn(user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (logoutBtn) logoutBtn.style.display = "inline-block";
    if (userDetails)
      userDetails.textContent = `Connecté: ${user.email.split("@")[0]}`;
    if (projectStatsDiv) projectStatsDiv.style.display = "flex";
  }

  function uiForLoggedOut() {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (logoutBtn) logoutBtn.style.display = "none";
    if (userDetails) userDetails.textContent = "";
    if (projectStatsDiv) projectStatsDiv.style.display = "none";
  }
});
