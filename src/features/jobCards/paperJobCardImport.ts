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
];

const CUSTOMER_REJECT_MARKERS = [
  'CALL BEFORE',
  'PAY BEFORE',
  'DELIVERY FEE',
  'CUSTOMER VAT',
  'PHYSICAL ADDRESS',
  'POSTAL ADDRESS',
  'NUMBER',
  'REFERENCE',
  'DATE',
  'DUE DATE',
  'PAGE',
  'SALES REP',
  'OVERALL DISCOUNT',
  'DESCRIPTION',
  'QUANTITY',
  'UNIT PRICE',
  'EXCL. PRICE',
  'BALANCE DUE',
  'GRAND TOTAL',
  'TOTAL DUE',
];

const ADDRESS_STOP_MARKERS = [
  'DESCRIPTION',
  'QUANTITY',
  'UNIT PRICE',
  'EXCL. PRICE',
  'DISC %',
  'VAT %',
  'TOTAL DISCOUNT',
  'BALANCE DUE',
  'GRAND TOTAL',
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

  return line.slice(label.length).replace(/^\s*:?\s*/, '').trim();
};

const findLabelValue = (
  lines: string[],
  labels: string[],
  maxLookAhead = 4,
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
        const candidateUpper = normalizeUpper(candidate);

        if (
          candidate &&
          !candidate.endsWith(':') &&
          !CUSTOMER_REJECT_MARKERS.some((marker) => candidateUpper === marker)
        ) {
          return candidate;
        }
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

    for (let offset = 1; offset <= 3 && index + offset < lines.length; offset += 1) {
      const amount = parseMoneyToCents(lines[index + offset] ?? '');
      if (amount !== null) return amount;
    }
  }

  return null;
};

const meaningfulTrailingDigits = (value: string): string => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const digitMatch = compact.match(/(\d+)$/);
  if (!digitMatch) return '';

  const digits = digitMatch[1] ?? '';
  const withoutLeadingZeros = digits.replace(/^0+(?=\d)/, '');
  return withoutLeadingZeros || '0';
};

const findReferenceNumber = (lines: string[], fullText: string): string => {
  const directCandidates = [
    ...fullText.matchAll(/\bQ\s*U\s*0*\d{1,12}\b/gi),
    ...fullText.matchAll(/\bJ\s*C\s*[- ]?0*\d{1,12}\b/gi),
    ...fullText.matchAll(/\bQ\s*[- ]?0*\d{1,12}\b/gi),
  ]
    .map((match) => match[0])
    .map(meaningfulTrailingDigits)
    .filter(Boolean);

  if (directCandidates.length) {
    return directCandidates[0] ?? '';
  }

  const numberValue = findLabelValue(lines, ['NUMBER']);
  return numberValue ? meaningfulTrailingDigits(numberValue) : '';
};

