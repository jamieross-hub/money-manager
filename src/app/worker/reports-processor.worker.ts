/// <reference lib="webworker" />
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';

dayjs.extend(isBetween);

// Copying necessary interfaces from the main thread
export interface CategoryBreakdownItem {
    categoryId: string;
    categoryName: string;
    categoryIcon: string;
    categoryColor: string;
    amount: number;
    percentage: number;
    transactionCount: number;
}

export interface MonthlySummary {
    month: number;      // 0-11
    year: number;
    label: string;      // "Jan 2025"
    income: number;
    expense: number;
    savings: number;
    savingsRate: number; // %
    categoryBreakdown: CategoryBreakdownItem[];
    incomeCategoryBreakdown: CategoryBreakdownItem[];
}

export interface PeriodSummary {
    label: string;
    income: number;
    expense: number;
    savings: number;
    savingsRate: number;
    avgMonthlySpending: number;
    avgMonthlyIncome: number;
    topCategory: CategoryBreakdownItem | null;
    categoryBreakdown: CategoryBreakdownItem[];
    incomeCategoryBreakdown: CategoryBreakdownItem[];
    expenseGrowth: number | null;
}

export interface Prediction {
    label: string;
    predictedExpense: number;
    predictedIncome: number;
    predictedSavings: number;
    confidence: 'low' | 'medium' | 'high';
    trend: 'increasing' | 'decreasing' | 'stable';
    overspendCategories: CategoryBreakdownItem[];
}

const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

// ── Global Worker Cache ──
let cachedTransactions: any[] = [];
let cachedBaseFingerprint = '';
let cachedMonthlySummaries: MonthlySummary[] = [];
let cachedIconMap: any = {};
let cachedColorMap: any = {};
let cachedGroupMap: any = {};
let cachedAvgMonthlySpending = 0;
let cachedHighestSpendingCategory: CategoryBreakdownItem | null = null;
let cachedOverallSavingsRate = 0;
let cachedAvailableYears: number[] = [];
let cachedNextMonthPrediction: Prediction | null = null;
let cachedNext3MonthsPrediction: Prediction | null = null;
let cachedYearEndPrediction: Prediction | null = null;

