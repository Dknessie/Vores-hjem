import { state } from "../app.js";
import { collection, addDoc, getDocs, deleteDoc, doc, updateDoc } from "firebase/firestore";

const LOAN_COLL = "loans";
const ASSET_COLL = "assets";

/**
 * LÅN OG AKTIV SERVICES
 */
export async function addLoan(data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // Sikr at nye lån altid har et array til engangsbetalinger
    const cleanData = { extraPayments: [], ...data };
    return await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL), cleanData);
}

export async function updateLoan(id, data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await updateDoc(doc(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL, id), data);
}

export async function getLoans() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const snap = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL));
    return snap.docs.map(doc => ({ 
        id: doc.id, 
        extraPayments: [], // Fallback hvis gamle lån ikke har feltet
        ...doc.data() 
    }));
}

export async function deleteLoan(id) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await deleteDoc(doc(state.db, 'artifacts', appId, 'public', 'data', LOAN_COLL, id));
}

export async function addAsset(data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    // Sikr at nye aktiver altid har et array til forbedringer
    const cleanData = { improvements: [], ...data };
    return await addDoc(collection(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL), cleanData);
}

export async function updateAsset(id, data) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return await updateDoc(doc(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL, id), data);
}

export async function getAssets() {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const snap = await getDocs(collection(state.db, 'artifacts', appId, 'public', 'data', ASSET_COLL));
    return snap.docs.map(doc => ({ 
        id: doc.id, 
        improvements: [], // Fallback hvis gamle aktiver ikke har feltet
        ...doc.data() 
    }));
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
    let lastMonthInterest = 0;
    let lastMonthPrincipal = 0;
    
    for (let i = 0; i <= monthsDiff; i++) {
        // Find aktuel måned for at tjekke engangsbeløb
        let d = new Date(start.getTime());
        d.setMonth(start.getMonth() + i);
        let yyyymm = d.toISOString().slice(0, 7);
        
        // Træk evt. engangsbeløb foretaget denne måned fra gælden
        const extra = (loan.extraPayments || [])
            .filter(p => p.date === yyyymm)
            .reduce((sum, p) => sum + p.amount, 0);
            
        balance = Math.max(0, balance - extra);

        if (balance <= 0) {
            if (i === monthsDiff) return { interest: 0, principalPaid: 0, remainingBalance: 0 };
            break; // Betalt ud før tid
        }

        lastMonthInterest = balance * monthlyRate;
        if (balance + lastMonthInterest <= loan.monthlyPayment) {
            lastMonthPrincipal = balance;
            balance = 0;
        } else {
            lastMonthPrincipal = loan.monthlyPayment - lastMonthInterest;
            balance -= lastMonthPrincipal;
        }

        if (balance <= 0 && i < monthsDiff) {
            if (i === monthsDiff) break;
            return { interest: 0, principalPaid: 0, remainingBalance: 0 };
        }
    }
    
    return { 
        interest: lastMonthInterest, 
        principalPaid: lastMonthPrincipal, 
        remainingBalance: Math.max(0, balance) 
    };
}

export function getLoanEndDate(loan) {
    let balance = loan.principal;
    let date = new Date(loan.startDate + "-01");
    const monthlyRate = (loan.interestRate / 100) / 12;
    let safety = 0;
    
    while (balance > 0 && safety < 600) {
        const yyyymm = date.toISOString().slice(0, 7);
        
        // Tjek for engangsbeløb i denne måned
        const extra = (loan.extraPayments || [])
            .filter(p => p.date === yyyymm)
            .reduce((sum, p) => sum + p.amount, 0);
            
        balance = Math.max(0, balance - extra);
        if (balance <= 0) return yyyymm; // Gældfri via engangsbeløb

        let int = balance * monthlyRate;
        let princ = loan.monthlyPayment - int;
        
        if (princ <= 0 && balance > 0) return "Aldrig"; // Renten overstiger ydelsen
        
        balance -= princ;
        if (balance <= 0) return yyyymm; // Gældfri via ordinært afdrag
        
        date.setMonth(date.getMonth() + 1);
        safety++;
    }
    return date.toISOString().slice(0, 7);
}

/**
 * Beregner menneskelig læsbar tid tilbage til gældsfrihed
 */
export function getTimeUntilDebtFree(loan, relativeToMonthStr = null) {
    const endDateStr = getLoanEndDate(loan);
    if (endDateStr === "Aldrig") return "Uendelig";
    
    const now = relativeToMonthStr ? new Date(relativeToMonthStr + "-01") : new Date();
    const end = new Date(endDateStr + "-01");
    
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
