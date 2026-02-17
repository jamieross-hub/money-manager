import { Component, Input, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

@Component({
  selector: 'app-common-header',
  templateUrl: './common-header.component.html',
  styleUrls: ['./common-header.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommonHeaderComponent {
  @Input() title: string = '';
  @Input() showAddButton: boolean = false;
  @Input() showEditButton: boolean = false;
  @Input() addButtonDisabled: boolean = false;
  @Input() isSubmitting: boolean = false;
  @Input() addButtonTooltip: string = 'Save';
  @Input() showCloseButton: boolean = true;
  @Input() closeButtonTooltip: string = 'Close';

  @Output() addButtonClick = new EventEmitter<void>();
  @Output() editButtonClick = new EventEmitter<void>();
  @Output() closeButtonClick = new EventEmitter<void>();

  onAddButtonClick(): void {
    this.addButtonClick.emit();
  }

  onEditButtonClick(): void {
    this.editButtonClick.emit();
  }

  onCloseButtonClick(): void {
    this.closeButtonClick.emit();
  }
} 