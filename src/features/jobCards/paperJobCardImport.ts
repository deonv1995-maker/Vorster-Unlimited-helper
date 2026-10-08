import { inferDeliveryAreaFromAddress } from '../../domain/deliveryAreas';
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
  'QTY',
  'UNIT PRICE',
  'EXCL PRICE',
  'EXCL. PRICE',
  'INCL TOTAL',
  'INCL. TOTAL',
  'BALANCE DUE',
  'GRAND TOTAL',
  'TOTAL DUE',
  'TOTAL EXCLUSIVE',
  'TOTAL VAT',
  'SUB TOTAL',
  'SUBTOTAL',
  'QUOTE',
  'JOBCARD',
  'JOB CARD',
  'FROM',
];

const EXACT_CUSTOMER_REJECTS = new Set([
  'TO',
  'DISC',
  'DISC %',
  'VAT',
  'VAT %',
  'EXCL',
  'INCL',
  'TOTAL',
  'PRICE',
  'AMOUNT',
]);

const ADDRESS_STOP_MARKERS = [
  'DESCRIPTION',
  'QUANTITY',
  'QTY',
  'UNIT PRICE',
  'EXCL PRICE',
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
          !EXACT_CUSTOMER_REJECTS.has(candidateUpper) &&
          !CUSTOMER_REJECT_MARKERS.some((marker) =>
            candidateUpper.startsWith(marker),
          )
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

const normalizeDigitLikeCharacters = (value: string) =>
  value
    .toUpperCase()
    .replace(/[OQD]/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/S/g, '5')
    .replace(/B/g, '8');

export const normalizeDocumentReference = (value: string): string => {
  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!compact) return '';

  const withoutPrefix = compact.replace(/^(?:JOBCARD|JOB|QU|JC|Q)/, '');
  const digitLike = normalizeDigitLikeCharacters(withoutPrefix);
  const match = digitLike.match(/(\d{1,12})$/);

  if (!match) return '';

  const digits = match[1] ?? '';
  const meaningful = digits.replace(/^0+(?=\d)/, '');
  return meaningful || '0';
};

const findReferenceNumber = (lines: string[], fullText: string): string => {
  // Prefer an explicit QU/JC token anywhere in the OCR output. ML Kit can flatten
  // two-column headers so NUMBER may be followed by REFERENCE/BACK ORDER before
  // the actual quote number appears.
  const explicitTokens = [
    ...(fullText.match(/\bQ\s*U\s*[A-Z0-9]{3,14}\b/gi) ?? []),
    ...(fullText.match(/\bJ\s*C\s*[A-Z0-9-]{2,14}\b/gi) ?? []),
  ];

  for (const token of explicitTokens) {
    const normalized = normalizeDocumentReference(token);
    if (normalized) return normalized;
  }

  for (let index = 0; index < lines.length; index += 1) {
    const upper = normalizeUpper(lines[index] ?? '');

    if (!/^NUMBER\s*:?/.test(upper)) continue;

    const sameLine = (lines[index] ?? '').replace(/^NUMBER\s*:?\s*/i, '');
    const sameLineNormalized = normalizeDocumentReference(sameLine);
    if (sameLineNormalized) return sameLineNormalized;

    for (let offset = 1; offset <= 3 && index + offset < lines.length; offset += 1) {
      const candidate = lines[index + offset] ?? '';
      const normalized = normalizeDocumentReference(candidate);

      if (normalized) return normalized;
    }
  }

  return '';
};

const CUSTOMER_CODE_SUFFIX =
  /\s*[:;]\s*[A-Z]{2,}[0-9OQDILSB]{2,}\s*$/i;

const cleanCustomerName = (value: string) =>
  value
    .replace(/^TO\s*:?\s*/i, '')
    .replace(CUSTOMER_CODE_SUFFIX, '')
    .replace(/\s+/g, ' ')
    .trim();

const isMostlyUppercase = (value: string) => {
  const letters = value.replace(/[^A-Za-z]/g, '');
  if (!letters) return false;

  const uppercase = letters.replace(/[^A-Z]/g, '').length;
  return uppercase / letters.length >= 0.8;
};

