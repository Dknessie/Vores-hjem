import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

const LOAN_COLL = "loans";
const ASSET_COLL = "assets";

/**
 * LÅN OG AKTIV SERVICES
 */
export async function addLoan(data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL), data);
}

export async function updateLoan(id, data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await updateDoc(doc(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL, id), data);
}

export async function getLoans() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const snap = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteLoan(id) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL, id));
}

export async function addAsset(data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL), data);
}

export async function updateAsset(id, data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await updateDoc(doc(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL, id), data);
}

export async function getAssets() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const snap = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function deleteAsset(id) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL, id));
}

/**
 * AVANCERET MATEMATIK TIL SIMULERING OG STATUS
 */

export function calculateLoanForMonth(loan, targetMonthStr) {
    const start = new Date(loan.startDate + "-01");
    const target = new Date(targetMonthStr + "-01");
    if (target < start) return { interest: 0, principalPaid: 0, remainingBalance: loan.principal };
    
    const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12 + (target.getMonth() - start.getMonth());
    const monthlyRate = (loan.interestRate / 100) / 12;
    let balance = loan.principal;
    let interest = 0, principalPaid = 0;
    
    for (let i = 0; i <= monthsDiff; i++) {
        interest = balance * monthlyRate;
        if (balance + interest <= loan.monthlyPayment) {
            principalPaid = balance; balance = 0;
            if (i < monthsDiff) return { interest: 0, principalPaid: 0, remainingBalance: 0 };
            break;
        } else {
            principalPaid = loan.monthlyPayment - interest;
            balance -= principalPaid;
        }
    }
    return { interest, principalPaid, remainingBalance: Math.max(0, balance) };
}

export function getLoanEndDate(loan) {
    let balance = loan.principal;
    let date = new Date(loan.startDate + "-01");
    const monthlyRate = (loan.interestRate / 100) / 12;
    let safety = 0;
    while (balance > 0 && safety < 600) {
        let int = balance * monthlyRate;
        let princ = loan.monthlyPayment - int;
        if (princ <= 0) return "Aldrig";
        balance -= princ;
        date.setMonth(date.getMonth() + 1);
        safety++;
    }
    return date.toISOString().slice(0, 7);
}

/**
 * Beregner menneskelig læsbar tid tilbage til gældsfrihed
 * @param {Object} loan - Låneobjektet
 * @param {String} relativeToMonthStr - Valgfri måned (YYYY-MM) som beregningen skal tage udgangspunkt i
 */
export function getTimeUntilDebtFree(loan, relativeToMonthStr = null) {
    const endDateStr = getLoanEndDate(loan);
    if (endDateStr === "Aldrig") return "Uendelig";
    
    // Brug den simulerede måned hvis den findes, ellers dags dato
    const now = relativeToMonthStr ? new Date(relativeToMonthStr + "-01") : new Date();
    const end = new Date(endDateStr + "-01");
    
    // Hvis vi er nået til eller forbi slutdatoen i simulationen
    if (end <= now) return "Betalt";
    
    const totalMonths = (end.getFullYear() - now.getFullYear()) * 12 + (end.getMonth() - now.getMonth());
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    
    let result = "";
    if (years > 0) result += `${years} år `;
    if (months > 0) result += `${months} mdr.`;
    if (result === "") result = "Under 1 md.";
    
    return result;
}
