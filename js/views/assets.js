import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset } from "../services/loanService.js";

// Lokal tilstand for simulatoren
let simulationState = { monthsOffset: 0, ghostLoans: [] };
let selectedLoanId = null;
let currentTab = 'total'; // 'total', 'user1', 'user2'
let showAssetForm = false;
let editingLoanId = null;

export async function renderAssets(container) {
    const realLoans = await getLoans();
    const assets = await getAssets();
    const allLoans = [...realLoans, ...simulationState.ghostLoans];
    
    // Beregn de samlede stats baseret på den valgte fane og simuleret tidsforskydning
    const stats = calculateComprehensiveStats(allLoans, assets, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-simulator" class="btn-outline ${simulationState.monthsOffset > 0 ? 'active-sim' : ''}">
                    ${simulationState.monthsOffset > 0 ? 'Simulator Aktiv' : 'Åbn Simulator'}
                </button>
                <button id="add-asset-btn" class="btn-outline">+ Nyt Aktiv</button>
                <button id="toggle-loan-form" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <!-- SIMULATOR PANEL -->
        <section id="simulator-panel" class="simulator-box" style="display: ${simulationState.monthsOffset > 0 ? 'block' : 'none'};">
            <div class="sim-header">
                <h3>Økonomisk Simulator</h3>
                <button id="reset-sim" class="btn-text-small">Nulstil alt</button>
            </div>
            <div class="sim-controls">
                <label>Se fremtiden: <span id="months-display">${simulationState.monthsOffset}</span> mdr.</label>
                <input type="range" id="sim-months-slider" min="0" max="120" value="${simulationState.monthsOffset}">
            </div>
        </section>

        <!-- FANER (TAB NAVIGATION) -->
        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <!-- DASHBOARD OVERBLIK -->
        <section class="net-worth-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Gældspost' : 'Netto Formue'}</label>
                <div class="debt-value">${Math.round(selectedLoanId ? stats.selectedLoanDebt : stats.netWorth).toLocaleString()} kr.</div>
                <div class="equity-split">
                    <span>Værdi: ${Math.round(stats.totalAssets).toLocaleString()} kr.</span>
                    <span>Gæld: ${Math.round(stats.totalDebt).toLocaleString()} kr.</span>
                </div>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Vis alle</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Vækst (Afdrag)</label>
                    <span class="val positive">+${Math.round(stats.monthlyGrowth).toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Tab (Værditab)</label>
                    <span class="val negative">-${Math.round(stats.monthlyDepreciation).toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <!-- FORMULAR: AKTIVER -->
        <div id="asset-form-container" class="form-drawer" style="display: ${showAssetForm ? 'block' : 'none'};">
            <div class="asset-card-main">
                <h3>Registrer nyt aktiv</h3>
                <form id="asset-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="asset-name" placeholder="f.eks. Tesla Model 3" required></div>
                        <div class="input-group"><label>Værdi i dag (kr.)</label><input type="number" id="asset-value" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Forventet mdl. værditab (kr.)</label><input type="number" id="asset-depr" value="0"></div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="asset-owner">
                                <option value="user1">Mig</option>
                                <option value="user2">Kæreste</option>
                                <option value="shared" selected>Fælles (50/50)</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-group">
                        <label>Link til lån (valgfrit)</label>
                        <select id="asset-loan-link">
                            <option value="">Intet lån</option>
                            ${realLoans.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-asset-form" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem Aktiv</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- FORMULAR: LÅN -->
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
                        <div class="input-group"><label>Startmåned</label><input type="month" id="loan-start" value="${new Date().toISOString().slice(0, 7)}" required></div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="loan-owner">
                                <option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared">Fælles (50/50)</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-loan-form" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem lån</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- LISTE OVER AKTIVER -->
        <section class="asset-list-section">
            <h3 class="section-title">Dine Aktiver & Friværdi</h3>
            <div class="loan-cards-grid">
                ${assets.filter(a => currentTab === 'total' || a.owner === currentTab || a.owner === 'shared').map(asset => {
                    const linkedLoan = realLoans.find(l => l.id === asset.linkedLoanId);
                    const months = simulationState.monthsOffset;
                    const currentVal = asset.value - (months * (asset.monthlyDepreciation || 0));
                    
                    const loanCalc = linkedLoan ? calculateLoanForMonth(linkedLoan, getOffsetMonth(months)) : null;
                    const debt = loanCalc ? loanCalc.remainingBalance : 0;
                    
                    // Beregn andel
                    let m = (currentTab !== 'total' && asset.owner === 'shared') ? 0.5 : 1;
                    const equity = (currentVal - debt) * m;
                    
                    return `
                        <div class="loan-summary-card asset-card">
                            <div class="loan-card-info">
                                <h4>${asset.name}</h4>
                                <small>Ejer: ${asset.owner === 'shared' ? 'Fælles' : (asset.owner === 'user1' ? 'Mig' : 'Kæreste')}</small><br>
                                <small>Friværdi: <strong>${Math.round(equity).toLocaleString()} kr.</strong> ${m < 1 ? '(50% andel)' : ''}</small>
                            </div>
                            <div class="loan-card-meta">
                                <span class="val ${equity > 0 ? 'positive' : 'negative'}">${Math.round(currentVal * m).toLocaleString()} kr.</span>
                                <button class="btn-del-minimal" data-delete-asset="${asset.id}">✕</button>
                            </div>
                        </div>
                    `;
                }).join('')}
                ${assets.length === 0 ? '<p class="text-light">Ingen aktiver fundet.</p>' : ''}
            </div>
        </section>

        <!-- LISTE OVER LÅN -->
        <section class="loan-list-section">
            <h3 class="section-title">Gældsposter</h3>
            <div class="loan-cards-grid">
                ${allLoans.filter(l => currentTab === 'total' || l.owner === currentTab || l.owner === 'shared').map(loan => {
                    const isUser = currentTab !== 'total';
                    let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
                    const calc = calculateLoanForMonth(loan, getOffsetMonth(simulationState.monthsOffset));
                    const balance = calc ? calc.remainingBalance : 0;
                    
                    return `
                        <div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''} ${loan.isGhost ? 'ghost-card' : ''}" data-id="${loan.id}">
                            <div class="loan-card-info">
                                <h4>${loan.name} ${loan.isGhost ? '<span class="sim-badge">TEST</span>' : ''}</h4>
                                <p>${loan.owner === 'shared' ? 'Fælles' : (loan.owner === 'user1' ? 'Mig' : 'Kæreste')} ${m < 1 ? '(50% andel)' : ''}</p>
                                <small>Restgæld: ${Math.round(balance * m).toLocaleString()} kr.</small>
                            </div>
                            <div class="loan-card-meta">
                                <span class="loan-amount">${Math.round(loan.monthlyPayment * m).toLocaleString()} kr/mdr</span>
                                <div class="card-actions">
                                    <button class="btn-edit-minimal" data-edit="${loan.id}" data-ghost="${loan.isGhost}">✎</button>
                                    <button class="btn-del-minimal" data-delete="${loan.id}" data-ghost="${loan.isGhost}">✕</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
                ${allLoans.length === 0 ? '<p class="text-light">Ingen lån fundet.</p>' : ''}
            </div>
        </section>
    `;
    setupEvents(container, realLoans, assets);
}

function getOffsetMonth(offset) {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 7);
}

function calculateComprehensiveStats(loans, assets, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset);
    const isUser = currentTab !== 'total';
    
    let totalDebt = 0, totalAssets = 0, monthlyGrowth = 0, monthlyDepr = 0, selectedLoanDebt = 0;

    loans.forEach(l => {
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        let m = (isUser && l.owner === 'shared') ? 0.5 : 1;

        const c = calculateLoanForMonth(l, targetMonth);
        if (c) {
            totalDebt += c.remainingBalance * m;
            monthlyGrowth += c.principalPaid * m;
            if (l.id === selectedLoanId) selectedLoanDebt = c.remainingBalance * m;
        }
    });

    assets.forEach(a => {
        if (isUser && a.owner !== currentTab && a.owner !== 'shared') return;
        let m = (isUser && a.owner === 'shared') ? 0.5 : 1;

        const valNow = a.value - (monthsOffset * (a.monthlyDepreciation || 0));
        totalAssets += Math.max(0, valNow * m);
        monthlyDepr += (a.monthlyDepreciation || 0) * m;
    });

    return { 
        totalDebt, 
        totalAssets, 
        netWorth: totalAssets - totalDebt, 
        monthlyGrowth, 
        monthlyDepreciation: monthlyDepr,
        selectedLoanDebt
    };
}

function setupEvents(container, realLoans, assets) {
    // Simulator events
    const slider = document.getElementById('sim-months-slider');
    if (slider) {
        slider.oninput = (e) => {
            simulationState.monthsOffset = parseInt(e.target.value);
            document.getElementById('months-display').innerText = simulationState.monthsOffset;
            renderAssets(container);
        };
    }

    document.getElementById('reset-sim').onclick = () => {
        simulationState.monthsOffset = 0;
        simulationState.ghostLoans = [];
        renderAssets(container);
    };

    document.getElementById('toggle-simulator').onclick = () => {
        const panel = document.getElementById('simulator-panel');
        const isHidden = panel.style.display === 'none';
        panel.style.display = isHidden ? 'block' : 'none';
        if (!isHidden) { simulationState.monthsOffset = 0; renderAssets(container); }
    };

    // Tab skift (Filtrering)
    container.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            currentTab = btn.dataset.tab;
            renderAssets(container);
        };
    });

    // Asset Formular
    document.getElementById('add-asset-btn').onclick = () => { showAssetForm = true; renderAssets(container); };
    document.getElementById('close-asset-form').onclick = () => { showAssetForm = false; renderAssets(container); };
    
    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        await addAsset({
            name: document.getElementById('asset-name').value,
            value: parseFloat(document.getElementById('asset-value').value),
            monthlyDepreciation: parseFloat(document.getElementById('asset-depr').value),
            linkedLoanId: document.getElementById('asset-loan-link').value,
            owner: document.getElementById('asset-owner').value
        });
        showAssetForm = false;
        renderAssets(container);
    };

    // Lån Formular
    document.getElementById('toggle-loan-form').onclick = () => {
        editingLoanId = null;
        document.getElementById('loan-form').reset();
        document.getElementById('loan-form-title').innerText = "Opret nyt lån";
        document.getElementById('loan-form-container').style.display = 'block';
    };
    document.getElementById('close-loan-form').onclick = () => document.getElementById('loan-form-container').style.display = 'none';

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
        if (editingLoanId) await updateLoan(editingLoanId, data);
        else await addLoan(data);
        document.getElementById('loan-form-container').style.display = 'none';
        renderAssets(container);
    };

    // Actions
    container.querySelectorAll('[data-delete-asset]').forEach(btn => btn.onclick = async () => {
        if (confirm('Slet dette aktiv permanent?')) { await deleteAsset(btn.dataset.deleteAsset); renderAssets(container); }
    });

    container.querySelectorAll('.loan-summary-card').forEach(card => card.onclick = (e) => {
        if (e.target.closest('button')) return;
        selectedLoanId = selectedLoanId === card.dataset.id ? null : card.dataset.id;
        renderAssets(container);
    });

    if (document.getElementById('clear-selection')) {
        document.getElementById('clear-selection').onclick = () => { selectedLoanId = null; renderAssets(container); };
    }

    container.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = () => {
        const loan = realLoans.find(l => l.id === btn.dataset.edit);
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

    container.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async () => {
        if (confirm('Slet dette lån permanent?')) { await deleteLoan(btn.dataset.delete); renderAssets(container); }
    });
}
