# Storage Rule

To ensure consistent performance, support for guest mode, and handle large datasets, all persistence **MUST** use `IndexedDB` via `LocalIndexDBStorageService`.

**Direct usage of `localStorage` is STRICTLY FORBIDDEN.**

## Rules

1. **NO `localStorage`**: 
   - Do NOT use `localStorage.getItem()`, `localStorage.setItem()`, or `localStorage.removeItem()`.
   - Exception: `localStorage.clear()` may be used *only* during explicit cache clearing/reset operations to ensure a clean state.

2. **USE `LocalIndexDBStorageService`**:
   - Always inject `LocalIndexDBStorageService`.
   - Use `setItem`, `getItem`, `removeItem`, etc., from this service.
   - This service provides a synchronous-like API (via in-memory cache) while persisting to IndexedDB asynchronously.

3. **Type Safety**:
   - Use `LocalStorageKey` enum for keys.
   - Use `getTyped<T>()` and `setTyped<T>()` when available for better type safety.

## Local-First Architecture (Store-First)

To prevent connection churn, 504 Gateway errors, and maximize offline capability, the application follows a **Local-First** pattern.

1. **STORE IS THE SOURCE OF TRUTH**: 
   - UI components **MUST** consume data exclusively via NgRx Selectors.
   - Selectors should reflect data hydrated from `IndexedDB`.
   
2. **NO REAL-TIME LISTENERS IN UI SERVICES**:
   - Do NOT use `onSnapshot()` in UI-facing services (`TransactionsService`, `SplitwiseService`, etc.).
   - All data fetching for UI display should be cache-first (IndexedDB/Store).

3. **BACKGROUND SYNCHRONIZATION**:
   - Use `PeriodicSyncService` for background pulls.
   - Individual services should implement `pullFromFirestore(userId)` to fetch remote data, update `IndexedDB`, and dispatch to the NgRx store.

4. **OFFLINE-GUEST SUPPORT**:
   - Ensure all data operations check `isGuest()` and use `LocalStorageKeyHelper.getGuestCollectionKey()` to persist data solely to IndexedDB when in guest mode.

## Rationale

- **Performance**: `localStorage` is synchronous and blocks the main thread. `IndexedDB` is asynchronous.
- **Reliability**: Eliminating real-time listeners prevents "Too many listeners" errors and stable UI during network flakiness.
- **Capacity**: `localStorage` has a small quota (usually 5MB). `IndexedDB` allows for much larger storage.
- **Consistency**: Mixing `localStorage` and `IndexedDB` causes synchronization issues and duplicate data.

