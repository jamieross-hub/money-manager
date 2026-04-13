import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, DestroyRef, effect, untracked, Optional } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { distinctUntilChanged } from 'rxjs/operators';
import { Location } from '@angular/common';
import { Store } from '@ngrx/store';
import { MatBottomSheetRef } from '@angular/material/bottom-sheet';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as ProfileSelectors from 'src/app/store/profile/profile.selectors';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { FamilyMember } from 'src/app/util/models/family.model';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { NotificationService } from 'src/app/util/service/notification.service';
import { CommonHeaderComponent } from 'src/app/util/components/dialog/common-header/common-header.component';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';
import { FamilyService } from '../../services/family.service';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ValidationService } from 'src/app/util/service/validation.service';

@Component({
  selector: 'app-family-members',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    MatMenuModule,
    MatDividerModule,
    MatTooltipModule,
    CommonHeaderComponent,
    ImageFallbackDirective,
    FormsModule,
    MatFormFieldModule,
    MatInputModule
],
  templateUrl: './family-members.component.html',
  styleUrls: ['./family-members.component.scss']
})
export class FamilyMembersComponent implements OnInit {
  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private notificationService = inject(NotificationService);
  private location = inject(Location);
  private familyService = inject(FamilyService);
  private validationService = inject(ValidationService);
  readonly breakpointService = inject(BreakpointService);
  private bottomSheetRef = inject(MatBottomSheetRef<FamilyMembersComponent>, { optional: true });
  readonly isBottomSheet = signal(!!this.bottomSheetRef);

  family  = toSignal(this.store.select(FamilySelectors.selectFamily).pipe(distinctUntilChanged()), { initialValue: null as any });
  members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers).pipe(distinctUntilChanged((a, b) => a.length === b.length)), { initialValue: [] as FamilyMember[] });
  loading = toSignal(this.store.select(FamilySelectors.selectFamilyLoading).pipe(distinctUntilChanged()), { initialValue: true });

  /** Current user UID from AppState.profile */
  private readonly profile = this.store.selectSignal(ProfileSelectors.selectProfile);
  get currentUserId(): string | undefined { return this.profile()?.uid ?? undefined; }
  isAdmin = computed(() => {
    const m = this.members();
    const uid = this.currentUserId;
    const me = m.find(x => x.userId === uid);
    return me?.role === 'admin';
  });
  private destroyRef = inject(DestroyRef);

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  emailToAdd = signal('');
  isAdding = signal(false);

  isEmailValid = computed(() => {
    const email = this.emailToAdd().trim();
    if (!email) return true;
    return this.validationService.validateEmail(email);
  });

  constructor() {
    effect(() => {
      const f = this.family();
      if (f?.id) {
        untracked(() => {
          this.store.dispatch(FamilyActions.loadMembers({ familyId: f.id! }));
        });
      }
    });
  }

  ngOnInit() {
    // Standard initialization
  }

  removeMember(member: FamilyMember) {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      closeOnNavigation: false,
      data: { title: 'Remove Member', message: `Remove ${member.displayName} from the family?`, confirmText: 'Remove', confirmColor: 'warn' }
    });
    ref.afterClosed().subscribe(ok => {
      if (ok && this.family()?.id) {
        this.store.dispatch(FamilyActions.removeMember({ familyId: this.family().id, memberId: member.userId }));
      }
    });
  }

  toggleRole(member: FamilyMember) {
    const fam = this.family();
    if (!fam?.id || !member.userId) return;
    
    const newRole = member.role === 'admin' ? 'member' : 'admin';
    this.store.dispatch(FamilyActions.updateMemberRole({ 
      familyId: fam.id, 
      memberId: member.userId, 
      role: newRole 
    }));
  }

  async addMember() {
    const email = this.emailToAdd().trim();
    const famId = this.family()?.id;
    if (!email || !famId || !this.isEmailValid()) return;

    this.isAdding.set(true);
    try {
      await this.familyService.addMemberByEmail(famId, email);
      this.emailToAdd.set('');
    } catch (err: any) {
      this.notificationService.error(err.message || 'Failed to add member');
    } finally {
      this.isAdding.set(false);
    }
  }

  copyCode() {
    const code = this.family()?.inviteCode;
    if (code) navigator.clipboard.writeText(code);
    this.notificationService.success('Invite code copied!');
  }

  goBack() {
    if (this.bottomSheetRef) {
      this.bottomSheetRef.dismiss();
    } else {
      this.location.back();
    }
  }


  memberColor(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' });
  }
}
