import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ToastController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import {
  CommuteSettings,
  DEFAULT_COMMUTE_SETTINGS,
} from '../core/models/commute-settings.model';
import { environment } from '../../environments/environment';
import { GoogleRoutesService } from '../services/google-routes.service';
import { SettingsService } from '../services/settings.service';

@Component({
  selector: 'app-tab2',
  templateUrl: 'tab2.page.html',
  styleUrls: ['tab2.page.scss'],
  standalone: false,
})
export class Tab2Page implements OnInit {
  /** Production + Firebase: keys live on the server; hide API key fields. */
  readonly serverKeys = environment.serverInjectedApiKeys;

  model: CommuteSettings = { ...DEFAULT_COMMUTE_SETTINGS };
  homeAddress = '';
  schoolAddress = '';
  muniLinesStr = '';
  bartDestStr = '';
  geocoding = false;

  constructor(
    private readonly settingsService: SettingsService,
    private readonly googleRoutes: GoogleRoutesService,
    private readonly toast: ToastController,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    const saved = this.settingsService.load();
    this.model = saved ? { ...DEFAULT_COMMUTE_SETTINGS, ...saved } : { ...DEFAULT_COMMUTE_SETTINGS };
    this.homeAddress = this.model.homeAddressLabel || '';
    this.schoolAddress = this.model.schoolAddressLabel || '';
    this.muniLinesStr = this.model.muniLines.join(', ');
    this.bartDestStr = this.model.bartEtdDestinations.join(', ');
  }

  async geocodeHome(): Promise<void> {
    await this.geocode('home');
  }

  async geocodeSchool(): Promise<void> {
    await this.geocode('school');
  }

  private async geocode(which: 'home' | 'school'): Promise<void> {
    // Client-side key only when not using Firebase server proxy. With serverKeys (prod),
    // model.googleMapsApiKey is empty — GoogleRoutesService still calls /api/maps-geocode and
    // the Cloud Function injects GOOGLE_MAPS_API_KEY from Secret Manager (never stored in the PWA).
    const key = this.model.googleMapsApiKey?.trim();
    if (!this.serverKeys && !key) {
      void this.showToast('Add a Google Maps API key first.');
      return;
    }
    const addr = which === 'home' ? this.homeAddress.trim() : this.schoolAddress.trim();
    if (!addr) {
      void this.showToast('Enter an address.');
      return;
    }
    this.geocoding = true;
    try {
      const loc = await firstValueFrom(this.googleRoutes.geocodeAddress(addr, key ?? ''));
      if (!loc) {
        void this.showToast('Could not geocode that address.');
        return;
      }
      if (which === 'home') {
        this.model.homeLat = loc.lat;
        this.model.homeLng = loc.lng;
        this.model.homeAddressLabel = addr;
      } else {
        this.model.schoolLat = loc.lat;
        this.model.schoolLng = loc.lng;
        this.model.schoolAddressLabel = addr;
      }
      void this.showToast('Location updated.');
    } finally {
      this.geocoding = false;
    }
  }

  save(): void {
    this.model.homeAddressLabel = this.homeAddress.trim();
    this.model.schoolAddressLabel = this.schoolAddress.trim();
    this.model.muniLines = this.muniLinesStr
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    this.model.bartEtdDestinations = this.bartDestStr
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (!this.model.modeBart && !this.model.modeDrive && !this.model.modeMuni) {
      void this.showToast('Enable at least one mode.');
      return;
    }
    const normalized = this.settingsService.normalize({ ...this.model });
    const issues = this.settingsService.getConfigurationIssues(normalized);
    if (issues.length > 0) {
      void this.showToast(issues.slice(0, 2).join(' '), 4500);
      return;
    }
    this.model = normalized;
    this.settingsService.save(this.model);
    void this.showToast('Saved. Opening Commute…');
    void this.router.navigate(['/tabs/tab1']);
  }

  resetDefaults(): void {
    this.model = { ...DEFAULT_COMMUTE_SETTINGS };
    this.homeAddress = '';
    this.schoolAddress = '';
    this.muniLinesStr = this.model.muniLines.join(', ');
    this.bartDestStr = this.model.bartEtdDestinations.join(', ');
  }

  private async showToast(msg: string, duration = 2200): Promise<void> {
    const t = await this.toast.create({ message: msg, duration, position: 'bottom' });
    await t.present();
  }
}
