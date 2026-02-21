import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { FeedbackForm } from '../../component/feedback/feedback.component';
import { UserService } from './db/user.service';
import { LocalIndexDBStorageService } from './indexdb-storage.service';

export interface FeedbackData extends FeedbackForm {
  id?: string;
  userId: string;
  timestamp: any;
  status: 'pending' | 'reviewed' | 'resolved';
  userAgent?: string;
  appVersion?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private readonly CACHE_KEY = 'admin_feedback';

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private userService: UserService,
    private storageService: LocalIndexDBStorageService
  ) { }

  /**
   * Submit feedback and send email notification
   */
  async submitFeedback(feedback: FeedbackForm): Promise<void> {
    try {
      // Prepare feedback data
      const feedbackData: FeedbackData = {
        ...feedback,
        userId: this.userService.getCurrentUserId() || 'anonymous',
        timestamp: serverTimestamp(),
        status: 'pending',
        userAgent: navigator.userAgent,
        appVersion: '1.0.0'
      };

      // Save to Firestore
      const feedbackRef = collection(this.firestore, 'feedback');
      const docRef = await addDoc(feedbackRef, feedbackData);

      console.log('Feedback submitted successfully:', docRef.id);
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  /**
   * Get all feedback (Cache-first)
   */
  getAllFeedback(): Observable<FeedbackData[]> {
    const cached = this.storageService.getItem<FeedbackData[]>(this.CACHE_KEY);
    return of(cached || []);
  }

  /**
   * Pull feedback from Firestore
   */
  pullFromFirestore(): Observable<void> {
    const feedbackRef = collection(this.firestore, 'feedback');
    const q = query(feedbackRef, orderBy('timestamp', 'desc'));

    return from(getDocs(q)).pipe(
      tap(querySnapshot => {
        const feedbackList: FeedbackData[] = [];
        querySnapshot.forEach((doc) => {
          feedbackList.push({
            ...(doc.data() as FeedbackData),
            id: doc.id
          });
        });
        this.storageService.setItem(this.CACHE_KEY, feedbackList);
      }),
      map(() => undefined),
      catchError(error => {
        console.error('[FeedbackService] Pull failed:', error);
        return of(undefined);
      })
    );
  }

  /**
   * Update feedback status
   */
  async updateFeedbackStatus(feedbackId: string, status: 'pending' | 'reviewed' | 'resolved'): Promise<void> {
    try {
      const feedbackRef = doc(this.firestore, 'feedback', feedbackId);
      await updateDoc(feedbackRef, {
        status: status,
        updatedAt: serverTimestamp()
      });

      // Update local cache if exists
      const cached = this.storageService.getItem<FeedbackData[]>(this.CACHE_KEY);
      if (cached) {
        const index = cached.findIndex(f => f.id === feedbackId);
        if (index !== -1) {
          cached[index].status = status;
          this.storageService.setItem(this.CACHE_KEY, cached);
        }
      }
    } catch (error) {
      console.error('Error updating feedback status:', error);
      throw error;
    }
  }

  /**
   * Delete feedback
   */
  async deleteFeedback(feedbackId: string): Promise<void> {
    try {
      const feedbackRef = doc(this.firestore, 'feedback', feedbackId);
      await deleteDoc(feedbackRef);

      // Update local cache if exists
      const cached = this.storageService.getItem<FeedbackData[]>(this.CACHE_KEY);
      if (cached) {
        const updated = cached.filter(f => f.id !== feedbackId);
        this.storageService.setItem(this.CACHE_KEY, updated);
      }
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }
}
 