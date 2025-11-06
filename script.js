// --------------- ÉTAPE 1 : IMPORTER LES OUTILS ---------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, 
    deleteDoc, doc, query, orderBy, where,
    updateDoc // <-- NOUVEAU : Importer updateDoc
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { 
    getAuth, GoogleAuthProvider, signInWithPopup, 
    signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";


// --------------- ÉTAPE 2 : CONFIGURATION FIREBASE ---------------
const firebaseConfig = {
    apiKey: "AIzaSyDL9uGQAzor_sVUSi1l5sIsiAeEH0tFmCg",
    authDomain: "mes-deadlines.firebaseapp.com",
    projectId: "mes-deadlines",
    storageBucket: "mes-deadlines.firebasestorage.app",
    messagingSenderId: "365959927461",
    appId: "1:365959927461:web:39c83a098b330102911f4c",
    measurementId: "G-3TTTRJC3QD"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Référence à la collection
const projectsCollection = collection(db, 'projects');


document.addEventListener('DOMContentLoaded', () => {

    // --------------- ÉTAPE 3 : LOGIQUE DE L'APPLICATION ---------------

    // Récupérer les éléments du DOM
    const projectForm = document.getElementById('project-form');
    const projectsContainer = document.getElementById('projects-container');
    const archivedContainer = document.getElementById('archived-container'); // <-- NOUVEAU
    const projectNameInput = document.getElementById('project-name');
    const startDateInput = document.getElementById('start-date');
    const endDateInput = document.getElementById('end-date');
    
    const addProjectBtn = document.getElementById('add-project-btn'); 

    // Éléments d'Auth
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    const userDetails = document.getElementById('user-details');

    let currentUser = null; 
    let unsubscribeFromProjects = null;
    let unsubscribeFromArchives = null; // <-- NOUVEAU

    // Gérer les clics de connexion/déconnexion
    loginBtn.addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(error => console.error(error));
    });

    logoutBtn.addEventListener('click', () => {
        signOut(auth).catch(error => console.error(error));
    });

    // Écouteur principal de l'état d'authentification
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // --- L'utilisateur EST connecté ---
            currentUser = user;
            uiForLoggedIn(user);
            
            // MODIFIÉ : On arrête les deux écouteurs
            if (unsubscribeFromProjects) unsubscribeFromProjects();
            if (unsubscribeFromArchives) unsubscribeFromArchives();

            // MODIFIÉ : On démarre les deux écouteurs
            unsubscribeFromProjects = listenToProjects(user.uid);
            unsubscribeFromArchives = listenToArchivedProjects(user.uid); // <-- NOUVEAU

        } else {
            // --- L'utilisateur N'EST PAS connecté ---
            currentUser = null;
            uiForLoggedOut();
            
            // MODIFIÉ : On arrête les deux écouteurs
            if (unsubscribeFromProjects) unsubscribeFromProjects();
            if (unsubscribeFromArchives) unsubscribeFromArchives();
            
            // MODIFIÉ : On vide les deux conteneurs
            projectsContainer.innerHTML = '<h2>Mes projets en cours</h2><p>Veuillez vous connecter pour voir vos projets.</p>';
            archivedContainer.innerHTML = '<h2>Projets archivés</h2><p>Veuillez vous connecter pour voir vos archives.</p>'; // <-- NOUVEAU
        }
    });

    // --- AJOUTER UN PROJET ---
    projectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentUser) {
            alert("Vous devez être connecté pour ajouter un projet.");
            return;
        }

        const name = projectNameInput.value;
        const start = startDateInput.value;
        const end = endDateInput.value;

        if (new Date(start).getTime() >= new Date(end).getTime()) {
            alert("La date de fin doit être après la date de début !");
            return;
        }

        try {
            await addDoc(projectsCollection, {
                name: name,
                start: start,
                end: end,
                userId: currentUser.uid,
                isArchived: false // <-- NOUVEAU : Champ pour l'archivage
            });
            projectForm.reset();
        } catch (error) {
            console.error("Erreur lors de l'ajout du projet: ", error);
        }
    });

    // --- AFFICHER LES PROJETS ACTIFS ---
    function listenToProjects(userId) {
        // MODIFIÉ : Ajout de where("isArchived", "==", false)
        const q = query(
            projectsCollection, 
            where("userId", "==", userId),
            where("isArchived", "==", false), // <-- NOUVEAU
            orderBy("end", "asc")
        );

        return onSnapshot(q, (snapshot) => {
            projectsContainer.innerHTML = '<h2>Mes projets en cours</h2>';
            if (snapshot.empty) {
                projectsContainer.innerHTML += '<p>Aucun projet en cours pour le moment.</p>';
                return;
            }
            // MODIFIÉ : On passe le conteneur et le type à renderProject
            snapshot.forEach(doc => renderProject(doc, projectsContainer, 'active'));
        });
    }

    // --- NOUVEAU : AFFICHER LES PROJETS ARCHIVÉS ---
    function listenToArchivedProjects(userId) {
        const q = query(
            projectsCollection, 
            where("userId", "==", userId),
            where("isArchived", "==", true), // <-- NOUVEAU
            orderBy("end", "desc") // On trie par les plus récents en premier
        );

        return onSnapshot(q, (snapshot) => {
            archivedContainer.innerHTML = '<h2>Projets archivés</h2>';
            if (snapshot.empty) {
                archivedContainer.innerHTML += '<p>Aucun projet archivé.</p>';
                return;
            }
            // MODIFIÉ : On passe le conteneur et le type à renderProject
            snapshot.forEach(doc => renderProject(doc, archivedContainer, 'archived'));
        });
    }


    // --- MODIFIÉ : Fonction pour afficher UN projet (actif OU archivé) ---
    function renderProject(doc, container, type) {
        const project = doc.data();
        const projectId = doc.id;

        // Logique de pourcentage (uniquement pour les projets actifs)
        let percentage = 0;
        let isUrgent = false;
        if (type === 'active') {
            const today = new Date().getTime();
            const startDate = new Date(project.start).getTime();
            const endDate = new Date(project.end).getTime();
            if (isNaN(startDate) || isNaN(endDate)) return;
            const totalDuration = endDate - startDate;
            const elapsedDuration = today - startDate;
            
            if (today < startDate) percentage = 0;
            else if (today > endDate) percentage = 100;
            else if (totalDuration > 0) percentage = (elapsedDuration / totalDuration) * 100;
            percentage = Math.round(Math.max(0, Math.min(percentage, 100)));

            // Logique d'urgence
            const msPerDay = 1000 * 60 * 60 * 24;
            const remainingDays = (endDate - today) / msPerDay;
            isUrgent = (percentage < 100 && remainingDays <= 3);
        }
        
        // Création de la carte
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card';
        
        // Ajout des classes conditionnelles
        if (isUrgent) {
            projectCard.classList.add('is-urgent');
        }
        if (type === 'archived') {
            projectCard.classList.add('is-archived');
        }

        // --- MODIFIÉ : Génération du HTML de la carte ---
        
        // 1. En-tête (identique)
        let cardHTML = `
            <div class="project-header">
                <h3>${project.name}</h3>
                <span class="project-dates">
                    ${new Date(project.start).toLocaleDateString()} - ${new Date(project.end).toLocaleDateString()}
                </span>
            </div>
        `;

        // 2. Barre de progression (uniquement si actif)
        if (type === 'active') {
            cardHTML += `
            <div class="progress-bar-container">
                <div class="progress-bar-inner" style="width: ${percentage}%;">
                    ${percentage}%
                </div>
            </div>
            `;
        }

        // 3. Boutons (différents selon le type)
        if (type === 'active') {
            cardHTML += `
                <button class="archive-btn" data-id="${projectId}">Archiver</button>
                <button class="delete-btn" data-id="${projectId}">Supprimer</button>
            `;
        } else { // 'archived'
            cardHTML += `
                <button class="restore-btn" data-id="${projectId}">Restaurer</button>
                <button class="delete-btn" data-id="${projectId}">Suppr. Déf.</button>
            `;
        }
        
        projectCard.innerHTML = cardHTML;
        container.appendChild(projectCard);
    }

    // --- NOUVEAU : Fonction pour (dés)archiver un projet ---
    async function toggleProjectArchive(id, newStatus) {
        try {
            const docRef = doc(db, 'projects', id);
            await updateDoc(docRef, {
                isArchived: newStatus
            });
        } catch (error) {
            console.error("Erreur lors de la mise à jour: ", error);
        }
    }


    // --- MODIFIÉ : Écouteur de clics global pour tous les boutons ---
    // On attache les écouteurs au 'main' document pour qu'ils fonctionnent
    // pour les deux conteneurs (projectsContainer et archivedContainer).
    document.querySelector('main').addEventListener('click', async (e) => {
        const target = e.target;
        const id = target.getAttribute('data-id');

        if (!id) return; // Pas un bouton qui nous intéresse

        if (target.classList.contains('delete-btn')) {
            // Confirmation pour la suppression
            const isArchived = target.closest('.is-archived');
            const confirmationText = isArchived
                ? "Voulez-vous vraiment supprimer définitivement ce projet ?\n(Cette action est irréversible)"
                : "Voulez-vous vraiment supprimer ce projet ?\n(Vous pouvez l'archiver à la place)";
                
            if (confirm(confirmationText)) {
                try {
                    const docRef = doc(db, 'projects', id);
                    await deleteDoc(docRef);
                } catch (error) {
                    console.error("Erreur lors de la suppression: ", error);
                }
            }
        } 
        else if (target.classList.contains('archive-btn')) {
            // Archiver le projet
            toggleProjectArchive(id, true);
        } 
        else if (target.classList.contains('restore-btn')) {
            // Restaurer le projet
            toggleProjectArchive(id, false);
        }
    });

    // --- Fonctions de gestion de l'interface (inchangées) ---
    function uiForLoggedIn(user) {
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-block';
        userDetails.textContent = `Connecté: ${user.email}`;
        projectForm.style.display = 'grid';
        
        if (addProjectBtn) addProjectBtn.disabled = false;
    }

    function uiForLoggedOut() {
        loginBtn.style.display = 'inline-block';
        logoutBtn.style.display = 'none';
        userDetails.textContent = '';
        projectForm.style.display = 'none';
        
        if (addProjectBtn) addProjectBtn.disabled = true;
    }

}); // <-- FIN DU 'DOMContentLoaded'