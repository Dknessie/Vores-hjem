import { state } from "./app.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderBudget } from "./views/budget.js";
import { renderAssets } from "./views/assets.js";
import { renderLogin } from "./views/login.js";

/**
 * Styrer navigationen i vores Single-Page Application
 */
export function initRouter() {
    const appContainer = document.querySelector("#app");
    let route = window.location.hash.replace("#", "").replace("/", "");
    
    // Hvis man ikke er logget ind, tvinges man til login-siden
    if (!state.user) {
        renderLogin(appContainer);
        return;
    }

    if (route === "" || route === "login") route = "dashboard";
    
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
            appContainer.innerHTML = "<h1>Opskrifter</h1><p>Kommer snart...</p>"; 
            break;
        case "lager": 
            appContainer.innerHTML = "<h1>Lager</h1><p>Kommer snart...</p>"; 
            break;
        default: 
            renderDashboard(appContainer); 
            break;
    }
}
