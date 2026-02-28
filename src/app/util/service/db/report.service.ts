import { Injectable, inject } from '@angular/core';
import { Firestore, collection, doc, setDoc, addDoc, Timestamp, query, where, getDocs } from '@angular/fire/firestore';
import { Auth } from '@angular/fire/auth';
import { Observable, from, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { ReportRequest, ReportStatus, ReportType } from '../../models/report.model';

@Injectable({
  providedIn: 'root'
})
export class ReportService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  /**
   * Request a new report to be generated.
   * This creates an entry in the 'reports' collection which the backend 
   * can listen to and trigger an email.
   */
  requestReport(params: {
    email: string;
    familyId?: string;
    type: ReportType;
    startDate?: Date;
    endDate?: Date;
  }): Observable<string> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) {
      throw new Error('User must be logged in to request a report');
    }

    const reportsRef = collection(this.firestore, 'reports');
    const now = new Date();

    const reportData: Omit<ReportRequest, 'id'> = {
      userId,
      email: params.email,
      familyId: params.familyId,
      type: params.type,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      parameters: {
        startDate: params.startDate || null as any,
        endDate: params.endDate || null as any
      }
    };

    return from(addDoc(reportsRef, reportData)).pipe(
      map(docRef => docRef.id)
    );
  }

  /**
   * Check if there's an existing pending report for this user and family.
   */
  getPendingReport(familyId?: string): Observable<ReportRequest | null> {
    const userId = this.auth.currentUser?.uid;
    if (!userId) return of(null);

    const reportsRef = collection(this.firestore, 'reports');
    let q = query(
      reportsRef, 
      where('userId', '==', userId),
      where('status', '==', 'pending')
    );

    if (familyId) {
      q = query(q, where('familyId', '==', familyId));
    }

    return from(getDocs(q)).pipe(
      map(snapshot => {
        if (snapshot.empty) return null;
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() } as ReportRequest;
      })
    );
  }
}
