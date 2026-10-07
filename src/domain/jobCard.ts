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
  dateMade: string;
  customerName: string;
  referenceNumber: string;
  fulfilmentType: FulfilmentType;
  location: string;
  amountRand: number;
  deliveryDate: string | null;
  status: JobStatus;
}

const createLocalId = () =>
  `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

export const createEmptyJobCard = (): JobCard => ({
  id: createLocalId(),
  dateMade: new Date().toISOString(),
  customerName: '',
  referenceNumber: '',
  fulfilmentType: 'Delivery',
  location: '',
  amountRand: 0,
  deliveryDate: null,
  status: 'Pending',
});
