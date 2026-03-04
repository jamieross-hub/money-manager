import { Component , ChangeDetectionStrategy} from '@angular/core';

import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {

}
