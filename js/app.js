import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";
import { initRouter } from "./router.js";

// Central state for applikationen
export const state = { 
    user: null, 
    db: null, 
    auth: null,
    appId: typeof __app_id !== 'undefined' ? __app_id : 'vores-hjem-default'
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);
state.db = getFirestore(app);
state.auth = getAuth(app);

function init() {
    // Lyt efter login-status før vi starter routeren
    onAuthStateChanged(state.auth, (user) => {
        state.user = user;
        updateNavVisibility();
        initRouter();
    });

    // Global klik-håndtering til navigation
    document.addEventListener("click", e => {
        const link = e.target.closest("[data-link]");
        if (link) {
            e.preventDefault();
            const route = link.getAttribute("data-link");
            window.location.hash = route;
        }

        // Håndter logout
        if (e.target.id === "logout-btn") {
            signOut(state.auth);
        }
    });
}

/**
 * Opdaterer navigationsmenuen baseret på om man er logget ind
 */
function updateNavVisibility() {
    const navLinks = document.querySelector(".nav-links");
    const loginLink = document.querySelector('[data-link="login"]');
    
    if (state.user) {
        navLinks.style.display = "flex";
        if (loginLink) loginLink.style.display = "none";
        // Tilføj logout knap hvis den ikke findes
        if (!document.getElementById("logout-btn")) {
            const logoutLi = document.createElement("li");
            logoutLi.id = "logout-btn";
            logoutLi.innerText = "Log ud";
            logoutLi.style.color = "#bc6c25"; // Danger red / orange
            navLinks.appendChild(logoutLi);
        }
    } else {
        navLinks.style.display = "none";
        // Vi viser kun login-siden via routeren
    }
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", initRouter);
