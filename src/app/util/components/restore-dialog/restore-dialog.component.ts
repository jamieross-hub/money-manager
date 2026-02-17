import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';

export type RestoreMode = 'replace' | 'merge';

@Component({
    selector: 'restore-dialog',
    standalone: true,
    imports: [CommonModule, MatIconModule, MatButtonModule, MatDialogModule],
    templateUrl: './restore-dialog.component.html',
    styleUrls: ['./restore-dialog.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RestoreDialogComponent {
    selectedMode: RestoreMode | null = null; // Default to null to force user selection

    constructor(public dialogRef: MatDialogRef<RestoreDialogComponent>) { }

    onSelect(mode: RestoreMode): void {
        this.selectedMode = mode;
    }

    onConfirm(): void {
        if (this.selectedMode) {
            this.dialogRef.close(this.selectedMode);
        }
    }

    onCancel(): void {
        this.dialogRef.close();
    }
}
