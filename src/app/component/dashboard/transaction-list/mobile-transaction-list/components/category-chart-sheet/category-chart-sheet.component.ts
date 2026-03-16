import { Component, inject, computed, signal, ViewChild, ElementRef, effect, AfterViewInit } from '@angular/core';
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
export class CategoryChartSheetComponent implements AfterViewInit {
  public readonly bottomSheetRef = inject(MatBottomSheetRef<CategoryChartSheetComponent>);
  public readonly data = inject(MAT_BOTTOM_SHEET_DATA);

  @ViewChild('pieCanvas') canvas!: ElementRef<HTMLCanvasElement>;

  hoveredCategory = signal<any | null>(null);

  filteredTransactions = computed(() => this.data.filteredTransactions || []);
  categoryMap = computed(() => this.data.categoryMap || new Map());
  totalExpenses = computed(() => this.data.totalExpenses || 0);

  fullCategoryBreakdown = computed(() => {
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

    const PREMIUM_COLORS = [
      '#818cf8', // Soft Indigo
      '#2dd4bf', // Mint Teal
      '#fb923c', // Soft Amber/Peach
      '#f472b6', // Pastel Pink
      '#38bdf8', // Luminous Cyan
      '#a78bfa', // Soft Purple
      '#4ade80', // Emerald Green
      '#fb7185', // Coral Blush
    ];

    const sortedList = list.sort((a, b) => b.amount - a.amount);
    
    // Assign premium colors sequentially to sorted list max contrast
    sortedList.forEach((item, index) => {
      item.categoryColor = PREMIUM_COLORS[index % PREMIUM_COLORS.length];
    });

    return sortedList;
  });

  categoryBreakdown = computed(() => {
    const sortedList = this.fullCategoryBreakdown();
    
    if (sortedList.length <= 6) {
      return sortedList;
    }

    const topCategories = sortedList.slice(0, 6);
    const remainingCategories = sortedList.slice(6);

    const othersAmount = remainingCategories.reduce((sum, item) => sum + item.amount, 0);
    const othersPercentage = remainingCategories.reduce((sum, item) => sum + item.percentage, 0);

    topCategories.push({
      categoryId: 'others',
      categoryName: 'Others',
      categoryColor: '#9ca3af', // gray-400
      categoryIcon: 'more_horiz',
      amount: othersAmount,
      percentage: othersPercentage,
      isGrouped: true
    });

    return topCategories;
  });

  constructor() {
    effect(() => {
      const breakdown = this.categoryBreakdown();
      const hover = this.hoveredCategory();
      this.drawPieChart(breakdown, hover);
    });
  }

  ngAfterViewInit() {
    // Canvas might not be drawn if view list is empty initially, redraw when ready
    setTimeout(() => {
      this.drawPieChart(this.categoryBreakdown());
    }, 0);
  }

