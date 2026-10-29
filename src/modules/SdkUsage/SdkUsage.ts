import { type IRequestInit } from '../ApiClient/ApiClient';

export const KEY_SDK_USAGE_REPORTED_ON = 'sdkUsageReportedOn';

export interface ISdkUsageReport {
  init_keys: string[];
  events: string[];
  legacy_events: string[];
}

export type TSendSdkUsage = (report: ISdkUsageReport, init: IRequestInit) => Promise<unknown>;

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  value !== null && typeof value === 'object' && !Array.isArray(value)
);

// Names of what a site uses, never values, at most one report a day per browser.
export class SdkUsage {
  private readonly initKeys = new Set<string>();
  private readonly events = new Set<string>();
  private readonly legacyEvents = new Set<string>();
  private isListening = false;

  public recordInitParams(params: object): void {
    Object.entries(params).forEach(([key, value]) => {
      this.initKeys.add(key);

      if (isPlainObject(value)) {
        Object.keys(value).forEach((nested) => this.initKeys.add(`${key}.${nested}`));
      }
    });
  }

  public recordEvent(name: string): void {
    this.events.add(name);
  }

  public recordLegacyEvent(name: string): void {
    this.legacyEvents.add(name);
  }

  // Handlers are usually added in onReady, after init, so the report waits for the page to be hidden.
  public listen(send: TSendSdkUsage): void {
    if (this.isListening) {
      return;
    }
    this.isListening = true;

    const flush = () => this.flush(send);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flush();
      }
    });
    window.addEventListener('pagehide', flush);
  }

  public flush(send: TSendSdkUsage): void {
    const today = new Date().toISOString().slice(0, 10);

    try {
      if (localStorage.getItem(KEY_SDK_USAGE_REPORTED_ON) === today) {
        return;
      }
      localStorage.setItem(KEY_SDK_USAGE_REPORTED_ON, today);
    } catch {
      return;
    }

    send({
      init_keys: [...this.initKeys],
      events: [...this.events],
      legacy_events: [...this.legacyEvents],
    }, { keepalive: true }).catch(() => undefined);
  }
}
