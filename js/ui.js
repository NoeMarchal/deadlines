import { GAME_CONFIG } from "./config.js";

export function updateTopBarUI(xp, level, coins) {
    if (!userLevelContainer) return;
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
    if (coinsDisplay) coinsDisplay.textContent = `${coins} ₵`;
}

export function renderProject(doc) {
        const project = doc.data();
        const projectId = doc.id;
        const status = project.status || "pending";
        const today = new Date().getTime();
        const startDate = new Date(project.start).getTime();
        const endDate = new Date(project.end).getTime();
        const aiTasks = project.aiTasks || [];
        const priority = project.priority || "p4";

        if (isNaN(startDate) || isNaN(endDate)) return;

        let percentage = 0;
        if (status === "completed") percentage = 100;
        else {
            const totalDuration = endDate - startDate;
            const elapsedDuration = today - startDate;
            if (today < startDate) percentage = 0;
            else if (today > endDate) percentage = 100;
            else if (totalDuration > 0) percentage = (elapsedDuration / totalDuration) * 100;
            percentage = Math.round(Math.max(0, Math.min(percentage, 100)));
        }

        const msPerDay = 1000 * 60 * 60 * 24;
        const remainingDays = (endDate - today) / msPerDay;
        const isUrgent = status === "pending" && percentage < 100 && remainingDays <= 3;

        let priorityColor = "#555";
        if (priority === "p1") priorityColor = "#ff0000";
        if (priority === "p2") priorityColor = "#00FFFF";
        if (priority === "p3") priorityColor = "#FFFF00";

        const projectCard = document.createElement("div");
        projectCard.className = "project-card";
        projectCard.style.borderLeft = `5px solid ${priorityColor}`;

        if (isUrgent) projectCard.classList.add("is-urgent");
        if (status === "completed") projectCard.classList.add("is-completed");

        const aiButtonHTML = status === "pending"
            ? `<button class="ai-task-btn" data-id="${projectId}">📄 IA Tasks</button>` : '';
        const editButtonHTML = status === "pending"
            ? `<button class="edit-btn" data-id="${projectId}">✎ Modifier</button>` : '';

        const projectActionsHTML = `
             <div class="project-actions">
                 ${aiButtonHTML}
                 ${editButtonHTML} 
                 ${status === "pending"
                ? `<button class="complete-btn" data-id="${projectId}">Terminer</button>`
                : '<span class="project-completed-text">TERMINÉ</span>'
            }
                 <button class="delete-btn" data-id="${projectId}">Supprimer</button>
             </div>
         `;

        let tasksHTML = '';
        const tasksListHTML = aiTasks.map(mainTask => {

            const subTasksHTML = (mainTask.subTasks || []).map(sub => `
        <div class="task-item task-sub ${sub.done ? 'done' : ''}" style="margin-left: 20px; border-left: 2px solid #333;">
            <div class="task-left">
                <input type="checkbox" class="task-checkbox" data-pid="${projectId}" data-tid="${sub.id}" data-parent="${mainTask.id}" ${sub.done ? 'checked' : ''}>
                <span>${sub.desc}</span>
            </div>
            <button class="task-delete-small" data-pid="${projectId}" data-tid="${sub.id}" data-parent="${mainTask.id}">×</button>
        </div>
    `).join('');

            return `
        <div class="task-group" style="margin-bottom: 15px;">
            <div class="task-item task-main ${mainTask.done ? 'done' : ''}" style="background: rgba(0, 255, 0, 0.05); border-bottom: 1px solid #333;">
                <div class="task-left">
                    <input type="checkbox" class="task-checkbox" data-pid="${projectId}" data-tid="${mainTask.id}" ${mainTask.done ? 'checked' : ''}>
                    <strong style="color: #00ff00;">${mainTask.desc}</strong>
                </div>
                <button class="task-delete-small" data-pid="${projectId}" data-tid="${mainTask.id}">×</button>
            </div>
            <div class="sub-tasks-container">
                ${subTasksHTML}
            </div>
        </div>
    `;
        }).join('');

        tasksHTML = `
    <div class="ai-tasks-container">
        <span class="ai-tasks-title">FEUILLE DE ROUTE (IA) :</span>
        ${tasksListHTML}
        
        <div class="add-task-row">
            <input type="text" class="add-task-input" id="input-task-${projectId}" placeholder="Ajouter une tâche manuelle...">
            <button class="add-task-btn-small" data-id="${projectId}">OK</button>
        </div>
    </div>
`;

        const progressInnerClass = status === "completed" ? "is-completed" : "";

        projectCard.innerHTML = `
        <div class="project-header">
            <div style="display:flex; align-items:center; gap:10px;">
                <button class="toggle-project-btn" data-id="${projectId}">▼</button>
                <h3>${project.name}</h3>
            </div>
            <span class="project-dates">
                ${new Date(project.start).toLocaleDateString()} - ${new Date(project.end).toLocaleDateString()}
            </span>
        </div>

        <div class="project-body" id="body-${projectId}">
            <div class="progress-bar-container">
                <div class="progress-bar-inner ${progressInnerClass}" style="width: ${percentage}%;">
                    ${percentage}%
                </div>
            </div>
            ${tasksHTML}
            ${projectActionsHTML}
        </div>
    `;
        return projectCard;
    }

export function uiForLoggedIn(user) {
    if (loginBtn) loginBtn.style.display = "none";
    if (signupBtn) signupBtn.style.display = "none";

    if (settingsBtn) settingsBtn.style.display = "inline-block";

    if (projectForm) projectForm.style.display = "grid";
    if (addProjectBtn) addProjectBtn.disabled = false;
    if (projectStatsDiv) projectStatsDiv.style.display = "flex";
    if (pomoSection) pomoSection.style.display = 'flex';
}

export function uiForLoggedOut() {
    if (loginBtn) loginBtn.style.display = "inline-block";
    if (signupBtn) signupBtn.style.display = "inline-block";

    if (settingsBtn) settingsBtn.style.display = "none";

    if (projectForm) projectForm.style.display = "none";
    if (addProjectBtn) addProjectBtn.disabled = true;
    if (projectStatsDiv) projectStatsDiv.style.display = "none";
    if (pomoSection) pomoSection.style.display = 'none';

    if (pomoTimer) {
        clearInterval(pomoTimer);
        isPomoRunning = false;
        pomoTimeLeft = 25 * 60;
        updatePomoDisplay();
        if (pomoStartBtn) pomoStartBtn.textContent = "▶ START";
    }
}