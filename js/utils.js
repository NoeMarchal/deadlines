const modalOverlay = document.getElementById('custom-modal-overlay');
const modalTitle = document.getElementById('modal-title');
const modalText = document.getElementById('modal-text');
const modalInput = document.getElementById('modal-input');

export function showCustomModal(type, message, placeholder = "") {
    return new Promise((resolve) => {
        if (!modalOverlay) {
            alert(message);
            return resolve(true);
        }

        const currentBtnOk = document.getElementById('modal-btn-ok');
        const currentBtnCancel = document.getElementById('modal-btn-cancel');

        modalOverlay.style.display = 'flex';
        modalText.textContent = message;
        modalInput.value = "";
        modalInput.style.display = 'none';
        currentBtnCancel.style.display = 'none';
        currentBtnOk.textContent = "OK";

        if (type === 'alert') {
            modalTitle.textContent = "MESSAGE SYSTÈME";
        } else if (type === 'confirm') {
            modalTitle.textContent = "CONFIRMATION REQUISE";
            currentBtnCancel.style.display = 'block';
            currentBtnOk.textContent = "OUI";
        } else if (type === 'prompt') {
            modalTitle.textContent = "SAISIE REQUISE";
            modalInput.style.display = 'block';
            modalInput.placeholder = placeholder;
            modalInput.focus();
            currentBtnCancel.style.display = 'block';
            currentBtnOk.textContent = "VALIDER";
        }

        const newBtnOk = currentBtnOk.cloneNode(true);
        const newBtnCancel = currentBtnCancel.cloneNode(true);

        currentBtnOk.parentNode.replaceChild(newBtnOk, currentBtnOk);
        currentBtnCancel.parentNode.replaceChild(newBtnCancel, currentBtnCancel);

        newBtnOk.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            if (type === 'prompt') resolve(modalInput.value);
            else resolve(true);
        });

        newBtnCancel.addEventListener('click', () => {
            modalOverlay.style.display = 'none';
            resolve(false);
        });

        if (type === 'prompt') {
            modalInput.onkeydown = (e) => {
                if (e.key === 'Enter') newBtnOk.click();
            };
        }
    });
}

export const myAlert = (msg) => showCustomModal('alert', msg);
export const myConfirm = (msg) => showCustomModal('confirm', msg);
export const myPrompt = (msg, place) => showCustomModal('prompt', msg, place);

export function getGeminiKey() {
    return localStorage.getItem('GEMINI_API_KEY') || "AIzaSyAr3pws_6yXgjp4PL8UOTyf-NAFo1yyhQk";
}

export function setGeminiKey(key) {
    localStorage.setItem('GEMINI_API_KEY', key);
}

export async function extractTextFromPDF(file) {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    let fullText = "";
    const maxPages = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= maxPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n";
    }
    return fullText;
}

export async function generateTasksFromText(text) {
    const apiKey = getGeminiKey();
    if (!apiKey) throw new Error("Clé API manquante");
    const modelName = "gemini-2.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    const prompt = `
        Tu es un Senior Project Manager certifié PMP. Ton expertise porte sur la décomposition de projets complexes en lots de travaux (Work Packages) exploitables.

        CONTEXTE : 
        Tu analyses un texte brut pour en extraire une feuille de route exhaustive.

        OBJECTIF : 
        Générer exactement 20 tâches principales, ordonnées chronologiquement, couvrant tout le cycle de vie du projet (Cadrage, Planification, Exécution, Contrôle, Clôture).

        CONSIGNES DE STRUCTURE (STRICTES) :
        1. QUANTITÉ : Produire 20 tâches principales.
        2. SOUS-TÂCHES : Pour chaque tâche principale, générer en moyenne 4 sous-tâches techniques et actionnables.
        3. SYNTAXE : Chaque entrée (tâche et sous-tâche) doit commencer par un VERBE D'ACTION à l'infinitif.
        4. CHRONOLOGIE : L'ordre doit respecter les dépendances critiques (ne pas tester avant de développer).
        5. PRÉCISION : Éviter le jargon flou. Préférer "Configurer le serveur DNS" à "S'occuper de l'informatique".
        6. CONCISION : Max 10 mots par ligne.

        FORMAT DE RÉPONSE ATTENDU (JSON STRICT) :
        Tu dois répondre UNIQUEMENT par un JSON respectant exactement cette structure :
        [
          {
            "tache": "Titre de la tâche principale",
            "sous_taches": ["Sous-tâche 1", "Sous-tâche 2", "Sous-tâche 3", "Sous-tâche 4"]
          },
          ... (répéter pour les 20 tâches)
        ]

        TEXTE SOURCE : 
        ${text.substring(0, 15000)} 
    `;

    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.2 }
        })
    });

    const data = await response.json();

    if (data.error) {
        console.error("Erreur API Gemini:", data.error);
        throw new Error(`Erreur IA (${data.error.code}): ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
        throw new Error("L'IA n'a renvoyé aucune réponse.");
    }

    let rawText = data.candidates[0].content.parts[0].text;

    rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    try {

        const tasksArray = JSON.parse(rawText);

        if (Array.isArray(tasksArray)) {
            return tasksArray;
        } else {
            throw new Error("Format reçu incorrect");
        }
    } catch (e) {
        console.error("Échec du parsing JSON IA:", rawText);
        return rawText.split('\n')
            .map(line => line.replace(/^[\*\-\d\.]+\s*/, '').trim())
            .filter(line => line.length > 2);
    }
}