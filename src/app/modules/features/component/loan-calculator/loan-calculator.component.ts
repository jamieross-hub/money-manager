import { Component, OnInit, OnDestroy, Inject, NgZone, PLATFORM_ID, AfterViewInit } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import * as am5 from "@amcharts/amcharts5";
import * as am5percent from "@amcharts/amcharts5/percent";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { CurrencyService } from '../../../../util/service/currency.service';
import { ThemeSwitchingService } from '../../../../util/service/theme-switching.service';

@Component({
    selector: 'app-loan-calculator',
    standalone: true,
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        MatCardModule,
        MatSliderModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonToggleModule,
        MatButtonModule,
        MatIconModule,
        MatTooltipModule,
        MatSnackBarModule,
        TranslateModule
    ],
    templateUrl: './loan-calculator.component.html',
    styleUrl: './loan-calculator.component.scss'
})
export class LoanCalculatorComponent implements OnInit, AfterViewInit, OnDestroy {
    // Model values
    loanAmount: number = 500000;
    interestRate: number = 10.5;
    tenureValue: number = 36;
    tenureType: 'mo' | 'yr' = 'mo';

    // Calculated results
    monthlyEmi: number = 0;
    totalInterest: number = 0;
    totalAmount: number = 0;

    // Constants
    minAmount = 10000;
    maxAmount = 5000000;
    minRate = 1;
    maxRate = 30;

    // amCharts
    private root: am5.Root | undefined;
    private chart: am5percent.PieChart | undefined;
    private series: am5percent.PieSeries | undefined;
    private themeSubscription: Subscription | undefined;
    chartContainerId: string = 'loan-breakdown-chart';

    constructor(
        @Inject(PLATFORM_ID) private platformId: Object,
        private zone: NgZone,
        public currencyService: CurrencyService,
        private snackBar: MatSnackBar,
        private translate: TranslateService,
        private route: ActivatedRoute,
        private themeService: ThemeSwitchingService
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            if (params['amount']) this.loanAmount = +params['amount'];
            if (params['rate']) this.interestRate = +params['rate'];
            if (params['tenure']) this.tenureValue = +params['tenure'];
            if (params['type']) this.tenureType = params['type'] as 'mo' | 'yr';
            this.calculateEMI();
        });

        // Subscribe to theme changes for chart colors
        this.themeSubscription = this.themeService.currentTheme.subscribe(() => {
            // Check if chart is initialized and we're in browser
            if (this.series && isPlatformBrowser(this.platformId)) {
                // Small delay to ensure CSS variables are applied to the body
                setTimeout(() => this.updateChartColors(), 100);
            }
        });

        this.calculateEMI();
    }

    ngAfterViewInit(): void {
        this.browserOnly(() => {
            this.initChart();
        });
    }

    ngOnDestroy(): void {
        this.browserOnly(() => {
            if (this.root) {
                this.root.dispose();
            }
        });
        if (this.themeSubscription) {
            this.themeSubscription.unsubscribe();
        }
    }

    calculateEMI(): void {
        const P = this.loanAmount;
        const R = this.interestRate / 12 / 100;
        const N = this.tenureType === 'yr' ? this.tenureValue * 12 : this.tenureValue;

        if (R === 0) {
            this.monthlyEmi = P / N;
        } else {
            this.monthlyEmi = (P * R * Math.pow(1 + R, N)) / (Math.pow(1 + R, N) - 1);
        }

        this.totalAmount = this.monthlyEmi * N;
        this.totalInterest = this.totalAmount - P;

        this.updateChart();
    }

    resetToDefaults(): void {
        this.loanAmount = 500000;
        this.interestRate = 10.5;
        this.tenureValue = 36;
        this.tenureType = 'mo';
        this.calculateEMI();
    }

    copyShareableLink(): void {
        const url = new URL(window.location.href);
        url.searchParams.set('amount', this.loanAmount.toString());
        url.searchParams.set('rate', this.interestRate.toString());
        url.searchParams.set('tenure', this.tenureValue.toString());
        url.searchParams.set('type', this.tenureType);

        navigator.clipboard.writeText(url.toString()).then(() => {
            this.snackBar.open(this.translate.instant('LOAN_CALCULATOR.LINK_COPIED'), this.translate.instant('COMMON.CLOSE'), {
                duration: 2000
            });
        });
    }

    private initChart(): void {
        this.root = am5.Root.new(this.chartContainerId);
        this.root.setThemes([am5themes_Animated.new(this.root)]);

        this.chart = this.root.container.children.push(
            am5percent.PieChart.new(this.root, {
                innerRadius: am5.percent(60),
                layout: this.root.verticalLayout
            })
        );

        this.series = this.chart.series.push(
            am5percent.PieSeries.new(this.root, {
                valueField: "value",
                categoryField: "category",
                alignLabels: false
            })
        );

        this.series.labels.template.set("forceHidden", true);
        this.series.ticks.template.set("forceHidden", true);

        this.series.slices.template.setAll({
            strokeOpacity: 0,
            fillOpacity: 0.9,
            tooltipText: "{category}: [bold]{value}[/]"
        });

        this.series.slices.template.states.create("hover", {
            fillOpacity: 1,
            scale: 1.05
        });

        // Custom colors matching the app theme
        this.updateChartColors();

        this.updateChart();
        this.series.appear(1000, 100);
    }

    private updateChartColors(): void {
        if (this.series) {
            const primaryColor = this.getColorFromTheme('--primary-500', '#3B82F6');
            const tertiaryColor = this.getColorFromTheme('--tertiary-500', '#F97316');

            this.series.get("colors")?.set("colors", [
                am5.color(primaryColor),
                am5.color(tertiaryColor)
            ]);
        }
    }

    private getColorFromTheme(variable: string, fallback: string): string {
        if (isPlatformBrowser(this.platformId)) {
            const value = getComputedStyle(document.body).getPropertyValue(variable).trim();
            return value || fallback;
        }
        return fallback;
    }

    private updateChart(): void {
        if (this.series) {
            this.series.data.setAll([
                { category: this.translate.instant('LOAN_CALCULATOR.PRINCIPAL'), value: this.loanAmount },
                { category: this.translate.instant('LOAN_CALCULATOR.INTEREST'), value: this.totalInterest }
            ]);
        }
    }

    private browserOnly(f: () => void) {
        if (isPlatformBrowser(this.platformId)) {
            this.zone.runOutsideAngular(() => {
                f();
            });
        }
    }

    get currentMinTenure(): number {
        return 1;
    }

    get currentMaxTenure(): number {
        return this.tenureType === 'yr' ? 30 : 360;
    }

    onTenureTypeChange(): void {
        if (this.tenureType === 'yr') {
            if (this.tenureValue > 30) {
                this.tenureValue = 30;
            }
        } else {
            // No need to convert if we want to stay within 360
        }
        this.calculateEMI();
    }

    onTenureChange(event: any): void {
        this.tenureValue = Number(event.target.value);
        this.calculateEMI();
    }
}
