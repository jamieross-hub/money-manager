import { Injectable } from '@angular/core';
import { environment } from '@env/environment';
import { UserService } from './db/user.service';
import { firstValueFrom } from 'rxjs';

declare var gapi: any;
declare var google: any;

@Injectable({
    providedIn: 'root'
})
export class GoogleApiService {
    private clientId = environment.googleClientId;
    private scope = [
        //'https://www.googleapis.com/auth/spreadsheets',
        'profile',
        'email'
    ].join(' ');

    private tokenClient: any;
    private accessToken: string | null = null;
    private initialized = false;

    constructor(private userService: UserService) {
        // this.userService.googleAccessToken$.subscribe(token => {
        //     if (token) {
        //         this.accessToken = token;
        //         this.initialized = true;
        //         console.log('✅ Google API Service: Token updated from Firebase');
        //     }
        // });
        // this.loadApi();
    }

    /**
     * Initialize GIS and GAPI Client at app startup
     */




    /**
     * Request a token (shows popup) using Google Identity Services (GIS)
     */
    public requestToken(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                const tokenClient = google.accounts.oauth2.initTokenClient({
                    client_id: environment.googleClientId,
                    scope: this.scope,
                    callback: (response: any) => {
                        if (response.error) {
                            reject(response);
                            return;
                        }
                        this.accessToken = response.access_token;
                        if (this.accessToken) {
                            gapi.client.setToken({ access_token: this.accessToken });
                            this.initialized = true;
                        }
                        resolve();
                    },
                });
                tokenClient.requestAccessToken({ prompt: '' });
            } catch (error) {
                console.error('❌ GIS: Token request failed', error);
                reject(error);
            }
        });
    }

    /**
     * Legacy support for loadApi (if needed)
     */
    public async loadApi(): Promise<void> {
        console.log('⚠️ Google API Service: loadApi disabled');
        return Promise.resolve();
        /*
        return new Promise((resolve, reject) => {
            // Only load 'client', avoiding 'auth2' which is deprecated
            gapi.load('client', async () => {
                try {
                    await gapi.client.init({
                        discoveryDocs: ['https://sheets.googleapis.com/$discovery/rest?version=v4'],
                        // Note: clientId and scope are NOT needed here for GIS
                    });

                    // Try to get token from UserService first
                    const firebaseToken = this.userService.googleAccessToken$.value;

                    if (firebaseToken) {
                        this.accessToken = firebaseToken;
                        this.initialized = true;
                        gapi.client.setToken({ access_token: this.accessToken });
                        console.log('✅ Google API Service: Using token from Firebase session');
                    }

                    resolve();
                } catch (error) {
                    console.error('❌ Google API Service: Initialization failed', error);
                    reject(error);
                }
            }, (err: any) => {
                console.error('❌ Google API Service: gapi.load failed', err);
                reject(err);
            });
        });
        */
    }

    /**
     * Append a row to a Google Sheet
     */
    public async appendRow(spreadsheetId: string, range: string, values: any[][]) {
        if (!this.initialized || !gapi.client || !gapi.client.sheets) {
            console.log('🔄 Google API Service: Initializing before appendRow...');
            await this.loadApi();
        }

        if (this.accessToken) {
            gapi.client.setToken({ access_token: this.accessToken });
        }

        return gapi.client.sheets.spreadsheets.values.append({
            spreadsheetId: spreadsheetId,
            range: range,
            valueInputOption: 'RAW',
            resource: {
                values: values
            }
        });
    }
}
