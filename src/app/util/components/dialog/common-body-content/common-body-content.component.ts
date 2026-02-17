import { Component, Input, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-common-body-content',
  templateUrl: './common-body-content.component.html',
  styleUrls: ['./common-body-content.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommonBodyContentComponent {

  constructor() {
  }
} 