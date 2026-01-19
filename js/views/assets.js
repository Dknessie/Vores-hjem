import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset, updateAsset, calculateTotalInterest } from "../services/loanService.js";
import { getBudgetPosts } from "../services/budgetService.js";

let simulationState = { monthsOffset: 0, ghostLoans: [], customPayment: {} };
let selectedLoanId = null;
let currentTab = 'total';
let editingItemId = null;

export async function renderAssets(container) {
    const realLoans = await getLoans();
    const assets = await getAssets();
    const budgetPosts = await getBudgetPosts();
    const allLoans = [...realLoans, ...simulationState.ghostLoans];
    
    const stats = calculateComprehensiveStats(allLoans, assets, budgetPosts, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <h1>Formue & Gæld</h1>
            <div class="header-actions">
                <button id="toggle-simulator" class="btn-outline ${simulationState.monthsOffset > 0 ? 'active-sim' : ''}">Tids-rejse</button>
                <button id="open-asset-modal" class="btn-outline">+ Nyt Aktiv</button>
                <button id="open-loan-modal" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <section id="simulator-panel" class="simulator-box" style="display: ${simulationState.monthsOffset > 0 ? 'block' : 'none'};">
            <div class="sim-header"><h3>Tids-simulator</h3><button id="reset-sim" class="btn-text-small">Nulstil alt</button></div>
            <div class="sim-controls">
                <label>Fremtid: <span id="months-display">${simulationState.monthsOffset}</span> mdr.</label>
                <input type="range" id="sim-months-slider" min="0" max="120" value="${simulationState.monthsOffset}">
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <section class="net-worth-dashboard">
            <div class="main-debt-card ${selectedLoanId ? 'focused' : ''}">
                <label>${selectedLoanId ? 'Valgt Gæld' : 'Netto Formue (Simuleret)'}</label>
                <div class="debt-value">${Math.round(selectedLoanId ? stats.selectedLoanDebt : stats.netWorth).toLocaleString()} kr.</div>
                <div class="equity-split">
                    <span>Værdi: ${Math.round(selectedLoanId ? stats.selectedLoanAssetVal : stats.totalAssets).toLocaleString()} kr.</span>
                    <span>Gæld: ${Math.round(selectedLoanId ? stats.selectedLoanDebt : stats.totalDebt).toLocaleString()} kr.</span>
                </div>
                ${selectedLoanId ? '<button id="clear-selection" class="btn-small-white">Vis samlet formue</button>' : ''}
            </div>
            <div class="debt-stats-grid">
                <div class="mini-stat"><label>Mdl. Vækst</label><span class="val positive">+${Math.round(stats.monthlyGrowth).toLocaleString()} kr.</span></div>
                <div class="mini-stat"><label>Mdl. Tab</label><span class="val negative">-${Math.round(stats.monthlyLoss).toLocaleString()} kr.</span></div>
            </div>
        </section>

        ${selectedLoanId ? renderLoanSimulator(allLoans.find(l => l.id === selectedLoanId)) : ''}

        <section class="asset-list-section">
            <h3 class="section-title">Aktiver & Investeringer</h3>
            <div class="loan-cards-grid">
                ${assets.filter(a => currentTab === 'total' || a.owner === currentTab || a.owner === 'shared').map(asset => {
                    const months = simulationState.monthsOffset;
                    // Find månedlig indbetaling fra budgettet
                    const budgetPost = budgetPosts.find(p => p.id === asset.linkedBudgetPostId);
                    const monthlyContr = budgetPost ? budgetPost.amount : 0;
                    
                    let valFuture = asset.value;
                    if (asset.type === 'investment') {
                        const r = (asset.changeValue || 0) / 100 / 12;
                        // FV = PV*(1+r)^n + PMT * (((1+r)^n - 1)/r)
                        valFuture = asset.value * Math.pow(1 + r, months) + monthlyContr * ((Math.pow(1 + r, months) - 1) / r);
                        if (r === 0) valFuture = asset.value + (monthlyContr * months);
                    } else {
                        valFuture = asset.value - (months * (asset.changeValue || 0));
                    }
                    
                    return `<div class="loan-summary-card asset-card clickable-card" data-id="${asset.id}" data-type="asset">
                        <div class="loan-card-info">
                            <h4>${asset.name}</h4>
                            <small>${asset.type === 'investment' ? 'Investering' : 'Fysisk aktiv'}</small>
                        </div>
                        <div class="loan-card-meta">
                            <span class="val positive">${Math.round(valFuture).toLocaleString()} kr.</span>
                            <div class="card-btn-group">
                                <button class="btn-edit-minimal" data-edit-id="${asset.id}" data-type="asset">✎</button>
                                <button class="btn-del-minimal" data-del-id="${asset.id}" data-type="asset">✕</button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </section>

        <section class="loan-list-section">
            <h3 class="section-title">Gældsposter</h3>
            <div class="loan-cards-grid">
                ${allLoans.filter(l => currentTab === 'total' || l.owner === currentTab || l.owner === 'shared').map(loan => {
                    const isUser = currentTab !== 'total'; 
                    let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
                    const c = calculateLoanForMonth(modifyLoanWithSim(loan), getOffsetMonth(simulationState.monthsOffset));
                    return `<div class="loan-summary-card ${selectedLoanId === loan.id ? 'active' : ''} clickable-card" data-id="${loan.id}" data-type="loan">
                        <div class="loan-card-info">
                            <h4>${loan.name}</h4>
                            <p>${loan.owner === 'shared' ? 'Fælles' : (loan.owner === 'user1' ? 'Mig' : 'Kæreste')}</p>
                            <small>Restgæld: ${Math.round(c ? c.remainingBalance * m : 0).toLocaleString()} kr.</small>
                        </div>
                        <div class="loan-card-meta">
                            <span class="loan-amount">${Math.round((simulationState.customPayment[loan.id] || loan.monthlyPayment) * m).toLocaleString()} kr/mdr</span>
                            <div class="card-btn-group">
                                <button class="btn-edit-minimal" data-edit-id="${loan.id}" data-type="loan">✎</button>
                                <button class="btn-del-minimal" data-del-id="${loan.id}" data-type="loan">✕</button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </section>

        <!-- MODALS -->
        <div id="asset-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="asset-modal-title">Rediger Aktiv</h2>
                <form id="asset-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="asset-name" required></div>
                        <div class="input-group"><label>Type</label>
                            <select id="asset-type"><option value="physical">Fysisk aktiv</option><option value="investment">Opsparing/Investering</option></select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Værdi nu</label><input type="number" id="asset-value" required></div>
                        <div id="dynamic-asset-field" class="input-group"><label>Mdl. Værditab (kr.)</label><input type="number" id="asset-change-val" value="0"></div>
                    </div>
                    <div class="input-row">
                         <div class="input-group"><label>Link til budget-opsparing</label>
                            <select id="asset-budget-link">
                                <option value="">Ingen (Indtastet manuelt)</option>
                                ${budgetPosts.filter(p => p.category === 'opsparing').map(p => `<option value="${p.id}">${p.title} (${p.amount} kr.)</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="asset-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option></select>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <div class="main-modal-actions">
                            <button type="button" id="close-asset-modal" class="btn-danger-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div id="loan-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="loan-modal-title">Rediger Lån</h2>
                <form id="loan-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="loan-name" required></div>
                        <div class="input-group"><label>Gæld nu</label><input type="number" id="loan-principal" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Rente (%)</label><input type="number" id="loan-interest" step="0.01" required></div>
                        <div class="input-group"><label>Mdl. Ydelse</label><input type="number" id="loan-payment" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Startmåned</label><input type="month" id="loan-start" required></div>
                        <div class="input-group"><label>Tilknyt Aktiv</label>
                            <select id="loan-asset-link"><option value="">Intet aktiv</option>${assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}</select>
                        </div>
                    </div>
                    <div class="input-group"><label>Ejer</label>
                        <select id="loan-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option></select>
                    </div>
                    <div class="modal-buttons">
                        <div class="main-modal-actions">
                            <button type="button" id="close-loan-modal" class="btn-danger-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    setupEvents(container, realLoans, assets);
}

function renderLoanSimulator(loan) {
    if (!loan) return '';
    const currentPay = simulationState.customPayment[loan.id] || loan.monthlyPayment;
    const simLoan = modifyLoanWithSim(loan);
    const endDate = getLoanEndDate(simLoan);
    
    // Beregn rente-besparelse
    const originalInterest = calculateTotalInterest(loan, loan.monthlyPayment);
    const simulatedInterest = calculateTotalInterest(loan, currentPay);
    const saved = originalInterest - simulatedInterest;

    return `
        <section class="loan-detail-box">
            <div class="sim-header">
                <h3>Rate-simulator: ${loan.name}</h3>
                ${saved > 0 ? `<span class="saved-badge">Sparer ${Math.round(saved).toLocaleString()} kr. i renter</span>` : ''}
            </div>
            <div class="sim-controls">
                <div class="input-group">
                    <label>Simuler Mdl. Ydelse: <strong>${currentPay.toLocaleString()} kr.</strong></label>
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

function modifyLoanWithSim(loan) { return { ...loan, monthlyPayment: simulationState.customPayment[loan.id] || loan.monthlyPayment }; }
function getOffsetMonth(offset) { const d = new Date(); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 7); }

function calculateComprehensiveStats(loans, assets, budgetPosts, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset); const isUser = currentTab !== 'total';
    let totalDebt = 0, totalAssets = 0, monthlyGrowth = 0, monthlyLoss = 0, selectedLoanDebt = 0, selectedLoanAssetVal = 0;

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
        
        // Find indbetaling fra linket budgetpost
        const budgetPost = budgetPosts.find(p => p.id === a.linkedBudgetPostId);
        const PMT = budgetPost ? budgetPost.amount : 0;
        
        let valFuture = a.value;
        if (a.type === 'investment') {
            const r = (a.changeValue || 0) / 100 / 12;
            valFuture = a.value * Math.pow(1 + r, monthsOffset) + PMT * ((Math.pow(1 + r, monthsOffset) - 1) / r);
            if (r === 0) valFuture = a.value + (PMT * monthsOffset);
            monthlyGrowth += (valFuture * r + PMT) * m;
        } else {
            valFuture = a.value - (monthsOffset * (a.changeValue || 0));
            monthlyLoss += (a.changeValue || 0) * m;
        }
        totalAssets += Math.max(0, valFuture * m);
        if (selectedLoanId) {
            const sel = loans.find(l => l.id === selectedLoanId);
            if (sel && sel.assetLinkId === a.id) selectedLoanAssetVal = valFuture * m;
        }
    });
    return { totalDebt, totalAssets, netWorth: totalAssets - totalDebt, monthlyGrowth, monthlyLoss, selectedLoanDebt, selectedLoanAssetVal };
}

function setupEvents(container, realLoans, assets) {
    document.getElementById('sim-months-slider')?.addEventListener('input', (e) => { simulationState.monthsOffset = parseInt(e.target.value); document.getElementById('months-display').innerText = simulationState.monthsOffset; renderAssets(container); });
    document.getElementById('rate-slider')?.addEventListener('input', (e) => { if (selectedLoanId) { simulationState.customPayment[selectedLoanId] = parseInt(e.target.value); renderAssets(container); } });
    document.getElementById('reset-sim')?.addEventListener('click', () => { simulationState.monthsOffset = 0; simulationState.customPayment = {}; selectedLoanId = null; renderAssets(container); });
    document.getElementById('toggle-simulator')?.addEventListener('click', () => { const p = document.getElementById('simulator-panel'); p.style.display = p.style.display === 'none' ? 'block' : 'none'; });
    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { currentTab = btn.dataset.tab; renderAssets(container); });
    document.getElementById('clear-selection')?.addEventListener('click', () => { selectedLoanId = null; renderAssets(container); });

    // Modals open
    document.getElementById('open-asset-modal').onclick = () => { editingItemId = null; document.getElementById('asset-form').reset(); document.getElementById('asset-modal-title').innerText = "Nyt Aktiv"; document.getElementById('asset-modal').style.display = 'flex'; };
    document.getElementById('open-loan-modal').onclick = () => { editingItemId = null; document.getElementById('loan-form').reset(); document.getElementById('loan-modal-title').innerText = "Nyt Lån"; document.getElementById('loan-modal').style.display = 'flex'; };
    document.getElementById('close-asset-modal').onclick = () => document.getElementById('asset-modal').style.display = 'none';
    document.getElementById('close-loan-modal').onclick = () => document.getElementById('loan-modal').style.display = 'none';

    // Klik på selve kortet for at vælge
    container.querySelectorAll('.clickable-card').forEach(card => card.onclick = (e) => {
        if (e.target.closest('button')) return;
        if (card.dataset.type === 'loan') {
            selectedLoanId = (selectedLoanId === card.dataset.id) ? null : card.dataset.id;
            renderAssets(container);
        } else {
            // Aktiver åbner stadig modal direkte da de ikke har rate-simulator
            openAssetEdit(card.dataset.id, assets);
        }
    });

    // Ikon-klik (Edit/Del)
    container.querySelectorAll('[data-edit-id]').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        if (btn.dataset.type === 'loan') openLoanEdit(btn.dataset.editId, realLoans);
        else openAssetEdit(btn.dataset.editId, assets);
    });

    container.querySelectorAll('[data-del-id]').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Slet permanent?')) {
            if (btn.dataset.type === 'loan') { await deleteLoan(btn.dataset.delId); selectedLoanId = null; }
            else await deleteAsset(btn.dataset.delId);
            renderAssets(container);
        }
    });

    // Form Submits
    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        const d = { 
            name: document.getElementById('asset-name').value, 
            type: document.getElementById('asset-type').value, 
            value: parseFloat(document.getElementById('asset-value').value), 
            changeValue: parseFloat(document.getElementById('asset-change-val').value), 
            linkedBudgetPostId: document.getElementById('asset-budget-link').value,
            owner: document.getElementById('asset-owner').value 
        };
        if (editingItemId) await updateAsset(editingItemId, d); else await addAsset(d);
        document.getElementById('asset-modal').style.display = 'none'; renderAssets(container);
    };

    document.getElementById('loan-form').onsubmit = async (e) => {
        e.preventDefault();
        const d = { 
            name: document.getElementById('loan-name').value, 
            principal: parseFloat(document.getElementById('loan-principal').value), 
            interestRate: parseFloat(document.getElementById('loan-interest').value), 
            monthlyPayment: parseFloat(document.getElementById('loan-payment').value), 
            startDate: document.getElementById('loan-start').value, 
            assetLinkId: document.getElementById('loan-asset-link').value, 
            owner: document.getElementById('loan-owner').value 
        };
        if (editingItemId) await updateLoan(editingItemId, d); else await addLoan(d);
        document.getElementById('loan-modal').style.display = 'none'; renderAssets(container);
    };
}

