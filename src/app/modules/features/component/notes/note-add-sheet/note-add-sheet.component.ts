import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Note, NOTE_COLORS } from '../note.model';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-note-add-sheet',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
  ],
  templateUrl: './note-add-sheet.component.html',
  styleUrls: ['./note-add-sheet.component.scss']
})
export class NoteAddSheetComponent implements OnInit {
  private bottomSheetRef = inject(MatBottomSheetRef<NoteAddSheetComponent>);
  private dialog = inject(MatDialog);
  public data = inject<{ note?: Note }>(MAT_BOTTOM_SHEET_DATA, { optional: true });

  title = '';
  content = '';
  selectedColor = signal(NOTE_COLORS[0].value);
  noteColors = NOTE_COLORS;

  ngOnInit() {
    if (this.data?.note) {
      this.title = this.data.note.title;
      this.content = this.data.note.content;
      this.selectedColor.set(this.data.note.color);
    }
  }

  save() {
    if (!this.title.trim() && !this.content.trim()) {
      this.bottomSheetRef.dismiss();
      return;
    }
    this.bottomSheetRef.dismiss({
      title: this.title.trim() || 'Untitled',
      content: this.content.trim(),
      color: this.selectedColor()
    });
  }

  delete() {
    const dialogRef = this.dialog.open(ConfirmDialogComponent, {
      width: '320px',
      data: {
        title: 'Delete Note',
        message: 'Are you sure you want to delete this note? This action cannot be undone.',
        confirmText: 'Delete',
        cancelText: 'Cancel',
        type: 'delete'
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.bottomSheetRef.dismiss({ action: 'delete' });
      }
    });
  }

  cancel() {
    this.bottomSheetRef.dismiss();
  }

  setColor(color: string) {
    this.selectedColor.set(color);
  }
}
