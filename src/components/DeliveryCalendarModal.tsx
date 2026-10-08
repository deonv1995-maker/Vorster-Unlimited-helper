import { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  DELIVERY_AREAS,
  DELIVERY_AREA_CONFIG,
  type DeliveryArea,
} from '../domain/deliveryAreas';
import type { JobCard } from '../domain/jobCard';
import { androidTopSystemInset } from '../ui/systemInsets';
import {
  fromLocalDate,
  toLocalDate,
  todayLocalDate,
  type LocalDate,
} from '../utils/localDate';

interface DeliveryCalendarModalProps {
  visible: boolean;
  selectedDate: LocalDate | null;
  jobs: JobCard[];
  currentJobId?: string | null;
  onCancel: () => void;
  onSelectDate: (date: LocalDate) => void;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const isOpenDelivery = (job: JobCard) =>
  job.fulfilmentType === 'Delivery' &&
  job.status !== 'Cancelled' &&
  job.status !== 'Delivered' &&
  job.status !== 'Collected' &&
  job.deliveryDate !== null;

const monthAnchor = (value: LocalDate | null) => {
  const date = value ? fromLocalDate(value) : new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
};

const moveMonth = (date: Date, offset: number) =>
  new Date(date.getFullYear(), date.getMonth() + offset, 1, 12, 0, 0, 0);

const monthLabel = (date: Date) =>
  new Intl.DateTimeFormat('en-ZA', {
    month: 'long',
    year: 'numeric',
  }).format(date);

const buildMonthCells = (month: Date): Array<LocalDate | null> => {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const firstDay = new Date(year, monthIndex, 1, 12, 0, 0, 0);
  const mondayIndex = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0, 12, 0, 0, 0).getDate();

  const cells: Array<LocalDate | null> = [];

  for (let index = 0; index < mondayIndex; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toLocalDate(new Date(year, monthIndex, day, 12, 0, 0, 0)));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
};

export function DeliveryCalendarModal({
  visible,
  selectedDate,
  jobs,
  currentJobId,
  onCancel,
  onSelectDate,
}: DeliveryCalendarModalProps) {
  const [visibleMonth, setVisibleMonth] = useState(() => monthAnchor(selectedDate));
  const today = todayLocalDate();

  useEffect(() => {
    if (visible) {
      setVisibleMonth(monthAnchor(selectedDate));
    }
  }, [selectedDate, visible]);

  const cells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);

  const areasByDate = useMemo(() => {
    const schedule = new Map<LocalDate, DeliveryArea[]>();

    for (const job of jobs) {
      if (!isOpenDelivery(job) || job.id === currentJobId || !job.deliveryDate) {
        continue;
      }

      const current = schedule.get(job.deliveryDate) ?? [];
      if (!current.includes(job.deliveryArea)) {
        current.push(job.deliveryArea);
        current.sort(
          (left, right) =>
            DELIVERY_AREAS.indexOf(left) - DELIVERY_AREAS.indexOf(right),
        );
        schedule.set(job.deliveryDate, current);
      }
    }

    return schedule;
  }, [currentJobId, jobs]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.topBar}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              style={styles.topAction}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>

            <View style={styles.titleBlock}>
              <Text style={styles.title}>Delivery Date</Text>
              <Text style={styles.subtitle}>Dots show areas already booked</Text>
            </View>

            <View style={styles.topAction} />
          </View>

          <View style={styles.monthControls}>
            <Pressable
              style={styles.monthButton}
              onPress={() => setVisibleMonth((current) => moveMonth(current, -1))}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Text style={styles.monthButtonText}>‹</Text>
            </Pressable>

            <Text style={styles.monthTitle}>{monthLabel(visibleMonth)}</Text>

            <Pressable
              style={styles.monthButton}
              onPress={() => setVisibleMonth((current) => moveMonth(current, 1))}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Text style={styles.monthButtonText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.weekHeader}>
            {WEEKDAYS.map((weekday) => (
              <View key={weekday} style={styles.weekdayCell}>
                <Text style={styles.weekdayText}>{weekday}</Text>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((date, index) => {
              if (!date) {
                return <View key={`blank-${index}`} style={styles.dayCell} />;
              }

              const areas = areasByDate.get(date) ?? [];
              const selected = selectedDate === date;
              const isToday = today === date;
              const dayNumber = Number(date.slice(-2));

              return (
                <Pressable
                  key={date}
                  style={[
                    styles.dayCell,
                    selected && styles.selectedDayCell,
                    isToday && styles.todayCell,
                  ]}
                  onPress={() => onSelectDate(date)}
                  accessibilityRole="button"
                  accessibilityLabel={[
                    date,
                    areas.length
                      ? `Deliveries: ${areas.join(', ')}`
                      : 'No deliveries booked',
                  ].join('. ')}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      selected && styles.selectedDayNumber,
                      isToday && styles.todayDayNumber,
                    ]}
                  >
                    {dayNumber}
                  </Text>

                  <View style={styles.dotRow}>
                    {areas.slice(0, 5).map((area) => (
                      <View
                        key={area}
                        style={[
                          styles.areaDot,
                          { backgroundColor: DELIVERY_AREA_CONFIG[area].color },
                        ]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.legend}
          >
            {DELIVERY_AREAS.map((area) => (
              <View key={area} style={styles.legendItem}>
                <View
                  style={[
                    styles.legendDot,
                    { backgroundColor: DELIVERY_AREA_CONFIG[area].color },
                  ]}
                />
                <Text style={styles.legendText}>{area}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    paddingTop: androidTopSystemInset + 12,
    paddingHorizontal: 12,
    paddingBottom: 20,
    justifyContent: 'center',
    backgroundColor: 'rgba(16,24,40,0.45)',
  },
  card: {
    overflow: 'hidden',
    borderRadius: 16,
    backgroundColor: '#ffffff',
  },
  topBar: {
    minHeight: 70,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eaecf0',
  },
  topAction: {
    width: 76,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    color: '#475467',
    fontSize: 15,
    fontWeight: '700',
  },
  titleBlock: {
    alignItems: 'center',
  },
  title: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    marginTop: 2,
    color: '#667085',
    fontSize: 11,
    fontWeight: '600',
  },
  monthControls: {
    minHeight: 58,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  monthButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: '#f2f4f7',
  },
  monthButtonText: {
    marginTop: -3,
    color: '#344054',
    fontSize: 34,
    fontWeight: '500',
  },
  monthTitle: {
    color: '#101828',
    fontSize: 17,
    fontWeight: '800',
  },
  weekHeader: {
    flexDirection: 'row',
    paddingHorizontal: 8,
  },
  weekdayCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: 6,
  },
  weekdayText: {
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  dayCell: {
    width: '14.2857%',
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  selectedDayCell: {
    backgroundColor: '#101828',
  },
  todayCell: {
    borderWidth: 1,
    borderColor: '#98a2b3',
  },
  dayNumber: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '700',
  },
  selectedDayNumber: {
    color: '#ffffff',
  },
  todayDayNumber: {
    fontWeight: '900',
  },
  dotRow: {
    minHeight: 10,
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  areaDot: {
    width: 8,
    height: 8,
    borderWidth: 1,
    borderColor: '#ffffff',
    borderRadius: 4,
  },
  legend: {
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eaecf0',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '700',
  },
});
