import DateTimePicker from '@expo/ui/community/datetime-picker';
import { SQLiteProvider } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { JobCardEditor } from './src/components/JobCardEditor';
import { DATABASE_NAME, migrateDatabase } from './src/data/database';
import {
  createEmptyJobCard,
  type JobCard,
} from './src/domain/jobCard';
import { JobCardScanner } from './src/features/jobCards/JobCardScanner';
import {
  DELIVERY_FILTERS,
  getDeliveryUrgency,
  matchesDeliveryFilter,
  type DeliveryFilter,
} from './src/features/jobCards/jobPlanning';
import { useJobCards } from './src/features/jobCards/useJobCards';
import {
  formatLocalDate,
  fromLocalDate,
  toLocalDate,
  todayLocalDate,
} from './src/utils/localDate';

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

type PlannerFilter = 'All' | 'Active' | 'Ready' | 'Completed';

const FILTERS: PlannerFilter[] = ['All', 'Active', 'Ready', 'Completed'];

const formatRand = (amountCents: number) =>
  new Intl.NumberFormat('en-ZA', {
    style: 'currency',
    currency: 'ZAR',
    maximumFractionDigits: 2,
  }).format(amountCents / 100);

const isCompleted = (job: JobCard) =>
  job.status === 'Delivered' || job.status === 'Collected';

const isActive = (job: JobCard) =>
  !isCompleted(job) && job.status !== 'Cancelled';

export default function App() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <PlannerScreen />
    </SQLiteProvider>
  );
}

