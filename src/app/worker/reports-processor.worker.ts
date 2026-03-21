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

addEventListener('message', ({ data }) => {
    const { 
        transactions, 
        currentUserId,
        selectedPeriod, 
        selectedYear, 
        selectedMonth, 
        selectedWeekOffset,
        categoryIconMap,
        categoryColorMap
    } = data;

    const startTime = performance.now();

    if (!transactions || transactions.length === 0) {
        postMessage({
            monthlySummaries: [],
            availableYears: [],
            avgMonthlySpending: 0,
            highestSpendingCategory: null,
            overallSavingsRate: 0,
            currentPeriodSummary: null,
            previousPeriodSummary: null,
            filteredMonthlySummaries: [],
            nextMonthPrediction: null,
            next3MonthsPrediction: null,
            yearEndPrediction: null
        });
        return;
    }

    // 1. Build Monthly Summaries
    const monthlySummaries = buildMonthlySummaries(transactions, categoryIconMap, categoryColorMap);

    // 2. Extract Available Years
    const yearSet = new Set<number>();
    for (const m of monthlySummaries) {
        yearSet.add(m.year);
    }
    const availableYears = Array.from(yearSet).sort((a, b) => b - a);

    // 3. Compute Key Metrics
    const totalExpense = monthlySummaries.reduce((s, m) => s + m.expense, 0);
    const totalIncome = monthlySummaries.reduce((s, m) => s + m.income, 0);
    const avgMonthlySpending = monthlySummaries.length > 0 ? totalExpense / monthlySummaries.length : 0;
    const overallSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0;

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
    if (totalExpense > 0) {
        allCats.forEach(c => c.percentage = (c.amount / totalExpense) * 100);
    }
    const highestSpendingCategory = allCats.length > 0 ? allCats[0] : null;

    // 4. Compute Period Summary
    const { currentPeriodSummary, previousPeriodSummary, filteredMonthlySummaries } = computePeriodSummaries(
        transactions, 
        monthlySummaries, 
        selectedPeriod, 
        selectedYear, 
        selectedMonth, 
        selectedWeekOffset,
        categoryIconMap,
        categoryColorMap
    );

    // 5. Compute Predictions
    const { nextMonthPrediction, next3MonthsPrediction, yearEndPrediction } = computePredictions(
        monthlySummaries,
        categoryIconMap,
        categoryColorMap
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
        nextMonthPrediction,
        next3MonthsPrediction,
        yearEndPrediction,
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
            map.set(key, { income: 0, expense: 0, categories: new Map() });
        }
        const entry = map.get(key)!;

        if (t.type === 'income') {
            entry.income += t.amount;
        } else if (t.type === 'expense') {
            entry.expense += t.amount;

            const catKey = t.categoryId || t.category || 'Uncategorized';
            const catName = t.category || 'Uncategorized';
            if (!entry.categories.has(catKey)) {
                entry.categories.set(catKey, { 
                    categoryId: catKey, 
                    categoryName: catName, 
                    categoryIcon: iconMap[catKey] || 'category', 
                    categoryColor: colorMap[catKey] || '#9ca3af', 
                    amount: 0, 
                    percentage: 0, 
                    transactionCount: 0 
                });
            }
            const cat = entry.categories.get(catKey)!;
            cat.amount += t.amount;
            cat.transactionCount += 1;
        }
    }

    const summaries: MonthlySummary[] = [];
    for (const [key, val] of map) {
        const [yearStr, monthStr] = key.split('-');
        const year = parseInt(yearStr);
        const month = parseInt(monthStr);
        const savings = val.income - val.expense;
        const savingsRate = val.income > 0 ? (savings / val.income) * 100 : 0;

        const categories = Array.from(val.categories.values());
        if (val.expense > 0) {
            categories.forEach(c => c.percentage = (c.amount / val.expense) * 100);
        }
        categories.sort((a, b) => b.amount - a.amount);

        summaries.push({
            month, year,
            label: `${MONTHS[month]} ${year}`,
            income: val.income,
            expense: val.expense,
            savings,
            savingsRate,
            categoryBreakdown: categories
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
    selectedPeriod: 'weekly' | 'monthly' | 'yearly',
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

    if (selectedPeriod === 'monthly') {
        const currentMonth = selectedMonth !== null ? selectedMonth : (year === now.getFullYear() ? now.getMonth() : 0);
        currentMonths = monthlySummaries.filter(m => m.month === currentMonth && m.year === year);
        const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const prevYear = currentMonth === 0 ? year - 1 : year;
        previousMonths = monthlySummaries.filter(m => m.month === prevMonth && m.year === prevYear);
    } else if (selectedPeriod === 'weekly') {
        const startOfCurrentWeek = dayjs().add(selectedWeekOffset, 'week').startOf('week');
        const endOfCurrentWeek = dayjs().add(selectedWeekOffset, 'week').endOf('week');
        const startOfPrevWeek = dayjs().add(selectedWeekOffset - 1, 'week').startOf('week');
        const endOfPrevWeek = dayjs().add(selectedWeekOffset - 1, 'week').endOf('week');

        currentMonths = buildAdhocSummary(transactions.filter(t => {
            const d = dayjs(toDate(t.date));
            return d.isAfter(startOfCurrentWeek.subtract(1, 'millisecond')) && d.isBefore(endOfCurrentWeek.add(1, 'millisecond'));
        }), iconMap, colorMap);

        previousMonths = buildAdhocSummary(transactions.filter(t => {
            const d = dayjs(toDate(t.date));
            return d.isAfter(startOfPrevWeek.subtract(1, 'millisecond')) && d.isBefore(endOfPrevWeek.add(1, 'millisecond'));
        }), iconMap, colorMap);
    } else {
        currentMonths = monthlySummaries.filter(m => m.year === year);
        previousMonths = monthlySummaries.filter(m => m.year === year - 1);
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
    } else {
        filteredHistory = monthlySummaries.filter(m => m.year === selectedYear);
    }

    const filteredMonthlySummaries = filteredHistory;

    return { currentPeriodSummary, previousPeriodSummary, filteredMonthlySummaries };
}

function buildAdhocSummary(txns: any[], iconMap: any, colorMap: any): MonthlySummary[] {
    if (txns.length === 0) return [];
    let income = 0;
    let expense = 0;
    const catMap = new Map<string, CategoryBreakdownItem>();

    for (const t of txns) {
        if (t.type === 'income') income += t.amount;
        else if (t.type === 'expense') {
            expense += t.amount;
            const catKey = t.categoryId || t.category || 'Uncategorized';
            const catName = t.category || 'Uncategorized';
            if (!catMap.has(catKey)) {
                catMap.set(catKey, { 
                    categoryId: catKey, 
                    categoryName: catName, 
                    categoryIcon: iconMap[catKey] || 'category', 
                    categoryColor: colorMap[catKey] || '#9ca3af', 
                    amount: 0, 
                    percentage: 0, 
                    transactionCount: 0 
                });
            }
            const cat = catMap.get(catKey)!;
            cat.amount += t.amount;
            cat.transactionCount += 1;
        }
    }

    const categories = Array.from(catMap.values());
    if (expense > 0) categories.forEach(c => c.percentage = (c.amount / expense) * 100);
    categories.sort((a, b) => b.amount - a.amount);

    return [{
        month: 0, year: 0, label: '', income, expense, savings: income - expense,
        savingsRate: income > 0 ? ((income - expense) / income) * 100 : 0,
        categoryBreakdown: categories
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

    const catMap = new Map<string, CategoryBreakdownItem>();
    for (const m of months) {
        for (const c of m.categoryBreakdown) {
            if (!catMap.has(c.categoryId)) {
                catMap.set(c.categoryId, { 
                    ...c, 
                    categoryIcon: iconMap[c.categoryId] || 'category', 
                    categoryColor: colorMap[c.categoryId] || '#9ca3af', 
                    amount: 0, 
                    transactionCount: 0, 
                    percentage: 0 
                });
            }
            const existing = catMap.get(c.categoryId)!;
            existing.amount += c.amount;
            existing.transactionCount += c.transactionCount;
        }
    }
    const categories = Array.from(catMap.values()).sort((a, b) => b.amount - a.amount);
    if (expense > 0) categories.forEach(c => c.percentage = (c.amount / expense) * 100);

    return {
        label, income, expense, savings, savingsRate, avgMonthlySpending, avgMonthlyIncome,
        topCategory: categories.length > 0 ? categories[0] : null,
        categoryBreakdown: categories,
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
    } else {
        return which === 'current' ? `${year}` : `${year - 1}`;
    }
}

function computePredictions(monthlySummaries: MonthlySummary[], iconMap: any, colorMap: any) {
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

    const catAvgMap = new Map<string, { total: number; count: number; name: string; id: string }>();
    for (const m of recent) {
        for (const c of m.categoryBreakdown) {
            if (!catAvgMap.has(c.categoryId)) {
                catAvgMap.set(c.categoryId, { total: 0, count: 0, name: c.categoryName, id: c.categoryId });
            }
            const e = catAvgMap.get(c.categoryId)!;
            e.total += c.amount;
            e.count += 1;
        }
    }

    const overspendCategories: CategoryBreakdownItem[] = [];
    for (const [catId, data] of catAvgMap) {
        const catAvg = data.total / data.count;
        const latestMonth = recent[0];
        const latestCatSpend = latestMonth.categoryBreakdown.find(c => c.categoryId === catId);
        if (latestCatSpend && latestCatSpend.amount > catAvg * 1.2) {
            overspendCategories.push({
                categoryId: catId,
                categoryName: data.name,
                categoryIcon: iconMap[catId] || 'category',
                categoryColor: colorMap[catId] || '#9ca3af',
                amount: latestCatSpend.amount,
                percentage: catAvg > 0 ? ((latestCatSpend.amount - catAvg) / catAvg) * 100 : 0,
                transactionCount: latestCatSpend.transactionCount
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