const isPlausibleCustomerName = (value: string) => {
  const upper = normalizeUpper(value);

  if (value.length < 3 || value.length > 80) return false;
  if (!/[A-Z]/i.test(value)) return false;
  if (/^R?[\d\s,.]+$/.test(value)) return false;
  if (value.includes('@')) return false;
  if (EXACT_CUSTOMER_REJECTS.has(upper)) return false;
  if (SELLER_MARKERS.some((marker) => upper.includes(marker))) return false;
  if (CUSTOMER_REJECT_MARKERS.some((marker) => upper.includes(marker))) return false;

  return true;
};

const scoreCustomerCandidate = (
  rawValue: string,
  index: number,
  toIndex: number,
  customerVatIndex: number,
) => {
  const value = cleanCustomerName(rawValue);
  if (!isPlausibleCustomerName(value)) return Number.NEGATIVE_INFINITY;

  let score = 0;
  const words = value.split(/\s+/).filter(Boolean);

  if (CUSTOMER_CODE_SUFFIX.test(rawValue)) score += 10;
  if (words.length >= 2) score += 5;
  if (words.length >= 3) score += 1;
  if (isMostlyUppercase(value)) score += 3;
  if (value.length >= 8 && value.length <= 50) score += 2;

  if (toIndex >= 0 && index > toIndex && index <= toIndex + 8) {
    score += 6;
  }

  if (
    customerVatIndex >= 0 &&
    index < customerVatIndex &&
    index >= customerVatIndex - 5
  ) {
    score += 8;
  }

  if (words.length === 1) score -= 5;

  return score;
};