addEventListener('message', ({ data }) => {
    const { 
        transactions, 
        currentUserId,
        selectedPeriod, 
        selectedYear, 
        selectedMonth, 
        selectedWeekOffset,
        categoryIconMap,
        categoryColorMap,
        categoryGroupMap,
        isIncomeCollapsed: extIncomeCollapsed,
        isAccountsCollapsed: extAccountsCollapsed,
        isExpenseCollapsed: extExpenseCollapsed,
        cachedBase,
        baseFingerprint
    } = data;

    const startTime = performance.now();
    let baseRecalculated = false;

    // 1. Update Worker Cache if fingerprint changes or new data arrives
    if (baseFingerprint && baseFingerprint !== cachedBaseFingerprint) {
        if (transactions && transactions.length > 0) {
            cachedTransactions = transactions;
            cachedBaseFingerprint = baseFingerprint;
            baseRecalculated = true;
        }
    }

    if (categoryIconMap) cachedIconMap = categoryIconMap;
    if (categoryColorMap) cachedColorMap = categoryColorMap;
    if (categoryGroupMap) cachedGroupMap = categoryGroupMap;

    let monthlySummaries: MonthlySummary[] = [];
    let availableYears: number[] = [];
    let avgMonthlySpending = 0;
    let highestSpendingCategory: CategoryBreakdownItem | null = null;
    let overallSavingsRate = 0;
    let nextMonthPrediction: Prediction | null = null;
    let next3MonthsPrediction: Prediction | null = null;
    let yearEndPrediction: Prediction | null = null;

    let isIncomeCollapsed = extIncomeCollapsed;
    let isAccountsCollapsed = extAccountsCollapsed;
    let isExpenseCollapsed = extExpenseCollapsed;

    if (cachedBase && !baseRecalculated) {
        // Use provided external cache (from IndexedDB via main thread)
        monthlySummaries = cachedBase.monthlySummaries || [];
        availableYears = cachedBase.availableYears || [];
        avgMonthlySpending = cachedBase.avgMonthlySpending || 0;
        highestSpendingCategory = cachedBase.highestSpendingCategory || null;
        overallSavingsRate = cachedBase.overallSavingsRate || 0;
        nextMonthPrediction = cachedBase.nextMonthPrediction || null;
        next3MonthsPrediction = cachedBase.next3MonthsPrediction || null;
        yearEndPrediction = cachedBase.yearEndPrediction || null;
        
        // Sync worker's internal cache
        cachedMonthlySummaries = monthlySummaries;
        cachedAvailableYears = availableYears;
        cachedAvgMonthlySpending = avgMonthlySpending;
        cachedHighestSpendingCategory = highestSpendingCategory;
        cachedOverallSavingsRate = overallSavingsRate;
        cachedNextMonthPrediction = nextMonthPrediction;
        cachedNext3MonthsPrediction = next3MonthsPrediction;
        cachedYearEndPrediction = yearEndPrediction;
    } else if (baseRecalculated) {
        // Full recalculation
        monthlySummaries = buildMonthlySummaries(cachedTransactions, cachedIconMap, cachedColorMap);

        const yearSet = new Set<number>();
        for (const m of monthlySummaries) {
            yearSet.add(m.year);
        }
        availableYears = Array.from(yearSet).sort((a, b) => b - a);

        const totalExpense = monthlySummaries.reduce((s, m) => s + m.expense, 0);
        const totalIncome = monthlySummaries.reduce((s, m) => s + m.income, 0);
        avgMonthlySpending = monthlySummaries.length > 0 ? totalExpense / monthlySummaries.length : 0;
        overallSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

        const catMap = new Map<string, CategoryBreakdownItem>();
        for (const m of monthlySummaries) {
            for (const c of m.categoryBreakdown) {
                if (!catMap.has(c.categoryId)) {
                    catMap.set(c.categoryId, { ...c, amount: 0, transactionCount: 0, percentage: 0 });
                }
                const existing = catMap.get(c.categoryId)!;
                existing.amount += c.amount;
                existing.transactionCount += c.transactionCount;
            }
        }
        const allCats = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
        if (totalIncome > 0) {
            allCats.forEach(c => c.percentage = (c.amount / totalIncome) * 100);
        }
        highestSpendingCategory = allCats.length > 0 ? allCats[0] : null;

        const predictions = computePredictions(
            monthlySummaries,
            cachedIconMap,
            cachedColorMap,
            cachedGroupMap
        );
        nextMonthPrediction = predictions.nextMonthPrediction;
        next3MonthsPrediction = predictions.next3MonthsPrediction;
        yearEndPrediction = predictions.yearEndPrediction;

        // Update internal cache
        cachedMonthlySummaries = monthlySummaries;
        cachedAvailableYears = availableYears;
        cachedAvgMonthlySpending = avgMonthlySpending;
        cachedHighestSpendingCategory = highestSpendingCategory;
        cachedOverallSavingsRate = overallSavingsRate;
        cachedNextMonthPrediction = nextMonthPrediction;
        cachedNext3MonthsPrediction = next3MonthsPrediction;
        cachedYearEndPrediction = yearEndPrediction;
    } else {
        // Fallback to internal cache if no external cache and no fingerprint change
        monthlySummaries = cachedMonthlySummaries;
        availableYears = cachedAvailableYears;
        avgMonthlySpending = cachedAvgMonthlySpending;
        highestSpendingCategory = cachedHighestSpendingCategory;
        overallSavingsRate = cachedOverallSavingsRate;
        nextMonthPrediction = cachedNextMonthPrediction;
        next3MonthsPrediction = cachedNext3MonthsPrediction;
        yearEndPrediction = cachedYearEndPrediction;
    }

    // 4. Compute Period Summary (Always compute, depends on filters)
    const { currentPeriodSummary, previousPeriodSummary, filteredMonthlySummaries, currentPeriodTransactions } = computePeriodSummaries(
        cachedTransactions || [], 
        monthlySummaries, 
        selectedPeriod, 
        selectedYear, 
        selectedMonth, 
        selectedWeekOffset,
        cachedIconMap,
        cachedColorMap
    );

    postMessage({
        monthlySummaries,
        availableYears,
        avgMonthlySpending,
        highestSpendingCategory,
        overallSavingsRate,
        currentPeriodSummary,
        previousPeriodSummary,
        filteredMonthlySummaries,
        currentPeriodTransactions, // Send this back so component doesn't have to re-filter
        nextMonthPrediction,
        next3MonthsPrediction,
        yearEndPrediction,
        isIncomeCollapsed,
        isAccountsCollapsed,
        isExpenseCollapsed,
        baseRecalculated,
        baseFingerprint,
        durationMs: performance.now() - startTime
    });
});

