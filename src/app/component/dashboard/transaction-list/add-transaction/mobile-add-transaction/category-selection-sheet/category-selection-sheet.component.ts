import { Component, Inject, OnInit } from '@angular/core';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Category } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { Observable, combineLatest, map, startWith } from 'rxjs';
import { FormControl } from '@angular/forms';
import { TransactionType } from 'src/app/util/config/enums';

@Component({
    selector: 'app-category-selection-sheet',
    templateUrl: './category-selection-sheet.component.html',
    styleUrls: ['./category-selection-sheet.component.scss']
})
export class CategorySelectionSheetComponent implements OnInit {
    categories$: Observable<Category[]>;
    filteredCategories$!: Observable<Category[]>;
    searchControl = new FormControl('');
    transactionType: TransactionType = TransactionType.EXPENSE; // Default

    constructor(
        private _bottomSheetRef: MatBottomSheetRef<CategorySelectionSheetComponent>,
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: { selectedCategoryId: string, transactionType: TransactionType },
        private store: Store<AppState>
    ) {
        this.categories$ = this.store.select(selectAllCategories);
        this.transactionType = data?.transactionType || TransactionType.EXPENSE;
    }

    ngOnInit(): void {
        const search$ = this.searchControl.valueChanges.pipe(
            startWith(''),
            map(term => (term || '').toLowerCase())
        );

        this.filteredCategories$ = combineLatest([this.categories$, search$]).pipe(
            map(([categories, search]) => {
                // First filter by type if needed, or maybe show all but grouped?
                // Let's filter by type to be cleaner for the user context
                let filtered = categories.filter(c => c.type === this.transactionType);

                if (search) {
                    filtered = filtered.filter(c => c.name.toLowerCase().includes(search));
                }
                return filtered;
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
