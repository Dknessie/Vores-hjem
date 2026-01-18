import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";
import { initRouter } from "./router.js";

/**
 * Global App State
 */
export const state = {
    user: null,
    currentView: 'dashboard',
    db: null,
    auth: null
};

// Initialisér Firebase
const app = initializeApp(firebaseConfig);
state.db = getFirestore(app);
state.auth = getAuth(app);

function init() {
    console.log("Vores Hjem initialiseret...");
    
    // Start routeren
    initRouter();
    
    // Event delegation til navigation
    document.addEventListener("click", e => {
        const link = e.target.closest("[data-link]");
        if (link) {
            e.preventDefault();
            const route = link.getAttribute("data-link");
            navigateTo(route);
        }
    });
}

/**
 * Navigations-funktion der håndterer relative stier til GitHub Pages
 */
export function navigateTo(url) {
    // Hvis vi er på GitHub Pages, skal vi bevare undermappen i URL'en
    const path = window.location.pathname.substring(0, window.location.pathname.lastIndexOf('/') + 1);
    
    // Vi bruger hash-baseret routing som backup for at undgå 404 på GitHub
    window.location.hash = url;
    initRouter();
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", initRouter);