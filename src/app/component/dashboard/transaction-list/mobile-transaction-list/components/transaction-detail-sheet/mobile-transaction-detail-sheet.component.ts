import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MAT_BOTTOM_SHEET_DATA, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { Transaction } from '../../../../../../util/models/transaction.model';
import { CurrencyPipe } from 'src/app/util/pipes/currency.pipe';
import { TranslateModule } from '@ngx-translate/core';
import { ImageFallbackDirective } from 'src/app/util/directives/image-fallback.directive';

export interface TransactionDetailData {
  transaction: Transaction;
  onEdit: (tx: Transaction) => void;
  onAdjust: (tx: Transaction) => void;
  onDelete: (tx: Transaction) => void;
}

@Component({
  selector: 'app-mobile-transaction-detail-sheet',
  standalone: true,
  imports: [
    CommonModule,
    MatIconModule,
    MatButtonModule,
    MatDividerModule,
    CurrencyPipe,
    TranslateModule,
    ImageFallbackDirective
  ],
  templateUrl: './mobile-transaction-detail-sheet.component.html',
  styleUrls: ['./mobile-transaction-detail-sheet.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MobileTransactionDetailSheetComponent {
  public data = signal(inject<TransactionDetailData>(MAT_BOTTOM_SHEET_DATA));
  private bottomSheetRef = inject(MatBottomSheetRef<MobileTransactionDetailSheetComponent>);

  onEdit() {
    this.data().onEdit(this.data().transaction);
    this.close();
  }

  onAdjust() {
    this.data().onAdjust(this.data().transaction);
    this.close();
  }

  onDelete() {
    this.data().onDelete(this.data().transaction);
    this.close();
  }

  close() {
    this.bottomSheetRef.dismiss();
  }
}
