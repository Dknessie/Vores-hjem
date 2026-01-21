import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset, updateAsset, calculateTotalInterest } from "../services/loanService.js";
import { getBudgetPosts } from "../services/budgetService.js";

// State for denne visning
let simulationState = { 
    monthsOffset: 0, 
    customPayment: {}, 
    expandedLoanId: null // Holder styr på hvilken gældspost der er åben i simulatoren
};

let currentTab = 'total';
let editingItemId = null;

/**
 * Hovedfunktion til at rendre Formue & Gæld visningen
 */
export async function renderAssets(container) {
    const realLoans = await getLoans();
    const assets = await getAssets();
    const budgetPosts = await getBudgetPosts();
    
    // Beregn de omfattende statistikker baseret på simulation og filter
    const stats = calculateComprehensiveStats(realLoans, assets, budgetPosts, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <div>
                <h1>Formue & Gæld</h1>
                <p class="subtitle">Administrer husstandens balancer og simuler fremtiden</p>
            </div>
            <div class="header-actions">
                <button id="open-asset-modal" class="btn-outline">+ Nyt Aktiv</button>
                <button id="open-loan-modal" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <!-- STICKY COMMAND CENTER (Overbliksbaren) -->
        <section class="sticky-command-center">
            <div class="command-grid">
                <div class="command-stat">
                    <label>Netto Formue (${simulationState.monthsOffset === 0 ? 'Nu' : '+' + simulationState.monthsOffset + ' mdr.'})</label>
                    <div class="big-val ${stats.netWorth >= 0 ? 'positive' : 'negative'}">
                        ${Math.round(stats.netWorth).toLocaleString()} kr.
                    </div>
                </div>
                
                <div class="command-slider-box">
                    <div class="slider-header">
                        <label>Tidsrejse: <strong>${simulationState.monthsOffset} måneder</strong> frem</label>
                        <button id="reset-sim-btn" class="btn-text-link" ${simulationState.monthsOffset === 0 ? 'disabled' : ''}>Nulstil</button>
                    </div>
                    <input type="range" id="global-time-slider" min="0" max="120" value="${simulationState.monthsOffset}">
                </div>

                <div class="command-mini-stats">
                    <div class="mini-stat">
                        <label>Mdl. Vækst</label>
                        <span class="val positive">+${Math.round(stats.monthlyGrowth).toLocaleString()} kr.</span>
                    </div>
                    <div class="mini-stat">
                        <label>Mdl. Rente/Tab</label>
                        <span class="val negative">-${Math.round(stats.monthlyLoss).toLocaleString()} kr.</span>
                    </div>
                </div>
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Hele Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <!-- DUAL COLUMN LAYOUT -->
        <div class="dual-column-grid">
            
            <!-- VENSTRE SØJLE: AKTIVER -->
            <section class="asset-column">
                <div class="column-header">
                    <h3>Aktiver & Investeringer</h3>
                    <span class="total-badge">${Math.round(stats.totalAssets).toLocaleString()} kr.</span>
                </div>
                <div class="assets-list">
                    ${renderAssetCards(assets, budgetPosts)}
                </div>
            </section>

            <!-- HØJRE SØJLE: GÆLD -->
            <section class="debt-column">
                <div class="column-header">
                    <h3>Gæld & Forpligtelser</h3>
                    <span class="total-badge danger">${Math.round(stats.totalDebt).toLocaleString()} kr.</span>
                </div>
                <div class="loans-list">
                    ${renderLoanCards(realLoans)}
                </div>
            </section>

        </div>

        <!-- MODALS (Samme logik som før, men holdes klar) -->
        <div id="asset-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="asset-modal-title">Rediger Aktiv</h2>
                <form id="asset-form">
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="asset-name" required placeholder="f.eks. Bil eller Hus"></div>
                        <div class="input-group"><label>Type</label>
                            <select id="asset-type">
                                <option value="physical">Fysisk aktiv (Værditab)</option>
                                <option value="investment">Opsparing/Investering (Afkast)</option>
                            </select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Værdi nu (kr.)</label><input type="number" id="asset-value" required></div>
                        <div id="dynamic-asset-field" class="input-group">
                            <label id="asset-change-label">Mdl. Værditab (kr.)</label>
                            <input type="number" id="asset-change-val" value="0">
                        </div>
                    </div>
                    <div class="input-row">
                         <div class="input-group"><label>Link til opsparingspost</label>
                            <select id="asset-budget-link">
                                <option value="">Ingen (Kun manuel værdi)</option>
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
                            <button type="submit" class="btn-submit">Gem Aktiv</button>
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
                        <div class="input-group"><label>Navn på lån</label><input type="text" id="loan-name" required placeholder="f.eks. Realkredit"></div>
                        <div class="input-group"><label>Restgæld nu (kr.)</label><input type="number" id="loan-principal" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Rente (% pr. år)</label><input type="number" id="loan-interest" step="0.01" required></div>
                        <div class="input-group"><label>Mdl. Ydelse (kr.)</label><input type="number" id="loan-payment" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Startdato (første afdrag)</label><input type="month" id="loan-start" required></div>
                        <div class="input-group"><label>Knyt til aktiv</label>
                            <select id="loan-asset-link">
                                <option value="">Intet aktiv (Forbrugslån)</option>
                                ${assets.map(a => `<option value="${a.id}">${a.name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="input-group"><label>Hvem betaler?</label>
                        <select id="loan-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles (50/50)</option></select>
                    </div>
                    <div class="modal-buttons">
                        <div class="main-modal-actions">
                            <button type="button" id="close-loan-modal" class="btn-danger-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem Lån</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    setupEvents(container, realLoans, assets);
}

/**
 * Hjælpefunktion til at rendre aktiver
 */
function renderAssetCards(assets, budgetPosts) {
    return assets
        .filter(a => currentTab === 'total' || a.owner === currentTab || a.owner === 'shared')
        .map(asset => {
            const months = simulationState.monthsOffset;
            const budgetPost = budgetPosts.find(p => p.id === asset.linkedBudgetPostId);
            const monthlyContr = budgetPost ? budgetPost.amount : 0;
            
            let valFuture = asset.value;
            if (asset.type === 'investment') {
                const r = (asset.changeValue || 0) / 100 / 12;
                valFuture = asset.value * Math.pow(1 + r, months) + monthlyContr * (r === 0 ? months : ((Math.pow(1 + r, months) - 1) / r));
            } else {
                valFuture = Math.max(0, asset.value - (months * (asset.changeValue || 0)));
            }

            return `
                <div class="asset-item-card" data-id="${asset.id}">
                    <div class="item-main">
                        <div class="item-info">
                            <span class="item-type-icon">${asset.type === 'investment' ? '💰' : '🏠'}</span>
                            <div>
                                <h4>${asset.name}</h4>
                                <small>${asset.owner === 'shared' ? 'Fælles' : (asset.owner === 'user1' ? 'Mig' : 'Kæreste')}</small>
                            </div>
                        </div>
                        <div class="item-value">
                            <div class="val">${Math.round(valFuture).toLocaleString()} kr.</div>
                            <div class="change ${asset.type === 'investment' ? 'up' : 'down'}">
                                ${asset.type === 'investment' ? '+' : '-'}${Math.round(asset.changeValue).toLocaleString()} ${asset.type === 'investment' ? '%' : 'kr'}/mdr
                            </div>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit-minimal" data-edit-id="${asset.id}" data-type="asset">✎</button>
                        <button class="btn-del-minimal" data-del-id="${asset.id}" data-type="asset">✕</button>
                    </div>
                </div>
            `;
        }).join('') || '<p class="empty-msg">Ingen aktiver tilføjet endnu.</p>';
}

/**
 * Hjælpefunktion til at rendre gældsposter med indbygget simulator
 */
function renderLoanCards(loans) {
    return loans
        .filter(l => currentTab === 'total' || l.owner === currentTab || l.owner === 'shared')
        .map(loan => {
            const isUser = currentTab !== 'total'; 
            let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
            
            // Brug simuleret ydelse hvis den findes
            const currentPay = simulationState.customPayment[loan.id] || loan.monthlyPayment;
            const simLoan = { ...loan, monthlyPayment: currentPay };
            
            const targetMonth = getOffsetMonth(simulationState.monthsOffset);
            const c = calculateLoanForMonth(simLoan, targetMonth);
            const isExpanded = simulationState.expandedLoanId === loan.id;
            
            // Beregn fremskridt
            const paidPct = Math.min(100, ((loan.principal - (c ? c.remainingBalance : 0)) / loan.principal) * 100);
            const endDate = getLoanEndDate(simLoan);

            return `
                <div class="loan-item-card ${isExpanded ? 'expanded' : ''}" data-id="${loan.id}">
                    <div class="item-main clickable-loan-header" data-id="${loan.id}">
                        <div class="item-info">
                            <span class="item-type-icon">💸</span>
                            <div>
                                <h4>${loan.name} ${loan.assetLinkId ? '<small class="link-badge">⛓ Knyttet til aktiv</small>' : ''}</h4>
                                <small>Restgæld: ${Math.round(c ? c.remainingBalance * m : 0).toLocaleString()} kr.</small>
                            </div>
                        </div>
                        <div class="item-value">
                            <div class="val">${Math.round(currentPay * m).toLocaleString()} kr/mdr</div>
                            <div class="progress-container">
                                <div class="progress-fill" style="width: ${paidPct}%"></div>
                            </div>
                        </div>
                    </div>

                    ${isExpanded ? `
                        <div class="loan-simulator-inline">
                            <div class="sim-row">
                                <div class="sim-input-group">
                                    <label>Justér månedlig ydelse:</label>
                                    <input type="range" class="inline-rate-slider" data-id="${loan.id}" 
                                        min="${Math.round(loan.monthlyPayment * 0.2)}" 
                                        max="${Math.round(loan.monthlyPayment * 4)}" 
                                        value="${currentPay}">
                                    <div class="slider-labels">
                                        <span>Mindre</span>
                                        <strong>${Math.round(currentPay).toLocaleString()} kr.</strong>
                                        <span>Mere</span>
                                    </div>
                                </div>
                                <div class="sim-result-group">
                                    <label>Gældsfri dato:</label>
                                    <div class="end-date-val">${endDate === 'Aldrig' ? '♾ Aldrig' : new Date(endDate + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'})}</div>
                                </div>
                            </div>
                            <div class="sim-actions">
                                <button class="btn-edit-minimal" data-edit-id="${loan.id}" data-type="loan">Rediger detaljer ✎</button>
                                <button class="btn-del-minimal" data-del-id="${loan.id}" data-type="loan">Slet lån ✕</button>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('') || '<p class="empty-msg">Ingen gældsposter fundet.</p>';
}

/**
 * Event-håndtering
 */
function setupEvents(container, realLoans, assets) {
    // Tids-slider
    document.getElementById('global-time-slider')?.addEventListener('input', (e) => {
        simulationState.monthsOffset = parseInt(e.target.value);
        renderAssets(container);
    });

    // Nulstil simulation
    document.getElementById('reset-sim-btn')?.addEventListener('click', () => {
        simulationState.monthsOffset = 0;
        simulationState.customPayment = {};
        simulationState.expandedLoanId = null;
        renderAssets(container);
    });

    // Tab-skift
    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => {
        currentTab = btn.dataset.tab;
        renderAssets(container);
    });

    // Fold lån ud/ind for simulation
    container.querySelectorAll('.clickable-loan-header').forEach(header => {
        header.onclick = () => {
            const id = header.dataset.id;
            simulationState.expandedLoanId = (simulationState.expandedLoanId === id) ? null : id;
            renderAssets(container);
        };
    });

    // Inline slider i gældskort
    container.querySelectorAll('.inline-rate-slider').forEach(slider => {
        slider.oninput = (e) => {
            const id = slider.dataset.id;
            simulationState.customPayment[id] = parseInt(e.target.value);
            // Vi bruger en hurtigere opdatering her for performance
            renderAssets(container);
        };
    });

    // CRUD Event Listeners (Forenklet)
    document.getElementById('open-asset-modal').onclick = () => { editingItemId = null; document.getElementById('asset-form').reset(); document.getElementById('asset-modal').style.display = 'flex'; };
    document.getElementById('open-loan-modal').onclick = () => { editingItemId = null; document.getElementById('loan-form').reset(); document.getElementById('loan-modal').style.display = 'flex'; };
    document.getElementById('close-asset-modal').onclick = () => document.getElementById('asset-modal').style.display = 'none';
    document.getElementById('close-loan-modal').onclick = () => document.getElementById('loan-modal').style.display = 'none';

    // Edit/Delete ikoner
    container.querySelectorAll('[data-edit-id]').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.editId;
        if (btn.dataset.type === 'loan') {
            const item = realLoans.find(l => l.id === id);
            editingItemId = id;
            document.getElementById('loan-name').value = item.name;
            document.getElementById('loan-principal').value = item.principal;
            document.getElementById('loan-interest').value = item.interestRate;
            document.getElementById('loan-payment').value = item.monthlyPayment;
            document.getElementById('loan-start').value = item.startDate;
            document.getElementById('loan-asset-link').value = item.assetLinkId || "";
            document.getElementById('loan-owner').value = item.owner;
            document.getElementById('loan-modal').style.display = 'flex';
        } else {
            const item = assets.find(a => a.id === id);
            editingItemId = id;
            document.getElementById('asset-name').value = item.name;
            document.getElementById('asset-type').value = item.type;
            document.getElementById('asset-value').value = item.value;
            document.getElementById('asset-change-val').value = item.changeValue;
            document.getElementById('asset-budget-link').value = item.linkedBudgetPostId || "";
            document.getElementById('asset-owner').value = item.owner;
            document.getElementById('asset-modal').style.display = 'flex';
        }
    });

    // Form submits
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

/**
 * Hjælpefunktioner til beregning
 */
function getOffsetMonth(offset) { const d = new Date(); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 7); }

function calculateComprehensiveStats(loans, assets, budgetPosts, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset); 
    const isUser = currentTab !== 'total';
    let totalDebt = 0, totalAssets = 0, monthlyGrowth = 0, monthlyLoss = 0;

    loans.forEach(l => {
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
        const currentPay = simulationState.customPayment[l.id] || l.monthlyPayment;
        const simLoan = { ...l, monthlyPayment: currentPay };
        const c = calculateLoanForMonth(simLoan, targetMonth);
        if (c) { 
            totalDebt += c.remainingBalance * m; 
            monthlyGrowth += c.principalPaid * m; 
            monthlyLoss += c.interest * m; 
        }
    });

    assets.forEach(a => {
        if (isUser && a.owner !== currentTab && a.owner !== 'shared') return;
        let m = (isUser && a.owner === 'shared') ? 0.5 : 1;
        const budgetPost = budgetPosts.find(p => p.id === a.linkedBudgetPostId);
        const PMT = budgetPost ? budgetPost.amount : 0;
        
        let valFuture = a.value;
        if (a.type === 'investment') {
            const r = (a.changeValue || 0) / 100 / 12;
            valFuture = a.value * Math.pow(1 + r, monthsOffset) + PMT * (r === 0 ? monthsOffset : ((Math.pow(1 + r, monthsOffset) - 1) / r));
            monthlyGrowth += (valFuture * r + PMT) * m;
        } else {
            valFuture = Math.max(0, a.value - (monthsOffset * (a.changeValue || 0)));
            monthlyLoss += (a.changeValue || 0) * m;
        }
        totalAssets += valFuture * m;
    });
    return { totalDebt, totalAssets, netWorth: totalAssets - totalDebt, monthlyGrowth, monthlyLoss };
}