function openAssetEdit(id, assets) {
    const item = assets.find(a => a.id === id);
    if (!item) return;
    editingItemId = item.id;
    document.getElementById('asset-modal-title').innerText = "Rediger Aktiv";
    document.getElementById('asset-name').value = item.name;
    document.getElementById('asset-type').value = item.type || 'physical';
    document.getElementById('asset-value').value = item.value;
    document.getElementById('asset-change-val').value = item.changeValue || 0;
    document.getElementById('asset-budget-link').value = item.linkedBudgetPostId || "";
    document.getElementById('asset-owner').value = item.owner;
    document.getElementById('asset-modal').style.display = 'flex';
}

function openLoanEdit(id, loans) {
    const item = loans.find(l => l.id === id);
    if (!item) return;
    editingItemId = item.id;
    document.getElementById('loan-modal-title').innerText = "Rediger Lån";
    document.getElementById('loan-name').value = item.name;
    document.getElementById('loan-principal').value = item.principal;
    document.getElementById('loan-interest').value = item.interestRate;
    document.getElementById('loan-payment').value = item.monthlyPayment;
    document.getElementById('loan-start').value = item.startDate;
    document.getElementById('loan-asset-link').value = item.assetLinkId || "";
    document.getElementById('loan-owner').value = item.owner;
    document.getElementById('loan-modal').style.display = 'flex';
}
