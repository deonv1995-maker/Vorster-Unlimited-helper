import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { JobCard } from '../../domain/jobCard';
import { parseJobCardQr } from './jobCardImport';

interface QrJobCardScannerProps {
  visible: boolean;
  onCancel: () => void;
  onJobScanned: (job: JobCard) => void;
}

export function QrJobCardScanner({
  visible,
  onCancel,
  onJobScanned,
}: QrJobCardScannerProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (visible) {
      setScanLocked(false);
      setErrorMessage('');
    }
  }, [visible]);

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (scanLocked) return;

    setScanLocked(true);
    const parsed = parseJobCardQr(result.data);

    if (!parsed.ok) {
      setErrorMessage(parsed.message);
      return;
    }

    onJobScanned(parsed.job);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onCancel}
    >
      <View style={styles.screen}>
        <View style={styles.topBar}>
          <Pressable onPress={onCancel} accessibilityRole="button">
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Text style={styles.title}>Scan Job Card</Text>
          <View style={styles.topBarSpacer} />
        </View>

        {!permission ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Checking camera permission…</Text>
          </View>
        ) : !permission.granted ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Camera access is required</Text>
            <Text style={styles.stateText}>
              The camera is used only to scan a job card QR code.
            </Text>
            <Pressable
              style={styles.permissionButton}
              onPress={() => {
                void requestPermission();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.permissionButtonText}>Allow Camera</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraContainer}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={scanLocked ? undefined : handleBarcode}
            />

            <View style={styles.overlay}>
              <View style={styles.guide} />
              <Text style={styles.guideTitle}>Point at the job card QR code</Text>
              <Text style={styles.guideText}>
                The details will open for review before anything is saved.
              </Text>

              {errorMessage ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{errorMessage}</Text>
                  <Pressable
                    style={styles.retryButton}
                    onPress={() => {
                      setErrorMessage('');
                      setScanLocked(false);
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.retryButtonText}>Scan Again</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#101828',
  },
  topBar: {
    minHeight: 64,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
  },
  title: {
    color: '#101828',
    fontSize: 18,
    fontWeight: '800',
  },
  cancelText: {
    color: '#475467',
    fontSize: 16,
    fontWeight: '700',
  },
  topBarSpacer: {
    width: 50,
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  guide: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  guideTitle: {
    marginTop: 22,
    color: '#ffffff',
    fontSize: 19,
    fontWeight: '800',
    textAlign: 'center',
  },
  guideText: {
    marginTop: 6,
    maxWidth: 320,
    color: '#eaecf0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 28,
    backgroundColor: '#ffffff',
  },
  stateTitle: {
    color: '#101828',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  stateText: {
    marginTop: 8,
    color: '#667085',
    fontSize: 14,
    textAlign: 'center',
  },
  permissionButton: {
    minHeight: 48,
    marginTop: 20,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#101828',
  },
  permissionButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
  errorCard: {
    width: '100%',
    maxWidth: 360,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ffffff',
  },
  errorText: {
    color: '#b42318',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  retryButton: {
    minHeight: 44,
    marginTop: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#101828',
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
