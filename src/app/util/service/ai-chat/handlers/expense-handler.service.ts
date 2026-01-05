import { Injectable } from "@angular/core";
import { Category } from "src/app/util/models";


@Injectable({ providedIn: 'root' })
export class ExpenseHandlerService {


    addExpense(selectedCategory: Category, amount: number) {
        console.log('Adding expense:', amount);
        return `Expense added: ₹${amount}`;
    }
}
