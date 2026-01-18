import { state } from "../app.js";
import { addBudgetPost, getBudgetPosts, deleteBudgetPost } from "../services/budgetService.js";

// Vi gemmer den valgte måned i en lokal variabel (YYYY-MM)
let selectedMonth = new Date().toISOString().slice(0, 7);
let currentTab = 'total'; // 'total', 'user1', 'user2'

export async function renderBudget(container) {
    container.innerHTML = `
        <header class="view-header">
            <h1>Budget</h1>
            <div class="month-selector">
                <button id="prev-month">←</button>
                <span id="current-month-display">${formatMonth(selectedMonth)}</span>
                <button id="next-month">→</button>
            </div>
        </header>

        <nav class="tab-nav">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mit Budget</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kærestens Budget</button>
        </nav>

        <div id="budget-content">
            <div class="budget-summary-grid">
                <div class="summary-card income">
                    <h4>Indtægter</h4>
                    <p id="total-income">0 kr.</p>
                </div>
                <div class="summary-card expenses">
                    <h4>Udgifter</h4>
                    <p id="total-expenses">0 kr.</p>
                </div>
                <div class="summary-card balance">
                    <h4>Rådighedsbeløb</h4>
                    <p id="total-balance">0 kr.</p>
                </div>
            </div>

            <section class="budget-section">
                <div class="section-header">
                    <h3>Poster</h3>
                    <button id="add-post-btn" class="btn-small">+ Tilføj post</button>
                </div>
                <ul id="budget-list" class="data-list">
                    </ul>
            </section>
        </div>

        <div id="budget-modal" class="modal" style="display:none;">
            <div class="modal-content">
                <h3>Ny budgetpost</h3>
                <form id="budget-form">
                    <input type="text" id="title" placeholder="Titel (f.eks. Løn, Husleje)" required>
                    <input type="number" id="amount" placeholder="Beløb" required>
                    <select id="type">
                        <option value="income">Indtægt</option>
                        <option value="expense">Udgift</option>
                    </select>
                    <select id="owner">
                        <option value="user1">Mig</option>
                        <option value="user2">Kæreste</option>
                    </select>
                    <label>
                        <input type="checkbox" id="is-recurring" checked> Løbende post
                    </label>
                    <div id="end-date-container" style="display:none;">
                        <label>Slutdato (måned):</label>
                        <input type="month" id="end-date">
                    </div>
                    <div class="modal-actions">
                        <button type="button" id="close-modal">Annuller</button>
                        <button type="submit" class="btn-primary">Gem post</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupEventListeners();
    loadAndRenderPosts();
}

function setupEventListeners() {
    // Månedsnavigation
    document.getElementById('prev-month').onclick = () => changeMonth(-1);
    document.getElementById('next-month').onclick = () => changeMonth(1);

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            currentTab = e.target.dataset.tab;
            renderBudget(document.getElementById('app'));
        };
    });

    // Modal logik
    const modal = document.getElementById('budget-modal');
    document.getElementById('add-post-btn').onclick = () => modal.style.display = 'flex';
    document.getElementById('close-modal').onclick = () => modal.style.display = 'none';

    // Vis/skjul slutdato baseret på checkbox
    document.getElementById('is-recurring').onchange = (e) => {
        document.getElementById('end-date-container').style.display = e.target.checked ? 'none' : 'block';
    };

    // Gem post
    document.getElementById('budget-form').onsubmit = async (e) => {
        e.preventDefault();
        const newPost = {
            title: document.getElementById('title').value,
            amount: parseFloat(document.getElementById('amount').value),
            type: document.getElementById('type').value,
            owner: document.getElementById('owner').value,
            isRecurring: document.getElementById('is-recurring').checked,
            endDate: document.getElementById('end-date').value || null,
            startDate: selectedMonth // Posten starter i den måned man står i
        };

        await addBudgetPost(newPost);
        modal.style.display = 'none';
        loadAndRenderPosts();
    };
}

async function loadAndRenderPosts() {
    const list = document.getElementById('budget-list');
    const posts = await getBudgetPosts();
    
    // Filtrér poster baseret på valgt måned og valgt tab
    const activePosts = posts.filter(post => {
        // Logik: Skal posten vises i denne måned?
        const start = post.startDate;
        const end = post.endDate;
        const isBeforeEnd = !end || selectedMonth <= end;
        const isAfterStart = selectedMonth >= start;
        
        const monthMatch = isAfterStart && (post.isRecurring || isBeforeEnd);
        
        // Tab filtrering
        const tabMatch = (currentTab === 'total') || (post.owner === currentTab);
        
        return monthMatch && tabMatch;
    });

    let income = 0;
    let expenses = 0;

    list.innerHTML = activePosts.map(post => {
        if (post.type === 'income') income += post.amount;
        else expenses += post.amount;

        return `
            <li class="list-item">
                <div class="item-info">
                    <span class="item-title">${post.title}</span>
                    <span class="item-meta">${post.owner === 'user1' ? 'Mig' : 'Kæreste'} ${post.endDate ? '• Slutter ' + post.endDate : ''}</span>
                </div>
                <div class="item-amount ${post.type}">
                    ${post.type === 'income' ? '+' : '-'}${post.amount} kr.
                    <button class="delete-btn" onclick="window.deletePost('${post.id}')">✕</button>
                </div>
            </li>
        `;
    }).join('');

    // Opdater opsummering
    document.getElementById('total-income').innerText = income.toLocaleString() + ' kr.';
    document.getElementById('total-expenses').innerText = expenses.toLocaleString() + ' kr.';
    document.getElementById('total-balance').innerText = (income - expenses).toLocaleString() + ' kr.';
}

// Global hjælpefunktion til sletning (da vi bruger template strings)
window.deletePost = async (id) => {
    if (confirm('Vil du slette denne post?')) {
        await deleteBudgetPost(id);
        loadAndRenderPosts();
    }
};

function changeMonth(delta) {
    let date = new Date(selectedMonth + "-01");
    date.setMonth(date.getMonth() + delta);
    selectedMonth = date.toISOString().slice(0, 7);
    renderBudget(document.getElementById('app'));
}

function formatMonth(monthStr) {
    const date = new Date(monthStr + "-01");
    return date.toLocaleDateString('da-DK', { month: 'long', year: 'numeric' });
}
