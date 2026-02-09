import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-common-body-content',
  templateUrl: './common-body-content.component.html',
  styleUrls: ['./common-body-content.component.scss'],
  standalone: true,
  imports: [
    CommonModule
  ]
})
export class CommonBodyContentComponent {

  constructor() {
  }
} 