import { Injectable, signal, computed, Signal } from '@angular/core';

export interface FooterAction {
  id: string;
  icon: string | Signal<string>;
  label: string | Signal<string>;
  route?: string;
  action?: () => void;
  show?: boolean | (() => boolean);
  isFab?: boolean;
  bgClass?: string;
  badge?: string | number | Signal<string | number>;
  priority?: number;
}

export interface FooterConfig {
  items?: FooterAction[];
  fab?: FooterAction;
  hideFooter?: boolean;
  hideFab?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FooterService {
  private configSignal = signal<FooterConfig | null>(null);

  /** Current active footer configuration */
  readonly currentConfig = computed(() => this.configSignal());

  /** 
   * Set a custom footer configuration (usually called in ngOnInit of a page component)
   */
  setConfig(config: FooterConfig | null) {
    this.configSignal.set(config);
  }

  /**
   * Reset the footer to its default state
   */
  resetConfig() {
    this.configSignal.set(null);
  }

  /**
   * Patch the current configuration with partial updates
   */
  patchConfig(patch: Partial<FooterConfig>) {
    const current = this.configSignal() || {};
    this.configSignal.set({ ...current, ...patch } as FooterConfig);
  }
}
