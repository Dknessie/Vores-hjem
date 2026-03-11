import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset, updateAsset, getTimeUntilDebtFree, addImprovement, getImprovements, deleteImprovement } from "../services/loanService.js";

// Lokal state til simulation og visning
let simulationState = { 
    monthsOffset: 0, 
    customPayment: {}, 
    expandedLoanId: null,
    expandedAssetId: null 
};

let currentTab = 'total';
let editingItemId = null;
let currentAssetForImprovement = null;

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
    const improvements = await getImprovements();
    
    const stats = calculateComprehensiveStats(realLoans, assets, improvements, simulationState.monthsOffset);

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

        <!-- SIMULATIONS CENTER -->
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

        <section class="graph-section card">
            <div class="section-bar-modern">
                <h3>Formue-prognose (10 år)</h3>
                <div class="graph-legend">
                    <span class="legend-item"><i style="background: var(--success-green);"></i> Aktiver</span>
                    <span class="legend-item"><i style="background: var(--danger-bright);"></i> Gæld</span>
                    <span class="legend-item"><i style="background: var(--accent-blue);"></i> Netto</span>
                </div>
            </div>
            <div class="graph-container" style="position: relative; height: 300px; width: 100%;">
                <canvas id="projection-graph"></canvas>
            </div>
        </section>

        <div class="dual-column-grid">
            <!-- VENSTRE: AKTIVER MED INVESTERINGS-LOG -->
            <section class="asset-column">
                <div class="column-header">
                    <h3>Aktiver & Opsparing</h3>
                    <span class="total-badge">${Math.round(stats.totalAssets).toLocaleString()} kr.</span>
                </div>
                <div class="assets-list">
                    ${renderAssetCards(assets, realLoans, improvements)}
                </div>
            </section>

            <!-- HØJRE: GÆLD MED LEVENDE BARER -->
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

        <!-- MODAL FOR FORBEDRINGER / BOLIGINVESTERINGER -->
        <div id="improvement-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2>Ny investering i hjemmet</h2>
                <p class="subtitle" id="improvement-asset-name"></p>
                <form id="improvement-form">
                    <div class="input-group"><label>Titel på forbedring</label><input type="text" id="imp-title" required placeholder="f.eks. Ny trappe eller Solceller"></div>
                    <div class="input-row">
                        <div class="input-group"><label>Beløb (kr.)</label><input type="number" id="imp-amount" required></div>
                        <div class="input-group"><label>Dato</label><input type="date" id="imp-date" required></div>
                    </div>
                    <div class="modal-buttons">
                        <div class="main-modal-actions">
                            <button type="button" id="close-imp-modal" class="btn-outline">Annuller</button>
                            <button type="submit" class="btn-submit">Gem investering</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>

        <!-- MODAL FOR AKTIVER -->
        <div id="asset-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="asset-modal-title">Nyt Aktiv</h2>
                <form id="asset-form">
                    <div class="input-group"><label>Navn</label><input type="text" id="asset-name" required placeholder="f.eks. Hus eller Peugeot 208"></div>
                    <div class="input-row">
                        <div class="input-group"><label>Type</label>
                            <select id="asset-type">
                                <option value="physical">Fysisk aktiv (Bil/Bolig)</option>
                                <option value="investment">Investering / Opsparing</option>
                            </select>
                        </div>
                        <div class="input-group"><label>Basis-værdi nu (kr.)</label><input type="number" id="asset-value" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Månedligt indskud (kr.)</label><input type="number" id="asset-deposit" value="0"></div>
                        <div class="input-group"><label>Årlig vækst (%) / Afskrivning (kr./md)</label><input type="number" id="asset-change-val" step="0.1" value="0"></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Tilknyt lån (hold Ctrl nede for flere)</label>
                            <select id="asset-linked-loans" multiple style="height: 100px;">
                                ${realLoans.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                            </select>
                        </div>
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

        <!-- MODAL FOR LÅN -->
        <div id="loan-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="loan-modal-title">Nyt Lån</h2>
                <form id="loan-form">
                    <div class="input-group"><label>Navn på lån</label><input type="text" id="loan-name" required></div>
                    <div class="input-row">
                        <div class="input-group"><label>Startgæld / Oprindeligt beløb (kr.)</label><input type="number" id="loan-principal" required></div>
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

    setupEvents(container, realLoans, assets, improvements);
    drawProjectionGraph(realLoans, assets, improvements);
}

