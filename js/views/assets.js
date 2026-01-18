import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth } from "../services/loanService.js";

// State for simulatoren (Gemmes ikke i Firestore)
let simulationState = {
    monthsOffset: 0,
    ghostLoans: []
};

let selectedLoanId = null;
let currentTab = 'total';
let editingLoanId = null;

export async function renderAssets(container) {
    const realLoans = await getLoans();
    const allLoans = [...realLoans, ...simulationState.ghostLoans];
    
    // Beregn stats for både nuværende og simuleret fremtid
    const statsNow = calculateStats(allLoans, 0);
    const statsFuture = calculateStats(allLoans, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-simulator" class="btn-outline ${simulationState.monthsOffset > 0 || simulationState.ghostLoans.length > 0 ? 'active-sim' : ''}">
                    ${simulationState.monthsOffset > 0 ? 'Simulator Aktiv' : 'Åbn Simulator'}
                </button>
                <button id="toggle-loan-form" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <!-- SIMULATOR PANEL -->
        <section id="simulator-panel" class="simulator-box" style="display: ${simulationState.monthsOffset > 0 || simulationState.ghostLoans.length > 0 ? 'block' : 'none'};">
            <div class="sim-header">
                <h3>Økonomisk Simulator</h3>
                <button id="reset-sim" class="btn-text-small">Nulstil alt</button>
            </div>
            <div class="sim-controls">
                <div class="input-group">
                    <label>Se fremtiden: <span id="months-display">${simulationState.monthsOffset}</span> måneder</label>
                    <input type="range" id="sim-months-slider" min="0" max="120" value="${simulationState.monthsOffset}">
                </div>
                <button id="add-ghost-loan" class="btn-outline-small">+ Tilføj test-lån (f.eks. bil)</button>
            </div>
            
            <div class="sim-comparison">
                <div class="sim-card">
                    <label>Status i dag</label>
                    <div class="val">${Math.round(statsNow.displayDebt).toLocaleString()} kr.</div>
                </div>
                <div class="sim-card highlight">
                    <label>Status om ${simulationState.monthsOffset} mdr.</label>
                    <div class="val">${Math.round(statsFuture.displayDebt).toLocaleString()} kr.</div>
                    <small>Forskelsværdi: ${Math.round(statsFuture.displayDebt - statsNow.displayDebt).toLocaleString()} kr.</small>
                </div>
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Min Andel</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <section class="debt-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Lån' : 'Forventet Gæld (Simuleret)'}</label>
                <div class="debt-value">${Math.round(statsFuture.displayDebt).toLocaleString()} kr.</div>
                <p class="debt-date">Forventet gældsfri: <strong>${statsFuture.displayDate}</strong></p>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Vis alle lån</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Opsparing (Afdrag)</label>
                    <span class="val positive">+${Math.round(statsFuture.displayPrincipal).toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Tab (Rente)</label>
                    <span class="val negative">-${Math.round(statsFuture.displayInterest).toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <!-- FORMULAR TIL LÅN (Både ægte og simulation) -->
        <div id="loan-form-container" class="form-drawer" style="display:none;">
            <div class="asset-card-main">
                <h3 id="loan-form-title">Opret nyt lån</h3>
                <form id="loan-form">
                    <input type="hidden" id="loan-is-ghost" value="false">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="loan-name" placeholder="f.eks. Ny Bil" required></div>
                        <div class="input-group"><label>Gæld nu (kr.)</label><input type="number" id="loan-principal" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Rente (%)</label><input type="number" id="loan-interest" step="0.01" required></div>
                        <div class="input-group"><label>Mdl. Ydelse (kr.)</label><input type="number" id="loan-payment" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Startmåned</label><input type="month" id="loan-start" value="${new Date().toISOString().slice(0, 7)}" required></div>
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
            <h3 class="section-title">Aktive lån & Simulationer</h3>
            <div class="loan-cards-grid">
                ${allLoans.map(loan => `
                    <div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''} ${loan.isGhost ? 'ghost-card' : ''}" data-id="${loan.id}">
                        <div class="loan-card-info">
                            <h4>${loan.name} ${loan.isGhost ? '<span class="sim-badge">TEST</span>' : ''}</h4>
                            <p>${loan.owner === 'shared' ? 'Fælles' : (loan.owner === 'user1' ? 'Mig' : 'Kæreste')}</p>
                        </div>
                        <div class="loan-card-meta">
                            <span class="loan-amount">${loan.monthlyPayment.toLocaleString()} kr/mdr</span>
                            <div class="card-actions">
                                <button class="btn-edit-minimal" data-edit="${loan.id}" data-ghost="${loan.isGhost}">✎</button>
                                <button class="btn-del-minimal" data-delete="${loan.id}" data-ghost="${loan.isGhost}">✕</button>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;
    setupEvents(container, realLoans);
}

function calculateStats(loans, monthsOffset) {
    const today = new Date();
    today.setMonth(today.getMonth() + monthsOffset);
    const targetMonthStr = today.toISOString().slice(0, 7);

    let debt = 0, int = 0, princ = 0, maxD = "";
    
    // Hvis et lån er valgt, beregn kun for det. Ellers for alle.
    const targets = selectedLoanId ? loans.filter(l => l.id === selectedLoanId) : loans;
    
    targets.forEach(loan => {
        const isUser = currentTab !== 'total';
        if (isUser && loan.owner !== currentTab && loan.owner !== 'shared') return;
        
        const calc = calculateLoanForMonth(loan, targetMonthStr);
        if (calc) {
            let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
            debt += calc.remainingBalance * m;
            int += calc.interest * m;
            princ += calc.principalPaid * m;
            
            const end = getLoanEndDate(loan); 
            if (end > maxD) maxD = end;
        }
    });

    return { 
        displayDebt: debt, 
        displayInterest: int, 
        displayPrincipal: princ, 
        displayDate: maxD ? new Date(maxD + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'}) : "N/A" 
    };
}

function setupEvents(container, realLoans) {
    // Simulator events
    const slider = document.getElementById('sim-months-slider');
    if (slider) {
        slider.oninput = (e) => {
            simulationState.monthsOffset = parseInt(e.target.value);
            document.getElementById('months-display').innerText = simulationState.monthsOffset;
            renderAssets(container);
        };
    }

    document.getElementById('toggle-simulator').onclick = () => {
        const panel = document.getElementById('simulator-panel');
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    };

    document.getElementById('reset-sim').onclick = () => {
        simulationState.monthsOffset = 0;
        simulationState.ghostLoans = [];
        renderAssets(container);
    };

    document.getElementById('add-ghost-loan').onclick = () => {
        editingLoanId = null;
        document.getElementById('loan-form').reset();
        document.getElementById('loan-is-ghost').value = "true";
        document.getElementById('loan-form-title').innerText = "Tilføj Test-lån (Simulation)";
        document.getElementById('loan-form-container').style.display = 'block';
    };

    // Standard events
    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { currentTab = btn.dataset.tab; renderAssets(container); });
    
    document.getElementById('toggle-loan-form').onclick = () => { 
        editingLoanId = null; 
        document.getElementById('loan-form').reset(); 
        document.getElementById('loan-is-ghost').value = "false";
        document.getElementById('loan-form-title').innerText = "Opret nyt lån"; 
        document.getElementById('loan-form-container').style.display = 'block'; 
    };
    
    document.getElementById('close-form').onclick = () => document.getElementById('loan-form-container').style.display = 'none';
    
    container.querySelectorAll('.loan-summary-card').forEach(card => card.onclick = (e) => { 
        if (e.target.closest('button')) return; 
        selectedLoanId = selectedLoanId === card.dataset.id ? null : card.dataset.id; 
        renderAssets(container); 
    });

    if (document.getElementById('clear-selection')) document.getElementById('clear-selection').onclick = () => { selectedLoanId = null; renderAssets(container); };

    // Edit og Delete håndtering for både ægte og ghost lån
    container.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => {
        const isGhost = btn.dataset.ghost === "true";
        const loan = isGhost 
            ? simulationState.ghostLoans.find(l => l.id === btn.dataset.edit)
            : realLoans.find(l => l.id === btn.dataset.edit);
            
        editingLoanId = loan.id;
        document.getElementById('loan-form-title').innerText = isGhost ? "Rediger test-lån" : "Rediger lån";
        document.getElementById('loan-is-ghost').value = isGhost ? "true" : "false";
        document.getElementById('loan-name').value = loan.name;
        document.getElementById('loan-principal').value = loan.principal;
        document.getElementById('loan-interest').value = loan.interestRate;
        document.getElementById('loan-payment').value = loan.monthlyPayment;
        document.getElementById('loan-start').value = loan.startDate;
        document.getElementById('loan-owner').value = loan.owner;
        document.getElementById('loan-form-container').style.display = 'block';
    });

    container.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => {
        const isGhost = btn.dataset.ghost === "true";
        if (confirm(isGhost ? 'Fjern test-lån fra simulation?' : 'Slet rigtigt lån permanent?')) {
            if (isGhost) {
                simulationState.ghostLoans = simulationState.ghostLoans.filter(l => l.id !== btn.dataset.delete);
            } else {
                await deleteLoan(btn.dataset.delete);
            }
            renderAssets(container);
        }
    });

    document.getElementById('loan-form').onsubmit = async (e) => {
        e.preventDefault();
        const isGhost = document.getElementById('loan-is-ghost').value === "true";
        const data = {
            id: editingLoanId || (isGhost ? "ghost-" + Date.now() : null),
            name: document.getElementById('loan-name').value,
            principal: parseFloat(document.getElementById('loan-principal').value),
            interestRate: parseFloat(document.getElementById('loan-interest').value),
            monthlyPayment: parseFloat(document.getElementById('loan-payment').value),
            startDate: document.getElementById('loan-start').value,
            owner: document.getElementById('loan-owner').value,
            isGhost: isGhost
        };

        if (isGhost) {
            if (editingLoanId) {
                const idx = simulationState.ghostLoans.findIndex(l => l.id === editingLoanId);
                simulationState.ghostLoans[idx] = data;
            } else {
                simulationState.ghostLoans.push(data);
            }
        } else {
            if (editingLoanId) await updateLoan(editingLoanId, data); else await addLoan(data);
        }
        
        document.getElementById('loan-form-container').style.display = 'none';
        renderAssets(container);
    };
}
