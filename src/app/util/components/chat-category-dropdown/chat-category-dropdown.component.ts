import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from 'src/app/util/models/category.model';
import { Observable } from 'rxjs';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { selectAllAccounts } from 'src/app/store/accounts/accounts.selectors';

@Component({
  selector: 'app-chat-category-dropdown',
  templateUrl: './chat-category-dropdown.component.html',
  styleUrls: ['./chat-category-dropdown.component.scss']
})
export class ChatCategoryDropdownComponent {
  @Input() categories: Category[] = [];
  @Input() placeholder = 'Select category';
  @Input() amount = 0;
  @Input() txType: 'INCOME' | 'EXPENSE' | '' = '';

  // @Output() selected = new EventEmitter<{ selectedCategory: Category; amount: number; txType: string }>();
  // @Output() accountSelected = new EventEmitter<any>();
  @Output() submitSelection = new EventEmitter<{ selectedCategory: Category; account: any; amount: number; txType: string }>();

  public currentCategory: Category | null = null;
  public currentAccount: any = null;

  public accountList$: Observable<any[]> | undefined;

  constructor(private store: Store<AppState>) {
    this.accountList$ = this.store.select(selectAllAccounts);
  }

  onChange(value: any) {
    if (!value) return;
    this.currentCategory = value;
    // this.selected.emit({ selectedCategory: value, amount: this.amount, txType: this.txType });
  }

  onAccountChange(account: any) {
    if (!account) return;
    this.currentAccount = account;
    // this.accountSelected.emit(account);
  }

  onSubmit() {
    if (!this.currentCategory || !this.currentAccount) return;
    this.submitSelection.emit({ selectedCategory: this.currentCategory, account: this.currentAccount, amount: this.amount, txType: this.txType });
  }
}
