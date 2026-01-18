import { renderDashboard } from "./views/dashboard.js";
import { renderBudget } from "./views/budget.js";
import { renderAssets } from "./views/assets.js";

export function initRouter() {
    const appContainer = document.querySelector("#app");
    let route = window.location.hash.replace("#", "").replace("/", "");
    
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
        default:
            renderDashboard(appContainer);
            break;
    }
}
