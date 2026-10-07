import {
  todayLocalDate,
  type LocalDate,
} from '../utils/localDate';

export const JOB_STATUSES = [
  'Pending',
  'In Production',
  'Ready',
  'Delivered',
  'Collected',
  'On Hold',
  'Cancelled',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export type FulfilmentType = 'Delivery' | 'Collection';

export interface JobCard {
  id: string;
  dateMade: LocalDate;
  customerName: string;
  referenceNumber: string;
  fulfilmentType: FulfilmentType;
  location: string;
  deliveryInstructions: string;
  deliveryFeePercent: number | null;
  amountCents: number;
  deliveryDate: LocalDate | null;
  status: JobStatus;
}

export interface JobCardSourcePage {
  pageNumber: number;
  rawText: string;
  capturedAt: string;
}

const createLocalId = () =>
  `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createEmptyJobCard = (): JobCard => ({
  id: createLocalId(),
  dateMade: todayLocalDate(),
  customerName: '',
  referenceNumber: '',
  fulfilmentType: 'Delivery',
  location: '',
  deliveryInstructions: '',
  deliveryFeePercent: null,
  amountCents: 0,
  deliveryDate: null,
  status: 'Pending',
});
