import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { LandingComponent } from '../../component/landing/landing.component';
import { ContactFormComponent } from '../../component/landing/contact-form/contact-form.component';
import { PrivacyPolicyComponent } from '../../component/privacy-policy/privacy-policy.component';
import { TermsConditionsComponent } from '../../component/terms-conditions/terms-conditions.component';
import { DataDeletionComponent } from '../../component/data-deletion/data-deletion.component';
import { OfflinePageComponent } from '../../util/components/offline-page/offline-page.component';

const routes: Routes = [
    { path: '', component: LandingComponent },
    { path: 'feedback', component: ContactFormComponent },
    { path: 'privacy-policy', component: PrivacyPolicyComponent },
    { path: 'terms-conditions', component: TermsConditionsComponent },
    { path: 'offline', component: OfflinePageComponent },
    { path: 'data-deletion', component: DataDeletionComponent }
];

@NgModule({
    imports: [RouterModule.forChild(routes)],
    exports: [RouterModule]
})
export class LandingRoutingModule { }
