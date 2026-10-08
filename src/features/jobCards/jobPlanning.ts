import type { JobCard } from '../../domain/jobCard';
import {
  fromLocalDate,
  toLocalDate,
  type LocalDate,
} from '../../utils/localDate';

export type DeliveryFilter =
  | 'All'
  | 'Today'
  | 'Tomorrow'
  | 'This Week'
  | 'Overdue';

export const DELIVERY_FILTERS: DeliveryFilter[] = [
  'All',
  'Today',
  'Tomorrow',
  'This Week',
  'Overdue',
];

export type DeliveryUrgency =
  | 'none'
  | 'today'
  | 'tomorrow'
  | 'overdue'
  | 'completed';

const isClosed = (job: JobCard) =>
  job.status === 'Delivered' ||
  job.status === 'Collected' ||
  job.status === 'Canceled';

const addDays = (date: LocalDate, days: number): LocalDate => {
  const parsed = fromLocalDate(date);
  parsed.setDate(parsed.getDate() + days);
  return toLocalDate(parsed);
};

const endOfCurrentWeek = (today: LocalDate): LocalDate => {
  const parsed = fromLocalDate(today);
  const weekday = parsed.getDay();
  const daysUntilSunday = weekday === 0 ? 0 : 7 - weekday;
  parsed.setDate(parsed.getDate() + daysUntilSunday);
  return toLocalDate(parsed);
};

export function matchesDeliveryFilter(
  job: JobCard,
  filter: DeliveryFilter,
  today: LocalDate,
): boolean {
  if (filter === 'All') return true;
  if (!job.deliveryDate || isClosed(job)) return false;

  const tomorrow = addDays(today, 1);

  switch (filter) {
    case 'Today':
      return job.deliveryDate === today;
    case 'Tomorrow':
      return job.deliveryDate === tomorrow;
    case 'This Week':
      return (
        job.deliveryDate >= today &&
        job.deliveryDate <= endOfCurrentWeek(today)
      );
    case 'Overdue':
      return job.deliveryDate < today;
    default:
      return true;
  }
}

export function getDeliveryUrgency(
  job: JobCard,
  today: LocalDate,
): DeliveryUrgency {
  if (!job.deliveryDate) return 'none';
  if (isClosed(job)) return 'completed';

  if (job.deliveryDate < today) return 'overdue';
  if (job.deliveryDate === today) return 'today';
  if (job.deliveryDate === addDays(today, 1)) return 'tomorrow';

  return 'none';
}
