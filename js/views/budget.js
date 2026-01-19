import { getBudgetPosts, addBudgetPost, deleteBudgetPost, updateBudgetPost, getBudgetTargets, saveBudgetTargets } from "../services/budgetService.js";
import { getLoans, calculateLoanForMonth } from "../services/loanService.js";

let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; 
let editingPostId = null;
let isEditingTargets = false;

// --- SIMULATOR STATE ---
let isSimulationMode = false;
let disabledItemIds = new Set();
let ghostPosts = []; // Poster der kun findes i simulationen

let defaultCategories = {
    indtægter: { name: "Indtægter", target: 30000 },
    faste: { name: "Faste udgifter", target: 12000 },
    transport: { name: "Transport", target: 4000 },
    ovrige: { name: "Øvrige faste", target: 2000 },
    opsparing: { name: "Opsparing", target: 5000 }
};

let activeCategories = JSON.parse(JSON.stringify(defaultCategories));

export async function renderBudget(container) {
    if (currentTab === 'total') {
        const t1 = await getBudgetTargets('user1'), t2 = await getBudgetTargets('user2'), ts = await getBudgetTargets('shared');
        activeCategories = JSON.parse(JSON.stringify(defaultCategories));
        Object.keys(activeCategories).forEach(k => {
            let sum = (t1?.[k]?.target || 0) + (t2?.[k]?.target || 0) + (ts?.[k]?.target || 0);
            if (sum > 0) activeCategories[k].target = sum;
        });
    } else {
        const saved = await getBudgetTargets(currentTab);
        activeCategories = JSON.parse(JSON.stringify(defaultCategories));
        if (saved) Object.keys(saved).forEach(k => { if (activeCategories[k]) activeCategories[k].target = saved[k].target; });
    }

    container.innerHTML = `
        <header class="view-header">
            <h1>Budget & Økonomi ${isSimulationMode ? '<span class="sim-badge">SIMULERING</span>' : ''}</h1>
            <div class="header-actions">
                <button id="toggle-simulation" class="btn-outline ${isSimulationMode ? 'active-sim' : ''}">
                    ${isSimulationMode ? 'Stop Simulering' : 'Start Simulering'}
                </button>
                <button id="toggle-edit-targets" class="btn-outline" ${currentTab === 'total' ? 'disabled' : ''}>
                    ${isEditingTargets ? 'Gem mål' : 'Tilpas mål'}
                </button>
                <div class="month-selector">
                    <button id="prev-month" class="btn-icon">←</button>
                    <span class="month-label">${formatMonth(selectedMonth)}</span>
                    <button id="next-month" class="btn-icon">→</button>
                </div>
            </div>
        </header>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <div class="budget-overview">
            <div class="stat-card income"><label>Indtægter</label><div id="total-income">0 kr.</div></div>
            <div class="stat-card expenses"><label>Udgifter (Penge ud)</label><div id="total-expenses">0 kr.</div></div>
            <div class="stat-card assets"><label>Heraf Vækst (Info)</label><div id="total-assets">0 kr.</div></div>
            <div class="stat-card cashflow"><label>Penge tilbage</label><div id="total-balance">0 kr.</div></div>
        </div>

        <section class="budget-list-section">
            <div class="section-bar">
                <h3>Kategorier og Poster</h3>
                <div>
                    ${isSimulationMode ? '<button id="add-ghost-btn" class="btn-outline-small" style="margin-right:10px;">+ Simulation-post</button>' : ''}
                    <button id="open-modal-btn" class="btn-add">+ Manuel post</button>
                </div>
            </div>
            <div id="category-container" class="category-grid"></div>
        </section>

        <!-- FORM MODAL -->
        <div id="budget-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="modal-title">Ny budgetpost</h2>
                <form id="budget-form">
                    <div class="input-group"><label>Titel</label><input type="text" id="post-title" required></div>
                    <div class="input-row">
                        <div class="input-group"><label>Beløb</label><input type="number" id="post-amount" required></div>
                        <div class="input-group"><label>Type</label>
                            <select id="post-type"><option value="income">Indtægt</option><option value="expense" selected>Udgift</option></select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Kategori</label>
                            <select id="post-category">${Object.keys(activeCategories).map(k => `<option value="${k}">${activeCategories[k].name}</option>`).join('')}</select>
                        </div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="post-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared">Fælles (50/50)</option></select>
                        </div>
                    </div>
                    <div class="checkbox-group"><input type="checkbox" id="post-recurring" checked><label>Løbende post</label></div>
                    <div class="modal-buttons">
                        <button type="button" id="cancel-btn" class="btn-text">Annuller</button><button type="submit" class="btn-submit">Gem post</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    setupEvents(container);
    updateDisplay();
}

async function updateDisplay() {
    const container = document.getElementById('category-container');
    if (!container) return;

    const posts = await getBudgetPosts(), loans = await getLoans();
    let totalInc = 0, totalExp = 0, totalGrowth = 0;
    
    const catData = {};
    Object.keys(activeCategories).forEach(k => catData[k] = { actual: 0, items: [] });

    // Kombiner rigtige poster og ghost-poster (hvis i simulation)
    const allPosts = [...posts, ...(isSimulationMode ? ghostPosts : [])];

    allPosts.forEach(p => {
        if (!isSimulationMode && p.isGhost) return;
        if (selectedMonth < p.startDate || (p.endDate && selectedMonth > p.endDate)) return;
        const isUser = currentTab !== 'total';
        if (isUser && p.owner !== currentTab && p.owner !== 'shared') return;
        
        let m = (isUser && p.owner === 'shared') ? 0.5 : 1;
        let amt = p.amount * m;

        // Simulator check: Er posten deaktiveret?
        const isDisabled = isSimulationMode && disabledItemIds.has(p.id);

        if (p.type === 'income') {
            if (!isDisabled) {
                totalInc += amt;
                catData['indtægter'].actual += amt;
            }
            catData['indtægter'].items.push({ ...p, displayAmount: amt, isDisabled });
        } else {
            if (!isDisabled) {
                totalExp += amt;
                if (p.category === 'opsparing') totalGrowth += amt;
                const cat = p.category || 'ovrige';
                if (catData[cat]) catData[cat].actual += amt;
            }
            const cat = p.category || 'ovrige';
            if (catData[cat]) catData[cat].items.push({ ...p, displayAmount: amt, isDisabled });
        }
    });

    loans.forEach(l => {
        const isUser = currentTab !== 'total';
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        const c = calculateLoanForMonth(l, selectedMonth);
        if (c) {
            let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
            const interest = c.interest * m, principal = c.principalPaid * m;
            const isDisabled = isSimulationMode && disabledItemIds.has(l.id);
            
            if (!isDisabled) {
                totalExp += (interest + principal);
                totalGrowth += principal;
            }
            
            const catKey = l.name.toLowerCase().includes('bil') ? 'transport' : 'faste';
            if (catData[catKey]) {
                if (!isDisabled) catData[catKey].actual += (interest + principal);
                catData[catKey].items.push({ id: l.id, title: l.name + " (Rente)", displayAmount: interest, isAuto: true, isDisabled });
                catData[catKey].items.push({ id: l.id + "-p", title: l.name + " (Afdrag)", displayAmount: principal, isAuto: true, isPrincipal: true, isDisabled });
            }
        }
    });

    container.innerHTML = Object.keys(activeCategories).map(k => {
        const cat = activeCategories[k], data = catData[k], pct = Math.min(100, (data.actual / cat.target) * 100);
        return `
            <div class="category-card">
                <div class="cat-header"><h4>${cat.name}</h4>
                    ${isEditingTargets ? `<input type="number" class="target-input" data-cat="${k}" value="${cat.target}">` : `<span>${Math.round(data.actual).toLocaleString()} / ${cat.target.toLocaleString()} kr.</span>`}
                </div>
                <div class="progress-bar"><div class="progress-fill ${pct > 95 && k !== 'indtægter' ? 'warning' : ''}" style="width: ${pct}%"></div></div>
                <ul class="cat-items">
                    ${data.items.map(item => `
                        <li class="small-item ${item.isDisabled ? 'item-disabled' : ''} ${item.isGhost ? 'ghost-item' : ''}">
                            <div class="item-info">
                                ${isSimulationMode ? `<button class="btn-toggle-sim" data-toggle-id="${item.id}">${item.isDisabled ? '👁‍🗨' : '👁'}</button>` : ''}
                                <span>${item.title}</span>
                            </div>
                            <span>
                                ${Math.round(item.displayAmount).toLocaleString()} kr. 
                                ${!item.isAuto ? `<button class="btn-edit-small" data-edit="${item.id}" ${item.isGhost ? 'data-isghost="true"' : ''}>✎</button>` : ''}
                            </span>
                        </li>`).join('')}
                </ul>
            </div>`;
    }).join('');

    document.getElementById('total-income').innerText = Math.round(totalInc).toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = Math.round(totalExp).toLocaleString() + ' kr.';
    document.getElementById('total-assets').innerText = Math.round(totalGrowth).toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = Math.round(totalInc - totalExp).toLocaleString() + ' kr.';

    setupItemEvents(container, posts);
}

function setupEvents(container) {
    document.getElementById('prev-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()-1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    document.getElementById('next-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()+1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    container.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => { currentTab = b.dataset.tab; isEditingTargets = false; renderBudget(container); });
    
    // Simulation Toggle
    document.getElementById('toggle-simulation').onclick = () => {
        isSimulationMode = !isSimulationMode;
        if (!isSimulationMode) {
            disabledItemIds.clear();
            ghostPosts = [];
        }
        renderBudget(container);
    };

    // Tilføj Ghost Post (Simulation)
    const addGhostBtn = document.getElementById('add-ghost-btn');
    if (addGhostBtn) addGhostBtn.onclick = () => {
        editingPostId = null;
        document.getElementById('budget-form').reset();
        document.getElementById('modal-title').innerText = "Ny Simulation-post";
        document.getElementById('budget-modal').style.display = 'flex';
        document.getElementById('budget-modal').dataset.ghost = "true";
    };

    const editBtn = document.getElementById('toggle-edit-targets');
    if (editBtn) editBtn.onclick = async () => {
        if (isEditingTargets) {
            const newTargets = {};
            container.querySelectorAll('.target-input').forEach(i => newTargets[i.dataset.cat] = { target: parseFloat(i.value) || 0 });
            await saveBudgetTargets(currentTab, newTargets);
        }
        isEditingTargets = !isEditingTargets; renderBudget(container);
    };

    document.getElementById('open-modal-btn').onclick = () => { 
        editingPostId = null; 
        document.getElementById('budget-form').reset(); 
        document.getElementById('modal-title').innerText = "Ny budgetpost"; 
        document.getElementById('budget-modal').style.display = 'flex'; 
        delete document.getElementById('budget-modal').dataset.ghost;
    };
    
    document.getElementById('cancel-btn').onclick = () => document.getElementById('budget-modal').style.display = 'none';

    document.getElementById('budget-form').onsubmit = async (e) => {
        e.preventDefault();
        const isGhost = document.getElementById('budget-modal').dataset.ghost === "true";
        const data = { 
            title: document.getElementById('post-title').value, 
            amount: parseFloat(document.getElementById('post-amount').value), 
            type: document.getElementById('post-type').value, 
            category: document.getElementById('post-category').value, 
            owner: document.getElementById('post-owner').value, 
            isRecurring: document.getElementById('post-recurring').checked, 
            startDate: selectedMonth,
            isGhost: isGhost,
            id: editingPostId || (isGhost ? 'ghost-' + Date.now() : null)
        };

        if (isGhost) {
            if (editingPostId) {
                const idx = ghostPosts.findIndex(p => p.id === editingPostId);
                ghostPosts[idx] = data;
            } else {
                ghostPosts.push(data);
            }
        } else {
            if (editingPostId) await updateBudgetPost(editingPostId, data); 
            else await addBudgetPost(data);
        }
        
        document.getElementById('budget-modal').style.display = 'none'; 
        updateDisplay();
    };
}

function setupItemEvents(container, posts) {
    // Toggle Simulator visibility
    container.querySelectorAll('.btn-toggle-sim').forEach(btn => {
        btn.onclick = () => {
            const id = btn.dataset.toggleId;
            if (disabledItemIds.has(id)) disabledItemIds.delete(id);
            else disabledItemIds.add(id);
            updateDisplay();
        };
    });

    container.querySelectorAll('[data-edit]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation(); 
            const isGhost = btn.dataset.isghost === "true";
            const item = isGhost ? ghostPosts.find(p => p.id === btn.dataset.edit) : posts.find(p => p.id === btn.dataset.edit);
            if (!item) return;
            
            editingPostId = item.id; 
            document.getElementById('modal-title').innerText = isGhost ? "Rediger Simulation" : "Rediger post"; 
            document.getElementById('post-title').value = item.title; 
            document.getElementById('post-amount').value = item.amount;
            document.getElementById('post-type').value = item.type; 
            document.getElementById('post-category').value = item.category || 'ovrige'; 
            document.getElementById('post-owner').value = item.owner;
            document.getElementById('post-recurring').checked = item.isRecurring; 
            if (isGhost) document.getElementById('budget-modal').dataset.ghost = "true";
            document.getElementById('budget-modal').style.display = 'flex';
        };
    });
}
function formatMonth(m) { return new Date(m + "-01").toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }); }
