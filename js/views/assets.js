import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset } from "../services/loanService.js";

let simulationState = { monthsOffset: 0, ghostLoans: [] };
let selectedLoanId = null;
let currentTab = 'total';
let showAssetForm = false;

export async function renderAssets(container) {
    const realLoans = await getLoans();
    const assets = await getAssets();
    const allLoans = [...realLoans, ...simulationState.ghostLoans];
    
    // Beregn den samlede økonomiske status inkl. fremtidssimulering
    const statsFuture = calculateComprehensiveStats(allLoans, assets, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-simulator" class="btn-outline ${simulationState.monthsOffset > 0 ? 'active-sim' : ''}">Simulator</button>
                <button id="add-asset-btn" class="btn-outline">+ Nyt Aktiv</button>
                <button id="toggle-loan-form" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <!-- Simulator kontrolpanel -->
        <section id="simulator-panel" class="simulator-box" style="display: ${simulationState.monthsOffset > 0 ? 'block' : 'none'};">
            <div class="sim-controls">
                <label>Fremtid: <span id="months-display">${simulationState.monthsOffset}</span> mdr.</label>
                <input type="range" id="sim-months-slider" min="0" max="120" value="${simulationState.monthsOffset}">
                <button id="reset-sim" class="btn-text-small">Nulstil</button>
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <section class="net-worth-dashboard">
            <div class="main-debt-card">
                <label>Netto Formue (Simuleret)</label>
                <div class="debt-value">${Math.round(statsFuture.netWorth).toLocaleString()} kr.</div>
                <div class="equity-split">
                    <span>Aktiver: ${Math.round(statsFuture.totalAssets).toLocaleString()}</span>
                    <span>Gæld: ${Math.round(statsFuture.totalDebt).toLocaleString()}</span>
                </div>
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat">
                    <label>Mdl. Værditilvækst (Afdrag)</label>
                    <span class="val positive">+${Math.round(statsFuture.monthlyGrowth).toLocaleString()} kr.</span>
                </div>
                <div class="mini-stat">
                    <label>Mdl. Værditab (Depreciering)</label>
                    <span class="val negative">-${Math.round(statsFuture.monthlyDepreciation).toLocaleString()} kr.</span>
                </div>
            </div>
        </section>

        <!-- Formular til Registrering af Aktiver (f.eks. Bil) -->
        <div id="asset-form-container" class="form-drawer" style="display: ${showAssetForm ? 'block' : 'none'};">
            <div class="asset-card-main">
                <h3>Registrer Aktiv (Bil, Hus, etc.)</h3>
                <form id="asset-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="asset-name" placeholder="f.eks. Tesla Model 3" required></div>
                        <div class="input-group"><label>Værdi nu</label><input type="number" id="asset-value" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Mdl. Værditab (kr.)</label><input type="number" id="asset-depr" value="2000"></div>
                        <div class="input-group"><label>Link til lån</label>
                            <select id="asset-loan-link">
                                <option value="">Intet lån</option>
                                ${realLoans.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" id="close-asset-form" class="btn-text">Annuller</button>
                        <button type="submit" class="btn-submit">Gem Aktiv</button>
                    </div>
                </form>
            </div>
        </div>

        <section class="asset-list-section">
            <h3 class="section-title">Dine Aktiver & Friværdi</h3>
            <div class="loan-cards-grid">
                ${assets.map(asset => {
                    const linkedLoan = realLoans.find(l => l.id === asset.linkedLoanId);
                    const currentVal = asset.value - (simulationState.monthsOffset * (asset.monthlyDepreciation || 0));
                    const loanCalc = linkedLoan ? calculateLoanForMonth(linkedLoan, getOffsetMonth(simulationState.monthsOffset)) : null;
                    const debt = loanCalc ? loanCalc.remainingBalance : 0;
                    const equity = currentVal - debt;
                    
                    return `
                        <div class="loan-summary-card asset-card">
                            <div class="loan-card-info">
                                <h4>${asset.name}</h4>
                                <small>Friværdi: <strong>${Math.round(equity).toLocaleString()} kr.</strong></small>
                            </div>
                            <div class="loan-card-meta">
                                <span class="val ${equity > 0 ? 'positive' : 'negative'}">${Math.round(currentVal).toLocaleString()} kr.</span>
                                <button class="btn-del-minimal" data-delete-asset="${asset.id}">✕</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </section>
    `;
    setupEvents(container, realLoans);
}

function getOffsetMonth(offset) {
    const d = new Date(); d.setMonth(d.getMonth() + offset);
    return d.toISOString().slice(0, 7);
}

function calculateComprehensiveStats(loans, assets, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset);
    let totalDebt = 0, totalAssets = 0, monthlyGrowth = 0, monthlyDepr = 0;

    loans.forEach(l => {
        const c = calculateLoanForMonth(l, targetMonth);
        if (c) { totalDebt += c.remainingBalance; monthlyGrowth += c.principalPaid; }
    });

    assets.forEach(a => {
        const val = a.value - (monthsOffset * (a.monthlyDepreciation || 0));
        totalAssets += Math.max(0, val);
        monthlyDepr += (a.monthlyDepreciation || 0);
    });

    return { 
        totalDebt, 
        totalAssets, 
        netWorth: totalAssets - totalDebt, 
        monthlyGrowth, 
        monthlyDepreciation: monthlyDepr 
    };
}

function setupEvents(container, realLoans) {
    const slider = document.getElementById('sim-months-slider');
    if (slider) {
        slider.oninput = (e) => { 
            simulationState.monthsOffset = parseInt(e.target.value); 
            document.getElementById('months-display').innerText = simulationState.monthsOffset; 
            renderAssets(container); 
        };
    }
    
    document.getElementById('add-asset-btn').onclick = () => { showAssetForm = true; renderAssets(container); };
    document.getElementById('close-asset-form').onclick = () => { showAssetForm = false; renderAssets(container); };
    document.getElementById('toggle-simulator').onclick = () => { 
        simulationState.monthsOffset = simulationState.monthsOffset > 0 ? 0 : 1; 
        renderAssets(container); 
    };

    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        await addAsset({
            name: document.getElementById('asset-name').value,
            value: parseFloat(document.getElementById('asset-value').value),
            monthlyDepreciation: parseFloat(document.getElementById('asset-depr').value),
            linkedLoanId: document.getElementById('asset-loan-link').value,
            owner: 'shared'
        });
        showAssetForm = false;
        renderAssets(container);
    };

    container.querySelectorAll('[data-delete-asset]').forEach(btn => btn.onclick = async () => {
        if (confirm('Slet dette aktiv?')) { 
            await deleteAsset(btn.dataset.deleteAsset); 
            renderAssets(container); 
        }
    });

    // Her ville events for lån også blive tilføjet (edit/delete)
}
