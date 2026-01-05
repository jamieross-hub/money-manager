import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Category } from 'src/app/util/models/category.model';

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

  @Output() selected = new EventEmitter<{ selectedCategory: Category; amount: number; txType: string }>();

  onChange(value: any) {
    if (!value) return;
    this.selected.emit({ selectedCategory: value, amount: this.amount, txType: this.txType });
  }
}
