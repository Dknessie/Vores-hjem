import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

const COLLECTION_NAME = "loans";

/**
 * Gemmer et lån i Firestore
 */
export async function addLoan(loanData) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        // Vi gemmer ikke isGhost flaget i databasen, da ghost-lån kun er i hukommelsen
        const { isGhost, ...saveData } = loanData; 
        const docRef = await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME), saveData);
        return docRef.id;
    } catch (e) { console.error("Fejl ved oprettelse af lån:", e); }
}

/**
 * Opdaterer et lån
 */
export async function updateLoan(id, loanData) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const { isGhost, ...saveData } = loanData;
        const docRef = doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id);
        await updateDoc(docRef, saveData);
    } catch (e) { console.error("Fejl ved opdatering af lån:", e); }
}

/**
 * Henter alle rigtige lån
 */
export async function getLoans() {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const querySnapshot = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isGhost: false }));
    } catch (e) { 
        console.error("Fejl ved hentning af lån:", e);
        return []; 
    }
}

/**
 * Sletter et lån
 */
export async function deleteLoan(id) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id));
    } catch (e) { console.error("Fejl ved sletning af lån:", e); }
}

/**
 * Kernen i simulatoren: Beregner status for et lån i en given måned
 */
export function calculateLoanForMonth(loan, targetMonthStr) {
    const start = new Date(loan.startDate + "-01");
    const target = new Date(targetMonthStr + "-01");
    
    // Hvis vi kigger på en tid før lånet startede
    if (target < start) return { interest: 0, principalPaid: 0, remainingBalance: loan.principal };

    const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    const monthlyRate = (loan.interestRate / 100) / 12;
    
    let balance = loan.principal;
    let interest = 0;
    let principalPaid = 0;

    // Vi kører en løkke fra startmåned til mål-måned for at simulere renters rente og afdrag
    for (let i = 0; i <= monthsDiff; i++) {
        interest = balance * monthlyRate;
        
        // Hvis ydelsen er mindre end renten, vokser gælden (farligt, men muligt)
        // Her antager vi dog at ydelsen dækker mindst renten
        if (balance + interest <= loan.monthlyPayment) {
            principalPaid = balance;
            balance = 0;
            // Hvis lånet er betalt ud før mål-måneden, returner vi 0 i balance
            if (i < monthsDiff) {
                return { interest: 0, principalPaid: 0, remainingBalance: 0 };
            }
            break;
        } else {
            principalPaid = loan.monthlyPayment - interest;
            balance -= principalPaid;
        }
    }

    return {
        interest: Math.round(interest),
        principalPaid: Math.round(principalPaid),
        remainingBalance: Math.max(0, Math.round(balance))
    };
}

/**
 * Finder slutdatoen for et lån baseret på ydelse og rente
 */
export function getLoanEndDate(loan) {
    let balance = loan.principal;
    let date = new Date(loan.startDate + "-01");
    const monthlyRate = (loan.interestRate / 100) / 12;
    let safety = 0;
    
    // Simuler indtil balance er 0 (max 50 år / 600 mdr for at undgå infinity loops)
    while (balance > 0 && safety < 600) {
        let interest = balance * monthlyRate;
        let principalPart = loan.monthlyPayment - interest;
        
        if (principalPart <= 0 && balance > 0) return "Uendelig (Ydelse for lav)";
        
        balance -= principalPart;
        date.setMonth(date.getMonth() + 1);
        safety++;
    }
    return date.toISOString().slice(0, 7);
}
