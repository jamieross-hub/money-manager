import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthRoutingModule } from './auth-routing.module';
import { SignInComponent } from '../../component/auth/sign-in/sign-in.component';
import { RegistrationComponent } from '../../component/auth/registration/registration.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
    declarations: [
        SignInComponent,
        RegistrationComponent
    ],
    imports: [
        CommonModule,
        AuthRoutingModule,
        SharedModule
    ]
})
export class AuthModule { }
