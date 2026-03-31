import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import type { CommuteSettings } from '../core/models/commute-settings.model';
import type { BartTrain } from '../core/models/transit.model';

/**
 * Official BART API base: https://api.bart.gov (use HTTPS; summaries like
 * https://publicapi.dev/bay-area-rapid-transit-api use the same paths under /api/*.aspx).
 * Proxied paths: /api/bart + /api/etd.aspx → https://api.bart.gov/api/etd.aspx …
 */
const BART_PREFIX = '/api/bart';

@Injectable({ providedIn: 'root' })
export class BartApiService {
  constructor(private readonly http: HttpClient) {}

  fetchEtd(settings: CommuteSettings): Observable<BartTrain[] | null> {
    const key = (settings.bartApiKey ?? '').trim();
    if (!environment.serverInjectedApiKeys && !key) {
      return of(null);
    }
    const base = `${BART_PREFIX}/api/etd.aspx?cmd=etd&orig=${encodeURIComponent(
      (settings.bartOrigin ?? '').trim(),
    )}&json=y`;
    const url =
      environment.serverInjectedApiKeys
        ? `${base}`
        : `${base}&key=${encodeURIComponent(key)}`;
    return this.http.get<unknown>(url).pipe(
      map((data) => this.parseEtd(data, settings)),
      catchError(() => of(null)),
    );
  }

  fetchTripTime(settings: CommuteSettings): Observable<number> {
    const key = (settings.bartApiKey ?? '').trim();
    if (!environment.serverInjectedApiKeys && !key) {
      return of(30);
    }
    const now = new Date();
    const timeStr = formatBartTime(now);
    const base =
      `${BART_PREFIX}/api/sched.aspx?cmd=depart&orig=${encodeURIComponent(
        (settings.bartOrigin ?? '').trim(),
      )}` +
      `&dest=${encodeURIComponent((settings.bartDestination ?? '').trim())}` +
      `&time=${encodeURIComponent(timeStr)}&date=today&json=y`;
    const url = environment.serverInjectedApiKeys
      ? `${base}&b=0&a=3`
      : `${base}&key=${encodeURIComponent(key)}&b=0&a=3`;
    return this.http.get<unknown>(url).pipe(
      map((data) => this.parseTripMinutes(data)),
      catchError(() => of(30)),
    );
  }

  private parseEtd(data: unknown, settings: CommuteSettings): BartTrain[] | null {
    try {
      const root = (data as { root?: { station?: unknown } }).root;
      const raw = root?.station;
      const stationList = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const station = stationList[0] as { etd?: unknown } | undefined;
      const etdRaw = station?.etd;
      const etds = Array.isArray(etdRaw) ? etdRaw : etdRaw ? [etdRaw] : [];
      const destSet = new Set(settings.bartEtdDestinations);
      const trains: BartTrain[] = [];
      for (const line of etds) {
        const l = line as { destination?: string; estimate?: unknown[] };
        const dest = l.destination ?? '';
        if (!destSet.has(dest)) {
          continue;
        }
        const estRaw = l.estimate;
        const estimates = Array.isArray(estRaw) ? estRaw : estRaw ? [estRaw] : [];
        for (const est of estimates) {
          const e = est as { minutes?: string | number };
          const minsRaw = e.minutes;
          const mins =
            minsRaw === 'Leaving' ? 0 : typeof minsRaw === 'string' ? parseInt(minsRaw, 10) : minsRaw;
          if (typeof mins === 'number' && !isNaN(mins)) {
            trains.push({
              dest,
              minsFromNow: mins,
              departsAt: new Date(Date.now() + mins * 60000),
            });
          }
        }
      }
      trains.sort((a, b) => a.minsFromNow - b.minsFromNow);
      return trains.length ? trains : null;
    } catch {
      return null;
    }
  }

  private parseTripMinutes(data: unknown): number {
    try {
      const trips = (data as { root?: { schedule?: { request?: { trip?: unknown } } } }).root
        ?.schedule?.request?.trip;
      if (!trips) {
        return 30;
      }
      const tripArr = Array.isArray(trips) ? trips : [trips];
      const leg = (tripArr[0] as { leg?: unknown }).leg;
      if (!leg) {
        return 30;
      }
      const legArr = Array.isArray(leg) ? leg : [leg];
      let totalMins = 0;
      for (const raw of legArr) {
        const l = raw as { '@origTimeDate'?: string; '@origTimeMin'?: string; '@destTimeDate'?: string; '@destTimeMin'?: string };
        const orig = new Date(`${l['@origTimeDate'] ?? ''} ${l['@origTimeMin'] ?? ''}`);
        const dest = new Date(`${l['@destTimeDate'] ?? ''} ${l['@destTimeMin'] ?? ''}`);
        totalMins += Math.round((dest.getTime() - orig.getTime()) / 60000);
      }
      return totalMins > 0 ? totalMins : 30;
    } catch {
      return 30;
    }
  }
}

function formatBartTime(d: Date): string {
  const h24 = d.getHours();
  const min = d.getMinutes().toString().padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const ampm = h24 < 12 ? 'am' : 'pm';
  return `${h12}:${min}${ampm}`;
}
