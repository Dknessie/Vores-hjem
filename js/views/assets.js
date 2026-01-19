import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset } from "../services/loanService.js";

// Simulationstilstand (kun i hukommelsen)
let simulationState = { 
    monthsOffset: 0, 
    ghostLoans: [],
    customPayment: {} 
};

let selectedLoanId = null;
let currentTab = 'total';
let showAssetForm = false;
let editingLoanId = null;

export async function renderAssets(container) {
    const realLoans = await getLoans();
    const assets = await getAssets();
    const allLoans = [...realLoans, ...simulationState.ghostLoans];
    
    // Beregn stats baseret på simulation og valgte fane
    const stats = calculateComprehensiveStats(allLoans, assets, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-simulator" class="btn-outline ${simulationState.monthsOffset > 0 ? 'active-sim' : ''}">
                    ${simulationState.monthsOffset > 0 ? 'Simulator Aktiv' : 'Åbn Simulator'}
                </button>
                <button id="add-asset-btn" class="btn-outline">+ Nyt Aktiv/Opsparing</button>
                <button id="toggle-loan-form" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <section id="simulator-panel" class="simulator-box" style="display: ${simulationState.monthsOffset > 0 ? 'block' : 'none'};">
            <div class="sim-header">
                <h3>Global Tids-simulator</h3>
                <button id="reset-sim" class="btn-text-small">Nulstil alle simulationer</button>
            </div>
            <div class="sim-controls">
                <label>Se fremtiden: <span id="months-display">${simulationState.monthsOffset}</span> mdr.</label>
                <input type="range" id="sim-months-slider" min="0" max="120" value="${simulationState.monthsOffset}">
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Min Andel</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <section class="net-worth-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Gæld (Simuleret)' : 'Netto Formue (Simuleret)'}</label>
                <div class="debt-value">${Math.round(selectedLoanId ? stats.selectedLoanDebt : stats.netWorth).toLocaleString()} kr.</div>
                <div class="equity-split">
                    <span>Værdi: ${Math.round(stats.totalAssets).toLocaleString()} kr.</span>
                    <span>Gæld: ${Math.round(stats.totalDebt).toLocaleString()} kr.</span>
                </div>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Vis alle lån</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Vækst (Afdrag + Afkast)</label>
                    <span class="val positive">+${Math.round(stats.monthlyGrowth).toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Tab (Værditab + Rente)</label>
                    <span class="val negative">-${Math.round(stats.monthlyLoss).toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        ${selectedLoanId ? renderLoanSimulator(allLoans.find(l => l.id === selectedLoanId)) : ''}

        <!-- FORMULAR: AKTIV / OPSPARING -->
        <div id="asset-form-container" class="form-drawer" style="display: ${showAssetForm ? 'block' : 'none'};">
            <div class="asset-card-main">
                <h3>Registrer Aktiv eller Investering</h3>
                <form id="asset-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="asset-name" required placeholder="f.eks. Aktiedepot"></div>
                        <div class="input-group"><label>Type</label>
                            <select id="asset-type">
                                <option value="physical">Fysisk aktiv (f.eks. Bil/Hus)</option>
                                <option value="investment">Investering/Opsparing (Afkast)</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Værdi i dag</label><input type="number" id="asset-value" required></div>
                        <div id="dynamic-asset-field" class="input-group">
                            <!-- Ændres dynamisk via JS -->
                            <label>Mdl. Værditab (kr.)</label><input type="number" id="asset-change-val" value="0">
                        </div>
                    </div>
                    <div class="input-group"><label>Ejer</label>
                        <select id="asset-owner">
                            <option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-asset-form" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- FORMULAR: LÅN -->
        <div id="loan-form-container" class="form-drawer" style="display:none;">
            <div class="asset-card-main">
                <h3>Opret nyt lån</h3>
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
                        <div class="input-group"><label>Tilknyt Aktiv</label>
                            <select id="loan-asset-link">
                                <option value="">Intet aktiv</option>
                                ${assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="input-group"><label>Ejer</label>
                        <select id="loan-owner">
                            <option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option>
                        </select>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-loan-form" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem lån</button>
                    </div>
                </form>
            </div>
        </div>

        <section class="asset-list-section">
            <h3 class="section-title">Aktiver & Investeringer</h3>
            <div class="loan-cards-grid">
                ${assets.filter(a => currentTab === 'total' || a.owner === currentTab || a.owner === 'shared').map(asset => {
                    const linkedLoans = allLoans.filter(l => l.assetLinkId === asset.id);
                    const months = simulationState.monthsOffset;
                    
                    let currentVal = asset.value;
                    if (asset.type === 'investment') {
                        // Rentes rente: FV = PV * (1 + r)^n
                        const monthlyRate = (asset.changeValue || 0) / 100 / 12;
                        currentVal = asset.value * Math.pow(1 + monthlyRate, months);
                    } else {
                        currentVal = asset.value - (months * (asset.changeValue || 0));
                    }
                    
                    let totalDebtForAsset = 0;
                    linkedLoans.forEach(l => {
                        const loanCalc = calculateLoanForMonth(modifyLoanWithSim(l), getOffsetMonth(months));
                        if (loanCalc) totalDebtForAsset += loanCalc.remainingBalance;
                    });
                    
                    let m = (currentTab !== 'total' && asset.owner === 'shared') ? 0.5 : 1;
                    const equity = (currentVal - totalDebtForAsset) * m;
                    
                    return `
                        <div class="loan-summary-card asset-card">
                            <div class="loan-card-info">
                                <h4>${asset.name}</h4>
                                <small>${asset.type === 'investment' ? 'Investering' : 'Fysisk aktiv'}</small><br>
                                <small>Friværdi: <strong>${Math.round(equity).toLocaleString()} kr.</strong></small>
                            </div>
                            <div class="loan-card-meta">
                                <span class="val positive">${Math.round(currentVal * m).toLocaleString()} kr.</span>
                                <button class="btn-del-minimal" data-delete-asset="${asset.id}">✕</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </section>

        <section class="loan-list-section">
            <h3 class="section-title">Lån & Simulationer</h3>
            <div class="loan-cards-grid">
                ${allLoans.filter(l => currentTab === 'total' || l.owner === currentTab || l.owner === 'shared').map(loan => {
                    const isUser = currentTab !== 'total';
                    let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
                    const c = calculateLoanForMonth(modifyLoanWithSim(loan), getOffsetMonth(simulationState.monthsOffset));
                    return `
                        <div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''}" data-id="${loan.id}">
                            <div class="loan-card-info">
                                <h4>${loan.name}</h4>
                                <p>${loan.owner === 'shared' ? 'Fælles' : (loan.owner === 'user1' ? 'Mig' : 'Kæreste')}</p>
                                <small>Restgæld: ${Math.round(c ? c.remainingBalance * m : 0).toLocaleString()} kr.</small>
                            </div>
                            <div class="loan-card-meta">
                                <span class="loan-amount">${Math.round((simulationState.customPayment[loan.id] || loan.monthlyPayment) * m).toLocaleString()} kr/mdr</span>
                                <div class="card-actions">
                                    <button class="btn-edit-minimal" data-edit="${loan.id}">✎</button>
                                    <button class="btn-del-minimal" data-delete="${loan.id}">✕</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </section>
    `;
    setupEvents(container, realLoans, assets);
}

function renderLoanSimulator(loan) {
    if (!loan) return '';
    const currentPay = simulationState.customPayment[loan.id] || loan.monthlyPayment;
    const simLoan = modifyLoanWithSim(loan);
    const endDate = getLoanEndDate(simLoan);
    return `
        <section class="loan-detail-box">
            <div class="sim-header"><h3>Rate-simulator: ${loan.name}</h3><span class="badge-blue">Simulation</span></div>
            <div class="sim-controls">
                <div class="input-group">
                    <label>Mdl. Ydelse: <strong>${currentPay.toLocaleString()} kr.</strong></label>
                    <input type="range" id="rate-slider" min="${Math.round(loan.monthlyPayment * 0.5)}" max="${Math.round(loan.monthlyPayment * 3)}" value="${currentPay}">
                </div>
                <div class="sim-result">
                    <label>Forventet gældsfri:</label>
                    <div class="val-large">${new Date(endDate + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'})}</div>
                </div>
            </div>
        </section>
    `;
}

function modifyLoanWithSim(loan) {
    return { ...loan, monthlyPayment: simulationState.customPayment[loan.id] || loan.monthlyPayment };
}

function getOffsetMonth(offset) {
    const d = new Date(); d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 7);
}

function calculateComprehensiveStats(loans, assets, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset);
    const isUser = currentTab !== 'total';
    let totalDebt = 0, totalAssets = 0, monthlyGrowth = 0, monthlyLoss = 0, selectedLoanDebt = 0;

    loans.forEach(l => {
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
        const c = calculateLoanForMonth(modifyLoanWithSim(l), targetMonth);
        if (c) { 
            totalDebt += c.remainingBalance * m; 
            monthlyGrowth += c.principalPaid * m; 
            monthlyLoss += c.interest * m;
            if (l.id === selectedLoanId) selectedLoanDebt = c.remainingBalance * m;
        }
    });

    assets.forEach(a => {
        if (isUser && a.owner !== currentTab && a.owner !== 'shared') return;
        let m = (isUser && a.owner === 'shared') ? 0.5 : 1;
        
        let valNow = a.value;
        if (a.type === 'investment') {
            const monthlyRate = (a.changeValue || 0) / 100 / 12;
            valNow = a.value * Math.pow(1 + monthlyRate, monthsOffset);
            monthlyGrowth += (valNow * monthlyRate) * m; // Afkast tæller som vækst
        } else {
            valNow = a.value - (monthsOffset * (a.changeValue || 0));
            monthlyLoss += (a.changeValue || 0) * m;
        }
        totalAssets += Math.max(0, valNow * m);
    });

    return { totalDebt, totalAssets, netWorth: totalAssets - totalDebt, monthlyGrowth, monthlyLoss, selectedLoanDebt };
}

function setupEvents(container, realLoans, assets) {
    const simSlider = document.getElementById('sim-months-slider');
    if (simSlider) simSlider.oninput = (e) => { simulationState.monthsOffset = parseInt(e.target.value); document.getElementById('months-display').innerText = simulationState.monthsOffset; renderAssets(container); };
    
    const rateSlider = document.getElementById('rate-slider');
    if (rateSlider) rateSlider.oninput = (e) => { if (selectedLoanId) { simulationState.customPayment[selectedLoanId] = parseInt(e.target.value); renderAssets(container); } };
    
    document.getElementById('reset-sim').onclick = () => { simulationState.monthsOffset = 0; simulationState.customPayment = {}; renderAssets(container); };
    document.getElementById('toggle-simulator').onclick = () => { const p = document.getElementById('simulator-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; };

    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { currentTab = btn.dataset.tab; renderAssets(container); });

    // Håndter skift af aktiv type i form
    const typeSelect = document.getElementById('asset-type');
    if (typeSelect) typeSelect.onchange = (e) => {
        const field = document.getElementById('dynamic-asset-field');
        if (e.target.value === 'investment') {
            field.innerHTML = `<label>Forventet årligt afkast (%)</label><input type="number" id="asset-change-val" step="0.1" value="5">`;
        } else {
            field.innerHTML = `<label>Mdl. Værditab (kr.)</label><input type="number" id="asset-change-val" value="0">`;
        }
    };

    document.getElementById('add-asset-btn').onclick = () => { showAssetForm = true; renderAssets(container); };
    document.getElementById('close-asset-form').onclick = () => { showAssetForm = false; renderAssets(container); };

    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        await addAsset({
            name: document.getElementById('asset-name').value,
            type: document.getElementById('asset-type').value,
            value: parseFloat(document.getElementById('asset-value').value),
            changeValue: parseFloat(document.getElementById('asset-change-val').value),
            owner: document.getElementById('asset-owner').value
        });
        showAssetForm = false;
        renderAssets(container);
    };

    container.querySelectorAll('[data-delete-asset]').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Slet aktiv?')) { await deleteAsset(btn.dataset.deleteAsset); renderAssets(container); }
    });

    document.getElementById('toggle-loan-form').onclick = () => { editingLoanId = null; document.getElementById('loan-form').reset(); document.getElementById('loan-form-container').style.display = 'block'; };
    document.getElementById('close-loan-form').onclick = () => document.getElementById('loan-form-container').style.display = 'none';

    container.querySelectorAll('.loan-summary-card').forEach(card => card.onclick = (e) => {
        if (e.target.closest('button')) return;
        selectedLoanId = (selectedLoanId === card.dataset.id) ? null : card.dataset.id;
        renderAssets(container);
    });

    if (document.getElementById('clear-selection')) document.getElementById('clear-selection').onclick = () => { selectedLoanId = null; renderAssets(container); };

    container.querySelectorAll('[data-edit]').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        const loan = realLoans.find(l => l.id === btn.dataset.edit);
        editingLoanId = loan.id;
        document.getElementById('loan-name').value = loan.name;
        document.getElementById('loan-principal').value = loan.principal;
        document.getElementById('loan-interest').value = loan.interestRate;
        document.getElementById('loan-payment').value = loan.monthlyPayment;
        document.getElementById('loan-start').value = loan.startDate;
        document.getElementById('loan-asset-link').value = loan.assetLinkId || "";
        document.getElementById('loan-owner').value = loan.owner;
        document.getElementById('loan-form-container').style.display = 'block';
    });

    container.querySelectorAll('[data-delete]').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Slet lån?')) { await deleteLoan(btn.dataset.delete); renderAssets(container); }
    });

    document.getElementById('loan-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('loan-name').value,
            principal: parseFloat(document.getElementById('loan-principal').value),
            interestRate: parseFloat(document.getElementById('loan-interest').value),
            monthlyPayment: parseFloat(document.getElementById('loan-payment').value),
            startDate: document.getElementById('loan-start').value,
            assetLinkId: document.getElementById('loan-asset-link').value,
            owner: document.getElementById('loan-owner').value
        };
        if (editingLoanId) await updateLoan(editingLoanId, data); else await addLoan(data);
        document.getElementById('loan-form-container').style.display = 'none';
        renderAssets(container);
    };
}
