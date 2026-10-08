import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import {
  ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet,
  Text, View,
} from 'react-native';

import { exportDatabaseBackup, restoreDatabaseBackup } from '../data/backupRepository';
import { BACKUP_MAX_CHARACTERS, parseBackup, type JobBackup } from '../domain/backup';
import { androidTopSystemInset } from '../ui/systemInsets';

interface BackupManagerProps {
  visible: boolean;
  onClose: () => void;
  onRestored: () => Promise<void>;
}

export function BackupManager({ visible, onClose, onRestored }: BackupManagerProps) {
  const db = useSQLiteContext();
  const [busy, setBusy] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<JobBackup | null>(null);
  const [message, setMessage] = useState('');

  const close = () => {
    if (busy) return;
    setSelectedBackup(null);
    setMessage('');
    onClose();
  };

  const exportFile = async () => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('File sharing is not available on this device.');
      }
      const backup = await exportDatabaseBackup(db);
      const filename = 'Vorster-Unlimited-Backup-' +
        new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) + '.json';
      const file = new File(Paths.cache, filename);
      file.create({ overwrite: true });
      file.write(JSON.stringify(backup));

      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save Vorster Unlimited backup',
        UTI: 'public.json',
      });

      // Closing the OS share sheet does NOT prove that a destination saved the file.
      setMessage('Share screen closed. Check that the JSON file is actually saved in Drive or Files before relying on this backup.');
    } catch (error) {
      Alert.alert('Backup could not be shared', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const selectFile = async () => {
    if (busy) return;
    setBusy(true);
    setSelectedBackup(null);
    setMessage('');
    try {
      const selection = await DocumentPicker.getDocumentAsync({
        type: '*/*', copyToCacheDirectory: true, multiple: false,
      });
      if (selection.canceled) return;
      const asset = selection.assets[0];
      if (!asset) throw new Error('No backup file was selected.');
      if (typeof asset.size === 'number' && asset.size > BACKUP_MAX_CHARACTERS * 4) {
        throw new Error('The selected file is too large for this backup format.');
      }

      const file = new File(asset.uri);
      const backup = parseBackup(await file.text());
      setSelectedBackup(backup);
    } catch (error) {
      Alert.alert('Backup could not be read', error instanceof Error ? error.message : 'Choose a valid Vorster Unlimited JSON backup.');
    } finally {
      setBusy(false);
    }
  };

  const restore = () => {
    if (busy || !selectedBackup) return;
    const backup = selectedBackup;
    Alert.alert(
      'Restore on this device?',
      'This restores ' + backup.counts.job_cards +
        ' jobs, their scans, delivery areas and vehicle bookings. It only works on a fresh empty app and will not replace existing jobs.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Restore',
          onPress: () => {
            setBusy(true);
            void (async () => {
              try {
                const count = await restoreDatabaseBackup(db, backup);
                setSelectedBackup(null);
                await onRestored();
                setMessage(count + ' job' + (count === 1 ? '' : 's') +
                  ' restored. Check the planner before making new changes.');
              } catch (error) {
                Alert.alert('Restore not completed', error instanceof Error ? error.message : 'The backup could not be restored.');
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={styles.title}>Backup & Restore</Text>
            <Text style={styles.subtitle}>Keep your orders safe outside this phone.</Text>
          </View>
          <Pressable onPress={close} disabled={busy} accessibilityRole="button" style={styles.close}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>1. Save a backup</Text>
            <Text style={styles.help}>
              Exports job cards, customer and delivery details, scanned OCR text,
              product line items, delivery areas and vehicle allocations.
              Save the JSON file to Drive or Files. The backup contains confidential customer information.
            </Text>
            <Pressable
              style={[styles.primaryButton, busy && styles.disabled]}
              onPress={() => void exportFile()} disabled={busy} accessibilityRole="button"
            >
              <Text style={styles.primaryText}>Export & Share Backup</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>2. Restore on a new or empty installation</Text>
            <Text style={styles.help}>
              Choose a saved Vorster Unlimited backup JSON file. Restore is blocked
              if this app already has orders or modified delivery areas, so it cannot
              silently overwrite the current database.
            </Text>
            <Pressable
              style={[styles.secondaryButton, busy && styles.disabled]}
              onPress={() => void selectFile()} disabled={busy} accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>Choose Backup File</Text>
            </Pressable>

            {selectedBackup ? (
              <View style={styles.preview}>
                <Text style={styles.previewTitle}>Backup preview</Text>
                <Text style={styles.previewText}>
                  {selectedBackup.counts.job_cards} jobs • {selectedBackup.counts.job_card_items} items
                </Text>
                <Text style={styles.previewText}>
                  {selectedBackup.counts.delivery_areas} delivery areas • {selectedBackup.counts.delivery_allocations} vehicle bookings
                </Text>
                <Text style={styles.previewText}>
                  Created: {new Date(selectedBackup.exportedAt).toLocaleString('en-ZA')}
                </Text>
                <Pressable
                  style={[styles.primaryButton, busy && styles.disabled]}
                  onPress={restore} disabled={busy} accessibilityRole="button"
                >
                  <Text style={styles.primaryText}>Restore Selected Backup</Text>
                </Pressable>
              </View>
            ) : null}
          </View>

          <Text style={styles.note}>
            Important: Updating the installed APK normally keeps your existing data.
            Uninstalling the app or clearing app storage can delete it.
            A backup is safe only after you confirm it has been saved outside the app.
          </Text>
          {busy ? <ActivityIndicator size="large" /> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: androidTopSystemInset, backgroundColor: '#f4f5f7' },
  header: {
    backgroundColor: '#ffffff', padding: 16, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between', gap: 10,
  },
  heading: { flex: 1 },
  title: { color: '#101828', fontSize: 23, fontWeight: '800' },
  subtitle: { color: '#667085', fontSize: 12, marginTop: 4 },
  close: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  closeText: { color: '#344054', fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40, gap: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 14, padding: 16, gap: 12 },
  sectionTitle: { color: '#101828', fontSize: 17, fontWeight: '800' },
  help: { color: '#475467', fontSize: 14, lineHeight: 21 },
  primaryButton: {
    minHeight: 48, borderRadius: 10, justifyContent: 'center',
    alignItems: 'center', backgroundColor: '#174c38', paddingHorizontal: 12,
  },
  primaryText: { color: '#ffffff', fontSize: 14, fontWeight: '800' },
  secondaryButton: {
    minHeight: 48, borderRadius: 10, justifyContent: 'center',
    alignItems: 'center', borderWidth: 1, borderColor: '#174c38', paddingHorizontal: 12,
  },
  secondaryText: { color: '#174c38', fontSize: 14, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  preview: { borderTopWidth: 1, borderTopColor: '#e4e7ec', paddingTop: 14, gap: 8 },
  previewTitle: { color: '#101828', fontSize: 15, fontWeight: '800' },
  previewText: { color: '#475467', fontSize: 13 },
  note: { color: '#667085', fontSize: 13, lineHeight: 19 },
  message: {
    color: '#174c38', backgroundColor: '#e6f4ec',
    padding: 14, borderRadius: 10, lineHeight: 20,
  },
});
