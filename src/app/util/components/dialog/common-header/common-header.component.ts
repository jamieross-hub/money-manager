import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-common-header',
  templateUrl: './common-header.component.html',
  styleUrls: ['./common-header.component.scss']
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