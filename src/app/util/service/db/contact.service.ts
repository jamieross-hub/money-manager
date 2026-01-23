import { Injectable } from '@angular/core';
import {
    Firestore,
    collection,
    addDoc,
    updateDoc,
    doc,
    collectionData,
    docData,
    getDocs,
    deleteDoc
} from '@angular/fire/firestore';
import { Observable, from } from 'rxjs';
import { map } from 'rxjs/operators';


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

    constructor(private firestore: Firestore) { }

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

    /** ✅ GET ALL (Admin / Dashboard) */
    async getAll(): Promise<GetInTouch[]> {
        const ref = collection(this.firestore, this.collectionName);
        const querySnapshot = await getDocs(ref);

        return querySnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        } as GetInTouch));
    }

    /** ✅ DELETE */
    delete(id: string): Observable<void> {
        const ref = doc(this.firestore, this.collectionName, id);
        return from(deleteDoc(ref));
    }

    /** ✅ GET BY ID */
    // getById(id: string): Observable<GetInTouch> {
    //     const ref = doc(this.firestore, this.collectionName, id);

    //     return docData(ref, { idField: 'id' }) as Observable<GetInTouch>;
    // }
}
