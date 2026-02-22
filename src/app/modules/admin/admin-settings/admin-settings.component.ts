import { Component, OnInit, OnDestroy , ChangeDetectionStrategy, ChangeDetectorRef} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotificationService } from 'src/app/util/service/notification.service';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { LocalStorageKey } from 'src/app/util/models/local-storage.model';

export interface AdminSettings {
  appName: string;
  appVersion: string;
  maintenanceMode: boolean;
  userRegistrationEnabled: boolean;
  emailNotificationsEnabled: boolean;
  maxFileUploadSize: number;
  sessionTimeout: number;
  backupFrequency: string;
  analyticsEnabled: boolean;
  debugMode: boolean;
}

@Component({
  selector: 'app-admin-settings',
  templateUrl: './admin-settings.component.html',
  styleUrls: ['./admin-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AdminSettingsComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  isLoading: boolean = false;
  isSaving: boolean = false;
  private destroy$ = new Subject<void>();

  // Settings categories
  settingsCategories = [
    {
      id: 'general',
      label: 'General Settings',
      icon: 'settings',
      description: 'Basic application configuration'
    },
    {
      id: 'security',
      label: 'Security Settings',
      icon: 'security',
      description: 'Security and authentication settings'
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: 'notifications',
      description: 'Email and push notification settings'
    },
    {
      id: 'performance',
      label: 'Performance',
      icon: 'speed',
      description: 'Performance and optimization settings'
    }
  ];

  activeCategory: string = 'general';

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private localStorageService: LocalIndexDBStorageService,
    private changeDetectorRef: ChangeDetectorRef
  ) {
    this.settingsForm = this.createForm();
  }

  ngOnInit(): void {
    this.loadSettings();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private createForm(): FormGroup {
    return this.fb.group({
      // General Settings
      appName: ['Money Manager', [Validators.required, Validators.minLength(2)]],
      appVersion: ['1.0.0', [Validators.required]],
      maintenanceMode: [false],
      userRegistrationEnabled: [true],

      // Security Settings
      sessionTimeout: [30, [Validators.required, Validators.min(5), Validators.max(120)]],
      maxLoginAttempts: [5, [Validators.required, Validators.min(3), Validators.max(10)]],
      requireEmailVerification: [true],
      enableTwoFactor: [false],

      // Notification Settings
      emailNotificationsEnabled: [true],
      pushNotificationsEnabled: [true],
      feedbackNotificationsEnabled: [true],
      adminNotificationsEnabled: [true],

      // Performance Settings
      maxFileUploadSize: [5, [Validators.required, Validators.min(1), Validators.max(50)]],
      backupFrequency: ['daily', [Validators.required]],
      analyticsEnabled: [true],
      debugMode: [false],
      cacheEnabled: [true],
      compressionEnabled: [true]
    });
  }

  private async loadSettings(): Promise<void> {
    this.isLoading = true;
    this.changeDetectorRef.markForCheck();
    try {
      // Load settings from localStorage or API
      const settings = this.localStorageService.getItem<any>(LocalStorageKey.ADMIN_SETTINGS);
      if (settings) {
        this.settingsForm.patchValue(settings);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      this.notificationService.error('Failed to load settings');
    } finally {
      this.isLoading = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  public async saveSettings(): Promise<void> {
    if (this.settingsForm.invalid) {
      this.notificationService.warning('Please fix the form errors before saving');
      return;
    }

    this.isSaving = true;
    this.changeDetectorRef.markForCheck();
    try {
      const settings = this.settingsForm.value;

      // Save to localStorage (in real app, save to API)
      this.localStorageService.setItem(LocalStorageKey.ADMIN_SETTINGS, settings);

      this.notificationService.success('Settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      this.notificationService.error('Failed to save settings');
    } finally {
      this.isSaving = false;
      this.changeDetectorRef.markForCheck();
    }
  }

  public resetSettings(): void {
    this.settingsForm.reset();
    this.loadSettings();
    this.notificationService.info('Settings reset to default values');
  }

  public setActiveCategory(categoryId: string): void {
    this.activeCategory = categoryId;
  }

  public getActiveCategory(): any {
    return this.settingsCategories.find(category => category.id === this.activeCategory);
  }

  public exportSettings(): void {
    try {
      const settings = this.settingsForm.value;
      const dataStr = JSON.stringify(settings, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `admin-settings-${new Date().toISOString().split('T')[0]}.json`;
      link.click();
      URL.revokeObjectURL(url);
      this.notificationService.success('Settings exported successfully');
    } catch (error) {
      console.error('Error exporting settings:', error);
      this.notificationService.error('Failed to export settings');
    }
  }

  public importSettings(event: any): void {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e: any) => {
      try {
        const settings = JSON.parse(e.target.result);
        this.settingsForm.patchValue(settings);
        this.notificationService.success('Settings imported successfully');
      } catch (error) {
        console.error('Error importing settings:', error);
        this.notificationService.error('Invalid settings file');
      }
    };
    reader.readAsText(file);
  }

  public getFormControl(name: string) {
    return this.settingsForm.get(name);
  }

  public isFormControlInvalid(name: string): boolean {
    const control = this.getFormControl(name);
    return control ? control.invalid && control.touched : false;
  }
} 