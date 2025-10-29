// --------------- ÉTAPE 1 : IMPORTER LES OUTILS ---------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { 
    getFirestore, collection, addDoc, onSnapshot, 
    deleteDoc, doc, query, orderBy, where // 'where' est nouveau
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
// NOUVEAU: Importer les outils d'Authentification
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
const auth = getAuth(app); // NOUVEAU: Initialiser l'Auth
const provider = new GoogleAuthProvider(); // NOUVEAU: Créer le fournisseur Google

// Référence à la collection
const projectsCollection = collection(db, 'projects');


// --------------- ÉTAPE 3 : LOGIQUE DE L'APPLICATION ---------------

// Récupérer les éléments du DOM
const projectForm = document.getElementById('project-form');
const projectsContainer = document.getElementById('projects-container');
const projectNameInput = document.getElementById('project-name');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

// NOUVEAU: Éléments d'Auth
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userDetails = document.getElementById('user-details');

let currentUser = null; // Variable pour stocker l'utilisateur
let unsubscribeFromProjects = null; // Variable pour arrêter l'écouteur

// NOUVEAU: Gérer les clics de connexion/déconnexion
loginBtn.addEventListener('click', () => {
    signInWithPopup(auth, provider).catch(error => console.error(error));
});

logoutBtn.addEventListener('click', () => {
    signOut(auth).catch(error => console.error(error));
});

// NOUVEAU: Écouteur principal de l'état d'authentification
// C'est lui qui lance l'application
onAuthStateChanged(auth, (user) => {
    if (user) {
        // --- L'utilisateur EST connecté ---
        currentUser = user;
        uiForLoggedIn(user);
        
        // Arrêter l'ancien écouteur s'il existe
        if (unsubscribeFromProjects) unsubscribeFromProjects();
        
        // Lancer l'écouteur de projets, MAIS filtré par l'ID de l'utilisateur
        unsubscribeFromProjects = listenToProjects(user.uid);

    } else {
        // --- L'utilisateur N'EST PAS connecté ---
        currentUser = null;
        uiForLoggedOut();
        
        // Arrêter l'écouteur de projets
        if (unsubscribeFromProjects) unsubscribeFromProjects();
        
        // Vider les projets
        projectsContainer.innerHTML = '<h2>Mes projets en cours</h2><p>Veuillez vous connecter pour voir vos projets.</p>';
    }
});

// --- AJOUTER UN PROJET (Modifié) ---
projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // NOUVEAU: Vérifier si l'utilisateur est connecté avant d'ajouter
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
            userId: currentUser.uid // NOUVEAU: On "marque" le projet avec l'ID de l'utilisateur
        });
        projectForm.reset();
    } catch (error) {
        console.error("Erreur lors de l'ajout du projet: ", error);
    }
});

// --- AFFICHER LES PROJETS (Modifié) ---
function listenToProjects(userId) {
    // NOUVEAU: Requête filtrée et triée
    const q = query(
        projectsCollection, 
        where("userId", "==", userId), // Ne récupérer que les projets de cet utilisateur
        orderBy("end", "asc")           // Trier par date de fin
    );

    return onSnapshot(q, (snapshot) => {
        projectsContainer.innerHTML = '<h2>Mes projets en cours</h2>';
        if (snapshot.empty) {
            projectsContainer.innerHTML += '<p>Aucun projet pour le moment.</p>';
            return;
        }
        snapshot.forEach(doc => renderProject(doc));
    });
}

// NOUVEAU: Fonction séparée pour afficher un projet
function renderProject(doc) {
    const project = doc.data();
    const projectId = doc.id;

    // Logique de pourcentage
    const today = new Date().getTime();
    const startDate = new Date(project.start).getTime();
    const endDate = new Date(project.end).getTime();
    if (isNaN(startDate) || isNaN(endDate)) return;
    const totalDuration = endDate - startDate;
    const elapsedDuration = today - startDate;
    let percentage = 0;
    if (today < startDate) percentage = 0;
    else if (today > endDate) percentage = 100;
    else if (totalDuration > 0) percentage = (elapsedDuration / totalDuration) * 100;
    percentage = Math.round(Math.max(0, Math.min(percentage, 100)));

    // Logique d'urgence
    const msPerDay = 1000 * 60 * 60 * 24;
    const remainingDays = (endDate - today) / msPerDay;
    const isUrgent = (percentage < 100 && remainingDays <= 3);

    // Création de la carte
    const projectCard = document.createElement('div');
    projectCard.className = 'project-card';
    if (isUrgent) {
        projectCard.classList.add('is-urgent');
    }

    projectCard.innerHTML = `
        <div class="project-header">
            <h3>${project.name}</h3>
            <span class="project-dates">
                ${new Date(project.start).toLocaleDateString()} - ${new Date(project.end).toLocaleDateString()}
            </span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar-inner" style="width: ${percentage}%;">
                ${percentage}%
            </div>
        </div>
        <button class="delete-btn" data-id="${projectId}">Supprimer</button>
    `;
    projectsContainer.appendChild(projectCard);
}

// --- SUPPRIMER UN PROJET (Ne change pas, mais est maintenant sécurisé) ---
projectsContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const idToDelete = e.target.getAttribute('data-id');
        try {
            const docRef = doc(db, 'projects', idToDelete);
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erreur lors de la suppression: ", error);
        }
    }
});

// --- NOUVEAU: Fonctions de gestion de l'interface ---
function uiForLoggedIn(user) {
    loginBtn.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    userDetails.textContent = `Connecté: ${user.email}`;
    projectForm.style.display = 'grid'; // Afficher le formulaire
}

function uiForLoggedOut() {
    loginBtn.style.display = 'inline-block';
    logoutBtn.style.display = 'none';
    userDetails.textContent = '';
    projectForm.style.display = 'none'; // Cacher le formulaire
}