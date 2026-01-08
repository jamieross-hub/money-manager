import { Injectable } from '@angular/core';
import { Category, Account } from '../../../models';
import { AccountType } from '../../../config/enums';

export interface ExtractedEntities {
    amount: number;
    category: Category | null;
    account: Account | null;
}

/**
 * Service dedicated to extracting entities from user input.
 * Centralizes NLP-like tasks for the chat service.
 */
@Injectable({ providedIn: 'root' })
export class EntityExtractorService {

    /**
     * Extracts all entities from the given text
     */
    extractAll(text: string, categories: Category[], accounts: Account[]): ExtractedEntities {
        const amount = this.extractAmount(text);
        const category = this.extractCategory(text, categories);
        const account = this.extractAccount(text, accounts);

        return { amount, category, account };
    }

    /**
     * Extracts amount from text
     */
    extractAmount(text: string): number {
        // Match numbers with optional commas and decimals
        const match = text.match(/(\d[\d,]*\.?\d*)/);
        if (!match) return 0;

        const amountStr = match[1].replace(/,/g, '');
        const amount = Number(amountStr);
        return isNaN(amount) ? 0 : amount;
    }

    /**
     * Extracts category from text by matching against available categories
     */
    extractCategory(text: string, categories: Category[]): Category | null {
        if (!text || !categories.length) return null;

        const lowerText = text.toLowerCase();

        // Exact keyword match first (longest names first to avoid partial matches)
        const sortedCategories = [...categories].sort((a, b) => b.name.length - a.name.length);

        for (const cat of sortedCategories) {
            if (lowerText.includes(cat.name.toLowerCase())) {
                return cat;
            }
        }

        return null;
    }

    /**
     * Extracts account from text by matching against names or types
     */
    extractAccount(text: string, accounts: Account[]): Account | null {
        if (!text || !accounts.length) return null;

        const lowerText = text.toLowerCase();

        // 1. Direct name match
        for (const acc of accounts) {
            if (lowerText.includes(acc.name.toLowerCase())) {
                return acc;
            }
        }

        // 2. Type-based keywords
        if (lowerText.includes('bank')) {
            const bankAcc = accounts.find(a => a.type.toLowerCase().includes(AccountType.BANK));
            if (bankAcc) return bankAcc;
        }

        if (lowerText.includes('cash')) {
            const cashAcc = accounts.find(a => a.type.toLowerCase().includes(AccountType.CASH));
            if (cashAcc) return cashAcc;
        }

        return null;
    }
}
