import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { JobCard } from '../domain/jobCard';
import {
  DELIVERY_VEHICLES,
  type DeliveryAllocation,
  type OrderItem,
  type VehicleCapacity,
  type VehicleId,
} from '../domain/orderPlanning';
import { androidTopSystemInset } from '../ui/systemInsets';
import { formatLocalDate } from '../utils/localDate';

interface OrderLoadModalProps {
  visible: boolean;
  job: JobCard | null;
  items: OrderItem[];
  allocations: DeliveryAllocation[];
  capacities: VehicleCapacity[];
  loading: boolean;
  onCancel: () => void;
  onSave: (allocations: DeliveryAllocation[]) => Promise<void>;
}

const QUICK_PERCENTAGES = [0, 25, 50, 75, 100] as const;

const formatQuantity = (quantity: number) =>
  Number.isInteger(quantity) ? String(quantity) : quantity.toFixed(1);

export function OrderLoadModal({
  visible,
  job,
  items,
  allocations,
  capacities,
  loading,
  onCancel,
  onSave,
}: OrderLoadModalProps) {
  const [vehicleLoads, setVehicleLoads] = useState<Record<VehicleId, number>>({
    'vehicle-1': 0,
    'vehicle-2': 0,
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visible) return;

    const next: Record<VehicleId, number> = {
      'vehicle-1': 0,
      'vehicle-2': 0,
    };

    for (const allocation of allocations) {
      next[allocation.vehicleId] = allocation.loadPercent;
    }

    setVehicleLoads(next);
    setMessage('');
  }, [allocations, visible]);

  const capacityState = useMemo(
    () =>
      DELIVERY_VEHICLES.map((vehicle) => {
        const booked =
          capacities.find((capacity) => capacity.vehicleId === vehicle.id)
            ?.bookedPercent ?? 0;
        const requested = vehicleLoads[vehicle.id] ?? 0;

        return {
          ...vehicle,
          booked,
          requested,
          after: booked + requested,
          overbooked: booked + requested > 100,
        };
      }),
    [capacities, vehicleLoads],
  );

  if (!job) return null;

  const hasAllocation = capacityState.some((vehicle) => vehicle.requested > 0);
  const hasOverbooking = capacityState.some((vehicle) => vehicle.overbooked);
  const canSave =
    !saving &&
    !loading &&
    !hasOverbooking &&
    (!hasAllocation || Boolean(job.deliveryDate));

  const setLoad = (vehicleId: VehicleId, value: number) => {
    setVehicleLoads((current) => ({
      ...current,
      [vehicleId]: Math.max(0, Math.min(100, Math.round(value))),
    }));
    setMessage('');
  };

  const handleSave = async () => {
    if (!job.deliveryDate && hasAllocation) {
      setMessage('Choose a delivery date before assigning vehicle space.');
      return;
    }

    if (hasOverbooking) {
      setMessage('One of the vehicles would exceed 100% capacity.');
      return;
    }

    const nextAllocations = DELIVERY_VEHICLES.map((vehicle) => ({
      jobCardId: job.id,
      vehicleId: vehicle.id,
      loadPercent: vehicleLoads[vehicle.id] ?? 0,
    })).filter((allocation) => allocation.loadPercent > 0);

    setSaving(true);
    setMessage('');

    try {
      await onSave(nextAllocations);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : 'Vehicle load could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onCancel}
    >
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable
            onPress={onCancel}
            style={styles.topAction}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Close</Text>
          </Pressable>

          <View style={styles.titleBlock}>
            <Text style={styles.title}>Order Load</Text>
            <Text style={styles.subtitle}>
              {job.customerName} • #{job.referenceNumber}
            </Text>
          </View>

          <Pressable
            onPress={() => {
              void handleSave();
            }}
            style={styles.topAction}
            accessibilityRole="button"
            disabled={!canSave}
          >
            <Text style={[styles.saveText, !canSave && styles.disabledText]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.centerState}>
            <ActivityIndicator />
            <Text style={styles.loadingText}>Reading scanned order items…</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryLabel}>Delivery date</Text>
              <Text style={styles.summaryValue}>
                {formatLocalDate(job.deliveryDate, 'Not selected')}
              </Text>
              <Text style={styles.summaryLabel}>Area</Text>
              <Text style={styles.summaryValue}>{job.deliveryArea}</Text>
            </View>

            <Text style={styles.sectionTitle}>Items on this order</Text>

            {items.length ? (
              <View style={styles.itemsCard}>
                {items.map((item) => (
                  <View key={item.id} style={styles.itemRow}>
                    <View style={styles.itemMain}>
                      <Text style={styles.itemCode}>{item.productCode}</Text>
                      <Text style={styles.itemDescription}>
                        {item.description}
                      </Text>
                    </View>
                    <View style={styles.quantityBox}>
                      <Text style={styles.quantityLabel}>Qty</Text>
                      <Text style={styles.quantityValue}>
                        {formatQuantity(item.quantity)}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>No item lines detected yet</Text>
                <Text style={styles.emptyText}>
                  The scanned pages are still kept with the job. We can refine
                  the item parser as we test more real orders.
                </Text>
              </View>
            )}

            <Text style={styles.sectionTitle}>Vehicle space</Text>

            {job.fulfilmentType !== 'Delivery' ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>Collection order</Text>
                <Text style={styles.emptyText}>
                  Vehicle capacity is only assigned to deliveries.
                </Text>
              </View>
            ) : (
              capacityState.map((vehicle) => {
                const remaining = Math.max(0, 100 - vehicle.booked);

                return (
                  <View key={vehicle.id} style={styles.vehicleCard}>
                    <View style={styles.vehicleHeader}>
                      <View>
                        <Text style={styles.vehicleName}>{vehicle.name}</Text>
                        <Text style={styles.vehicleMeta}>
                          {vehicle.booked}% already booked • {remaining}% free
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.afterBadge,
                          vehicle.overbooked && styles.afterBadgeOver,
                        ]}
                      >
                        <Text
                          style={[
                            styles.afterBadgeText,
                            vehicle.overbooked && styles.afterBadgeTextOver,
                          ]}
                        >
                          {vehicle.after}%
                        </Text>
                      </View>
                    </View>

                    <View style={styles.loadBar}>
                      <View
                        style={[
                          styles.bookedBar,
                          { width: `${Math.min(vehicle.booked, 100)}%` },
                        ]}
                      />
                      <View
                        style={[
                          styles.requestedBar,
                          {
                            left: `${Math.min(vehicle.booked, 100)}%`,
                            width: `${Math.min(
                              vehicle.requested,
                              Math.max(0, 100 - vehicle.booked),
                            )}%`,
                          },
                        ]}
                      />
                    </View>

                    <Text style={styles.loadLabel}>
                      This order uses {vehicle.requested}% of {vehicle.name}
                    </Text>

                    <View style={styles.stepperRow}>
                      <Pressable
                        style={styles.stepButton}
                        onPress={() =>
                          setLoad(vehicle.id, vehicle.requested - 5)
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.stepButtonText}>− 5%</Text>
                      </Pressable>
                      <Text style={styles.selectedPercent}>
                        {vehicle.requested}%
                      </Text>
                      <Pressable
                        style={styles.stepButton}
                        onPress={() =>
                          setLoad(vehicle.id, vehicle.requested + 5)
                        }
                        accessibilityRole="button"
                      >
                        <Text style={styles.stepButtonText}>+ 5%</Text>
                      </Pressable>
                    </View>

                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.quickRow}
                    >
                      {QUICK_PERCENTAGES.map((percentage) => {
                        const selected = vehicle.requested === percentage;

                        return (
                          <Pressable
                            key={percentage}
                            style={[
                              styles.quickButton,
                              selected && styles.quickButtonSelected,
                            ]}
                            onPress={() => setLoad(vehicle.id, percentage)}
                            accessibilityRole="button"
                            accessibilityState={{ selected }}
                          >
                            <Text
                              style={[
                                styles.quickButtonText,
                                selected && styles.quickButtonTextSelected,
                              ]}
                            >
                              {percentage}%
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>

                    {vehicle.overbooked ? (
                      <Text style={styles.overbookedText}>
                        Too full: this would book {vehicle.after}%.
                      </Text>
                    ) : null}
                  </View>
                );
              })
            )}

            {message ? <Text style={styles.messageText}>{message}</Text> : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#f4f5f7',
  },
  topBar: {
    minHeight: 70 + androidTopSystemInset,
    paddingTop: androidTopSystemInset + 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d5dd',
  },
  topAction: {
    minWidth: 72,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 8,
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
    textAlign: 'center',
  },
  cancelText: {
    color: '#475467',
    fontSize: 15,
    fontWeight: '700',
  },
  saveText: {
    color: '#175cd3',
    fontSize: 15,
    fontWeight: '800',
  },
  disabledText: {
    opacity: 0.4,
  },
  content: {
    padding: 16,
    paddingBottom: 50,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  loadingText: {
    color: '#667085',
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCard: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  summaryLabel: {
    marginTop: 4,
    color: '#667085',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    marginTop: 2,
    marginBottom: 7,
    color: '#101828',
    fontSize: 15,
    fontWeight: '800',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 8,
    color: '#101828',
    fontSize: 17,
    fontWeight: '900',
  },
  itemsCard: {
    overflow: 'hidden',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  itemRow: {
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eaecf0',
  },
  itemMain: {
    flex: 1,
  },
  itemCode: {
    color: '#101828',
    fontSize: 14,
    fontWeight: '900',
  },
  itemDescription: {
    marginTop: 2,
    color: '#475467',
    fontSize: 13,
    fontWeight: '600',
  },
  quantityBox: {
    minWidth: 54,
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f2f4f7',
  },
  quantityLabel: {
    color: '#667085',
    fontSize: 10,
    fontWeight: '800',
  },
  quantityValue: {
    marginTop: 1,
    color: '#101828',
    fontSize: 16,
    fontWeight: '900',
  },
  emptyCard: {
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    color: '#101828',
    fontSize: 15,
    fontWeight: '800',
  },
  emptyText: {
    marginTop: 5,
    color: '#667085',
    fontSize: 13,
    lineHeight: 18,
  },
  vehicleCard: {
    marginBottom: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  vehicleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  vehicleName: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '900',
  },
  vehicleMeta: {
    marginTop: 2,
    color: '#667085',
    fontSize: 12,
    fontWeight: '600',
  },
  afterBadge: {
    minWidth: 52,
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 16,
    backgroundColor: '#ecfdf3',
  },
  afterBadgeOver: {
    backgroundColor: '#fef3f2',
  },
  afterBadgeText: {
    color: '#027a48',
    fontSize: 13,
    fontWeight: '900',
  },
  afterBadgeTextOver: {
    color: '#b42318',
  },
  loadBar: {
    position: 'relative',
    height: 12,
    marginTop: 14,
    overflow: 'hidden',
    borderRadius: 6,
    backgroundColor: '#eaecf0',
  },
  bookedBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#667085',
  },
  requestedBar: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    backgroundColor: '#175cd3',
  },
  loadLabel: {
    marginTop: 8,
    color: '#344054',
    fontSize: 12,
    fontWeight: '700',
  },
  stepperRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  stepButton: {
    minHeight: 42,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 9,
    backgroundColor: '#ffffff',
  },
  stepButtonText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '800',
  },
  selectedPercent: {
    minWidth: 64,
    color: '#101828',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
  },
  quickRow: {
    gap: 7,
    paddingTop: 10,
  },
  quickButton: {
    minWidth: 55,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 9,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 18,
    backgroundColor: '#ffffff',
  },
  quickButtonSelected: {
    borderColor: '#101828',
    backgroundColor: '#101828',
  },
  quickButtonText: {
    color: '#475467',
    fontSize: 12,
    fontWeight: '800',
  },
  quickButtonTextSelected: {
    color: '#ffffff',
  },
  overbookedText: {
    marginTop: 8,
    color: '#b42318',
    fontSize: 12,
    fontWeight: '800',
  },
  messageText: {
    marginTop: 12,
    color: '#b42318',
    fontSize: 13,
    fontWeight: '800',
  },
});
