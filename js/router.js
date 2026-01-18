import { renderDashboard } from "./views/dashboard.js";
import { renderBudget } from "./views/budget.js";
import { renderAssets } from "./views/assets.js";

/**
 * Router-modul
 * Håndterer skift mellem de forskellige undersider
 */
export function initRouter() {
    const appContainer = document.querySelector("#app");
    
    // Hent ruten fra URL hash
    let route = window.location.hash.replace("#", "").replace("/", "");
    
    // Standard rute
    if (route === "" || route === "." || route === "./") {
        route = "dashboard";
    }

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
            appContainer.innerHTML = "<h1>Opskrifter</h1><p>Her kommer dine opskrifter og madplan.</p>";
            break;
        case "lager":
            appContainer.innerHTML = "<h1>Lager</h1><p>Oversigt over dit lager.</p>";
            break;
        default:
            renderDashboard(appContainer);
            break;
    }
}
