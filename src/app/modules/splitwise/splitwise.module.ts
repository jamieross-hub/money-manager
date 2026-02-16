import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';

// Routing
import { SplitwiseRoutingModule } from './splitwise-routing.module';

// Angular Material Modules
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';

// NgRx
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';

// Components
import { SplitwiseComponent } from './splitwise.component';
import { CreateGroupDialogComponent } from './create-group-dialog/create-group-dialog.component';
import { AddMemberDialogComponent } from './add-member-dialog/add-member-dialog.component';
import { GroupComponent } from './group/group.component';
import { GroupDetailsComponent } from './group-details/group-details.component';
import { MembersPageComponent } from './members-page/members-page.component';
import { EditTransactionDialogComponent } from './edit-transaction-dialog/edit-transaction-dialog.component';

// Store
import { splitwiseReducer } from './store/splitwise.reducer';
import { SplitwiseEffects } from './store/splitwise.effects';

// Services
import { SplitwiseService } from './services/splitwise.service';

// Utility Components
import { LoaderComponent } from '../../util/components/loader/loader.component';
// import { TranslatePipe } from '../../util/pipes/translate.pipe';
import { MembersComponent } from './members/members.component';
import { SharedModule } from '../shared/shared.module';

@NgModule({
  declarations: [
    SplitwiseComponent,
    AddMemberDialogComponent,
    GroupComponent,
    GroupDetailsComponent,
    MembersComponent,
    MembersPageComponent,
    EditTransactionDialogComponent
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    SplitwiseRoutingModule,

    // Material Modules
    MatCardModule,
    MatListModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatBadgeModule,
    MatDividerModule,
    MatMenuModule,
    MatExpansionModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    SharedModule,

    // NgRx
    StoreModule.forFeature('splitwise', splitwiseReducer),
    EffectsModule.forFeature([SplitwiseEffects]),

    // Standalone Components
    LoaderComponent,
    CreateGroupDialogComponent,
    // TranslatePipe,
  ],
  providers: [
    SplitwiseService
  ],
  exports: [
    SplitwiseComponent
  ]
})
export class SplitwiseModule { } 