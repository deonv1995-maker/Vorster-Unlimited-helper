import { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@expo/ui/community/datetime-picker';

import type { JobCard } from './src/domain/jobCard';

const seedJobs: JobCard[] = [
  {
    id: 'demo-1',
    dateMade: '2026-10-07T00:00:00.000Z',
    customerName: 'Green Olive',
    referenceNumber: 'JC-1245',
    fulfilmentType: 'Delivery',
    location: 'Zambezi',
    amountRand: 8450,
    deliveryDate: '2026-10-10T00:00:00.000Z',
    status: 'In Production',
  },
];

const COLUMN_WIDTHS = {
  dateMade: 112,
  customerName: 170,
  referenceNumber: 160,
  fulfilmentType: 155,
  location: 150,
  amountRand: 120,
  deliveryDate: 140,
  status: 145,
} as const;

const formatDate = (value: string | null) => {
  if (!value) return 'Select date';
  return new Intl.DateTimeFormat('en-ZA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(value));
};

const formatRand = (amount: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(amount);

export default function App() {
  const [jobs, setJobs] = useState<JobCard[]>(seedJobs);
  const [dateJobId, setDateJobId] = useState<string | null>(null);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === dateJobId) ?? null,
    [dateJobId, jobs],
  );

  const updateDeliveryDate = (date: Date | null) => {
    if (!dateJobId || !date) {
      setDateJobId(null);
      return;
    }

    setJobs((current) =>
      current.map((job) =>
        job.id === dateJobId
          ? { ...job, deliveryDate: date.toISOString() }
          : job,
      ),
    );
    setDateJobId(null);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>VORSTER UNLIMITED</Text>
          <Text style={styles.title}>Job Card Planner</Text>
        </View>

        <TouchableOpacity
          style={styles.scanButton}
          accessibilityRole="button"
          onPress={() => {
            // Scanner workflow will be added next. Keeping the button visible establishes
            // the intended primary action without pretending scanning already works.
          }}
        >
          <Text style={styles.scanButtonText}>Scan Job Card</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.summaryBar}>
        <Text style={styles.summaryText}>{jobs.length} job{jobs.length === 1 ? '' : 's'}</Text>
        <Text style={styles.summaryDivider}>•</Text>
        <Text style={styles.summaryText}>
          {jobs.filter((job) => job.status !== 'Delivered' && job.status !== 'Collected').length} active
        </Text>
      </View>

      <ScrollView horizontal bounces={false}>
        <View>
          <View style={[styles.row, styles.headerRow]}>
            <Cell width={COLUMN_WIDTHS.dateMade} text="Date made" header />
            <Cell width={COLUMN_WIDTHS.customerName} text="Customer name" header />
            <Cell width={COLUMN_WIDTHS.referenceNumber} text="Job card / Quote #" header />
            <Cell width={COLUMN_WIDTHS.fulfilmentType} text="Delivery / Collection" header />
            <Cell width={COLUMN_WIDTHS.location} text="Location" header />
            <Cell width={COLUMN_WIDTHS.amountRand} text="Amount R" header />
            <Cell width={COLUMN_WIDTHS.deliveryDate} text="Delivery date" header />
            <Cell width={COLUMN_WIDTHS.status} text="Status" header />
          </View>

          <ScrollView>
            {jobs.map((job) => (
              <View key={job.id} style={styles.row}>
                <Cell width={COLUMN_WIDTHS.dateMade} text={formatDate(job.dateMade)} />
                <Cell width={COLUMN_WIDTHS.customerName} text={job.customerName} />
                <Cell width={COLUMN_WIDTHS.referenceNumber} text={job.referenceNumber} />
                <Cell width={COLUMN_WIDTHS.fulfilmentType} text={job.fulfilmentType} />
                <Cell width={COLUMN_WIDTHS.location} text={job.location} />
                <Cell width={COLUMN_WIDTHS.amountRand} text={formatRand(job.amountRand)} />
                <TouchableOpacity
                  style={[styles.cell, { width: COLUMN_WIDTHS.deliveryDate }]}
                  onPress={() => setDateJobId(job.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose delivery date for ${job.referenceNumber}`}
                >
                  <Text style={styles.dateCellText}>{formatDate(job.deliveryDate)}</Text>
                </TouchableOpacity>
                <Cell width={COLUMN_WIDTHS.status} text={job.status} />
              </View>
            ))}
          </ScrollView>
        </View>
      </ScrollView>

      {selectedJob ? (
        <DateTimePicker
          value={selectedJob.deliveryDate ? new Date(selectedJob.deliveryDate) : new Date()}
          mode="date"
          presentation="dialog"
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setDateJobId(null);
              return;
            }
            updateDeliveryDate(date ?? null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Cell({
  width,
  text,
  header = false,
}: {
  width: number;
  text: string;
  header?: boolean;
}) {
  return (
    <View style={[styles.cell, { width }]}>
      <Text style={header ? styles.headerCellText : styles.cellText} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f4f5f7',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 14,
    backgroundColor: '#ffffff',
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    color: '#667085',
  },
  title: {
    marginTop: 2,
    fontSize: 26,
    fontWeight: '800',
    color: '#101828',
  },
  scanButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#101828',
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  summaryText: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '600',
  },
  summaryDivider: {
    marginHorizontal: 8,
    color: '#98a2b3',
  },
  row: {
    flexDirection: 'row',
    minHeight: 58,
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d5dd',
  },
  headerRow: {
    minHeight: 52,
    backgroundColor: '#eaecf0',
  },
  cell: {
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#d0d5dd',
  },
  headerCellText: {
    color: '#344054',
    fontSize: 12,
    fontWeight: '800',
  },
  cellText: {
    color: '#1d2939',
    fontSize: 13,
    fontWeight: '500',
  },
  dateCellText: {
    color: '#175cd3',
    fontSize: 13,
    fontWeight: '700',
  },
});
