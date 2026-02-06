import { TestBed } from '@angular/core/testing';
import { LocalStorageService } from './local-storage.service';

describe('LocalStorageService (Hybrid)', () => {
    let service: LocalStorageService;

    const mockIndexedDB = {
        open: jasmine.createSpy('open').and.returnValue({
            result: {
                objectStoreNames: { contains: () => false },
                createObjectStore: jasmine.createSpy('createObjectStore'),
                transaction: jasmine.createSpy('transaction').and.returnValue({
                    objectStore: jasmine.createSpy('objectStore').and.returnValue({
                        put: jasmine.createSpy('put'),
                        delete: jasmine.createSpy('delete'),
                        clear: jasmine.createSpy('clear'),
                        count: jasmine.createSpy('count').and.returnValue({
                            onsuccess: null,
                            result: 0
                        }),
                        openCursor: jasmine.createSpy('openCursor').and.returnValue({
                            onsuccess: null
                        })
                    }),
                    oncomplete: null,
                    onerror: null
                })
            },
            onerror: null,
            onsuccess: null,
            onupgradeneeded: null
        })
    };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [LocalStorageService]
        });
        service = TestBed.inject(LocalStorageService);

        // Mock the internal openDatabase to avoid real IDB in unit tests if needed, 
        // or we can test with real IDB if the environment supports it. 
        // For now, let's try to trust the browser environment or use a simple spy for persistence.

        // Override persistence method to spy on it
        spyOn<any>(service, 'persistItem').and.returnValue(Promise.resolve());
        spyOn<any>(service, 'deleteItem').and.returnValue(Promise.resolve());
        spyOn<any>(service, 'clearDb').and.returnValue(Promise.resolve());
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should initialize and load cache', async () => {
        // Mock loadCacheFromDb to simulate data loaded
        spyOn<any>(service, 'loadCacheFromDb').and.callFake(() => {
            (service as any).cache.set('test-init', 'loaded');
            return Promise.resolve();
        });
        spyOn<any>(service, 'openDatabase').and.returnValue(Promise.resolve());

        await service.initialize();
        expect(service.getItem('test-init')).toBe('loaded');
    });

    it('should set item synchronously updates cache', () => {
        service.setItem('test-key', 'test-value');
        expect((service as any).cache.get('test-key')).toBe('test-value');
        expect(service.getItem('test-key')).toBe('test-value');
    });

    it('should persist item asynchronously', () => {
        service.setItem('test-key', 'test-value');
        expect((service as any).persistItem).toHaveBeenCalledWith('test-key', 'test-value');
    });

    it('should get item synchronously from cache', () => {
        (service as any).cache.set('test-key', 'cached-value');
        const value = service.getItem('test-key');
        expect(value).toBe('cached-value');
    });

    it('should remove item synchronously from cache and trigger async delete', () => {
        (service as any).cache.set('test-key', 'to-remove');
        service.removeItem('test-key');
        expect((service as any).cache.has('test-key')).toBeFalse();
        expect(service.getItem('test-key')).toBeNull();
        expect((service as any).deleteItem).toHaveBeenCalledWith('test-key');
    });

    it('should clear cache and trigger async clear', () => {
        (service as any).cache.set('key1', 'val1');
        (service as any).cache.set('key2', 'val2');

        service.clear();

        expect((service as any).cache.size).toBe(0);
        expect((service as any).clearDb).toHaveBeenCalled();
    });

    it('should return all keys from cache', () => {
        (service as any).cache.set('key1', 'val1');
        (service as any).cache.set('key2', 'val2');

        const keys = service.getAllKeys();
        expect(keys).toContain('key1');
        expect(keys).toContain('key2');
        expect(keys.length).toBe(2);
    });
});
