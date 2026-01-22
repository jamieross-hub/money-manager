import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';

// Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatChipsModule } from '@angular/material/chips';

// Admin Components
import { AdminComponent } from './admin.component';
import { AdminUsersComponent } from './admin-users/admin-users.component';
import { AdminFeedbackComponent } from './admin-feedback/admin-feedback.component';
import { AdminAnalyticsComponent } from './admin-analytics/admin-analytics.component';
import { AdminSettingsComponent } from './admin-settings/admin-settings.component';
import { AdminContactComponent } from './admin-contact/admin-contact.component';
import { MatTableModule } from '@angular/material/table';

// Admin Services, Routing, and Shared
import { AdminServicesModule } from './admin-services.module';
import { AdminRoutingModule } from './admin-routing.module';
import { AdminSharedModule } from './admin-shared.module';

@NgModule({
  declarations: [
    AdminComponent,
    AdminUsersComponent,
    AdminFeedbackComponent,
    AdminAnalyticsComponent,
    AdminSettingsComponent,
    AdminContactComponent
  ],
  imports: [
    AdminSharedModule,
    ReactiveFormsModule,
    FormsModule,
    AdminRoutingModule,
    AdminServicesModule,

    // Additional Material Modules
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatPaginatorModule,
    MatMenuModule,
    MatDialogModule,
    MatDividerModule,
    MatBadgeModule,
    MatChipsModule,
    MatTableModule
  ],
  providers: [
    // Guards are provided at root level, but we can add admin-specific services here
  ]
})
export class AdminModule { } 