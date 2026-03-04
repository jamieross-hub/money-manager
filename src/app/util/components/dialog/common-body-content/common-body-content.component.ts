import { Component, Input, Output, EventEmitter , ChangeDetectionStrategy} from '@angular/core';


@Component({
  selector: 'app-common-body-content',
  templateUrl: './common-body-content.component.html',
  styleUrls: ['./common-body-content.component.scss'],
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CommonBodyContentComponent {

  constructor() {
  }
} 