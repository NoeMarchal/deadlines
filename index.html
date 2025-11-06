// --------------- ÉTAPE 1 : IMPORTER LES OUTILS --------------- 
 import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js"; 
 import {  
     getFirestore, collection, addDoc, onSnapshot,  
     deleteDoc, doc, updateDoc, query, orderBy, where 
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


 // On attend que le HTML soit chargé avant d'exécuter le code 
 document.addEventListener('DOMContentLoaded', () => { 

     // --------------- ÉTAPE 3 : LOGIQUE DE L'APPLICATION --------------- 

     // Récupérer les éléments du DOM 
     const projectForm = document.getElementById('project-form');
     
     // MODIFICATION : Nouveaux sélecteurs pour les listes
     const pendingList = document.getElementById('pending-projects-list');
     const completedList = document.getElementById('completed-projects-list');
     const projectsGrid = document.getElementById('projects-container'); // Pour l'écouteur de clic

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
              
             if (unsubscribeFromProjects) unsubscribeFromProjects(); 
             unsubscribeFromProjects = listenToProjects(user.uid); 

         } else { 
             // --- L'utilisateur N'EST PAS connecté --- 
             currentUser = null; 
             uiForLoggedOut(); 
              
             if (unsubscribeFromProjects) unsubscribeFromProjects(); 

             // MODIFICATION : On vide les deux listes
             pendingList.innerHTML = '<p>Veuillez vous connecter pour voir vos projets.</p>';
             completedList.innerHTML = '';
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
                 status: 'pending' 
             }); 
             projectForm.reset(); 
         } catch (error) { 
             console.error("Erreur lors de l'ajout du projet: ", error); 
         } 
     }); 

     // --- AFFICHER LES PROJETS --- 
     // MODIFICATION : Cette fonction trie maintenant dans les deux colonnes
     function listenToProjects(userId) { 
         const q = query( 
             projectsCollection,  
             where("userId", "==", userId),  
             orderBy("end", "asc")
         ); 

         return onSnapshot(q, (snapshot) => { 
             // 1. On vide les listes
             pendingList.innerHTML = '';
             completedList.innerHTML = '';
             
             let pendingCount = 0;
             let completedCount = 0;

             if (snapshot.empty) { 
                 pendingList.innerHTML = '<p>Aucun projet pour le moment.</p>'; 
                 completedList.innerHTML = '<p>Aucun projet terminé.</p>';
                 return; 
             } 
             
             // 2. On boucle et on trie
             snapshot.forEach(doc => {
                 const status = doc.data().status || 'pending';
                 
                 // 3. On crée la carte (la fonction renvoie l'élément)
                 const projectCard = renderProject(doc);

                 // 4. On l'ajoute à la bonne liste
                 if (status === 'completed') {
                     completedList.appendChild(projectCard);
                     completedCount++;
                 } else {
                     pendingList.appendChild(projectCard);
                     pendingCount++;
                 }
             });

             // 5. Gérer les états vides séparément
             if (pendingCount === 0) {
                 pendingList.innerHTML = '<p>Aucun projet en cours pour le moment.</p>';
             }
             if (completedCount === 0) {
                 completedList.innerHTML = '<p>Aucun projet terminé.</p>';
             }
         }); 
     }

     // --- CRÉER UNE CARTE DE PROJET ---
     // MODIFICATION : Cette fonction RENVOIE la carte au lieu de l'ajouter
     function renderProject(doc) { 
         const project = doc.data(); 
         const projectId = doc.id; 

         const status = project.status || 'pending';
         const today = new Date().getTime(); 
         const startDate = new Date(project.start).getTime(); 
         const endDate = new Date(project.end).getTime(); 
         if (isNaN(startDate) || isNaN(endDate)) return; 
         
         let percentage = 0;
         if (status === 'completed') {
             percentage = 100;
         } else {
             const totalDuration = endDate - startDate; 
             const elapsedDuration = today - startDate; 
             if (today < startDate) percentage = 0; 
             else if (today > endDate) percentage = 100; 
             else if (totalDuration > 0) percentage = (elapsedDuration / totalDuration) * 100; 
             percentage = Math.round(Math.max(0, Math.min(percentage, 100))); 
         }

         const msPerDay = 1000 * 60 * 60 * 24; 
         const remainingDays = (endDate - today) / msPerDay; 
         const isUrgent = (status === 'pending' && percentage < 100 && remainingDays <= 3); 

         // Création de la carte (identique à avant)
         const projectCard = document.createElement('div'); 
         projectCard.className = 'project-card'; 
         if (isUrgent) { 
             projectCard.classList.add('is-urgent'); 
         }
         if (status === 'completed') {
             projectCard.classList.add('is-completed');
         }

         const projectActionsHTML = `
             <div class="project-actions">
                 ${status === 'pending' ? 
                     `<button class="complete-btn" data-id="${projectId}">Terminer</button>` : 
                     '<span class="project-completed-text">TERMINÉ</span>'
                 }
                 <button class="delete-btn" data-id="${projectId}">Supprimer</button>
             </div>
         `;
         
         const progressInnerClass = status === 'completed' ? 'is-completed' : '';

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
         
         // MODIFICATION : On RENVOIE l'élément au lieu de l'ajouter
         return projectCard; 
     } 

     // --- GÉRER LES ACTIONS (SUPPRIMER / TERMINER) --- 
     // MODIFICATION : L'écouteur est sur la GRILLE parente
     projectsGrid.addEventListener('click', async (e) => { 
         
         // Clic sur SUPPRIMER
         if (e.target.classList.contains('delete-btn')) { 
             const idToDelete = e.target.getAttribute('data-id'); 
             
             if (!confirm("Êtes-vous sûr de vouloir supprimer ce projet ?")) {
                 return;
             }

             try { 
                 const docRef = doc(db, 'projects', idToDelete); 
                 await deleteDoc(docRef); 
             } catch (error) { 
                 console.error("Erreur lors de la suppression: ", error); 
             } 
         }

         // Clic sur TERMINER
         if (e.target.classList.contains('complete-btn')) {
             const idToComplete = e.target.getAttribute('data-id');
             try {
                 const docRef = doc(db, 'projects', idToComplete);
                 await updateDoc(docRef, {
                     status: 'completed'
                 });
             } catch (error) {
                 console.error("Erreur lors de la mise à jour du statut: ", error);
             }
         }
     }); 

     // --- Fonctions de gestion de l'interface --- 
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