const cleanCustomerName = (value: string) =>
  value
    .replace(/^TO\s*:?\s*/i, '')
    .replace(/\s*:\s*[A-Z]{2,}\d{2,}\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const isPlausibleCustomerName = (value: string) => {
  const upper = normalizeUpper(value);

  if (value.length < 3) return false;
  if (!/[A-Z]/i.test(value)) return false;
  if (/^R?[\d\s,.]+$/.test(value)) return false;
  if (value.includes('@')) return false;
  if (SELLER_MARKERS.some((marker) => upper.includes(marker))) return false;
  if (CUSTOMER_REJECT_MARKERS.some((marker) => upper.includes(marker))) return false;

  return true;
};

const findCustomerName = (lines: string[]): string => {
  // Current Vorster documents append a customer code to the TO name
  // (for example "CRISANDRA KWEKERY :CRE002"). That is the strongest anchor.
  for (const line of lines) {
    if (/\s*:\s*[A-Z]{2,}\d{2,}\s*$/i.test(line)) {
      const candidate = cleanCustomerName(line);
      if (isPlausibleCustomerName(candidate)) return candidate;
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const upper = normalizeUpper(line);

    if (upper === 'TO' || upper === 'TO:') {
      for (let offset = 1; offset <= 6 && index + offset < lines.length; offset += 1) {
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
      index >= Math.max(0, customerVatIndex - 4);
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

const isAddressCandidate = (line: string) => {
  const upper = normalizeUpper(line);

  if (!line) return false;
  if (line.includes('@')) return false;
  if (CUSTOMER_REJECT_MARKERS.some((marker) => upper.includes(marker))) return false;
  if (/^\d+(?:[.,]\d+)?%$/.test(line)) return false;
  if (/^R\s*\d/i.test(line)) return false;

  return /[A-Z]/i.test(line) || /^\d{4}$/.test(line);
};

const findLocation = (lines: string[], customerName: string): string => {
  const customerIndex = findCustomerStartIndex(lines, customerName);
  const physicalAddressIndexes = lines
    .map((line, index) =>
      normalizeUpper(line).includes('PHYSICAL ADDRESS') ? index : -1,
    )
    .filter((index) => index >= 0);

  if (!physicalAddressIndexes.length) return '';

  const addressIndex =
    physicalAddressIndexes.find((index) => customerIndex >= 0 && index >= customerIndex) ??
    physicalAddressIndexes[physicalAddressIndexes.length - 1] ??
    -1;

  if (addressIndex < 0) return '';

  const line = lines[addressIndex] ?? '';
  const markerIndex = normalizeUpper(line).indexOf('PHYSICAL ADDRESS');
  const colonIndex = line.indexOf(':', markerIndex);
  const addressParts: string[] = [];

  if (colonIndex >= 0) {
    const sameLineValue = line.slice(colonIndex + 1).trim();
    if (isAddressCandidate(sameLineValue)) {
      addressParts.push(sameLineValue);
    }
  }

  for (
    let index = addressIndex + 1;
    index < Math.min(lines.length, addressIndex + 10);
    index += 1
  ) {
    const candidate = lines[index] ?? '';
    const upper = normalizeUpper(candidate);

    if (ADDRESS_STOP_MARKERS.some((marker) => upper.includes(marker))) {
      break;
    }

    if (isAddressCandidate(candidate)) {
      addressParts.push(candidate);
    }
  }

  const uniqueParts = [...new Set(addressParts.map(normalizeLine).filter(Boolean))];
  return uniqueParts.join(', ');
};

const findDeliveryInstructions = (lines: string[]): string => {
  const instruction = lines.find((line) => {
    const upper = normalizeUpper(line);

    return (
      upper.includes('CALL BEFORE DELIVERY') ||
      upper.includes('CALL BEFORE DELIVER') ||
      upper.includes('CONTACT BEFORE DELIVERY')
    );
  });

  return instruction ? normalizeLine(instruction) : '';
};

const findDeliveryFeePercent = (text: string): number | null => {
  const match = text.match(/DELIVERY\s*FEE\s*:?\s*(\d+(?:[.,]\d+)?)\s*%/i);
  if (!match) return null;

  const value = Number((match[1] ?? '').replace(',', '.'));
  return Number.isFinite(value) ? value : null;
};

const inferFulfilmentType = (
  text: string,
  deliveryInstructions: string,
  deliveryFeePercent: number | null,
): FulfilmentType => {
  const upper = normalizeUpper(text);

  return deliveryFeePercent !== null ||
    /\b(?:DEL|DF)\s*-\s*DELIVERY FEE\b/.test(upper) ||
    normalizeUpper(deliveryInstructions).includes('DELIVERY')
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

  const referenceNumber = findReferenceNumber(lines, normalizedText);

  if (!referenceNumber) {
    return {
      ok: false,
      message: 'I could not read the job card or quote number. Retake the header clearly.',
    };
  }

  const warnings: string[] = [];
  const job = createEmptyJobCard();

  const dateMade =
    parseSouthAfricanDate(findLabelValue(lines, ['DATE'])) ??
    parseSouthAfricanDate(normalizedText) ??
    job.dateMade;
  const customerName = findCustomerName(lines);
  const location = findLocation(lines, customerName);
  const deliveryInstructions = findDeliveryInstructions(lines);
  const deliveryFeePercent = findDeliveryFeePercent(normalizedText);
  const amountCents =
    findMoneyNearLabel(lines, ['BALANCE DUE', 'GRAND TOTAL', 'TOTAL DUE']) ?? 0;
  const fulfilmentType = inferFulfilmentType(
    normalizedText,
    deliveryInstructions,
    deliveryFeePercent,
  );

  if (!customerName) {
    warnings.push('Customer name under TO was not read. Please check it before saving.');
  }

  if (!location && fulfilmentType === 'Delivery') {
    warnings.push('Delivery address was not read. Please check Location before saving.');
  }

  if (amountCents === 0) {
    warnings.push('Total amount could not be confirmed. Please check the amount.');
  }

  if (fulfilmentType === 'Collection') {
    warnings.push(
      'No delivery-fee or delivery-instruction marker was detected, so Collection was selected. Please confirm it.',
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
      deliveryInstructions,
      deliveryFeePercent,
      amountCents,
      deliveryDate: null,
      status: 'Pending',
    },
  };
}

export function parsePaperJobCardPages(
  pageTexts: string[],
): PaperJobCardImportResult {
  const usablePages = pageTexts.map((text) => text.trim()).filter(Boolean);

  if (!usablePages.length) {
    return {
      ok: false,
      message: 'No readable job-card pages have been captured yet.',
    };
  }

  return parsePaperJobCardText(
    usablePages
      .map((text, index) => `--- PAGE ${index + 1} ---\n${text}`)
      .join('\n'),
  );
}
