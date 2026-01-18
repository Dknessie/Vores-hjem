import { renderDashboard } from "./views/dashboard.js";
import { renderBudget } from "./views/budget.js";

/**
 * Router-modul - Styrer hvilken visning der skal indlæses
 */
export function initRouter() {
    const appContainer = document.querySelector("#app");
    
    // Hent ruten fra URL hash (f.eks. #budget)
    let route = window.location.hash.replace("#", "").replace("/", "");
    
    // Standard rute
    if (route === "" || route === "." || route === "./") {
        route = "dashboard";
    }

    // Ryd containeren før ny visning
    appContainer.innerHTML = "";

    // Her kobler vi ruterne til de rigtige funktioner
    switch (route) {
        case "dashboard":
            renderDashboard(appContainer);
            break;
        case "budget":
            // Nu kalder vi den rigtige funktion fra budget.js
            renderBudget(appContainer);
            break;
        case "opskrifter":
            appContainer.innerHTML = "<h1>Opskrifter</h1><p>Kommer snart...</p>";
            break;
        case "lager":
            appContainer.innerHTML = "<h1>Lager</h1><p>Kommer snart...</p>";
            break;
        case "projekter":
            appContainer.innerHTML = "<h1>Projekter</h1><p>Kommer snart...</p>";
            break;
        default:
            renderDashboard(appContainer);
            break;
    }
}