function PlannerScreen() {
  const { jobs, loading, saveJob } = useJobCards();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlannerFilter>('All');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('All');
  const [editorJob, setEditorJob] = useState<JobCard | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [dateJobId, setDateJobId] = useState<string | null>(null);

  const today = todayLocalDate();

  const dateJob = useMemo(
    () => jobs.find((job) => job.id === dateJobId) ?? null,
    [dateJobId, jobs],
  );

  const visibleJobs = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('en-ZA');

    return jobs.filter((job) => {
      const matchesQuery =
        !normalizedQuery ||
        job.customerName.toLocaleLowerCase('en-ZA').includes(normalizedQuery) ||
        job.referenceNumber.toLocaleLowerCase('en-ZA').includes(normalizedQuery) ||
        job.location.toLocaleLowerCase('en-ZA').includes(normalizedQuery);

      if (!matchesQuery) return false;
      if (!matchesDeliveryFilter(job, deliveryFilter, today)) return false;

      switch (filter) {
        case 'Active':
          return isActive(job);
        case 'Ready':
          return job.status === 'Ready';
        case 'Completed':
          return isCompleted(job);
        default:
          return true;
      }
    });
  }, [deliveryFilter, filter, jobs, query, today]);

  const activeCount = useMemo(
    () => jobs.filter(isActive).length,
    [jobs],
  );

  const updateDeliveryDate = async (date: Date | null) => {
    if (!dateJob || !date) {
      setDateJobId(null);
      return;
    }

    await saveJob({
      ...dateJob,
      deliveryDate: toLocalDate(date),
    });

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

        <View style={styles.primaryActions}>
          <Pressable
            style={[styles.actionButton, styles.scanButton]}
            accessibilityRole="button"
            onPress={() => setScannerVisible(true)}
          >
            <Text style={styles.scanButtonText}>Scan Job Card</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, styles.addButton]}
            accessibilityRole="button"
            onPress={() => setEditorJob(createEmptyJobCard())}
          >
            <Text style={styles.addButtonText}>+ Add Job</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.controls}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search customer, job # or location"
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <Text style={styles.filterLabel}>Status</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {FILTERS.map((item) => {
            const selected = filter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setFilter(item)}
                style={[styles.filterButton, selected && styles.filterButtonSelected]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.filterLabel}>Delivery date</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {DELIVERY_FILTERS.map((item) => {
            const selected = deliveryFilter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setDeliveryFilter(item)}
                style={[
                  styles.filterButton,
                  selected && styles.filterButtonSelected,
                  item === 'Overdue' && selected && styles.overdueFilterSelected,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.summaryBar}>
          <Text style={styles.summaryText}>
            {jobs.length} job{jobs.length === 1 ? '' : 's'}
          </Text>
          <Text style={styles.summaryDivider}>•</Text>
          <Text style={styles.summaryText}>{activeCount} active</Text>
          {query || filter !== 'All' || deliveryFilter !== 'All' ? (
            <>
              <Text style={styles.summaryDivider}>•</Text>
              <Text style={styles.summaryText}>{visibleJobs.length} shown</Text>
            </>
          ) : null}
        </View>
      </View>

      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator />
          <Text style={styles.stateText}>Loading jobs…</Text>
        </View>
      ) : (
        <ScrollView horizontal bounces={false} style={styles.tableScroll}>
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
              {visibleJobs.length ? (
                visibleJobs.map((job) => {
                  const openEditor = () => setEditorJob(job);
                  const deliveryUrgency = getDeliveryUrgency(job, today);

                  return (
                    <View key={job.id} style={styles.row}>
                      <Cell
                        width={COLUMN_WIDTHS.dateMade}
                        text={formatLocalDate(job.dateMade)}
                        onPress={openEditor}
                      />
                      <Cell
                        width={COLUMN_WIDTHS.customerName}
                        text={job.customerName}
                        onPress={openEditor}
                      />
                      <Cell
                        width={COLUMN_WIDTHS.referenceNumber}
                        text={job.referenceNumber}
                        onPress={openEditor}
                      />
                      <Cell
                        width={COLUMN_WIDTHS.fulfilmentType}
                        text={job.fulfilmentType}
                        onPress={openEditor}
                      />
                      <Cell
                        width={COLUMN_WIDTHS.location}
                        text={job.location || '—'}
                        onPress={openEditor}
                      />
                      <Cell
                        width={COLUMN_WIDTHS.amountRand}
                        text={formatRand(job.amountCents)}
                        onPress={openEditor}
                      />
                      <Pressable
                        style={[
                          styles.cell,
                          { width: COLUMN_WIDTHS.deliveryDate },
                          deliveryUrgency === 'overdue' && styles.deliveryOverdueCell,
                          deliveryUrgency === 'today' && styles.deliveryTodayCell,
                          deliveryUrgency === 'tomorrow' && styles.deliveryTomorrowCell,
                          deliveryUrgency === 'completed' && styles.deliveryCompletedCell,
                        ]}
                        onPress={() => setDateJobId(job.id)}
                        accessibilityRole="button"
                        accessibilityLabel={`Choose delivery date for ${job.referenceNumber}`}
                      >
                        <Text
                          style={[
                            styles.dateCellText,
                            deliveryUrgency === 'overdue' && styles.deliveryOverdueText,
                            deliveryUrgency === 'today' && styles.deliveryTodayText,
                            deliveryUrgency === 'tomorrow' && styles.deliveryTomorrowText,
                            deliveryUrgency === 'completed' && styles.deliveryCompletedText,
                          ]}
                        >
                          {formatLocalDate(job.deliveryDate)}
                        </Text>
                      </Pressable>
                      <Cell
                        width={COLUMN_WIDTHS.status}
                        text={job.status}
                        onPress={openEditor}
                        emphasized
                      />
                    </View>
                  );
                })
              ) : (
                <View style={styles.emptyRow}>
                  <Text style={styles.emptyTitle}>
                    {jobs.length ? 'No matching jobs' : 'No job cards yet'}
                  </Text>
                  <Text style={styles.emptyText}>
                    {jobs.length
                      ? 'Change the search or filter to show more jobs.'
                      : 'Tap + Add Job to create the first row.'}
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </ScrollView>
      )}

      <JobCardScanner
        visible={scannerVisible}
        onCancel={() => setScannerVisible(false)}
        onJobScanned={(job) => {
          const normalizedReference = job.referenceNumber.trim().toLocaleLowerCase('en-ZA');
          const existingJob = jobs.find(
            (storedJob) =>
              storedJob.referenceNumber.trim().toLocaleLowerCase('en-ZA') ===
              normalizedReference,
          );

          setScannerVisible(false);
          setEditorJob(existingJob ? { ...job, id: existingJob.id } : job);
        }}
      />

      <JobCardEditor
        visible={editorJob !== null}
        job={editorJob}
        onCancel={() => setEditorJob(null)}
        onSave={async (job) => {
          await saveJob(job);
          setEditorJob(null);
        }}
      />

      {dateJob ? (
        <DateTimePicker
          value={dateJob.deliveryDate ? fromLocalDate(dateJob.deliveryDate) : new Date()}
          mode="date"
          presentation="dialog"
          onChange={(event, date) => {
            if (event.type === 'dismissed') {
              setDateJobId(null);
              return;
            }

            void updateDeliveryDate(date ?? null);
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
  emphasized = false,
  onPress,
}: {
  width: number;
  text: string;
  header?: boolean;
  emphasized?: boolean;
  onPress?: () => void;
}) {
  const content = (
    <Text
      style={[
        header ? styles.headerCellText : styles.cellText,
        emphasized && styles.emphasizedCellText,
      ]}
      numberOfLines={2}
    >
      {text}
    </Text>
  );

  if (onPress) {
    return (
      <Pressable
        style={[styles.cell, { width }]}
        onPress={onPress}
        accessibilityRole="button"
      >
        {content}
      </Pressable>
    );
  }

  return <View style={[styles.cell, { width }]}>{content}</View>;
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
  primaryActions: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  scanButton: {
    backgroundColor: '#101828',
  },
  scanButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  addButton: {
    borderWidth: 1,
    borderColor: '#d0d5dd',
    backgroundColor: '#ffffff',
  },
  addButtonText: {
    color: '#101828',
    fontSize: 15,
    fontWeight: '800',
  },
  controls: {
    paddingTop: 10,
  },
  searchInput: {
    minHeight: 44,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: '#101828',
    fontSize: 15,
  },
  filterLabel: {
    marginTop: 10,
    marginHorizontal: 16,
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  filterRow: {
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  filterButton: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  filterButtonSelected: {
    borderColor: '#101828',
    backgroundColor: '#101828',
  },
  overdueFilterSelected: {
    borderColor: '#b42318',
    backgroundColor: '#b42318',
  },
  filterText: {
    color: '#475467',
    fontSize: 13,
    fontWeight: '700',
  },
  filterTextSelected: {
    color: '#ffffff',
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
  tableScroll: {
    flex: 1,
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
  emphasizedCellText: {
    fontWeight: '800',
  },
  dateCellText: {
    color: '#175cd3',
    fontSize: 13,
    fontWeight: '700',
  },
  deliveryOverdueCell: {
    backgroundColor: '#fef3f2',
  },
  deliveryTodayCell: {
    backgroundColor: '#fffaeb',
  },
  deliveryTomorrowCell: {
    backgroundColor: '#f0f9ff',
  },
  deliveryCompletedCell: {
    backgroundColor: '#ecfdf3',
  },
  deliveryOverdueText: {
    color: '#b42318',
  },
  deliveryTodayText: {
    color: '#b54708',
  },
  deliveryTomorrowText: {
    color: '#026aa2',
  },
  deliveryCompletedText: {
    color: '#027a48',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  stateText: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyRow: {
    width: Object.values(COLUMN_WIDTHS).reduce((total, width) => total + width, 0),
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 4,
    color: '#667085',
    fontSize: 13,
    textAlign: 'center',
  },
});
