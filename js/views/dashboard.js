/**
 * Dashboard View (Landing Page)
 */
export function renderDashboard(container) {
    container.innerHTML = `
        <header class="dashboard-header">
            <h1>Velkommen hjem</h1>
            <p>Her er et hurtigt overblik over husstanden</p>
        </header>

        <section class="grid-container">
            <!-- Økonomi / Budget -->
            <article class="card" data-link="budget">
                <div class="card-icon">💰</div>
                <h3>Budget</h3>
                <p>Se månedens rådighedsbeløb og faste udgifter.</p>
                <span class="action-text">Gå til budget →</span>
            </article>

            <!-- Formue & Gæld -->
            <article class="card" data-link="formue">
                <div class="card-icon">📈</div>
                <h3>Formue & Gæld</h3>
                <p>Hold styr på dine lån, afdrag og friværdi.</p>
                <span class="action-text">Se formue →</span>
            </article>

            <!-- Opskrifter -->
            <article class="card" data-link="opskrifter">
                <div class="card-icon">🍴</div>
                <h3>Madplan</h3>
                <p>Hvad skal vi have at spise i dag?</p>
                <span class="action-text">Se opskrifter →</span>
            </article>

            <!-- Lager -->
            <article class="card" data-link="lager">
                <div class="card-icon">📦</div>
                <h3>Lager</h3>
                <p>Tjek om vi mangler mælk eller toiletpapir.</p>
                <span class="action-text">Tjek beholdning →</span>
            </article>
        </section>
    `;
}
