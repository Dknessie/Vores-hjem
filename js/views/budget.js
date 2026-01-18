import { getBudgetPosts, addBudgetPost, deleteBudgetPost, updateBudgetPost } from "../services/budgetService.js";
import { getLoans, calculateLoanForMonth } from "../services/loanService.js";

let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; 
let editingPostId = null;

export async function renderBudget(container) {
    container.innerHTML = `
        <header class="view-header">
            <h1>Budget & Økonomi</h1>
            <div class="month-selector">
                <button id="prev-month" class="btn-icon">←</button>
                <span id="current-month-display" class="month-label">${formatMonth(selectedMonth)}</span>
                <button id="next-month" class="btn-icon">→</button>
            </div>
        </header>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mit Budget</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <div class="budget-overview">
            <div class="stat-card income"><label>Indtægter</label><div id="total-income">0 kr.</div></div>
            <div class="stat-card expenses"><label>Udgifter</label><div id="total-expenses">0 kr.</div></div>
            <div class="stat-card assets"><label>Vækst (Afdrag)</label><div id="total-assets">0 kr.</div></div>
            <div class="stat-card balance"><label>Rådighed</label><div id="total-balance">0 kr.</div></div>
        </div>

        <section class="budget-list-section">
            <div class="section-bar">
                <h3>Poster i ${formatMonth(selectedMonth)}</h3>
                <button id="open-modal-btn" class="btn-add">+ Manuel post</button>
            </div>
            <ul id="budget-items" class="budget-list"></ul>
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
                    <div class="input-group"><label>Ejer</label>
                        <select id="post-owner">
                            <option value="user1">Mig</option>
                            <option value="user2">Kæreste</option>
                            <option value="shared">Fælles (50/50)</option>
                        </select>
                    </div>
                    <div class="checkbox-group"><input type="checkbox" id="post-recurring" checked><label>Løbende post</label></div>
                    <div class="modal-buttons">
                        <button type="button" id="cancel-btn" class="btn-text">Fortryd</button>
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
    const listEl = document.getElementById('budget-items');
    if (!listEl) return;

    const posts = await getBudgetPosts();
    const loans = await getLoans();
    let inc = 0, exp = 0, princ = 0;
    listEl.innerHTML = "";

    posts.forEach(p => {
        if (selectedMonth < p.startDate || (p.endDate && selectedMonth > p.endDate)) return;
        const isUser = currentTab !== 'total';
        if (isUser && p.owner !== currentTab && p.owner !== 'shared') return;
        let m = (isUser && p.owner === 'shared') ? 0.5 : 1;
        let amt = p.amount * m;
        if (p.type === 'income') inc += amt; else exp += amt;
        renderItem(listEl, p, amt, m < 1);
    });

    loans.forEach(l => {
        const isUser = currentTab !== 'total';
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        const c = calculateLoanForMonth(l, selectedMonth);
        if (c) {
            let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
            exp += c.interest * m; princ += c.principalPaid * m;
            renderItem(listEl, { id: null, title: l.name + " (Rente)", owner: l.owner, type: 'expense' }, c.interest * m, m < 1, true);
            renderItem(listEl, { id: null, title: l.name + " (Afdrag)", owner: l.owner, type: 'asset' }, c.principalPaid * m, m < 1, true);
        }
    });

    document.getElementById('total-income').innerText = Math.round(inc).toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = Math.round(exp).toLocaleString() + ' kr.';
    document.getElementById('total-assets').innerText = Math.round(princ).toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = Math.round(inc - exp - princ).toLocaleString() + ' kr.';
}

function renderItem(parent, item, amount, isSplit, isAuto = false) {
    const li = document.createElement('li');
    li.className = 'budget-item';
    li.innerHTML = `
        <div class="item-main">
            <span class="item-name">${item.title} ${isAuto ? '<span class="auto-badge">Auto</span>' : ''} ${isSplit ? '<small>(50%)</small>' : ''}</span>
            <span class="item-owner">${item.owner === 'shared' ? 'Fælles' : (item.owner === 'user1' ? 'Mig' : 'Kæreste')}</span>
        </div>
        <div class="item-val ${item.type}">
            ${item.type === 'income' ? '+' : '-'}${Math.round(amount).toLocaleString()} kr.
            ${!isAuto ? `<button class="btn-edit-minimal" data-edit="${item.id}">✎</button>` : ''}
        </div>
    `;
    parent.appendChild(li);
    if (!isAuto) {
        li.querySelector('[data-edit]').onclick = () => {
            editingPostId = item.id;
            document.getElementById('modal-title').innerText = "Rediger post";
            document.getElementById('post-title').value = item.title;
            document.getElementById('post-amount').value = item.amount;
            document.getElementById('post-type').value = item.type;
            document.getElementById('post-owner').value = item.owner;
            document.getElementById('post-recurring').checked = item.isRecurring;
            document.getElementById('budget-modal').style.display = 'flex';
        };
    }
}

function setupEvents(container) {
    document.getElementById('prev-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()-1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    document.getElementById('next-month').onclick = () => { let d = new Date(selectedMonth+"-01"); d.setMonth(d.getMonth()+1); selectedMonth = d.toISOString().slice(0,7); renderBudget(container); };
    container.querySelectorAll('.tab-btn').forEach(b => b.onclick = () => { currentTab = b.dataset.tab; renderBudget(container); });
    document.getElementById('open-modal-btn').onclick = () => { editingPostId = null; document.getElementById('budget-form').reset(); document.getElementById('modal-title').innerText = "Ny budgetpost"; document.getElementById('budget-modal').style.display = 'flex'; };
    document.getElementById('cancel-btn').onclick = () => document.getElementById('budget-modal').style.display = 'none';

    document.getElementById('budget-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            title: document.getElementById('post-title').value,
            amount: parseFloat(document.getElementById('post-amount').value),
            type: document.getElementById('post-type').value,
            owner: document.getElementById('post-owner').value,
            isRecurring: document.getElementById('post-recurring').checked,
            startDate: selectedMonth
        };
        if (editingPostId) await updateBudgetPost(editingPostId, data);
        else await addBudgetPost(data);
        document.getElementById('budget-modal').style.display = 'none';
        updateDisplay();
    };
}

function formatMonth(m) { return new Date(m + "-01").toLocaleDateString('da-DK', { month: 'long', year: 'numeric' }); }
