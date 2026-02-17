import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { Inject } from '@angular/core';
import moment from 'moment';

export interface CustomDateRangeData {
  startDate?: Date;
  endDate?: Date;
}

@Component({
  selector: 'app-custom-date-range-dialog',
  templateUrl: './custom-date-range-dialog.component.html',
  styleUrls: ['./custom-date-range-dialog.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatDialogModule,
    MatIconModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomDateRangeDialogComponent implements OnInit {
  startDate: Date | null = null;
  endDate: Date | null = null;
  errorMessage: string = '';

  constructor(
    public dialogRef: MatDialogRef<CustomDateRangeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CustomDateRangeData
  ) { }

  ngOnInit() {
    // Initialize with existing date range if provided
    if (this.data?.startDate) {
      this.startDate = new Date(this.data.startDate);
    }
    if (this.data?.endDate) {
      this.endDate = new Date(this.data.endDate);
    }
  }

  applyDateRange() {
    this.errorMessage = '';

    if (!this.startDate || !this.endDate) {
      this.errorMessage = 'Please select both start and end dates.';
      return;
    }

    const startMoment = moment(this.startDate);
    const endMoment = moment(this.endDate);

    if (!startMoment.isValid() || !endMoment.isValid()) {
      this.errorMessage = 'Please enter valid dates.';
      return;
    }

    if (endMoment.isBefore(startMoment)) {
      this.errorMessage = 'End date must be on or after start date.';
      return;
    }

    // Return the date range
    this.dialogRef.close({
      start: this.startDate,
      end: this.endDate
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  selectLast7Days() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 6);
    this.startDate = startDate;
    this.endDate = endDate;
    this.errorMessage = '';
  }

  selectLast30Days() {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - 29);
    this.startDate = startDate;
    this.endDate = endDate;
    this.errorMessage = '';
  }

  selectThisMonth() {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    this.startDate = startDate;
    this.endDate = endDate;
    this.errorMessage = '';
  }
} 