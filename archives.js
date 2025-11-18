import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
  getFirestore,
  collection,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc, // Gardé au cas où, mais updateDoc n'est pas utilisé ici
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

// --- Config Firebase (Inchangée) ---
const firebaseConfig = {
  apiKey: "AIzaSyDL9uGQAzor_sVUSi1l5sIsiAeEH0tFmCg",
  authDomain: "mes-deadlines.firebaseapp.com",
  projectId: "mes-deadlines",
  storageBucket: "mes-deadlines.firebasestorage.app",
  messagingSenderId: "365959927461",
  appId: "1:365959927461:web:39c83a098b330102911f4c",
  measurementId: "G-3TTTRJC3QD",
};

// --- Variables globales pour les Stats (Inchangées) ---
const projectStatsDiv = document.getElementById("project-stats");
const completedCountSpan = document.getElementById("completed-count");
const totalCountSpan = document.getElementById("total-count");

// --- Initialisation Firebase (Inchangée) ---
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const projectsCollection = collection(db, "projects");

// --- Écouteur principal ---
document.addEventListener("DOMContentLoaded", () => {
  // --- Éléments du DOM (Simplifié) ---
  // NOUVEAU : Cible la grille d'archives
  const archiveGrid = document.getElementById("archive-grid");

  // Éléments d'Auth (Inchangés)
  const loginBtn = document.getElementById("login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userDetails = document.getElementById("user-details");

  let currentUser = null;
  let unsubscribeFromProjects = null;

  // --- Gestion Auth (Inchangée) ---
  loginBtn.addEventListener("click", () => {
    signInWithPopup(auth, provider).catch((error) => console.error(error));
  });

  logoutBtn.addEventListener("click", () => {
    signOut(auth).catch((error) => console.error(error));
  });

  // --- onAuthStateChanged (Modifié) ---
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      uiForLoggedIn(user); // Fonction simplifiée (voir plus bas)

      if (unsubscribeFromProjects) unsubscribeFromProjects();
      unsubscribeFromProjects = listenToProjects(user.uid);
    } else {
      currentUser = null;
      uiForLoggedOut(); // Fonction simplifiée (voir plus bas)

      if (unsubscribeFromProjects) unsubscribeFromProjects();

      // MODIFIÉ : Nettoie la grille d'archives
      archiveGrid.innerHTML =
        "<p>Veuillez vous connecter pour voir vos archives.</p>";
    }
  });

  // --- SUPPRIMÉ : Le 'projectForm.addEventListener' a été enlevé ---

  // --- listenToProjects (Modifié) ---
  function listenToProjects(userId) {
    // La requête est la MÊME : on a besoin de TOUS les projets
    // pour que les stats (ex: 5 / 8) soient correctes.
    const q = query(
      projectsCollection,
      where("userId", "==", userId),
      orderBy("end", "desc") // Optionnel : trie par date de fin la plus récente
    );

    return onSnapshot(q, (snapshot) => {
      // MODIFIÉ : On nettoie la grille d'archives
      archiveGrid.innerHTML = "";

      let pendingCount = 0;
      let completedCount = 0;
      let totalProjects = snapshot.size;

      if (snapshot.empty) {
        // MODIFIÉ
        archiveGrid.innerHTML = "<p>Aucun projet terminé.</p>";

        completedCountSpan.textContent = 0;
        totalCountSpan.textContent = 0;
        return;
      }

      snapshot.forEach((doc) => {
        const status = doc.data().status || "pending";
        const projectCard = renderProject(doc);

        if (projectCard) {
          // MODIFIÉ : On affiche SEULEMENT les "completed"
          if (status === "completed") {
            archiveGrid.appendChild(projectCard);
            completedCount++;
          } else {
            // On les compte quand même pour les stats
            pendingCount++;
          }
        } else {
          console.error("Impossible d'afficher un projet:", doc.data());
          totalProjects--;
        }
      });

      // MODIFIÉ : On vérifie si la grille d'archives est vide
      if (completedCount === 0) {
        archiveGrid.innerHTML = "<p>Aucun projet terminé.</p>";
      }

      // Mise à jour des stats (Inchangée)
      completedCountSpan.textContent = completedCount;
      totalCountSpan.textContent = totalProjects;
    });
  }

  // --- renderProject (Inchangé) ---
  // Cette fonction est identique à celle de script.js
  function renderProject(doc) {
    const project = doc.data();
    const projectId = doc.id;
    const status = project.status || "pending";
    const today = new Date().getTime();
    const startDate = new Date(project.start).getTime();
    const endDate = new Date(project.end).getTime();
    if (isNaN(startDate) || isNaN(endDate)) return;

    let percentage = 0;
    if (status === "completed") {
      percentage = 100;
    } else {
      const totalDuration = endDate - startDate;
      const elapsedDuration = today - startDate;
      if (today < startDate) percentage = 0;
      else if (today > endDate) percentage = 100;
      else if (totalDuration > 0)
        percentage = (elapsedDuration / totalDuration) * 100;
      percentage = Math.round(Math.max(0, Math.min(percentage, 100)));
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const remainingDays = (endDate - today) / msPerDay;
    const isUrgent =
      status === "pending" && percentage < 100 && remainingDays <= 3;

    const projectCard = document.createElement("div");
    projectCard.className = "project-card";
    if (isUrgent) projectCard.classList.add("is-urgent");
    if (status === "completed") projectCard.classList.add("is-completed");

    // MODIFIÉ : On ne met plus le bouton "Terminer"
    const projectActionsHTML = `
             <div class="project-actions">
                 ${
                   status === "pending"
                     ? // Ne devrait jamais arriver, mais par sécurité
                       `<span style="color: #777;">En cours...</span>`
                     : '<span class="project-completed-text">TERMINÉ</span>'
                 }
                 <button class="delete-btn" data-id="${projectId}">Supprimer</button>
             </div>
         `;

    const progressInnerClass = status === "completed" ? "is-completed" : "";

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
                <div class="progress-bar-inner ${progressInnerClass}" style="width: ${percentage}%;">
                    ${percentage}%
                </div>
            </div>
            ${projectActionsHTML}
        `;
    return projectCard;
  }

  // --- Écouteur de Clics (Modifié) ---
  // MODIFIÉ : Écoute sur "archiveGrid"
  archiveGrid.addEventListener("click", async (e) => {
    // Gérer la suppression (Inchangé)
    if (e.target.classList.contains("delete-btn")) {
      const idToDelete = e.target.getAttribute("data-id");
      if (!confirm("Êtes-vous sûr de vouloir supprimer ce projet archivé ?")) {
        return;
      }
      try {
        const docRef = doc(db, "projects", idToDelete);
        await deleteDoc(docRef);
      } catch (error) {
        console.error("Erreur lors de la suppression: ", error);
      }
    }

    // SUPPRIMÉ : La logique du "complete-btn" est inutile ici
  });

  // --- Fonctions UI (Simplifiées) ---
  function uiForLoggedIn(user) {
    loginBtn.style.display = "none";
    logoutBtn.style.display = "inline-block";
    userDetails.textContent = `Connecté: ${user.email}`;
    projectStatsDiv.style.display = "flex";
    // Lignes du formulaire supprimées
  }

  function uiForLoggedOut() {
    loginBtn.style.display = "inline-block";
    logoutBtn.style.display = "none";
    userDetails.textContent = "";
    projectStatsDiv.style.display = "none";
    // Lignes du formulaire supprimées
  }
});
