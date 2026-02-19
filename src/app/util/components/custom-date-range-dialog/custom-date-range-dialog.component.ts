import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Inject } from '@angular/core';
import dayjs from 'dayjs';

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
    MatIconModule,
    MatTooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CustomDateRangeDialogComponent implements OnInit {
  startDate: string | null = null;
  endDate: string | null = null;
  errorMessage: string = '';

  constructor(
    public dialogRef: MatDialogRef<CustomDateRangeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: CustomDateRangeData
  ) { }

  ngOnInit() {
    // Initialize with existing date range if provided
    if (this.data?.startDate) {
      this.startDate = dayjs(this.data.startDate).format('YYYY-MM-DD');
    }
    if (this.data?.endDate) {
      this.endDate = dayjs(this.data.endDate).format('YYYY-MM-DD');
    }
  }

  applyDateRange() {
    this.errorMessage = '';

    if (!this.startDate || !this.endDate) {
      this.errorMessage = 'Please select both start and end dates.';
      return;
    }

    const startMoment = dayjs(this.startDate);
    const endMoment = dayjs(this.endDate);

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
      startDate: startMoment.toDate(),
      endDate: endMoment.toDate()
    });
  }

  onCancel() {
    this.dialogRef.close();
  }

  selectLast7Days() {
    const end = dayjs();
    const start = dayjs().subtract(6, 'days');

    this.startDate = start.format('YYYY-MM-DD');
    this.endDate = end.format('YYYY-MM-DD');
    this.errorMessage = '';
  }

  selectLast30Days() {
    const end = dayjs();
    const start = dayjs().subtract(29, 'days');

    this.startDate = start.format('YYYY-MM-DD');
    this.endDate = end.format('YYYY-MM-DD');
    this.errorMessage = '';
  }

  selectThisMonth() {
    const today = dayjs();
    const start = today.startOf('month');
    const end = today.endOf('month');

    this.startDate = start.format('YYYY-MM-DD');
    this.endDate = end.format('YYYY-MM-DD');
    this.errorMessage = '';
  }
}