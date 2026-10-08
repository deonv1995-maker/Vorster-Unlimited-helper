import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import appConfig from '../../app.json';

import { DeliveryCalendarModal } from './DeliveryCalendarModal';
import {
  DELIVERY_AREA_COLOR_PALETTE,
  findDeliveryAreaDefinition,
  type DeliveryArea,
  type DeliveryAreaDefinition,
} from '../domain/deliveryAreas';
import {
  JOB_STATUSES,
  type FulfilmentType,
  type JobCard,
  type JobStatus,
} from '../domain/jobCard';
import { androidTopSystemInset } from '../ui/systemInsets';
import { formatLocalDate } from '../utils/localDate';

interface JobCardEditorProps {
  visible: boolean;
  job: JobCard | null;
  onCancel: () => void;
  onSave: (job: JobCard) => Promise<void>;
  onRemove?: (job: JobCard) => Promise<void>;
  calendarJobs: JobCard[];
  deliveryAreas: DeliveryAreaDefinition[];
  onAddDeliveryArea: (
    name: string,
    color: string,
  ) => Promise<DeliveryAreaDefinition>;
}

export function JobCardEditor({
  visible,
  job,
  onCancel,
  onSave,
  onRemove,
  calendarJobs,
  deliveryAreas,
  onAddDeliveryArea,
}: JobCardEditorProps) {
  const [draft, setDraft] = useState<JobCard | null>(job);
  const [amountText, setAmountText] = useState('');
  const [deliveryFeeText, setDeliveryFeeText] = useState('');
  const [showDeliveryDatePicker, setShowDeliveryDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [validationMessage, setValidationMessage] = useState('');
  const [showAddArea, setShowAddArea] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaColor, setNewAreaColor] = useState<string>(
    DELIVERY_AREA_COLOR_PALETTE[0],
  );
  const [areaSaving, setAreaSaving] = useState(false);
  const [areaError, setAreaError] = useState('');

  useEffect(() => {
    setDraft(job);
    setAmountText(
      job && job.amountCents > 0 ? (job.amountCents / 100).toFixed(2) : '',
    );
    setDeliveryFeeText(
      job?.deliveryFeePercent !== null &&
        job?.deliveryFeePercent !== undefined
        ? String(job.deliveryFeePercent)
        : '',
    );
    setValidationMessage('');
    setRemoving(false);
    setShowDeliveryDatePicker(false);
    setShowAddArea(false);
    setNewAreaName('');
    setNewAreaColor(DELIVERY_AREA_COLOR_PALETTE[0]);
    setAreaError('');
  }, [job, visible]);

  if (!draft) return null;

  const updateDraft = <K extends keyof JobCard>(key: K, value: JobCard[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const chooseFulfilment = (value: FulfilmentType) => {
    updateDraft('fulfilmentType', value);
  };

  const chooseStatus = (value: JobStatus) => {
    updateDraft('status', value);
  };

  const chooseDeliveryArea = (value: DeliveryArea) => {
    updateDraft('deliveryArea', value);
  };

  const areaOptions = deliveryAreas.some(
    (area) => area.name === draft.deliveryArea,
  )
    ? deliveryAreas
    : [
        ...deliveryAreas,
        findDeliveryAreaDefinition([], draft.deliveryArea),
      ];

  const handleAddDeliveryArea = async () => {
    setAreaSaving(true);
    setAreaError('');

    try {
      const created = await onAddDeliveryArea(newAreaName, newAreaColor);
      chooseDeliveryArea(created.name);
      setNewAreaName('');
      setNewAreaColor(DELIVERY_AREA_COLOR_PALETTE[0]);
      setShowAddArea(false);
    } catch (error) {
      setAreaError(
        error instanceof Error
          ? error.message
          : 'The delivery area could not be added.',
      );
    } finally {
      setAreaSaving(false);
    }
  };

  const handleSave = async () => {
    const customerName = draft.customerName.trim();
    const referenceNumber = draft.referenceNumber.trim();
    const amountRand = Number(amountText.replace(',', '.'));
    const feePercent =
      deliveryFeeText.trim() === ''
        ? null
        : Number(deliveryFeeText.replace(',', '.'));

    if (!customerName || !referenceNumber) {
      setValidationMessage('Customer name and job card / quote number are required.');
      return;
    }

    if (!Number.isFinite(amountRand) || amountRand < 0) {
      setValidationMessage('Enter a valid amount.');
      return;
    }

    if (
      feePercent !== null &&
      (!Number.isFinite(feePercent) || feePercent < 0 || feePercent > 100)
    ) {
      setValidationMessage('Delivery fee percentage must be between 0 and 100.');
      return;
    }

    setSaving(true);
    setValidationMessage('');

    try {
      await onSave({
        ...draft,
        customerName,
        referenceNumber,
        location: draft.location.trim(),
        deliveryInstructions: draft.deliveryInstructions.trim(),
        deliveryFeePercent: feePercent,
        amountCents: Math.round(amountRand * 100),
      });
    } catch (error) {
      setValidationMessage(
        error instanceof Error ? error.message : 'The job card could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const confirmRemove = () => {
    if (!onRemove) return;

    Alert.alert(
      'Remove order?',
      `Remove ${draft.customerName || 'this order'} #${draft.referenceNumber || ''} from the list? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setRemoving(true);
            void onRemove(draft).finally(() => setRemoving(false));
          },
        },
      ],
    );
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
            accessibilityRole="button"
            style={styles.topAction}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Job Card</Text>
            <Text style={styles.buildLabel}>
              Build {appConfig.expo.android.versionCode}
            </Text>
          </View>
          <Pressable
            onPress={handleSave}
            accessibilityRole="button"
            disabled={saving}
            style={styles.topAction}
          >
            <Text style={[styles.saveText, saving && styles.disabledText]}>
              {saving ? 'Saving…' : 'Save'}
            </Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <FieldLabel text="Date made" />
          <View style={styles.readOnlyField}>
            <Text style={styles.readOnlyText}>{formatLocalDate(draft.dateMade)}</Text>
          </View>

          <FieldLabel text="Customer name" />
          <TextInput
            value={draft.customerName}
            onChangeText={(value) => updateDraft('customerName', value)}
            placeholder="Customer name"
            style={styles.input}
            autoCapitalize="words"
          />

          <FieldLabel text="Job card / Quote number" />
          <TextInput
            value={draft.referenceNumber}
            onChangeText={(value) => updateDraft('referenceNumber', value)}
            placeholder="Example: 77"
            style={styles.input}
            keyboardType="number-pad"
          />

          <FieldLabel text="Delivery / Collection" />
          <View style={styles.optionRow}>
            {(['Delivery', 'Collection'] as const).map((value) => (
              <OptionButton
                key={value}
                label={value}
                selected={draft.fulfilmentType === value}
                onPress={() => chooseFulfilment(value)}
              />
            ))}
          </View>

          {draft.fulfilmentType === 'Delivery' ? (
            <>
              <FieldLabel text="Delivery area" />
              <View style={styles.areaWrap}>
                {areaOptions.map((area) => {
                  const selected = draft.deliveryArea === area.name;

                  return (
                    <Pressable
                      key={area.name}
                      onPress={() => chooseDeliveryArea(area.name)}
                      style={[
                        styles.areaButton,
                        {
                          borderColor: area.color,
                          backgroundColor: selected ? area.color : '#ffffff',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View
                        style={[
                          styles.areaButtonDot,
                          {
                            backgroundColor: selected
                              ? area.textColor
                              : area.color,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.areaButtonText,
                          { color: selected ? area.textColor : '#344054' },
                        ]}
                      >
                        {area.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable
                style={styles.addAreaButton}
                onPress={() => {
                  setShowAddArea((current) => !current);
                  setAreaError('');
                }}
                accessibilityRole="button"
              >
                <Text style={styles.addAreaButtonText}>
                  {showAddArea ? 'Cancel new area' : '+ Add delivery area'}
                </Text>
              </Pressable>

              {showAddArea ? (
                <View style={styles.addAreaCard}>
                  <Text style={styles.addAreaTitle}>New delivery area</Text>
                  <TextInput
                    value={newAreaName}
                    onChangeText={setNewAreaName}
                    placeholder="Example: West Rand"
                    style={styles.input}
                    autoCapitalize="words"
                    maxLength={40}
                  />

                  <Text style={styles.colourLabel}>Choose colour</Text>
                  <View style={styles.colourWrap}>
                    {DELIVERY_AREA_COLOR_PALETTE.map((color) => {
                      const selected = newAreaColor === color;

                      return (
                        <Pressable
                          key={color}
                          onPress={() => setNewAreaColor(color)}
                          style={[
                            styles.colourSwatchOuter,
                            selected && styles.colourSwatchSelected,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Choose colour ${color}`}
                        >
                          <View
                            style={[
                              styles.colourSwatch,
                              { backgroundColor: color },
                            ]}
                          />
                        </Pressable>
                      );
                    })}
                  </View>

                  {areaError ? (
                    <Text style={styles.areaErrorText}>{areaError}</Text>
                  ) : null}

                  <Pressable
                    style={[
                      styles.saveAreaButton,
                      areaSaving && styles.disabledText,
                    ]}
                    onPress={() => {
                      void handleAddDeliveryArea();
                    }}
                    disabled={areaSaving}
                    accessibilityRole="button"
                  >
                    <Text style={styles.saveAreaButtonText}>
                      {areaSaving ? 'Adding…' : 'Add area'}
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </>
          ) : null}

          <FieldLabel text="Delivery instructions" />
          <TextInput
            value={draft.deliveryInstructions}
            onChangeText={(value) => updateDraft('deliveryInstructions', value)}
            placeholder="Example: Call Before Delivery"
            style={[styles.input, styles.multilineInput]}
            autoCapitalize="sentences"
            multiline
          />

          <FieldLabel text="Delivery fee %" />
          <TextInput
            value={deliveryFeeText}
            onChangeText={setDeliveryFeeText}
            placeholder="Example: 15"
            style={styles.input}
            keyboardType="decimal-pad"
          />

          <FieldLabel text="Amount R" />
          <TextInput
            value={amountText}
            onChangeText={setAmountText}
            placeholder="0.00"
            style={styles.input}
            keyboardType="decimal-pad"
          />

          <FieldLabel text="Delivery date" />
          <Pressable
            style={styles.dateButton}
            onPress={() => setShowDeliveryDatePicker(true)}
            accessibilityRole="button"
          >
            <Text style={styles.dateButtonText}>
              {formatLocalDate(draft.deliveryDate)}
            </Text>
          </Pressable>

          <FieldLabel text="Status" />
          <View style={styles.statusWrap}>
            {JOB_STATUSES.map((status) => (
              <OptionButton
                key={status}
                label={status}
                selected={draft.status === status}
                onPress={() => chooseStatus(status)}
              />
            ))}
          </View>

          {validationMessage ? (
            <Text style={styles.validationText}>{validationMessage}</Text>
          ) : null}

          {onRemove ? (
            <Pressable
              style={[styles.removeButton, removing && styles.disabledText]}
              onPress={confirmRemove}
              accessibilityRole="button"
              disabled={removing || saving}
            >
              <Text style={styles.removeButtonText}>
                {removing ? 'Removing…' : 'Remove order'}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>

        <DeliveryCalendarModal
          visible={showDeliveryDatePicker}
          selectedDate={draft.deliveryDate}
          jobs={calendarJobs}
          deliveryAreas={deliveryAreas}
          currentJobId={draft.id}
          onCancel={() => setShowDeliveryDatePicker(false)}
          onSelectDate={(date) => {
            updateDraft('deliveryDate', date);
            setShowDeliveryDatePicker(false);
          }}
        />
      </View>
    </Modal>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={styles.label}>{text}</Text>;
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.optionButton, selected && styles.optionButtonSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
        {label}
      </Text>
    </Pressable>
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
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#d0d5dd',
  },
  topAction: {
    minWidth: 74,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleBlock: {
    alignItems: 'center',
  },
  title: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '800',
  },
  buildLabel: {
    marginTop: 1,
    color: '#667085',
    fontSize: 10,
    fontWeight: '700',
  },
  cancelText: {
    color: '#475467',
    fontSize: 16,
    fontWeight: '600',
  },
  saveText: {
    color: '#175cd3',
    fontSize: 16,
    fontWeight: '800',
  },
  disabledText: {
    opacity: 0.5,
  },
  content: {
    padding: 16,
    paddingBottom: 96,
  },
  label: {
    marginTop: 14,
    marginBottom: 6,
    color: '#344054',
    fontSize: 13,
    fontWeight: '700',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    backgroundColor: '#ffffff',
    color: '#101828',
    fontSize: 16,
  },
  multilineInput: {
    minHeight: 76,
    textAlignVertical: 'top',
  },
  readOnlyField: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#eaecf0',
  },
  readOnlyText: {
    color: '#475467',
    fontSize: 16,
    fontWeight: '600',
  },
  optionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  areaWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  areaButton: {
    minHeight: 42,
    minWidth: 116,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    borderWidth: 2,
    borderRadius: 10,
  },
  areaButtonDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  areaButtonText: {
    fontSize: 14,
    fontWeight: '800',
  },
  addAreaButton: {
    minHeight: 42,
    marginTop: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#98a2b3',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  addAreaButtonText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '800',
  },
  addAreaCard: {
    marginTop: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  addAreaTitle: {
    marginBottom: 8,
    color: '#101828',
    fontSize: 15,
    fontWeight: '900',
  },
  colourLabel: {
    marginTop: 12,
    marginBottom: 7,
    color: '#475467',
    fontSize: 12,
    fontWeight: '800',
  },
  colourWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colourSwatchOuter: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: 18,
  },
  colourSwatchSelected: {
    borderColor: '#101828',
  },
  colourSwatch: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  areaErrorText: {
    marginTop: 10,
    color: '#b42318',
    fontSize: 12,
    fontWeight: '800',
  },
  saveAreaButton: {
    minHeight: 44,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#101828',
  },
  saveAreaButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  statusWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    minHeight: 42,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  optionButtonSelected: {
    borderColor: '#101828',
    backgroundColor: '#101828',
  },
  optionText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '700',
  },
  optionTextSelected: {
    color: '#ffffff',
  },
  dateButton: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  dateButtonText: {
    color: '#175cd3',
    fontSize: 16,
    fontWeight: '700',
  },
  validationText: {
    marginTop: 16,
    color: '#b42318',
    fontSize: 14,
    fontWeight: '700',
  },
  removeButton: {
    minHeight: 48,
    marginTop: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d92d20',
    borderRadius: 10,
    backgroundColor: '#ffffff',
  },
  removeButtonText: {
    color: '#b42318',
    fontSize: 15,
    fontWeight: '800',
  },
});
