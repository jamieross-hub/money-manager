import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatOptionModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { Category } from 'src/app/util/models/category.model';
import { map, Observable, Subscription } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';
import { Account } from '../../models';
import { CategoryService } from '../../service/db/category.service';
import { AccountType, TransactionType } from '../../config/enums';



@Component({
  selector: 'app-chat-category-dropdown',
  templateUrl: './chat-category-dropdown.component.html',
  styleUrls: ['./chat-category-dropdown.component.scss'],
  standalone: true,
  imports: [CommonModule, MatFormFieldModule, MatSelectModule, MatIconModule, MatOptionModule, MatChipsModule]
})
export class ChatCategoryDropdownComponent implements OnChanges, OnDestroy {
  @Input() placeholder = 'Select category';
  @Input() amount: number = 0;
  @Input() txType: TransactionType = TransactionType.INCOME;

  // @Output() selected = new EventEmitter<{ selectedCategory: Category; amount: number; txType: string }>();
  // @Output() accountSelected = new EventEmitter<any>();
  @Output() submitSelection = new EventEmitter<{ selectedCategory: Category; account: Account; amount: number; txType: TransactionType }>();

  public currentCategory: Category | null = null;
  public currentAccount: Account | null = null;
  public isDisabled = false;

  public categories: Category[] = [];

  private subscription: Subscription;

  constructor(private store: Store<AppState>, private categoryService: CategoryService) {
    this.subscription = this.store.select(selectAllAccounts).subscribe(accounts => {
      this.currentAccount = accounts.filter(account => account.type.toLowerCase().includes(AccountType.BANK))[0];
    });

    this.categories = this.categoryService.getCachedCategories(this.txType);

  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['txType']) {
      this.categories = this.categoryService.getCachedCategories(this.txType);
    }
  }

  onChange(category: Category) {
    if (!category || this.isDisabled) return;
    this.currentCategory = category;
    if (this.currentCategory && this.currentAccount) {
      this.onSubmit();
    }
  }

  // onAccountChange(account: any) {
  //   if (!account) return;
  //   this.currentAccount = account;
  //   if (this.currentCategory && this.currentAccount) {
  //     this.onSubmit();
  //   }
  // }

  onSubmit() {
    if (!this.currentCategory || !this.currentAccount) return;
    this.isDisabled = true;
    this.submitSelection.emit({ selectedCategory: this.currentCategory, account: this.currentAccount, amount: this.amount, txType: this.txType });
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }
}
