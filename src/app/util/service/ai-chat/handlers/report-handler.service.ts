import { Injectable } from "@angular/core";



@Injectable({ providedIn: 'root' })
export class ReportHandlerService {


    generateReport(): { sender: 'bot', type: 'html', text: string } {
        console.log('Generating report...');
        return { sender: 'bot', type: 'html', text: 'Generating your financial report...' };    
    }
}