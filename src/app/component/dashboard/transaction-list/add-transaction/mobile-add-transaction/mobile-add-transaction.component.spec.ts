import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MobileAddTransactionComponent } from './mobile-add-transaction.component';
import { TestSetup } from '../../../../../util/testing/test-setup';
import { TEST_IMPORTS } from '../../../../../util/testing/test-config';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

describe('MobileAddTransactionComponent', () => {
  let component: MobileAddTransactionComponent;
  let fixture: ComponentFixture<MobileAddTransactionComponent>;

  beforeEach(async () => {
    await TestSetup.configureTestingModule(
      [MobileAddTransactionComponent], // declarations
      TEST_IMPORTS, // imports
      [
        { provide: MAT_DIALOG_DATA, useValue: {} },
        { provide: MatDialogRef, useValue: { close: () => { } } }
      ] // additional providers
    ).compileComponents();

    fixture = TestBed.createComponent(MobileAddTransactionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
}); 