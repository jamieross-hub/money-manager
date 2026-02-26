import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { DateService } from './date.service';
import { ConfirmDialogComponent } from '../components/confirm-dialog/confirm-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class InvitationPopupService {

  constructor(
    private dialog: MatDialog,
    private dateService: DateService
  ) {}

  /**
   * Check for pending invitations and show popup if any exist
   */
  async checkAndShowInvitations(): Promise<void> {
    // Splitwise module removed – no invitation checks needed
  }

  /**
   * Show invitation popup after successful login
   */
  async showInvitationsAfterLogin(): Promise<void> {
    // Splitwise module removed – no invitation checks needed
  }
}