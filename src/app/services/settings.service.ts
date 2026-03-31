import { Injectable } from '@angular/core';
import {
  CommuteSettings,
  DEFAULT_COMMUTE_SETTINGS,
} from '../core/models/commute-settings.model';
import { environment } from '../../environments/environment';

const STORAGE_KEY = 'depart.commute.settings.v1';

@Injectable({ providedIn: 'root' })
export class SettingsService {
  load(): CommuteSettings | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as CommuteSettings;
      return this.normalize({ ...DEFAULT_COMMUTE_SETTINGS, ...parsed });
    } catch {
      return null;
    }
  }

  save(settings: CommuteSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.normalize(settings)));
  }

  /** Trim API keys and IDs so copy/paste whitespace does not break requests. */
  normalize(settings: CommuteSettings): CommuteSettings {
    return {
      ...settings,
      googleMapsApiKey: (settings.googleMapsApiKey ?? '').trim(),
      bartApiKey: (settings.bartApiKey ?? '').trim(),
      api511Key: (settings.api511Key ?? '').trim(),
      bartOrigin: (settings.bartOrigin ?? '').trim(),
      bartDestination: (settings.bartDestination ?? '').trim(),
      bartTransferStation: (settings.bartTransferStation ?? '').trim(),
      muniStopId: String(settings.muniStopId ?? '').trim(),
      muniAgency: (settings.muniAgency ?? '').trim(),
      homeAddressLabel: (settings.homeAddressLabel ?? '').trim(),
      schoolAddressLabel: (settings.schoolAddressLabel ?? '').trim(),
    };
  }

  clear(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  /** Human-readable reasons setup is incomplete (empty array = ready). */
  getConfigurationIssues(settings: CommuteSettings | null): string[] {
    const issues: string[] = [];
    if (!settings) {
      issues.push('Nothing saved yet. On the Setup tab, enter your details and tap Save.');
      return issues;
    }
    if (!settings.modeBart && !settings.modeDrive && !settings.modeMuni) {
      issues.push('Turn on at least one mode: BART, SF Muni, or Drive.');
    }
    const coordsOk =
      Number.isFinite(settings.homeLat) &&
      Number.isFinite(settings.homeLng) &&
      Number.isFinite(settings.schoolLat) &&
      Number.isFinite(settings.schoolLng);
    if (!coordsOk) {
      issues.push(
        environment.serverInjectedApiKeys
          ? 'Home and school need latitude and longitude. Enter numbers, or tap Geocode for each address.'
          : 'Home and school need latitude and longitude. Enter numbers, or add a Google key and tap Geocode for each address.',
      );
    }
    if (!environment.serverInjectedApiKeys && settings.modeDrive && !settings.googleMapsApiKey?.trim()) {
      issues.push('Google Maps API key is required when Drive is enabled (traffic and directions).');
    }
    if (!environment.serverInjectedApiKeys && settings.modeBart && !settings.bartApiKey?.trim()) {
      issues.push('BART API key is required when BART is enabled.');
    }
    if (!environment.serverInjectedApiKeys && settings.modeMuni && !settings.api511Key?.trim()) {
      issues.push('511 API key is required when SF Muni is enabled.');
    }
    return issues;
  }

  isConfigured(settings: CommuteSettings | null): boolean {
    return this.getConfigurationIssues(settings).length === 0;
  }
}
