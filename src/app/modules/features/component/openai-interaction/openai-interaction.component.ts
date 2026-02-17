import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { NotificationService } from 'src/app/util/service/notification.service';
import { UserService } from 'src/app/util/service/db/user.service';
import { OpenaiService } from '../../../../util/service/ai-chat/openai.service';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import { updatePreferences } from 'src/app/store/profile/profile.actions';
import { User } from '../../../../util/models';

@Component({
  selector: 'app-openai-interaction',
  templateUrl: './openai-interaction.component.html',
  styleUrls: ['./openai-interaction.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class OpenaiInteractionComponent implements OnInit {
  isConnected: boolean = false;
  apiKey: string = '';
  isConfiguring: boolean = false;
  isTestingConnection: boolean = false;
  isSaving: boolean = false;

  apiKeyForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private notificationService: NotificationService,
    private userService: UserService,
    private openaiService: OpenaiService,
    private store: Store<AppState>
  ) {
    this.apiKeyForm = this.fb.group({
      apiKey: ['', [Validators.required, Validators.minLength(20)]]
    });
  }

  ngOnInit(): void {
    this.loadApiKey();
  }

  async loadApiKey(): Promise<void> {
    try {
      const currentUser = await this.userService.getCurrentUser();
      if (currentUser?.preferences?.openaiApiKey) {
        this.apiKey = currentUser.preferences.openaiApiKey;
        this.isConnected = true;
        this.apiKeyForm.patchValue({ apiKey: this.apiKey });
        // Also set in OpenAI service for immediate use
        this.openaiService.setApiKey(this.apiKey);
      } else {
        this.isConnected = false;
      }
    } catch (error) {
      console.error('Error loading API key:', error);
      this.notificationService.error('Failed to load API key');
    }
  }

  async saveApiKey(): Promise<void> {
    if (this.apiKeyForm.valid) {
      this.isSaving = true;
      try {
        const apiKey = this.apiKeyForm.get('apiKey')?.value;
        const currentUser = await this.userService.getCurrentUser();

        if (!currentUser) {
          throw new Error('User not found');
        }

        // Update user preferences with the API key
        const updatedPreferences = {
          ...currentUser.preferences,
          openaiApiKey: apiKey
        };

        // Dispatch action to update preferences
        this.store.dispatch(updatePreferences({
          userId: currentUser.uid,
          preferences: updatedPreferences
        }));

        // Set in OpenAI service for immediate use
        this.openaiService.setApiKey(apiKey);

        this.apiKey = apiKey;
        this.isConnected = true;
        this.isConfiguring = false;
        this.notificationService.success('OpenAI API key saved successfully');
      } catch (error) {
        console.error('Error saving API key:', error);
        this.notificationService.error('Failed to save API key');
      } finally {
        this.isSaving = false;
      }
    } else {
      this.notificationService.warning('Please enter a valid API key');
    }
  }

  async removeApiKey(): Promise<void> {
    try {
      const currentUser = await this.userService.getCurrentUser();

      if (!currentUser) {
        throw new Error('User not found');
      }

      // Remove API key from user preferences
      const updatedPreferences = {
        ...currentUser.preferences,
        openaiApiKey: undefined
      };

      // Dispatch action to update preferences
      this.store.dispatch(updatePreferences({
        userId: currentUser.uid,
        preferences: updatedPreferences
      }));

      // Remove from OpenAI service
      this.openaiService.removeApiKey();

      this.apiKey = '';
      this.isConnected = false;
      this.apiKeyForm.reset();
      this.notificationService.success('API key removed successfully');
    } catch (error) {
      console.error('Error removing API key:', error);
      this.notificationService.error('Failed to remove API key');
    }
  }

  async testConnection(): Promise<void> {
    if (!this.isConnected) {
      this.notificationService.warning('Please connect your OpenAI API key first');
      return;
    }

    this.isTestingConnection = true;
    try {
      this.openaiService.sendMessage([
        { role: 'user', content: 'Hello, this is a test message to verify the connection.' }
      ]).subscribe({
        next: (response) => {
          this.notificationService.success('OpenAI connection test successful!');
          this.isTestingConnection = false;
        },
        error: (error) => {
          this.notificationService.error(`Connection test failed: ${error.message}`);
          this.isTestingConnection = false;
        }
      });
    } catch (error) {
      this.notificationService.error('Failed to test connection');
      this.isTestingConnection = false;
    }
  }

  async testAndSaveApiKey(): Promise<void> {
    if (this.apiKeyForm.valid) {
      this.isTestingConnection = true;
      try {
        const apiKey = this.apiKeyForm.get('apiKey')?.value;

        // Temporarily set the API key for testing
        this.openaiService.setApiKey(apiKey);

        // Test the connection
        this.openaiService.sendMessage([
          { role: 'user', content: 'Hello, this is a test message to verify the API key.' }
        ]).subscribe({
          next: async (response) => {
            // If test is successful, save the API key
            await this.saveApiKey();
            this.notificationService.success('API key tested and saved successfully!');
            this.isTestingConnection = false;
          },
          error: (error) => {
            this.notificationService.error(`API key test failed: ${error.message}`);
            this.isTestingConnection = false;
            // Remove the temporary API key
            this.openaiService.removeApiKey();
          }
        });
      } catch (error) {
        this.notificationService.error('Failed to test API key');
        this.isTestingConnection = false;
      }
    } else {
      this.notificationService.warning('Please enter a valid API key');
    }
  }
} 