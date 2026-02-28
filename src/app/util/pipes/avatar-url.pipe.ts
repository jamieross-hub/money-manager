import { Pipe, PipeTransform, inject } from '@angular/core';
import { UserService } from '../service/db/user.service';

@Pipe({
  name: 'avatarUrl',
  standalone: true
})
export class AvatarUrlPipe implements PipeTransform {
  private readonly userService = inject(UserService);

  transform(url?: string | null): string {
    return this.userService.getAvatarUrl(url);
  }
}
