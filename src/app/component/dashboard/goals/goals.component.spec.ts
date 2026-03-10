import { ComponentFixture, TestBed } from '@angular/core/testing';
import { GoalsComponent } from './goals.component';
import { TestSetup } from '../../../util/testing/test-setup';

describe('GoalsComponent', () => {
  let component: GoalsComponent;
  let fixture: ComponentFixture<GoalsComponent>;

  beforeEach(async () => {
    await TestSetup.configureTestingModule([GoalsComponent]).compileComponents();

    fixture = TestBed.createComponent(GoalsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
