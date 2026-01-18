import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

const COLLECTION_NAME = "loans";

export async function addLoan(loanData) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME), loanData);
        return docRef.id;
    } catch (e) { console.error(e); }
}

export async function updateLoan(id, loanData) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id);
        await updateDoc(docRef, loanData);
    } catch (e) { console.error(e); }
}

export async function getLoans() {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const querySnapshot = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME));
        return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) { return []; }
}

export async function deleteLoan(id) {
    try {
        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', COLLECTION_NAME, id));
    } catch (e) { console.error(e); }
}

export function calculateLoanForMonth(loan, targetMonth) {
    const start = new Date(loan.startDate + "-01");
    const target = new Date(targetMonth + "-01");
    if (target < start) return null;

    const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    const monthlyRate = (loan.interestRate / 100) / 12;
    
    let balance = loan.principal;
    let interest = 0;
    let principalPaid = 0;

    for (let i = 0; i <= monthsDiff; i++) {
        interest = balance * monthlyRate;
        if (balance + interest <= loan.monthlyPayment) {
            principalPaid = balance;
            balance = 0;
            if (i < monthsDiff) return null;
            break;
        } else {
            principalPaid = loan.monthlyPayment - interest;
            balance -= principalPaid;
        }
        if (balance <= 0 && i < monthsDiff) return null;
    }

    return {
        interest: Math.round(interest),
        principalPaid: Math.round(principalPaid),
        remainingBalance: Math.max(0, Math.round(balance))
    };
}

export function getLoanEndDate(loan) {
    let balance = loan.principal;
    let date = new Date(loan.startDate + "-01");
    const monthlyRate = (loan.interestRate / 100) / 12;
    let safety = 0;
    while (balance > 0 && safety < 600) {
        let interest = balance * monthlyRate;
        balance -= (loan.monthlyPayment - interest);
        date.setMonth(date.getMonth() + 1);
        safety++;
    }
    return date.toISOString().slice(0, 7);
}
