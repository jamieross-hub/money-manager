import { Component, ElementRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HeaderComponent } from './header/header.component';
import { FooterComponent } from './footer/footer.component';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
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

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  standalone: true,
  imports: [CommonModule, RouterModule, HeaderComponent, FooterComponent]
})
export class DashboardComponent {
  @ViewChild('mainContent') mainContent!: ElementRef<HTMLElement>;
  isMobile = false;


  constructor(
    private router: Router,
    private breakpointObserver: BreakpointObserver,
    private store: Store<AppState>,
    private userService: UserService,
    private invitationPopupService: InvitationPopupService,
    private recurringTransactionService: RecurringTransactionService
  ) {
    this.breakpointObserver
      .observe([Breakpoints.Handset])
      .subscribe((result) => {
        this.isMobile = result.matches;
      });
  }

  ngOnInit() {
    // Load App Data **********
    this.store.dispatch(
      loadProfile({ userId: this.userService.userAuth$.value?.uid || '' })
    );
    this.store.dispatch(
      loadAccounts({ userId: this.userService.userAuth$.value?.uid || '' })
    );
    this.store.dispatch(
      loadCategories({ userId: this.userService.userAuth$.value?.uid || '' })
    );
    this.store.dispatch(
      loadBudgets({ userId: this.userService.userAuth$.value?.uid || '' })
    );
    this.store.dispatch(loadGoals({ userId: this.userService.userAuth$.value?.uid || '' }));

    this.store.dispatch(
      loadTransactions({ userId: this.userService.userAuth$.value?.uid || '' })
    );

    this.invitationPopupService.showInvitationsAfterLogin();

    // Check for due recurring transactions after a short delay to ensure data is loaded
    setTimeout(() => {
      this.recurringTransactionService.checkDueRecurringTransactions().subscribe();
    }, 2000);

    // Scroll to top on navigation change
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        if (this.mainContent) {
          this.mainContent.nativeElement.scrollTop = 0;
        }
      });
  }
}