  drawPieChart(breakdown: any[], hover: any | null = null) {
    if (!this.canvas) return;
    const ctx = this.canvas.nativeElement.getContext('2d');
    if (!ctx) return;

    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const width = this.canvas.nativeElement.width = rect.width * 2; // High DPI support
    const height = this.canvas.nativeElement.height = rect.height * 2;

    // Get theme background color for gap stroke
    const parent = this.canvas.nativeElement.parentElement;
    const bgColor = parent ? window.getComputedStyle(parent).backgroundColor : '#ffffff';

    const radius = Math.min(width, height) / 2 - 58; // Expand padding clearance for deeper shadow bounds
    const centerX = width / 2;
    const centerY = height / 2;

    ctx.clearRect(0, 0, width, height);

    if (breakdown.length === 0) {
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.fillStyle = '#f3f4f6';
      ctx.fill();
      return;
    }

    let highlightIndex = -1;
    if (hover) {
      highlightIndex = breakdown.findIndex(item => item.categoryId === hover.categoryId);
      // If hover category not explicitly in breakdown, it might be inside "Others" group!
      if (highlightIndex === -1 && hover.categoryId !== 'others') {
        highlightIndex = breakdown.findIndex(item => item.isGrouped);
      }
    }

    let currentAngle = -Math.PI / 2; // Start from top

    // 0. Backplate Base with Drop Shadow for lifting effect (Centered Glow)
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
    ctx.shadowBlur = 35;
    ctx.shadowOffsetY = 0;
    ctx.shadowOffsetX = 0;
    ctx.fillStyle = (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') ? bgColor : '#ffffff';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();
    ctx.shadowBlur = 0; // Reset for slices !

    // 1. Draw Slices
    breakdown.forEach((item, index) => {
      const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
      const isHighlighted = (index === highlightIndex);
      const sliceRadius = isHighlighted ? radius + 10 : radius;

      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, sliceRadius, currentAngle, currentAngle + sliceAngle);
      ctx.closePath();

      // Shaded radial gradients inside slice for 3D Volume Spark
      const adjustBrightness = (hex: string, percent: number) => {
        let num = parseInt(hex.replace('#',''), 16), amt = Math.round(2.55 * percent), R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
      };

      try {
        const grad = ctx.createRadialGradient(centerX, centerY, radius * 0.35, centerX, centerY, sliceRadius);
        grad.addColorStop(0, adjustBrightness(item.categoryColor, 20)); 
        grad.addColorStop(0.5, item.categoryColor);
        grad.addColorStop(1, adjustBrightness(item.categoryColor, -15)); 
        ctx.fillStyle = grad;
      } catch {
        ctx.fillStyle = item.categoryColor; // Fallback
      }
      
      if (isHighlighted) {
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 20;
      } else {
        ctx.shadowColor = 'rgba(0,0,0,0.18)';
        ctx.shadowBlur = 10;
      }
      
      ctx.fill();

      // SPECULAR 3D LIGHT SHIMMER (Outer rim specular light)
      ctx.shadowBlur = 0; // Reset shadow BEFORE white stroke overlay!
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, sliceRadius - 1, currentAngle, currentAngle + sliceAngle);
      ctx.stroke();
      
      // Add gap separating slices matching theme backdrop
      ctx.strokeStyle = (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') ? bgColor : '#ffffff';
      ctx.lineWidth = 4; // Gap width in pixels
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset
      currentAngle += sliceAngle;
    });

    // 2. 3D Volume Gradient Overlay
    const volumeGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.4, centerX, centerY, radius);
    volumeGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
    volumeGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0.03)');
    volumeGrad.addColorStop(1, 'rgba(0, 0, 0, 0.18)'); // Soft edge shading
    ctx.fillStyle = volumeGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // 3. Glass Reflection
    ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2, -Math.PI, 0, false);
    ctx.bezierCurveTo(centerX + radius * 0.3, centerY - radius * 0.4, centerX - radius * 0.3, centerY - radius * 0.4, centerX - radius + 2, centerY);
    ctx.fill();

    // 4. (Removed inner percentage labels to make a Pure Clean Donut)
    const _placeholder4 = null;

    // 5. Outer Stroke for crispness
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // 6. (Removed outside connector lines to hide tooltips for clean view)
    const _placeholder6 = null;
  }

  onCanvasMouseMove(e: MouseEvent) {
    if (!this.canvas) return;
    const rect = this.canvas.nativeElement.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const dx = x - centerX;
    const dy = y - centerY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    const radius = Math.min(rect.width, rect.height) / 2;

    if (dist > radius || dist < radius * 0.4) { // outside or inside center-hole
      this.hoveredCategory.set(null);
      return;
    }

    // Calculate angle starting from top (-PI/2)
    let angle = Math.atan2(dy, dx); 
    let normalizedAngle = angle + Math.PI / 2;
    if (normalizedAngle < 0) normalizedAngle += 2 * Math.PI;

    let currentAngle = 0;
    const breakdown = this.categoryBreakdown();
    for (const item of breakdown) {
      const sliceAngle = (item.percentage / 100) * 2 * Math.PI;
      if (normalizedAngle >= currentAngle && normalizedAngle < currentAngle + sliceAngle) {
        this.hoveredCategory.set(item);
        return;
      }
      currentAngle += sliceAngle;
    }
  }

  onCanvasMouseLeave() {
    this.hoveredCategory.set(null);
  }

  dismiss() {
    this.bottomSheetRef.dismiss();
  }
}