function toDate(date: any): Date | null {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'string') return new Date(date);
    if (date && typeof date.toDate === 'function') return date.toDate();
    if (date && date.seconds) return new Date(date.seconds * 1000);
    if (typeof date === 'number') return new Date(date);
    return null;
}

function buildMonthlySummaries(transactions: any[], iconMap: any, colorMap: any): MonthlySummary[] {
    const map = new Map<string, { income: number; expense: number; categories: Map<string, CategoryBreakdownItem> }>();

    for (const t of transactions) {
        const d = toDate(t.date);
        if (!d) continue;

        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (!map.has(key)) {
            map.set(key, { income: 0, expense: 0, incomeCategories: new Map(), expenseCategories: new Map() });
        }
        const entry = map.get(key)! as any;
        const catKey = t.categoryId || t.category || 'Uncategorized';
        const catName = t.category || 'Uncategorized';

        if (t.type === 'income') {
            entry.income += t.amount;
            if (!entry.incomeCategories.has(catKey)) {
                entry.incomeCategories.set(catKey, { 
                    categoryId: catKey, 
                    categoryName: catName, 
                    categoryIcon: iconMap[catKey] || 'category', 
                    categoryColor: colorMap[catKey] || '#9ca3af', 
                    amount: 0, 
                    percentage: 0, 
                    transactionCount: 0 
                });
            }
            const cat = entry.incomeCategories.get(catKey)!;
            cat.amount += t.amount;
            cat.transactionCount += 1;
        } else if (t.type === 'expense') {
            entry.expense += t.amount;
            if (!entry.expenseCategories.has(catKey)) {
                entry.expenseCategories.set(catKey, { 
                    categoryId: catKey, 
                    categoryName: catName, 
                    categoryIcon: iconMap[catKey] || 'category', 
                    categoryColor: colorMap[catKey] || '#9ca3af', 
                    amount: 0, 
                    percentage: 0, 
                    transactionCount: 0 
                });
            }
            const cat = entry.expenseCategories.get(catKey)!;
            cat.amount += t.amount;
            cat.transactionCount += 1;
        }
    }

    const summaries: MonthlySummary[] = [];
    for (const [key, val] of map as any) {
        const [yearStr, monthStr] = key.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const savings = val.income - val.expense;
        const savingsRate = val.income > 0 ? (savings / val.income) * 100 : 0;

        const expenseCategories = Array.from(val.expenseCategories.values()) as CategoryBreakdownItem[];
        const incomeCategories = Array.from(val.incomeCategories.values()) as CategoryBreakdownItem[];

        if (val.expense > 0) {
            expenseCategories.forEach(c => c.percentage = (c.amount / val.expense) * 100);
        }
        if (val.income > 0) {
            incomeCategories.forEach(c => c.percentage = (c.amount / val.income) * 100);
        }
        
        expenseCategories.sort((a, b) => b.amount - a.amount);
        incomeCategories.sort((a, b) => b.amount - a.amount);

        summaries.push({
            month, year,
            label: `${MONTHS[month]} ${year}`,
            income: val.income,
            expense: val.expense,
            savings,
            savingsRate,
            categoryBreakdown: expenseCategories,
            incomeCategoryBreakdown: incomeCategories
        });
    }

    summaries.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
    });

    return summaries;
}

