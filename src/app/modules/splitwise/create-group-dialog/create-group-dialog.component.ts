import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { CreateGroupRequest } from 'src/app/util/models/splitwise.model';
import { Store } from '@ngrx/store';
import { AppState } from 'src/app/store/app.state';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { Observable } from 'rxjs';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { CommonBodyContentComponent } from 'src/app/util/components/dialog/common-body-content/common-body-content.component';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-create-group-dialog',
  templateUrl: './create-group-dialog.component.html',
  styleUrls: ['./create-group-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    CommonHeaderComponent,
    CommonBodyContentComponent
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CreateGroupDialogComponent implements OnInit {
  groupForm: FormGroup;
  isSubmitting = false;
  userCurrency$: Observable<string | undefined>;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<CreateGroupDialogComponent>,
    private auth: Auth,
    private store: Store<AppState>
  ) {
    this.userCurrency$ = this.store.select(ProfileSelectors.selectUserCurrency);
    this.groupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(50)]],
      description: ['', [Validators.maxLength(200)]],
      initialMembers: [[]]
    });
  }

  ngOnInit(): void {
    // Currency will be set from user's profile preference in onSubmit
  }

  async onSubmit(): Promise<void> {
    if (this.groupForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      try {
        const formData = this.groupForm.value;
        const userCurrency = this.store.select(ProfileSelectors.selectUserCurrency);

        // Get the current currency value
        let currency = 'USD'; // Default fallback
        userCurrency.subscribe(curr => {
          if (curr) {
            currency = curr;
          }
        }).unsubscribe();

        const request: CreateGroupRequest = {
          name: formData.name.trim(),
          description: formData.description?.trim() || '',
          currency: currency,
          initialMembers: formData.initialMembers || []
        };

        // Return the request to be handled by the parent component via NgRx
        this.dialogRef.close(request);
      } catch (error) {
        console.error('Error creating group:', error);
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.groupForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(controlName: string): string {
    const control = this.groupForm.get(controlName);
    if (control?.hasError('required')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
    }
    if (control?.hasError('minlength')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must be at least ${control.errors?.['minlength'].requiredLength} characters`;
    }
    if (control?.hasError('maxlength')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} must not exceed ${control.errors?.['maxlength'].requiredLength} characters`;
    }
    return '';
  }


} 