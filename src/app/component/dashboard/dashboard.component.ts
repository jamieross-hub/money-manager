import { Component, ElementRef, ViewChild, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { Router, NavigationEnd } from '@angular/router';
import { filter, takeUntil, take } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { AppState } from 'src/app/store/app.state';
import { Store } from '@ngrx/store';
import { UserService } from 'src/app/util/service/db/user.service';
import { loadProfile } from 'src/app/store/profile/profile.actions';
import { loadAccounts } from 'src/app/store/accounts/accounts.actions';
import { loadCategories } from 'src/app/store/categories/categories.actions';
import { loadBudgets } from 'src/app/store/budgets/budgets.actions';
import { loadGoals } from 'src/app/store/goals/goals.actions';
import { loadTransactions } from 'src/app/store/transactions/transactions.actions';
import { InvitationPopupService } from 'src/app/util/service/invitation-popup.service';
import { RecurringTransactionService } from 'src/app/util/service/recurring-transaction.service';
import { PwaSwService } from 'src/app/util/service/pwa-sw.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, HeaderComponent, FooterComponent]
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('mainContent') mainContent!: ElementRef<HTMLElement>;
  isMobile = false;
  updateAvailable = false;
  private destroy$ = new Subject<void>();

  constructor(
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private store: Store<AppState>,
    private userService: UserService,
    private invitationPopupService: InvitationPopupService,
    private recurringTransactionService: RecurringTransactionService,
    private cdr: ChangeDetectorRef,
    private pwaSwService: PwaSwService
  ) { }

  ngOnInit() {
    this.setupSubscriptions();
    this.loadAppData();

    this.invitationPopupService.showInvitationsAfterLogin();

    // Check for due recurring transactions after a short delay
    setTimeout(() => {
      this.recurringTransactionService.checkDueRecurringTransactions()
        .pipe(takeUntil(this.destroy$))
        .subscribe();
    }, 2000);

    // Redirect to family dashboard on app start if family mode is enabled
    // this.userService.userAuth$.pipe(
    //   filter((user: any) => !!user),
    //   take(1)
    // ).subscribe((user: any) => {
    //   if (user?.preferences?.isFamilyMode && (this.router.url === '/dashboard' || this.router.url === '/dashboard/home' || this.router.url === '/')) {
    //     this.router.navigate(['/dashboard/family']);
    //   }
    // });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions() {
    // Breakpoint subscription
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe((result) => {
        this.isMobile = result.matches;
        this.cdr.markForCheck(); // Manually trigger change detection since we're updating a property
      });

    // Router subscription
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(() => {
        if (this.mainContent) {
          this.mainContent.nativeElement.scrollTop = 0;
        }
      });
  }

  private loadAppData() {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(loadProfile({ userId }));
      this.store.dispatch(loadAccounts({ userId }));
      this.store.dispatch(loadCategories({ userId }));
      this.store.dispatch(loadBudgets({ userId }));
      this.store.dispatch(loadGoals({ userId }));
      this.store.dispatch(loadTransactions({ userId }));
    }
  }

  refreshApp(): void {
    this.pwaSwService.activateUpdate();
  }

  dismissUpdate(): void {
    this.updateAvailable = false;
    this.pwaSwService.dismissUpdate();
    this.cdr.markForCheck();
  }
}
