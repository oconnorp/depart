/** User-configurable commute settings (stored in localStorage). */
export interface CommuteSettings {
  homeLat: number;
  homeLng: number;
  homeAddressLabel: string;
  schoolLat: number;
  schoolLng: number;
  schoolAddressLabel: string;
  /** Arrival at school (e.g. first bell). */
  schoolArrivalHour: number;
  schoolArrivalMinute: number;
  /** BART station to reach before transfer (e.g. Rockridge). */
  bartTransferStation: string;
  bartArrivalHour: number;
  bartArrivalMinute: number;
  modeBart: boolean;
  modeDrive: boolean;
  modeMuni: boolean;
  bartOrigin: string;
  bartDestination: string;
  /** BART ETD destinations to treat as toward transfer (e.g. Richmond, Antioch). */
  bartEtdDestinations: string[];
  muniStopId: string;
  muniAgency: string;
  muniLines: string[];
  walkToBusMins: number;
  busRideMins: number;
  busToBartWalkMins: number;
  /** Minutes from home to BART origin station (used when Muni is off). */
  walkToBartMins: number;
  googleMapsApiKey: string;
  bartApiKey: string;
  api511Key: string;
}

export const DEFAULT_COMMUTE_SETTINGS: CommuteSettings = {
  homeLat: 37.7511,
  homeLng: -122.4149,
  homeAddressLabel: '',
  schoolLat: 37.8124,
  schoolLng: -122.2328,
  schoolAddressLabel: '',
  schoolArrivalHour: 8,
  schoolArrivalMinute: 10,
  bartTransferStation: 'ROCK',
  bartArrivalHour: 8,
  bartArrivalMinute: 5,
  modeBart: true,
  modeDrive: true,
  modeMuni: true,
  bartOrigin: '24TH',
  bartDestination: 'ROCK',
  bartEtdDestinations: ['Richmond', 'Antioch', 'Pittsburg/Bay Point'],
  muniStopId: '15741',
  muniAgency: 'SF',
  muniLines: ['12', '14', '49', '14R', '49R'],
  walkToBusMins: 4,
  busRideMins: 5,
  busToBartWalkMins: 2,
  walkToBartMins: 15,
  googleMapsApiKey: '',
  bartApiKey: '',
  api511Key: '',
};
