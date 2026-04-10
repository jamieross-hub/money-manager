import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { CurrencyPipe, AbsPipe } from 'src/app/util/pipes';
import { CategoryReportItem, ExpandedReportData } from '../../../models/report-card.model';

@Component({
  selector: 'app-category-report-item',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatDividerModule,
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

  get fallbackIcon(): string {
    return 'category';
  }
}
