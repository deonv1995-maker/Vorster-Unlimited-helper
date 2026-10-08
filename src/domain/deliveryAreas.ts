export const DELIVERY_AREAS = [
  'Pretoria',
  'Centurion',
  'East Rand',
  'Alberton',
  'Other',
] as const;

export type DeliveryArea = (typeof DELIVERY_AREAS)[number];

export interface DeliveryAreaConfig {
  name: DeliveryArea;
  color: string;
  textColor: string;
}

export const DELIVERY_AREA_CONFIG: Record<DeliveryArea, DeliveryAreaConfig> = {
  Pretoria: {
    name: 'Pretoria',
    color: '#2E7D32',
    textColor: '#FFFFFF',
  },
  Centurion: {
    name: 'Centurion',
    color: '#A5D6A7',
    textColor: '#1B5E20',
  },
  'East Rand': {
    name: 'East Rand',
    color: '#1565C0',
    textColor: '#FFFFFF',
  },
  Alberton: {
    name: 'Alberton',
    color: '#90CAF9',
    textColor: '#0D47A1',
  },
  Other: {
    name: 'Other',
    color: '#98A2B3',
    textColor: '#FFFFFF',
  },
};

const containsAny = (value: string, terms: string[]) =>
  terms.some((term) => value.includes(term));

export function inferDeliveryAreaFromAddress(address: string): DeliveryArea {
  const normalized = address.toLocaleLowerCase('en-ZA');

  if (
    containsAny(normalized, [
      'centurion',
      'irene',
      'eldoraigne',
      'lyttelton',
      'rooihuiskraal',
      'wierdapark',
      'heuweloord',
      'amberfield',
      'midstream',
    ])
  ) {
    return 'Centurion';
  }

  if (
    containsAny(normalized, [
      'alberton',
      'brackenhurst',
      'brackendowns',
      'meyersdal',
      'new redruth',
      'raceview',
      'alrode',
      'randhart',
    ])
  ) {
    return 'Alberton';
  }

  if (
    containsAny(normalized, [
      'boksburg',
      'benoni',
      'springs',
      'kempton park',
      'kemptonpark',
      'germiston',
      'brakpan',
      'edenvale',
      'nigel',
      'bedfordview',
    ])
  ) {
    return 'East Rand';
  }

  if (
    containsAny(normalized, [
      'pretoria',
      'lynnwood',
      'menlyn',
      'hatfield',
      'garsfontein',
      'moreleta',
      'silver lakes',
      'faerie glen',
      'equestria',
      'waterkloof',
      'brooklyn',
      'montana',
      'wonderboom',
      'sinoville',
      'gezina',
      'moot',
    ])
  ) {
    return 'Pretoria';
  }

  return 'Other';
}

export function isDeliveryArea(value: unknown): value is DeliveryArea {
  return (
    typeof value === 'string' &&
    DELIVERY_AREAS.some((area) => area === value)
  );
}
