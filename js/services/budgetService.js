import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, setDoc, getDoc } from "firebase/firestore";

const COLLECTION_NAME = "budget_posts";
const TARGETS_COLLECTION = "budget_targets";

/**
 * Tilføjer en manuel budgetpost
 */
export async function addBudgetPost(data) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME), data);
    } catch (e) { console.error("Fejl ved tilføjelse:", e); }
}

/**
 * Opdaterer en manuel budgetpost
 */
export async function updateBudgetPost(id, data) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await updateDoc(doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id), data);
    } catch (e) { console.error("Fejl ved opdatering:", e); }
}

/**
 * Henter alle manuelle budgetposter
 */
export async function getBudgetPosts() {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const querySnapshot = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { return []; }
}

/**
 * Sletter en budgetpost
 */
export async function deleteBudgetPost(id) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id));
    } catch (e) { console.error("Fejl ved sletning:", e); }
}

/**
 * Gemmer budgetmål specifikt for en ejer (Mig, Kæreste, Fælles)
 */
export async function saveBudgetTargets(owner, targets) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        // Vi gemmer nu under dokumentet for den specifikke ejer
        const docRef = doc(state.db, 'artifacts', appId, 'public', 'data', TARGETS_COLLECTION, `targets_${owner}`);
        await setDoc(docRef, targets);
    } catch (e) { console.error("Fejl ved gem af budgetmål:", e); }
}

/**
 * Henter budgetmål for en specifik ejer
 */
export async function getBudgetTargets(owner) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(state.db, 'artifacts', appId, 'public', 'data', TARGETS_COLLECTION, `targets_${owner}`);
        const snap = await getDoc(docRef);
        return snap.exists() ? snap.data() : null;
    } catch (e) { return null; }
}
