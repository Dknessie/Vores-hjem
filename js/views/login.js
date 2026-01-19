import { state } from "../app.js";
import { signInWithEmailAndPassword } from "firebase/auth";

/**
 * Rendrer login-skærmen
 */
export function renderLogin(container) {
    container.innerHTML = `
        <div class="login-container">
            <div class="login-card">
                <header class="login-header">
                    <h1>Vores Hjem</h1>
                    <p>Log ind for at få adgang til husstandens data</p>
                </header>
                <form id="login-form">
                    <div class="input-group">
                        <label>E-mail</label>
                        <input type="email" id="login-email" required placeholder="din@mail.dk" value="dapela.88@gmail.com">
                    </div>
                    <div class="input-group">
                        <label>Adgangskode</label>
                        <input type="password" id="login-pass" required placeholder="••••••••">
                    </div>
                    <div id="login-error" class="error-msg" style="display:none;"></div>
                    <button type="submit" class="btn-submit w-full">Log ind</button>
                </form>
            </div>
        </div>
    `;

    const form = document.getElementById("login-form");
    form.onsubmit = async (e) => {
        e.preventDefault();
        const email = document.getElementById("login-email").value;
        const pass = document.getElementById("login-pass").value;
        const errorDiv = document.getElementById("login-error");

        try {
            await signInWithEmailAndPassword(state.auth, email, pass);
            // Routeren opdaterer automatisk pga. onAuthStateChanged i app.js
        } catch (error) {
            errorDiv.innerText = "Fejl: Forkert mail eller kode.";
            errorDiv.style.display = "block";
            console.error("Login fejl:", error);
        }
    };
}
