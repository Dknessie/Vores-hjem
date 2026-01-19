import { getBudgetPosts, addBudgetPost, deleteBudgetPost, updateBudgetPost, getBudgetTargets, saveBudgetTargets } from "../services/budgetService.js";
import { getLoans, calculateLoanForMonth } from "../services/loanService.js";

let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; // 'total', 'user1', 'user2'
let editingPostId = null;
let isEditingTargets = false;

// Standard kategorier
let defaultCategories = {
    bolig: { name: "Bolig", target: 12000 },
    bil: { name: "Bil & Transport", target: 5000 },
    mad: { name: "Mad & Husholdning", target: 6000 },
    opsparing: { name: "Opsparing", target: 2000 },
    andet: { name: "Andet/Fritid", target: 3000 }
};

let activeCategories = JSON.parse(JSON.stringify(defaultCategories));

export async function renderBudget(container) {
    // Hent individuelle targets for den valgte fane
    const ownerKey = currentTab === 'total' ? 'shared' : currentTab;
    const savedTargets = await getBudgetTargets(ownerKey);
    
    // Nulstil til default før vi påfører gemte data
    activeCategories = JSON.parse(JSON.stringify(defaultCategories));
    if (savedTargets) {
        Object.keys(savedTargets).forEach(key => {
            if (activeCategories[key]) activeCategories[key].target = savedTargets[key].target;
        });
    }

    container.innerHTML = `
        <header class="view-header">
            <h1>Budget & Økonomi</h1>
            <div class="header-actions">
                <button id="toggle-edit-targets" class="btn-outline">${isEditingTargets ? 'Gem budgetmål' : 'Tilpas budgetmål'}</button>
                <div class="month-selector">
                    <button id="prev-month" class="btn-icon">←</button>
                    <span id="current-month-display" class="month-label">${formatMonth(selectedMonth)}</span>
                    <button id="next-month" class="btn-icon">→</button>
                </div>
            </div>
        </header>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Min Andel</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <div class="budget-overview">
            <div class="stat-card income"><label>Indtægter</label><div id="total-income">0 kr.</div></div>
            <div class="stat-card expenses"><label>Udgifter (Penge ud)</label><div id="total-expenses">0 kr.</div></div>
            <div class="stat-card assets"><label>Vækst (Afdrag)</label><div id="total-assets">0 kr.</div></div>
            <div class="stat-card cashflow"><label>Penge tilbage</label><div id="total-balance">0 kr.</div></div>
        </div>

        <section class="budget-list-section">
            <div class="section-bar">
                <h3>Kategorier for ${currentTab === 'total' ? 'Husstanden' : (currentTab === 'user1' ? 'Mig' : 'Kæresten')}</h3>
                <button id="open-modal-btn" class="btn-add">+ Manuel post</button>
            </div>
            <div id="category-container" class="category-grid"></div>
        </section>

        <div id="budget-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="modal-title">Ny budgetpost</h2>
                <form id="budget-form">
                    <div class="input-group"><label>Titel</label><input type="text" id="post-title" required></div>
                    <div class="input-row">
                        <div class="input-group"><label>Beløb</label><input type="number" id="post-amount" required></div>
                        <div class="input-group"><label>Type</label>
                            <select id="post-type">
                                <option value="income">Indtægt</option>
                                <option value="expense" selected>Udgift</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Kategori</label>
                            <select id="post-category">
                                ${Object.keys(activeCategories).map(k => `<option value="${k}">${activeCategories[k].name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="post-owner">
                                <option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared">Fælles (50/50)</option>
                            </select>
                        </div>
                    </div>
                    <div class="checkbox-group"><input type="checkbox" id="post-recurring" checked><label>Løbende post</label></div>
                    <div class="modal-buttons">
                        <button type="button" id="cancel-btn" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem post</button>
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

    const posts = await getBudgetPosts();
    const loans = await getLoans();
    let inc = 0, exp = 0, princ = 0;
    
    const catData = {};
    Object.keys(activeCategories).forEach(k => catData[k] = { actual: 0, items: [] });

    // Håndter manuelle poster
    posts.forEach(p => {
        if (selectedMonth < p.startDate || (p.endDate && selectedMonth > p.endDate)) return;
        const isUser = currentTab !== 'total';
        if (isUser && p.owner !== currentTab && p.owner !== 'shared') return;
        let m = (isUser && p.owner === 'shared') ? 0.5 : 1;
        let amt = p.amount * m;
        
        if (p.type === 'income') inc += amt; 
        else {
            exp += amt;
            const cat = p.category || 'andet';
            if (catData[cat]) {
                catData[cat].actual += amt;
                catData[cat].items.push({ ...p, displayAmount: amt });
            }
        }
    });

    // Håndter lån (renter og afdrag)
    loans.forEach(l => {
        const isUser = currentTab !== 'total';
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        const c = calculateLoanForMonth(l, selectedMonth);
        if (c) {
            let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
            const r = c.interest * m;
            const a = c.principalPaid * m;
            exp += r; princ += a;
            
            const cat = l.name.toLowerCase().includes('bil') ? 'bil' : 'bolig';
            if (catData[cat]) {
                catData[cat].actual += (r + a);
                catData[cat].items.push({ title: l.name + " (Rente)", displayAmount: r, isAuto: true });
                catData[cat].items.push({ title: l.name + " (Afdrag)", displayAmount: a, isAuto: true, isPrincipal: true });
            }
        }
    });

    container.innerHTML = Object.keys(activeCategories).map(k => {
        const cat = activeCategories[k];
        const data = catData[k];
        const pct = Math.min(100, (data.actual / cat.target) * 100);
        return `
            <div class="category-card">
                <div class="cat-header">
                    <h4>${cat.name}</h4>
                    ${isEditingTargets ? 
                        `<input type="number" class="target-input" data-cat="${k}" value="${cat.target}">` : 
                        `<span>${Math.round(data.actual).toLocaleString()} / ${cat.target.toLocaleString()} kr.</span>`
                    }
                </div>
                <div class="progress-bar"><div class="progress-fill ${pct > 95 ? 'warning' : ''}" style="width: ${pct}%"></div></div>
                <ul class="cat-items">
                    ${data.items.map(item => `
                        <li class="small-item ${item.isPrincipal ? 'principal-item' : ''}">
                            <span>${item.title}</span>
                            <span>${Math.round(item.displayAmount).toLocaleString()} kr. ${!item.isAuto ? `<button class="btn-edit-small" data-edit="${item.id}">✎</button>` : ''}</span>
                        </li>
                    `).join('')}
                </ul>
            </div>
        `;
    }).join('');

    document.getElementById('total-income').innerText = Math.round(inc).toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = Math.round(exp).toLocaleString() + ' kr.';
    document.getElementById('total-assets').innerText = Math.round(princ).toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = Math.round(inc - exp - princ).toLocaleString() + ' kr.';

    // Genbind Edit-events
    container.querySelectorAll('[data-edit]').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            const item = posts.find(p => p.id === btn.dataset.edit);
            if (!item) return;
            editingPostId = item.id;
            document.getElementById('modal-title').innerText = "Rediger post";
            document.getElementById('post-title').value = item.title;
            document.getElementById('post-amount').value = item.amount;
            document.getElementById('post-type').value = item.type;
            document.getElementById('post-category').value = item.category || 'andet';
            document.getElementById('post-owner').value = item.owner;
            document.getElementById('post-recurring').checked = item.isRecurring;
            document.getElementById('budget-modal').style.display = 'flex';
        };
    });
}

