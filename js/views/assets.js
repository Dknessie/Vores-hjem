import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset, updateAsset } from "../services/loanService.js";
import { getBudgetPosts } from "../services/budgetService.js";

// State for denne visning
let simulationState = { 
    monthsOffset: 0, 
    customPayment: {}, 
    expandedLoanId: null 
};

let currentTab = 'total';
let editingItemId = null;

// Standard kategorier fra budgettet til brug i lån
const budgetCategories = {
    faste: "Faste udgifter",
    transport: "Transport",
    ovrige: "Øvrige faste",
    opsparing: "Opsparing"
};

/**
 * Hovedfunktion til at rendre Formue & Gæld visningen
 */
export async function renderAssets(container) {
    const realLoans = await getLoans();
    const assets = await getAssets();
    const budgetPosts = await getBudgetPosts();
    
    const stats = calculateComprehensiveStats(realLoans, assets, budgetPosts, simulationState.monthsOffset);

    container.innerHTML = `
        <header class="view-header">
            <div class="header-title-group">
                <h1>Formue & Gæld</h1>
                <p class="subtitle">Få overblik over husstandens balance og vækst</p>
            </div>
            <div class="header-actions">
                <button id="open-asset-modal" class="btn-outline">+ Nyt Aktiv</button>
                <button id="open-loan-modal" class="btn-add">+ Nyt lån</button>
            </div>
        </header>

        <section class="sticky-command-center">
            <div class="command-grid">
                <div class="command-stat main-stat">
                    <label>Netto Formue (${simulationState.monthsOffset === 0 ? 'Nu' : '+' + simulationState.monthsOffset + ' mdr.'})</label>
                    <div class="big-val ${stats.netWorth >= 0 ? 'positive' : 'negative'}">
                        ${Math.round(stats.netWorth).toLocaleString()} kr.
                    </div>
                </div>
                
                <div class="command-slider-box">
                    <div class="slider-header">
                        <label>Tidssimulering: <strong>${simulationState.monthsOffset} mdr.</strong></label>
                        <button id="reset-sim-btn" class="btn-text-link" ${simulationState.monthsOffset === 0 && Object.keys(simulationState.customPayment).length === 0 ? 'disabled' : ''}>Nulstil simulation</button>
                    </div>
                    <input type="range" id="global-time-slider" min="0" max="120" value="${simulationState.monthsOffset}">
                    <div class="slider-labels"><span>Nu</span><span>5 år</span><span>10 år</span></div>
                </div>

                <div class="command-mini-stats">
                    <div class="mini-stat">
                        <label>Samlet Vækst</label>
                        <span class="val positive">+${Math.round(stats.monthlyGrowth).toLocaleString()} kr./md.</span>
                    </div>
                    <div class="mini-stat">
                        <label>Renteomkostninger</label>
                        <span class="val negative">-${Math.round(stats.monthlyLoss).toLocaleString()} kr./md.</span>
                    </div>
                </div>
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <div class="dual-column-grid">
            <section class="asset-column">
                <div class="column-header">
                    <h3>Aktiver & Opsparing</h3>
                    <span class="total-badge">${Math.round(stats.totalAssets).toLocaleString()} kr.</span>
                </div>
                <div class="assets-list">
                    ${renderAssetCards(assets, budgetPosts)}
                </div>
            </section>

            <section class="debt-column">
                <div class="column-header">
                    <h3>Gæld & Lån</h3>
                    <span class="total-badge danger">${Math.round(stats.totalDebt).toLocaleString()} kr.</span>
                </div>
                <div class="loans-list">
                    ${renderLoanCards(realLoans)}
                </div>
            </section>
        </div>

        <div id="asset-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="asset-modal-title">Nyt Aktiv</h2>
                <form id="asset-form">
                    <div class="input-group"><label>Navn</label><input type="text" id="asset-name" required></div>
                    <div class="input-row">
                        <div class="input-group"><label>Type</label>
                            <select id="asset-type">
                                <option value="investment">Investering / Bolig</option>
                                <option value="physical">Fysisk aktiv</option>
                            </select>
                        </div>
                        <div class="input-group"><label>Værdi nu (kr.)</label><input type="number" id="asset-value" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label id="asset-change-label">Årlig vækstrate (%)</label><input type="number" id="asset-change-val" step="0.1" value="0"></div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="asset-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option></select>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" id="delete-asset-btn" class="btn-danger-outline" style="display:none;">Slet</button>
                        <div class="main-modal-actions">
                            <button type="button" id="close-asset-modal" class="btn-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem Aktiv</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <div id="loan-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="loan-modal-title">Nyt Lån</h2>
                <form id="loan-form">
                    <div class="input-group"><label>Navn på lån</label><input type="text" id="loan-name" required placeholder="f.eks. Peugeot 208"></div>
                    <div class="input-row">
                        <div class="input-group"><label>Restgæld nu (kr.)</label><input type="number" id="loan-principal" required></div>
                        <div class="input-group"><label>Rente (% p.a.)</label><input type="number" id="loan-interest" step="0.01" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Mdl. Ydelse (kr.)</label><input type="number" id="loan-payment" required></div>
                        <div class="input-group"><label>Kategori i budget</label>
                            <select id="loan-category">
                                ${Object.keys(budgetCategories).map(key => `<option value="${key}">${budgetCategories[key]}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Startmåned</label><input type="month" id="loan-start" required></div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="loan-owner">
                                <option value="user1">Mig</option>
                                <option value="user2">Kæreste</option>
                                <option value="shared" selected>Fælles</option>
                            </select>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" id="delete-loan-btn-modal" class="btn-danger-outline" style="display:none;">Slet</button>
                        <div class="main-modal-actions">
                            <button type="button" id="close-loan-modal" class="btn-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem Lån</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
    setupEvents(container, realLoans, assets);
}

