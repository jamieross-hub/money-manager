import { Injectable } from '@angular/core';
import { Observable, from, of } from 'rxjs';
import { environment } from '@env/environment';
import { GoogleApiService } from './google-api.service';
import { catchError, switchMap } from 'rxjs/operators';

@Injectable({
    providedIn: 'root'
})
export class ContactService {

    constructor(private googleApi: GoogleApiService) { }


    sendMessage(name: string, email: string, message: string): Observable<any> {
        // Logging to Google Sheets is temporarily disabled
        console.log('📬 Contact Service: Message received (Google Sheets logging disabled)', { name, email, message });
        return of({ success: true, message: 'Message sent successfully' });

        /*
        const spreadsheetId = environment.contactSpreadsheetId;
        const range = 'Sheet1!A1'; // Adjust as needed
        const values = [[new Date().toISOString(), name, email, message]];

        return from(this.googleApi.appendRow(spreadsheetId, range, values)).pipe(
            catchError(error => {
                console.error('Error sending message via Google Sheets', error);
                throw error;
            })
        );
        */
    }
}
