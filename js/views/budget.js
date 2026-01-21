import { getBudgetPosts, addBudgetPost, deleteBudgetPost, updateBudgetPost, getBudgetTargets, saveBudgetTargets } from "../services/budgetService.js";
import { getLoans, calculateLoanForMonth } from "../services/loanService.js";

let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; 
let editingPostId = null;
let isEditingTargets = false;

// --- SIMULATOR STATE ---
let isSimulationMode = false;
let disabledItemIds = new Set();
let ghostPosts = []; 

let defaultCategories = {
    indtægter: { name: "Indtægter", target: 30000 },
    faste: { name: "Faste udgifter", target: 12000 },
    transport: { name: "Transport", target: 4000 },
    ovrige: { name: "Øvrige faste", target: 2000 },
    opsparing: { name: "Opsparing", target: 5000 }
};

let activeCategories = JSON.parse(JSON.stringify(defaultCategories));

/**
 * Rendrer budgetvisningen
 */
export async function renderBudget(container) {
    // Hent budgetmål baseret på den valgte fane
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
            <div class="header-title-group">
                <h1>Budget & Økonomi ${isSimulationMode ? '<span class="sim-badge">SIMULERING</span>' : ''}</h1>
                <p class="subtitle">Styr på husstandens faste og variable udgifter</p>
            </div>
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
            <div class="stat-card expenses"><label>Udgifter</label><div id="total-expenses">0 kr.</div></div>
            <div class="stat-card growth"><label>Heraf Vækst</label><div id="total-growth">0 kr.</div></div>
            <div class="stat-card balance"><label>Rådighed</label><div id="total-balance">0 kr.</div></div>
        </div>

        <section class="budget-content">
            <div class="section-bar-modern">
                <h3>Kategorier og Poster</h3>
                <div class="action-group">
                    ${isSimulationMode ? '<button id="add-ghost-btn" class="btn-outline-small">+ Simulation-post</button>' : ''}
                    <button id="open-modal-btn" class="btn-add">+ Manuel post</button>
                </div>
            </div>
            <div id="category-container" class="category-grid"></div>
        </section>

        <!-- MODAL -->
        <div id="budget-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="modal-title">Ny budgetpost</h2>
                <form id="budget-form">
                    <div class="input-group"><label>Titel</label><input type="text" id="post-title" required placeholder="f.eks. Fitness eller El-regning"></div>
                    <div class="input-row">
                        <div class="input-group"><label>Beløb (kr.)</label><input type="number" id="post-amount" required></div>
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
                    <div class="checkbox-group"><input type="checkbox" id="post-recurring" checked> <label for="post-recurring">Dette er en løbende månedlig post</label></div>
                    
                    <div class="modal-buttons">
                        <button type="button" id="delete-post-btn" class="btn-danger-text" style="display:none;">Slet post permanent</button>
                        <div class="main-modal-actions">
                            <button type="button" id="cancel-btn" class="btn-danger-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem Post</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    setupEvents(container);
    updateDisplay();
}

/**
 * Opdaterer tallene og listerne i budgetvisningen
 */
