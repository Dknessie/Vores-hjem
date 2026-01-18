import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

const COLLECTION_NAME = "budget_posts";

/**
 * Gemmer en ny budgetpost i Firestore
 */
export async function addBudgetPost(data) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME), data);
    } catch (e) {
        console.error("Fejl ved tilføjelse af post: ", e);
    }
}

/**
 * Opdaterer en eksisterende budgetpost
 */
export async function updateBudgetPost(id, data) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id);
        await updateDoc(docRef, data);
    } catch (e) {
        console.error("Fejl ved opdatering af post: ", e);
    }
}

/**
 * Henter alle budgetposter fra databasen
 */
export async function getBudgetPosts() {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const querySnapshot = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.error("Fejl ved hentning af poster: ", e);
        return [];
    }
}

/**
 * Sletter en specifik post
 */
export async function deleteBudgetPost(id) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id));
    } catch (e) {
        console.error("Fejl ved sletning: ", e);
    }
}
