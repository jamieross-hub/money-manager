import { Injectable } from '@angular/core';
import { Firestore, collection, addDoc, serverTimestamp, getDocs, doc, updateDoc, deleteDoc, query, orderBy } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { FeedbackForm } from '../../component/feedback/feedback.component';
import { UserService } from './db/user.service';

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

  constructor(
    private firestore: Firestore,
    private auth: Auth,
    private userService: UserService
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
   * Get category label
   */
  private getCategoryLabel(category: string): string {
    const categories: { [key: string]: string } = {
      bug: 'Bug Report',
      feature: 'Feature Request',
      improvement: 'Improvement Suggestion',
      general: 'General Feedback',
      support: 'Support Request'
    };
    return categories[category] || category;
  }

  /**
   * Get all feedback for admin purposes
   */
  async getAllFeedback(): Promise<FeedbackData[]> {
    try {
      const feedbackRef = collection(this.firestore, 'feedback');
      const q = query(feedbackRef, orderBy('timestamp', 'desc'));
      const querySnapshot = await getDocs(q);

      const feedbackList: FeedbackData[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data() as FeedbackData;
        feedbackList.push({
          ...data,
          id: doc.id
        });
      });

      return feedbackList;
    } catch (error) {
      console.error('Error fetching feedback:', error);
      throw error;
    }
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
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }
} 