async function updateDisplay() {
    const container = document.getElementById('category-container');
    if (!container) return;

    const posts = await getBudgetPosts(), loans = await getLoans();
    let totalInc = 0, totalExp = 0, totalGrowth = 0;
    const catData = {};
    Object.keys(activeCategories).forEach(k => catData[k] = { actual: 0, items: [] });

    const allPosts = [...posts, ...(isSimulationMode ? ghostPosts : [])];

    // Gennemgå alle manuelle poster
    allPosts.forEach(p => {
        if (!isSimulationMode && p.isGhost) return;
        if (selectedMonth < p.startDate || (p.endDate && selectedMonth > p.endDate)) return;
        
        const isUser = currentTab !== 'total';
        if (isUser && p.owner !== currentTab && p.owner !== 'shared') return;
        
        let m = (isUser && p.owner === 'shared') ? 0.5 : 1;
        let amt = p.amount * m;
        const isDisabled = isSimulationMode && disabledItemIds.has(p.id);

        if (p.type === 'income') {
            if (!isDisabled) { totalInc += amt; catData['indtægter'].actual += amt; }
            catData['indtægter'].items.push({ ...p, displayAmount: amt, isDisabled });
        } else {
            const cat = p.category || 'ovrige';
            if (catData[cat]) {
                if (!isDisabled) {
                    totalExp += amt;
                    if (cat === 'opsparing') totalGrowth += amt;
                    catData[cat].actual += amt;
                }
                catData[cat].items.push({ ...p, displayAmount: amt, isDisabled });
            }
        }
    });

    // Gennemgå alle lån (automatiske poster)
    loans.forEach(l => {
        const isUser = currentTab !== 'total';
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        const c = calculateLoanForMonth(l, selectedMonth);
        if (c) {
            let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
            const interest = c.interest * m, principal = c.principalPaid * m;
            const isDisabled = isSimulationMode && disabledItemIds.has(l.id);
            
            if (!isDisabled) { totalExp += (interest + principal); totalGrowth += principal; }
            const catKey = l.name.toLowerCase().includes('bil') ? 'transport' : 'faste';
            if (catData[catKey]) {
                if (!isDisabled) catData[catKey].actual += (interest + principal);
                catData[catKey].items.push({ id: l.id, title: l.name + " (Rente)", displayAmount: interest, isAuto: true, isDisabled });
                catData[catKey].items.push({ id: l.id + "-p", title: l.name + " (Afdrag)", displayAmount: principal, isAuto: true, isPrincipal: true, isDisabled });
            }
        }
    });

    // RENDERING MED GRUPPERING
    container.innerHTML = Object.keys(activeCategories).map(k => {
        const cat = activeCategories[k], data = catData[k];
        
        // GRUPPERINGSLOGIK: Hvis fanen er "Husstanden", gruppér efter titel
        let displayItems = data.items;
        if (currentTab === 'total') {
            const groups = {};
            data.items.forEach(item => {
                if (!groups[item.title]) {
                    groups[item.title] = { ...item, displayAmount: 0, isGroup: true, originalIds: [] };
                }
                groups[item.title].displayAmount += item.displayAmount;
                groups[item.title].originalIds.push(item.id);
                // Hvis én i gruppen er aktiv, betragtes gruppen som aktiv (i simulation)
                if (!item.isDisabled) groups[item.title].isDisabled = false; 
            });
            displayItems = Object.values(groups);
        }

        const pct = Math.min(100, (data.actual / cat.target) * 100);
        return `
            <div class="category-card">
                <div class="cat-header">
                    <h4>${cat.name}</h4>
                    ${isEditingTargets ? 
                        `<input type="number" class="target-input" data-cat="${k}" value="${cat.target}">` : 
                        `<span class="cat-total">${Math.round(data.actual).toLocaleString()} / ${cat.target.toLocaleString()} kr.</span>`
                    }
                </div>
                <div class="progress-bar"><div class="progress-fill-budget ${pct > 95 && k !== 'indtægter' ? 'warning' : ''}" style="width: ${pct}%"></div></div>
                <ul class="cat-items">
                    ${displayItems.map(item => `
                        <li class="small-item ${item.isDisabled ? 'item-disabled' : ''} ${item.isGhost ? 'ghost-item' : ''} ${item.isAuto ? 'auto-item' : ''} clickable-post" 
                            data-id="${item.id}" 
                            data-isghost="${item.isGhost || 'false'}" 
                            data-isauto="${item.isAuto || 'false'}"
                            data-isgroup="${item.isGroup || 'false'}">
                            <div class="item-info">
                                ${isSimulationMode ? `<button class="btn-toggle-sim" data-toggle-id="${item.id}" title="Slå til/fra i simulation">${item.isDisabled ? '👁‍🗨' : '👁'}</button>` : ''}
                                <span>${item.title} ${item.isGroup ? '<small class="group-tag">(Husstanden)</small>' : ''}</span>
                            </div>
                            <div class="item-amount">
                                <span>${Math.round(item.displayAmount).toLocaleString()} kr.</span>
                            </div>
                        </li>`).join('')}
                </ul>
            </div>`;
    }).join('');

    document.getElementById('total-income').innerText = Math.round(totalInc).toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = Math.round(totalExp).toLocaleString() + ' kr.';
    document.getElementById('total-growth').innerText = Math.round(totalGrowth).toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = Math.round(totalInc - totalExp).toLocaleString() + ' kr.';

    setupItemEvents(container, posts);
}

