import { SQLiteProvider } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { DeliveryCalendarModal } from './src/components/DeliveryCalendarModal';
import { JobCardEditor } from './src/components/JobCardEditor';
import { OrderLoadModal } from './src/components/OrderLoadModal';
import { DATABASE_NAME, migrateDatabase } from './src/data/database';
import {
  findDeliveryAreaDefinition,
  type DeliveryAreaDefinition,
} from './src/domain/deliveryAreas';
import {
  createEmptyJobCard,
  type JobCard,
  type JobCardSourcePage,
} from './src/domain/jobCard';
import { JobCardScanner } from './src/features/jobCards/JobCardScanner';
import {
  DELIVERY_FILTERS,
  getDeliveryUrgency,
  matchesDeliveryFilter,
  type DeliveryFilter,
} from './src/features/jobCards/jobPlanning';
import { useDeliveryAreas } from './src/features/jobCards/useDeliveryAreas';
import { useJobCards } from './src/features/jobCards/useJobCards';
import { useOrderPlanning, type LoadedOrderPlan } from './src/features/jobCards/useOrderPlanning';
import { androidTopSystemInset } from './src/ui/systemInsets';
import {
  formatLocalDate,
  todayLocalDate,
  type LocalDate,
} from './src/utils/localDate';

const COLUMN_WIDTHS = {
  dateMade: 112,
  customerName: 170,
  referenceNumber: 160,
  fulfilmentType: 155,
  deliveryArea: 135,
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
  !isCompleted(job) && job.status !== 'Canceled';

export default function App() {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrateDatabase}>
      <PlannerScreen />
    </SQLiteProvider>
  );
}

