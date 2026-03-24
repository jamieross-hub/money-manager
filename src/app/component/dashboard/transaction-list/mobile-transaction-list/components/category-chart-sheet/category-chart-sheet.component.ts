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
  isFamilyMode = computed(() => this.data.isFamilyMode || false);
  isSplitMode = computed(() => this.data.isSplitMode || false);
  familyName = computed(() => this.data.familyName || '');
  members = computed(() => this.data.members || []);

  viewMode = signal<'category' | 'member'>('category');

  fullMemberBreakdown = computed(() => {
    const txs = this.filteredTransactions();
    const map = new Map<string, number>();
    let totalExpense = 0;

    txs.forEach((t: any) => {
      if (t.type === 'expense' && !t._isUpcoming && !t.settlementId) {
        const amt = Number(t.amount) || 0;
        totalExpense += amt;

        if (t.splitData?.splitBetween && t.splitData.splitBetween.length > 0) {
          t.splitData.splitBetween.forEach((share: any) => {
            const shareAmt = Number(share.amount) || 0;
            map.set(share.userId, (map.get(share.userId) || 0) + shareAmt);
          });
        } else {
          // fallback to recorder
          const uid = t.userId || t.payerId;
          if (uid) {
            map.set(uid, (map.get(uid) || 0) + amt);
          }
        }
      }
    });

    const list: any[] = [];
    const memberColor = (userId: string) => {
      const COLORS = ['#818cf8', '#2dd4bf', '#fb923c', '#f472b6', '#38bdf8', '#a78bfa', '#4ade80', '#fb7185'];
      let hash = 0;
      for (let i = 0; i < userId.length; i++) {
        hash = userId.charCodeAt(i) + ((hash << 5) - hash);
      }
      return COLORS[Math.abs(hash) % COLORS.length];
    };

    map.forEach((amount, userId) => {
      if (amount <= 0) return;
      const pct = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      if (Math.round(pct) === 0) return;

      const member = this.members().find((m: any) => m.userId === userId);
      list.push({
        categoryId: userId, // Reusing ID key for ease of integration
        categoryName: member?.displayName || 'Unknown',
        categoryColor: memberColor(userId),
        categoryIcon: 'person', 
        amount,
        percentage: pct,
        photoURL: member?.photoURL
      });
    });

    return list.sort((a, b) => b.amount - a.amount);
  });

  activeBreakdown = computed(() => this.viewMode() === 'category' ? this.fullCategoryBreakdown() : this.fullMemberBreakdown());

  fullCategoryBreakdown = computed(() => {
    const txs = this.filteredTransactions();
    let totalExpense = 0;

    // First pass: accumulate raw amounts per categoryId
    const rawMap = new Map<string, number>();
    txs.forEach((t: any) => {
      if (t.type === 'expense' && !t._isUpcoming && !t.settlementId) {
        const amt = Number(t.amount) || 0;
        const catId = t.categoryId || 'unknown';
        rawMap.set(catId, (rawMap.get(catId) || 0) + amt);
        totalExpense += amt;
      }
    });

    // Second pass: group by category group (if available), else by categoryId
    // Key = group name (if group exists) OR categoryId
    const groupedMap = new Map<string, { amount: number; cat: any; isGroup: boolean }>();

    rawMap.forEach((amount, catId) => {
      const cat = this.categoryMap().get(catId);
      const groupKey = cat?.group ? `group::${cat.group}` : `cat::${catId}`;

      if (groupedMap.has(groupKey)) {
        groupedMap.get(groupKey)!.amount += amount;
      } else {
        groupedMap.set(groupKey, { amount, cat, isGroup: !!cat?.group });
      }
    });

    const list: any[] = [];
    groupedMap.forEach((entry, groupKey) => {
      const { amount, cat, isGroup } = entry;
      if (amount <= 0) return;
      const percentage = totalExpense > 0 ? (amount / totalExpense) * 100 : 0;
      if (Math.round(percentage) === 0) return;

      list.push({
        categoryId: groupKey,
        categoryName: isGroup ? (cat?.group || 'Unknown') : (cat?.name || 'Unknown'),
        categoryColor: cat?.color || '#3b82f6',
        categoryIcon: isGroup ? (cat?.groupIcon || 'folder') : (cat?.icon || 'category'),
        amount,
        percentage,
        isGroup
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

    // Merge slices below 5% into "Others"
    const mainItems = sortedList.filter(item => item.percentage >= 5);
    const smallItems = sortedList.filter(item => item.percentage < 5);

    if (smallItems.length > 0) {
      const othersAmount = smallItems.reduce((sum, item) => sum + item.amount, 0);
      const othersPercentage = smallItems.reduce((sum, item) => sum + item.percentage, 0);
      mainItems.push({
        categoryId: 'others',
        categoryName: 'Others',
        categoryColor: '#9ca3af',
        categoryIcon: 'more_horiz',
        amount: othersAmount,
        percentage: othersPercentage,
        isGrouped: true
      });
    }

    // Assign premium colors sequentially to sorted list max contrast
    mainItems.forEach((item, index) => {
      if (item.categoryId !== 'others') {
        item.categoryColor = PREMIUM_COLORS[index % PREMIUM_COLORS.length];
      }
    });

    return mainItems;
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
      const breakdown = this.activeBreakdown();
      const hover = this.hoveredCategory();
      this.drawPieChart(breakdown, hover);
    });
  }

  ngAfterViewInit() {
    // Canvas might not be drawn if view list is empty initially, redraw when ready
    setTimeout(() => {
      this.drawPieChart(this.activeBreakdown());
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

    // 2b. Inner Cutout Shadow (Shadow from center hole falling outwards on chart)
    const innerCutoutGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.38, centerX, centerY, radius * 0.48);
    innerCutoutGrad.addColorStop(0, 'rgba(0, 0, 0, 0.25)'); // Peak inside edge cutout
    innerCutoutGrad.addColorStop(0.3, 'rgba(0, 0, 0, 0.06)');
    innerCutoutGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = innerCutoutGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.fill();

    // 3. Glass Reflection (Soft radial light highlight for roundness instead of flat bezier cut)
    const glassGrad = ctx.createRadialGradient(centerX - radius * 0.3, centerY - radius * 0.3, 0, centerX - radius * 0.3, centerY - radius * 0.3, radius * 0.8);
    glassGrad.addColorStop(0, 'rgba(255, 255, 255, 0.35)'); // Bright spark top left
    glassGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.12)');
    glassGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = glassGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2, 0, 2 * Math.PI);
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

    // 3D Tilt calculation (Keep subtle to avoid elliptical distortion)
    const tiltX = (dx / centerX) * 4; // Rotation on Y
    const tiltY = -(dy / centerY) * 4; // Rotation on X
    
    const container = this.canvas.nativeElement.parentElement;
    if (container) {
      container.style.setProperty('--tilt-x', `${tiltX}deg`);
      container.style.setProperty('--tilt-y', `${tiltY}deg`);
    }

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
    const breakdown = this.activeBreakdown();
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
    if (this.canvas) {
      const container = this.canvas.nativeElement.parentElement;
      if (container) {
        container.style.setProperty('--tilt-x', '0deg');
        container.style.setProperty('--tilt-y', '0deg');
      }
    }
  }

  dismiss() {
    this.bottomSheetRef.dismiss();
  }
}

