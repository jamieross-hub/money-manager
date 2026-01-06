import { Injectable } from "@angular/core";


@Injectable({ providedIn: 'root' })
export class ChatIntentService {
  detectIntent(text: string): string {
    const t = text.toLowerCase();

    const amount = /₹?\$?\d+[.,]?\d*/.test(t);
    const actions = ['add','paid','received','got','spent','debit','credit','purchase','buy','transfer','sent','deposit','withdraw'];
    const hasAction = actions.some(a => t.includes(a));
    const isIncome = ['salary','income','received','got','credited','deposit'].some(w => t.includes(w));
    const isExpense = ['spent','expense','paid','debited','withdraw','purchase','buy'].some(w => t.includes(w));

    if (amount && hasAction && isIncome) return 'ADD_INCOME';
    if (amount && hasAction && isExpense) return 'ADD_EXPENSE';

    if (t.includes('balance') || t.includes('wallet') || t.includes('bank')) return 'CHECK_BALANCE';

    // Detect requests for an account summary card / accounts overview
    if (
      t.includes('account summary') ||
      t.includes('account-summary') ||
      t.includes('accountsummary') ||
      t.includes('account summary card') ||
      t.includes('account card') ||
      t.includes('show accounts') ||
      t.includes('my accounts') ||
      t.includes('list accounts') ||
      (t.includes('accounts') && (t.includes('summary') || t.includes('balances') || t.includes('overview') || t.includes('card')))
    ) return 'ACCOUNT_SUMMARY_CARD';

    // Detect clear / reset / delete-all data requests
    if (
      t.includes('clear') ||
      t.includes('clear data') ||
      t.includes('reset data') ||
      t.includes('delete all') ||
      t.includes('clear all') ||
      t.includes('wipe data') ||
      t.includes('erase data') ||
      t.includes('reset app') ||
      t.includes('factory reset') ||
      (t.includes('delete') && t.includes('data'))
    ) return 'CLEAR_DATA';

    if (t.includes('report') || t.includes('statement')) return 'GET_REPORT';
    
    if (t.includes('advice') || t.includes('suggest') || t.includes('tips') || t.includes('insight') || t.includes('analyze')) return 'GET_INSIGHTS';

    return 'AI_REPLY';
  }
}



