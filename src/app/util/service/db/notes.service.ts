import { Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { 
  Firestore, 
  collection, 
  doc, 
  getDocs, 
  onSnapshot,
  query,
  orderBy
} from '@angular/fire/firestore';
import { Observable, of, from, BehaviorSubject } from 'rxjs';
import { map, catchError, tap, timeout, switchMap } from 'rxjs/operators';
import { CommonSyncService, SyncItem } from '../common-sync.service';
import { SyncStatus } from '../../config/enums';

import { LocalStorageKeyHelper, LocalStorageKey } from '../../models/local-storage.model';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';
import { Note } from '../../../modules/features/component/notes/note.model';

@Injectable({
  providedIn: 'root'
})
export class NotesService {
  private readonly GUEST_USER_ID = 'offline-guest';
  private readonly COLLECTION_NAME = 'notes';
  private notesSubject = new BehaviorSubject<Note[]>([]);
  private activeListenerPath: string | null = null;

  constructor(
    private readonly firestore: Firestore,
    private readonly auth: Auth,
    private readonly localStorageUtility: LocalIndexDBStorageService,
    private readonly commonSyncService: CommonSyncService
  ) {}

  // ==========================================
  // READ OPERATIONS
  // ==========================================

  /**
   * Retrieves all notes for a user with real-time sync.
   */
  getNotes(userId: string): Observable<Note[]> {
    if (this.isGuest(userId)) {
      const notes = this.localStorageUtility.getItem<Note[]>(LocalStorageKey.GUEST_NOTES) || [];
      this.notesSubject.next(notes);
      return of(notes);
    }

    return this.localStorageUtility.isReady$.pipe(
      switchMap(() => {
        // 1. Emit cached notes immediately
        const cacheKey = LocalStorageKeyHelper.getNotesCacheKey(userId);
        const cachedNotes = this.localStorageUtility.getItem<Note[]>(cacheKey) || [];
        
        if (cachedNotes.length > 0) {
          this.notesSubject.next(cachedNotes);
        }

        // 2. Return reactive subject
        return this.notesSubject.asObservable();
      })
    );
  }

  /**
   * Set up a real-time listener for notes
   */
  listenToNotes(userId: string): Observable<void> {
    if (this.isGuest(userId)) return of(undefined);

    const currentPath = `users/${userId}/${this.COLLECTION_NAME}`;
    if (this.activeListenerPath === currentPath) {
      return of(undefined);
    }
    this.activeListenerPath = currentPath;

    return new Observable<void>(observer => {
      const notesRef = query(
        collection(this.firestore, currentPath),
        orderBy('isPinned', 'desc'),
        orderBy('updatedAt', 'desc')
      );

      // 0. Emit cached notes immediately
      const cacheKey = LocalStorageKeyHelper.getNotesCacheKey(userId);
      const cachedNotes = this.localStorageUtility.getItem<Note[]>(cacheKey) || [];
      if (cachedNotes.length > 0) {
        this.notesSubject.next(cachedNotes);
      }

      const unsubscribe = onSnapshot(notesRef, (snap) => {
        const notes: Note[] = [];
        snap.forEach(docSnap => notes.push(docSnap.data() as Note));

        this.localStorageUtility.setItem(cacheKey, notes);
        this.notesSubject.next(notes);
        
        observer.next();
      }, (error) => {
        console.warn(`[NotesService] ⚠️ Real-time listener failed:`, error);
        observer.complete();
      });

      return () => {
        this.activeListenerPath = null;
        unsubscribe();
      };
    });
  }

  // ==========================================
  // WRITE OPERATIONS
  // ==========================================

  async createNote(userId: string, note: Note): Promise<void> {
    const newNote = { ...note, syncStatus: SyncStatus.PENDING };
    
    // 1. Optimistic Update
    if (this.isGuest(userId)) {
      const notes = this.localStorageUtility.getItem<Note[]>(LocalStorageKey.GUEST_NOTES) || [];
      const updated = [newNote, ...notes];
      this.localStorageUtility.setItem(LocalStorageKey.GUEST_NOTES, updated);
      this.notesSubject.next(updated);
    } else {
      const cacheKey = LocalStorageKeyHelper.getNotesCacheKey(userId);
      const notes = this.localStorageUtility.getItem<Note[]>(cacheKey) || [];
      const updated = [newNote, ...notes];
      this.localStorageUtility.setItem(cacheKey, updated);
      this.notesSubject.next(updated);
    }
    
    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    await this.addToSyncQueue('create', newNote, userId);
  }

  async updateNote(userId: string, noteId: string, updatedNote: Partial<Note>): Promise<void> {
    // 1. Optimistic Update
    let updatedNotes: Note[] = [];
    if (this.isGuest(userId)) {
      const notes = this.localStorageUtility.getItem<Note[]>(LocalStorageKey.GUEST_NOTES) || [];
      updatedNotes = notes.map(n => n.id === noteId ? { ...n, ...updatedNote } : n);
      this.localStorageUtility.setItem(LocalStorageKey.GUEST_NOTES, updatedNotes);
    } else {
      const cacheKey = LocalStorageKeyHelper.getNotesCacheKey(userId);
      const notes = this.localStorageUtility.getItem<Note[]>(cacheKey) || [];
      updatedNotes = notes.map(n => n.id === noteId ? { ...n, ...updatedNote, syncStatus: SyncStatus.PENDING } : n);
      this.localStorageUtility.setItem(cacheKey, updatedNotes);
    }
    this.notesSubject.next(updatedNotes);

    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    await this.addToSyncQueue('update', { id: noteId, ...updatedNote }, userId);
  }

  async deleteNote(userId: string, noteId: string): Promise<void> {
    // 1. Optimistic Update
    let updatedNotes: Note[] = [];
    if (this.isGuest(userId)) {
      const notes = this.localStorageUtility.getItem<Note[]>(LocalStorageKey.GUEST_NOTES) || [];
      updatedNotes = notes.filter(n => n.id !== noteId);
      this.localStorageUtility.setItem(LocalStorageKey.GUEST_NOTES, updatedNotes);
    } else {
      const cacheKey = LocalStorageKeyHelper.getNotesCacheKey(userId);
      const notes = this.localStorageUtility.getItem<Note[]>(cacheKey) || [];
      updatedNotes = notes.filter(n => n.id !== noteId);
      this.localStorageUtility.setItem(cacheKey, updatedNotes);
    }
    this.notesSubject.next(updatedNotes);

    if (this.isGuest(userId)) return;

    // 2. Queue for Sync
    await this.addToSyncQueue('delete', { id: noteId }, userId);
  }

  // ==========================================
  // SYNC OPERATIONS
  // ==========================================

  pullFromFirestore(userId: string): Observable<void> {
    if (this.isGuest(userId)) return of(undefined);

    const currentUser = this.auth.currentUser;
    if (!currentUser || currentUser.uid !== userId) {
      return of(undefined);
    }

    const notesRef = collection(this.firestore, `users/${userId}/${this.COLLECTION_NAME}`);

    return from(getDocs(notesRef)).pipe(
      timeout(15000),
      tap((querySnapshot) => {
        const notes: Note[] = [];
        querySnapshot.forEach(docSnap => notes.push(docSnap.data() as Note));

        this.localStorageUtility.setItem(LocalStorageKeyHelper.getNotesCacheKey(userId), notes);
        this.notesSubject.next(notes);
      }),
      map(() => undefined),
      catchError(error => {
        console.error('[NotesService] Pull failed:', error);
        return of(undefined);
      })
    );
  }

  private isGuest(userId: string): boolean {
    return userId === this.GUEST_USER_ID;
  }

  private async addToSyncQueue(operation: 'create' | 'update' | 'delete', data: any, userId: string): Promise<void> {
    const syncItem: Omit<SyncItem, 'timestamp' | 'retryCount'> = {
      id: data.id,
      type: 'note' as any, // Cast to any until CommonSyncService is updated
      operation: operation,
      data: data,
      maxRetries: 3,
      collectionPath: `users/${userId}/${this.COLLECTION_NAME}`
    };

    const result = await this.commonSyncService.registerSyncItem(syncItem);
    if (!result.success) {
      console.error('Failed to register note for sync:', result.errors);
    }
  }
}
