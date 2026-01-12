import { db, doc, getDoc, setDoc, updateDoc } from "./firebase-init.js";
import { GAME_CONFIG, PET_CONFIG } from "./config.js";
import { updateTopBarUI } from "./ui.js";
import { myAlert, myPrompt } from "./utils.js";



export async function updateUserStats(user, xpGained = 0, coinsGained = 0) {
    if (!user) return;

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
const elements = {
    companionSection: document.getElementById('companion-section'),
    name: document.getElementById('pet-name-display'),
    level: document.getElementById('pet-level-display'),
    visual: document.getElementById('pet-visual'),
    xpBar: document.getElementById('pet-xp-bar-inner'),
    message: document.getElementById('pet-message'),
    feedBtn: document.getElementById('feed-btn'),
    renameBtn: document.getElementById('rename-btn')
};

export async function loadCompanion(user) {
    if (!elements.companionSection) return;
    
    elements.companionSection.style.display = 'block';
    
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    let data = snap.data();

    if (!data || !data.companion) {
        const initialCompanion = { name: "Glitch", level: 1, currentXp: 0, maxXp: 100 };
        await setDoc(userRef, { companion: initialCompanion }, { merge: true });
        data = (await getDoc(userRef)).data();
    }
    
    renderCompanion(data.companion);
}

export function renderCompanion(pet) {
    if (!pet) return;

    if (elements.name) elements.name.textContent = pet.name;
    if (elements.level) elements.level.textContent = `NIV ${pet.level}`;
    
    if (elements.xpBar) {
        const percent = Math.min((pet.currentXp / pet.maxXp) * 100, 100);
        elements.xpBar.style.width = `${percent}%`;
    }

    let currentStage = PET_CONFIG.stages[0];
    for (let stage of PET_CONFIG.stages) { 
        if (pet.level >= stage.minLvl) currentStage = stage; 
    }
    
    if (elements.visual) elements.visual.textContent = currentStage.art;
    
    if (elements.feedBtn) elements.feedBtn.innerText = `⚡ Nourrir (${PET_CONFIG.costFeed} ₵)`;
    if (elements.renameBtn) elements.renameBtn.innerText = `✎ Nom (${PET_CONFIG.costRename} ₵)`;
}

export async function handleFeedPet(currentUser) {
    if (!currentUser) return;

    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);
    const data = snap.data();
    const userCoins = data.coins || 0;

    if (userCoins < PET_CONFIG.costFeed) { 
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
        
        if (elements.message) {
            elements.message.textContent = "⚡ UPGRADE RÉUSSI !";
            elements.message.style.color = "#00ff00";
        }
    } else {
        if (elements.message) {
            elements.message.textContent = `Miam ! (+${PET_CONFIG.xpGain} XP Pet)`;
            elements.message.style.color = "#aaa";
        }
    }

    await updateDoc(userRef, { coins: newUserCoins, companion: pet });
    updateTopBarUI(data.xp || 0, data.level || 1, newUserCoins);
    renderCompanion(pet);

    setTimeout(() => {
        if (elements.message) elements.message.textContent = "En attente...";
    }, 2000);
}

export async function handleRenamePet(currentUser) {
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

    await updateDoc(userRef, { coins: newUserCoins, companion: pet });
    updateTopBarUI(data.xp || 0, data.level || 1, newUserCoins);
    renderCompanion(pet);
}

const pomoSection = document.getElementById('pomodoro-section');
const pomoDisplay = document.getElementById('pomodoro-display');
const pomoStartBtn = document.getElementById('pomo-start-btn');
const pomoResetBtn = document.getElementById('pomo-reset-btn');

let pomoTimer = null;
let pomoTimeLeft = 25 * 60;
let isPomoRunning = false;

function updatePomoDisplay() {
    const m = Math.floor(pomoTimeLeft / 60).toString().padStart(2, '0');
    const s = (pomoTimeLeft % 60).toString().padStart(2, '0');
    if (pomoDisplay) pomoDisplay.textContent = `${m}:${s}`;
    document.title = isPomoRunning ? `${m}:${s} - Focus` : "Mes Deadlines";
}

export function initPomodoro() {
    if (!pomoStartBtn || !pomoResetBtn) return;

    pomoStartBtn.addEventListener('click', () => {
        if (isPomoRunning) {
            clearInterval(pomoTimer);
            isPomoRunning = false;
            pomoStartBtn.textContent = "▶ START";
            if (pomoSection) pomoSection.classList.remove('timer-running');
        } else {
            isPomoRunning = true;
            pomoStartBtn.textContent = "❚❚ PAUSE";
            if (pomoSection) pomoSection.classList.add('timer-running');
            
            pomoTimer = setInterval(() => {
                if (pomoTimeLeft > 0) {
                    pomoTimeLeft--;
                    updatePomoDisplay();
                } else {
                    clearInterval(pomoTimer);
                    isPomoRunning = false;
                    if (pomoSection) pomoSection.classList.remove('timer-running');
                    pomoStartBtn.textContent = "▶ START";
                    myAlert("🍅 SESSION TERMINÉE !\nPrends 5 minutes de pause.");
                    pomoTimeLeft = 25 * 60;
                    updatePomoDisplay();
                }
            }, 1000);
        }
    });

    pomoResetBtn.addEventListener('click', () => {
        clearInterval(pomoTimer);
        isPomoRunning = false;
        pomoTimeLeft = 25 * 60;
        updatePomoDisplay();
        pomoStartBtn.textContent = "▶ START";
        if (pomoSection) pomoSection.classList.remove('timer-running');
        document.title = "Mes Deadlines";
    });
}

export function stopPomodoro() {
    if (pomoTimer) {
        clearInterval(pomoTimer);
    }
    isPomoRunning = false;
    pomoTimeLeft = 25 * 60;
    updatePomoDisplay();
    if (pomoStartBtn) pomoStartBtn.textContent = "▶ START";
    if (pomoSection) pomoSection.classList.remove('timer-running');
    document.title = "Mes Deadlines";
}