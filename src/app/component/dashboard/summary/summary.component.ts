
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { CategoryComponent } from '../category/category.component';
import { AccountsComponent } from '../accounts/accounts.component';
import { CategorySummaryCardComponent } from 'src/app/util/components/cards/category-summary-card/category-summary-card.component';
import { ReportsComponent } from 'src/app/modules/features/component/reports/reports.component';


@Component({
    selector: 'user-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.scss'],
    standalone: true,
    imports: [
        MatTabsModule,
        MatIconModule,
        CategoryComponent,
        AccountsComponent,
        CategorySummaryCardComponent,
        ReportsComponent
    ],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class SummaryComponent {

    private static readonly TAB_COUNT = 3;
    private static readonly SWIPE_THRESHOLD = 50;

    tabIndex = 0;
    private touchStartX = 0;

    onTouchStart(e: TouchEvent): void {
        this.touchStartX = e.touches[0].clientX;
    }

    onTouchEnd(e: TouchEvent): void {
        const diff = e.changedTouches[0].clientX - this.touchStartX;
        if (Math.abs(diff) < SummaryComponent.SWIPE_THRESHOLD) return;

        this.tabIndex = diff > 0
            ? Math.max(0, this.tabIndex - 1)
            : Math.min(SummaryComponent.TAB_COUNT - 1, this.tabIndex + 1);
    }

}
