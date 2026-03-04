import { NgModule } from '@angular/core';
import { ServerModule } from '@angular/platform-server';

import { AppModule } from './app.module';
import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { AppShellComponent } from './app-shell/app-shell.component';




@NgModule({
  declarations: [],
  imports: [
    AppShellComponent,
    AppModule,
    ServerModule,
    AppRoutingModule
  ],
  bootstrap: [AppComponent],
})
export class AppServerModule { }
