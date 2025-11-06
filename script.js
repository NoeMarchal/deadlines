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
     const projectsContainer = document.getElementById('projects-container'); 
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

             projectsContainer.innerHTML = '<h2>Mes projets en cours</h2><p>Veuillez vous connecter pour voir vos projets.</p>'; 
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
                 status: 'pending' // <-- MODIFICATION : Ajout du statut par défaut
             }); 
             projectForm.reset(); 
         } catch (error) { 
             console.error("Erreur lors de l'ajout du projet: ", error); 
         } 
     }); 

     // --- AFFICHER LES PROJETS --- 
     function listenToProjects(userId) { 
         const q = query( 
             projectsCollection,  
             where("userId", "==", userId),  
             orderBy("end", "asc") 
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

     // Fonction séparée pour afficher un projet (MODIFIÉE)
     function renderProject(doc) { 
         const project = doc.data(); 
         const projectId = doc.id; 

         // Gère les anciens projets qui n'ont pas de statut
         const status = project.status || 'pending';

         // Logique de pourcentage 
         const today = new Date().getTime(); 
         const startDate = new Date(project.start).getTime(); 
         const endDate = new Date(project.end).getTime(); 
         if (isNaN(startDate) || isNaN(endDate)) return; 
         
         let percentage = 0;
         
         // Si le projet est terminé, la barre est à 100%
         if (status === 'completed') {
             percentage = 100;
         } else {
             // Sinon, on calcule
             const totalDuration = endDate - startDate; 
             const elapsedDuration = today - startDate; 
             if (today < startDate) percentage = 0; 
             else if (today > endDate) percentage = 100; 
             else if (totalDuration > 0) percentage = (elapsedDuration / totalDuration) * 100; 
             percentage = Math.round(Math.max(0, Math.min(percentage, 100))); 
         }

         // Logique d'urgence : ne s'applique que si le projet est 'pending'
         const msPerDay = 1000 * 60 * 60 * 24; 
         const remainingDays = (endDate - today) / msPerDay; 
         const isUrgent = (status === 'pending' && percentage < 100 && remainingDays <= 3); 

         // Création de la carte 
         const projectCard = document.createElement('div'); 
         projectCard.className = 'project-card'; 
         if (isUrgent) { 
             projectCard.classList.add('is-urgent'); 
         }
         if (status === 'completed') {
             projectCard.classList.add('is-completed');
         }

         // Préparation des boutons d'action
         const projectActionsHTML = `
             <div class="project-actions">
                 ${status === 'pending' ? 
                     `<button class="complete-btn" data-id="${projectId}">Terminer</button>` : 
                     '<span class="project-completed-text">TERMINÉ</span>'
                 }
                 <button class="delete-btn" data-id="${projectId}">Supprimer</button>
             </div>
         `;
         
         // Classe pour la barre de progression
         const progressInnerClass = status === 'completed' ? 'is-completed' : '';

         // HTML de la carte
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
         projectsContainer.appendChild(projectCard); 
     } 

     // --- GÉRER LES ACTIONS (SUPPRIMER / TERMINER) --- 
     projectsContainer.addEventListener('click', async (e) => { 
         
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

         // Clic sur TERMINER (Nouveau)
         if (e.target.classList.contains('complete-btn')) {
             const idToComplete = e.target.getAttribute('data-id');
             try {
                 const docRef = doc(db, 'projects', idToComplete);
                 await updateDoc(docRef, {
                     status: 'completed'
                 });
                 // onSnapshot s'occupera de rafraîchir l'affichage
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