function renderAssetCards(assets, budgetPosts) {
    return assets
        .filter(a => currentTab === 'total' || a.owner === currentTab || a.owner === 'shared')
        .map(asset => {
            const months = simulationState.monthsOffset;
            const budgetPost = budgetPosts.find(p => p.id === asset.linkedBudgetPostId);
            const monthlyContr = budgetPost ? budgetPost.amount : 0;
            
            let valFuture = asset.value;
            if (asset.type === 'investment') {
                const annualR = (asset.changeValue || 0) / 100;
                const monthlyR = Math.pow(1 + annualR, 1/12) - 1;
                if (monthlyR === 0) valFuture = asset.value + (monthlyContr * months);
                else valFuture = asset.value * Math.pow(1 + monthlyR, months) + monthlyContr * ((Math.pow(1 + monthlyR, months) - 1) / monthlyR);
            } else {
                valFuture = Math.max(0, asset.value - (months * (asset.changeValue || 0)));
            }

            return `
                <div class="asset-item-card">
                    <div class="item-main">
                        <div class="item-info">
                            <div class="item-type-icon">${asset.type === 'investment' ? '📈' : '🚗'}</div>
                            <div>
                                <h4>${asset.name}</h4>
                                <small>${asset.owner === 'shared' ? 'Fælles' : (asset.owner === 'user1' ? 'Mig' : 'Kæreste')}</small>
                            </div>
                        </div>
                        <div class="item-value">
                            <div class="val">${Math.round(valFuture).toLocaleString()} kr.</div>
                            <div class="change ${asset.type === 'investment' ? 'up' : 'down'}">
                                ${asset.type === 'investment' ? '+' + asset.changeValue + '%' : '-' + asset.changeValue + ' kr.'}
                            </div>
                        </div>
                    </div>
                    <div class="item-actions">
                        <button class="btn-edit-minimal" data-edit-id="${asset.id}" data-type="asset">✎ Rediger</button>
                        <button class="btn-del-minimal" data-del-id="${asset.id}" data-type="asset">✕ Slet</button>
                    </div>
                </div>
            `;
        }).join('') || '<p class="empty-msg">Ingen aktiver registreret.</p>';
}

