import { Component , ChangeDetectionStrategy} from '@angular/core';



@Component({
  selector: 'app-app-shell',
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppShellComponent {

}
