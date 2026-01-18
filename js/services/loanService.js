import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

const COLLECTION_NAME = "loans";

export async function addLoan(loanData) {
    try {
        const docRef = await addDoc(collection(state.db, COLLECTION_NAME), loanData);
        return docRef.id;
    } catch (e) {
        console.error("Fejl ved tilføjelse af lån: ", e);
    }
}

export async function getLoans() {
    try {
        const querySnapshot = await getDocs(collection(state.db, COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (e) {
        console.error("Fejl ved hentning af lån: ", e);
        return [];
    }
}

export async function deleteLoan(id) {
    try {
        await deleteDoc(doc(state.db, COLLECTION_NAME, id));
    } catch (e) {
        console.error("Fejl ved sletning af lån: ", e);
    }
}

/**
 * Beregner renter og afdrag for et lån i en specifik måned
 * @param {Object} loan - Låneobjektet
 * @param {String} targetMonth - Måneden der skal beregnes for (YYYY-MM)
 */
export function calculateLoanForMonth(loan, targetMonth) {
    const start = new Date(loan.startDate + "-01");
    const target = new Date(targetMonth + "-01");
    
    if (target < start) return null;

    // Antal måneder siden start
    const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    
    let currentBalance = loan.principal;
    const monthlyRate = (loan.interestRate / 100) / 12;
    let interest = 0;
    let principalPaid = 0;

    // Vi kører en løkke fra start til den valgte måned for at finde den korrekte restgæld
    for (let i = 0; i <= monthsDiff; i++) {
        interest = currentBalance * monthlyRate;
        
        // Hvis restgæld + rente er mindre end ydelsen, er det sidste afdrag
        if (currentBalance + interest < loan.monthlyPayment) {
            principalPaid = currentBalance;
            currentBalance = 0;
            // Hvis vi er forbi slutdatoen, returner null
            if (i < monthsDiff) return null; 
            break;
        } else {
            principalPaid = loan.monthlyPayment - interest;
            currentBalance -= principalPaid;
        }
        
        // Hvis vi når 0 før target month, er lånet slut
        if (currentBalance <= 0 && i < monthsDiff) return null;
    }

    return {
        interest: Math.round(interest),
        principalPaid: Math.round(principalPaid),
        remainingBalance: Math.round(currentBalance)
    };
}
