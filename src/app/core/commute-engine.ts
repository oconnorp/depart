import type { CommuteSettings } from './models/commute-settings.model';
import type {
  BartOnlyOption,
  CommuteResult,
  Recommendation,
} from './models/commute-result.model';
import type { BartTrain, MuniBus, TransitChainOption } from './models/transit.model';

export function deadlineDate(h: number, m: number, ref: Date): Date {
  const d = new Date(ref);
  d.setHours(h, m, 0, 0);
  return d;
}

function leaveInMinutes(now: Date, leaveBy: Date): number {
  return Math.round((leaveBy.getTime() - now.getTime()) / 60000);
}

/** All on-time leave-by options (same rules as the former single “best” pick), best = latest leave first. */
export function buildRecommendations(result: CommuteResult): Recommendation[] {
  const candidates: Recommendation[] = [];
  const now = result.now;

  for (const opt of result.transitChainOptions) {
    if (opt.onTime && opt.leaveHome.getTime() > now.getTime()) {
      const tripDurationMins = Math.round(
        (opt.actualArrivalRockridge.getTime() - opt.leaveHome.getTime()) / 60000,
      );
      candidates.push({
        leaveBy: opt.leaveHome,
        kind: 'transit-chain',
        label: 'Transit (Muni + BART)',
        detail: `Bus ${opt.bus.line} then BART`,
        leaveInMinutes: leaveInMinutes(now, opt.leaveHome),
        tripDurationMins,
      });
    }
  }

  for (const opt of result.bartOnlyOptions) {
    if (opt.onTime && opt.canStillCatch) {
      const tripDurationMins = Math.round(
        (opt.actualArrivalRockridge.getTime() - opt.leaveHome.getTime()) / 60000,
      );
      candidates.push({
        leaveBy: opt.leaveHome,
        kind: 'bart-only',
        label: 'BART',
        detail: `Train toward ${opt.train.dest}`,
        leaveInMinutes: leaveInMinutes(now, opt.leaveHome),
        tripDurationMins,
      });
    }
  }

  if (result.drive.leaveBy && result.drive.status !== 'LATE') {
    const leaveBy = result.drive.leaveBy;
    const tripDurationMins = result.drive.driveTimeMins ?? undefined;
    candidates.push({
      leaveBy,
      kind: 'drive',
      label: 'Drive',
      detail: `${result.drive.driveTimeMins ?? 0} min with traffic`,
      leaveInMinutes: leaveInMinutes(now, leaveBy),
      tripDurationMins,
    });
  }

  candidates.sort((a, b) => b.leaveBy.getTime() - a.leaveBy.getTime());
  return candidates;
}

export function pickRecommendation(
  result: CommuteResult,
  _settings: CommuteSettings,
): Recommendation | null {
  const list = buildRecommendations(result);
  return list[0] ?? null;
}

export function computeCommuteResult(
  settings: CommuteSettings,
  now: Date,
  buses: MuniBus[] | null,
  trains: BartTrain[] | null,
  bartTripMins: number,
  driveTimeMins: number | null,
): CommuteResult {
  const rockridgeDeadline = deadlineDate(settings.bartArrivalHour, settings.bartArrivalMinute, now);
  const cpsDeadline = deadlineDate(settings.schoolArrivalHour, settings.schoolArrivalMinute, now);

  const transitChainOptions: TransitChainOption[] = [];
  if (settings.modeMuni && settings.modeBart && buses) {
    for (const bus of buses) {
      const arriveAt24th = new Date(bus.departsAt.getTime() + settings.busRideMins * 60000);
      const leaveHome = new Date(bus.departsAt.getTime() - settings.walkToBusMins * 60000);
      const canStillCatch = leaveHome > now;
      const bartDeparture = new Date(arriveAt24th.getTime() + settings.busToBartWalkMins * 60000);
      let matchedTrain: BartTrain | null = null;
      if (trains) {
        for (const t of trains) {
          if (t.departsAt >= bartDeparture) {
            matchedTrain = t;
            break;
          }
        }
      }
      const actualArrivalRockridge = matchedTrain
        ? new Date(matchedTrain.departsAt.getTime() + bartTripMins * 60000)
        : new Date(bartDeparture.getTime() + bartTripMins * 60000);
      if (canStillCatch) {
        transitChainOptions.push({
          bus,
          leaveHome,
          arriveAt24th,
          bartDeparture,
          matchedTrain,
          actualArrivalRockridge,
          onTime: actualArrivalRockridge <= rockridgeDeadline,
        });
      }
    }
  }

  transitChainOptions.sort((a, b) => a.leaveHome.getTime() - b.leaveHome.getTime());

  const bartOnlyOptions: BartOnlyOption[] = [];
  if (settings.modeBart && !settings.modeMuni && trains) {
    const walkMs = settings.walkToBartMins * 60000;
    for (const t of trains) {
      const leaveHome = new Date(t.departsAt.getTime() - walkMs);
      const actualArrivalRockridge = new Date(t.departsAt.getTime() + bartTripMins * 60000);
      const canStillCatch = leaveHome > now;
      bartOnlyOptions.push({
        train: t,
        leaveHome,
        actualArrivalRockridge,
        onTime: actualArrivalRockridge <= rockridgeDeadline,
        canStillCatch,
      });
    }
    bartOnlyOptions.sort((a, b) => a.leaveHome.getTime() - b.leaveHome.getTime());
  }

  let driveLeaveBy: Date | null = null;
  let driveStatus: 'LATE' | 'URGENT' | 'OK' | null = null;
  if (settings.modeDrive && driveTimeMins !== null) {
    driveLeaveBy = new Date(cpsDeadline.getTime() - driveTimeMins * 60000);
    const minsUntilLeave = Math.round((driveLeaveBy.getTime() - now.getTime()) / 60000);
    driveStatus = minsUntilLeave < 0 ? 'LATE' : minsUntilLeave < 5 ? 'URGENT' : 'OK';
  }

  const drive = {
    driveTimeMins,
    leaveBy: driveLeaveBy,
    status: driveStatus,
  };

  const base: CommuteResult = {
    now,
    rockridgeDeadline,
    cpsDeadline,
    bartTripMins,
    trains,
    buses,
    transitChainOptions,
    bartOnlyOptions,
    drive,
    recommendation: null,
    recommendations: [],
  };

  base.recommendations = buildRecommendations(base);
  base.recommendation = base.recommendations[0] ?? null;
  return base;
}
