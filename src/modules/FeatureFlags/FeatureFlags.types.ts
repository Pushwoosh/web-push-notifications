export interface IFeatureFlagValue {
  enabled: boolean;
  rule_id: string;
  properties: Record<string, unknown>;
}

export interface IFeatureFlagsCache {
  applicationCode: string;
  userId: string;
  flags: Record<string, IFeatureFlagValue>;
  etag: string;
  fetchedAt: number;
  // computed before the device was registered: segment rules could not match it yet
  sentUnregistered?: boolean;
}

// dedup key "<flag_key>|<rule_id>|<enabled>" -> time of the last sent impression
export type TFeatureFlagImpressions = Record<string, number>;

export type TFeatureFlagsUpdateListener = () => void;

export class FeatureFlagsError extends Error {
  // HTTP status of the answer, 0 when the request did not reach the server or was refused locally
  public readonly httpStatus: number;

  constructor(message: string, httpStatus: number) {
    super(message);
    this.name = 'FeatureFlagsError';
    this.httpStatus = httpStatus;
  }
}
