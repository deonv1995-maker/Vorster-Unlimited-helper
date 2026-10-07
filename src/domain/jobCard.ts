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

export const createEmptyJobCard = (): JobCard => ({
  id: crypto.randomUUID(),
  dateMade: new Date().toISOString(),
  customerName: '',
  referenceNumber: '',
  fulfilmentType: 'Delivery',
  location: '',
  amountRand: 0,
  deliveryDate: null,
  status: 'Pending',
});
