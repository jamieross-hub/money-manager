import { Component, OnInit , ChangeDetectionStrategy} from '@angular/core';
import { Location } from '@angular/common';


import { MatIconModule } from '@angular/material/icon';

@Component({
    selector: 'app-data-deletion',
    templateUrl: './data-deletion.component.html',
    styleUrls: ['./data-deletion.component.scss'],
    standalone: true,
    imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataDeletionComponent implements OnInit {
    lastUpdated: string = 'October 20, 2023'; // Keeping it consistent with other policy pages if they have it
    contactEmail: string = 'prashiln79@gmail.com';

    constructor(private location: Location) { }

    ngOnInit(): void {
        const today = new Date();
        this.lastUpdated = today.toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    }

    navigateBack(): void {
        this.location.back();
    }
}
