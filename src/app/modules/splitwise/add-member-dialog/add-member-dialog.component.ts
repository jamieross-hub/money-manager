import { Component, Inject, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialog } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { SplitwiseGroup, AddMemberRequest, GroupMemberRole } from 'src/app/util/models/splitwise.model';
import { UserService } from 'src/app/util/service/db/user.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-add-member-dialog',
  templateUrl: './add-member-dialog.component.html',
  styleUrls: ['./add-member-dialog.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AddMemberDialogComponent implements OnInit {
  memberForm: FormGroup;
  isSubmitting = false;
  group: SplitwiseGroup;
  userExists = false;
  checkingUser = false;

  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<AddMemberDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { group: SplitwiseGroup },
    private auth: Auth,
    private userService: UserService,
    private dialog: MatDialog
  ) {
    this.group = data.group;
    this.memberForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]]
    });
  }

  ngOnInit(): void {
    // Focus on email field
    setTimeout(() => {
      const emailField = document.querySelector('input[formControlName="email"]') as HTMLInputElement;
      if (emailField) {
        emailField.focus();
      }
    }, 100);
  }

  async onEmailChange(): Promise<void> {
    const email = this.memberForm.get('email')?.value;

    if (email && this.isEmailAlreadyMember(email)) {
      this.memberForm.get('email')?.setErrors({ alreadyMember: true });
      this.userExists = false;
      return;
    }

    if (email && this.memberForm.get('email')?.valid) {
      this.checkingUser = true;
      try {
        const user = await this.userService.findUserByEmail(email);
        this.userExists = !!user;
      } catch (error) {
        console.error('Error checking user:', error);
        this.userExists = false;
      } finally {
        this.checkingUser = false;
      }
    } else {
      this.userExists = false;
    }
  }

  async onSubmit(): Promise<void> {
    if (this.memberForm.valid && !this.isSubmitting) {
      this.isSubmitting = true;

      try {
        const formData = this.memberForm.value;
        const request: AddMemberRequest = {
          email: formData.email.trim().toLowerCase(),
          role: GroupMemberRole.MEMBER
        };

        // Return the request to be handled by the parent component via NgRx
        this.dialogRef.close(request);
      } catch (error) {
        console.error('Error adding member:', error);
      } finally {
        this.isSubmitting = false;
      }
    } else {
      this.memberForm.markAllAsTouched();
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  getErrorMessage(controlName: string): string {
    const control = this.memberForm.get(controlName);
    if (control?.hasError('required')) {
      return `${controlName.charAt(0).toUpperCase() + controlName.slice(1)} is required`;
    }
    if (control?.hasError('email')) {
      return 'Please enter a valid email address';
    }
    if (control?.hasError('alreadyMember')) {
      return 'This user is already a member of this group';
    }
    return '';
  }

  isEmailAlreadyMember(email: string): boolean {
    return this.group.members.some(member =>
      member.email.toLowerCase() === email.toLowerCase()
    );
  }

  getRoleDisplayName(role: string): string {
    const roleNames: { [key: string]: string } = {
      'admin': 'Admin',
      'member': 'Member'
    };
    return roleNames[role] || role;
  }

  getUserStatusText(): string {
    if (this.checkingUser) {
      return 'Checking if user exists...';
    }
    if (this.userExists) {
      return '✓ User found in system - invitation will be sent immediately';
    }
    const email = this.memberForm.get('email')?.value;
    if (email && this.memberForm.get('email')?.valid) {
      return 'ℹ User not found - invitation will be sent when they register';
    }
    return '';
  }

  onDeleteMember(userId: string): void {
    this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Delete Member',
        message: 'Are you sure you want to delete this member? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    }).afterClosed().subscribe(result => {
      if (result) {
        this.dialogRef.close({ action: 'delete', userId });
      }
    });
  }
} 