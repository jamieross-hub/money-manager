import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LandingRoutingModule } from './landing-routing.module';
import { SharedModule } from '../shared/shared.module';

import { LandingComponent } from '../../component/landing/landing.component';
import { ContactFormComponent } from '../../component/landing/contact-form/contact-form.component';
import { PrivacyPolicyComponent } from '../../component/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from '../../component/terms-conditions/terms-conditions.component';
import { DataDeletionComponent } from '../../component/data-deletion/data-deletion.component';
import { OfflinePageComponent } from '../../util/components/offline-page/offline-page.component';

@NgModule({
    declarations: [
        LandingComponent,
        ContactFormComponent,
        PrivacyPolicyComponent,
        TermsConditionsComponent,
        DataDeletionComponent,
        OfflinePageComponent
    ],
    imports: [
        CommonModule,
        LandingRoutingModule,
        SharedModule
    ]
})
export class LandingModule { }
