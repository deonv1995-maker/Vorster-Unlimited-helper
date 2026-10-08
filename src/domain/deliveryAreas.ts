export type DeliveryArea = string;

export interface DeliveryAreaDefinition {
  name: DeliveryArea;
  color: string;
  textColor: string;
  sortOrder: number;
  isSystem: boolean;
}

export const DELIVERY_AREA_COLOR_PALETTE = [
  '#2E7D32',
  '#A5D6A7',
  '#1565C0',
  '#90CAF9',
  '#7B1FA2',
  '#CE93D8',
  '#EF6C00',
  '#FFB74D',
  '#00838F',
  '#80CBC4',
  '#C62828',
  '#EF9A9A',
  '#6D4C41',
  '#BCAAA4',
  '#546E7A',
  '#B0BEC5',
] as const;

export const DEFAULT_DELIVERY_AREAS: DeliveryAreaDefinition[] = [
  {
    name: 'Pretoria',
    color: '#2E7D32',
    textColor: '#FFFFFF',
    sortOrder: 10,
    isSystem: true,
  },
  {
    name: 'Centurion',
    color: '#A5D6A7',
    textColor: '#1B5E20',
    sortOrder: 20,
    isSystem: true,
  },
  {
    name: 'East Rand',
    color: '#1565C0',
    textColor: '#FFFFFF',
    sortOrder: 30,
    isSystem: true,
  },
  {
    name: 'Alberton',
    color: '#90CAF9',
    textColor: '#0D47A1',
    sortOrder: 40,
    isSystem: true,
  },
  {
    name: 'Other',
    color: '#98A2B3',
    textColor: '#FFFFFF',
    sortOrder: 999,
    isSystem: true,
  },
];

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
  return typeof value === 'string' && value.trim().length > 0;
}

export function getContrastTextColor(backgroundColor: string): string {
  const normalized = backgroundColor.replace('#', '');
  if (!/^[0-9A-F]{6}$/i.test(normalized)) return '#FFFFFF';

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return luminance > 0.62 ? '#101828' : '#FFFFFF';
}

export function findDeliveryAreaDefinition(
  areas: DeliveryAreaDefinition[],
  name: DeliveryArea,
): DeliveryAreaDefinition {
  return (
    areas.find((area) => area.name === name) ?? {
      name,
      color: '#98A2B3',
      textColor: '#FFFFFF',
      sortOrder: 9999,
      isSystem: false,
    }
  );
}
