import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';

@Component({
  selector: 'category-chart-sheet',
  templateUrl: './category-chart-sheet.component.html',
  styleUrls: ['./category-chart-sheet.component.scss'],
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, CurrencyPipe]
})
export class CategoryChartSheetComponent {
  public readonly bottomSheetRef = inject(MatBottomSheetRef<CategoryChartSheetComponent>);
  public readonly data = inject(MAT_BOTTOM_SHEET_DATA);

  hoveredCategory = signal<any | null>(null);

  filteredTransactions = computed(() => this.data.filteredTransactions || []);
  categoryMap = computed(() => this.data.categoryMap || new Map());
  totalExpenses = computed(() => this.data.totalExpenses || 0);

  categoryBreakdown = computed(() => {
    const txs = this.filteredTransactions();
    const map = new Map<string, number>();
    let totalExpense = 0;

    txs.forEach((t: any) => {
      if (t.type === 'expense' && !t._isUpcoming && !t.settlementId) {
        const amt = Number(t.amount) || 0;
        const catId = t.categoryId || 'unknown';
        map.set(catId, (map.get(catId) || 0) + amt);
        totalExpense += amt;
      }
    });

    const list: any[] = [];
    map.forEach((amount, catId) => {
      const cat = this.categoryMap().get(catId);
      list.push({
        categoryId: catId,
        categoryName: cat?.name || 'Unknown',
        categoryColor: cat?.color || '#3b82f6',
        categoryIcon: cat?.icon || 'category',
        amount,
        percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
      });
    });

    return list.sort((a, b) => b.amount - a.amount);
  });

  pieChartGradient = computed(() => {
    const breakdown = this.categoryBreakdown();
    if (breakdown.length === 0) return 'conic-gradient(#f3f4f6 0% 100%)';
    let currentPerc = 0;
    const items = breakdown.map(item => {
      const start = currentPerc;
      currentPerc += item.percentage;
      return `${item.categoryColor} ${start}% ${currentPerc}%`;
    });
    return `conic-gradient(${items.join(', ')})`;
  });

  dismiss() {
    this.bottomSheetRef.dismiss();
  }
}
