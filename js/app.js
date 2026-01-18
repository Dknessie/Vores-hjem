import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { firebaseConfig } from "./firebase-config.js";
import { initRouter } from "./router.js";

export const state = { user: null, db: null, auth: null };
const app = initializeApp(firebaseConfig);
state.db = getFirestore(app);
state.auth = getAuth(app);

function init() {
    initRouter();
    document.addEventListener("click", e => {
        const link = e.target.closest("[data-link]");
        if (link) {
            e.preventDefault();
            window.location.hash = link.getAttribute("data-link");
            initRouter();
        }
    });
}
document.addEventListener("DOMContentLoaded", init);
window.addEventListener("hashchange", initRouter);
