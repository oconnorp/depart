import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ViewWillEnter } from '@ionic/angular';
import { Subscription, interval } from 'rxjs';
import type { CommuteResult, Recommendation } from '../core/models/commute-result.model';
import type { CommuteSettings } from '../core/models/commute-settings.model';
import type { BartTrain, MuniBus, TransitChainOption } from '../core/models/transit.model';
import { CommuteService } from '../services/commute.service';
import { SettingsService } from '../services/settings.service';
import { formatTime, formatTimeParts } from '../utils/time';

@Component({
  selector: 'app-tab1',
  templateUrl: 'tab1.page.html',
  styleUrls: ['tab1.page.scss'],
  standalone: false,
})
export class Tab1Page implements OnInit, OnDestroy, ViewWillEnter {
  settings: CommuteSettings | null = null;
  /** Shown on welcome card when setup is incomplete. */
  setupIssues: string[] = [];
  result: CommuteResult | null = null;
  loading = true;
  error: string | null = null;
  private sub?: Subscription;

  constructor(
    readonly settingsService: SettingsService,
    private readonly commuteService: CommuteService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.sub = interval(60_000).subscribe(() => void this.refresh());
  }

  ionViewWillEnter(): void {
    this.settings = this.settingsService.load();
    this.setupIssues = this.settingsService.getConfigurationIssues(this.settings);
    if (!this.settingsService.isConfigured(this.settings)) {
      this.loading = false;
      this.result = null;
      this.error = null;
      return;
    }
    void this.refresh();
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  async refresh(): Promise<void> {
    const s = this.settingsService.load();
    this.settings = s;
    if (!s || !this.settingsService.isConfigured(s)) {
      this.loading = false;
      return;
    }
    this.loading = true;
    this.error = null;
    try {
      this.result = await this.commuteService.loadCommute(s);
    } catch (e) {
      this.error = e instanceof Error ? e.message : 'Could not load commute.';
    } finally {
      this.loading = false;
    }
  }

  async doRefresh(ev: CustomEvent): Promise<void> {
    await this.refresh();
    const target = ev.target as HTMLIonRefresherElement;
    target.complete();
  }

  goSetup(): void {
    void this.router.navigate(['/tabs/tab2']);
  }

  mapsDriveUrl(): string {
    const s = this.settings;
    if (!s) {
      return '#';
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${s.homeLat},${s.homeLng}&destination=${s.schoolLat},${s.schoolLng}&travelmode=driving`;
  }

  fmt = formatTime;
  deadlineLabel = formatTimeParts;

  rockridgeAfterTrain(t: BartTrain, bartTripMins: number): string {
    return formatTime(new Date(t.departsAt.getTime() + bartTripMins * 60000));
  }

  leaveMins(deltaMs: number): number {
    return Math.round(deltaMs / 60000);
  }

  transitStatus(opt: TransitChainOption): 'NOW' | 'SOON' | 'OK' {
    const m = this.leaveMins(opt.leaveHome.getTime() - (this.result?.now ?? new Date()).getTime());
    if (m <= 0) {
      return 'NOW';
    }
    if (m <= 5) {
      return 'SOON';
    }
    return 'OK';
  }

  trainRows(trains: BartTrain[] | null, max = 3): BartTrain[] {
    if (!trains?.length) {
      return [];
    }
    return trains.slice(0, max);
  }

  muniRows(buses: MuniBus[] | null, max = 6): MuniBus[] {
    if (!buses?.length) {
      return [];
    }
    return buses.slice(0, max);
  }

  /** Human-readable trip duration for comparing options (drive vs transit to Rockridge). */
  tripDurationLine(rec: Recommendation): string | null {
    if (rec.tripDurationMins == null) {
      return null;
    }
    if (rec.kind === 'drive') {
      return `${rec.tripDurationMins} min with traffic`;
    }
    return `~${rec.tripDurationMins} min to Rockridge`;
  }
}
