import { Component, OnInit, OnDestroy , ChangeDetectionStrategy} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Store } from '@ngrx/store';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Auth } from '@angular/fire/auth';
import { MatDialog } from '@angular/material/dialog';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { NotificationService } from 'src/app/util/service/notification.service';
import { SplitwiseGroup } from 'src/app/util/models/splitwise.model';
import { AddMemberDialogComponent } from '../add-member-dialog/add-member-dialog.component';

// NgRx
import { AppState } from '../../../store/app.state';
import * as SplitwiseActions from '../store/splitwise.actions';
import { selectSplitwiseState } from '../store/splitwise.selectors';
import { BreakpointService } from 'src/app/util/service/breakpoint.service';

@Component({
  selector: 'app-members-page',
  templateUrl: './members-page.component.html',
  styleUrls: ['./members-page.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MembersPageComponent implements OnInit, OnDestroy {
  group: SplitwiseGroup | null = null;
  isLoading: boolean = false;
  error: string | null = null;
  currentUser: any = null;
  isMobile: boolean = false;
  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private auth: Auth,
    private store: Store<AppState>,
    private dialog: MatDialog,
    private notificationService: NotificationService,
    private breakpointObserver: BreakpointObserver,
    public breakpointService: BreakpointService
  ) {
    // Observe breakpoints for mobile detection
    this.breakpointObserver.observe([Breakpoints.Handset])
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isMobile = result.matches;
      });
  }

  ngOnInit(): void {
    this.currentUser = this.auth.currentUser;
    this.subscribeToStore();
    this.loadGroupDetails();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private subscribeToStore(): void {
    this.store.select(selectSplitwiseState)
      .pipe(takeUntil(this.destroy$))
      .subscribe(state => {
        this.isLoading = state.loading;
        this.error = state.error;

        // Get the group from the route parameter
        const groupId = this.route.snapshot.paramMap.get('id');
        if (groupId) {
          this.group = state.groups.find(g => g.id === groupId) || null;
          
          // If group not found in store, try to load it
          if (!this.group && !this.isLoading) {
            this.store.dispatch(SplitwiseActions.loadGroupById({ groupId }));
          }
        }

        // Show error notification if there's an error
        if (this.error) {
          this.notificationService.error(this.error);
          this.store.dispatch(SplitwiseActions.clearError());
        }
      });
  }

  private loadGroupDetails(): void {
    const groupId = this.route.snapshot.paramMap.get('id');
    if (groupId) {
      this.store.dispatch(SplitwiseActions.loadGroupById({ groupId }));
    }
  }

  goBack(): void {
    if (this.group) {
      this.router.navigate(['dashboard/splitwise/group', this.group.id]);
    } else {
      this.router.navigate(['dashboard/splitwise']);
    }
  }

  openAddMemberDialog(): void {
    if (!this.group) return;

    const dialogRef = this.dialog.open(AddMemberDialogComponent, {
      data: { group: this.group },
      disableClose: true,
      panelClass: this.breakpointService.device.isMobile ? 'mobile-dialog' : 'desktop-dialog',
    });

    dialogRef.afterClosed().subscribe((result: any) => {
      if (result) {
        if (result.action === 'delete') {
          this.store.dispatch(SplitwiseActions.removeMember({
            groupId: this.group!.id!,
            userId: result.userId
          }));
        } else {
        this.store.dispatch(SplitwiseActions.addMember({ 
          groupId: this.group!.id!, 
          request: result 
        }));
        }
      }
    });
  }
} 