/**
 * Tegner prognose-grafen med 10 års horisont
 */
function drawProjectionGraph(loans, assets, improvements) {
    const canvas = document.getElementById('projection-graph');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const months = 120;
    const data = { assets: [], debt: [], net: [] };
    
    for (let i = 0; i <= months; i++) {
        const stats = calculateComprehensiveStats(loans, assets, improvements, i);
        data.assets.push(stats.totalAssets);
        data.debt.push(stats.totalDebt);
        data.net.push(stats.netWorth);
    }

    const maxVal = Math.max(...data.assets, ...data.debt, 100000); 
    const padding = 50;
    const chartW = canvas.width - padding * 2;
    const chartH = canvas.height - padding * 2;

    const getX = (m) => padding + (m / months) * chartW;
    const getY = (v) => padding + chartH - (v / maxVal) * chartH;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#e2e1d8';
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 5]);
    for (let i = 0; i <= 4; i++) {
        const y = padding + (i / 4) * chartH;
        ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(padding + chartW, y); ctx.stroke();
    }
    ctx.setLineDash([]);

    const drawLine = (points, color, width = 3) => {
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineJoin = 'round';
        points.forEach((v, m) => { if (m === 0) ctx.moveTo(getX(m), getY(v)); else ctx.lineTo(getX(m), getY(v)); });
        ctx.stroke();
    };

    drawLine(data.assets, '#2d6a4f');
    drawLine(data.debt, '#e53e3e');
    drawLine(data.net, '#4a667a', 5);

    const simX = getX(simulationState.monthsOffset);
    ctx.strokeStyle = 'rgba(93, 74, 68, 0.4)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(simX, padding); ctx.lineTo(simX, padding + chartH); ctx.stroke();
    ctx.setLineDash([]);
}

/**
 * Rendrer aktiv-kortene med boligforbedringer
 */
function renderAssetCards(assets, loans, improvements) {
    return assets
        .filter(a => currentTab === 'total' || a.owner === currentTab || a.owner === 'shared')
        .map(asset => {
            const months = simulationState.monthsOffset;
            const isUser = currentTab !== 'total';
            const multiplier = (isUser && asset.owner === 'shared') ? 0.5 : 1;
            
            // Hent investeringer for dette aktiv (f.eks. jeres nye trappe)
            const assetImprovements = improvements.filter(imp => imp.assetId === asset.id);
            const improvementTotal = assetImprovements.reduce((sum, imp) => sum + imp.amount, 0);

            let valBaseFuture = asset.value;
            const monthlyDeposit = asset.monthlyDeposit || 0;
            if (asset.type === 'investment') {
                const annualR = (asset.changeValue || 0) / 100;
                const monthlyR = Math.pow(1 + annualR, 1/12) - 1;
                if (monthlyR === 0) valBaseFuture = asset.value + (monthlyDeposit * months);
                else valBaseFuture = asset.value * Math.pow(1 + monthlyR, months) + monthlyDeposit * ((Math.pow(1 + monthlyR, months) - 1) / monthlyR);
            } else {
                valBaseFuture = Math.max(0, asset.value - (months * (asset.changeValue || 0))) + (monthlyDeposit * months);
            }

            // Samlet værdi inkluderer investeringer
            const valTotalFuture = valBaseFuture + improvementTotal;

            let linkedLoansSummary = "";
            let equityValue = valTotalFuture;
            const linkedIds = asset.linkedLoanIds || (asset.linkedLoanId ? [asset.linkedLoanId] : []);
            if (linkedIds.length > 0) {
                let totalDebtNow = 0;
                linkedIds.forEach(id => {
                    const loan = loans.find(l => l.id === id);
                    if (loan) {
                        const lCalc = calculateLoanForMonth(loan, getOffsetMonth(months));
                        totalDebtNow += lCalc ? lCalc.remainingBalance : 0;
                    }
                });
                equityValue = valTotalFuture - totalDebtNow;
                linkedLoansSummary = `<div class="equity-tag">Friværdi: <strong>${Math.round(equityValue * multiplier).toLocaleString()} kr.</strong></div>`;
            }

            const isExpanded = simulationState.expandedAssetId === asset.id;

            return `
                <div class="asset-item-card ${isExpanded ? 'expanded' : ''}">
                    <div class="item-main clickable-asset-header" data-id="${asset.id}">
                        <div class="item-info">
                            <div class="item-type-icon">${asset.type === 'investment' ? '📈' : '🏠'}</div>
                            <div>
                                <h4>${asset.name}</h4>
                                ${linkedLoansSummary}
                                ${improvementTotal > 0 ? `<small class="imp-total-label">+${improvementTotal.toLocaleString()} kr. i forbedringer</small>` : ''}
                            </div>
                        </div>
                        <div class="item-value">
                            <div class="val">${Math.round(valTotalFuture * multiplier).toLocaleString()} kr.</div>
                            <div class="change ${asset.type === 'investment' ? 'up' : 'down'}">
                                ${monthlyDeposit > 0 ? `<span class="dep-hint">+${monthlyDeposit} kr./md.</span>` : ''}
                                ${asset.type === 'investment' ? '+' + asset.changeValue + '%' : '-' + asset.changeValue + ' kr.'}
                            </div>
                        </div>
                    </div>
                    
                    ${isExpanded && asset.type === 'physical' ? `
                        <div class="asset-details-inline">
                            <h5>Investerings-log</h5>
                            <ul class="improvement-list">
                                ${assetImprovements.map(imp => `
                                    <li class="imp-item">
                                        <span>${imp.title} <small>(${new Date(imp.date).toLocaleDateString()})</small></span>
                                        <strong>${imp.amount.toLocaleString()} kr.</strong>
                                        <button class="btn-del-mini" data-del-imp-id="${imp.id}">✕</button>
                                    </li>
                                `).join('') || '<p class="empty-msg-small">Ingen forbedringer endnu.</p>'}
                            </ul>
                            <button class="btn-text-link add-imp-btn" data-asset-id="${asset.id}" data-asset-name="${asset.name}">+ Tilføj forbedring</button>
                        </div>
                    ` : ''}

                    <div class="item-actions">
                        <button class="btn-edit-minimal" data-edit-id="${asset.id}" data-type="asset">✎ Rediger</button>
                        <button class="btn-del-minimal" data-del-id="${asset.id}" data-type="asset">✕ Slet</button>
                    </div>
                </div>
            `;
        }).join('') || '<p class="empty-msg">Ingen aktiver registreret.</p>';
}