function computePeriodSummaries(
    transactions: any[],
    monthlySummaries: MonthlySummary[],
    selectedPeriod: 'weekly' | 'monthly' | 'yearly' | 'all',
    selectedYear: number,
    selectedMonth: number | null,
    selectedWeekOffset: number,
    iconMap: any,
    colorMap: any
) {
    const now = new Date();
    const year = selectedYear;
    let currentMonths: MonthlySummary[] = [];
    let previousMonths: MonthlySummary[] = [];
    let currentPeriodTransactions: any[] = [];

    if (selectedPeriod === 'monthly') {
        const currentMonth = selectedMonth !== null ? selectedMonth : (year === now.getFullYear() ? now.getMonth() : 0);
        currentMonths = monthlySummaries.filter(m => m.month === currentMonth && m.year === year);
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? year - 1 : year;
        previousMonths = monthlySummaries.filter(m => m.month === prevMonth && m.year === prevYear);

        currentPeriodTransactions = transactions.filter(t => {
            const date = toDate(t.date);
            return date && date.getFullYear() === year && date.getMonth() === currentMonth;
        });
    } else if (selectedPeriod === 'weekly') {
        const startOfCurrentWeek = dayjs().add(selectedWeekOffset, 'week').startOf('week');
        const endOfCurrentWeek = dayjs().add(selectedWeekOffset, 'week').endOf('week');
        const startOfPrevWeek = dayjs().add(selectedWeekOffset - 1, 'week').startOf('week');
        const endOfPrevWeek = dayjs().add(selectedWeekOffset - 1, 'week').endOf('week');

        currentPeriodTransactions = transactions.filter(t => {
            const d = dayjs(toDate(t.date));
            return d.isAfter(startOfCurrentWeek.subtract(1, 'millisecond')) && d.isBefore(endOfCurrentWeek.add(1, 'millisecond'));
        });

        const prevTransactions = transactions.filter(t => {
            const d = dayjs(toDate(t.date));
            return d.isAfter(startOfPrevWeek.subtract(1, 'millisecond')) && d.isBefore(endOfPrevWeek.add(1, 'millisecond'));
        });

        currentMonths = buildAdhocSummary(currentPeriodTransactions, iconMap, colorMap);
        previousMonths = buildAdhocSummary(prevTransactions, iconMap, colorMap);
    } else if (selectedPeriod === 'all') {
        currentMonths = monthlySummaries;
        previousMonths = [];
        currentPeriodTransactions = transactions;
    } else {
        currentMonths = monthlySummaries.filter(m => m.year === year);
        previousMonths = monthlySummaries.filter(m => m.year === year - 1);
        currentPeriodTransactions = transactions.filter(t => {
            const date = toDate(t.date);
            return date && date.getFullYear() === year;
        });
    }

    const currentPeriodSummary = aggregatePeriod(currentMonths, getPeriodLabel('current', selectedPeriod, selectedYear, selectedMonth, selectedWeekOffset), iconMap, colorMap);
    const previousPeriodSummary = aggregatePeriod(previousMonths, getPeriodLabel('previous', selectedPeriod, selectedYear, selectedMonth, selectedWeekOffset), iconMap, colorMap);

    if (currentPeriodSummary && previousPeriodSummary && previousPeriodSummary.expense > 0) {
        currentPeriodSummary.expenseGrowth =
            ((currentPeriodSummary.expense - previousPeriodSummary.expense) / previousPeriodSummary.expense) * 100;
    }

    let filteredHistory: MonthlySummary[] = [];

    if (selectedPeriod === 'yearly') {
        const yearGroups = new Map<number, MonthlySummary>();
        for (const m of monthlySummaries) {
            if (!yearGroups.has(m.year)) {
                yearGroups.set(m.year, { 
                    year: m.year, month: 0, label: m.year.toString(), 
                    income: 0, expense: 0, savings: 0, savingsRate: 0, categoryBreakdown: [] 
                });
            }
            const g = yearGroups.get(m.year)!;
            g.income += m.income;
            g.expense += m.expense;
            g.savings += m.savings;
        }
        filteredHistory = Array.from(yearGroups.values()).map(g => ({
            ...g,
            savingsRate: g.income > 0 ? (g.savings / g.income) * 100 : 0
        })).sort((a, b) => b.year - a.year);
    } else if (selectedPeriod === 'weekly') {
        const weekGroups = new Map<string, MonthlySummary & { date: Date }>();
        const yearTxns = transactions.filter(t => {
            const d = toDate(t.date);
            return d && d.getFullYear() === selectedYear;
        });

        for (const t of yearTxns) {
            const d = dayjs(toDate(t.date));
            const startOfWeek = d.startOf('week');
            const key = startOfWeek.format('YYYY-MM-DD');
            if (!weekGroups.has(key)) {
                weekGroups.set(key, { 
                    label: startOfWeek.format('D MMM'), 
                    income: 0, expense: 0, savings: 0, savingsRate: 0, 
                    categoryBreakdown: [],
                    month: startOfWeek.month(),
                    year: startOfWeek.year(),
                    date: startOfWeek.toDate()
                });
            }
            const g = weekGroups.get(key)!;
            if (t.type === 'income') g.income += t.amount;
            else if (t.type === 'expense') g.expense += t.amount;
            g.savings = g.income - g.expense;
        }

        filteredHistory = Array.from(weekGroups.values()).map(g => ({
            ...g,
            savingsRate: g.income > 0 ? (g.savings / g.income) * 100 : 0
        })).sort((a, b) => b.date.getTime() - a.date.getTime());
    } else if (selectedPeriod === 'all') {
        filteredHistory = monthlySummaries;
    } else {
        filteredHistory = monthlySummaries.filter(m => m.year === selectedYear);
    }

    const filteredMonthlySummaries = filteredHistory;

    return { currentPeriodSummary, previousPeriodSummary, filteredMonthlySummaries, currentPeriodTransactions };
}

