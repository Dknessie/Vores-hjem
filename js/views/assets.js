import { addLoan, getLoans, deleteLoan, updateLoan, getLoanEndDate, calculateLoanForMonth, addAsset, getAssets, deleteAsset, updateAsset, getTimeUntilDebtFree } from "../services/loanService.js";

// State for denne visning
let simulationState = { 
    monthsOffset: 0
};

let currentTab = 'total';
let editingItemId = null;

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
    
    const stats = calculateComprehensiveStats(realLoans, assets, simulationState.monthsOffset);

    // Gruppering af aktiver til det strømlinede look
    const realEstate = assets.filter(a => a.type === 'real_estate');
    const vehicles = assets.filter(a => a.type === 'vehicle');
    const liquid = assets.filter(a => ['investment', 'savings'].includes(a.type));

    container.innerHTML = `
        <header class="view-header">
            <div class="header-title-group">
                <h1>Formue & Gæld</h1>
                <p class="subtitle">Et rent og strømlinet overblik over husstandens balance</p>
            </div>
            <div class="header-actions">
                <button id="open-asset-modal" class="btn-outline">+ Nyt Aktiv</button>
                <button id="open-loan-modal" class="btn-add">+ Nyt Lån</button>
            </div>
        </header>

        <!-- STREAMLINED COMMAND CENTER -->
        <section class="clean-overview-bar" style="display: flex; gap: 2rem; background: white; padding: 1.5rem 2rem; border-radius: var(--border-radius); box-shadow: var(--shadow); margin-bottom: 2rem; align-items: center; border-left: 6px solid var(--primary-green);">
            <div style="flex: 1;">
                <label style="font-size: 0.8rem; color: var(--text-light); text-transform: uppercase; font-weight: 800;">Netto Formue</label>
                <div style="font-size: 2rem; font-weight: 900; color: ${stats.netWorth >= 0 ? 'var(--primary-green)' : 'var(--danger-bright)'};">
                    ${Math.round(stats.netWorth).toLocaleString()} kr.
                </div>
            </div>
            <div style="flex: 1; border-left: 1px solid #eee; padding-left: 2rem;">
                <label style="font-size: 0.8rem; color: var(--text-light); text-transform: uppercase; font-weight: 800;">Aktiver</label>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-main);">${Math.round(stats.totalAssets).toLocaleString()} kr.</div>
            </div>
            <div style="flex: 1; border-left: 1px solid #eee; padding-left: 2rem;">
                <label style="font-size: 0.8rem; color: var(--text-light); text-transform: uppercase; font-weight: 800;">Gæld</label>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--danger-bright);">${Math.round(stats.totalDebt).toLocaleString()} kr.</div>
            </div>
        </section>

        <!-- FREMTIDSSIMULATOR (Nu som et elegant kontrolpanel) -->
        <section class="simulator-panel" style="background: var(--bg-color); border: 1px solid #e2e1d8; padding: 1.5rem; border-radius: var(--border-radius); margin-bottom: 2.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <h4 style="margin:0;">Fremtidssimulator: <strong>${simulationState.monthsOffset === 0 ? 'Dags dato' : '+' + simulationState.monthsOffset + ' måneder'}</strong></h4>
                <button id="reset-sim-btn" class="btn-outline-small" ${simulationState.monthsOffset === 0 ? 'disabled' : ''}>Nulstil til i dag</button>
            </div>
            <input type="range" id="global-time-slider" min="0" max="120" value="${simulationState.monthsOffset}" style="width: 100%; accent-color: var(--primary-green); cursor: pointer;">
            <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-light); margin-top: 5px; font-weight: 700;">
                <span>Nu</span><span>5 år frem</span><span>10 år frem</span>
            </div>
        </section>

        <div class="tab-control">
            <button class="tab-btn ${currentTab === 'total' ? 'active' : ''}" data-tab="total">Husstanden</button>
            <button class="tab-btn ${currentTab === 'user1' ? 'active' : ''}" data-tab="user1">Mig</button>
            <button class="tab-btn ${currentTab === 'user2' ? 'active' : ''}" data-tab="user2">Kæresten</button>
        </div>

        <!-- NY STRØMLINET LISTE-VISNING -->
        <div class="streamlined-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 3rem;">
            
            <!-- VENSTRE KOLONNE: AKTIVER OPDELET I GRUPPER -->
            <section class="assets-section">
                <h3 style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--wood-brown); padding-bottom: 5px;">Aktiver</h3>
                
                ${renderAssetGroup("Fast Ejendom", "🏠", realEstate, realLoans)}
                ${renderAssetGroup("Køretøjer", "🚗", vehicles, realLoans)}
                ${renderAssetGroup("Likvide midler & Opsparing", "📈", liquid, realLoans)}
                
                ${assets.length === 0 ? '<p class="empty-msg">Ingen aktiver registreret endnu.</p>' : ''}
            </section>

            <!-- HØJRE KOLONNE: GÆLD -->
            <section class="debts-section">
                <h3 style="margin-bottom: 1.5rem; border-bottom: 2px solid var(--danger-bright); padding-bottom: 5px;">Gæld & Lån</h3>
                <div class="clean-list">
                    ${renderCleanLoanCards(realLoans)}
                </div>
            </section>
        </div>

        <!-- DETALJE MODAL (Brugt til at inspicere ét enkelt aktiv eller lån i ro og mag) -->
        <div id="inspector-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card" id="inspector-content" style="max-width: 700px;">
                <!-- Indhold injiceres dynamisk via JavaScript -->
            </div>
        </div>

        <!-- OPRET/REDIGER MODALER (Gjort mere intelligente) -->
        <div id="asset-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="asset-modal-title">Nyt Aktiv</h2>
                <form id="asset-form">
                    <div class="input-group">
                        <label>Aktiv Type</label>
                        <select id="asset-type">
                            <option value="real_estate">Fast Ejendom (Kan forbedres)</option>
                            <option value="vehicle">Køretøj (Beregner værditab)</option>
                            <option value="investment">Investering / Aktier</option>
                            <option value="savings">Kontant Opsparing</option>
                        </select>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Navn</label><input type="text" id="asset-name" required placeholder="f.eks. Hus på Strandvejen"></div>
                        <div class="input-group"><label>Nuværende Værdi (kr.)</label><input type="number" id="asset-value" required></div>
                    </div>
                    
                    <!-- Dynamisk sektion: Skifter baseret på type -->
                    <div class="input-row" id="asset-dynamic-fields">
                        <div class="input-group"><label id="label-deposit">Mdl. indskud (kr.)</label><input type="number" id="asset-deposit" value="0"></div>
                        <div class="input-group"><label id="label-change">Årlig ændring (%)</label><input type="number" id="asset-change-val" step="0.1" value="0"></div>
                    </div>

                    <div class="input-row">
                        <div class="input-group"><label>Tilknyt lån (valgfrit)</label>
                            <select id="asset-linked-loans" multiple style="height: 80px;">
                                ${realLoans.map(l => `<option value="${l.id}">${l.name}</option>`).join('')}
                            </select>
                        </div>
                        <div class="input-group"><label>Ejer</label>
                            <select id="asset-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option></select>
                        </div>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" id="close-asset-modal" class="btn-outline">Annuller</button>
                        <button type="submit" class="btn-submit">Gem Aktiv</button>
                    </div>
                </form>
            </div>
        </div>

        <div id="loan-modal" class="modal-overlay" style="display:none;">
            <div class="modal-card">
                <h2 id="loan-modal-title">Nyt Lån</h2>
                <form id="loan-form">
                    <div class="input-group"><label>Navn på lån</label><input type="text" id="loan-name" required></div>
                    <div class="input-row">
                        <div class="input-group"><label>Startgæld / Oprindeligt beløb</label><input type="number" id="loan-principal" required></div>
                        <div class="input-group"><label>Rente (% p.a.)</label><input type="number" id="loan-interest" step="0.01" required></div>
                    </div>
                    <div class="input-row">
                        <div class="input-group"><label>Fast Mdl. Ydelse (kr.)</label><input type="number" id="loan-payment" required></div>
                        <div class="input-group"><label>Startmåned</label><input type="month" id="loan-start" required></div>
                    </div>
                    <div class="input-group"><label>Ejer</label>
                        <select id="loan-owner"><option value="user1">Mig</option><option value="user2">Kæreste</option><option value="shared" selected>Fælles</option></select>
                    </div>
                    <div class="modal-buttons">
                        <button type="button" id="close-loan-modal" class="btn-outline">Annuller</button>
                        <button type="submit" class="btn-submit">Gem Lån</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    setupEvents(container, realLoans, assets);
}

/**
 * Hjælpefunktion: Rendrer en logisk gruppe af aktiver
 */
function renderAssetGroup(title, icon, itemsGroup, loans) {
    if (itemsGroup.length === 0) return '';
    
    let html = `<div class="asset-group" style="margin-bottom: 2rem;">
                  <h4 style="font-size: 0.9rem; color: var(--text-light); text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                     <span>${icon}</span> ${title}
                  </h4>
                  <div class="clean-list" style="display: flex; flex-direction: column; gap: 10px;">`;
                  
    html += itemsGroup.map(asset => {
        const isUser = currentTab !== 'total';
        const multiplier = (isUser && asset.owner === 'shared') ? 0.5 : 1;
        
        let displayValue = asset.value;
        const targetMonthStr = getOffsetMonth(simulationState.monthsOffset);
        
        // Simuler værdi inkl. forbedringer for ejendom
        if (asset.type === 'real_estate') {
            const imps = (asset.improvements || []).filter(imp => imp.date <= targetMonthStr).reduce((s, i) => s + i.valueAdd, 0);
            displayValue += imps;
            // Simplificeret fremskrivning til visning (uden kompliceret rentes-rente for ejendom her)
            displayValue += (asset.changeValue || 0) * simulationState.monthsOffset * 100; // Antager changeValue er pct/år, simplificeret for nu.
        } else if (asset.type === 'vehicle') {
            displayValue = Math.max(0, displayValue - ((asset.changeValue || 0) * simulationState.monthsOffset));
        }

        return `
            <div class="clean-card item-click" data-id="${asset.id}" data-itemtype="asset" style="background: white; padding: 1.2rem; border-radius: 14px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 1px solid #eee; transition: all 0.2s;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 800; color: var(--text-main);">${asset.name}</span>
                    ${asset.type === 'real_estate' && asset.improvements?.length ? `<span style="font-size: 0.7rem; color: var(--success-green); font-weight: 700;">+${asset.improvements.length} forbedringer</span>` : ''}
                </div>
                <div style="font-weight: 900; color: var(--wood-brown);">${Math.round(displayValue * multiplier).toLocaleString()} kr.</div>
            </div>
        `;
    }).join('');
    
    html += `</div></div>`;
    return html;
}

/**
 * Hjælpefunktion: Rendrer lånene i et rent liste-format
 */
function renderCleanLoanCards(loans) {
    if (loans.length === 0) return '<p class="empty-msg">Ingen gældsposter fundet.</p>';
    
    return loans.map(loan => {
        const isUser = currentTab !== 'total'; 
        let m = (isUser && loan.owner === 'shared') ? 0.5 : 1;
        
        const simMonthStr = getOffsetMonth(simulationState.monthsOffset);
        const simStatus = calculateLoanForMonth(loan, simMonthStr);

        return `
            <div class="clean-card item-click" data-id="${loan.id}" data-itemtype="loan" style="background: white; padding: 1.2rem; border-radius: 14px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; cursor: pointer; border: 1px solid #eee; border-left: 4px solid var(--danger-bright); transition: all 0.2s;">
                <div style="display: flex; flex-direction: column;">
                    <span style="font-weight: 800; color: var(--text-main);">${loan.name}</span>
                    <span style="font-size: 0.75rem; color: var(--text-light);">Restgæld: ${Math.round(simStatus.remainingBalance * m).toLocaleString()} kr.</span>
                </div>
                <div style="font-weight: 900; color: var(--danger-bright); text-align: right;">
                    <div>${Math.round(loan.monthlyPayment * m).toLocaleString()} kr./md</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Åbner inspektøren (Fokus-modalen) for et specifikt element
 */
