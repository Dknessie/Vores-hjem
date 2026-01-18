import { renderDashboard } from "./views/dashboard.js";

/**
 * Router-modul - Nu optimeret til at bruge hash-routing for at undgå 404 fejl
 */
export function initRouter() {
    const appContainer = document.querySelector("#app");
    
    // Hent ruten fra URL hash (f.eks. #opskrifter), fjern '#' og '/'
    let route = window.location.hash.replace("#", "").replace("/", "");
    
    // Standard rute hvis tom
    if (route === "" || route === "." || route === "./") {
        route = "dashboard";
    }

    // Ryd containeren
    appContainer.innerHTML = "";

    // Routing logik
    switch (route) {
        case "dashboard":
            renderDashboard(appContainer);
            break;
        case "opskrifter":
            appContainer.innerHTML = "<h1>Opskrifter</h1><p>Her kommer dine opskrifter og madplan.</p>";
            break;
        case "lager":
            appContainer.innerHTML = "<h1>Lager</h1><p>Oversigt over dit lager og hvad der mangler.</p>";
            break;
        case "projekter":
            appContainer.innerHTML = "<h1>Projekter</h1><p>Hold styr på husets små og store opgaver.</p>";
            break;
        case "budget":
            appContainer.innerHTML = "<h1>Budget & Formue</h1><p>Økonomisk overblik for husstanden.</p>";
            break;
        default:
            // Hvis vi ikke kender ruten, gå til dashboard
            renderDashboard(appContainer);
            break;
    }
}