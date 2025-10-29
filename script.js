// --------------- ÉTAPE 1 : IMPORTER LES OUTILS ---------------
// Outils de base de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
// Outils de la base de données (Firestore)
import { 
    getFirestore,     // L'usine à base de données
    collection,     // Référence à une collection
    addDoc,         // Pour ajouter un document
    onSnapshot,     // Pour écouter en temps réel
    deleteDoc,      // Pour supprimer un document
    doc             // Référence à un document précis
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";


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

// Initialiser Firebase et la base de données
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Connexion à la base de données

// Référence à notre collection "projects"
const projectsCollection = collection(db, 'projects');


// --------------- ÉTAPE 3 : LOGIQUE DE L'APPLICATION ---------------

// Récupérer les éléments du DOM
const projectForm = document.getElementById('project-form');
const projectsContainer = document.getElementById('projects-container');
const projectNameInput = document.getElementById('project-name');
const startDateInput = document.getElementById('start-date');
const endDateInput = document.getElementById('end-date');

// --- AJOUTER UN PROJET ---
projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = projectNameInput.value;
    const start = startDateInput.value;
    const end = endDateInput.value;

    if (new Date(start).getTime() >= new Date(end).getTime()) {
        alert("La date de fin doit être après la date de début !");
        return;
    }

    // Nouvelle syntaxe v9 pour AJOUTER
    try {
        await addDoc(projectsCollection, {
            name: name,
            start: start,
            end: end
        });
        projectForm.reset();
    } catch (error) {
        console.error("Erreur lors de l'ajout du projet: ", error);
    }
});

// --- AFFICHER LES PROJETS (TEMPS RÉEL) ---
onSnapshot(projectsCollection, (snapshot) => {
    projectsContainer.innerHTML = '<h2>Mes projets en cours</h2>'; // Vider

    if (snapshot.empty) {
        projectsContainer.innerHTML += '<p>Aucun projet pour le moment.</p>';
        return;
    }

    snapshot.forEach((doc) => {
        const project = doc.data(); // Les données
        const projectId = doc.id;   // L'ID unique

        // Calcul du pourcentage (ne change pas)
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

        // --- AJOUT : LOGIQUE D'URGENCE ---
        // 1. Calculer les jours restants
        const msPerDay = 1000 * 60 * 60 * 24; // Millisecondes dans un jour
        const remainingDays = (endDate - today) / msPerDay;

        // 2. Définir si c'est urgent
        const isUrgent = (percentage < 100 && remainingDays <= 3);
        // --- FIN DE L'AJOUT ---


        // Créer la carte HTML
        const projectCard = document.createElement('div');
        projectCard.className = 'project-card'; // Classe de base

        // --- AJOUT : Appliquer la classe d'urgence ---
        if (isUrgent) {
            projectCard.classList.add('is-urgent');
        }
        // --- FIN DE L'AJOUT ---

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
    });
});

// --- SUPPRIMER UN PROJET ---
projectsContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('delete-btn')) {
        const idToDelete = e.target.getAttribute('data-id');
        
        // Nouvelle syntaxe v9 pour SUPPRIMER
        try {
            // 1. Obtenir la référence au document
            const docRef = doc(db, 'projects', idToDelete);
            // 2. Supprimer le document
            await deleteDoc(docRef);
        } catch (error) {
            console.error("Erreur lors de la suppression: ", error);
        }
        // Pas besoin de rafraîchir, onSnapshot le fait pour nous !
    }
});