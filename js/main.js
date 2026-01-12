import { 
    auth, provider, db, projectsCollection, 
    signInWithPopup, signOut, onAuthStateChanged, 
    addDoc, deleteDoc, doc, updateDoc, getDoc, 
    query, where, orderBy, onSnapshot 
} from "./firebase-init.js";

import { 
    myAlert, myConfirm, extractTextFromPDF, generateTasksFromText, setGeminiKey 
} from "./utils.js";

import { 
    renderProject, updateTopBarUI, uiForLoggedIn, uiForLoggedOut 
} from "./ui.js";

import { 
    updateUserStats, loadCompanion, handleFeedPet, handleRenamePet, initPomodoro, stopPomodoro 
} from "./game.js";

import { GAME_CONFIG } from "./config.js";


let currentUser = null;
let unsubscribeFromProjects = null;
let targetProjectIdForAI = null;

document.addEventListener("DOMContentLoaded", () => {
    
 
    initPomodoro();
    
    const currentTheme = localStorage.getItem('site_theme') || 'theme-retro';
    document.body.className = currentTheme;

    const projectForm = document.getElementById("project-form");
    const pendingList = document.getElementById("pending-projects-list");
    const projectsGrid = document.getElementById("projects-container");
    const projectNameInput = document.getElementById("project-name");
    const startDateInput = document.getElementById("start-date");
    const endDateInput = document.getElementById("end-date");
    const priorityInput = document.getElementById("project-priority");
    
    const loginBtn = document.getElementById("login-btn");
    const signupBtn = document.getElementById("signup-btn");
    
    const pdfInput = document.getElementById('pdf-upload-input');
    

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

  
    const editOverlay = document.getElementById('edit-project-overlay');
    const editIdInput = document.getElementById('edit-project-id');
    const editNameInput = document.getElementById('edit-project-name');
    const editPriorityInput = document.getElementById('edit-project-priority');
    const editStartInput = document.getElementById('edit-start-date');
    const editEndInput = document.getElementById('edit-end-date');
    const saveEditBtn = document.getElementById('save-edit-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');

    const feedBtn = document.getElementById('feed-btn');
    const renameBtn = document.getElementById('rename-btn');


    if (loginBtn) loginBtn.addEventListener("click", () => signInWithPopup(auth, provider));
    if (signupBtn) signupBtn.addEventListener("click", () => signInWithPopup(auth, provider));

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            uiForLoggedIn();
            syncUserData(user);
            loadCompanion(user);

            if (unsubscribeFromProjects) unsubscribeFromProjects();
            unsubscribeFromProjects = listenToProjects(user.uid);
        } else {
            currentUser = null;
            uiForLoggedOut();
            stopPomodoro();

            if (unsubscribeFromProjects) unsubscribeFromProjects();
            if (pendingList) pendingList.innerHTML = "<p>Veuillez vous connecter pour voir vos projets.</p>";
            
       
            const userLevelContainer = document.getElementById('user-level-container');
            const companionSection = document.getElementById('companion-section');
            if (userLevelContainer) userLevelContainer.style.display = 'none';
            if (companionSection) companionSection.style.display = 'none';
        }
    });


    if (projectForm) {
        projectForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            if (!currentUser) return;

            const name = projectNameInput.value;
            const start = startDateInput.value;
            const end = endDateInput.value;
            const priority = priorityInput ? priorityInput.value : "p4";

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
                    priority: priority,
                    aiTasks: []
                });
                projectForm.reset();
            } catch (error) { 
                console.error(error); 
                await myAlert("Erreur lors de la création du projet.");
            }
        });
    }


    function listenToProjects(userId) {
        const q = query(projectsCollection, where("userId", "==", userId), orderBy("end", "asc"));
        
        return onSnapshot(q, (snapshot) => {
            if (pendingList) pendingList.innerHTML = "";
            
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
                        if (pendingList) pendingList.appendChild(projectCard);
                        pendingCount++;
                    }
                } else {
                    totalProjects--;
                }
            });

            if (pendingList && pendingCount === 0) pendingList.innerHTML = "<p>Aucun projet en cours.</p>";
   
            const completedSpan = document.getElementById("completed-count");
            const totalSpan = document.getElementById("total-count");
            if (completedSpan) completedSpan.textContent = completedCount;
            if (totalSpan) totalSpan.textContent = totalProjects;
        });
    }

 
    if (projectsGrid) {
        projectsGrid.addEventListener("click", async (e) => {
            
    
            if (e.target.classList.contains("toggle-project-btn")) {
                const btn = e.target;
                const card = btn.closest('.project-card');
                const body = card.querySelector('.project-body');
                body.classList.toggle('hidden');
                card.classList.toggle('collapsed');
                return;
            }

     
            if (e.target.classList.contains("delete-btn")) {
                const idToDelete = e.target.getAttribute("data-id");
                if (await myConfirm("Supprimer ce projet ?")) {
                    try { await deleteDoc(doc(db, "projects", idToDelete)); } catch (err) { console.error(err); }
                }
            }

        
            if (e.target.classList.contains('complete-btn')) {
                const idToComplete = e.target.getAttribute('data-id');
                try {
                    await updateDoc(doc(db, 'projects', idToComplete), { status: 'completed' });
                    if (currentUser) updateUserStats(currentUser, GAME_CONFIG.xpReward, GAME_CONFIG.coinReward);
                } catch (err) { console.error(err); }
            }

     
            if (e.target.classList.contains('ai-task-btn')) {
                targetProjectIdForAI = e.target.getAttribute('data-id');
                if (pdfInput) pdfInput.click();
            }

        
            if (e.target.classList.contains('edit-btn')) {
                const pid = e.target.getAttribute('data-id');
                const docRef = doc(db, "projects", pid);
                const snap = await getDoc(docRef);

                if (snap.exists()) {
                    const data = snap.data();
                    editIdInput.value = pid;
                    editNameInput.value = data.name;
                    editStartInput.value = data.start;
                    editEndInput.value = data.end;
                    if(editPriorityInput) editPriorityInput.value = data.priority || 'p4';
                    editOverlay.style.display = 'flex';
                }
            }

   
            if (e.target.classList.contains('task-checkbox')) {
                const pid = e.target.getAttribute('data-pid');
                const tid = e.target.getAttribute('data-tid');
                const isChecked = e.target.checked;
                
       
                const taskItem = e.target.closest('.task-item');
                if (taskItem) isChecked ? taskItem.classList.add('done') : taskItem.classList.remove('done');

                const projectRef = doc(db, "projects", pid);
                const projectSnap = await getDoc(projectRef);

                if (projectSnap.exists()) {
                    let tasks = projectSnap.data().aiTasks || [];


                    tasks = tasks.map(mainTask => {

                        if (mainTask.id === tid) {
                            mainTask.done = isChecked;
                            if (mainTask.subTasks) {
                                mainTask.subTasks = mainTask.subTasks.map(sub => ({ ...sub, done: isChecked }));
                            }
                        }
                 
                        if (mainTask.subTasks) {
                            mainTask.subTasks = mainTask.subTasks.map(sub => {
                                if (sub.id === tid) sub.done = isChecked;
                                return sub;
                            });
                        }
                        return mainTask;
                    });

                    await updateDoc(projectRef, { aiTasks: tasks });
                }
            }


            if (e.target.classList.contains('add-task-btn-small')) {
                const pid = e.target.getAttribute('data-id');
                const input = document.getElementById(`input-task-${pid}`);
                const text = input.value.trim();

                if (!text) return;

                const projectRef = doc(db, "projects", pid);
                const projectSnap = await getDoc(projectRef);

                if (projectSnap.exists()) {
                    let currentTasks = projectSnap.data().aiTasks || [];
                    const newTask = {
                        id: Date.now().toString(),
                        desc: text,
                        done: false,
                        subTasks: [] 
                    };
                    currentTasks.push(newTask);
                    await updateDoc(projectRef, { aiTasks: currentTasks });
                }
            }

          
            if (e.target.classList.contains('task-delete-small')) {
                const pid = e.target.getAttribute('data-pid');
                const tid = e.target.getAttribute('data-tid');
                const taskItem = e.target.closest('.task-item');
                if (taskItem) taskItem.remove(); 

                const projectRef = doc(db, "projects", pid);
                const projectSnap = await getDoc(projectRef);

                if (projectSnap.exists()) {
                    let tasks = projectSnap.data().aiTasks || [];
                    
       
                    const initialLength = tasks.length;
                    tasks = tasks.filter(t => t.id !== tid);
                    
           
                    if (tasks.length === initialLength) {
                        tasks = tasks.map(mainTask => {
                            if (mainTask.subTasks) {
                                mainTask.subTasks = mainTask.subTasks.filter(sub => sub.id !== tid);
                            }
                            return mainTask;
                        });
                    }
                    await updateDoc(projectRef, { aiTasks: tasks });
                }
            }
        });
    }

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', async () => {
            const pid = editIdInput.value;
            const name = editNameInput.value;
            const start = editStartInput.value;
            const end = editEndInput.value;
            const priority = editPriorityInput ? editPriorityInput.value : 'p4';

            if (new Date(start).getTime() >= new Date(end).getTime()) {
                await myAlert("La date de fin doit être après la date de début !");
                return;
            }

            try {
                const docRef = doc(db, "projects", pid);
                await updateDoc(docRef, { name, start, end, priority });
                editOverlay.style.display = 'none';
                await myAlert("Mission mise à jour !");
            } catch (error) {
                console.error(error);
                await myAlert("Erreur lors de la modification.");
            }
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => { editOverlay.style.display = 'none'; });
    }


    if (pdfInput) {
        pdfInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            e.target.value = ''; 

            if (!file || !targetProjectIdForAI) return;

            try {
                await myAlert("Analyse du document en cours...");
                const text = await extractTextFromPDF(file);
                const newTasks = await generateTasksFromText(text);

    
                const newTasksObjects = newTasks.map((t, index) => ({
                    id: Date.now() + "_" + index,
                    isMain: true,
                    desc: t.tache,
                    done: false,
                    subTasks: (t.sous_taches || []).map((sub, subIndex) => ({
                        id: Date.now() + "_" + index + "_sub_" + subIndex,
                        desc: sub,
                        done: false
                    }))
                }));

                const projectRef = doc(db, "projects", targetProjectIdForAI);
                const projectSnap = await getDoc(projectRef);
                let existingTasks = [];
                if (projectSnap.exists()) {
                    existingTasks = projectSnap.data().aiTasks || [];
                }

                const mergedTasks = [...existingTasks, ...newTasksObjects];
                await updateDoc(projectRef, { aiTasks: mergedTasks });

                await myAlert(`Terminé ! ${newTasks.length} tâches ajoutées.`);

            } catch (error) {
                console.error(error);
                if (error.message.includes("404")) {
                    await myAlert("Erreur Modèle IA : Modèle introuvable ou clé API invalide.");
                } else {
                    await myAlert("Erreur : " + error.message);
                }
            } finally {
                targetProjectIdForAI = null;
            }
        });
    }


    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            settingsOverlay.style.display = 'flex';
            if(themeSelector) themeSelector.value = localStorage.getItem('site_theme') || 'theme-retro';
            const key = localStorage.getItem('GEMINI_API_KEY');
            if (key) settingsApiKeyInput.value = key;
        });
    }

    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => settingsOverlay.style.display = 'none');

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
                setGeminiKey(newKey);
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

    if (helpBtn && helpOverlay) {
        helpBtn.addEventListener('click', () => { helpOverlay.style.display = 'flex'; });
        if (closeHelpBtn) closeHelpBtn.addEventListener('click', () => { helpOverlay.style.display = 'none'; });
        helpOverlay.addEventListener('click', (e) => { if (e.target === helpOverlay) helpOverlay.style.display = 'none'; });
    }
    if (feedBtn) feedBtn.addEventListener('click', () => handleFeedPet(currentUser));
    if (renameBtn) renameBtn.addEventListener('click', () => handleRenamePet(currentUser));
    async function syncUserData(user) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            updateTopBarUI(data.xp || 0, data.level || 1, data.coins || 0);
        } else {
            updateTopBarUI(0, 1, 0);
        }
    }
});