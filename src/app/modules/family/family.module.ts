import { NgModule } from '@angular/core';

// NgRx
import { StoreModule } from '@ngrx/store';
import { EffectsModule } from '@ngrx/effects';
import { familyReducer } from './store/family.reducer';
import { FamilyEffects } from './store/family.effects';

// Routing
import { FamilyRoutingModule } from './family-routing.module';

// Services
import { FamilyService } from './services/family.service';

@NgModule({
  imports: [
    FamilyRoutingModule,
  ],
  providers: [FamilyService],
})
export class FamilyModule {}
