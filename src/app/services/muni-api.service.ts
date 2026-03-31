import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import type { CommuteSettings } from '../core/models/commute-settings.model';
import type { MuniBus } from '../core/models/transit.model';

const API_511_PREFIX = '/api/511';

@Injectable({ providedIn: 'root' })
export class MuniApiService {
  constructor(private readonly http: HttpClient) {}

  fetchStopMonitoring(settings: CommuteSettings): Observable<MuniBus[] | null> {
    const apiKey = (settings.api511Key ?? '').trim();
    if (!environment.serverInjectedApiKeys && !apiKey) {
      return of(null);
    }
    let params = new HttpParams()
      .set('agency', (settings.muniAgency ?? '').trim())
      .set('stopCode', String(settings.muniStopId ?? '').trim())
      .set('format', 'json');
    if (!environment.serverInjectedApiKeys) {
      params = params.set('api_key', apiKey);
    }
    const url = `${API_511_PREFIX}/transit/StopMonitoring`;
    return this.http.get(url, { params, responseType: 'text' }).pipe(
      map((text) => this.parseResponse(text, settings)),
      catchError(() => of(null)),
    );
  }

  private parseResponse(text: string, settings: CommuteSettings): MuniBus[] | null {
    try {
      const clean = text.replace(/^\uFEFF/, '');
      const data = JSON.parse(clean) as {
        ServiceDelivery?: {
          StopMonitoringDelivery?: { MonitoredStopVisit?: unknown[] };
        };
      };
      const visits = data.ServiceDelivery?.StopMonitoringDelivery?.MonitoredStopVisit ?? [];
      const lineSet = new Set(settings.muniLines);
      const buses: MuniBus[] = [];
      for (const v of visits) {
        const visit = v as {
          MonitoredVehicleJourney?: {
            LineRef?: string;
            MonitoredCall?: {
              ExpectedDepartureTime?: string;
              AimedDepartureTime?: string;
              ExpectedArrivalTime?: string;
              AimedArrivalTime?: string;
            };
          };
        };
        const journey = visit.MonitoredVehicleJourney;
        if (!journey) {
          continue;
        }
        const lineRef = (journey.LineRef ?? '').replace('SF:', '');
        if (!lineSet.has(lineRef)) {
          continue;
        }
        const call = journey.MonitoredCall;
        const timeStr =
          call?.ExpectedDepartureTime ||
          call?.AimedDepartureTime ||
          call?.ExpectedArrivalTime ||
          call?.AimedArrivalTime;
        if (!timeStr) {
          continue;
        }
        const dt = new Date(timeStr);
        const minsFromNow = Math.round((dt.getTime() - Date.now()) / 60000);
        if (minsFromNow >= -1) {
          buses.push({ line: lineRef, departsAt: dt, minsFromNow });
        }
      }
      buses.sort((a, b) => a.departsAt.getTime() - b.departsAt.getTime());
      return buses.length ? buses.slice(0, 8) : null;
    } catch {
      return null;
    }
  }
}