function renderLoanCards(loans) {
    return loans
        .filter(l => currentTab === 'total' || l.owner === currentTab || l.owner === 'shared')
        .map(loan => {
            const isUser = currentTab !== 'total'; 
            let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
            const currentPay = simulationState.customPayment[loan.id] || loan.monthlyPayment;
            const simLoan = { ...loan, monthlyPayment: currentPay };
            const c = calculateLoanForMonth(simLoan, getOffsetMonth(simulationState.monthsOffset));
            const isExpanded = simulationState.expandedLoanId === loan.id;
            const paidPct = Math.min(100, ((loan.principal - (c ? c.remainingBalance : 0)) / loan.principal) * 100);
            const endDate = getLoanEndDate(simLoan);

            return `
                <div class="loan-item-card ${isExpanded ? 'expanded' : ''}">
                    <div class="item-main clickable-loan-header" data-id="${loan.id}">
                        <div class="item-info">
                            <div class="item-type-icon">🏦</div>
                            <div>
                                <h4>${loan.name}</h4>
                                <small>Restgæld: ${Math.round(c ? c.remainingBalance * m : 0).toLocaleString()} kr.</small>
                            </div>
                        </div>
                        <div class="item-value">
                            <div class="val">${Math.round(currentPay * m).toLocaleString()} kr./md.</div>
                            <div class="progress-container"><div class="progress-fill" style="width: ${paidPct}%"></div></div>
                        </div>
                    </div>
                    ${isExpanded ? `
                        <div class="loan-simulator-inline">
                            <div class="sim-content">
                                <div class="sim-row">
                                    <div class="sim-input-group">
                                        <label>Simuler ændret afdrag (mdl. ydelse):</label>
                                        <input type="range" class="inline-rate-slider" data-id="${loan.id}" min="${Math.round(loan.monthlyPayment * 0.5)}" max="${Math.round(loan.monthlyPayment * 5)}" value="${currentPay}">
                                        <div class="slider-labels"><span>-50%</span><strong>${Math.round(currentPay).toLocaleString()} kr.</strong><span>+400%</span></div>
                                    </div>
                                    <div class="sim-result-group">
                                        <label>Forventet gældsfri:</label>
                                        <div class="end-date-val">${endDate === 'Aldrig' ? 'Uendelig' : new Date(endDate + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'})}</div>
                                    </div>
                                </div>
                                <div class="sim-actions-bar">
                                    <div class="sim-info-text">Simulation påvirker kun overblikket indtil du gemmer.</div>
                                    <div class="sim-buttons">
                                        <button class="btn-danger-outline" data-del-id="${loan.id}" data-type="loan">Slet lån</button>
                                        <button class="btn-outline" data-edit-id="${loan.id}" data-type="loan">Rediger detaljer</button>
                                        <button class="btn-submit save-sim-btn" data-id="${loan.id}">Gem ny ydelse</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('') || '<p class="empty-msg">Ingen gældsposter fundet.</p>';
}

function setupEvents(container, realLoans, assets) {
    document.getElementById('global-time-slider')?.addEventListener('input', (e) => {
        simulationState.monthsOffset = parseInt(e.target.value);
        renderAssets(container);
    });

    document.getElementById('reset-sim-btn')?.addEventListener('click', () => {
        simulationState.monthsOffset = 0;
        simulationState.customPayment = {};
        renderAssets(container);
    });

    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => {
        currentTab = btn.dataset.tab;
        renderAssets(container);
    });

    container.querySelectorAll('.clickable-loan-header').forEach(header => {
        header.onclick = () => {
            const id = header.dataset.id;
            simulationState.expandedLoanId = (simulationState.expandedLoanId === id) ? null : id;
            renderAssets(container);
        };
    });

    container.querySelectorAll('.inline-rate-slider').forEach(slider => {
        slider.oninput = (e) => {
            simulationState.customPayment[slider.dataset.id] = parseInt(e.target.value);
            const stats = calculateComprehensiveStats(realLoans, assets, [], simulationState.monthsOffset);
            document.querySelector('.big-val').innerText = Math.round(stats.netWorth).toLocaleString() + ' kr.';
            slider.nextElementSibling.querySelector('strong').innerText = Math.round(e.target.value).toLocaleString() + ' kr.';
        };
        slider.onchange = () => renderAssets(container); 
    });

    container.querySelectorAll('.save-sim-btn').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            const id = btn.dataset.id;
            const newPayment = simulationState.customPayment[id];
            if (!newPayment) return;
            const loan = realLoans.find(l => l.id === id);
            if (confirm(`Vil du gemme ${Math.round(newPayment).toLocaleString()} kr. som din nye faste månedlige ydelse for ${loan.name}?`)) {
                await updateLoan(id, { ...loan, monthlyPayment: newPayment });
                delete simulationState.customPayment[id];
                renderAssets(container);
            }
        };
    });

    document.getElementById('open-asset-modal').onclick = () => { editingItemId = null; document.getElementById('asset-form').reset(); document.getElementById('delete-asset-btn').style.display = "none"; document.getElementById('asset-modal').style.display = 'flex'; };
    document.getElementById('open-loan-modal').onclick = () => { editingItemId = null; document.getElementById('loan-form').reset(); document.getElementById('delete-loan-btn-modal').style.display = "none"; document.getElementById('loan-modal').style.display = 'flex'; };
    document.getElementById('close-asset-modal').onclick = () => document.getElementById('asset-modal').style.display = 'none';
    document.getElementById('close-loan-modal').onclick = () => document.getElementById('loan-modal').style.display = 'none';

    container.querySelectorAll('[data-edit-id]').forEach(btn => btn.onclick = (e) => {
        e.stopPropagation();
        const id = btn.dataset.editId;
        editingItemId = id;
        if (btn.dataset.type === 'loan') {
            const item = realLoans.find(l => l.id === id);
            document.getElementById('loan-modal-title').innerText = "Rediger Lån";
            document.getElementById('loan-name').value = item.name;
            document.getElementById('loan-principal').value = item.principal;
            document.getElementById('loan-interest').value = item.interestRate;
            document.getElementById('loan-payment').value = item.monthlyPayment;
            document.getElementById('loan-category').value = item.category || 'faste';
            document.getElementById('loan-start').value = item.startDate;
            document.getElementById('loan-owner').value = item.owner;
            document.getElementById('delete-loan-btn-modal').style.display = "block";
            document.getElementById('loan-modal').style.display = 'flex';
        } else {
            const item = assets.find(a => a.id === id);
            document.getElementById('asset-modal-title').innerText = "Rediger Aktiv";
            document.getElementById('asset-name').value = item.name;
            document.getElementById('asset-type').value = item.type;
            document.getElementById('asset-value').value = item.value;
            document.getElementById('asset-change-val').value = item.changeValue;
            document.getElementById('asset-owner').value = item.owner;
            document.getElementById('delete-asset-btn').style.display = "block";
            document.getElementById('asset-modal').style.display = 'flex';
        }
    });

    container.querySelectorAll('[data-del-id]').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Slet permanent?')) {
            if (btn.dataset.type === 'loan') await deleteLoan(btn.dataset.delId);
            else await deleteAsset(btn.dataset.delId);
            renderAssets(container);
        }
    });

    document.getElementById('delete-asset-btn').onclick = async () => { if (editingItemId && confirm('Slet aktiv?')) { await deleteAsset(editingItemId); document.getElementById('asset-modal').style.display = 'none'; renderAssets(container); } };
    document.getElementById('delete-loan-btn-modal').onclick = async () => { if (editingItemId && confirm('Slet lån?')) { await deleteLoan(editingItemId); document.getElementById('loan-modal').style.display = 'none'; renderAssets(container); } };

    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        const d = { 
            name: document.getElementById('asset-name').value, 
            type: document.getElementById('asset-type').value, 
            value: parseFloat(document.getElementById('asset-value').value), 
            changeValue: parseFloat(document.getElementById('asset-change-val').value), 
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
            category: document.getElementById('loan-category').value,
            startDate: document.getElementById('loan-start').value, 
            owner: document.getElementById('loan-owner').value 
        };
        if (editingItemId) await updateLoan(editingItemId, d); else await addLoan(d);
        document.getElementById('loan-modal').style.display = 'none'; renderAssets(container);
    };
}

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
        let valFuture = a.value;
        if (a.type === 'investment') {
            const annualR = (a.changeValue || 0) / 100;
            const monthlyR = Math.pow(1 + annualR, 1/12) - 1;
            valFuture = a.value * Math.pow(1 + monthlyR, monthsOffset);
            monthlyGrowth += (valFuture * monthlyR) * m;
        } else {
            valFuture = Math.max(0, a.value - (monthsOffset * (a.changeValue || 0)));
            monthlyLoss += (a.changeValue || 0) * m;
        }
        totalAssets += valFuture * m;
    });
    return { totalDebt, totalAssets, netWorth: totalAssets - totalDebt, monthlyGrowth, monthlyLoss };
}
