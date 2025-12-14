import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc,
    updateDoc,
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


const modalOverlay = document.getElementById('custom-modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalInput = document.getElementById('modal-input');
const signupBtn = document.getElementById("signup-btn");
const apiConfigBtn = document.getElementById("api-config-btn");

// --- FONCTIONS MODALES CORRIGÉES ---
// Cette version recharge les boutons à chaque appel pour éviter le crash "parentNode is null"
function showCustomModal(type, message, placeholder = "") {
    return new Promise((resolve) => {
        if (!modalOverlay) {
            alert(message); // Fallback si le HTML manque
            return resolve(true);
        }
        
        // 1. On récupère les boutons ACTUELS du DOM (très important !)
        const currentBtnOk = document.getElementById('modal-btn-ok');
        const currentBtnCancel = document.getElementById('modal-btn-cancel');

        // 2. Configuration de l'affichage
        modalOverlay.style.display = 'flex';
        modalText.textContent = message;
        modalInput.value = "";
        
        modalInput.style.display = 'none';
        currentBtnCancel.style.display = 'none';
        currentBtnOk.textContent = "OK";

        if (type === 'alert') {
            modalTitle.textContent = "MESSAGE SYSTÈME";
        } 
        else if (type === 'confirm') {
            modalTitle.textContent = "CONFIRMATION REQUISE";
            currentBtnCancel.style.display = 'block';
            currentBtnOk.textContent = "OUI";
        } 
        else if (type === 'prompt') {
            modalTitle.textContent = "SAISIE REQUISE";
            modalInput.style.display = 'block';
            modalInput.placeholder = placeholder;
            modalInput.focus();
            currentBtnCancel.style.display = 'block';
            currentBtnOk.textContent = "VALIDER";
        }

        // 3. Clonage pour supprimer les anciens écouteurs (clean start)
        const newBtnOk = currentBtnOk.cloneNode(true);
        const newBtnCancel = currentBtnCancel.cloneNode(true);
        
        // 4. Remplacement sécurisé dans le DOM
        currentBtnOk.parentNode.replaceChild(newBtnOk, currentBtnOk);
        currentBtnCancel.parentNode.replaceChild(newBtnCancel, currentBtnCancel);

        // 5. Ajout des nouveaux écouteurs
        newBtnOk.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            if (type === 'prompt') resolve(modalInput.value);
            else resolve(true);
        });

        newBtnCancel.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            resolve(false);
        });
        
        // Gestion de la touche Entrée pour le prompt
        if(type === 'prompt') {
             modalInput.onkeydown = (e) => {
                if(e.key === 'Enter') newBtnOk.click();
             };
        }
    });
}

const myAlert = (msg) => showCustomModal('alert', msg);
const myConfirm = (msg) => showCustomModal('confirm', msg);
const myPrompt = (msg, place) => showCustomModal('prompt', msg, place);

// --- CONFIGURATION FIREBASE ---
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

const PET_CONFIG = {
    costFeed: 5,
    xpGain: 50,
    costRename: 50,
    stages: [
        { minLvl: 1, art: "( ._. )", name: "Oeuf Glitché" },
        { minLvl: 3, art: "[ o_o ]", name: "Robo-Bot" },
        { minLvl: 5, art: "/( 0_0 )\\", name: "Cyber-Droïde" },
        { minLvl: 8, art: "ᕦ[ ▀_▀ ]ᕤ", name: "Mecha-Unit" },
        { minLvl: 12, art: "<[ ☢_☢ ]>", name: "The Construct" }
    ]
};

// --- LOGIQUE IA (GEMINI) ---
let targetProjectIdForAI = null;
const pdfInput = document.getElementById('pdf-upload-input');

// Sauvegarder / Récupérer la clé API
function getGeminiKey() {
    return localStorage.getItem('GEMINI_API_KEY');
}
function setGeminiKey(key) {
    localStorage.setItem('GEMINI_API_KEY', key);
}

// Extraction du texte depuis PDF (via pdf.js)
async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";
    
    // Lire max 5 premières pages pour ne pas exploser les tokens
    const maxPages = Math.min(pdf.numPages, 5);
    
    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
    }
    return fullText;
}