function openInspector(id, type, realLoans, assets) {
    const modal = document.getElementById('inspector-modal');
    const content = document.getElementById('inspector-content');
    
    if (type === 'loan') {
        const loan = realLoans.find(l => l.id === id);
        const endDate = getLoanEndDate(loan);
        
        content.innerHTML = `
            <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-light); text-transform: uppercase; font-weight: 800;">Lån detaljer</span>
                    <h2 style="margin: 0; font-size: 2rem; color: var(--danger-bright);">${loan.name}</h2>
                </div>
                <button class="close-inspector btn-outline-small">✕ Luk</button>
            </header>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; background: #f9f8f5; padding: 1.5rem; border-radius: 14px;">
                <div><label style="font-size: 0.75rem; color: var(--text-light);">Startgæld</label><div style="font-weight: 800;">${loan.principal.toLocaleString()} kr.</div></div>
                <div><label style="font-size: 0.75rem; color: var(--text-light);">Fast Ydelse</label><div style="font-weight: 800;">${loan.monthlyPayment.toLocaleString()} kr./md</div></div>
                <div><label style="font-size: 0.75rem; color: var(--text-light);">Rente</label><div style="font-weight: 800;">${loan.interestRate}%</div></div>
                <div><label style="font-size: 0.75rem; color: var(--text-light);">Forventet gældsfri</label><div style="font-weight: 800; color: var(--success-green);">${endDate === 'Aldrig' ? 'Aldrig' : endDate}</div></div>
            </div>

            <h3 style="font-size: 1.1rem; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 1rem;">Ekstraordinære Afdrag</h3>
            <ul style="list-style: none; padding: 0; margin-bottom: 2rem;">
                ${loan.extraPayments?.map(p => `<li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee;"><span>${p.date}</span><strong style="color: var(--success-green);">+${p.amount.toLocaleString()} kr.</strong></li>`).join('') || '<li style="color: var(--text-light); font-size: 0.85rem;">Ingen ekstra indskud lavet.</li>'}
            </ul>

            <form id="inspector-action-form" style="background: white; padding: 1.5rem; border: 1px solid var(--success-green); border-radius: 14px;">
                <h4 style="margin-bottom: 10px; color: var(--success-green);">Indskyd engangsbeløb nu</h4>
                <div style="display: flex; gap: 10px;">
                    <input type="number" id="quick-extra-amount" placeholder="Beløb (kr.)" required style="flex: 2; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                    <input type="month" id="quick-extra-date" required style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                    <button type="submit" class="btn-submit" style="padding: 10px 20px; border-radius: 8px;">Indskyd</button>
                </div>
            </form>
            
            <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="btn-del-minimal" id="action-delete" data-id="${loan.id}">Slet Lån</button>
            </div>
        `;
        
        // Inspector events (Lån)
        content.querySelector('.close-inspector').onclick = () => modal.style.display = 'none';
        content.querySelector('#action-delete').onclick = async () => { if(confirm('Slet lån permanent?')) { await deleteLoan(loan.id); location.reload(); } };
        content.querySelector('#inspector-action-form').onsubmit = async (e) => {
            e.preventDefault();
            const newPayment = { amount: parseFloat(document.getElementById('quick-extra-amount').value), date: document.getElementById('quick-extra-date').value };
            await updateLoan(loan.id, { ...loan, extraPayments: [...(loan.extraPayments || []), newPayment] });
            location.reload();
        };

    } else if (type === 'asset') {
        const asset = assets.find(a => a.id === id);
        const isRealEstate = asset.type === 'real_estate';
        
        content.innerHTML = `
            <header style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
                <div>
                    <span style="font-size: 0.7rem; color: var(--text-light); text-transform: uppercase; font-weight: 800;">Aktiv detaljer</span>
                    <h2 style="margin: 0; font-size: 2rem; color: var(--primary-green);">${asset.name}</h2>
                </div>
                <button class="close-inspector btn-outline-small">✕ Luk</button>
            </header>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 2rem; background: #f9f8f5; padding: 1.5rem; border-radius: 14px;">
                <div><label style="font-size: 0.75rem; color: var(--text-light);">Basis Værdi</label><div style="font-weight: 800;">${asset.value.toLocaleString()} kr.</div></div>
                <div><label style="font-size: 0.75rem; color: var(--text-light);">Type</label><div style="font-weight: 800; text-transform: capitalize;">${asset.type.replace('_', ' ')}</div></div>
            </div>

            ${isRealEstate ? `
                <h3 style="font-size: 1.1rem; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 1rem;">Bolig Forbedringer</h3>
                <ul style="list-style: none; padding: 0; margin-bottom: 2rem;">
                    ${asset.improvements?.map(i => `<li style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee;"><span>${i.date} - ${i.desc} (Udgift: ${i.cost} kr.)</span><strong style="color: var(--success-green);">+${i.valueAdd.toLocaleString()} kr.</strong></li>`).join('') || '<li style="color: var(--text-light); font-size: 0.85rem;">Ingen forbedringer logget.</li>'}
                </ul>

                <form id="inspector-action-form" style="background: white; padding: 1.5rem; border: 1px solid var(--primary-green); border-radius: 14px;">
                    <h4 style="margin-bottom: 10px; color: var(--primary-green);">Tilføj ny forbedring</h4>
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
                        <input type="text" id="quick-imp-desc" placeholder="Beskrivelse (f.eks. Nyt bad)" required style="grid-column: span 2; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                        <input type="number" id="quick-imp-cost" placeholder="Udgift her & nu (kr.)" required style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                        <input type="number" id="quick-imp-value" placeholder="Øget ejendomsværdi (kr.)" required style="padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                    </div>
                    <div style="display: flex; gap: 10px;">
                        <input type="month" id="quick-imp-date" required style="flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 8px;">
                        <button type="submit" class="btn-submit" style="flex: 1; border-radius: 8px;">Gem forbedring</button>
                    </div>
                </form>
            ` : `
                <div style="text-align: center; padding: 2rem; background: white; border-radius: 14px; border: 1px dashed #ccc; color: var(--text-light);">
                    Dette aktiv understøtter ikke logning af fysiske forbedringer.
                </div>
            `}

            <div style="margin-top: 2rem; display: flex; justify-content: flex-end; gap: 10px;">
                <button class="btn-del-minimal" id="action-delete" data-id="${asset.id}">Slet Aktiv</button>
            </div>
        `;

        // Inspector events (Aktiv)
        content.querySelector('.close-inspector').onclick = () => modal.style.display = 'none';
        content.querySelector('#action-delete').onclick = async () => { if(confirm('Slet aktiv permanent?')) { await deleteAsset(asset.id); location.reload(); } };
        
        if (isRealEstate) {
            content.querySelector('#inspector-action-form').onsubmit = async (e) => {
                e.preventDefault();
                const newImp = { 
                    desc: document.getElementById('quick-imp-desc').value,
                    cost: parseFloat(document.getElementById('quick-imp-cost').value),
                    valueAdd: parseFloat(document.getElementById('quick-imp-value').value),
                    date: document.getElementById('quick-imp-date').value
                };
                await updateAsset(asset.id, { ...asset, improvements: [...(asset.improvements || []), newImp] });
                location.reload();
            };
        }
    }
    
    modal.style.display = 'flex';
}


function setupEvents(container, realLoans, assets) {
    // Simulator Slider
    document.getElementById('global-time-slider')?.addEventListener('input', (e) => {
        simulationState.monthsOffset = parseInt(e.target.value);
        renderAssets(container); // Genindlæser overblikket med fremskreden tid
    });
    document.getElementById('reset-sim-btn')?.addEventListener('click', () => {
        simulationState.monthsOffset = 0;
        renderAssets(container);
    });

    // Åbn Inspektør (Fokus visning)
    container.querySelectorAll('.item-click').forEach(card => {
        card.addEventListener('click', () => {
            openInspector(card.dataset.id, card.dataset.itemtype, realLoans, assets);
        });
    });

    // Dynamisk formular i Aktiv Modal
    document.getElementById('asset-type').addEventListener('change', (e) => {
        const type = e.target.value;
        const lblDeposit = document.getElementById('label-deposit');
        const lblChange = document.getElementById('label-change');
        
        if (type === 'real_estate') {
            lblDeposit.innerText = "Mdl. Opsparing i bolig (kr.)";
            lblChange.innerText = "Forventet årlig stigning (%)";
        } else if (type === 'vehicle') {
            lblDeposit.innerText = "Ikke relevant for bil";
            lblChange.innerText = "Månedligt Værditab (kr.)";
        } else if (type === 'investment') {
            lblDeposit.innerText = "Mdl. indskud (kr.)";
            lblChange.innerText = "Forventet årligt afkast (%)";
        } else {
            lblDeposit.innerText = "Mdl. opsparing (kr.)";
            lblChange.innerText = "Årlig Rente (%)";
        }
    });

    // Standard Modal åben/luk
    document.getElementById('open-asset-modal').onclick = () => { document.getElementById('asset-form').reset(); document.getElementById('asset-modal').style.display = 'flex'; };
    document.getElementById('open-loan-modal').onclick = () => { document.getElementById('loan-form').reset(); document.getElementById('loan-modal').style.display = 'flex'; };
    document.getElementById('close-asset-modal').onclick = () => document.getElementById('asset-modal').style.display = 'none';
    document.getElementById('close-loan-modal').onclick = () => document.getElementById('loan-modal').style.display = 'none';

    // Submit logik (Let opryddet)
    document.getElementById('asset-form').onsubmit = async (e) => {
        e.preventDefault();
        const select = document.getElementById('asset-linked-loans');
        const selectedIds = Array.from(select.selectedOptions).map(opt => opt.value);
        const d = { 
            name: document.getElementById('asset-name').value, 
            type: document.getElementById('asset-type').value, 
            value: parseFloat(document.getElementById('asset-value').value), 
            monthlyDeposit: parseFloat(document.getElementById('asset-deposit').value) || 0,
            changeValue: parseFloat(document.getElementById('asset-change-val').value) || 0, 
            linkedLoanIds: selectedIds,
            owner: document.getElementById('asset-owner').value 
        };
        await addAsset(d); document.getElementById('asset-modal').style.display = 'none'; renderAssets(container);
    };

    document.getElementById('loan-form').onsubmit = async (e) => {
        e.preventDefault();
        const d = { 
            name: document.getElementById('loan-name').value, 
            principal: parseFloat(document.getElementById('loan-principal').value), 
            interestRate: parseFloat(document.getElementById('loan-interest').value), 
            monthlyPayment: parseFloat(document.getElementById('loan-payment').value), 
            startDate: document.getElementById('loan-start').value, 
            owner: document.getElementById('loan-owner').value 
        };
        await addLoan(d); document.getElementById('loan-modal').style.display = 'none'; renderAssets(container);
    };
}

// Hjælpefunktioner til logik
function getOffsetMonth(offset) { const d = new Date(); d.setMonth(d.getMonth() + offset); return d.toISOString().slice(0, 7); }

function calculateComprehensiveStats(loans, assets, monthsOffset) {
    const targetMonth = getOffsetMonth(monthsOffset); 
    const isUser = currentTab !== 'total';
    let totalDebt = 0, totalAssets = 0;

    loans.forEach(l => {
        if (isUser && l.owner !== currentTab && l.owner !== 'shared') return;
        let m = (isUser && l.owner === 'shared') ? 0.5 : 1;
        const c = calculateLoanForMonth(l, targetMonth);
        totalDebt += c.remainingBalance * m; 
    });

    assets.forEach(a => {
        if (isUser && a.owner !== currentTab && a.owner !== 'shared') return;
        let m = (isUser && a.owner === 'shared') ? 0.5 : 1;
        
        let baseVal = a.value;
        if(a.type === 'real_estate') {
            const impsValue = (a.improvements || []).filter(imp => imp.date <= targetMonth).reduce((s, i) => s + i.valueAdd, 0);
            baseVal += impsValue;
            totalAssets += baseVal * m; // Simplificeret her
        } else if (a.type === 'vehicle') {
            totalAssets += Math.max(0, baseVal - (monthsOffset * (a.changeValue || 0))) * m;
        } else {
             // Investering/Opsparing
             const monthlyDeposit = a.monthlyDeposit || 0;
             const annualR = (a.changeValue || 0) / 100;
             const monthlyR = Math.pow(1 + annualR, 1/12) - 1;
             let valFuture = baseVal * Math.pow(1 + (monthlyR || 0), monthsOffset) + (monthlyDeposit * monthsOffset);
             totalAssets += valFuture * m;
        }
    });

    return { totalDebt, totalAssets, netWorth: totalAssets - totalDebt };
}
