import { Component, inject, OnInit, ChangeDetectionStrategy, signal, computed, effect, DestroyRef } from '@angular/core';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { Auth } from '@angular/fire/auth';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { AppState } from 'src/app/store/app.state';
import * as FamilyActions from '../../store/family.actions';
import * as FamilySelectors from '../../store/family.selectors';
import * as ProfileActions from 'src/app/store/profile/profile.actions';
import { FamilyService } from '../../services/family.service';
import { FamilyCreateDialogComponent } from '../../dialogs/family-create-dialog/family-create-dialog.component';
import { FamilyJoinDialogComponent } from '../../dialogs/family-join-dialog/family-join-dialog.component';
import { FamilyTransaction, FamilyStats, Family, FamilyMember } from 'src/app/util/models/family.model';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';
import { QuickActionsFabComponent, QuickActionsFabConfig, QuickAction } from 'src/app/util/components/floating-action-buttons/quick-actions-fab/quick-actions-fab.component';
import { LocalIndexDBStorageService } from 'src/app/util/service/indexdb-storage.service';
import { ConfirmDialogComponent } from 'src/app/util/components/confirm-dialog/confirm-dialog.component';
import { CurrencyPipe } from 'src/app/util/pipes';
import { ReportService } from 'src/app/util/service/db/report.service';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-family-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule, 
    RouterModule, 
    MatButtonModule, 
    MatIconModule, 
    MatProgressSpinnerModule, 
    MatTooltipModule, 
    MatRippleModule,
    QuickActionsFabComponent,
    MatDialogModule,
    CurrencyPipe,
    MatMenuModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  templateUrl: './family-dashboard.component.html',
  styleUrls: ['./family-dashboard.component.scss']
})
export class FamilyDashboardComponent implements OnInit {
  private store = inject(Store<AppState>);
  private dialog = inject(MatDialog);
  private auth = inject(Auth);
  private familyService = inject(FamilyService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  readonly breakpointService = inject(BreakpointService);
  private destroyRef = inject(DestroyRef);
  private reportService = inject(ReportService);
  private snackBar = inject(MatSnackBar);

  family = toSignal(this.store.select(FamilySelectors.selectFamily), { initialValue: null });
  members = toSignal(this.store.select(FamilySelectors.selectFamilyMembers), { initialValue: [] as FamilyMember[] });
  transactions = toSignal(this.store.select(FamilySelectors.selectFamilyTransactions), { initialValue: [] as FamilyTransaction[] });
  recentTxns = toSignal(this.store.select(FamilySelectors.selectRecentTransactions), { initialValue: [] as FamilyTransaction[] });
  loading = toSignal(this.store.select(FamilySelectors.selectFamilyLoading), { initialValue: true });

  recentActivities = computed(() => {
    const mems = this.members();
    return this.recentTxns().map(tx => {
      let payerId = tx.userId;
      let payerName = tx.userDisplayName || 'Unknown';
      let payerPhoto = tx.userPhotoURL;
      let payerLabel = payerName;

      // Settlement recipient info
      let recipientId: string | undefined = undefined;
      let recipientName: string | undefined = undefined;
      let recipientPhoto: string | undefined = undefined;

      // Handle Settlement transactions
      if (tx.category === 'Settlement' && tx.settlementFromUserId) {
        payerId = tx.settlementFromUserId;
        const fromMember = mems.find(m => m.userId === tx.settlementFromUserId);
        if (fromMember) {
          payerName = fromMember.displayName;
          payerPhoto = fromMember.photoURL;
        }

        recipientId = tx.settlementToUserId;
        const toMember = mems.find(m => m.userId === tx.settlementToUserId);
        if (toMember) {
          recipientName = toMember.displayName;
          recipientPhoto = toMember.photoURL;
        } else {
          recipientName = 'Unknown';
        }
        
        payerLabel = payerId === this.currentUserId ? 'You' : payerName;
      } 
      // Handle Split transactions
      else if (tx.splitData) {
        if (tx.splitData.paidByUserId === 'multiple') {
          payerId = 'multiple';
          payerName = 'Multiple';
          payerPhoto = undefined;
          payerLabel = 'Multiple people';
        } else {
          payerId = tx.splitData.paidByUserId || tx.userId;
          payerName = tx.splitData.paidByDisplayName || tx.userDisplayName || 'Unknown';
          payerPhoto = tx.splitData.paidByPhotoURL || tx.userPhotoURL;
          payerLabel = payerId === this.currentUserId ? 'You' : payerName;
        }
      } 
      // Handle Simple transactions
      else {
        payerLabel = payerId === this.currentUserId ? 'You' : payerName;
      }

      return {
        ...tx,
        payerId,
        payerName,
        payerPhoto,
        payerLabel,
        recipientId,
        recipientName,
        recipientPhoto
      };
    });
  });

  constructor() {
    effect(() => {
      const fam = this.family();
      if (fam?.id) {
        this.store.dispatch(FamilyActions.loadMembers({ familyId: fam.id }));
        this.store.dispatch(FamilyActions.loadTransactions({ familyId: fam.id }));
      }
    }, { allowSignalWrites: true });
  }

  private storageService = inject(LocalIndexDBStorageService);

  stats = computed(() => {
    const fam = this.family();
    const trans = this.transactions();
    const mems = this.members();

    if (!fam?.id) return null;
    
    const cacheKey = `stats_${fam.id}`;
    
    if (mems.length === 0) {
      const cachedStats = this.storageService.getItem<FamilyStats>(cacheKey);
      if (cachedStats) {
        return cachedStats;
      }
    }

    const calculatedStats = this.familyService.computeStats(trans, mems);
    this.storageService.setItem(cacheKey, calculatedStats);
    return calculatedStats;
  });

  get currentUserId(): string | undefined {
    return this.auth.currentUser?.uid;
  }

  currentUserExpense = computed(() => {
    const s = this.stats();
    if (!s || !this.currentUserId) return 0;
    const memberStat = s.memberBreakdown.find(m => m.userId === this.currentUserId);
    return memberStat ? memberStat.totalExpense : 0;
  });

  fabConfig = computed<QuickActionsFabConfig>(() => ({
    mainButtonIcon: 'add',
    mainButtonColor: 'primary',
    mainButtonTooltip: 'Add Transaction',
    actions: []
  }));

  private memberColors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) {
        this.store.dispatch(FamilyActions.loadFamily({ familyId: id }));
      } else {
        this.store.dispatch(FamilyActions.loadMyFamily());
      }
    });
  }

  generateReport() {
    const fam = this.family();
    const userEmail = this.auth.currentUser?.email;
    
    if (!fam?.id || !userEmail) {
      this.snackBar.open('Unable to generate report: Missing data', 'Close', { duration: 3000 });
      return;
    }

    // Check if a report is already pending
    this.reportService.getPendingReport(fam.id).subscribe({
      next: (pendingReport) => {
        if (pendingReport) {
          this.snackBar.open('A report is already being prepared. Please check your email shortly.', 'Close', { 
            duration: 5000 
          });
          return;
        }

        // If no pending report, request a new one
        this.reportService.requestReport({
          email: userEmail,
          familyId: fam.id,
          type: 'family_overview'
        }).subscribe({
          next: () => {
            this.snackBar.open('Report requested! You will receive it via email soon.', 'Close', { 
              duration: 5000,
              panelClass: ['success-snackbar']
            });
          },
          error: (err) => {
            console.error('Report request failed:', err);
            this.snackBar.open('Failed to request report. Please try again later.', 'Close', { duration: 3000 });
          }
        });
      },
      error: (err) => {
        console.error('Error checking pending reports:', err);
        // Fallback: Just try to request if check fails
      }
    });
  }

  createFamily() {
    const ref = this.dialog.open(FamilyCreateDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(result => {
      if (result) this.store.dispatch(FamilyActions.createFamily({ request: result }));
    });
  }

  joinFamily() {
    const ref = this.dialog.open(FamilyJoinDialogComponent, { disableClose: true });
    ref.afterClosed().subscribe(code => {
      if (code) this.store.dispatch(FamilyActions.joinFamily({ inviteCode: code }));
    });
  }



  copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }

  memberColor(userId: string | undefined): string {
    if (!userId) return '#94a3b8'; // Default slate color
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.memberColors[hash % this.memberColors.length];
  }

  formatDate(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  }

  addTransaction() {
    // TODO: implement transaction addition logic
  }

  deleteFamily() {
    const fam = this.family();
    const familyId = fam?.id;
    if (!familyId) return;

    const isOwner = fam.ownerUserId === this.currentUserId;
    const title = isOwner ? 'Delete Family' : 'Leave Family';
    const message = isOwner 
      ? 'Are you sure you want to delete this family? This action cannot be undone and all data will be lost for all members.'
      : 'Are you sure you want to leave this family?';

    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title,
        message,
        confirmText: isOwner ? 'Delete' : 'Leave',
        confirmColor: 'warn'
      }
    });

    ref.afterClosed().subscribe(async (ok) => {
      if (ok) {
        try {
          if (isOwner) {
            await this.familyService.deleteFamily(familyId);
          } else {
            await this.familyService.leaveFamily(familyId);
            // Update local preferences
            this.store.dispatch(ProfileActions.updatePreferences({
              userId: this.currentUserId!,
              preferences: { activeFamilyId: null, isFamilyMode: false }
            }));
          }
          this.router.navigate(['/dashboard']);
        } catch (error: any) {
          alert(error.message || 'An error occurred');
        }
      }
    });
  }
}
