import { Component, Inject, OnInit , ChangeDetectionStrategy, signal} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef, MatBottomSheetModule } from '@angular/material/bottom-sheet';
import { Category, Transaction, Account } from 'src/app/util/models';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllCategories } from 'src/app/store/categories/categories.selectors';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { selectAllTransactions } from 'src/app/store/transactions/transactions.selectors';
import { Observable, combineLatest, map, startWith, of } from 'rxjs';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { TransactionType } from 'src/app/util/config/enums';
import { DateService } from 'src/app/util/service/date.service';
import { APP_CONFIG, CATEGORY_ICONS, CATEGORY_COLORS } from 'src/app/util/config/config';
import { createCategory } from 'src/app/store/categories/categories.actions';
import { filter, take, catchError, finalize } from 'rxjs';
import { NgClass, TitleCasePipe } from '@angular/common';
import { UserService } from 'src/app/util/service/db/user.service';
import { OpenaiService } from 'src/app/util/service/ai-chat/openai.service';

export interface SelectionSheetData {
    selectedId?: string;
    type: 'category' | 'account';
    transactionType?: TransactionType;
}

@Component({
    selector: 'app-item-selection-sheet',
    templateUrl: './item-selection-sheet.component.html',
    styleUrls: ['./item-selection-sheet.component.scss'],
    standalone: true,
    imports: [
        CommonModule,
        MatListModule,
        MatIconModule,
        MatButtonModule,
        MatBottomSheetModule,
        MatFormFieldModule,
        MatInputModule,
        ReactiveFormsModule,
        NgClass,
        TitleCasePipe
    ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ItemSelectionSheetComponent implements OnInit {
    items$: Observable<any[]>;
    transactions$: Observable<Transaction[]>;
    filteredItems$!: Observable<any[]>;
    searchControl = new FormControl('');
    transactionType: TransactionType = TransactionType.EXPENSE;
    userId: string | null = null;
    public isCreating = signal<boolean>(false);

    constructor(
        private _bottomSheetRef: MatBottomSheetRef<ItemSelectionSheetComponent>,
        @Inject(MAT_BOTTOM_SHEET_DATA) public data: SelectionSheetData,
        private store: Store<AppState>,
        private dateService: DateService,
        private userService: UserService,
        private openaiService: OpenaiService
    ) {
        if (this.data.type === 'category') {
            this.items$ = this.store.select(selectAllCategories).pipe(
                map(categories => {
                    const reservedNames = Object.keys(APP_CONFIG.VALIDATION.RESERVED_CATEGORY_NAMES).map(n => n.toLowerCase());
                    return categories.filter(c => !reservedNames.includes(c.name.trim().toLowerCase()));
                })
            );
        } else {
            this.items$ = this.store.select(selectAllAccounts);
        }
        
        this.transactions$ = this.store.select(selectAllTransactions);
        this.transactionType = data?.transactionType || TransactionType.EXPENSE;
        this.userId = this.userService.getCurrentUserId();
    }

    ngOnInit(): void {
        const search$ = this.searchControl.valueChanges.pipe(
            startWith(''),
            map(term => (term || '').toLowerCase())
        );

        this.filteredItems$ = combineLatest([this.items$, this.transactions$, search$]).pipe(
            map(([items, transactions, search]) => {
                if (this.data.type === 'category') {
                    return this.filterCategories(items as Category[], transactions, search);
                } else {
                    return this.filterAccounts(items as Account[], search);
                }
            })
        );
    }

    private filterCategories(categories: Category[], transactions: Transaction[], search: string): Category[] {
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

        // Show all non-system categories, let user see both Expense and Income
        let filtered = categories.filter(c => !c.isSystem && (c.type === 'income' || c.type === 'expense'));

        if (search) {
            filtered = filtered.filter(c => c.name.toLowerCase().includes(search));
        }

        // Sort by prioritising current transaction type first, then frequency
        return filtered.sort((a, b) => {
            const typePriorityA = a.type === this.transactionType ? 1 : 0;
            const typePriorityB = b.type === this.transactionType ? 1 : 0;

            if (typePriorityB !== typePriorityA) {
                return typePriorityB - typePriorityA;
            }

            const freqA = a.id ? (frequencyMap.get(a.id) || 0) : 0;
            const freqB = b.id ? (frequencyMap.get(b.id) || 0) : 0;

            if (freqB !== freqA) {
                return freqB - freqA;
            }
            return a.name.localeCompare(b.name);
        });
    }

    private filterAccounts(accounts: Account[], search: string): Account[] {
        let filtered = accounts.filter(a => a.isActive !== false);

        if (search) {
            filtered = filtered.filter(a => 
                a.name.toLowerCase().includes(search) || 
                a.type.toLowerCase().includes(search)
            );
        }

        return filtered.sort((a, b) => a.name.localeCompare(b.name));
    }

    selectItem(item: any): void {
        this._bottomSheetRef.dismiss(item);
    }

    createAndSelectCategory(name: string): void {
        if (this.data.type !== 'category' || !this.userId || !name.trim() || this.isCreating()) return;

        this.isCreating.set(true);
        const fallback = this.suggestIconAndColor(name.trim());

        this.openaiService.suggestCategoryIconAndColor(
            name.trim(),
            CATEGORY_ICONS,
            CATEGORY_COLORS
        ).pipe(
            catchError(() => of(fallback)),
            finalize(() => this.isCreating.set(false)),
            take(1)
        ).subscribe(suggestion => {
            const icon = suggestion?.icon || fallback.icon;
            const color = suggestion?.color || fallback.color;

            this.store.dispatch(createCategory({
                userId: this.userId!,
                name: name.trim(),
                categoryType: this.transactionType,
                icon: icon,
                color: color
            }));

            this.store.select(selectAllCategories).pipe(
                map(categories => categories.find(c => c.name.toLowerCase() === name.trim().toLowerCase() && c.type === this.transactionType)),
                filter(c => !!c && !!c.id),
                take(1)
            ).subscribe(category => {
                if (category) {
                    this._bottomSheetRef.dismiss(category);
                }
            });
        });
    }

    private suggestIconAndColor(name: string): { icon: string, color: string } {
        const lowerName = name.toLowerCase();
        
        let foundIcon = CATEGORY_ICONS.find(i => i.name.toLowerCase().includes(lowerName) || lowerName.includes(i.name.toLowerCase()));
        
        if (!foundIcon) {
            foundIcon = CATEGORY_ICONS.find(i => i.group?.toLowerCase().includes(lowerName) || lowerName.includes(i.group?.toLowerCase() || ''));
        }
        
        const icon = foundIcon ? foundIcon.icon : 'category';
        const hash = this.stringHash(name);
        const colorIndex = Math.abs(hash) % CATEGORY_COLORS.length;
        const color = CATEGORY_COLORS[colorIndex].value;
        
        return { icon, color };
    }

    private stringHash(str: string): number {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = (hash << 5) - hash + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    close(): void {
        this._bottomSheetRef.dismiss();
    }
}

