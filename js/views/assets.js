import { addLoan, getLoans, deleteLoan, getLoanEndDate, calculateLoanForMonth } from "../services/loanService.js";

let selectedLoanId = null;
let currentTab = 'total'; // 'total', 'user1', 'user2'

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
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kærestens Andel</button>
        </div>

        <section class="debt-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Lån' : 'Gældsoversigt (' + (currentTab === 'total' ? 'Total' : 'Andel') + ')'}</label>
                <div class="debt-value">${Math.round(stats.displayDebt).toLocaleString()} kr.</div>
                <p class="debt-date">Forventet gældsfri: <strong>${stats.displayDate}</strong></p>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Nulstil valg</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Formuevækst (Afdrag)</label>
                    <span class="val positive">+${Math.round(stats.displayPrincipal).toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Renteudgift (Tab)</label>
                    <span class="val negative">-${Math.round(stats.displayInterest).toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <div id="loan-form-container" class="form-drawer" style="display:none;">
            <div class="asset-card-main">
                <h3>Opret nyt lån</h3>
                <form id="loan-form">
                    <div class="input-row">
                        <div class="input-group">
                            <label>Navn</label>
                            <input type="text" id="loan-name" placeholder="f.eks. Billån" required>
                        </div>
                        <div class="input-group">
                            <label>Lånebeløb nu (kr.)</label>
                            <input type="number" id="loan-principal" required>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Rente (%)</label>
                            <input type="number" id="loan-interest" step="0.01" required>
                        </div>
                        <div class="input-group">
                            <label>Mdl. Ydelse (kr.)</label>
                            <input type="number" id="loan-payment" required>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Startmåned</label>
                            <input type="month" id="loan-start" required>
                        </div>
                        <div class="input-group">
                            <label>Ejer</label>
                            <select id="loan-owner">
                                <option value="user1">Mig</option>
                                <option value="user2">Kæreste</option>
                                <option value="shared">Fælles (50/50)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-form" class="btn-text">Fortryd</button>
                        <button type="submit" class="btn-submit">Gem lån</button>
                    </div>
                </form>
            </div>
        </div>

        <section class="loan-list-section">
            <h3 class="section-title">Aktive Lån</h3>
            <p class="section-hint">Klik på et lån for at nørde detaljerne</p>
            <div class="loan-cards-grid">
                ${loans.map(loan => `
                    <div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''}" data-id="${loan.id}">
                        <div class="loan-card-info">
                            <h4>${loan.name}</h4>
                            <p>${loan.owner === 'shared' ? 'Fælles' : loan.owner === 'user1' ? 'Mig' : 'Kæreste'}</p>
                        </div>
                        <div class="loan-card-meta">
                            <span class="loan-amount">${loan.monthlyPayment.toLocaleString()} kr/mdr</span>
                            <button class="btn-del-minimal" data-delete="${loan.id}">✕</button>
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
    let totalDebt = 0, totalInt = 0, totalPrinc = 0, maxDate = "";

    // Hvis et lån er valgt, kigger vi kun på det. Ellers kigger vi på alle der matcher fanen.
    const targetLoans = selectedLoanId ? loans.filter(l => l.id === selectedLoanId) : loans;

    targetLoans.forEach(loan => {
        const isUserTab = currentTab !== 'total';
        const isOwner = loan.owner === currentTab;
        const isShared = loan.owner === 'shared';

        // Hvis vi er i en personlig fane, og lånet hverken er ens eget eller fælles, så spring over.
        if (isUserTab && !isOwner && !isShared) return;

        const calc = calculateLoanForMonth(loan, now);
        if (calc) {
            let multiplier = (isUserTab && isShared) ? 0.5 : 1.0;
            
            totalDebt += calc.remainingBalance * multiplier;
            totalInt += calc.interest * multiplier;
            totalPrinc += calc.principalPaid * multiplier;

            const end = getLoanEndDate(loan);
            if (end > maxDate) maxDate = end;
        }
    });

    return {
        displayDebt: totalDebt,
        displayInterest: totalInt,
        displayPrincipal: totalPrinc,
        displayDate: maxDate ? new Date(maxDate + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'}) : "N/A"
    };
}

function setupEvents(container, loans) {
    // Tabs
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = (e) => {
            currentTab = e.target.dataset.tab;
            renderAssets(container);
        };
    });

    // Toggle form
    document.getElementById('toggle-loan-form').onclick = () => {
        const drawer = document.getElementById('loan-form-container');
        drawer.style.display = drawer.style.display === 'none' ? 'block' : 'none';
    };
    document.getElementById('close-form').onclick = () => document.getElementById('loan-form-container').style.display = 'none';

    // Klik på lån for detaljer
    container.querySelectorAll('.loan-summary-card').forEach(card => {
        card.onclick = (e) => {
            if (e.target.closest('[data-delete]')) return;
            selectedLoanId = selectedLoanId === card.dataset.id ? null : card.dataset.id;
            renderAssets(container);
        };
    });

    if (document.getElementById('clear-selection')) {
        document.getElementById('clear-selection').onclick = () => {
            selectedLoanId = null;
            renderAssets(container);
        };
    }

    // Slet lån
    container.querySelectorAll('[data-delete]').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Slet lån permanent?')) {
                await deleteLoan(btn.dataset.delete);
                if (selectedLoanId === btn.dataset.delete) selectedLoanId = null;
                renderAssets(container);
            }
        };
    });

    // Gem form
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
        await addLoan(data);
        renderAssets(container);
    };
}
