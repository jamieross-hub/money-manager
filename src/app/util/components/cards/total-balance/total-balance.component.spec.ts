import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestSetup } from '../../../testing/test-setup';

import { TotalBalanceComponent } from './total-balance.component';

describe('TotalBalanceComponent', () => {
  let component: TotalBalanceComponent;
  let fixture: ComponentFixture<TotalBalanceComponent>;

  beforeEach(async () => {
    await TestSetup.configureTestingModule([TotalBalanceComponent]).compileComponents();

    fixture = TestBed.createComponent(TotalBalanceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
