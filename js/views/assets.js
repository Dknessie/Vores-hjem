import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth } from "../services/loanService.js";

let selectedLoanId = null;
let currentTab = 'total';
let editingLoanId = null;

export async function renderAssets(container) {
    const loans = await getLoans();
    const stats = calculateStats(loans);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-loan-form" class="btn-outline">+ Opret nyt lån</button>
            </div>
        </header>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Min Andel</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <section class="debt-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Lån' : 'Samlet Gæld'}</label>
                <div class="debt-value">${Math.round(stats.displayDebt).toLocaleString()} kr.</div>
                <p class="debt-date">Forventet gældsfri: <strong>${stats.displayDate}</strong></p>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Vis alle lån</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Opsparing (Afdrag)</label>
                    <span class="val positive">+${Math.round(stats.displayPrincipal).toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Tab (Rente)</label>
                    <span class="val negative">-${Math.round(stats.displayInterest).toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <div id="loan-form-container" class="form-drawer" style="display:none;">
            <div class="asset-card-main">
                <h3 id="loan-form-title">Opret nyt lån</h3>
                <form id="loan-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="loan-name" required></div>
                        <div class="input-group"><label>Gæld nu (kr.)</label><input type="number" id="loan-principal" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Rente (%)</label><input type="number" id="loan-interest" step="0.01" required></div>
                        <div class="input-group"><label>Mdl. Ydelse (kr.)</label><input type="number" id="loan-payment" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Startmåned</label><input type="month" id="loan-start" required></div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="loan-owner">
                                <option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared">Fælles (50/50)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-form" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem lån</button>
                    </div>
                </form>
            </div>
        </div>

        <section class="loan-list-section">
            <h3 class="section-title">Dine aktive lån</h3>
            <div class="loan-cards-grid">
                ${loans.map(loan => `
                    <div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''}" data-id="${loan.id}">
                        <div class="loan-card-info">
                            <h4>${loan.name}</h4>
                            <p>${loan.owner === 'shared' ? 'Fælles' : (loan.owner === 'user1' ? 'Mig' : 'Kæreste')}</p>
                        </div>
                        <div class="loan-card-meta">
                            <span class="loan-amount">${loan.monthlyPayment.toLocaleString()} kr/mdr</span>
                            <div class="card-actions">
                                <button class="btn-edit-minimal" data-edit="${loan.id}">✎</button>
                                <button class="btn-del-minimal" data-delete="${loan.id}">✕</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
    setupEvents(container, loans);
}

function calculateStats(loans) {
    const now = new Date().toISOString().slice(0, 7);
    let debt = 0, int = 0, princ = 0, maxD = "";
    const targets = selectedLoanId ? loans.filter(l => l.id === selectedLoanId) : loans;
    targets.forEach(loan => {
        const isUser = currentTab !== 'total';
        if (isUser && loan.owner !== currentTab && loan.owner !== 'shared') return;
        const calc = calculateLoanForMonth(loan, now);
        if (calc) {
            let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
            debt += calc.remainingBalance * m;
            int += calc.interest * m;
            princ += calc.principalPaid * m;
            const end = getLoanEndDate(loan); if (end > maxD) maxD = end;
        }
    });
    return { displayDebt: debt, displayInterest: int, displayPrincipal: princ, displayDate: maxD ? new Date(maxD + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'}) : "N/A" };
}

function setupEvents(container, loans) {
    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { currentTab = btn.dataset.tab; renderAssets(container); });
    document.getElementById('toggle-loan-form').onclick = () => { editingLoanId = null; document.getElementById('loan-form').reset(); document.getElementById('loan-form-title').innerText = "Opret nyt lån"; document.getElementById('loan-form-container').style.display = 'block'; };
    document.getElementById('close-form').onclick = () => document.getElementById('loan-form-container').style.display = 'none';
    container.querySelectorAll('.loan-summary-card').forEach(card => card.onclick = (e) => { if (e.target.closest('button')) return; selectedLoanId = selectedLoanId === card.dataset.id ? null : card.dataset.id; renderAssets(container); });
    if (document.getElementById('clear-selection')) document.getElementById('clear-selection').onclick = () => { selectedLoanId = null; renderAssets(container); };
    container.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => {
        const loan = loans.find(l => l.id === btn.dataset.edit);
        editingLoanId = loan.id;
        document.getElementById('loan-form-title').innerText = "Rediger lån";
        document.getElementById('loan-name').value = loan.name;
        document.getElementById('loan-principal').value = loan.principal;
        document.getElementById('loan-interest').value = loan.interestRate;
        document.getElementById('loan-payment').value = loan.monthlyPayment;
        document.getElementById('loan-start').value = loan.startDate;
        document.getElementById('loan-owner').value = loan.owner;
        document.getElementById('loan-form-container').style.display = 'block';
    });
    container.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => { if (confirm('Slet lån?')) { await deleteLoan(btn.dataset.delete); renderAssets(container); } });
    document.getElementById('loan-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('loan-name').value,
            principal: parseFloat(document.getElementById('loan-principal').value),
            interestRate: parseFloat(document.getElementById('loan-interest').value),
            monthlyPayment: parseFloat(document.getElementById('loan-payment').value),
            startDate: document.getElementById('loan-start').value,
            owner: document.getElementById('loan-owner').value
        };
        if (editingLoanId) await updateLoan(editingLoanId, data); else await addLoan(data);
        renderAssets(container);
    };
}
