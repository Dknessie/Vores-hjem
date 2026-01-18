import { renderDashboard } from "./views/dashboard.js";
import { renderBudget } from "./views/budget.js";
import { renderAssets } from "./views/assets.js";

/**
 * Router-modul - Styrer navigationen mellem alle husets moduler
 */
export function initRouter() {
    const appContainer = document.querySelector("#app");
    
    // Hent ruten fra URL hash
    let route = window.location.hash.replace("#", "").replace("/", "");
    
    // Standard rute
    if (route === "" || route === "." || route === "./") {
        route = "dashboard";
    }

    // Ryd containeren før ny visning indlæses
    appContainer.innerHTML = "";

    switch (route) {
        case "dashboard":
            renderDashboard(appContainer);
            break;
        case "budget":
            renderBudget(appContainer);
            break;
        case "formue":
            renderAssets(appContainer);
            break;
        case "opskrifter":
            appContainer.innerHTML = `
                <header class="view-header"><h1>Opskrifter</h1></header>
                <div class="asset-card-main"><p>Her kommer dit intelligente opskriftskartotek snart...</p></div>`;
            break;
        case "lager":
            appContainer.innerHTML = `
                <header class="view-header"><h1>Lager</h1></header>
                <div class="asset-card-main"><p>Her kommer overblikket over husholdningens lager...</p></div>`;
            break;
        case "projekter":
            appContainer.innerHTML = `
                <header class="view-header"><h1>Projekter</h1></header>
                <div class="asset-card-main"><p>Her kan du styre husets små og store projekter...</p></div>`;
            break;
        default:
            renderDashboard(appContainer);
            break;
    }
}
