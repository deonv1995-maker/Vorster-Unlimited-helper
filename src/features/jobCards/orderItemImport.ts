import type { JobCardSourcePage } from '../../domain/jobCard';
import type { ParsedOrderItem } from '../../domain/orderPlanning';

const HEADER_MARKERS = new Set([
  'DESCRIPTION',
  'QUANTITY',
  'QTY',
  'UNIT PRICE',
  'EXCL PRICE',
  'EXCL. PRICE',
  'DISC',
  'DISC %',
  'VAT',
  'VAT %',
  'INCL TOTAL',
  'INCL. TOTAL',
  'BALANCE DUE',
  'GRAND TOTAL',
  'TOTAL DUE',
  'TOTAL EXCLUSIVE',
  'TOTAL VAT',
  'SUB TOTAL',
  'SUBTOTAL',
]);

const NON_PRODUCT_PREFIXES = new Set([
  'QU',
  'JC',
  'DF',
  'VAT',
  'PAGE',
  'DATE',
  'TOTAL',
]);

const normalizeLine = (value: string) =>
  value.replace(/\s+/g, ' ').replace(/[|]/g, 'I').trim();

const normalizeUpper = (value: string) => normalizeLine(value).toUpperCase();

const looksLikeMoney = (value: string) =>
  /^R?\s*\d[\d\s,]*(?:[.,]\d{2})$/i.test(value.trim());

const looksLikePercent = (value: string) =>
  /^\d+(?:[.,]\d+)?\s*%$/.test(value.trim());

const parseQuantity = (value: string): number | null => {
  const trimmed = value.trim();

  if (!/^\d{1,5}(?:[.,]\d{1,2})?$/.test(trimmed)) return null;
  if (looksLikeMoney(trimmed) || looksLikePercent(trimmed)) return null;

  const quantity = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) {
    return null;
  }

  return quantity;
};

const parseProductLine = (
  line: string,
): { productCode: string; description: string } | null => {
  const normalized = normalizeLine(line);
  const match = normalized.match(
    /^([A-Z][A-Z0-9]{2,11})\s*(?:[-–—:]\s*|\s+)(.+)$/i,
  );

  if (!match) return null;

  const productCode = (match[1] ?? '').toUpperCase();
  const description = normalizeLine(match[2] ?? '');
  const prefix = productCode.replace(/\d.*$/, '');

  if (!/\d/.test(productCode)) return null;
  if (NON_PRODUCT_PREFIXES.has(prefix) || NON_PRODUCT_PREFIXES.has(productCode)) {
    return null;
  }

  if (
    !description ||
    HEADER_MARKERS.has(normalizeUpper(description)) ||
    looksLikeMoney(description) ||
    looksLikePercent(description)
  ) {
    return null;
  }

  return { productCode, description };
};

const findQuantityAfter = (lines: string[], startIndex: number): number => {
  for (
    let index = startIndex + 1;
    index < Math.min(lines.length, startIndex + 7);
    index += 1
  ) {
    const candidate = normalizeLine(lines[index] ?? '');
    const upper = normalizeUpper(candidate);

    if (!candidate) continue;
    if (parseProductLine(candidate)) break;
    if (HEADER_MARKERS.has(upper)) continue;
    if (looksLikeMoney(candidate) || looksLikePercent(candidate)) continue;

    const quantity = parseQuantity(candidate);
    if (quantity !== null) return quantity;
  }

  return 1;
};

export function parseOrderItemsFromSourcePages(
  pages: JobCardSourcePage[],
): ParsedOrderItem[] {
  const items: ParsedOrderItem[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const lines = page.rawText
      .split(/\r?\n/)
      .map(normalizeLine)
      .filter(Boolean);

    for (let index = 0; index < lines.length; index += 1) {
      const product = parseProductLine(lines[index] ?? '');
      if (!product) continue;

      const quantity = findQuantityAfter(lines, index);
      const key = [
        page.pageNumber,
        product.productCode,
        product.description.toUpperCase(),
        quantity,
      ].join('|');

      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        position: items.length + 1,
        productCode: product.productCode,
        description: product.description,
        quantity,
        sourcePage: page.pageNumber,
      });
    }
  }

  return items;
}
