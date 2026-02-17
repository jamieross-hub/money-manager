import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import { Observable } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { AppState } from '../../store/app.state';
import * as ProfileSelectors from '../../store/profile/profile.selectors';
import { DateService } from './date.service';
import dayjs from 'dayjs';

export type AppView = 'WEEKLY' | 'MONTHLY' | 'YEARLY';

@Injectable({
    providedIn: 'root'
})
export class AppViewService {

    public appView$: Observable<AppView>;
    public appView: AppView = 'MONTHLY';

    constructor(
        private store: Store<AppState>,
        private dateService: DateService
    ) {
        this.appView$ = this.store.select(ProfileSelectors.selectUserPreferences).pipe(
            map(prefs => (prefs?.appView as AppView) || 'MONTHLY'),
            tap(appView => this.appView = appView)
        );
    }

    /**
     * Check if a date falls within the current view range.
     * @param date The date to check
     * @param view The current App View
     * @returns verified boolean
     */
    public isDateInView(date: any): boolean {
        const d = this.dateService.toDate(date);
        if (!d) return false;

        const now = new Date();
        const dateObj = dayjs(d);
        const nowObj = dayjs(now);

        if (this.appView === 'WEEKLY') {
            return dateObj.isSame(nowObj, 'week');
        } else if (this.appView === 'YEARLY') {
            return dateObj.isSame(nowObj, 'year');
        } else {
            return dateObj.isSame(nowObj, 'month');
        }
    }

    /**
     * Get the display label for the view period.
     * @param view The current App View
     * @returns label string (e.g., 'week', 'month', 'year')
     */
    public getViewLabel(): string {
        switch (this.appView) {
            case 'WEEKLY': return 'week';
            case 'YEARLY': return 'year';
            case 'MONTHLY':
            default: return 'month';
        }
    }
}
