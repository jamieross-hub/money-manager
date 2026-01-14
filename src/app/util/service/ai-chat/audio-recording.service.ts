import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Service to handle audio recording using MediaRecorder API.
 */
@Injectable({
    providedIn: 'root'
})
export class AudioRecordingService {

    private mediaRecorder: MediaRecorder | null = null;
    private audioChunks: Blob[] = [];
    private isRecordingSubject = new Subject<boolean>();

    // Stream to notify UI of recording state changes
    isRecording$ = this.isRecordingSubject.asObservable();

    constructor() { }

    /**
     * Starts recording audio.
     * Requests microphone permission if not already granted.
     */
    async startRecording(): Promise<void> {
        if (this.mediaRecorder) {
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(stream);
            this.audioChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };

            this.mediaRecorder.onstop = () => {
                // Stop all tracks to release microphone
                stream.getTracks().forEach(track => track.stop());
            };

            this.mediaRecorder.start();
            this.isRecordingSubject.next(true);

        } catch (error) {
            console.error('Error accessing microphone:', error);
            throw error; // Let the component handle the error (e.g., show an alert)
        }
    }

    /**
     * Stops recording and returns the audio blob.
     */
    stopRecording(): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.mediaRecorder) {
                reject(new Error('No active recording.'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' }); // webm is common for MediaRecorder
                this.mediaRecorder = null;
                this.isRecordingSubject.next(false);
                resolve(audioBlob);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Cancel recording without saving.
     */
    cancelRecording(): void {
        if (this.mediaRecorder) {
            this.mediaRecorder.stop();
            this.mediaRecorder = null;
            this.isRecordingSubject.next(false);
        }
    }
}
