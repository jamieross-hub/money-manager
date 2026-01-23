import { Component, OnInit, OnDestroy } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { UserService } from 'src/app/util/service/db/user.service';
import { Router } from '@angular/router';
import { Timestamp } from '@angular/fire/firestore';
import { Goal } from 'src/app/util/service/db/goals.service';
import { NotificationService } from 'src/app/util/service/notification.service';
import { Store } from '@ngrx/store';
import { AppState } from '../../../store/app.state';
import * as GoalsActions from '../../../store/goals/goals.actions';
import * as GoalsSelectors from '../../../store/goals/goals.selectors';
import { Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { DateService } from 'src/app/util/service/date.service';

@Component({
  selector: 'app-goals',
  templateUrl: './goals.component.html',
  styleUrls: ['./goals.component.scss']
})
export class GoalsComponent implements OnInit, OnDestroy {
  // Observables from store
  goals$: Observable<Goal[]>;
  goalsLoading$: Observable<boolean>;
  goalsError$: Observable<any>;

  userId: string = '';
  goals: Goal[] = [];
  newGoal: Goal = {
    goalId: '',
    userId: '',
    title: '',
    targetAmount: 0,
    currentAmount: 0,
    deadline: Timestamp.fromDate(new Date()),
  };

  private destroy$ = new Subject<void>();
  private subscriptions = new Subscription();

  constructor(
    private auth: Auth,
    private router: Router,
    private notificationService: NotificationService,
    private store: Store<AppState>,
    public dateService: DateService,
    private userService: UserService
  ) {
    // Initialize selectors
    this.goals$ = this.store.select(GoalsSelectors.selectAllGoals);
    this.goalsLoading$ = this.store.select(GoalsSelectors.selectGoalsLoading);
    this.goalsError$ = this.store.select(GoalsSelectors.selectGoalsError);
  }

  ngOnInit(): void {
    this.loadGoals();
    this.subscribeToStoreData();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Load goals for the logged-in user
  loadGoals() {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.userId = userId;
      this.store.dispatch(GoalsActions.loadGoals({ userId: this.userId }));
    }
  }

  // Subscribe to store data for backward compatibility
  subscribeToStoreData() {
    this.subscriptions.add(
      this.goals$.subscribe(goals => {
        this.goals = goals;
      })
    );

    this.subscriptions.add(
      this.goalsError$.subscribe(error => {
        if (error) {
          console.error('Error loading goals:', error);
          this.notificationService.error('Failed to load goals');
        }
      })
    );
  }

  // Create a new goal
  createGoal() {
    if (!this.newGoal.title || !this.newGoal.targetAmount) {
      this.notificationService.warning('Please fill in all required fields');
      return;
    }

    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.newGoal.userId = userId;
      this.newGoal.goalId = `${this.newGoal.userId}-${new Date().getTime()}`;

      this.store.dispatch(GoalsActions.createGoal({
        userId: userId,
        goal: this.newGoal
      }));

      this.notificationService.success('Goal created successfully');

      // Reset form
      this.newGoal = {
        goalId: '',
        userId: '',
        title: '',
        targetAmount: 0,
        currentAmount: 0,
        deadline: Timestamp.fromDate(new Date()),
      };
    }
  }

  // Delete a goal
  deleteGoal(goalId: string) {
    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(GoalsActions.deleteGoal({ userId, goalId }));
      this.notificationService.success('Goal deleted successfully');
    }
  }

  // Update the current amount for a goal
  updateCurrentAmount(goalId: string, amount: number) {
    if (amount <= 0) {
      this.notificationService.warning('Please enter a valid amount');
      return;
    }

    const userId = this.userService.getCurrentUserId();
    if (userId) {
      this.store.dispatch(GoalsActions.updateCurrentAmount({ userId, goalId, amount }));
      this.notificationService.success('Goal progress updated successfully');
    }
  }
}