function PlannerScreen() {
  const { jobs, loading, saveJob, removeJob } = useJobCards();
  const { deliveryAreas, addDeliveryArea } = useDeliveryAreas();
  const { loadOrderPlan, saveAllocations } = useOrderPlanning();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<PlannerFilter>('All');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilter>('All');
  const [editorJob, setEditorJob] = useState<JobCard | null>(null);
  const [scannerVisible, setScannerVisible] = useState(false);
  const [pendingScanPages, setPendingScanPages] = useState<JobCardSourcePage[] | undefined>(undefined);
  const [dateJobId, setDateJobId] = useState<string | null>(null);
  const [loadJob, setLoadJob] = useState<JobCard | null>(null);
  const [orderPlan, setOrderPlan] = useState<LoadedOrderPlan | null>(null);
  const [orderPlanLoading, setOrderPlanLoading] = useState(false);

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
        job.deliveryArea.toLocaleLowerCase('en-ZA').includes(normalizedQuery) ||
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

  const updateDeliveryDate = async (date: LocalDate) => {
    if (!dateJob) {
      setDateJobId(null);
      return;
    }

    try {
      await saveJob({
        ...dateJob,
        deliveryDate: date,
      });
      setDateJobId(null);
    } catch (error) {
      Alert.alert(
        'Vehicle capacity conflict',
        error instanceof Error
          ? error.message
          : 'This delivery date would overbook a vehicle.',
      );
    }
  };

  const openOrderLoad = async (job: JobCard) => {
    setLoadJob(job);
    setOrderPlan(null);
    setOrderPlanLoading(true);

    try {
      const plan = await loadOrderPlan(job);
      setOrderPlan(plan);
    } catch (error) {
      Alert.alert(
        'Order details could not be opened',
        error instanceof Error ? error.message : 'Please try again.',
      );
      setLoadJob(null);
    } finally {
      setOrderPlanLoading(false);
    }
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
          placeholder="Search customer, job # or area"
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
              <Cell width={COLUMN_WIDTHS.deliveryArea} text="Area" header />
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
                      {job.fulfilmentType === 'Delivery' ? (
                        <AreaCell
                          width={COLUMN_WIDTHS.deliveryArea}
                          area={job.deliveryArea}
                          deliveryAreas={deliveryAreas}
                          onPress={openEditor}
                        />
                      ) : (
                        <Cell
                          width={COLUMN_WIDTHS.deliveryArea}
                          text="—"
                          onPress={openEditor}
                        />
                      )}
                      <AmountCell
                        width={COLUMN_WIDTHS.amountRand}
                        amount={formatRand(job.amountCents)}
                        onPress={() => {
                          void openOrderLoad(job);
                        }}
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
        onJobScanned={(result) => {
          const normalizedReference = result.job.referenceNumber
            .trim()
            .toLocaleLowerCase('en-ZA');
          const existingJob = jobs.find(
            (storedJob) =>
              storedJob.referenceNumber.trim().toLocaleLowerCase('en-ZA') ===
              normalizedReference,
          );

          setScannerVisible(false);
          setPendingScanPages(result.sourcePages);
          setEditorJob(
            existingJob
              ? { ...result.job, id: existingJob.id }
              : result.job,
          );
        }}
      />

      <JobCardEditor
        visible={editorJob !== null}
        job={editorJob}
        onRemove={
          editorJob && jobs.some((job) => job.id === editorJob.id)
            ? async (job) => {
                await removeJob(job.id);
                setEditorJob(null);
                setPendingScanPages(undefined);
              }
            : undefined
        }
        onCancel={() => {
          setEditorJob(null);
          setPendingScanPages(undefined);
        }}
        calendarJobs={jobs}
        deliveryAreas={deliveryAreas}
        onAddDeliveryArea={addDeliveryArea}
        onSave={async (job) => {
          await saveJob(job, pendingScanPages);
          setEditorJob(null);
          setPendingScanPages(undefined);
        }}
      />

      <OrderLoadModal
        visible={loadJob !== null}
        job={loadJob}
        items={orderPlan?.items ?? []}
        allocations={orderPlan?.allocations ?? []}
        capacities={orderPlan?.capacities ?? []}
        loading={orderPlanLoading}
        onCancel={() => {
          setLoadJob(null);
          setOrderPlan(null);
        }}
        onSave={async (allocations) => {
          if (!loadJob) return;

          const capacities = await saveAllocations(loadJob, allocations);
          setOrderPlan((current) =>
            current
              ? {
                  ...current,
                  allocations,
                  capacities,
                }
              : current,
          );
          setLoadJob(null);
          setOrderPlan(null);
        }}
      />

      <DeliveryCalendarModal
        visible={dateJob !== null}
        selectedDate={dateJob?.deliveryDate ?? null}
        jobs={jobs}
        deliveryAreas={deliveryAreas}
        currentJobId={dateJob?.id}
        onCancel={() => setDateJobId(null)}
        onSelectDate={(date) => {
          void updateDeliveryDate(date);
        }}
      />
    </SafeAreaView>
  );
}

function AmountCell({
  width,
  amount,
  onPress,
}: {
  width: number;
  amount: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[styles.cell, styles.amountCell, { width }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${amount}. Open order items and vehicle load.`}
    >
      <Text style={styles.amountText}>{amount}</Text>
      <Text style={styles.amountHint}>Items / load</Text>
    </Pressable>
  );
}

function AreaCell({
  width,
  area,
  deliveryAreas,
  onPress,
}: {
  width: number;
  area: JobCard['deliveryArea'];
  deliveryAreas: DeliveryAreaDefinition[];
  onPress: () => void;
}) {
  const config = findDeliveryAreaDefinition(deliveryAreas, area);

  return (
    <Pressable
      style={[
        styles.cell,
        styles.areaCell,
        { width, backgroundColor: config.color },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Delivery area ${area}`}
    >
      <Text style={[styles.areaCellText, { color: config.textColor }]}>
        {area}
      </Text>
    </Pressable>
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
    paddingTop: androidTopSystemInset,
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
  amountCell: {
    alignItems: 'flex-start',
  },
  amountText: {
    color: '#175cd3',
    fontSize: 13,
    fontWeight: '800',
  },
  amountHint: {
    marginTop: 2,
    color: '#667085',
    fontSize: 10,
    fontWeight: '700',
  },
  areaCell: {
    alignItems: 'center',
  },
  areaCellText: {
    fontSize: 13,
    fontWeight: '900',
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
