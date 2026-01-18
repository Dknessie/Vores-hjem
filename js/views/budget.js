import { getBudgetPosts, addBudgetPost, deleteBudgetPost } from "../services/budgetService.js";
import { getLoans, calculateLoanForMonth } from "../services/loanService.js";

let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; // 'total', 'user1', 'user2'

export async function renderBudget(container) {
    container.innerHTML = `
        <header class="view-header">
            <h1>Budget & Økonomi</h1>
            <div class="month-selector">
                <button id="prev-month" class="btn-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
                </button>
                <span id="current-month-display" class="month-label">${formatMonth(selectedMonth)}</span>
                <button id="next-month" class="btn-icon">
                    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
                </button>
            </div>
        </header>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mit Budget</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kærestens Budget</button>
        </div>

        <div class="budget-overview">
            <div class="stat-card income">
                <label>Indtægter</label>
                <div id="total-income">0 kr.</div>
            </div>
            <div class="stat-card expenses">
                <label>Udgifter</label>
                <div id="total-expenses">0 kr.</div>
            </div>
            <div class="stat-card assets">
                <label>Formuevækst (Afdrag)</label>
                <div id="total-assets">0 kr.</div>
            </div>
            <div class="stat-card balance">
                <label>Rådighed</label>
                <div id="total-balance">0 kr.</div>
            </div>
        </div>

        <section class="budget-list-section">
            <div class="section-bar">
                <h3>Poster i ${formatMonth(selectedMonth)}</h3>
                <button id="open-modal-btn" class="btn-add">+ Tilføj manuel post</button>
            </div>
            <ul id="budget-items" class="budget-list"></ul>
        </section>

        <div id="budget-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2>Ny budgetpost</h2>
                <form id="budget-form">
                    <div class="input-group">
                        <label>Titel</label>
                        <input type="text" id="post-title" placeholder="f.eks. Husleje" required>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Beløb</label>
                            <input type="number" id="post-amount" required>
                        </div>
                        <div class="input-group">
                            <label>Type</label>
                            <select id="post-type">
                                <option value="income">Indtægt</option>
                                <option value="expense" selected>Udgift</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Hvem tilhører posten?</label>
                        <select id="post-owner-select">
                            <option value="user1">Mig</option>
                            <option value="user2">Kæreste</option>
                            <option value="shared">Fælles (deles 50/50)</option>
                        </select>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="post-recurring" checked>
                        <label for="post-recurring">Løbende hver måned</label>
                    </div>
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
    const posts = await getBudgetPosts();
    const loans = await getLoans();
    
    let inc = 0, exp = 0, princ = 0;
    listEl.innerHTML = "";

    // 1. Manuelle poster med 50/50 split logik
    posts.forEach(post => {
        if (!isPostActive(post, selectedMonth)) return;
        
        const isUserTab = currentTab !== 'total';
        const isOwner = post.owner === currentTab;
        const isShared = post.owner === 'shared';

        if (!isUserTab || isOwner || isShared) {
            let multiplier = (isUserTab && isShared) ? 0.5 : 1.0;
            let finalAmount = post.amount * multiplier;

            if (post.type === 'income') inc += finalAmount;
            else exp += finalAmount;

            renderItem(listEl, post.title + (isShared && isUserTab ? ' (50%)' : ''), finalAmount, post.type, post.owner, post.id);
        }
    });

    // 2. Automatiske lån med 50/50 split logik
    loans.forEach(loan => {
        const isUserTab = currentTab !== 'total';
        const isOwner = loan.owner === currentTab;
        const isShared = loan.owner === 'shared';

        if (!isUserTab || isOwner || isShared) {
            const calc = calculateLoanForMonth(loan, selectedMonth);
            if (calc) {
                let multiplier = (isUserTab && isShared) ? 0.5 : 1.0;
                
                let finalInterest = calc.interest * multiplier;
                let finalPrincipal = calc.principalPaid * multiplier;

                exp += finalInterest;
                princ += finalPrincipal;

                renderItem(listEl, `${loan.name} (Rente)${isShared && isUserTab ? ' (50%)' : ''}`, finalInterest, 'expense', loan.owner, null, true);
                renderItem(listEl, `${loan.name} (Afdrag)${isShared && isUserTab ? ' (50%)' : ''}`, finalPrincipal, 'asset', loan.owner, null, true);
            }
        }
    });

    document.getElementById('total-income').innerText = Math.round(inc).toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = Math.round(exp).toLocaleString() + ' kr.';
    document.getElementById('total-assets').innerText = Math.round(princ).toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = Math.round(inc - exp - princ).toLocaleString() + ' kr.';
}

function renderItem(parent, title, amount, type, owner, id, isAuto = false) {
    const li = document.createElement('li');
    li.className = 'budget-item';
    li.innerHTML = `
        <div class="item-main">
            <span class="item-name">${title} ${isAuto ? '<span class="auto-badge">Auto</span>' : ''}</span>
            <span class="item-owner">${owner === 'user1' ? 'Mig' : owner === 'user2' ? 'Kæreste' : 'Fælles'}</span>
        </div>
        <div class="item-val ${type}">
            ${type === 'income' ? '+' : '-'}${Math.round(amount).toLocaleString()} kr.
            ${!isAuto ? `<button class="btn-del-minimal" onclick="deleteManualPost('${id}')">✕</button>` : ''}
        </div>
    `;
    parent.appendChild(li);
}

function isPostActive(post, month) {
    return month >= post.startDate && (!post.endDate || month <= post.endDate);
}

function setupEvents(container) {
    document.getElementById('prev-month').onclick = () => {
        let d = new Date(selectedMonth + "-01");
        d.setMonth(d.getMonth() - 1);
        selectedMonth = d.toISOString().slice(0, 7);
        renderBudget(container);
    };
    document.getElementById('next-month').onclick = () => {
        let d = new Date(selectedMonth + "-01");
        d.setMonth(d.getMonth() + 1);
        selectedMonth = d.toISOString().slice(0, 7);
        renderBudget(container);
    };
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            currentTab = e.target.dataset.tab;
            renderBudget(container);
        };
    });
    
    const modal = document.getElementById('budget-modal');
    document.getElementById('open-modal-btn').onclick = () => modal.style.display = 'flex';
    document.getElementById('cancel-btn').onclick = () => modal.style.display = 'none';

    document.getElementById('budget-form').onsubmit = async (e) => {
        e.preventDefault();
        await addBudgetPost({
            title: document.getElementById('post-title').value,
            amount: parseFloat(document.getElementById('post-amount').value),
            type: document.getElementById('post-type').value,
            owner: document.getElementById('post-owner-select').value,
            startDate: selectedMonth,
            isRecurring: document.getElementById('post-recurring').checked
        });
        modal.style.display = 'none';
        updateDisplay();
    };
}

function formatMonth(m) {
    return new Date(m + "-01").toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
}

window.deleteManualPost = async (id) => {
    if(confirm('Slet post?')) {
        await deleteBudgetPost(id);
        renderBudget(document.getElementById('app'));
    }
}