const findCustomerName = (lines: string[]): string => {
  const toIndex = lines.findIndex((line) => {
    const upper = normalizeUpper(line);
    return upper === 'TO' || upper === 'TO:';
  });
  const customerVatIndex = lines.findIndex((line) =>
    normalizeUpper(line).includes('CUSTOMER VAT'),
  );

  const candidates = lines
    .map((line, index) => ({
      raw: line,
      value: cleanCustomerName(line),
      score: scoreCustomerCandidate(line, index, toIndex, customerVatIndex),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.value ?? '';
};

const findCustomerStartIndex = (lines: string[], customerName: string) => {
  if (!customerName) return -1;

  const target = normalizeUpper(customerName);
  return lines.findIndex((line) => normalizeUpper(line).includes(target));
};

const isPhysicalAddressLabel = (line: string) => {
  const upper = normalizeUpper(line)
    .replace(/0/g, 'O')
    .replace(/5/g, 'S');

  return (
    upper.includes('PHYSICAL ADDRESS') ||
    upper.includes('PHYSICAL ADRESS') ||
    upper.includes('PHYSICAL ADDRES')
  );
};

const STREET_ADDRESS_HINT =
  /\b(?:STREET|ST\.?|ROAD|RD\.?|DRIVE|DR\.?|AVENUE|AVE\.?|LANE|CLOSE|CRESCENT|PLOT|FARM|UNIT|ERF|BOULEVARD|WAY|AH)\b/i;

const isAddressCandidate = (line: string, customerName = '') => {
  const upper = normalizeUpper(line);
  const customerUpper = normalizeUpper(customerName);

  if (!line) return false;
  if (line.includes('@')) return false;
  if (customerUpper && upper.includes(customerUpper)) return false;
  if (SELLER_MARKERS.some((marker) => upper.includes(marker))) return false;
  if (/[:;]\s*[A-Z]{2,}[0-9OQDILSB]{2,}\s*$/i.test(line)) return false;
  if (EXACT_CUSTOMER_REJECTS.has(upper)) return false;
  if (CUSTOMER_REJECT_MARKERS.some((marker) => upper.includes(marker))) return false;
  if (/^\d+(?:[.,]\d+)?%$/.test(line)) return false;
  if (/^R\s*\d/i.test(line)) return false;

  return /[A-Z]/i.test(line) || /^\d{4}$/.test(line);
};

const findLocation = (lines: string[], customerName: string): string => {
  const customerIndex = findCustomerStartIndex(lines, customerName);
  const toIndex = lines.findIndex((line) => /^TO\s*:?$/i.test(line));
  const customerVatIndex = lines.findIndex((line) =>
    normalizeUpper(line).includes('CUSTOMER VAT'),
  );
  const customerAnchor = Math.max(customerIndex, toIndex, customerVatIndex);

  const deliveryFeeIndex = lines.findIndex((line) =>
    normalizeUpper(line).includes('DELIVERY FEE'),
  );

  // Current Vorster quotes place the customer's physical address immediately
  // before Delivery Fee. This is a stronger anchor than the repeated
  // "PHYSICAL ADDRESS" labels from the seller and customer columns.
  if (deliveryFeeIndex >= 0) {
    const windowStart = Math.max(customerAnchor + 1, deliveryFeeIndex - 10, 0);
    const window = lines.slice(windowStart, deliveryFeeIndex);

    let streetAnchor = -1;
    for (let index = window.length - 1; index >= 0; index -= 1) {
      const candidate = window[index] ?? '';
      if (
        STREET_ADDRESS_HINT.test(candidate) ||
        /^\s*\d+[A-Za-z]?\s+\S+/.test(candidate)
      ) {
        streetAnchor = index;
        break;
      }
    }

    if (streetAnchor >= 0) {
      const addressParts: string[] = [];

      for (let index = streetAnchor; index < window.length; index += 1) {
        const candidate = window[index] ?? '';
        if (isAddressCandidate(candidate, customerName)) {
          addressParts.push(candidate);
        }
      }

      for (
        let index = deliveryFeeIndex + 1;
        index < Math.min(lines.length, deliveryFeeIndex + 4);
        index += 1
      ) {
        const candidate = lines[index] ?? '';
        if (/^\d{4}$/.test(candidate)) {
          addressParts.push(candidate);
          break;
        }
      }

      const unique = [...new Set(addressParts.map(normalizeLine).filter(Boolean))];
      if (unique.length) return unique.join(', ');
    }
  }

  const physicalAddressIndexes = lines
    .map((line, index) => (isPhysicalAddressLabel(line) ? index : -1))
    .filter((index) => index >= 0);

  if (!physicalAddressIndexes.length) return '';

  const afterCustomerAnchor = physicalAddressIndexes.filter(
    (index) => customerAnchor < 0 || index >= customerAnchor,
  );
  const addressIndex =
    afterCustomerAnchor[afterCustomerAnchor.length - 1] ??
    physicalAddressIndexes[physicalAddressIndexes.length - 1] ??
    -1;

  if (addressIndex < 0) return '';

  const line = lines[addressIndex] ?? '';
  const upperLine = normalizeUpper(line);
  const labelCandidates = [
    'PHYSICAL ADDRESS',
    'PHYSICAL ADRESS',
    'PHYSICAL ADDRES',
  ];
  const foundLabel = labelCandidates.find((label) => upperLine.includes(label));
  const addressParts: string[] = [];

  if (foundLabel) {
    const labelIndex = upperLine.indexOf(foundLabel);
    const originalAfterLabel = line.slice(labelIndex + foundLabel.length);
    const sameLineValue = originalAfterLabel.replace(/^\s*:?\s*/, '').trim();

    if (isAddressCandidate(sameLineValue, customerName)) {
      addressParts.push(sameLineValue);
    }
  }

  for (
    let index = addressIndex + 1;
    index < Math.min(lines.length, addressIndex + 14);
    index += 1
  ) {
    const candidate = lines[index] ?? '';
    const upper = normalizeUpper(candidate);

    if (ADDRESS_STOP_MARKERS.some((marker) => upper.includes(marker))) {
      break;
    }

    if (isAddressCandidate(candidate, customerName)) {
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

  const allPrintedDates = [...normalizedText.matchAll(/\b(\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{4})\b/g)]
    .map((match) => parseSouthAfricanDate(match[1] ?? null))
    .filter((value): value is LocalDate => value !== null)
    .sort();

  const dateMade = allPrintedDates[0] ?? job.dateMade;
  const customerName = findCustomerName(lines);
  const location = findLocation(lines, customerName);
  const deliveryArea = inferDeliveryAreaFromAddress(location);
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

  if (fulfilmentType === 'Delivery' && deliveryArea === 'Other') {
    warnings.push(
      'Delivery area could not be identified automatically. Please choose the area before saving.',
    );
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
      deliveryArea,
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
