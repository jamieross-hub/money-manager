import { Injectable } from '@angular/core';
import { UserService } from './db/user.service';

@Injectable({
  providedIn: 'root'
})
export class GreetingFacadeService {

  constructor(private userService: UserService) { }

  public getPersonalizedGreeting(): string {
    const hour = new Date().getHours();
    let greeting = '';

    if (hour >= 5 && hour < 12) {
      greeting = 'Good morning';
    } else if (hour >= 12 && hour < 17) {
      greeting = 'Good afternoon';
    } else if (hour >= 17 && hour < 22) {
      greeting = 'Good evening';
    } else {
      greeting = 'Good night';
    }

    const user = this.userService.getCurrentUserSnapshot();
    const name = user?.firstName || user?.displayName || 'there';

    return `${greeting}, ${name}!`;
  }
}
