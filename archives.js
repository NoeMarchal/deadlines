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
  getDoc,
  setDoc
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

const GAME_CONFIG = {
  xpReward: 500,
  coinReward: 700,
  levelStep: 800
};


const modalOverlay = document.getElementById("custom-modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalText = document.getElementById("modal-text");
const modalInput = document.getElementById("modal-input");

function showCustomModal(type, message, placeholder = "") {
  return new Promise((resolve) => {
    if (!modalOverlay) {
      if (type === "confirm") return resolve(confirm(message));
      alert(message);
      return resolve(true);
    }

    const btnOk = document.getElementById("modal-btn-ok");
    const btnCancel = document.getElementById("modal-btn-cancel");

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


document.addEventListener("DOMContentLoaded", () => {
  const archiveGrid = document.getElementById("archive-grid");
  const projectStatsDiv = document.getElementById("project-stats");
  const completedCountSpan = document.getElementById("completed-count");
  const totalCountSpan = document.getElementById("total-count");
  const loginBtn = document.getElementById("login-btn");
  const userDetails = document.getElementById("user-details");
  const userLevelContainer = document.getElementById('user-level-container');


  const settingsBtn = document.getElementById('settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const themeSelector = document.getElementById('theme-selector');
  const settingsApiKeyInput = document.getElementById('settings-api-key');
  const saveApiBtn = document.getElementById('save-api-btn');
  const logoutBtnSettings = document.getElementById('logout-btn-settings');


  const helpBtn = document.getElementById('help-btn');
  const helpOverlay = document.getElementById('help-modal-overlay');
  const closeHelpBtn = document.getElementById('close-help-btn');

  let unsubscribeFromProjects = null;


  const currentTheme = localStorage.getItem('site_theme') || 'theme-retro';
  document.body.className = currentTheme;
  if (themeSelector) themeSelector.value = currentTheme;


  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      settingsOverlay.style.display = 'flex';
      const key = localStorage.getItem('GEMINI_API_KEY');
      if (key) settingsApiKeyInput.value = key;
    });
  }

  if (closeSettingsBtn) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsOverlay.style.display = 'none';
    });
  }

  if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
      const newTheme = e.target.value;
      document.body.className = newTheme;
      localStorage.setItem('site_theme', newTheme);
    });
  }

  if (saveApiBtn) {
    saveApiBtn.addEventListener('click', () => {
      const newKey = settingsApiKeyInput.value.trim();
      if (newKey) {
        localStorage.setItem('GEMINI_API_KEY', newKey);
        alert("Clé API enregistrée !");
      }
    });
  }

  if (logoutBtnSettings) {
    logoutBtnSettings.addEventListener('click', () => {
      signOut(auth).catch((error) => console.error(error));
      settingsOverlay.style.display = 'none';
    });
  }

  if (helpBtn && helpOverlay && closeHelpBtn) {
    helpBtn.addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
    closeHelpBtn.addEventListener('click', () => { helpOverlay.style.display = 'none'; });
    helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) helpOverlay.style.display = 'none'; });
  }


  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      signInWithPopup(auth, provider).catch((error) => console.error(error));
    });
  }

  onAuthStateChanged(auth, (user) => {
    if (user) {
      uiForLoggedIn(user);
      syncUserData(user);
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

  if (archiveGrid) {
    archiveGrid.addEventListener("click", async (e) => {
      if (e.target.classList.contains("delete-btn")) {
        const idToDelete = e.target.getAttribute("data-id");
        const confirmed = await myConfirm("Êtes-vous sûr de vouloir supprimer ce projet archivé ?");
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
    if (settingsBtn) settingsBtn.style.display = "inline-block";

    if (userDetails) userDetails.textContent = "";
    if (projectStatsDiv) projectStatsDiv.style.display = "flex";
  }

  function uiForLoggedOut() {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (settingsBtn) settingsBtn.style.display = "none";

    if (userDetails) userDetails.textContent = "";
    if (projectStatsDiv) projectStatsDiv.style.display = "none";
  }


  async function syncUserData(user) {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      const coins = data.coins || 0;
      updateTopBarUI(data.xp || 0, data.level || 1, coins);
    } else {
      updateTopBarUI(0, 1, 0);
    }
  }

  function updateTopBarUI(xp, level, coins) {
    if (!userLevelContainer) return;
    const levelBadge = document.getElementById('level-badge');
    const xpBarFill = document.getElementById('xp-bar-fill');
    const xpText = document.getElementById('xp-text');

    userLevelContainer.style.display = 'flex';
    levelBadge.textContent = `LVL ${level}`;

    const currentLevelXp = xp % GAME_CONFIG.levelStep;
    xpText.textContent = `${currentLevelXp} / ${GAME_CONFIG.levelStep} XP`;

    const progress = (currentLevelXp) / GAME_CONFIG.levelStep * 100;
    xpBarFill.style.width = `${progress}%`;
  }
});