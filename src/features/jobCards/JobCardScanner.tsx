import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { isSupported, recognizeText } from 'expo-mlkit-ocr';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { JobCard } from '../../domain/jobCard';
import { parseJobCardQr } from './jobCardImport';
import { parsePaperJobCardText } from './paperJobCardImport';

type ScanMode = 'paper' | 'qr';

interface JobCardScannerProps {
  visible: boolean;
  onCancel: () => void;
  onJobScanned: (job: JobCard) => void;
}

interface PendingPaperResult {
  job: JobCard;
  warnings: string[];
}

export function JobCardScanner({
  visible,
  onCancel,
  onJobScanned,
}: JobCardScannerProps) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [mode, setMode] = useState<ScanMode>('paper');
  const [scanLocked, setScanLocked] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingPaperResult, setPendingPaperResult] =
    useState<PendingPaperResult | null>(null);

  useEffect(() => {
    if (visible) {
      setMode('paper');
      setScanLocked(false);
      setProcessing(false);
      setErrorMessage('');
      setPendingPaperResult(null);
    }
  }, [visible]);

  const resetScanState = () => {
    setScanLocked(false);
    setProcessing(false);
    setErrorMessage('');
    setPendingPaperResult(null);
  };

  const switchMode = (nextMode: ScanMode) => {
    setMode(nextMode);
    resetScanState();
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (mode !== 'qr' || scanLocked || processing) return;

    setScanLocked(true);
    const parsed = parseJobCardQr(result.data);

    if (!parsed.ok) {
      setErrorMessage(parsed.message);
      return;
    }

    onJobScanned(parsed.job);
  };

  const capturePaperJobCard = async () => {
    if (!cameraRef.current || processing) return;

    if (!isSupported()) {
      setErrorMessage('OCR is not supported on this device.');
      return;
    }

    setProcessing(true);
    setErrorMessage('');
    setPendingPaperResult(null);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.9,
        skipProcessing: false,
      });

      if (!photo?.uri) {
        setErrorMessage('The photo could not be captured. Please try again.');
        return;
      }

      const recognition = await recognizeText(photo.uri);
      const parsed = parsePaperJobCardText(recognition.text);

      if (!parsed.ok) {
        setErrorMessage(parsed.message);
        return;
      }

      if (parsed.warnings.length) {
        setPendingPaperResult({
          job: parsed.job,
          warnings: parsed.warnings,
        });
        return;
      }

      onJobScanned(parsed.job);
    } catch {
      setErrorMessage(
        'The paper job card could not be read. Hold the phone square to the page and try again.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const cameraReady = permission?.granted === true;

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

        <View style={styles.modeBar}>
          <ModeButton
            label="Paper"
            selected={mode === 'paper'}
            onPress={() => switchMode('paper')}
          />
          <ModeButton
            label="QR Code"
            selected={mode === 'qr'}
            onPress={() => switchMode('qr')}
          />
        </View>

        {!permission ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Checking camera permission…</Text>
          </View>
        ) : !cameraReady ? (
          <View style={styles.centerState}>
            <Text style={styles.stateTitle}>Camera access is required</Text>
            <Text style={styles.stateText}>
              The camera is used to read paper job cards and scan job-card QR codes.
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
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={
                mode === 'qr' ? { barcodeTypes: ['qr'] } : undefined
              }
              onBarcodeScanned={
                mode === 'qr' && !scanLocked ? handleBarcode : undefined
              }
            />

            <View style={styles.overlay} pointerEvents="box-none">
              {mode === 'paper' ? (
                <>
                  <View style={styles.documentGuide} />
                  <Text style={styles.guideTitle}>Fit one full page inside the frame</Text>
                  <Text style={styles.guideText}>
                    Keep the page flat, square to the camera, and in good light.
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.qrGuide} />
                  <Text style={styles.guideTitle}>Point at the job-card QR code</Text>
                  <Text style={styles.guideText}>
                    QR details will open for review before saving.
                  </Text>
                </>
              )}
            </View>

            {mode === 'paper' && !pendingPaperResult ? (
              <View style={styles.captureBar}>
                <Pressable
                  style={[
                    styles.captureButton,
                    processing && styles.captureButtonDisabled,
                  ]}
                  onPress={() => {
                    void capturePaperJobCard();
                  }}
                  disabled={processing}
                  accessibilityRole="button"
                >
                  {processing ? (
                    <ActivityIndicator />
                  ) : (
                    <View style={styles.captureButtonInner} />
                  )}
                </Pressable>
                <Text style={styles.captureLabel}>
                  {processing ? 'Reading document…' : 'Take photo'}
                </Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.messageCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <Pressable
                  style={styles.retryButton}
                  onPress={resetScanState}
                  accessibilityRole="button"
                >
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </Pressable>
              </View>
            ) : null}

            {pendingPaperResult ? (
              <View style={styles.messageCard}>
                <Text style={styles.warningTitle}>Please check these fields</Text>
                <ScrollView style={styles.warningList}>
                  {pendingPaperResult.warnings.map((warning) => (
                    <Text key={warning} style={styles.warningText}>
                      • {warning}
                    </Text>
                  ))}
                </ScrollView>
                <View style={styles.warningActions}>
                  <Pressable
                    style={styles.secondaryButton}
                    onPress={resetScanState}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={styles.reviewButton}
                    onPress={() => onJobScanned(pendingPaperResult.job)}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reviewButtonText}>Review Details</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
          </View>
        )}
      </View>
    </Modal>
  );
}

function ModeButton({
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
      style={[styles.modeButton, selected && styles.modeButtonSelected]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.modeText, selected && styles.modeTextSelected]}>
        {label}
      </Text>
    </Pressable>
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
  modeBar: {
    flexDirection: 'row',
    gap: 8,
    padding: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eaecf0',
  },
  modeButton: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  modeButtonSelected: {
    borderColor: '#101828',
    backgroundColor: '#101828',
  },
  modeText: {
    color: '#475467',
    fontSize: 14,
    fontWeight: '800',
  },
  modeTextSelected: {
    color: '#ffffff',
  },
  cameraContainer: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 118,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  documentGuide: {
    width: 285,
    height: 405,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 14,
    backgroundColor: 'transparent',
  },
  qrGuide: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#ffffff',
    borderRadius: 22,
    backgroundColor: 'transparent',
  },
  guideTitle: {
    marginTop: 18,
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
  },
  guideText: {
    marginTop: 6,
    maxWidth: 330,
    color: '#eaecf0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  captureBar: {
    position: 'absolute',
    right: 0,
    bottom: 18,
    left: 0,
    alignItems: 'center',
  },
  captureButton: {
    width: 74,
    height: 74,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 5,
    borderColor: '#ffffff',
    borderRadius: 37,
    backgroundColor: 'rgba(16,24,40,0.25)',
  },
  captureButtonDisabled: {
    opacity: 0.65,
  },
  captureButtonInner: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#ffffff',
  },
  captureLabel: {
    marginTop: 6,
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
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
  messageCard: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    left: 18,
    maxHeight: 270,
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
  warningTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '800',
  },
  warningList: {
    marginTop: 8,
  },
  warningText: {
    marginBottom: 5,
    color: '#475467',
    fontSize: 13,
    lineHeight: 18,
  },
  warningActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryButton: {
    minHeight: 44,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#d0d5dd',
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#344054',
    fontSize: 14,
    fontWeight: '800',
  },
  reviewButton: {
    minHeight: 44,
    flex: 1.4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#101828',
  },
  reviewButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
});
