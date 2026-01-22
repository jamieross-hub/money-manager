import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotificationService } from 'src/app/util/service/notification.service';
import { ContactService, GetInTouch } from 'src/app/util/service/db/contact.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';

@Component({
    selector: 'app-admin-contact',
    templateUrl: './admin-contact.component.html',
    styleUrls: ['./admin-contact.component.scss']
})
export class AdminContactComponent implements OnInit, OnDestroy {
    contactList: GetInTouch[] = [];
    isLoading: boolean = false;
    private destroy$ = new Subject<void>();

    constructor(
        private contactService: ContactService,
        private notificationService: NotificationService,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.loadContacts();
    }

    ngOnDestroy(): void {
        this.destroy$.next();
        this.destroy$.complete();
    }

    async loadContacts(): Promise<void> {
        this.isLoading = true;
        this.contactService.getAll()
            .then((contacts) => {
                this.contactList = contacts
                this.isLoading = false;
            })
            .catch((error) => {
                console.error('Error loading contacts:', error);
                this.notificationService.error('Failed to load contact messages');
                this.isLoading = false;
            });
    }

    formatDate(date: any): string {
        if (!date) return 'N/A';
        // Firestore Timestamp to Date conversion if needed, or just standard Date
        const d = date.toDate ? date.toDate() : new Date(date);
        return d.toLocaleDateString() + ' ' + d.toLocaleTimeString();
    }

    async updateStatus(contact: GetInTouch, status: 'new' | 'read' | 'replied'): Promise<void> {
        if (!contact.id) return;
        try {
            await this.contactService.update(contact.id, { status }).toPromise();
            this.notificationService.success(`Status updated to ${status}`);
            // Optimistic update or reload? getAll is an observable, so it might auto-update if it was real-time. 
            // User snippet showed collectionData(ref) which IS real-time. So no need to manual refresh if it works.
            // But let's see. logic in service is observable.
        } catch (error) {
            console.error('Error updating status', error);
            this.notificationService.error('Failed to update status');
        }
    }
}
