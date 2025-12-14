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
    setDoc,
    getDocs
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
const btnOk = document.getElementById('modal-btn-ok');
const btnCancel = document.getElementById('modal-btn-cancel');

function showCustomModal(type, message, placeholder = "") {
    return new Promise((resolve) => {
        if (!modalOverlay) {
            alert(message); // Fallback si le HTML manque
            return resolve(true);
        }
        modalOverlay.style.display = 'flex';
        modalText.textContent = message;
        modalInput.value = "";
        
        modalInput.style.display = 'none';
        btnCancel.style.display = 'none';
        btnOk.textContent = "OK";

        if (type === 'alert') {
            modalTitle.textContent = "MESSAGE SYSTÈME";
        } 
        else if (type === 'confirm') {
            modalTitle.textContent = "CONFIRMATION REQUISE";
            btnCancel.style.display = 'block';
            btnOk.textContent = "OUI";
        } 
        else if (type === 'prompt') {
            modalTitle.textContent = "SAISIE REQUISE";
            modalInput.style.display = 'block';
            modalInput.placeholder = placeholder;
            modalInput.focus();
            btnCancel.style.display = 'block';
            btnOk.textContent = "VALIDER";
        }

        const newBtnOk = btnOk.cloneNode(true);
        const newBtnCancel = btnCancel.cloneNode(true);
        btnOk.parentNode.replaceChild(newBtnOk, btnOk);
        btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

        newBtnOk.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            if (type === 'prompt') resolve(modalInput.value);
            else resolve(true);
        });

        newBtnCancel.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            resolve(false);
        });
        
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

    // --- AUTHENTIFICATION ---
    loginBtn.addEventListener("click", () => {
        signInWithPopup(auth, provider).catch((error) => console.error(error));
    });

    logoutBtn.addEventListener("click", () => {
        signOut(auth).catch((error) => console.error(error));
    });

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

        const projectActionsHTML = `
             <div class="project-actions">
                 ${status === "pending"
                ? `<button class="complete-btn" data-id="${projectId}">Terminer</button>`
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
                     ${new Date(project.start).toLocaleDateString()} - ${new Date(project.end).toLocaleDateString()} 
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

    if(projectsGrid) {
        projectsGrid.addEventListener("click", async (e) => {
            if (e.target.classList.contains("delete-btn")) {
                const idToDelete = e.target.getAttribute("data-id");
                // CORRECTION ICI : Utilisation de myConfirm
                const confirmed = await myConfirm("Supprimer ce projet ?");
                if (!confirmed) return;
                
                try {
                    await deleteDoc(doc(db, "projects", idToDelete));
                } catch (error) { console.error(error); }
            }

            if (e.target.classList.contains('complete-btn')) {
                const idToComplete = e.target.getAttribute('data-id');
                
                try {
                    await updateDoc(doc(db, 'projects', idToComplete), { status: 'completed' });
                    if (currentUser) {
                        updateUserStats(currentUser, GAME_CONFIG.xpReward, GAME_CONFIG.coinReward);
                    }
                } catch (error) { console.error(error); }
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

            // CORRECTION ICI : myPrompt
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

    function uiForLoggedIn(user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        if(projectForm) projectForm.style.display = "grid";
        if (addProjectBtn) addProjectBtn.disabled = false;
        if(projectStatsDiv) projectStatsDiv.style.display = "flex";
    }

    function uiForLoggedOut() {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userDetails.textContent = "";
        if(projectForm) projectForm.style.display = "none";
        if (addProjectBtn) addProjectBtn.disabled = true;
        if(projectStatsDiv) projectStatsDiv.style.display = "none";
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
            // CORRECTION ICI : myAlert
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