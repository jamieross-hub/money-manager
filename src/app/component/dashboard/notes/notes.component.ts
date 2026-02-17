import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { NotificationService } from 'src/app/util/service/notification.service';

interface Note {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isImportant: boolean;
}

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-notes',
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatTooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class NotesComponent implements OnInit {

  notes: Note[] = [];
  filteredNotes: Note[] = [];
  selectedCategory: string = 'all';
  searchTerm: string = '';
  isAddingNote: boolean = false;
  newNote: Partial<Note> = {
    title: '',
    content: '',
    category: 'personal',
    tags: [],
    isImportant: false
  };

  categories: { value: string; label: string; icon: string }[] = [
    { value: 'all', label: 'All Notes', icon: 'note' },
    { value: 'personal', label: 'Personal', icon: 'person' },
    { value: 'financial', label: 'Financial', icon: 'account_balance_wallet' },
    { value: 'tax', label: 'Tax Related', icon: 'receipt_long' },
    { value: 'investment', label: 'Investment', icon: 'trending_up' },
    { value: 'expenses', label: 'Expenses', icon: 'money_off' },
    { value: 'goals', label: 'Goals', icon: 'flag' },
    { value: 'documents', label: 'Documents', icon: 'description' }
  ];

  constructor(private notificationService: NotificationService) { }

  ngOnInit(): void {
    this.loadNotes();
  }

  loadNotes(): void {
    try {
      // TODO: Load notes from service/database
      this.notes = [
        {
          id: '1',
          title: 'Tax Planning Notes',
          content: 'Remember to invest in ELSS for tax saving under section 80C. Also consider health insurance for 80D benefits.',
          category: 'tax',
          tags: ['tax', 'investment', 'planning'],
          createdAt: new Date('2024-01-15'),
          updatedAt: new Date('2024-01-15'),
          isImportant: true
        },
        {
          id: '2',
          title: 'Monthly Budget Goals',
          content: 'Target: Save 30% of income. Track expenses daily. Review budget every weekend.',
          category: 'financial',
          tags: ['budget', 'savings', 'goals'],
          createdAt: new Date('2024-01-10'),
          updatedAt: new Date('2024-01-10'),
          isImportant: true
        }
      ];
      this.filteredNotes = [...this.notes];
    } catch (error) {
      console.error('Error loading notes:', error);
      this.notificationService.error('Failed to load notes');
    }
  }

  filterNotes(): void {
    this.filteredNotes = this.notes.filter(note => {
      const matchesCategory = this.selectedCategory === 'all' || note.category === this.selectedCategory;
      const matchesSearch = note.title.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        note.content.toLowerCase().includes(this.searchTerm.toLowerCase()) ||
        note.tags.some(tag => tag.toLowerCase().includes(this.searchTerm.toLowerCase()));
      return matchesCategory && matchesSearch;
    });
  }

  onCategoryChange(): void {
    this.filterNotes();
  }

  onSearchChange(): void {
    this.filterNotes();
  }

  addNote(): void {
    this.isAddingNote = true;
  }

  saveNote(): void {
    if (!this.newNote.title || !this.newNote.content) {
      this.notificationService.warning('Please fill in title and content');
      return;
    }

    try {
      const note: Note = {
        id: Date.now().toString(),
        title: this.newNote.title!,
        content: this.newNote.content!,
        category: this.newNote.category!,
        tags: this.newNote.tags!,
        createdAt: new Date(),
        updatedAt: new Date(),
        isImportant: this.newNote.isImportant!
      };

      this.notes.unshift(note);
      this.filterNotes();
      this.resetNewNote();
      this.isAddingNote = false;
      this.notificationService.success('Note saved successfully');
    } catch (error) {
      console.error('Error saving note:', error);
      this.notificationService.error('Failed to save note');
    }
  }

  cancelAddNote(): void {
    this.resetNewNote();
    this.isAddingNote = false;
    this.notificationService.info('Note creation cancelled');
  }

  resetNewNote(): void {
    this.newNote = {
      title: '',
      content: '',
      category: 'personal',
      tags: [],
      isImportant: false
    };
  }

  deleteNote(noteId: string): void {
    try {
      const noteToDelete = this.notes.find(note => note.id === noteId);
      this.notes = this.notes.filter(note => note.id !== noteId);
      this.filterNotes();
      this.notificationService.success(`Note "${noteToDelete?.title}" deleted successfully`);
    } catch (error) {
      console.error('Error deleting note:', error);
      this.notificationService.error('Failed to delete note');
    }
  }

  toggleImportant(note: Note): void {
    try {
      note.isImportant = !note.isImportant;
      note.updatedAt = new Date();
      const status = note.isImportant ? 'marked as important' : 'unmarked as important';
      this.notificationService.success(`Note "${note.title}" ${status}`);
    } catch (error) {
      console.error('Error updating note importance:', error);
      this.notificationService.error('Failed to update note importance');
    }
  }

  addTag(tag: any): void {
    let tagValue = tag.target.value;
    if (tagValue && !this.newNote.tags!.includes(tagValue)) {
      this.newNote.tags!.push(tagValue);
      this.notificationService.info(`Tag "${tagValue}" added`);
    } else if (this.newNote.tags!.includes(tagValue)) {
      this.notificationService.warning('Tag already exists');
    }
  }

  removeTag(tag: string): void {
    this.newNote.tags = this.newNote.tags!.filter(t => t !== tag);
    this.notificationService.info(`Tag "${tag}" removed`);
  }

  exportNotes(): void {
    try {
      // TODO: Implement export functionality
      console.log('Export notes clicked');
      this.notificationService.info('Export feature coming soon');
    } catch (error) {
      console.error('Error exporting notes:', error);
      this.notificationService.error('Failed to export notes');
    }
  }

  importNotes(): void {
    try {
      // TODO: Implement import functionality
      console.log('Import notes clicked');
      this.notificationService.info('Import feature coming soon');
    } catch (error) {
      console.error('Error importing notes:', error);
      this.notificationService.error('Failed to import notes');
    }
  }

  getCategoryInfo(categoryValue: string): { icon: string; label: string } {
    const category = this.categories.find(c => c.value === categoryValue);
    return category ? { icon: category.icon, label: category.label } : { icon: 'note', label: 'Unknown' };
  }
} 