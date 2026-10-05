export interface AdminRate {
  id: string;
  name: string;
  /** Whole taka as typed in the form, for example "80" or "1,250.50". */
  rate: string;
  freeOver: string;
  minDays: number;
  maxDays: number;
  codAllowed: boolean;
  isActive: boolean;
}

export interface AdminZone {
  id: string;
  name: string;
  isFallback: boolean;
  isActive: boolean;
  geoAreaIds: string[];
  /** Names of the areas the zone covers, for the summary line. */
  coverage: string[];
  rates: AdminRate[];
}
