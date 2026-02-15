

import { Component } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { MatIconModule } from '@angular/material/icon';
import { CategoryComponent } from '../category/category.component';
import { AccountsComponent } from '../accounts/accounts.component';


@Component({
    selector: 'user-summary',
    templateUrl: './summary.component.html',
    styleUrls: ['./summary.component.scss'],
    standalone: true,
    imports: [
        MatTabsModule,
        MatIconModule,
        CategoryComponent,
        AccountsComponent
    ]
})
export class SummaryComponent {

    constructor() { }

    ngOnInit(): void {

    }

}
