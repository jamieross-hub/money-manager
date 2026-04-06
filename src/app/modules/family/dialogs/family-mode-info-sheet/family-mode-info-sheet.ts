import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { trigger, transition, style, animate } from '@angular/animations';

@Component({
  selector: 'app-family-mode-info-sheet',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDividerModule],
  templateUrl: './family-mode-info-sheet.html',
  styleUrls: ['./family-mode-info-sheet.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FamilyModeInfoSheet {
  private readonly bottomSheetRef = inject(MatBottomSheetRef<FamilyModeInfoSheet>);

  close(): void {
    this.bottomSheetRef.dismiss();
  }
}
