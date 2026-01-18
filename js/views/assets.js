import { addLoan, getLoans, deleteLoan, getLoanEndDate, calculateLoanForMonth } from "../services/loanService.js";

export async function renderAssets(container) {
    const loans = await getLoans();
    const stats = calculateGlobalStats(loans);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <p>Din vej mod gældsfrihed</p>
        </header>

        <!-- S-Profil Dashboard -->
        <section class="debt-dashboard">
            <div class="main-debt-card">
                <label>Samlet Gæld</label>
                <div class="debt-value">${stats.totalDebt.toLocaleString()} kr.</div>
                <p class="debt-date">Forventet gældsfri: <strong>${stats.freedomDate}</strong></p>
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Afdrag (Vækst)</label>
                    <span class="val positive">+${stats.totalPrincipal.toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Rente (Spild)</label>
                    <span class="val negative">-${stats.totalInterest.toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <section class="asset-grid">
            <div class="asset-card-main">
                <h3>Opret nyt lån</h3>
                <form id="loan-form">
                    <div class="input-group">
                        <label>Navn (f.eks. Billån, Huslån)</label>
                        <input type="text" id="loan-name" required>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Hovedstol (kr.)</label>
                            <input type="number" id="loan-principal" required>
                        </div>
                        <div class="input-group">
                            <label>Årlig rente (%)</label>
                            <input type="number" id="loan-interest" step="0.01" required>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Mdl. Ydelse (kr.)</label>
                            <input type="number" id="loan-payment" required>
                        </div>
                        <div class="input-group">
                            <label>Startmåned</label>
                            <input type="month" id="loan-start" required>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Ejer</label>
                        <select id="loan-owner">
                            <option value="user1">Mig</option>
                            <option value="user2">Kæreste</option>
                            <option value="shared">Fælles</option>
                        </select>
                    </div>
                    <button type="submit" class="btn-submit">Gem lån</button>
                </form>
            </div>

            <div class="asset-card-main">
                <h3>Dine aktive lån</h3>
                <ul id="loan-list" class="loan-display-list">
                    ${renderLoanList(loans)}
                </ul>
            </div>
        </section>
    `;

    setupLoanForm(container);
}

function calculateGlobalStats(loans) {
    const now = new Date().toISOString().slice(0, 7);
    let totalDebt = 0;
    let totalInterest = 0;
    let totalPrincipal = 0;
    let furthestDate = "";

    loans.forEach(loan => {
        const calc = calculateLoanForMonth(loan, now);
        if (calc) {
            totalDebt += calc.remainingBalance;
            totalInterest += calc.interest;
            totalPrincipal += calc.principalPaid;
            
            const endDate = getLoanEndDate(loan);
            if (endDate > furthestDate) furthestDate = endDate;
        }
    });

    const freedomDateStr = furthestDate ? new Date(furthestDate + "-01").toLocaleDateString('da-DK', {month: 'long', year: 'numeric'}) : "N/A";

    return {
        totalDebt,
        totalInterest,
        totalPrincipal,
        freedomDate: freedomDateStr
    };
}

function renderLoanList(loans) {
    if (!loans.length) return "<li>Ingen lån endnu</li>";
    return loans.map(loan => `
        <li class="loan-item">
            <div class="loan-info">
                <strong>${loan.name}</strong>
                <span>${loan.interestRate}% rente • ${loan.monthlyPayment.toLocaleString()} kr./mdr.</span>
            </div>
            <button class="btn-del-small" data-id="${loan.id}">✕</button>
        </li>
    `).join('');
}

function setupLoanForm(container) {
    const form = document.getElementById('loan-form');
    form.onsubmit = async (e) => {
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

    container.querySelectorAll('.btn-del-small').forEach(btn => {
        btn.onclick = async () => {
            if (confirm('Slet lån?')) {
                await deleteLoan(btn.dataset.id);
                renderAssets(container);
            }
        };
    });
}
