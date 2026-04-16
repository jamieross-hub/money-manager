import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrencyPipe, AbsPipe } from 'src/app/util/pipes';
import { CategoryReportItem, ExpandedReportData } from '../../../models/report-card.model';

@Component({
  selector: 'app-category-report-item',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDividerModule,
    MatTooltipModule,
    DecimalPipe,
    CurrencyPipe,
    AbsPipe
  ],
  templateUrl: './category-report-item.component.html',
  styleUrls: ['./category-report-item.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CategoryReportItemComponent {
  @Input({ required: true }) item!: CategoryReportItem;
  @Input({ required: true }) isExpanded: boolean = false;
  @Input() expandedData: ExpandedReportData | null = null;
  @Output() toggleExpand = new EventEmitter<void>();

  onToggle(): void {
    this.toggleExpand.emit();
  }

  sortOrder: 'none' | 'asc' | 'desc' = 'none';

  toggleSort(event: Event): void {
    event.stopPropagation();
    if (this.sortOrder === 'none') {
      this.sortOrder = 'desc';
    } else if (this.sortOrder === 'desc') {
      this.sortOrder = 'asc';
    } else {
      this.sortOrder = 'none';
    }
  }

  get sortedTransactions(): any[] {
    const transactions = this.expandedData?.transactions || [];
    if (this.sortOrder === 'none') {
      return transactions;
    }

    return [...transactions].sort((a, b) => {
      const amountA = Math.abs(a.amount);
      const amountB = Math.abs(b.amount);
      return this.sortOrder === 'asc' ? amountA - amountB : amountB - amountA;
    });
  }

  get fallbackIcon(): string {
    return 'category';
  }
}
