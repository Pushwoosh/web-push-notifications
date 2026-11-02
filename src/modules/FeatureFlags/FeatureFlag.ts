export class FeatureFlag {
  public readonly key: string;
  public readonly enabled: boolean;
  // '' for a killed flag, 'default' when no rule audience matched the device
  public readonly ruleId: string;
  private readonly properties: Readonly<Record<string, unknown>>;

  constructor(key: string, enabled: boolean, ruleId: string, properties: Record<string, unknown>) {
    this.key = key;
    this.enabled = enabled;
    this.ruleId = ruleId;
    this.properties = properties;
  }

  public getString(property: string, defaultValue: string): string {
    const value = this.properties[property];
    return typeof value === 'string' ? value : defaultValue;
  }

  public getNumber(property: string, defaultValue: number): number {
    const value = this.properties[property];
    return typeof value === 'number' && Number.isFinite(value) ? value : defaultValue;
  }

  public getBool(property: string, defaultValue: boolean): boolean {
    const value = this.properties[property];
    return typeof value === 'boolean' ? value : defaultValue;
  }

  public getJson<T = unknown>(property: string, defaultValue: T): T {
    const value = this.properties[property];
    return value === undefined || value === null ? defaultValue : value as T;
  }

  public getProperties(): Record<string, unknown> {
    return { ...this.properties };
  }
}