function setupEvents(container) {
    document.getElementById('prev-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()-1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    document.getElementById('next-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()+1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    container.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => { currentTab = b.dataset.tab; isEditingTargets = false; renderBudget(container); });
    
    document.getElementById('toggle-simulation').onclick = () => { isSimulationMode = !isSimulationMode; if (!isSimulationMode) { disabledItemIds.clear(); ghostPosts = []; } renderBudget(container); };

    document.getElementById('toggle-edit-targets').onclick = async () => {
        if (isEditingTargets) {
            const inputs = container.querySelectorAll('.target-input');
            const newTargets = {};
            inputs.forEach(input => { newTargets[input.dataset.cat] = { target: parseFloat(input.value) || 0 }; });
            await saveBudgetTargets(currentTab, newTargets);
        }
        isEditingTargets = !isEditingTargets; renderBudget(container);
    };

    document.getElementById('open-modal-btn').onclick = () => { 
        editingPostId = null; 
        document.getElementById('budget-form').reset(); 
        document.getElementById('modal-title').innerText = "Ny budgetpost"; 
        document.getElementById('delete-post-btn').style.display = "none";
        document.getElementById('budget-modal').style.display = 'flex'; 
    };
    
    document.getElementById('cancel-btn').onclick = () => document.getElementById('budget-modal').style.display = 'none';

    document.getElementById('delete-post-btn').onclick = async () => {
        if (!editingPostId) return;
        if (confirm('Vil du slette denne post permanent?')) {
            await deleteBudgetPost(editingPostId);
            document.getElementById('budget-modal').style.display = 'none';
            updateDisplay();
        }
    };

    document.getElementById('budget-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = { 
            title: document.getElementById('post-title').value, 
            amount: parseFloat(document.getElementById('post-amount').value), 
            type: document.getElementById('post-type').value, 
            category: document.getElementById('post-category').value, 
            owner: document.getElementById('post-owner').value, 
            isRecurring: document.getElementById('post-recurring').checked, 
            startDate: selectedMonth
        };
        if (editingPostId) await updateBudgetPost(editingPostId, data); else await addBudgetPost(data);
        document.getElementById('budget-modal').style.display = 'none'; updateDisplay();
    };
}

function setupItemEvents(container, posts) {
    container.querySelectorAll('.btn-toggle-sim').forEach(btn => { 
        btn.onclick = (e) => { 
            e.stopPropagation(); 
            const id = btn.dataset.toggleId; 
            if (disabledItemIds.has(id)) disabledItemIds.delete(id); else disabledItemIds.add(id); 
            updateDisplay(); 
        }; 
    });

    container.querySelectorAll('.clickable-post').forEach(item => {
        item.onclick = () => {
            if (item.dataset.isauto === "true" || item.dataset.isgroup === "true") return; // Grupperede poster kan ikke redigeres direkte fra husstanden
            const id = item.dataset.id;
            const data = posts.find(p => String(p.id) === String(id));
            if (!data) return;
            editingPostId = data.id;
            document.getElementById('modal-title').innerText = "Rediger post";
            document.getElementById('post-title').value = data.title;
            document.getElementById('post-amount').value = data.amount;
            document.getElementById('post-type').value = data.type;
            document.getElementById('post-category').value = data.category || 'ovrige';
            document.getElementById('post-owner').value = data.owner;
            document.getElementById('post-recurring').checked = data.isRecurring;
            document.getElementById('delete-post-btn').style.display = "block";
            document.getElementById('budget-modal').style.display = 'flex';
        };
    });
}
function formatMonth(m) { return new Date(m + "-01").toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }); }
