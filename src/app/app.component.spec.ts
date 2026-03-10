import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { TestSetup } from './util/testing/test-setup';
import { TEST_IMPORTS } from './util/testing/test-config';
import { ThemeSwitchingService } from './util/service/theme-switching.service';
import { Location } from '@angular/common';
import { LoaderService } from './util/service/loader.service';
import { PwaNavigationService } from './util/service/pwa-navigation.service';
import { CommonSyncService } from './util/service/common-sync.service';
import { SsrService } from './util/service/ssr.service';
import { FirebaseMessagingService } from './util/service/firebase-messaging.service';
import { of } from 'rxjs';

describe('AppComponent', () => {
  let mockThemeSwitchingService: jasmine.SpyObj<ThemeSwitchingService>;
  let mockLocation: jasmine.SpyObj<Location>;
  let mockLoaderService: jasmine.SpyObj<LoaderService>;
  let mockPwaNavigationService: jasmine.SpyObj<PwaNavigationService>;
  let mockCommonSyncService: jasmine.SpyObj<CommonSyncService>;
  let mockSsrService: jasmine.SpyObj<SsrService>;
  let mockFirebaseMessagingService: jasmine.SpyObj<FirebaseMessagingService>;

  beforeEach(async () => {
    // We can still create custom spies if we want specifically controlled behavior,
    // but TestSetup.configureTestingModule will provide default mocks for anything missing.
    const firebaseSpy = jasmine.createSpyObj('FirebaseMessagingService', ['listenForMessages', 'refreshToken']);
    firebaseSpy.refreshToken.and.returnValue(Promise.resolve('mock-token'));

    await TestSetup.configureTestingModule(
      [AppComponent],
      TEST_IMPORTS,
      [
        { provide: FirebaseMessagingService, useValue: firebaseSpy }
      ],
      false // useActualFirebase = false for now to keep unit tests isolated, unless the user specifically wants them live.
    ).compileComponents();

    mockThemeSwitchingService = TestBed.inject(ThemeSwitchingService) as jasmine.SpyObj<ThemeSwitchingService>;
    mockLocation = TestBed.inject(Location) as jasmine.SpyObj<Location>;
    mockLoaderService = TestBed.inject(LoaderService) as jasmine.SpyObj<LoaderService>;
    mockPwaNavigationService = TestBed.inject(PwaNavigationService) as jasmine.SpyObj<PwaNavigationService>;
    mockCommonSyncService = TestBed.inject(CommonSyncService) as jasmine.SpyObj<CommonSyncService>;
    mockSsrService = TestBed.inject(SsrService) as jasmine.SpyObj<SsrService>;
    mockFirebaseMessagingService = TestBed.inject(FirebaseMessagingService) as jasmine.SpyObj<FirebaseMessagingService>;
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it(`should have as title 'Money Manager'`, () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('Money Manager');
  });

  it('should initialize PWA features', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    
    app.ngOnInit();
    
    expect(mockFirebaseMessagingService.listenForMessages).toHaveBeenCalled();
  });

  it('should handle navigation methods', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    
    app.goBack();
    expect(mockPwaNavigationService.goBack).toHaveBeenCalled();
    
    app.goForward();
    expect(mockPwaNavigationService.goForward).toHaveBeenCalled();
  });

  it('should cleanup on destroy', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    
    app.ngOnDestroy();
    
    expect(mockPwaNavigationService.ngOnDestroy).toHaveBeenCalled();
  });
});
