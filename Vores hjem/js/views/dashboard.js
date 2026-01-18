/**
 * Dashboard View
 */
export function renderDashboard(container) {
    container.innerHTML = `
        <header class="dashboard-header">
            <h1>Velkommen hjem</h1>
            <p>Her er et overblik over din husstand</p>
        </header>

        <section class="grid-container">
            <article class="card" data-link="opskrifter">
                <h3>Madplan</h3>
                <p id="recipe-preview">Ingen madplan for i dag</p>
                <span class="action-text">Se opskrifter →</span>
            </article>

            <article class="card" data-link="lager">
                <h3>Lager</h3>
                <p id="inventory-preview">Henter status...</p>
                <div class="status-indicator warning">3 varer mangler</div>
                <span class="action-text">Tjek beholdning →</span>
            </article>

            <article class="card" data-link="projekter">
                <h3>Projekter</h3>
                <p id="project-preview">2 aktive opgaver</p>
                <span class="action-text">Gå til projekter →</span>
            </article>

            <article class="card" data-link="budget">
                <h3>Budget</h3>
                <p id="budget-preview">Forbrug denne måned: 2.450 kr.</p>
                <span class="action-text">Se budget →</span>
            </article>
        </section>
    `;

    loadDashboardData();
}

function loadDashboardData() {
    console.log("Henter dashboard data fra Firestore...");
}
