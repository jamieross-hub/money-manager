import { Component, Input, Output, EventEmitter, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

export interface QuickAction {
  id: string;
  label: string;
  icon: string;
  color: 'primary' | 'accent' | 'warn' | 'basic';
  tooltip: string;
  disabled?: boolean;
  loading?: boolean;
}

export interface QuickActionsFabConfig {
  title?: string;
  mainButtonIcon?: string;
  mainButtonColor?: 'primary' | 'accent' | 'warn' | 'basic';
  mainButtonTooltip?: string;
  showLabels?: boolean;
  animations?: boolean;
  autoHide?: boolean;
  autoHideDelay?: number;
  theme?: 'light' | 'dark' | 'auto';
  actions: QuickAction[];
  onActionClick?: (action: QuickAction) => void;
  onMainButtonClick?: () => void;
}

@Component({
  selector: 'app-quick-actions-fab',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './quick-actions-fab.component.html',
  styleUrl: './quick-actions-fab.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuickActionsFabComponent implements OnInit, OnDestroy {
  @Input() config: QuickActionsFabConfig = {
    title: 'Quick Actions',
    mainButtonIcon: 'add',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Quick Actions',
    showLabels: false,
    animations: true,
    autoHide: false,
    autoHideDelay: 3000,
    theme: 'auto',
    actions: [
      {
        id: 'add-transaction',
        label: 'Add Transaction',
        icon: 'receipt',
        color: 'accent',
        tooltip: 'Add Transaction'
      },
      {
        id: 'export-report',
        label: 'Export Report',
        icon: 'file_download',
        color: 'warn',
        tooltip: 'Export Report'
      },
      {
        id: 'refresh-data',
        label: 'Refresh Data',
        icon: 'refresh',
        color: 'primary',
        tooltip: 'Refresh Data'
      }
    ]
  };

  @Output() actionClick = new EventEmitter<QuickAction>();
  @Output() mainButtonClick = new EventEmitter<void>();

  isExpanded = false;
  autoHideTimer: any;

  ngOnInit(): void {
    // Component initialization if needed
  }

  ngOnDestroy(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
  }

  get effectiveConfig(): QuickActionsFabConfig {
    return {
      title: this.config.title ?? 'Quick Actions',
      mainButtonIcon: this.config.mainButtonIcon ?? 'add',
      mainButtonColor: this.config.mainButtonColor ?? 'primary',
      mainButtonTooltip: this.config.mainButtonTooltip ?? 'Quick Actions',
      showLabels: this.config.showLabels ?? false,
      animations: this.config.animations ?? true,
      autoHide: this.config.autoHide ?? false,
      autoHideDelay: this.config.autoHideDelay ?? 3000,
      theme: this.config.theme ?? 'auto',
      actions: this.config.actions || [],
      onActionClick: this.config.onActionClick,
      onMainButtonClick: this.config.onMainButtonClick
    };
  }

  get animationClass(): string {
    return this.effectiveConfig.animations ? 'fab-animated' : '';
  }

  get mainButtonIcon(): string {
    return this.isExpanded ? 'close' : (this.effectiveConfig.mainButtonIcon || 'add');
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
    
    if (this.effectiveConfig.onMainButtonClick) {
      this.effectiveConfig.onMainButtonClick();
    }
    
    this.mainButtonClick.emit();

    // Auto-hide functionality
    if (this.effectiveConfig.autoHide && this.isExpanded) {
      this.autoHideTimer = setTimeout(() => {
        this.isExpanded = false;
      }, this.effectiveConfig.autoHideDelay);
    } else if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
    }
  }

  onActionClick(action: QuickAction): void {
    if (action.disabled) return;

    if (this.effectiveConfig.onActionClick) {
      this.effectiveConfig.onActionClick(action);
    }
    
    this.actionClick.emit(action);
    this.isExpanded = false;
  }

  onMainButtonClick(): void {
    if (this.effectiveConfig.onMainButtonClick) {
      this.effectiveConfig.onMainButtonClick();
    }
    
    this.mainButtonClick.emit();
  }

  getActionButtonClass(action: QuickAction): string {
    const baseClass = 'shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out';
    const disabledClass = action.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:scale-110';
    const loadingClass = action.loading ? 'animate-spin' : '';
    
    return `${baseClass} ${disabledClass} ${loadingClass}`;
  }

  getMainButtonClass(): string {
    const baseClass = 'shadow-lg hover:shadow-xl transition-all duration-300 ease-in-out';
    const expandedClass = this.isExpanded ? 'rotate-45' : '';
    
    return `${baseClass} ${expandedClass}`;
  }
} 