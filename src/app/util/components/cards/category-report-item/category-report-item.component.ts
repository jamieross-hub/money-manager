import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal, computed, inject, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { CurrencyPipe, AbsPipe } from 'src/app/util/pipes';
import { CategoryReportItem, ExpandedReportData } from '../../../models/report-card.model';
import { LocalIndexDBStorageService } from '../../../../util/service/indexdb-storage.service';
import { LocalStorageKey } from '../../../../util/models/local-storage.model';

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
export class CategoryReportItemComponent implements OnInit {
  @Input({ required: true }) item!: CategoryReportItem;
  @Input({ required: true }) isExpanded: boolean = false;
  @Input() hideHeader: boolean = false;
  @Input() expandedData: ExpandedReportData | null = null;
  @Output() toggleExpand = new EventEmitter<void>();

  private storage = inject(LocalIndexDBStorageService);
  selectedSubId = signal<string | null>(null);
  sortOrder: 'none' | 'asc' | 'desc' = 'none';

  ngOnInit() {
    const uiState = this.storage.getItem<any>(LocalStorageKey.REPORTS_UI_STATE);
    const catState = uiState?.categoryStates?.[this.item.categoryId];
    if (catState) {
      if (catState.selectedSubId) this.selectedSubId.set(catState.selectedSubId);
      if (catState.sortOrder) this.sortOrder = catState.sortOrder;
    }
  }

  private updatePersistedState(updates: any) {
    const uiState = this.storage.getItem<any>(LocalStorageKey.REPORTS_UI_STATE) || { categoryStates: {} };
    const categoryStates = uiState.categoryStates || {};
    categoryStates[this.item.categoryId] = {
      ...(categoryStates[this.item.categoryId] || { selectedSubId: null, sortOrder: 'none' }),
      ...updates
    };
    this.storage.setItem(LocalStorageKey.REPORTS_UI_STATE, { ...uiState, categoryStates });
  }

  onToggle(): void {
    this.toggleExpand.emit();
  }

  onSubCategoryClick(event: Event, categoryId: string): void {
    event.stopPropagation();
    this.selectedSubId.update(current => {
      const next = current === categoryId ? null : categoryId;
      this.updatePersistedState({ selectedSubId: next });
      return next;
    });
  }

  toggleSort(event: Event): void {
    event.stopPropagation();
    if (this.sortOrder === 'none') {
      this.sortOrder = 'desc';
    } else if (this.sortOrder === 'desc') {
      this.sortOrder = 'asc';
    } else {
      this.sortOrder = 'none';
    }
    this.updatePersistedState({ sortOrder: this.sortOrder });
  }

  get sortedTransactions(): any[] {
    let transactions = [...(this.expandedData?.transactions || [])];
    
    // Apply sub-category filter if active
    const filterId = this.selectedSubId();
    if (filterId) {
      transactions = transactions.filter(t => t.categoryId === filterId);
    }

    // Default: Sort by Category name, then by Date
    if (this.sortOrder === 'none') {
      return transactions.sort((a, b) => {
        const catA = (a.category || '').toLowerCase();
        const catB = (b.category || '').toLowerCase();
        if (catA !== catB) return catA.localeCompare(catB);
        
        // Secondary sort: Date (newest first)
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateB - dateA;
      });
    }

    // Explicit sort: Amount (requested from UI)
    return transactions.sort((a, b) => {
      const amountA = Math.abs(a.amount);
      const amountB = Math.abs(b.amount);
      return this.sortOrder === 'asc' ? amountA - amountB : amountB - amountA;
    });
  }

  get fallbackIcon(): string {
    return 'category';
  }
}
