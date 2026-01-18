import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";
import { initRouter } from "./router.js";

/**
 * Global App State
 * Her gemmer vi data, der skal være tilgængelige på tværs af moduler
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

/**
 * Start applikationen
 */
function init() {
    console.log("Applikation startet...");
    
    // Start routeren der håndterer visninger
    initRouter();
    
    // Håndtering af navigationstryk (Event Delegation)
    document.addEventListener("click", e => {
        if (e.target.matches("[data-link]")) {
            e.preventDefault();
            const route = e.target.getAttribute("data-link");
            navigateTo(route);
        }
    });
}

/**
 * Funktion til at skifte side uden reload
 */
export function navigateTo(url) {
    history.pushState(null, null, url);
    initRouter();
}

// Vent på at DOM'en er klar
document.addEventListener("DOMContentLoaded", init);

// Håndtér "Back"-knappen i browseren
window.addEventListener("popstate", initRouter);