import { Injectable } from "@angular/core";
import { CategoryService } from 'src/app/util/service/db/category.service';
import { TransactionType } from 'src/app/util/config/enums';

@Injectable({ providedIn: 'root' })
export class ChatFlowService {
    private stage: 'askType' | 'askCategory' | null = null;
    private amount: number | null = null;
    private type: 'INCOME' | 'EXPENSE' | null = null;
    constructor(private categoryService: CategoryService) {}

    startAmountFlow(amount: number) {
        this.amount = amount;
        this.stage = 'askType';
        return `Got ₹${amount}. Is this income or expense?`;
    }

    handleTypeReply(userText: string, detected: string) {
        const t = userText.toLowerCase();
        if (detected === 'ADD_INCOME' || /income|salary|earned|paid/.test(t)) {
            this.type = 'INCOME';
            this.stage = 'askCategory';
            const categories = this.categoryService.getCachedCategories(TransactionType.INCOME);
            return { type: 'categoryDropdown', data: { categories, placeholder: 'Select income category', amount: this.amount, txType: 'INCOME' } };
        }
        if (detected === 'ADD_EXPENSE' || /expense|spent|buy|purchase/.test(t)) {
            this.type = 'EXPENSE';
            this.stage = 'askCategory';
            const categories = this.categoryService.getCachedCategories(TransactionType.EXPENSE);
            return { type: 'categoryDropdown', data: { categories, placeholder: 'Select expense category', amount: this.amount, txType: 'EXPENSE' } };
        }
        return `Please reply with "income" or "expense".`;
    }

    handleCategoryReply(category: string) {
        if (!category) return 'Please provide a category name.';
        const label = this.type === 'INCOME' ? 'Income' : 'Expense';
        const result = `${label} added: ₹${this.amount} to ${category}`;
        this.reset();
        return result;
    }


    getStage() { return this.stage; }
    getAmount() { return this.amount; }
    getType() { return this.type; }


    private reset() {
        this.stage = null;
        this.amount = null;
        this.type = null;
    }
}
