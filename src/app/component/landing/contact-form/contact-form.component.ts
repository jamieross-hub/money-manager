import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService } from 'src/app/util/service/contact.service';
import { NotificationService } from 'src/app/util/service/notification.service';

@Component({
    selector: 'app-contact-form',
    templateUrl: './contact-form.component.html',
    styleUrls: ['./contact-form.component.scss']
})
export class ContactFormComponent {
    contactForm: FormGroup;
    isLoading = false;

    constructor(
        private fb: FormBuilder,
        private contactService: ContactService,
        private notificationService: NotificationService
    ) {
        this.contactForm = this.fb.group({
            name: ['', [Validators.required]],
            email: ['', [Validators.required, Validators.email]],
            message: ['', [Validators.required, Validators.minLength(10)]]
        });
    }

    onSubmit(): void {
        if (this.contactForm.invalid) {
            this.notificationService.error('Please fill out all fields correctly.');
            return;
        }

        this.isLoading = true;
        const { name, email, message } = this.contactForm.value;

        this.contactService.sendMessage(name, email, message).subscribe({
            next: () => {
                this.notificationService.success('Message sent successfully!');
                this.contactForm.reset();
                this.isLoading = false;
            },
            error: (err) => {
                console.error('Error sending message to Slack', err);
                // Slack webhooks might return opaque errors due to no-cors if not correctly configured,
                // but often it works. If it fails, we show generic error.
                this.notificationService.error('Failed to send message. Please try again later.');
                this.isLoading = false;
            }
        });
    }
}
