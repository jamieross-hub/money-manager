import { Pipe, PipeTransform } from '@angular/core';
import { Account } from '../models/account.model';
import { Transaction } from '../models/transaction.model';

@Pipe({
  name: 'accountStats',
  standalone: true,
  pure: true
})
export class AccountStatsPipe implements PipeTransform {
  /**
   * Calculate account statistics from transactions
   * @param account - The account to get stats for
   * @param transactions - List of all transactions
   * @returns Object containing account statistics
   */
  transform(account: Account, transactions: Transaction[]): any {
    const accountTransactions = transactions.filter(t => t.accountId === account.accountId);

    if (accountTransactions.length === 0) {
      return {
        totalTransactions: 0,
        totalDeposits: 0,
        totalWithdrawals: 0,
        averageTransaction: 0,
        largestTransaction: 0,
        thisMonth: 0,
        lastMonth: 0
      };
    }

    const now = new Date();
    const thisMonth = now.getMonth();
    const thisYear = now.getFullYear();
    const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
    const lastYear = thisMonth === 0 ? thisYear - 1 : thisYear;

    const totalDeposits = accountTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = accountTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);

    const averageTransaction = accountTransactions.length > 0
      ? accountTransactions.reduce((sum, t) => sum + Math.abs(t.amount), 0) / accountTransactions.length
      : 0;

    const largestTransaction = accountTransactions.length > 0
      ? Math.max(...accountTransactions.map(t => Math.abs(t.amount)))
      : 0;

    const thisMonthTransactions = accountTransactions.filter(t => {
      if (!t.date) return false;
      const txDate = this.toDate(t.date);
      return txDate && txDate.getMonth() === thisMonth && txDate.getFullYear() === thisYear;
    });

    const lastMonthTransactions = accountTransactions.filter(t => {
      if (!t.date) return false;
      const txDate = this.toDate(t.date);
      return txDate && txDate.getMonth() === lastMonth && txDate.getFullYear() === lastYear;
    });

    const thisMonthTotal = thisMonthTransactions.reduce((sum, t) => sum + t.amount, 0);
    const lastMonthTotal = lastMonthTransactions.reduce((sum, t) => sum + t.amount, 0);

    return {
      totalTransactions: accountTransactions.length,
      totalDeposits,
      totalWithdrawals,
      averageTransaction,
      largestTransaction,
      thisMonth: thisMonthTotal,
      lastMonth: lastMonthTotal
    };
  }

  private toDate(date: any): Date | null {
    if (!date) return null;
    if (date instanceof Date) return date;
    if (typeof date === 'string') return new Date(date);
    if (date.seconds) return new Date(date.seconds * 1000);
    return null;
  }
}