function setupEvents(container) {
    document.getElementById('prev-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()-1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    document.getElementById('next-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()+1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    
    container.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => { 
        currentTab = b.dataset.tab; 
        isEditingTargets = false; // Nulstil redigering ved tab-skift
        renderBudget(container); 
    });
    
    document.getElementById('toggle-edit-targets').onclick = async () => {
        if (isEditingTargets) {
            const inputs = container.querySelectorAll('.target-input');
            const newTargets = {};
            inputs.forEach(input => {
                const cat = input.dataset.cat;
                const val = parseFloat(input.value) || 0;
                newTargets[cat] = { target: val };
            });
            const ownerKey = currentTab === 'total' ? 'shared' : currentTab;
            await saveBudgetTargets(ownerKey, newTargets);
        }
        isEditingTargets = !isEditingTargets;
        renderBudget(container);
    };

    document.getElementById('open-modal-btn').onclick = () => { editingPostId = null; document.getElementById('budget-form').reset(); document.getElementById('modal-title').innerText = "Ny budgetpost"; document.getElementById('budget-modal').style.display = 'flex'; };
    document.getElementById('cancel-btn').onclick = () => document.getElementById('budget-modal').style.display = 'none';

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
        document.getElementById('budget-modal').style.display = 'none';
        updateDisplay();
    };
}

function formatMonth(m) { return new Date(m + "-01").toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }); }
