import { addLoan, getLoans, deleteLoan } from "../services/loanService.js";

export async function renderAssets(container) {
    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <p>Styr på lån, friværdi og opsparing</p>
        </header>

        <section class="asset-grid">
            <div class="asset-card-main">
                <h3>Tilføj nyt lån</h3>
                <form id="loan-form">
                    <div class="input-group">
                        <label>Navn på lån (f.eks. Billån)</label>
                        <input type="text" id="loan-name" placeholder="Bil, Hus, Bank..." required>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Nuværende gæld (kr.)</label>
                            <input type="number" id="loan-principal" placeholder="108000" required>
                        </div>
                        <div class="input-group">
                            <label>Rente pr. år (%)</label>
                            <input type="number" id="loan-interest" step="0.01" placeholder="8" required>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group">
                            <label>Månedlig ydelse (kr.)</label>
                            <input type="number" id="loan-payment" placeholder="8050" required>
                        </div>
                        <div class="input-group">
                            <label>Startdato (fra hvornår?)</label>
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
                    <button type="submit" class="btn-submit">Opret lån</button>
                </form>
            </div>

            <div class="asset-card-main">
                <h3>Aktive Lån</h3>
                <ul id="loan-list" class="data-list">
                    <li class="loading">Henter lån...</li>
                </ul>
            </div>
        </section>
    `;

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

    loadLoans();
}

async function loadLoans() {
    const list = document.getElementById('loan-list');
    const loans = await getLoans();
    
    list.innerHTML = loans.length ? "" : "<li>Ingen lån oprettet endnu.</li>";
    
    loans.forEach(loan => {
        const li = document.createElement('li');
        li.className = 'list-item-asset';
        li.innerHTML = `
            <div class="asset-info">
                <strong>${loan.name}</strong>
                <span>Gæld: ${loan.principal.toLocaleString()} kr. @ ${loan.interestRate}%</span>
            </div>
            <button class="btn-del" data-id="${loan.id}">✕</button>
        `;
        li.querySelector('.btn-del').onclick = async () => {
            if(confirm('Slet dette lån?')) {
                await deleteLoan(loan.id);
                loadLoans();
            }
        };
        list.appendChild(li);
    });
}
