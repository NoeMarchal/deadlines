import { initializeApp } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-app.js";
import { getFirestore, collection } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";
import { firebaseConfig } from "./config.js";

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
export const projectsCollection = collection(db, "projects");

export { 
    addDoc, onSnapshot, deleteDoc, doc, updateDoc, query, orderBy, where, getDoc, setDoc 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-firestore.js";
export { 
    signInWithPopup, signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.4.0/firebase-auth.js";