import type { BartTrain, MuniBus, TransitChainOption } from './transit.model';

export interface DriveSummary {
  driveTimeMins: number | null;
  leaveBy: Date | null;
  status: 'LATE' | 'URGENT' | 'OK' | null;
}

export interface CommuteResult {
  now: Date;
  rockridgeDeadline: Date;
  cpsDeadline: Date;
  bartTripMins: number;
  trains: BartTrain[] | null;
  /** Populated when Muni is enabled (includes Muni-only mode). */
  buses: MuniBus[] | null;
  /** Muni + BART chain options (when both modes on). */
  transitChainOptions: TransitChainOption[];
  /** Direct BART from origin (when BART on, Muni off). */
  bartOnlyOptions: BartOnlyOption[];
  drive: DriveSummary;
  /** Latest leave-by among on-time options (max sleep); same as `recommendations[0]` when non-null. */
  recommendation: Recommendation | null;
  /** All on-time leave-by options, sorted with best (latest leave) first. */
  recommendations: Recommendation[];
  transitError?: string;
}

export interface BartOnlyOption {
  train: BartTrain;
  leaveHome: Date;
  actualArrivalRockridge: Date;
  onTime: boolean;
  canStillCatch: boolean;
}

export interface Recommendation {
  kind: 'transit-chain' | 'bart-only' | 'drive';
  leaveBy: Date;
  label: string;
  detail?: string;
  /** Minutes until leave-by (from commute snapshot time). */
  leaveInMinutes: number;
  /** Drive: traffic estimate. Transit: leave home → Rockridge arrival. */
  tripDurationMins?: number;
}