/**
 * Rendrer låne-kortene med levende barer og simuleret resttid
 */
function renderLoanCards(loans) {
    return loans
        .filter(l => currentTab === 'total' || l.owner === currentTab || l.owner === 'shared')
        .map(loan => {
            const isUser = currentTab !== 'total'; 
            let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
            const currentPay = simulationState.customPayment[loan.id] || loan.monthlyPayment;
            const simLoan = { ...loan, monthlyPayment: currentPay };
            const simMonthStr = getOffsetMonth(simulationState.monthsOffset);
            const simStatus = calculateLoanForMonth(simLoan, simMonthStr);
            const isExpanded = simulationState.expandedLoanId === loan.id;
            const originalPrincipal = loan.principal;
            const simPaidAmount = Math.max(0, originalPrincipal - simStatus.remainingBalance);
            const simPaidPct = Math.min(100, (simPaidAmount / originalPrincipal) * 100);
            
            // Opdateret tekst baseret på simuleret måned
            const timeRemaining = getTimeUntilDebtFree(simLoan, simMonthStr);
            const endDate = getLoanEndDate(simLoan);

            return `
                <div class="loan-item-card ${isExpanded ? 'expanded' : ''}">
                    <div class="item-main clickable-loan-header" data-id="${loan.id}">
                        <div class="item-info">
                            <div class="item-type-icon">🏦</div>
                            <div>
                                <h4>${loan.name}</h4>
                                <small>Simuleret restgæld: ${Math.round(simStatus ? simStatus.remainingBalance * m : 0).toLocaleString()} kr.</small>
                            </div>
                        </div>
                        <div class="item-value">
                            <div class="val">${Math.round(currentPay * m).toLocaleString()} kr./md.</div>
                            <div class="time-left-hint">Gældsfri om: <strong>${timeRemaining}</strong></div>
                        </div>
                    </div>
                    <!-- LEVENDE MÅLSTREGS-BAR -->
                    <div class="loan-progress-container">
                        <div class="progress-labels">
                            <span>Start: ${Math.round(originalPrincipal * m).toLocaleString()} kr.</span>
                            <span class="paid-label">Afdraget (sim.): ${Math.round(simPaidAmount * m).toLocaleString()} kr. (${Math.round(simPaidPct)}%)</span>
                            <span>Mål: 0 kr.</span>
                        </div>
                        <div class="loan-progress-bar-bg"><div class="loan-progress-fill" style="width: ${simPaidPct}%"></div></div>
                    </div>
                    ${isExpanded ? `
                        <div class="loan-simulator-inline">
                            <div class="sim-content">
                                <div class="sim-row">
                                    <div class="sim-input-group">
                                        <label>Simuler ændret afdrag:</label>
                                        <input type="range" class="inline-rate-slider" data-id="${loan.id}" min="${Math.round(loan.monthlyPayment * 0.5)}" max="${Math.round(loan.monthlyPayment * 5)}" value="${currentPay}">
                                        <div class="slider-labels"><span>-50%</span><strong>${Math.round(currentPay).toLocaleString()} kr.</strong><span>+400%</span></div>
                                    </div>
                                    <div class="sim-result-group"><label>Forventet gældsfri:</label><div class="end-date-val">${endDate === 'Aldrig' ? 'Uendelig' : new Date(endDate + "-01").toLocaleDateString('da-DK', {month:'long', year:'numeric'})}</div></div>
                                </div>
                                <div class="sim-actions-bar">
                                    <div class="sim-buttons">
                                        <button class="btn-danger-outline" data-del-id="${loan.id}" data-type="loan">Slet lån</button>
                                        <button class="btn-outline" data-edit-id="${loan.id}" data-type="loan">Rediger</button>
                                        <button class="btn-submit save-sim-btn" data-id="${loan.id}">Gem ydelse</button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('') || '<p class="empty-msg">Ingen gældsposter fundet.</p>';
}

function setupEvents(container, realLoans, assets, improvements) {
    document.getElementById('global-time-slider')?.addEventListener('input', (e) => {
        simulationState.monthsOffset = parseInt(e.target.value);
        renderAssets(container);
    });

    document.getElementById('reset-sim-btn')?.addEventListener('click', () => {
        simulationState.monthsOffset = 0;
        simulationState.customPayment = {};
        renderAssets(container);
    });

    container.querySelectorAll('.tab-btn').forEach(btn => btn.onclick = () => { currentTab = btn.dataset.tab; renderAssets(container); });

    // Expand/Collapse lån og aktiver
    container.querySelectorAll('.clickable-loan-header').forEach(header => {
        header.onclick = () => {
            const id = header.dataset.id;
            simulationState.expandedLoanId = (simulationState.expandedLoanId === id) ? null : id;
            renderAssets(container);
        };
    });

    container.querySelectorAll('.clickable-asset-header').forEach(header => {
        header.onclick = () => {
            const id = header.dataset.id;
            simulationState.expandedAssetId = (simulationState.expandedAssetId === id) ? null : id;
            renderAssets(container);
        };
    });

    // Investerings-events
    container.querySelectorAll('.add-imp-btn').forEach(btn => {
        btn.onclick = (e) => {
            e.stopPropagation();
            currentAssetForImprovement = btn.dataset.assetId;
            document.getElementById('improvement-asset-name').innerText = "Aktiv: " + btn.dataset.assetName;
            document.getElementById('improvement-modal').style.display = 'flex';
        };
    });

    document.getElementById('close-imp-modal').onclick = () => document.getElementById('improvement-modal').style.display = 'none';

    document.getElementById('improvement-form').onsubmit = async (e) => {
        e.preventDefault();
        const data = {
            assetId: currentAssetForImprovement,
            title: document.getElementById('imp-title').value,
            amount: parseFloat(document.getElementById('imp-amount').value),
            date: document.getElementById('imp-date').value
        };
        await addImprovement(data);
        document.getElementById('improvement-modal').style.display = 'none';
        document.getElementById('improvement-form').reset();
        renderAssets(container);
    };

    container.querySelectorAll('[data-del-imp-id]').forEach(btn => {
        btn.onclick = async (e) => {
            e.stopPropagation();
            if (confirm('Slet denne investering?')) {
                await deleteImprovement(btn.dataset.delImpId);
                renderAssets(container);
            }
        };
    });

    // Standard CRUD events
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
            document.getElementById('asset-deposit').value = item.monthlyDeposit || 0;
            document.getElementById('asset-change-val').value = item.changeValue;
            const select = document.getElementById('asset-linked-loans');
            const selectedIds = item.linkedLoanIds || (item.linkedLoanId ? [item.linkedLoanId] : []);
            Array.from(select.options).forEach(opt => opt.selected = selectedIds.includes(opt.value));
            document.getElementById('asset-owner').value = item.owner;
            document.getElementById('delete-asset-btn').style.display = "block";
            document.getElementById('asset-modal').style.display = 'flex';
        }
    });

    container.querySelectorAll('[data-del-id]').forEach(btn => btn.onclick = async (e) => {
        e.stopPropagation();
        if (confirm('Slet permanent?')) {
            if (btn.dataset.type === 'loan') await deleteLoan(btn.dataset.delId); else await deleteAsset(btn.dataset.delId);
            renderAssets(container);
        }
    });

    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        const select = document.getElementById('asset-linked-loans');
        const d = { 
            name: document.getElementById('asset-name').value, type: document.getElementById('asset-type').value, 
            value: parseFloat(document.getElementById('asset-value').value), monthlyDeposit: parseFloat(document.getElementById('asset-deposit').value) || 0,
            changeValue: parseFloat(document.getElementById('asset-change-val').value), linkedLoanIds: Array.from(select.selectedOptions).map(opt => opt.value),
            owner: document.getElementById('asset-owner').value 
        };
        if (editingItemId) await updateAsset(editingItemId, d); else await addAsset(d);
        document.getElementById('asset-modal').style.display = 'none'; renderAssets(container);
    };

    document.getElementById('loan-form').onsubmit = async (e) => {
        e.preventDefault();
        const d = { 
            name: document.getElementById('loan-name').value, principal: parseFloat(document.getElementById('loan-principal').value), 
            interestRate: parseFloat(document.getElementById('loan-interest').value), monthlyPayment: parseFloat(document.getElementById('loan-payment').value), 
            category: document.getElementById('loan-category').value, startDate: document.getElementById('loan-start').value, owner: document.getElementById('loan-owner').value 
        };
        if (editingItemId) await updateLoan(editingItemId, d); else await addLoan(d);
        document.getElementById('loan-modal').style.display = 'none'; renderAssets(container);
    };
}

