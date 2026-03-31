import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { computeCommuteResult } from '../core/commute-engine';
import type { CommuteResult } from '../core/models/commute-result.model';
import type { CommuteSettings } from '../core/models/commute-settings.model';
import { BartApiService } from './bart-api.service';
import { GoogleRoutesService } from './google-routes.service';
import { MuniApiService } from './muni-api.service';

@Injectable({ providedIn: 'root' })
export class CommuteService {
  constructor(
    private readonly bart: BartApiService,
    private readonly muni: MuniApiService,
    private readonly routes: GoogleRoutesService,
  ) {}

  async loadCommute(settings: CommuteSettings): Promise<CommuteResult> {
    const now = new Date();
    const needBart = settings.modeBart;
    const needMuni = settings.modeMuni;
    const needDrive = settings.modeDrive;

    const [buses, trains, bartTripMins, driveTimeMins] = await Promise.all([
      needMuni ? firstValueFrom(this.muni.fetchStopMonitoring(settings)) : Promise.resolve(null),
      needBart ? firstValueFrom(this.bart.fetchEtd(settings)) : Promise.resolve(null),
      needBart ? firstValueFrom(this.bart.fetchTripTime(settings)) : Promise.resolve(30),
      needDrive ? firstValueFrom(this.routes.computeDriveMinutes(settings)) : Promise.resolve(null),
    ]);

    let transitError: string | undefined;
    if (needMuni && needBart && !buses && !trains) {
      transitError = 'Could not load Muni or BART data.';
    } else if (needBart && !trains && settings.modeMuni && settings.modeBart) {
      transitError = 'Could not load BART departures.';
    } else if (needMuni && !buses && !needBart) {
      transitError = 'Could not load Muni data.';
    }

    const result = computeCommuteResult(settings, now, buses, trains, bartTripMins, driveTimeMins);
    if (transitError) {
      result.transitError = transitError;
    }
    return result;
  }
}