function buildAdhocSummary(txns: any[], iconMap: any, colorMap: any): MonthlySummary[] {
    if (txns.length === 0) return [];
    let income = 0;
    let expense = 0;
    const expenseCatMap = new Map<string, CategoryBreakdownItem>();
    const incomeCatMap = new Map<string, CategoryBreakdownItem>();

    for (const t of txns) {
        const catKey = t.categoryId || t.category || 'Uncategorized';
        const catName = t.category || 'Uncategorized';

        if (t.type === 'income') {
            income += t.amount;
            if (!incomeCatMap.has(catKey)) {
                incomeCatMap.set(catKey, { 
                    categoryId: catKey, 
                    categoryName: catName, 
                    categoryIcon: iconMap[catKey] || 'category', 
                    categoryColor: colorMap[catKey] || '#9ca3af', 
                    amount: 0, 
                    percentage: 0, 
                    transactionCount: 0 
                });
            }
            const cat = incomeCatMap.get(catKey)!;
            cat.amount += t.amount;
            cat.transactionCount += 1;
        } else if (t.type === 'expense') {
            expense += t.amount;
            if (!expenseCatMap.has(catKey)) {
                expenseCatMap.set(catKey, { 
                    categoryId: catKey, 
                    categoryName: catName, 
                    categoryIcon: iconMap[catKey] || 'category', 
                    categoryColor: colorMap[catKey] || '#9ca3af', 
                    amount: 0, 
                    percentage: 0, 
                    transactionCount: 0 
                });
            }
            const cat = expenseCatMap.get(catKey)!;
            cat.amount += t.amount;
            cat.transactionCount += 1;
        }
    }

    const expenseCategories = Array.from(expenseCatMap.values());
    const incomeCategories = Array.from(incomeCatMap.values());
    
    if (expense > 0) expenseCategories.forEach(c => c.percentage = (c.amount / expense) * 100);
    if (income > 0) incomeCategories.forEach(c => c.percentage = (c.amount / income) * 100);
    
    expenseCategories.sort((a, b) => b.amount - a.amount);
    incomeCategories.sort((a, b) => b.amount - a.amount);

    return [{
        month: 0, year: 0, label: '', income, expense, savings: income - expense,
        savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
        categoryBreakdown: expenseCategories,
        incomeCategoryBreakdown: incomeCategories
    }];
}

