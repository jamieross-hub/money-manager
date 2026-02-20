import { Component, OnInit , ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from 'src/app/util/service/notification.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { OpenaiService } from '../../../../util/service/ai-chat/openai.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { updatePreferences } from 'src/app/store/profile/profile.actions';
import { User } from '../../../../util/models';
import { GeminiService } from '../../../../util/service/ai-chat/gemini.service';

@Component({
  selector: 'app-openai-interaction',
  templateUrl: './openai-interaction.component.html',
  styleUrls: ['./openai-interaction.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenaiInteractionComponent implements OnInit {
  // Provider Selection
  selectedProvider: 'openai' | 'gemini' = 'openai';

  // State for both providers
  openai = {
    isConnected: false,
    apiKey: '',
    isConfiguring: false,
    isTestingConnection: false,
    isSaving: false
  };

  gemini = {
    isConnected: false,
    apiKey: '',
    isConfiguring: false,
    isTestingConnection: false,
    isSaving: false
  };

  apiKeyForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private userService: UserService,
    private openaiService: OpenaiService,
    private geminiService: GeminiService,
    private store: Store<AppState>,
    private cdr: ChangeDetectorRef
  ) {
    this.apiKeyForm = this.fb.group({
      apiKey: ['', [Validators.required, Validators.minLength(20)]]
    });
  }

  ngOnInit(): void {
    this.loadApiKeys();
  }

  async loadApiKeys(): Promise<void> {
    try {
      const currentUser = await this.userService.getCurrentUser();
      
      // Load OpenAI Key
      if (currentUser?.preferences?.openaiApiKey) {
        this.openai.apiKey = currentUser.preferences.openaiApiKey;
        this.openai.isConnected = true;
        this.openaiService.setApiKey(this.openai.apiKey);
        if (this.selectedProvider === 'openai') {
          this.apiKeyForm.patchValue({ apiKey: this.openai.apiKey });
        }
      }

      // Load Gemini Key
      if (currentUser?.preferences?.geminiApiKey) {
        this.gemini.apiKey = currentUser.preferences.geminiApiKey;
        this.gemini.isConnected = true;
        this.geminiService.setApiKey(this.gemini.apiKey);
        if (this.selectedProvider === 'gemini') {
          this.apiKeyForm.patchValue({ apiKey: this.gemini.apiKey });
        }
      }

      this.cdr.markForCheck();
    } catch (error) {
      console.error('Error loading API keys:', error);
      this.notificationService.error('Failed to load API keys');
    }
  }

  selectProvider(provider: 'openai' | 'gemini'): void {
    this.selectedProvider = provider;
    const currentKey = provider === 'openai' ? this.openai.apiKey : this.gemini.apiKey;
    this.apiKeyForm.patchValue({ apiKey: currentKey || '' });
    this.cdr.markForCheck();
  }

  get currentState() {
    return this.selectedProvider === 'openai' ? this.openai : this.gemini;
  }

  async saveApiKey(): Promise<void> {
    if (this.apiKeyForm.valid) {
      const state = this.currentState;
      state.isSaving = true;
      try {
        const apiKey = this.apiKeyForm.get('apiKey')?.value;
        const currentUser = await this.userService.getCurrentUser();

        if (!currentUser) throw new Error('User not found');

        const updatedPreferences = {
          ...currentUser.preferences,
          [this.selectedProvider === 'openai' ? 'openaiApiKey' : 'geminiApiKey']: apiKey
        };

        this.store.dispatch(updatePreferences({
          userId: currentUser.uid,
          preferences: updatedPreferences
        }));

        if (this.selectedProvider === 'openai') {
          this.openaiService.setApiKey(apiKey);
        } else {
          this.geminiService.setApiKey(apiKey);
        }

        state.apiKey = apiKey;
        state.isConnected = true;
        state.isConfiguring = false;
        this.notificationService.success(`${this.selectedProvider.toUpperCase()} API key saved successfully`);
      } catch (error) {
        console.error('Error saving API key:', error);
        this.notificationService.error('Failed to save API key');
      } finally {
        state.isSaving = false;
        this.cdr.markForCheck();
      }
    } else {
      this.notificationService.warning('Please enter a valid API key');
    }
  }

  async removeApiKey(): Promise<void> {
    const state = this.currentState;
    try {
      const currentUser = await this.userService.getCurrentUser();
      if (!currentUser) throw new Error('User not found');

      const updatedPreferences = {
        ...currentUser.preferences,
        [this.selectedProvider === 'openai' ? 'openaiApiKey' : 'geminiApiKey']: undefined
      };

      this.store.dispatch(updatePreferences({
        userId: currentUser.uid,
        preferences: updatedPreferences
      }));

      if (this.selectedProvider === 'openai') {
        this.openaiService.removeApiKey();
      } else {
        // Assuming GeminiService also has a way to remove/clear key if needed, or just set empty
        this.geminiService.setApiKey(''); 
      }

      state.apiKey = '';
      state.isConnected = false;
      this.apiKeyForm.reset();
      this.cdr.markForCheck();
      this.notificationService.success(`${this.selectedProvider.toUpperCase()} API key removed successfully`);
    } catch (error) {
      console.error('Error removing API key:', error);
      this.notificationService.error('Failed to remove API key');
    }
  }

  async testConnection(): Promise<void> {
    const state = this.currentState;
    if (!state.isConnected) {
      this.notificationService.warning(`Please connect your ${this.selectedProvider.toUpperCase()} API key first`);
      return;
    }

    state.isTestingConnection = true;
    this.cdr.markForCheck();

    const testObservable = this.selectedProvider === 'openai' 
      ? this.openaiService.sendMessage([{ role: 'user', content: 'Connection test' }])
      : this.geminiService.sendMessage([{ role: 'user', parts: [{ text: 'Connection test' }] }]);

    testObservable.subscribe({
      next: () => {
        this.notificationService.success(`${this.selectedProvider.toUpperCase()} connection test successful!`);
        state.isTestingConnection = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        this.notificationService.error(`Connection test failed: ${error.message}`);
        state.isTestingConnection = false;
        this.cdr.markForCheck();
      }
    });
  }

  async testAndSaveApiKey(): Promise<void> {
    if (this.apiKeyForm.valid) {
      const state = this.currentState;
      state.isTestingConnection = true;
      this.cdr.markForCheck();

      const apiKey = this.apiKeyForm.get('apiKey')?.value;
      
      if (this.selectedProvider === 'openai') {
        this.openaiService.setApiKey(apiKey);
      } else {
        this.geminiService.setApiKey(apiKey);
      }

      const testObservable = this.selectedProvider === 'openai' 
        ? this.openaiService.sendMessage([{ role: 'user', content: 'Key validation' }])
        : this.geminiService.sendMessage([{ role: 'user', parts: [{ text: 'Key validation' }] }]);

      testObservable.subscribe({
        next: async () => {
          await this.saveApiKey();
          state.isTestingConnection = false;
          this.cdr.markForCheck();
        },
        error: (error) => {
          this.notificationService.error(`API key test failed: ${error.message}`);
          state.isTestingConnection = false;
          if (this.selectedProvider === 'openai') {
            this.openaiService.removeApiKey();
          } else {
            this.geminiService.setApiKey('');
          }
          this.cdr.markForCheck();
        }
      });
    } else {
      this.notificationService.warning('Please enter a valid API key');
    }
  }
} 