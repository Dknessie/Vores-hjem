import { renderDashboard } from "./views/dashboard.js";

/**
 * Router-modul
 * Bestemmer hvilken kode der skal køre baseret på URL'en
 */
export function initRouter() {
    const path = window.location.pathname;
    const appContainer = document.querySelector("#app");

    // Ryd containeren før vi tegner nyt indhold
    appContainer.innerHTML = "";

    // Simpel routing logik
    switch (path) {
        case "/":
        case "/index.html":
            renderDashboard(appContainer);
            break;
        case "/opskrifter":
            appContainer.innerHTML = "<h1>Opskrifter</h1><p>Kommer snart...</p>";
            break;
        case "/lager":
            appContainer.innerHTML = "<h1>Lager</h1><p>Kommer snart...</p>";
            break;
        case "/projekter":
            appContainer.innerHTML = "<h1>Projekter</h1><p>Kommer snart...</p>";
            break;
        case "/budget":
            appContainer.innerHTML = "<h1>Budget & Formue</h1><p>Kommer snart...</p>";
            break;
        default:
            appContainer.innerHTML = "<h1>404</h1><p>Siden blev ikke fundet.</p>";
            break;
    }
}