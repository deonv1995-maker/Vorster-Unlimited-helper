import {
  createEmptyJobCard,
  type FulfilmentType,
  type JobCard,
} from '../../domain/jobCard';
import { type LocalDate } from '../../utils/localDate';

export interface PaperJobCardImportSuccess {
  ok: true;
  job: JobCard;
  warnings: string[];
}

export type PaperJobCardImportResult =
  | PaperJobCardImportSuccess
  | { ok: false; message: string };

const SELLER_MARKERS = [
  'DK POTS ONE CC',
  'VORSTER UNLIMITED TRADING',
  'ROCK POTS',
  'OUR ACCOUNT DETAILS',
  'ABSA',
  'ACC NUMBER',
  'VAT NO',
];

const STOP_ADDRESS_MARKERS = [
  'PAY BEFORE',
  'DESCRIPTION',
  'QUANTITY',
  'UNIT PRICE',
  'EXCL. PRICE',
  'DISC %',
  'VAT %',
  'CUSTOMER VAT',
  'TOTAL DISCOUNT',
  'BALANCE DUE',
];

const normalizeLine = (value: string) =>
  value
    .replace(/\s+/g, ' ')
    .replace(/[|]/g, 'I')
    .trim();

const normalizeUpper = (value: string) => normalizeLine(value).toUpperCase();

const linesFromText = (text: string) =>
  text
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(Boolean);

const stripLabel = (line: string, label: string) => {
  const normalized = normalizeUpper(line);
  const labelUpper = label.toUpperCase();

  if (!normalized.startsWith(labelUpper)) return null;

  const originalRemainder = line.slice(label.length).replace(/^\s*:?\s*/, '').trim();
  return originalRemainder;
};

const findLabelValue = (
  lines: string[],
  labels: string[],
  maxLookAhead = 2,
): string | null => {
  for (let index = 0; index < lines.length; index += 1) {
    for (const label of labels) {
      const remainder = stripLabel(lines[index] ?? '', label);
      if (remainder === null) continue;
      if (remainder) return remainder;

      for (
        let offset = 1;
        offset <= maxLookAhead && index + offset < lines.length;
        offset += 1
      ) {
        const candidate = lines[index + offset] ?? '';
        if (candidate && !candidate.endsWith(':')) return candidate;
      }
    }
  }

  return null;
};

const parseSouthAfricanDate = (value: string | null): LocalDate | null => {
  if (!value) return null;

  const match = value.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})\b/);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);

  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const candidate = new Date(year, month - 1, day, 12, 0, 0, 0);
  if (
    candidate.getFullYear() !== year ||
    candidate.getMonth() !== month - 1 ||
    candidate.getDate() !== day
  ) {
    return null;
  }

  return [
    String(year).padStart(4, '0'),
    String(month).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-');
};

const parseMoneyToCents = (value: string): number | null => {
  const match = value.match(/R?\s*([0-9][0-9\s,]*)(?:[.,](\d{2}))\b/i);
  if (!match) return null;

  const whole = (match[1] ?? '').replace(/[\s,]/g, '');
  const cents = match[2] ?? '00';
  const amount = Number(`${whole}.${cents}`);

  return Number.isFinite(amount) ? Math.round(amount * 100) : null;
};

const findMoneyNearLabel = (
  lines: string[],
  labels: string[],
): number | null => {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const upper = normalizeUpper(lines[index] ?? '');
    const label = labels.find((candidate) => upper.includes(candidate));

    if (!label) continue;

    const sameLine = parseMoneyToCents(lines[index] ?? '');
    if (sameLine !== null) return sameLine;

    for (let offset = 1; offset <= 2 && index + offset < lines.length; offset += 1) {
      const nextLine = lines[index + offset] ?? '';
      const amount = parseMoneyToCents(nextLine);
      if (amount !== null) return amount;
    }
  }

  return null;
};

const cleanReferenceNumber = (value: string | null, fullText: string) => {
  const candidates = [value, ...fullText.matchAll(/\b(?:QU|JC|Q)[A-Z0-9-]{5,}\b/gi)]
    .map((candidate) =>
      typeof candidate === 'string' || candidate === null
        ? candidate
        : candidate[0],
    )
    .filter((candidate): candidate is string => Boolean(candidate))
    .map((candidate) =>
      candidate
        .toUpperCase()
        .replace(/[^A-Z0-9-]/g, '')
        .trim(),
    );

  return candidates.find((candidate) => /\d/.test(candidate)) ?? '';
};

