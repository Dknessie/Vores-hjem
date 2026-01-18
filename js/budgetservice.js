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
 * Henter alle budgetposter
 */
export async function getBudgetPosts() {
    const querySnapshot = await getDocs(collection(state.db, COLLECTION_NAME));
    return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Sletter en post
 */
export async function deleteBudgetPost(id) {
    try {
        await deleteDoc(doc(state.db, COLLECTION_NAME, id));
    } catch (e) {
        console.error("Fejl ved sletning: ", e);
    }
}
