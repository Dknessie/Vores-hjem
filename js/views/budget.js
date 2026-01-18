import { addBudgetPost, getBudgetPosts, deleteBudgetPost } from "../services/budgetService.js";

// Vi holder styr på den valgte måned og tab i denne fil
let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; // 'total', 'user1' (Mig), 'user2' (Kæreste)

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
            <div class="stat-card balance">
                <label>Rådighed</label>
                <div id="total-balance">0 kr.</div>
            </div>
        </div>

        <section class="budget-list-section">
            <div class="section-bar">
                <h3>Budgetposter</h3>
                <button id="open-modal-btn" class="btn-add">+ Tilføj</button>
            </div>
            <ul id="budget-items" class="budget-list">
                <li class="loading">Henter poster...</li>
            </ul>
        </section>

        <!-- Modal (skjult som default) -->
        <div id="budget-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2>Ny budgetpost</h2>
                <form id="budget-form">
                    <div class="input-group">
                        <label>Titel</label>
                        <input type="text" id="post-title" placeholder="f.eks. Husleje, Løn" required>
                    </div>
                    <div class="input-group">
                        <label>Beløb (kr.)</label>
                        <input type="number" id="post-amount" placeholder="0" required>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Type</label>
                            <select id="post-type">
                                <option value="income">Indtægt</option>
                                <option value="expense" selected>Udgift</option>
                            </select>
                        </div>
                        <div class="input-group">
                            <label>Hvem</label>
                            <select id="post-owner">
                                <option value="user1">Mig</option>
                                <option value="user2">Kæreste</option>
                            </select>
                        </div>
                    </div>
                    <div class="checkbox-group">
                        <input type="checkbox" id="post-recurring" checked>
                        <label for="post-recurring">Løbende udgift (hver måned)</label>
                    </div>
                    <div id="end-date-wrap" style="display:none;">
                        <label>Slutdato (sidste måned den skal tælle med)</label>
                        <input type="month" id="post-end-date">
                    </div>
                    <div class="modal-buttons">
                        <button type="button" id="cancel-btn" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem post</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    bindEvents();
    updateDisplay();
}

function bindEvents() {
    // Navigation
    document.getElementById('prev-month').onclick = () => moveMonth(-1);
    document.getElementById('next-month').onclick = () => moveMonth(1);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            currentTab = e.target.dataset.tab;
            renderBudget(document.querySelector("#app"));
        };
    });

    // Modal
    const modal = document.getElementById('budget-modal');
    document.getElementById('open-modal-btn').onclick = () => modal.style.display = 'flex';
    document.getElementById('cancel-btn').onclick = () => modal.style.display = 'none';

    // Slutdato logik
    document.getElementById('post-recurring').onchange = (e) => {
        document.getElementById('end-date-wrap').style.display = e.target.checked ? 'none' : 'block';
    };

    // Form submission
    document.getElementById('budget-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            title: document.getElementById('post-title').value,
            amount: parseFloat(document.getElementById('post-amount').value),
            type: document.getElementById('post-type').value,
            owner: document.getElementById('post-owner').value,
            isRecurring: document.getElementById('post-recurring').checked,
            endDate: document.getElementById('post-end-date').value || null,
            startDate: selectedMonth // Den starter i den måned man står i
        };

        await addBudgetPost(data);
        modal.style.display = 'none';
        updateDisplay();
    };
}

async function updateDisplay() {
    const listEl = document.getElementById('budget-items');
    const posts = await getBudgetPosts();
    
    // Logik: Filtrér poster der er aktive i den valgte måned
    const visiblePosts = posts.filter(post => {
        const isAfterStart = selectedMonth >= post.startDate;
        const isBeforeEnd = !post.endDate || selectedMonth <= post.endDate;
        const monthActive = isAfterStart && (post.isRecurring || isBeforeEnd);
        
        // Tab filtrering
        const tabActive = (currentTab === 'total') || (post.owner === currentTab);
        
        return monthActive && tabActive;
    });

    let inc = 0, exp = 0;
    listEl.innerHTML = visiblePosts.length ? "" : '<li class="empty">Ingen poster fundet for denne måned.</li>';

    visiblePosts.forEach(post => {
        if (post.type === 'income') inc += post.amount;
        else exp += post.amount;

        const li = document.createElement('li');
        li.className = 'budget-item';
        li.innerHTML = `
            <div class="item-main">
                <span class="item-name">${post.title}</span>
                <span class="item-owner">${post.owner === 'user1' ? 'Mig' : 'Kæreste'} ${post.endDate ? '• Slutter ' + post.endDate : ''}</span>
            </div>
            <div class="item-val ${post.type}">
                ${post.type === 'income' ? '+' : '-'}${post.amount.toLocaleString()} kr.
                <button class="btn-del" data-id="${post.id}">✕</button>
            </div>
        `;
        listEl.appendChild(li);
    });

    // Slet-knapper
    document.querySelectorAll('.btn-del').forEach(btn => {
        btn.onclick = async () => {
            if(confirm('Slet posten?')) {
                await deleteBudgetPost(btn.dataset.id);
                updateDisplay();
            }
        };
    });

    document.getElementById('total-income').innerText = inc.toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = exp.toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = (inc - exp).toLocaleString() + ' kr.';
}

function moveMonth(delta) {
    let d = new Date(selectedMonth + "-01");
    d.setMonth(d.setMonth() + delta); // Rettelse: setMonth returnerer timestamp, brug d.getMonth() + delta
    d = new Date(selectedMonth + "-01");
    d.setMonth(d.getMonth() + delta);
    selectedMonth = d.toISOString().slice(0, 7);
    renderBudget(document.querySelector("#app"));
}

function formatMonth(m) {
    return new Date(m + "-01").toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
}
