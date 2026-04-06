import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FamilyModeInfoSheet } from './family-mode-info-sheet';

describe('FamilyModeInfoSheet', () => {
  let component: FamilyModeInfoSheet;
  let fixture: ComponentFixture<FamilyModeInfoSheet>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FamilyModeInfoSheet]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FamilyModeInfoSheet);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
