
import { Injectable } from "@angular/core";
import { Store } from '@ngrx/store';
import { Auth } from '@angular/fire/auth';
import { NotificationService } from 'src/app/util/service/notification.service';
import { HapticFeedbackService } from 'src/app/util/service/haptic-feedback.service';
import * as TransactionsActions from 'src/app/store/transactions/transactions.actions';
import { AppState } from 'src/app/store/app.state';
import { SyncStatus, TransactionStatus, TransactionType } from 'src/app/util/config/enums';
import { Account, Category } from "src/app/util/models";


@Injectable({ providedIn: 'root' })
export class IncomeHandlerService {
    constructor(
        private store: Store<AppState>,
        private auth: Auth,
        private notificationService: NotificationService,
        private hapticFeedback: HapticFeedbackService
    ) {}

    async addIncome(selectedCategory: Category, account: Account, amount: number) {
        const userId = this.auth.currentUser?.uid;

        // Fallback if user not available
        if (!userId) {
            console.warn('No authenticated user - cannot create transaction');
            return `Income added locally: ₹${amount}`;
        }

        const transactionData = {
            userId: userId,
            accountId: account?.accountId || '',
            categoryId: selectedCategory?.id || '',
            category: selectedCategory?.name,
            payee: 'Income',
            amount: amount,
            type: TransactionType.INCOME,
            date: new Date(),
            notes: '',
            status: TransactionStatus.COMPLETED,
            tags: [],
            isSplitTransaction: false,
            isCategorySplit: false,
            syncStatus: SyncStatus.PENDING,
            createdAt: new Date(),
            updatedAt: new Date(),
            createdBy: userId,
            updatedBy: userId,
        };

        try {
            await this.store.dispatch(
                TransactionsActions.createTransaction({
                    userId: userId,
                    transaction: transactionData,
                })
            );

            this.notificationService.success('Transaction added successfully');
            this.hapticFeedback.successVibration();
            return `Income added: ₹${amount}`;
        } catch (error) {
            console.error('Failed to add income transaction', error);
            this.notificationService.error('Failed to add transaction');
            return `Failed to add income: ₹${amount}`;
        }
    }
}