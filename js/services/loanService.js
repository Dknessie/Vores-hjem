import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc } from "firebase/firestore";

const COLLECTION_NAME = "loans";

/**
 * Gemmer et nyt lån i databasen
 */
export async function addLoan(loanData) {
    try {
        const docRef = await addDoc(collection(state.db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME), loanData);
        return docRef.id;
    } catch (e) {
        console.error("Fejl ved oprettelse: ", e);
    }
}

/**
 * Henter alle lån
 */
export async function getLoans() {
    try {
        const querySnapshot = await getDocs(collection(state.db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
    } catch (e) {
        console.error("Fejl ved hentning: ", e);
        return [];
    }
}

/**
 * Sletter et lån
 */
export async function deleteLoan(id) {
    try {
        await deleteDoc(doc(state.db, 'artifacts', typeof __app_id !== 'undefined' ? __app_id : 'default-app-id', 'public', 'data', COLLECTION_NAME, id));
    } catch (e) {
        console.error("Fejl ved sletning: ", e);
    }
}

/**
 * Beregner amortisering for en specifik måned
 */
export function calculateLoanForMonth(loan, targetMonth) {
    const start = new Date(loan.startDate + "-01");
    const target = new Date(targetMonth + "-01");
    
    if (target < start) return null;

    const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    const monthlyRate = (loan.interestRate / 100) / 12;
    
    let currentBalance = loan.principal;
    let interest = 0;
    let principalPaid = 0;

    for (let i = 0; i <= monthsDiff; i++) {
        interest = currentBalance * monthlyRate;
        
        if (currentBalance + interest <= loan.monthlyPayment) {
            principalPaid = currentBalance;
            currentBalance = 0;
            if (i < monthsDiff) return null; // Lånet er slut tidligere
            break;
        } else {
            principalPaid = loan.monthlyPayment - interest;
            currentBalance -= principalPaid;
        }
        if (currentBalance <= 0 && i < monthsDiff) return null;
    }

    return {
        interest: Math.round(interest),
        principalPaid: Math.round(principalPaid),
        remainingBalance: Math.max(0, Math.round(currentBalance))
    };
}

/**
 * Finder slutdatoen for et lån
 */
export function getLoanEndDate(loan) {
    let balance = loan.principal;
    let date = new Date(loan.startDate + "-01");
    const monthlyRate = (loan.interestRate / 100) / 12;
    let safety = 0;

    while (balance > 0 && safety < 600) {
        let interest = balance * monthlyRate;
        let principalPaid = loan.monthlyPayment - interest;
        balance -= principalPaid;
        date.setMonth(date.getMonth() + 1);
        safety++;
    }
    return date.toISOString().slice(0, 7);
}
