import { Component } from '@angular/core';
import { SideBarComponent } from '../side-bar/side-bar.component';
import { UserComponent } from './user/user.component';

@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrl: './header.component.scss',
  standalone: true,
  imports: [SideBarComponent, UserComponent]
})
export class HeaderComponent {

}
