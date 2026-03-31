import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import { environment } from '../../environments/environment';
import type { CommuteSettings } from '../core/models/commute-settings.model';

const ROUTES_PREFIX = '/api/google-routes';
const GEOCODE_PREFIX = '/api/maps-geocode';

/**
 * Routes API (GA) `computeRoutes` REST path. Proxied to `https://routes.googleapis.com` + this path.
 * This is the current **Routes API**, not the legacy **Directions API**
 * (`https://maps.googleapis.com/maps/api/directions/...`).
 * @see https://developers.google.com/maps/documentation/routes/compute_route_directions
 */
const ROUTES_API_COMPUTE_ROUTES_PATH = '/directions/v2:computeRoutes';

@Injectable({ providedIn: 'root' })
export class GoogleRoutesService {
  constructor(private readonly http: HttpClient) {}

  computeDriveMinutes(settings: CommuteSettings): Observable<number | null> {
    const apiKey = (settings.googleMapsApiKey ?? '').trim();
    if (!environment.serverInjectedApiKeys && !apiKey) {
      return of(null);
    }
    const url = `${ROUTES_PREFIX}${ROUTES_API_COMPUTE_ROUTES_PATH}`;
    // TRAFFIC_AWARE requires departureTime to be strictly in the future; "now" often returns 400
    // (clock skew / processing delay). A short offset still reflects current traffic for "leave soon".
    const departureTime = new Date(Date.now() + 120_000).toISOString();
    const body = {
      origin: {
        location: { latLng: { latitude: settings.homeLat, longitude: settings.homeLng } },
      },
      destination: {
        location: { latLng: { latitude: settings.schoolLat, longitude: settings.schoolLng } },
      },
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_AWARE',
      departureTime,
      regionCode: 'US',
    };
    let headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'X-Goog-FieldMask': 'routes.duration',
    });
    if (!environment.serverInjectedApiKeys) {
      headers = headers.set('X-Goog-Api-Key', apiKey);
    }
    return this.http.post<{ routes?: { duration?: string }[] }>(url, body, { headers }).pipe(
      map((data) => {
        const durationStr = data.routes?.[0]?.duration;
        if (!durationStr) {
          return null;
        }
        const secs = parseInt(String(durationStr).replace('s', ''), 10);
        return Math.ceil(secs / 60);
      }),
      catchError(() => of(null)),
    );
  }

  geocodeAddress(address: string, apiKey: string): Observable<{ lat: number; lng: number } | null> {
    const key = (apiKey ?? '').trim();
    if (!environment.serverInjectedApiKeys && !key) {
      return of(null);
    }
    let params = new HttpParams().set('address', address.trim());
    if (!environment.serverInjectedApiKeys) {
      params = params.set('key', key);
    }
    const url = `${GEOCODE_PREFIX}/maps/api/geocode/json`;
    return this.http.get<unknown>(url, { params }).pipe(
      map((data) => {
        const results = (data as { results?: { geometry?: { location?: { lat: number; lng: number } } }[] })
          .results;
        const loc = results?.[0]?.geometry?.location;
        if (!loc || typeof loc.lat !== 'number' || typeof loc.lng !== 'number') {
          return null;
        }
        return { lat: loc.lat, lng: loc.lng };
      }),
      catchError(() => of(null)),
    );
  }
}
