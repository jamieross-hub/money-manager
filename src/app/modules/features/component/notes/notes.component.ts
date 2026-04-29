import {
  Component,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatChipsModule } from '@angular/material/chips';
import { MatBottomSheetModule, MatBottomSheet } from '@angular/material/bottom-sheet';
import { NoteAddSheetComponent } from './note-add-sheet/note-add-sheet.component';
import { LocalIndexDBStorageService } from '../../../../util/service/indexdb-storage.service';
import { LocalStorageKey } from '../../../../util/models/local-storage.model';
import { Note, NOTE_COLORS } from './note.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { FooterService } from 'src/app/component/dashboard/footer/footer.service';
import { NotesService } from '../../../../util/service/db/notes.service';
import { UserService } from '../../../../util/service/db/user.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule,
    MatSnackBarModule,
    MatMenuModule,
    MatDialogModule,
    MatChipsModule,
    MatBottomSheetModule,
  ],
  templateUrl: './notes.component.html',
  styleUrl: './notes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotesComponent implements OnInit, OnDestroy {
  notes = signal<Note[]>([]);
  searchQuery = signal('');
  selectedColor = signal<string>(NOTE_COLORS[0].value);

  noteColors = NOTE_COLORS;

  public breakpointService = inject(BreakpointService);
  public footerService = inject(FooterService);
  private notesService = inject(NotesService);
  private userService = inject(UserService);
  private destroyRef = inject(DestroyRef);
  private dialog = inject(MatDialog);

  filteredNotes = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    const all = this.notes();
    if (!q) return all;
    return all.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  });

  constructor(
    private storageService: LocalIndexDBStorageService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef,
    private bottomSheet: MatBottomSheet,
  ) {}

  ngOnInit(): void {
    this.setupFooter();
    const userId = this.userService.getCurrentUserId() || 'offline-guest';
    
    this.notesService.getNotes(userId).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(notes => {
      this.notes.set(notes);
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.footerService.resetConfig();
  }

  private setupFooter(): void {
    if (this.breakpointService.isMobile()) {
      this.footerService.patchConfig({
        hideFab: true,
        items: [
          {
            id: 'home',
            icon: 'home',
            label: 'Home',
            route: '/dashboard'
          },
          {
            id: 'add-note',
            icon: 'add',
            label: 'Add Note',
            bgClass: 'bg-primary-500',
            isFab: true,
            action: () => this.startCreating()
          },
          {
            id: 'search',
            icon: 'search',
            label: 'Search',
            action: () => {
              const searchInput = document.querySelector('.search-input') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }
          }
        ]
      });
    }
  }

  startCreating(): void {
    this.openNoteSheet();
  }

  startEditing(note: Note): void {
    this.openNoteSheet(note);
  }

  private openNoteSheet(note?: Note): void {
    const sheetRef = this.bottomSheet.open(NoteAddSheetComponent, {
      panelClass: 'full-width-bottom-sheet',
      data: { note }
    });

    sheetRef.afterDismissed().subscribe(result => {
      if (result) {
        if (result.action === 'delete' && note) {
          this.deleteNote(note.id);
          return;
        }

        if (note) {
          const userId = this.userService.getCurrentUserId() || 'offline-guest';
          this.notesService.updateNote(userId, note.id, {
            title: result.title,
            content: result.content,
            color: result.color,
            updatedAt: new Date().toISOString()
          });
          this.snackBar.open('Note updated!', '', { duration: 1800 });
        } else {
          // Create
          const userId = this.userService.getCurrentUserId() || 'offline-guest';
          const newNote: Note = {
            id: this.generateId(),
            title: result.title,
            content: result.content,
            color: result.color,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            isPinned: false,
          };

          this.notesService.createNote(userId, newNote);
          this.snackBar.open('Note saved!', '', { duration: 1800 });
        }
      }
    });
  }



  togglePin(note: Note): void {
    const userId = this.userService.getCurrentUserId() || 'offline-guest';
    this.notesService.updateNote(userId, note.id, { isPinned: !note.isPinned, updatedAt: new Date().toISOString() });
    this.cdr.markForCheck();
  }

  deleteNote(id: string): void {
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
        const userId = this.userService.getCurrentUserId() || 'offline-guest';
        this.notesService.deleteNote(userId, id);
        this.cdr.markForCheck();
        this.snackBar.open('Note deleted', '', { duration: 2000 });
      }
    });
  }

  setColor(color: string): void {
    this.selectedColor.set(color);
    this.cdr.markForCheck();
  }

  onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
    this.cdr.markForCheck();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.cdr.markForCheck();
  }

  formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  trackById(_: number, note: Note): string {
    return note.id;
  }

  private generateId(): string {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
