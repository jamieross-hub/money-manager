import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

@Injectable({
    providedIn: 'root'
})
export class ContactService {

    constructor(private http: HttpClient) { }


    sendMessage(name: string, email: string, message: string): Observable<any> {
        const payload = {
            text: `*New Contact Form Submission*\n*Name:* ${name}\n*Email:* ${email}\n*Message:* ${message}`
        };

        // Slack webhooks expect a POST request with a JSON body
        // Note: If CORS issues arise in dev, a proxy might be needed, 
        // but typically Slack webhooks are permissible or handled via backend.
        // Since this is a direct client-side request as requested:
        return this.http.post(environment.SLACK_WEBHOOK_URL, JSON.stringify(payload), {
            responseType: 'text' // Slack often returns 'ok' string, not JSON
        });
    }
}
