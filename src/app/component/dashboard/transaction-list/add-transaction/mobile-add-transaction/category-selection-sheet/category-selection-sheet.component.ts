import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { Category, Transaction } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { Observable, combineLatest, map, startWith } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TransactionType } from 'src/app/util/config/enums';
import { DateService } from 'src/app/util/service/date.service';

@Component({
    selector: 'app-category-selection-sheet',
    templateUrl: './category-selection-sheet.component.html',
    styleUrls: ['./category-selection-sheet.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatBottomSheetModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule
    ]
})
export class CategorySelectionSheetComponent implements OnInit {
    categories$: Observable<Category[]>;
    transactions$: Observable<Transaction[]>;
    filteredCategories$!: Observable<Category[]>;
    searchControl = new FormControl('');
    transactionType: TransactionType = TransactionType.EXPENSE; // Default

    constructor(
        private _bottomSheetRef: MatBottomSheetRef<CategorySelectionSheetComponent>,
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: { selectedCategoryId: string, transactionType: TransactionType },
        private store: Store<AppState>,
        private dateService: DateService
    ) {
        this.categories$ = this.store.select(selectAllCategories);
        this.transactions$ = this.store.select(selectAllTransactions);
        this.transactionType = data?.transactionType || TransactionType.EXPENSE;
    }

    ngOnInit(): void {
        const search$ = this.searchControl.valueChanges.pipe(
            startWith(''),
            map(term => (term || '').toLowerCase())
        );

        this.filteredCategories$ = combineLatest([this.categories$, this.transactions$, search$]).pipe(
            map(([categories, transactions, search]) => {
                // Get last 20 transactions sorted by date desc
                const last20 = [...transactions]
                    .sort((a, b) => {
                        const dateA = this.dateService.toDate(a.date) || new Date(0);
                        const dateB = this.dateService.toDate(b.date) || new Date(0);
                        return dateB.getTime() - dateA.getTime();
                    })
                    .slice(0, 20);

                // Count frequency of category usage in last 20 tx
                const frequencyMap = new Map<string, number>();
                last20.forEach(tx => {
                    if (tx.categoryId) {
                        frequencyMap.set(tx.categoryId, (frequencyMap.get(tx.categoryId) || 0) + 1);
                    }
                });

                // Show all categories regardless of type
                let filtered = [...categories];

                if (search) {
                    filtered = filtered.filter(c => c.name.toLowerCase().includes(search));
                }

                // Sort by frequency (most used first) then by name
                return filtered.sort((a, b) => {
                    const freqA = a.id ? (frequencyMap.get(a.id) || 0) : 0;
                    const freqB = b.id ? (frequencyMap.get(b.id) || 0) : 0;

                    if (freqB !== freqA) {
                        return freqB - freqA;
                    }
                    return a.name.localeCompare(b.name);
                });
            })
        );
    }

    selectCategory(category: Category): void {
        this._bottomSheetRef.dismiss(category);
    }

    close(): void {
        this._bottomSheetRef.dismiss();
    }
}
