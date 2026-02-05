import { Injectable } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ValidationService } from './validation.service';
import { Budget, Category } from '../models/category.model';
import { APP_CONFIG } from '../config/config';
import { DateService } from './date.service';
import { CurrencyService } from './currency.service';


@Injectable({
  providedIn: 'root'
})
export class CategoryBudgetService {

  constructor(
    private fb: FormBuilder,
    private dateService: DateService,
    private validationService: ValidationService,
    private currencyService: CurrencyService
  ) { }

  /**
   * Create a budget form group
   */
  createBudgetForm(): FormGroup {
    return this.fb.group({
      hasBudget: [false],
      budgetAmount: [0, this.validationService.getBudgetAmountValidators()],
      budgetPeriod: ['monthly', Validators.required],
      budgetStartDate: [new Date(), Validators.required],
      budgetEndDate: [null],
      budgetAlertThreshold: [80, this.validationService.getBudgetThresholdValidators()],
      budgetAlertEnabled: [true]
    });
  }

  /**
   * Initialize budget form with existing category data
   */
  initializeBudgetForm(form: FormGroup, category?: Category): void {
    if (category?.budget?.hasBudget) {
      form.patchValue({
        hasBudget: category.budget?.hasBudget,
        budgetAmount: category.budget?.budgetAmount || 0,
        budgetPeriod: category.budget?.budgetPeriod || 'monthly',
        budgetStartDate: category.budget?.budgetStartDate ? this.dateService.toDate(category.budget?.budgetStartDate) : new Date(),
        budgetEndDate: category.budget?.budgetEndDate ? this.dateService.toDate(category.budget?.budgetEndDate) : null,
        budgetAlertThreshold: category.budget?.budgetAlertThreshold || 80,
        budgetAlertEnabled: category.budget?.budgetAlertEnabled !== false
      });
    }

    // Update form validation based on hasBudget toggle
    this.setupBudgetFormValidation(form);
  }

  /**
   * Setup form validation based on hasBudget toggle
   */
  setupBudgetFormValidation(form: FormGroup): void {
    form.get('hasBudget')?.valueChanges.subscribe(hasBudget => {
      if (hasBudget) {
        form.get('budgetAmount')?.enable();
        form.get('budgetPeriod')?.enable();
        form.get('budgetStartDate')?.enable();
        form.get('budgetEndDate')?.enable();
        form.get('budgetAlertThreshold')?.enable();
        form.get('budgetAlertEnabled')?.enable();
      } else {
        form.get('budgetAmount')?.disable();
        form.get('budgetPeriod')?.disable();
        form.get('budgetStartDate')?.disable();
        form.get('budgetEndDate')?.disable();
        form.get('budgetAlertThreshold')?.disable();
        form.get('budgetAlertEnabled')?.disable();
      }
    });

    // Trigger initial validation
    form.get('hasBudget')?.updateValueAndValidity();
  }

  /**
   * Get budget data from form
   */
  getBudgetDataFromForm(form: FormGroup): Budget {
    const formValue = form.value;
    return {
      hasBudget: formValue.hasBudget || false,
      budgetAmount: formValue.hasBudget ? formValue?.budgetAmount || 0 : 0,
      budgetPeriod: formValue.hasBudget ? formValue?.budgetPeriod || 'monthly' : 'monthly',
      budgetStartDate: formValue.hasBudget ? formValue?.budgetStartDate?.getTime() || null : null,
      budgetEndDate: formValue.hasBudget && formValue.budgetEndDate ? formValue.budgetEndDate.getTime() : null,
      budgetAlertThreshold: formValue.hasBudget ? formValue?.budgetAlertThreshold || 80 : 80,
      budgetAlertEnabled: formValue.hasBudget ? formValue?.budgetAlertEnabled || true : true
    };
  }

  /**
   * Check if budget form is valid
   */
  isBudgetFormValid(form: FormGroup): boolean {
    if (!form.get('hasBudget')?.value) {
      return true; // Form is valid if no budget is set
    }
    return form.valid;
  }

  /**
   * Get budget period options
   */
  getBudgetPeriods(): Array<{ value: string; label: string }> {
    return [
      { value: 'daily', label: 'Daily' },
      { value: 'weekly', label: 'Weekly' },
      { value: 'monthly', label: 'Monthly' },
      { value: 'yearly', label: 'Yearly' }
    ];
  }

  /**
   * Format budget amount
   */
  formatBudgetAmount(amount: number | undefined): string {
    if (!amount) return this.currencyService.formatAmount(0);
    return this.currencyService.formatAmount(amount);
  }

  /**
   * Format budget period
   */
  formatBudgetPeriod(period: string | undefined): string {
    if (!period) return '';
    return period.charAt(0).toUpperCase() + period.slice(1);
  }

  /**
   * Get budget progress color
   */
  getBudgetProgressColor(category: Category, budgetProgressPercentage: number, budgetAlertThreshold: number): string {
    if (!category.budget?.hasBudget || !budgetProgressPercentage) {
      return '#6b7280'; // gray
    }

    if (budgetProgressPercentage >= 100) {
      return '#ef4444'; // red - over budget
    } else if (budgetProgressPercentage >= budgetAlertThreshold) {
      return '#f59e0b'; // amber - warning
    } else if (budgetProgressPercentage >= 60) {
      return '#3b82f6'; // blue - good progress
    } else {
      return '#10b981'; // green - safe
    }
  }
} 