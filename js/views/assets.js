import { addLoan, getLoans, deleteLoan, getLoanEndDate, calculateLoanForMonth } from "../services/loanService.js";

let selectedLoanId = null;

export async function renderAssets(container) {
    const loans = await getLoans();
    const stats = calculateStats(loans);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-loan-form" class="btn-outline">+ Tilføj nyt lån</button>
            </div>
        </header>

        <!-- Detaljeret Dashboard -->
        <section class="debt-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Lån' : 'Samlet Husstandsgæld'}</label>
                <div class="debt-value">${stats.displayDebt.toLocaleString()} kr.</div>
                <p class="debt-date">Gældsfri: <strong>${stats.displayDate}</strong></p>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Vis alle lån</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Opsparing (Afdrag)</label>
                    <span class="val positive">+${stats.displayPrincipal.toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Tab (Rente)</label>
                    <span class="val negative">-${stats.displayInterest.toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <!-- Skjult form som default -->
        <div id="loan-form-container" class="form-drawer" style="display:none;">
            <div class="asset-card-main">
                <h3>Opret nyt lån</h3>
                <form id="loan-form">
                    <div class="input-row">
                        <div class="input-group">
                            <label>Navn (Bil, Hus...)</label>
                            <input type="text" id="loan-name" required>
                        </div>
                        <div class="input-group">
                            <label>Hovedstol (kr.)</label>
                            <input type="number" id="loan-principal" required>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Rente (%)</label>
                            <input type="number" id="loan-interest" step="0.01" required>
                        </div>
                        <div class="input-group">
                            <label>Ydelse (kr.)</label>
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
                                <option value="shared">Fælles</option>
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
            <p class="section-hint">Klik på et lån for at se detaljeret S-profil</p>
            <div class="loan-cards-grid">
                ${loans.map(loan => `
                    <div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''}" data-id="${loan.id}">
                        <div class="loan-card-info">
                            <h4>${loan.name}</h4>
                            <p>${loan.owner === 'user1' ? 'Mig' : 'Kæreste'}</p>
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

    const targetLoans = selectedLoanId ? loans.filter(l => l.id === selectedLoanId) : loans;

    targetLoans.forEach(loan => {
        const calc = calculateLoanForMonth(loan, now);
        if (calc) {
            totalDebt += calc.remainingBalance;
            totalInt += calc.interest;
            totalPrinc += calc.principalPaid;
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
