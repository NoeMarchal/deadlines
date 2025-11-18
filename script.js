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

const projectStatsDiv = document.getElementById("project-stats");
const completedCountSpan = document.getElementById("completed-count");
const totalCountSpan = document.getElementById("total-count");

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
            syncAllXP(user);
            
            if (unsubscribeFromProjects) unsubscribeFromProjects();
            unsubscribeFromProjects = listenToProjects(user.uid);
        } else {
            currentUser = null;
            uiForLoggedOut();

            if (unsubscribeFromProjects) unsubscribeFromProjects();
            pendingList.innerHTML = "<p>Veuillez vous connecter pour voir vos projets.</p>";
            document.getElementById('user-level-container').style.display = 'none';
        }
    });

    projectForm.addEventListener("submit", async (e) => {
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
                status: "pending",
            });
            projectForm.reset();
        } catch (error) {
            console.error(error);
        }
    });

    function listenToProjects(userId) {
        const q = query(
            projectsCollection,
            where("userId", "==", userId),
            orderBy("end", "asc")
        );

        return onSnapshot(q, (snapshot) => {
            pendingList.innerHTML = "";
            let pendingCount = 0;
            let completedCount = 0;
            let totalProjects = snapshot.size;

            if (snapshot.empty) {
                pendingList.innerHTML = "<p>Aucun projet pour le moment.</p>";
                completedCountSpan.textContent = 0;
                totalCountSpan.textContent = 0;
                return;
            }

            snapshot.forEach((doc) => {
                const status = doc.data().status || "pending";
                const projectCard = renderProject(doc);

                if (projectCard) {
                    if (status === 'completed') {
                        completedCount++;
                    } else {
                        pendingList.appendChild(projectCard);
                        pendingCount++;
                    }
                } else {
                    totalProjects--;
                }
            });

            if (pendingCount === 0) {
                pendingList.innerHTML = "<p>Aucun projet en cours pour le moment.</p>";
            }

            completedCountSpan.textContent = completedCount;
            totalCountSpan.textContent = totalProjects;
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

    projectsGrid.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-btn")) {
            const idToDelete = e.target.getAttribute("data-id");

            if (!confirm("Êtes-vous sûr de vouloir supprimer ce projet ?")) {
                return;
            }

            try {
                const docRef = doc(db, "projects", idToDelete);
                await deleteDoc(docRef);
            } catch (error) {
                console.error(error);
            }
        }

        if (e.target.classList.contains('complete-btn')) {
            const idToComplete = e.target.getAttribute('data-id');
            const xpReward = 100; 

            try {
                const docRef = doc(db, 'projects', idToComplete);
                await updateDoc(docRef, {
                    status: 'completed'
                });
                
                if (currentUser) {
                    updateUserXP(currentUser, xpReward);
                }
            } catch (error) {
                console.error(error);
            }
        }
    });

    function uiForLoggedIn(user) {
        loginBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        userDetails.textContent = `Connecté: ${user.email}`;
        projectForm.style.display = "grid";
        if (addProjectBtn) addProjectBtn.disabled = false;
        projectStatsDiv.style.display = "flex";
    }

    function uiForLoggedOut() {
        loginBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        userDetails.textContent = "";
        projectForm.style.display = "none";
        if (addProjectBtn) addProjectBtn.disabled = true;
        projectStatsDiv.style.display = "none";
    }

    async function updateUserXP(user, xpGained = 0) {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        let currentXP = 0;

        if (userSnap.exists()) {
            currentXP = userSnap.data().xp || 0;
        }
        
        let newXP = currentXP + xpGained;
        let newLevel = Math.floor(newXP / 500) + 1;

        await setDoc(userRef, {
            xp: newXP,
            level: newLevel,
            email: user.email
        }, { merge: true });

        updateLevelUI(newXP, newLevel);
        
        if (xpGained > 0) {
            alert(`🎮 QUÊTE ACCOMPLIE !\n+${xpGained} XP`); 
        }
    }

    async function syncAllXP(user) {
        const q = query(
            projectsCollection, 
            where("userId", "==", user.uid),
            where("status", "==", "completed")
        );

        try {
            const snapshot = await getDocs(q);
            const count = snapshot.size;
            
            const totalXP = count * 100;
            const level = Math.floor(totalXP / 500) + 1;

            const userRef = doc(db, "users", user.uid);
            await setDoc(userRef, {
                xp: totalXP,
                level: level,
                email: user.email
            }, { merge: true });

            updateLevelUI(totalXP, level);
        } catch (error) {
            console.error("Index manquant ou erreur synchro XP:", error);
        }
    }

    function updateLevelUI(xp, level) {
        const levelBadge = document.getElementById('level-badge');
        const xpBarFill = document.getElementById('xp-bar-fill');
        const xpText = document.getElementById('xp-text');
        const levelContainer = document.getElementById('user-level-container');

        levelContainer.style.display = 'flex';
        levelBadge.textContent = `LVL ${level}`;
        xpText.textContent = `${xp} XP`;
        
        const progress = (xp % 500) / 500 * 100;
        xpBarFill.style.width = `${progress}%`;
    }
});