function aggregatePeriod(months: MonthlySummary[], label: string, iconMap: any, colorMap: any): PeriodSummary | null {
    if (months.length === 0) return null;

    const income = months.reduce((s, m) => s + m.income, 0);
    const expense = months.reduce((s, m) => s + m.expense, 0);
    const savings = income - expense;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;
    const avgMonthlySpending = expense / (months.length || 1);
    const avgMonthlyIncome = income / (months.length || 1);

    const expenseCatMap = new Map<string, CategoryBreakdownItem>();
    const incomeCatMap = new Map<string, CategoryBreakdownItem>();

    for (const m of months) {
        for (const c of m.categoryBreakdown) {
            if (!expenseCatMap.has(c.categoryId)) {
                expenseCatMap.set(c.categoryId, { 
                    ...c, 
                    categoryIcon: iconMap[c.categoryId] || 'category', 
                    categoryColor: colorMap[c.categoryId] || '#9ca3af', 
                    amount: 0, 
                    transactionCount: 0, 
                    percentage: 0 
                });
            }
            const existing = expenseCatMap.get(c.categoryId)!;
            existing.amount += c.amount;
            existing.transactionCount += c.transactionCount;
        }

        for (const c of m.incomeCategoryBreakdown || []) {
            if (!incomeCatMap.has(c.categoryId)) {
                incomeCatMap.set(c.categoryId, { 
                    ...c, 
                    categoryIcon: iconMap[c.categoryId] || 'category', 
                    categoryColor: colorMap[c.categoryId] || '#9ca3af', 
                    amount: 0, 
                    transactionCount: 0, 
                    percentage: 0 
                });
            }
            const existing = incomeCatMap.get(c.categoryId)!;
            existing.amount += c.amount;
            existing.transactionCount += c.transactionCount;
        }
    }
    const expenseCategories = Array.from(expenseCatMap.values()).sort((a, b) => b.amount - a.amount);
    const incomeCategories = Array.from(incomeCatMap.values()).sort((a, b) => b.amount - a.amount);
    
    if (expense > 0) expenseCategories.forEach(c => c.percentage = (c.amount / expense) * 100);
    if (income > 0) incomeCategories.forEach(c => c.percentage = (c.amount / income) * 100);

    return {
        label, income, expense, savings, savingsRate, avgMonthlySpending, avgMonthlyIncome,
        topCategory: expenseCategories.length > 0 ? expenseCategories[0] : null,
        categoryBreakdown: expenseCategories,
        incomeCategoryBreakdown: incomeCategories,
        expenseGrowth: null
    };
}

function getPeriodLabel(which: 'current' | 'previous', selectedPeriod: string, selectedYear: number, selectedMonth: number | null, selectedWeekOffset: number): string {
    const now = new Date();
    const year = selectedYear;
    if (selectedPeriod === 'monthly') {
        const currentMonth = selectedMonth !== null ? selectedMonth : (year === now.getFullYear() ? now.getMonth() : 0);
        if (which === 'current') return `${MONTHS[currentMonth]} ${year}`;
        const pm = currentMonth === 0 ? 11 : currentMonth - 1;
        const py = currentMonth === 0 ? year - 1 : year;
        return `${MONTHS[pm]} ${py}`;
    } else if (selectedPeriod === 'weekly') {
        const offset = which === 'current' ? selectedWeekOffset : selectedWeekOffset - 1;
        const start = dayjs().add(offset, 'week').startOf('week');
        const end = dayjs().add(offset, 'week').endOf('week');
        if (offset === 0 && which === 'current') return 'This Week';
        if (offset === -1 && which === 'previous') return 'Last Week';
        return `${start.format('D MMM')} - ${end.format('D MMM YYYY')}`;
    } else if (selectedPeriod === 'all') {
        return 'All Time';
    } else {
        return which === 'current' ? `${year}` : `${year - 1}`;
    }
}

