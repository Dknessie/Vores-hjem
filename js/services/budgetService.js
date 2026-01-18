import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

const COLLECTION_NAME = "budget_posts";

/**
 * Gemmer en ny budgetpost i Firestore
 */
export async function addBudgetPost(postData) {
    try {
        const docRef = await addDoc(collection(state.db, COLLECTION_NAME), postData);
        return docRef.id;
    } catch (e) {
        console.error("Fejl ved tilføjelse af post: ", e);
    }
}

/**
 * Henter alle budgetposter fra databasen
 */
export async function getBudgetPosts() {
    try {
        const querySnapshot = await getDocs(collection(state.db, COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
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
        await deleteDoc(doc(state.db, COLLECTION_NAME, id));
    } catch (e) {
        console.error("Fejl ved sletning: ", e);
    }
}