function getOffsetMonth(offset) { const d = new Date(); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 7); }

function calculateComprehensiveStats(loans, assets, improvements, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset); 
    const isUser = currentTab !== 'total';
    let totalDebt = 0, totalAssets = 0, monthlyGrowth = 0, monthlyLoss = 0;

    loans.forEach(l => {
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
        const c = calculateLoanForMonth({ ...l, monthlyPayment: simulationState.customPayment[l.id] || l.monthlyPayment }, targetMonth);
        if (c) { totalDebt += c.remainingBalance * m; monthlyGrowth += c.principalPaid * m; monthlyLoss += c.interest * m; }
    });

    assets.forEach(a => {
        if (isUser && a.owner !== currentTab && a.owner !== 'shared') return;
        let m = (isUser && a.owner === 'shared') ? 0.5 : 1;
        const assetImprovements = improvements.filter(imp => imp.assetId === a.id);
        const improvementTotal = assetImprovements.reduce((sum, imp) => sum + imp.amount, 0);
        let valBaseFuture = a.value;
        const monthlyDeposit = a.monthlyDeposit || 0;
        if (a.type === 'investment') {
            const annualR = (a.changeValue || 0) / 100;
            const monthlyR = Math.pow(1 + annualR, 1/12) - 1;
            if (monthlyR === 0) valBaseFuture = a.value + (monthlyDeposit * monthsOffset);
            else valBaseFuture = a.value * Math.pow(1 + monthlyR, monthsOffset) + monthlyDeposit * ((Math.pow(1 + monthlyR, monthsOffset) - 1) / monthlyR);
        } else {
            valBaseFuture = Math.max(0, a.value - (monthsOffset * (a.changeValue || 0))) + (monthlyDeposit * monthsOffset);
        }
        totalAssets += (valBaseFuture + improvementTotal) * m;
        if (a.type === 'investment') {
            const annualR = (a.changeValue || 0) / 100;
            const monthlyR = Math.pow(1 + annualR, 1/12) - 1;
            monthlyGrowth += ((valBaseFuture * (monthlyR || 0)) + monthlyDeposit) * m;
        } else {
            monthlyLoss += (a.changeValue || 0) * m;
            monthlyGrowth += (monthlyDeposit * m);
        }
    });

    return { totalDebt, totalAssets, netWorth: totalAssets - totalDebt, monthlyGrowth, monthlyLoss };
}
