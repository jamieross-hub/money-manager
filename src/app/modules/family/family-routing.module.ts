import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { GroupSelectionComponent } from './pages/group-selection/group-selection.component';
import { FamilyDashboardComponent } from './pages/family-dashboard/family-dashboard.component';
import { FamilyMembersComponent } from './pages/family-members/family-members.component';
import { FamilyReportsComponent } from './pages/family-reports/family-reports.component';

const routes: Routes = [
  { path: '', component: GroupSelectionComponent },
  { path: 'dashboard', component: FamilyDashboardComponent },
  { path: 'members', component: FamilyMembersComponent },
  { path: 'reports', component: FamilyReportsComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class FamilyRoutingModule {}
