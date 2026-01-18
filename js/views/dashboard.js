export function renderDashboard(container) {
    container.innerHTML = `
        <header class="dashboard-header">
            <h1>Velkommen hjem</h1>
            <p>Her er et overblik over din husstand</p>
        </header>
        <section class="grid-container">
            <article class="card" data-link="budget"><span class="card-icon">💰</span><h3>Budget</h3><p>Se rådighedsbeløb og udgifter.</p><span class="action-text">Gå til budget →</span></article>
            <article class="card" data-link="formue"><span class="card-icon">📈</span><h3>Formue & Gæld</h3><p>Styr på lån og friværdi.</p><span class="action-text">Se formue →</span></article>
            <article class="card" data-link="opskrifter"><span class="card-icon">🍴</span><h3>Madplan</h3><p>Hvad skal vi have at spise?</p><span class="action-text">Se opskrifter →</span></article>
            <article class="card" data-link="lager"><span class="card-icon">📦</span><h3>Lager</h3><p>Tjek husholdningens lager.</p><span class="action-text">Tjek beholdning →</span></article>
        </section>
    `;
}