// Appel à l'API Gemini
async function generateTasksFromText(text) {
    const apiKey = getGeminiKey();
    if (!apiKey) throw new Error("Clé API manquante");

    // CORRECTION MAJEURE ICI : Utilisation de la version '002' stable
    const modelName = "gemini-2.0-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
    
    const prompt = `
        Tu es un assistant de gestion de projet expert.
        Analyse les consignes suivantes et extrais une liste d'actions concrètes (To-Do List).
        Génère entre 3 et 8 tâches maximum.
        
        RÈGLES STRICTES DE RÉPONSE :
        1. Réponds UNIQUEMENT avec la liste des tâches.
        2. Une tâche par ligne.
        3. Pas de numéros, pas de tirets au début, juste le texte de la tâche.
        4. Pas de phrase d'introduction comme "Voici la liste...".
        
        CONSIGNES DU PROJET : 
        ${text.substring(0, 8000)}
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
        })
    });

    const data = await response.json();
    
    // Gestion d'erreur détaillée
    if (data.error) {
        console.error("Erreur API Gemini:", data.error);
        throw new Error(`Erreur IA (${data.error.code}): ${data.error.message}`);
    }
    
    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("L'IA n'a renvoyé aucune réponse.");
    }

    const rawText = data.candidates[0].content.parts[0].text;
    
    // Nettoyage de la réponse
    return rawText.split('\n')
        .map(line => line.replace(/^[\*\-\d\.]+\s*/, '').trim()) // Enlever puces/numéros
        .filter(line => line.length > 2); // Garder lignes non vides
}


// --- DOM ELEMENTS ---
const projectStatsDiv = document.getElementById("project-stats");
const completedCountSpan = document.getElementById("completed-count");
const totalCountSpan = document.getElementById("total-count");
const userLevelContainer = document.getElementById('user-level-container');

// DOM Elements Compagnon
const companionSection = document.getElementById('companion-section');
const petNameDisplay = document.getElementById('pet-name-display');
const petLevelDisplay = document.getElementById('pet-level-display');
const petVisual = document.getElementById('pet-visual');
const petXpBar = document.getElementById('pet-xp-bar-inner');
const petMessage = document.getElementById('pet-message');
const feedBtn = document.getElementById('feed-btn');
const renameBtn = document.getElementById('rename-btn');

document.addEventListener("DOMContentLoaded", () => {
    const projectForm = document.getElementById("project-form");
    const pendingList = document.getElementById("pending-projects-list");
    const projectsGrid = document.getElementById("projects-container");
    const projectNameInput = document.getElementById("project-name");
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const addProjectBtn = document.getElementById("add-project-btn");
    const loginBtn = document.getElementById("login-btn");
    const logoutBtn = document.getElementById("logout-btn");
    const userDetails = document.getElementById("user-details");

    let currentUser = null;
    let unsubscribeFromProjects = null;

    // --- CONFIGURATION API KEY ---
    if(apiConfigBtn) {
        apiConfigBtn.addEventListener('click', async () => {
            const currentKey = getGeminiKey() || "";
            const newKey = await myPrompt("Clé Google Gemini API :", currentKey);
            if (newKey !== false) { // Si pas annulé
                setGeminiKey(newKey);
                await myAlert("Clé enregistrée !");
            }
        });
    }

    // --- GESTION UPLOAD PDF POUR IA ---
    if (pdfInput) {
        pdfInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            e.target.value = ''; // Reset pour permettre de réuploader le même fichier
            
            if (!file || !targetProjectIdForAI) return;

            try {
                await myAlert("Analyse du document en cours...");
                
                // 1. Lire le PDF
                const text = await extractTextFromPDF(file);
                
                // 2. Appeler Gemini
                const tasks = await generateTasksFromText(text);
                
                // 3. Formater pour Firebase
                const tasksObjects = tasks.map((t, index) => ({
                    id: Date.now() + index,
                    desc: t,
                    done: false
                }));

                // 4. Sauvegarder dans le projet
                const projectRef = doc(db, "projects", targetProjectIdForAI);
                
                // On récupère d'abord pour ne pas écraser les tâches existantes si on veut cumuler (optionnel, ici on remplace ou ajoute)
                // Ici on remplace la liste 'aiTasks' par la nouvelle
                await updateDoc(projectRef, { aiTasks: tasksObjects });
                
                await myAlert(`Terminé ! ${tasks.length} tâches ont été ajoutées au projet.`);

            } catch (error) {
                console.error(error);
                if(error.message.includes("404") || error.message.includes("not found")) {
                    await myAlert("Erreur Modèle IA : Le modèle semble indisponible. Vérifiez votre clé API.");
                } else if(error.message.includes("API")) {
                     await myAlert("Erreur API : " + error.message);
} else {
    // Affiche le vrai message technique pour comprendre
    await myAlert("Erreur technique : " + error.message);
}
            } finally {
                targetProjectIdForAI = null;
            }
        });
    }

    // --- AUTHENTIFICATION ---
    loginBtn.addEventListener("click", () => {
        signInWithPopup(auth, provider).catch((error) => console.error(error));
    });

    logoutBtn.addEventListener("click", () => {
        signOut(auth).catch((error) => console.error(error));
    });

    if(signupBtn) {
        signupBtn.addEventListener("click", () => {
            signInWithPopup(auth, provider).catch((error) => console.error(error));
        });
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            uiForLoggedIn(user);
            syncUserData(user);
            loadCompanion(user);
            
            if (unsubscribeFromProjects) unsubscribeFromProjects();
            unsubscribeFromProjects = listenToProjects(user.uid);
        } else {
            currentUser = null;
            uiForLoggedOut();

            if (unsubscribeFromProjects) unsubscribeFromProjects();
            pendingList.innerHTML = "<p>Veuillez vous connecter pour voir vos projets.</p>";
            if(userLevelContainer) userLevelContainer.style.display = 'none';
            if(companionSection) companionSection.style.display = 'none';
        }
    });

    // --- GESTION DES PROJETS ---
    if(projectForm) {
        projectForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const name = projectNameInput.value;
            const start = startDateInput.value;
            const end = endDateInput.value;

            if (new Date(start).getTime() >= new Date(end).getTime()) {
                await myAlert("La date de fin doit être après la date de début !");
                return;
            }

            try {
                await addDoc(projectsCollection, {
                    name: name,
                    start: start,
                    end: end,
                    userId: currentUser.uid,
                    status: "pending",
                    aiTasks: [] 
                });
                projectForm.reset();
            } catch (error) {
                console.error(error);
            }
        });
    }

    function listenToProjects(userId) {
        const q = query(
            projectsCollection,
            where("userId", "==", userId),
            orderBy("end", "asc")
        );

        return onSnapshot(q, (snapshot) => {
            if(pendingList) pendingList.innerHTML = "";
            let pendingCount = 0;
            let completedCount = 0;
            let totalProjects = snapshot.size;

            snapshot.forEach((doc) => {
                const status = doc.data().status || "pending";
                const projectCard = renderProject(doc);

                if (projectCard) {
                    if (status === 'completed') {
                        completedCount++;
                    } else {
                        if(pendingList) pendingList.appendChild(projectCard);
                        pendingCount++;
                    }
                } else {
                    totalProjects--;
                }
            });

            if (pendingList && pendingCount === 0) {
                pendingList.innerHTML = "<p>Aucun projet en cours.</p>";
            }

            if(completedCountSpan) completedCountSpan.textContent = completedCount;
            if(totalCountSpan) totalCountSpan.textContent = totalProjects;
        });
    }

    function renderProject(doc) {
        const project = doc.data();
        const projectId = doc.id;
        const status = project.status || "pending";
        const today = new Date().getTime();
        const startDate = new Date(project.start).getTime();
        const endDate = new Date(project.end).getTime();
        const aiTasks = project.aiTasks || []; 
        
        if (isNaN(startDate) || isNaN(endDate)) return;

        let percentage = 0;
        if (status === "completed") percentage = 100;
        else {
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
        const isUrgent = status === "pending" && percentage < 100 && remainingDays <= 3;

        const projectCard = document.createElement("div");
        projectCard.className = "project-card";
        if (isUrgent) projectCard.classList.add("is-urgent");
        if (status === "completed") projectCard.classList.add("is-completed");

        // Bouton IA
        const aiButtonHTML = status === "pending" 
            ? `<button class="ai-task-btn" data-id="${projectId}">📄 IA Tasks</button>` 
            : '';

        const projectActionsHTML = `
             <div class="project-actions">
                 ${aiButtonHTML}
                 ${status === "pending"
                ? `<button class="complete-btn" data-id="${projectId}">Terminer</button>`
                : '<span class="project-completed-text">TERMINÉ</span>'
            }
                 <button class="delete-btn" data-id="${projectId}">Supprimer</button>
             </div>
         `;
         
        // Construction de la Checklist IA
        let tasksHTML = '';
        if (aiTasks.length > 0) {
            const tasksList = aiTasks.map(t => `
                <div class="task-item ${t.done ? 'done' : ''}">
                    <input type="checkbox" class="task-checkbox" data-pid="${projectId}" data-tid="${t.id}" ${t.done ? 'checked' : ''}>
                    <span>${t.desc}</span>
                </div>
            `).join('');
            
            tasksHTML = `
                <div class="ai-tasks-container">
                    <span class="ai-tasks-title">Checklist IA :</span>
                    ${tasksList}
                </div>
            `;
        }

        const progressInnerClass = status === "completed" ? "is-completed" : "";

        projectCard.innerHTML = ` 
             <div class="project-header"> 
                 <h3>${project.name}</h3> 
                 <span class="project-dates"> 
                     ${new Date(project.start).toLocaleDateString()} - ${new Date(project.end).toLocaleDateString()} 
                 </span> 
             </div> 
             <div class="progress-bar-container"> 
                 <div class="progress-bar-inner ${progressInnerClass}" style="width: ${percentage}%;"> 
                     ${percentage}% 
                 </div> 
             </div> 
             ${tasksHTML}
             ${projectActionsHTML}
         `;
        return projectCard;
    }

    if(projectsGrid) {
        projectsGrid.addEventListener("click", async (e) => {
            // Suppression
            if (e.target.classList.contains("delete-btn")) {
                const idToDelete = e.target.getAttribute("data-id");
                const confirmed = await myConfirm("Supprimer ce projet ?");
                if (!confirmed) return;
                try {
                    await deleteDoc(doc(db, "projects", idToDelete));
                } catch (error) { console.error(error); }
            }

            // Terminer
            if (e.target.classList.contains('complete-btn')) {
                const idToComplete = e.target.getAttribute('data-id');
                try {
                    await updateDoc(doc(db, 'projects', idToComplete), { status: 'completed' });
                    if (currentUser) {
                        updateUserStats(currentUser, GAME_CONFIG.xpReward, GAME_CONFIG.coinReward);
                    }
                } catch (error) { console.error(error); }
            }
            
            // Upload PDF pour IA
            if (e.target.classList.contains('ai-task-btn')) {
                const pid = e.target.getAttribute('data-id');
                // Vérifier si la clé est là
                if (!getGeminiKey()) {
                    await myAlert("Veuillez d'abord configurer votre clé API (Bouton ⚙️ API en haut).");
                    return;
                }
                targetProjectIdForAI = pid;
                if(pdfInput) pdfInput.click(); // Ouvrir sélecteur de fichier
            }
            
            // Checkbox Task
            if (e.target.classList.contains('task-checkbox')) {
                const pid = e.target.getAttribute('data-pid');
                const tid = parseFloat(e.target.getAttribute('data-tid'));
                const isChecked = e.target.checked;
                
                // Mettre à jour Firebase
                const projectRef = doc(db, "projects", pid);
                const projectSnap = await getDoc(projectRef);
                if (projectSnap.exists()) {
                    let tasks = projectSnap.data().aiTasks || [];
                    tasks = tasks.map(t => {
                        if (t.id === tid) t.done = isChecked;
                        return t;
                    });
                    await updateDoc(projectRef, { aiTasks: tasks });
                }
            }
        });
    }

    // --- GESTION COMPAGNON (PET) ---
    async function loadCompanion(user) {
        if(!companionSection) return;
        companionSection.style.display = 'block';
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);
        let data = snap.data();
        
        if (!data || !data.companion) {
            const initialCompanion = {
                name: "Glitch",
                level: 1,
                currentXp: 0,
                maxXp: 100
            };
            await setDoc(userRef, { companion: initialCompanion }, { merge: true });
            data = (await getDoc(userRef)).data(); 
        }
        renderCompanion(data.companion);
    }

    function renderCompanion(pet) {
        if (!pet) return;
        petNameDisplay.textContent = pet.name;
        petLevelDisplay.textContent = `NIV ${pet.level}`;
        
        const percent = Math.min((pet.currentXp / pet.maxXp) * 100, 100);
        petXpBar.style.width = `${percent}%`;

        let currentStage = PET_CONFIG.stages[0];
        for (let stage of PET_CONFIG.stages) {
            if (pet.level >= stage.minLvl) currentStage = stage;
        }
        petVisual.textContent = currentStage.art;
        
        if(feedBtn) feedBtn.innerText = `⚡ Nourrir (${PET_CONFIG.costFeed} ₵)`;
        if(renameBtn) renameBtn.innerText = `✎ Nom (${PET_CONFIG.costRename} ₵)`;
    }

    if (feedBtn) {
        feedBtn.addEventListener('click', async () => {
            if (!currentUser) return;
            
            const userRef = doc(db, "users", currentUser.uid);
            const snap = await getDoc(userRef);
            const data = snap.data();
            const userCoins = data.coins || 0;
            
            if (userCoins < PET_CONFIG.costFeed) {
                // CORRECTION ICI : myAlert
                await myAlert("⚠️ Pas assez de crédits !");
                return;
            }

            let pet = data.companion;
            let newUserCoins = userCoins - PET_CONFIG.costFeed;
            
            pet.currentXp += PET_CONFIG.xpGain;
            
            if (pet.currentXp >= pet.maxXp) {
                pet.level++;
                pet.currentXp = pet.currentXp - pet.maxXp;
                pet.maxXp = Math.floor(pet.maxXp * 1.3);
                petMessage.textContent = "⚡ UPGRADE RÉUSSI !";
                petMessage.style.color = "#00ff00";
            } else {
                petMessage.textContent = `Miam ! (+${PET_CONFIG.xpGain} XP Pet)`;
                petMessage.style.color = "#aaa";
            }

            await updateDoc(userRef, {
                coins: newUserCoins, 
                companion: pet
            });

            updateTopBarUI(data.xp || 0, data.level || 1, newUserCoins);
            renderCompanion(pet);
            setTimeout(() => petMessage.textContent = "En attente...", 2000);
        });
    }

    if (renameBtn) {
        renameBtn.addEventListener('click', async () => {
            if (!currentUser) return;

            const newName = await myPrompt(`Nouveau nom (Coût: ${PET_CONFIG.costRename} ₵) :`, "Ex: Glitch 2.0");
            if (!newName || newName.trim() === "") return;

            const userRef = doc(db, "users", currentUser.uid);
            const snap = await getDoc(userRef);
            const data = snap.data();
            const userCoins = data.coins || 0;

            if (userCoins < PET_CONFIG.costRename) {
                await myAlert("Crédits insuffisants.");
                return;
            }

            let pet = data.companion;
            pet.name = newName.trim();
            let newUserCoins = userCoins - PET_CONFIG.costRename;

            await updateDoc(userRef, {
                coins: newUserCoins,
                companion: pet
            });

            updateTopBarUI(data.xp || 0, data.level || 1, newUserCoins);
            renderCompanion(pet);
        });
    }

    // --- GESTION DU POMODORO ---
    const pomoSection = document.getElementById('pomodoro-section');
    const pomoDisplay = document.getElementById('pomodoro-display');
    const pomoStartBtn = document.getElementById('pomo-start-btn');
    const pomoResetBtn = document.getElementById('pomo-reset-btn');

    let pomoTimer = null;
    let pomoTimeLeft = 25 * 60; // 25 minutes en secondes
    let isPomoRunning = false;

    function updatePomoDisplay() {
        const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
        const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
        if(pomoDisplay) pomoDisplay.textContent = `${m}:${s}`;
        
        if(isPomoRunning) document.title = `${m}:${s} - Focus`;
        else document.title = "Mes Deadlines";
    }

    if(pomoStartBtn) {
        pomoStartBtn.addEventListener('click', () => {
            if (isPomoRunning) {
                clearInterval(pomoTimer);
                isPomoRunning = false;
                pomoStartBtn.textContent = "▶ START";
                if(pomoSection) pomoSection.classList.remove('timer-running');
            } else {
                isPomoRunning = true;
                pomoStartBtn.textContent = "❚❚ PAUSE";
                if(pomoSection) pomoSection.classList.add('timer-running');
                
                pomoTimer = setInterval(() => {
                    if (pomoTimeLeft > 0) {
                        pomoTimeLeft--;
                        updatePomoDisplay();
                    } else {
                        clearInterval(pomoTimer);
                        isPomoRunning = false;
                        pomoSection.classList.remove('timer-running');
                        pomoStartBtn.textContent = "▶ START";
                        
                        myAlert("🍅 SESSION TERMINÉE !\nPrends 5 minutes de pause.");
                        
                        pomoTimeLeft = 25 * 60;
                        updatePomoDisplay();
                    }
                }, 1000);
            }
        });
    }

    if(pomoResetBtn) {
        pomoResetBtn.addEventListener('click', () => {
            clearInterval(pomoTimer);
            isPomoRunning = false;
            pomoTimeLeft = 25 * 60;
            updatePomoDisplay();
            if(pomoStartBtn) pomoStartBtn.textContent = "▶ START";
            if(pomoSection) pomoSection.classList.remove('timer-running');
        });
    }

    function uiForLoggedIn(user) {
        loginBtn.style.display = "none";
        if(signupBtn) signupBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        if(projectForm) projectForm.style.display = "grid";
        if (addProjectBtn) addProjectBtn.disabled = false;
        if(projectStatsDiv) projectStatsDiv.style.display = "flex";
        if(pomoSection) pomoSection.style.display = 'flex';
        // Afficher bouton config
        if(apiConfigBtn) apiConfigBtn.style.display = "inline-block";
    }

    function uiForLoggedOut() {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        if(signupBtn) signupBtn.style.display = "inline-block";
        userDetails.textContent = "";
        if(projectForm) projectForm.style.display = "none";
        if (addProjectBtn) addProjectBtn.disabled = true;
        if(projectStatsDiv) projectStatsDiv.style.display = "none";
        if(pomoSection) pomoSection.style.display = 'none';
        
        if(apiConfigBtn) apiConfigBtn.style.display = "none";

        if(pomoTimer) {
             clearInterval(pomoTimer);
             isPomoRunning = false;
             pomoTimeLeft = 25 * 60;
             updatePomoDisplay();
             if(pomoStartBtn) pomoStartBtn.textContent = "▶ START";
        }
    }

    async function updateUserStats(user, xpGained = 0, coinsGained = 0) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        let currentXP = 0;
        let currentCoins = 0;

        if (userSnap.exists()) {
            const data = userSnap.data();
            currentXP = data.xp || 0;
            currentCoins = data.coins || 0;
        }
        
        let newXP = currentXP + xpGained;
        let newCoins = currentCoins + coinsGained;
        let newLevel = Math.floor(newXP / GAME_CONFIG.levelStep) + 1;

        await setDoc(userRef, { 
            xp: newXP, 
            coins: newCoins,
            level: newLevel, 
            email: user.email 
        }, { merge: true });

        updateTopBarUI(newXP, newLevel, newCoins);
        
        if (xpGained > 0 || coinsGained > 0) {
            await myAlert(`🎮 MISSION ACCOMPLIE !\n+${xpGained} XP\n+${coinsGained} Crédits`);
        }
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
        if(!userLevelContainer) return;
        const levelBadge = document.getElementById('level-badge');
        const xpBarFill = document.getElementById('xp-bar-fill');
        const xpText = document.getElementById('xp-text');
        const coinsDisplay = document.getElementById('user-coins');
        
        userLevelContainer.style.display = 'flex';
        levelBadge.textContent = `LVL ${level}`;
        
        const currentLevelXp = xp % GAME_CONFIG.levelStep;
        xpText.textContent = `${currentLevelXp} / ${GAME_CONFIG.levelStep} XP`;
        
        const progress = (currentLevelXp) / GAME_CONFIG.levelStep * 100;
        xpBarFill.style.width = `${progress}%`;

        if(coinsDisplay) {
            coinsDisplay.textContent = `${coins} ₵`;
        }
    }
});