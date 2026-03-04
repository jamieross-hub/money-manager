import { Component , ChangeDetectionStrategy} from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ContactService } from 'src/app/util/service/db/contact.service';
import { NotificationService } from 'src/app/util/service/notification.service';


import { ReactiveFormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { TranslateModule } from '@ngx-translate/core';

@Component({
    selector: 'app-contact-form',
    templateUrl: './contact-form.component.html',
    styleUrls: ['./contact-form.component.scss'],
    standalone: true,
    imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    TranslateModule
],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContactFormComponent {
    contactForm: FormGroup;
    isLoading = false;

    constructor(
        private fb: FormBuilder,
        private contactService: ContactService,
        private notificationService: NotificationService,
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

        this.contactService.create({ name, email, message }).subscribe((resp) => {
            this.notificationService.success('Message sent successfully!');
            this.contactForm.reset();
            this.isLoading = false;
        }, (err) => {
            console.error('Error sending message to Slack', err);
            this.notificationService.error('Failed to send message. Please try again later.');
            this.isLoading = false;
        })


    }
}