function computePredictions(monthlySummaries: MonthlySummary[], iconMap: any, colorMap: any, groupMap: any) {
    if (monthlySummaries.length < 2) {
        return { nextMonthPrediction: null, next3MonthsPrediction: null, yearEndPrediction: null };
    }

    const recent = monthlySummaries.slice(0, Math.min(6, monthlySummaries.length));
    const avgExpense = recent.reduce((s, m) => s + m.expense, 0) / recent.length;
    const avgIncome = recent.reduce((s, m) => s + m.income, 0) / recent.length;

    const half = Math.floor(recent.length / 2);
    const recentHalf = recent.slice(0, half);
    const olderHalf = recent.slice(half);
    const recentAvgExp = recentHalf.reduce((s, m) => s + m.expense, 0) / (recentHalf.length || 1);
    const olderAvgExp = olderHalf.reduce((s, m) => s + m.expense, 0) / (olderHalf.length || 1);

    const trendFactor = olderAvgExp > 0 ? recentAvgExp / olderAvgExp : 1;
    const trend: 'increasing' | 'decreasing' | 'stable' =
        trendFactor > 1.05 ? 'increasing' : trendFactor < 0.95 ? 'decreasing' : 'stable';

    const confidence: 'low' | 'medium' | 'high' =
        recent.length >= 6 ? 'high' : recent.length >= 3 ? 'medium' : 'low';

    // ── Group-Aware Overspend Detection ──
    const latestMonth = recent[0];
    
    // 1. Build a map of group-level averages over the recent period
    const groupMetricsMap = new Map<string, { totalAmount: number; count: number; name: string }>();

    for (const m of recent) {
        const monthGroupSums = new Map<string, number>();
        
        for (const c of m.categoryBreakdown) {
            const gName = groupMap[c.categoryId] || c.categoryName;
            monthGroupSums.set(gName, (monthGroupSums.get(gName) || 0) + c.amount);
        }

        for (const [gName, amt] of monthGroupSums) {
            if (!groupMetricsMap.has(gName)) {
                groupMetricsMap.set(gName, { totalAmount: 0, count: 0, name: gName });
            }
            const g = groupMetricsMap.get(gName)!;
            g.totalAmount += amt;
            g.count += 1;
        }
    }

    // 2. Identify groups trending above their average in the latest month
    const overspendCategories: CategoryBreakdownItem[] = [];
    const latestGroupSums = new Map<string, { amount: number; transactionCount: number; categoryId: string; icon: string; color: string }>();

    for (const c of latestMonth.categoryBreakdown) {
        const gName = groupMap[c.categoryId] || c.categoryName;
        if (!latestGroupSums.has(gName)) {
            // Use the icon/color of the first category in the group encountered
            latestGroupSums.set(gName, { 
                amount: 0, 
                transactionCount: 0, 
                categoryId: c.categoryId, 
                icon: iconMap[c.categoryId] || 'category', 
                color: colorMap[c.categoryId] || '#9ca3af' 
            });
        }
        const g = latestGroupSums.get(gName)!;
        g.amount += c.amount;
        g.transactionCount += c.transactionCount;
    }

    for (const [gName, latest] of latestGroupSums) {
        const metrics = groupMetricsMap.get(gName);
        if (!metrics || metrics.count === 0) continue;

        const avgAmt = metrics.totalAmount / metrics.count;
        
        // Flag group if current spend is 20%+ above average
        if (latest.amount > avgAmt * 1.2) {
            overspendCategories.push({
                categoryId: latest.categoryId, // Keep one category ID as reference
                categoryName: gName,
                categoryIcon: latest.icon,
                categoryColor: latest.color,
                amount: latest.amount,
                percentage: avgAmt > 0 ? ((latest.amount - avgAmt) / avgAmt) * 100 : 0,
                transactionCount: latest.transactionCount
            });
        }
    }

    overspendCategories.sort((a, b) => b.percentage - a.percentage);

    const predictedExpMonth = avgExpense * (trend === 'increasing' ? trendFactor : trend === 'decreasing' ? trendFactor : 1);
    
    const nextMonthPrediction: Prediction = {
        label: getNextMonthLabel(1),
        predictedExpense: Math.round(predictedExpMonth),
        predictedIncome: Math.round(avgIncome),
        predictedSavings: Math.round(avgIncome - predictedExpMonth),
        confidence, trend, overspendCategories
    };

    const next3MonthsPrediction: Prediction = {
        label: `Next 3 Months`,
        predictedExpense: Math.round(predictedExpMonth * 3),
        predictedIncome: Math.round(avgIncome * 3),
        predictedSavings: Math.round((avgIncome * 3) - (predictedExpMonth * 3)),
        confidence, trend, overspendCategories
    };

    const now = new Date();
    const remainingMonths = 12 - now.getMonth();
    const currentYearMonths = monthlySummaries.filter(m => m.year === now.getFullYear());
    const currentYearExpense = currentYearMonths.reduce((s, m) => s + m.expense, 0);
    const currentYearIncome = currentYearMonths.reduce((s, m) => s + m.income, 0);

    const yearEndPrediction: Prediction = {
        label: `Year-End ${now.getFullYear()}`,
        predictedExpense: Math.round(currentYearExpense + (predictedExpMonth * remainingMonths)),
        predictedIncome: Math.round(currentYearIncome + (avgIncome * remainingMonths)),
        predictedSavings: Math.round((currentYearIncome + (avgIncome * remainingMonths)) - (currentYearExpense + (predictedExpMonth * remainingMonths))),
        confidence: recent.length >= 4 ? 'medium' : 'low',
        trend, overspendCategories: []
    };

    return { nextMonthPrediction, next3MonthsPrediction, yearEndPrediction };
}

function getNextMonthLabel(offset: number): string {
    const d = new Date();
    d.setMonth(d.getMonth() + offset);
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}
