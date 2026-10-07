import {
  JOB_STATUSES,
  createEmptyJobCard,
  type FulfilmentType,
  type JobCard,
  type JobStatus,
} from '../../domain/jobCard';
import { fromLocalDate, toLocalDate, type LocalDate } from '../../utils/localDate';

const SCHEMA = 'vu-job-card/v1';

interface JobCardQrPayload {
  schema: string;
  dateMade?: unknown;
  customerName?: unknown;
  referenceNumber?: unknown;
  fulfilmentType?: unknown;
  location?: unknown;
  amountCents?: unknown;
  deliveryDate?: unknown;
  status?: unknown;
}

export type JobCardImportResult =
  | { ok: true; job: JobCard }
  | { ok: false; message: string };

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const isFulfilmentType = (value: unknown): value is FulfilmentType =>
  value === 'Delivery' || value === 'Collection';

const isJobStatus = (value: unknown): value is JobStatus =>
  typeof value === 'string' &&
  JOB_STATUSES.some((status) => status === value);

const isLocalDate = (value: unknown): value is LocalDate => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = fromLocalDate(value);
  return !Number.isNaN(parsed.getTime()) && toLocalDate(parsed) === value;
};

export function parseJobCardQr(data: string): JobCardImportResult {
  let payload: JobCardQrPayload;

  try {
    payload = JSON.parse(data) as JobCardQrPayload;
  } catch {
    return {
      ok: false,
      message: 'This QR code is not a Vorster Unlimited job card.',
    };
  }

  if (!payload || payload.schema !== SCHEMA) {
    return {
      ok: false,
      message: 'Unsupported job card QR format.',
    };
  }

  if (!isNonEmptyString(payload.customerName)) {
    return { ok: false, message: 'The QR code is missing the customer name.' };
  }

  if (!isNonEmptyString(payload.referenceNumber)) {
    return { ok: false, message: 'The QR code is missing the job card or quote number.' };
  }

  if (payload.dateMade !== undefined && !isLocalDate(payload.dateMade)) {
    return { ok: false, message: 'The QR code contains an invalid date made.' };
  }

  if (
    payload.deliveryDate !== undefined &&
    payload.deliveryDate !== null &&
    !isLocalDate(payload.deliveryDate)
  ) {
    return { ok: false, message: 'The QR code contains an invalid delivery date.' };
  }

  if (
    payload.fulfilmentType !== undefined &&
    !isFulfilmentType(payload.fulfilmentType)
  ) {
    return { ok: false, message: 'The QR code contains an invalid delivery type.' };
  }

  if (
    payload.amountCents !== undefined &&
    (typeof payload.amountCents !== 'number' ||
      !Number.isInteger(payload.amountCents) ||
      payload.amountCents < 0)
  ) {
    return { ok: false, message: 'The QR code contains an invalid amount.' };
  }

  if (payload.status !== undefined && !isJobStatus(payload.status)) {
    return { ok: false, message: 'The QR code contains an invalid status.' };
  }

  const job = createEmptyJobCard();

  return {
    ok: true,
    job: {
      ...job,
      dateMade: isLocalDate(payload.dateMade) ? payload.dateMade : job.dateMade,
      customerName: payload.customerName.trim(),
      referenceNumber: payload.referenceNumber.trim(),
      fulfilmentType: isFulfilmentType(payload.fulfilmentType)
        ? payload.fulfilmentType
        : job.fulfilmentType,
      location: typeof payload.location === 'string' ? payload.location.trim() : '',
      amountCents: Number.isInteger(payload.amountCents)
        ? Number(payload.amountCents)
        : 0,
      deliveryDate: isLocalDate(payload.deliveryDate)
        ? payload.deliveryDate
        : null,
      status: isJobStatus(payload.status) ? payload.status : job.status,
    },
  };
}

export const JOB_CARD_QR_SCHEMA = SCHEMA;
