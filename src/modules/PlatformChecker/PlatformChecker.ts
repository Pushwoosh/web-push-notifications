import { type TPlatform, type TPlatformChrome, type TPlatformEdge, type TPlatformFirefox, type TPlatformSafari } from './PlatformChecker.types';

export class PlatformChecker {
  private readonly global: typeof globalThis;

  private readonly _isSafari: boolean;
  private readonly _isOpera: boolean;
  private readonly _isEdge: boolean;
  private readonly _isFirefox: boolean;
  private readonly _isChrome: boolean;

  private readonly _isMacOS: boolean;

  private readonly _isAvailableServiceWorker: boolean;
  private readonly _isAvailableNotifications: boolean;

  /**
   * Browser name + version
   * Example: "Chrome 70"
   */
  private readonly _browserVersion: string;
  private readonly _platform: TPlatform;

  constructor(global: typeof globalThis) {
    this.global = global;

    this._isSafari = this.isSafariBrowser();
    this._isOpera = this.isOperaBrowser();
    this._isEdge = this.isEdgeBrowser();
    this._isFirefox = this.isFirefoxBrowser();
    this._isChrome = this.isChromeBrowser();

    this._isMacOS = this.isMacOS();

    this._isAvailableServiceWorker = this.canUseServiceWorkers();
    this._isAvailableNotifications = this.canReceiveNotifications();

    this._platform = this.getPlatformType();
    this._browserVersion = this.getBrowserVersion();
  }

  // Platform flags
  get isEdge() {
    return this._isEdge;
  }

  get isSafari() {
    return this._isSafari;
  }

  get isOpera() {
    return this._isOpera;
  }

  get isAvailableServiceWorker() {
    return this._isAvailableServiceWorker;
  }

  get isAvailableNotifications() {
    return this._isAvailableNotifications;
  }

  // Platform values

  get platform() {
    return this._platform;
  }

  get browserVersion() {
    return this._browserVersion;
  }

  isSafariBrowser(): boolean {
    return 'safari' in this.global && navigator.userAgent.indexOf('Safari') > -1;
  }

  isOperaBrowser(): boolean {
    return navigator.userAgent.indexOf('Opera') !== -1 || navigator.userAgent.indexOf('OPR') !== -1;
  }

  isEdgeBrowser(): boolean {
    return navigator.userAgent.indexOf('Edge') > -1;
  }

  isFirefoxBrowser(): boolean {
    return navigator.userAgent.toLowerCase().indexOf('firefox') !== -1;
  }

  isChromeBrowser(): boolean {
    return /Chrome/.test(navigator.userAgent)
      && /Google Inc/.test(navigator.vendor)
      && !this._isOpera
      && !this._isEdge;
  }

  isMacOS(): boolean {
    return 'platform' in navigator && navigator.platform.toLowerCase().indexOf('mac') !== -1;
  }

  canUseServiceWorkers(): boolean {
    return !!navigator.serviceWorker && 'PushManager' in this.global && 'Notification' in this.global;
  }

  /**
   * Check availability ServiceWorker or safari browser on macos
   */
  canReceiveNotifications(): boolean {
    return (this._isSafari && this._isMacOS) || (this._isAvailableServiceWorker && !this._isEdge);
  }

  /**
   * Get Pushwoosh system platform code
   */
  getPlatformType(): TPlatform {
    let platform: TPlatformChrome = 11;

    switch (true) {
      case this._isSafari:
        (<TPlatformSafari>platform) = 10;
        break;

      case this._isOpera || this._isChrome:
        (<TPlatformChrome>platform) = 11;
        break;

      case this._isFirefox:
        (<TPlatformFirefox>platform) = 12;
        break;

      case this._isEdge:
        (<TPlatformEdge>platform) = 150;
        break;
    }

    return platform;
  }

  /**
   * Get browser name + version from userAgent
   */
  getBrowserVersion(): string {
    const { userAgent } = navigator;
    const matchOperaVersion = userAgent.match(/\bOPR\/(\d+)/);
    if (matchOperaVersion !== null) {
      return `Opera ${matchOperaVersion[1]}`;
    }

    const matchEdgeVersion = userAgent.match(/\bEdge\/(\d+)/);
    if (matchEdgeVersion !== null) {
      return `Edge ${matchEdgeVersion[1]}`;
    }

    // edge on chromium
    const matchEdgVersion = userAgent.match(/\bEdg\/(\d+)/);
    if (matchEdgVersion !== null) {
      return `Edge ${matchEdgVersion[1]}`;
    }

    let match = userAgent.match(/(opera|chrome|safari|firefox(?=\/))\/?\s*(\d+)/i) || [];
    const [, browser = ''] = match;

    match = match[2] ? [browser, match[2]] : [navigator.appName, navigator.appVersion, '-?'];
    const version = userAgent.match(/version\/([.\d]+)/i);
    if (version !== null) {
      match.splice(1, 1, version[1]);
    }

    return match.join(' ');
  }
}
