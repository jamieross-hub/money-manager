import { Injectable } from '@angular/core';
import {
    Firestore,
    collection,
    addDoc,
    updateDoc,
    doc,
    getDocs,
    deleteDoc
} from '@angular/fire/firestore';
import { Observable, from, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { LocalIndexDBStorageService } from '../indexdb-storage.service';


export interface GetInTouch {
    id: string;
    name: string;
    email: string;
    message: string;
    updatedAt?: Date;
    status?: 'new' | 'read' | 'replied';
}

@Injectable({
    providedIn: 'root'
})
export class ContactService {
    private readonly collectionName = 'get-in-touch';
    private readonly CACHE_KEY = 'admin_contacts';

    constructor(
        private firestore: Firestore,
        private storageService: LocalIndexDBStorageService
    ) { }

    /** ✅ CREATE */
    create(payload: Omit<GetInTouch, 'id'>): Observable<any> {
        const ref = collection(this.firestore, this.collectionName);

        const data = {
            ...payload,
            createdAt: new Date(),
            status: 'new'
        };

        return from(addDoc(ref, data)).pipe(
            map(docRef => ({
                id: docRef.id,
                ...data
            }))
        );
    }

    /** ✅ UPDATE */
    update(id: string, payload: Partial<GetInTouch>): Observable<void> {
        const ref = doc(this.firestore, this.collectionName, id);

        return from(
            updateDoc(ref, {
                ...payload,
                updatedAt: new Date()
            })
        );
    }

    /** ✅ GET ALL (Admin / Dashboard) - Cache-first */
    getAll(): Observable<GetInTouch[]> {
        const cached = this.storageService.getItem<GetInTouch[]>(this.CACHE_KEY);
        return of(cached || []);
    }

    /**
     * Pull contacts from Firestore
     */
    pullFromFirestore(): Observable<void> {
        const ref = collection(this.firestore, this.collectionName);
        return from(getDocs(ref)).pipe(
            tap(querySnapshot => {
                const contacts = querySnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as GetInTouch));
                this.storageService.setItem(this.CACHE_KEY, contacts);
            }),
            map(() => undefined),
            catchError(error => {
                console.error('[ContactService] Pull failed:', error);
                return of(undefined);
            })
        );
    }

    /** ✅ DELETE */
    delete(id: string): Observable<void> {
        const ref = doc(this.firestore, this.collectionName, id);
        return from(deleteDoc(ref)).pipe(
            tap(() => {
                const cached = this.storageService.getItem<GetInTouch[]>(this.CACHE_KEY);
                if (cached) {
                    const updated = cached.filter(c => c.id !== id);
                    this.storageService.setItem(this.CACHE_KEY, updated);
                }
            })
        );
    }
}