const cleanCustomerName = (value: string) =>
  value
    .replace(/^TO\s*:?[\s-]*/i, '')
    .replace(/\s*:[A-Z0-9-]{2,}\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const isPlausibleCustomerName = (value: string) => {
  const upper = normalizeUpper(value);

  if (value.length < 3) return false;
  if (!/[A-Z]/i.test(value)) return false;
  if (/^R?[\d\s,.]+$/.test(value)) return false;
  if (value.includes('@')) return false;
  if (SELLER_MARKERS.some((marker) => upper.includes(marker))) return false;
  if (
    /^(NUMBER|REFERENCE|DATE|DUE DATE|PAGE|SALES REP|PHYSICAL ADDRESS|POSTAL ADDRESS)/.test(
      upper,
    )
  ) {
    return false;
  }

  return true;
};

const findCustomerName = (lines: string[]): string => {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const upper = normalizeUpper(line);

    if (upper === 'TO' || upper === 'TO:') {
      for (let offset = 1; offset <= 3 && index + offset < lines.length; offset += 1) {
        const candidate = cleanCustomerName(lines[index + offset] ?? '');
        if (isPlausibleCustomerName(candidate)) return candidate;
      }
    }

    if (/^TO\s*:?\s+/.test(upper)) {
      const candidate = cleanCustomerName(line);
      if (isPlausibleCustomerName(candidate)) return candidate;
    }
  }

  const customerVatIndex = lines.findIndex((line) =>
    normalizeUpper(line).includes('CUSTOMER VAT'),
  );

  if (customerVatIndex > 0) {
    for (
      let index = customerVatIndex - 1;
      index >= Math.max(0, customerVatIndex - 8);
      index -= 1
    ) {
      const candidate = cleanCustomerName(lines[index] ?? '');
      if (isPlausibleCustomerName(candidate)) return candidate;
    }
  }

  return '';
};

const findCustomerStartIndex = (lines: string[], customerName: string) => {
  if (!customerName) return -1;

  const target = normalizeUpper(customerName);
  return lines.findIndex((line) => normalizeUpper(line).includes(target));
};

const findLocation = (lines: string[], customerName: string): string => {
  const customerIndex = findCustomerStartIndex(lines, customerName);
  const start = customerIndex >= 0 ? customerIndex : 0;
  const end = Math.min(lines.length, start + 18);

  for (let index = start; index < end; index += 1) {
    const line = lines[index] ?? '';
    const upper = normalizeUpper(line);
    const markerIndex = upper.indexOf('PHYSICAL ADDRESS');

    if (markerIndex < 0) continue;

    const colonIndex = line.indexOf(':', markerIndex);
    const sameLineValue =
      colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : '';

    const addressParts: string[] = [];
    if (sameLineValue && !/POSTAL ADDRESS/i.test(sameLineValue)) {
      addressParts.push(sameLineValue);
    }

    for (
      let offset = 1;
      offset <= 5 && index + offset < lines.length;
      offset += 1
    ) {
      const candidate = lines[index + offset] ?? '';
      const candidateUpper = normalizeUpper(candidate);

      if (
        STOP_ADDRESS_MARKERS.some((marker) => candidateUpper.includes(marker)) ||
        candidate.includes('@') ||
        /^TO\b/.test(candidateUpper)
      ) {
        break;
      }

      if (!/^(POSTAL ADDRESS|PHYSICAL ADDRESS)\s*:?$/i.test(candidate)) {
        addressParts.push(candidate);
      }
    }

    const uniqueParts = [...new Set(addressParts.map(normalizeLine).filter(Boolean))];
    if (uniqueParts.length) return uniqueParts.join(', ');
  }

  return '';
};

const inferFulfilmentType = (text: string): FulfilmentType => {
  const upper = normalizeUpper(text);

  return /\b(?:DEL|DF)\s*-\s*DELIVERY FEE\b/.test(upper) ||
    /\bDELIVERY FEE\b/.test(upper)
    ? 'Delivery'
    : 'Collection';
};

export function parsePaperJobCardText(text: string): PaperJobCardImportResult {
  const lines = linesFromText(text);
  const normalizedText = lines.join('\n');
  const upper = normalizeUpper(normalizedText);

  if (!/\bJOBCARD\b|\bJOB CARD\b|\bQUOTE\b/.test(upper)) {
    return {
      ok: false,
      message: 'This photo does not look like a supported job card or quote.',
    };
  }

  const referenceNumber = cleanReferenceNumber(
    findLabelValue(lines, ['NUMBER']),
    normalizedText,
  );

  if (!referenceNumber) {
    return {
      ok: false,
      message: 'I could not read the job card or quote number. Retake the photo closer.',
    };
  }

  const warnings: string[] = [];
  const job = createEmptyJobCard();

  const dateMade =
    parseSouthAfricanDate(findLabelValue(lines, ['DATE'])) ?? job.dateMade;
  const customerName = findCustomerName(lines);
  const location = findLocation(lines, customerName);
  const amountCents =
    findMoneyNearLabel(lines, ['BALANCE DUE', 'GRAND TOTAL', 'TOTAL DUE']) ?? 0;
  const fulfilmentType = inferFulfilmentType(normalizedText);

  if (!customerName) {
    warnings.push('Customer name was not read. Please enter it before saving.');
  }

  if (!location) {
    warnings.push('Customer location was not read. Please check it before saving.');
  }

  if (amountCents === 0) {
    warnings.push('Total amount could not be confirmed. Please check the amount.');
  }

  if (fulfilmentType === 'Collection') {
    warnings.push(
      'No delivery-fee marker was detected, so Collection was selected. Please confirm it.',
    );
  }

  return {
    ok: true,
    warnings,
    job: {
      ...job,
      dateMade,
      customerName,
      referenceNumber,
      fulfilmentType,
      location,
      amountCents,
      // Printed "Due Date" is an accounting/document field, not our operational
      // delivery date. Delivery date is deliberately left for the user to choose.
      deliveryDate: null,
      status: 'Pending',
    },
  };
}
