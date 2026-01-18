import { renderDashboard } from "./views/dashboard.js";
import { renderBudget } from "./views/budget.js";
import { renderAssets } from "./views/assets.js";

export function initRouter() {
    const appContainer = document.querySelector("#app");
    let route = window.location.hash.replace("#", "").replace("/", "");
    if (route === "" || route === "." || route === "./") route = "dashboard";
    appContainer.innerHTML = "";

    switch (route) {
        case "dashboard": renderDashboard(appContainer); break;
        case "budget": renderBudget(appContainer); break;
        case "formue": renderAssets(appContainer); break;
        case "opskrifter": appContainer.innerHTML = "<h1>Opskrifter</h1><p>Kommer snart...</p>"; break;
        case "lager": appContainer.innerHTML = "<h1>Lager</h1><p>Kommer snart...</p>"; break;
        case "projekter": appContainer.innerHTML = "<h1>Projekter</h1><p>Kommer snart...</p>"; break;
        default: renderDashboard(appContainer); break;
    }
}
