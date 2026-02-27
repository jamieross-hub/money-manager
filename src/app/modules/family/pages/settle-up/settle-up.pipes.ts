import { Pipe, PipeTransform } from '@angular/core';
import { BalanceEntry } from 'src/app/util/models/family.model';

/** First letter of a display name, uppercased. */
@Pipe({ name: 'settleAvatar', standalone: true, pure: true })
export class SettleAvatarPipe implements PipeTransform {
  transform(name: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }
}

/** Deterministic colour for a user avatar based on userId. */
@Pipe({ name: 'settleAvatarColor', standalone: true, pure: true })
export class SettleAvatarColorPipe implements PipeTransform {
  private readonly colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

  transform(userId: string): string {
    let hash = 0;
    for (const c of userId) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
    return this.colors[hash % this.colors.length];
  }
}

/** Material icon name for a settlement method. */
@Pipe({ name: 'methodIcon', standalone: true, pure: true })
export class MethodIconPipe implements PipeTransform {
  private readonly map: Record<string, string> = {
    cash: 'payments',
    upi: 'phone_iphone',
    bank_transfer: 'account_balance',
  };

  transform(method: string): string {
    return this.map[method] ?? 'swap_horiz';
  }
}

/** Human-readable label for a settlement method. */
@Pipe({ name: 'methodLabel', standalone: true, pure: true })
export class MethodLabelPipe implements PipeTransform {
  private readonly map: Record<string, string> = {
    cash: 'Cash',
    upi: 'UPI',
    bank_transfer: 'Bank Transfer',
  };

  transform(method: string): string {
    return this.map[method] ?? method;
  }
}

/** Formats a Firestore Timestamp or ISO string to a readable date. */
@Pipe({ name: 'settleDate', standalone: true, pure: true })
export class SettleDatePipe implements PipeTransform {
  transform(date: any): string {
    if (!date) return '';
    const d = date?.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
}

/**
 * Returns true if the current user is the one who OWES in this balance.
 * Usage: balance | iOwe : currentUserId
 */
@Pipe({ name: 'iOwe', standalone: true, pure: true })
export class IOWEPipe implements PipeTransform {
  transform(balance: BalanceEntry, currentUserId: string): boolean {
    return balance.fromUserId === currentUserId;
  }
}

/**
 * Returns true if the current user is the one who is OWED in this balance.
 * Usage: balance | owedToMe : currentUserId
 */
@Pipe({ name: 'owedToMe', standalone: true, pure: true })
export class OwedToMePipe implements PipeTransform {
  transform(balance: BalanceEntry, currentUserId: string): boolean {
    return balance.toUserId === currentUserId;
  }
}
