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

import type { JobCard, JobCardSourcePage } from '../../domain/jobCard';
import { parseJobCardQr } from './jobCardImport';
import { parsePaperJobCardPages } from './paperJobCardImport';

type ScanMode = 'paper' | 'qr';

export interface JobCardScanResult {
  job: JobCard;
  sourcePages?: JobCardSourcePage[];
}

interface JobCardScannerProps {
  visible: boolean;
  onCancel: () => void;
  onJobScanned: (result: JobCardScanResult) => void;
}

interface PendingPaperResult {
  job: JobCard | null;
  warnings: string[];
  sourcePages: JobCardSourcePage[];
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
  const [capturedPages, setCapturedPages] = useState<JobCardSourcePage[]>([]);
  const [pendingPaperResult, setPendingPaperResult] =
    useState<PendingPaperResult | null>(null);

  useEffect(() => {
    if (visible) {
      setMode('paper');
      setScanLocked(false);
      setProcessing(false);
      setErrorMessage('');
      setCapturedPages([]);
      setPendingPaperResult(null);
    }
  }, [visible]);

  const resetSession = () => {
    setScanLocked(false);
    setProcessing(false);
    setErrorMessage('');
    setCapturedPages([]);
    setPendingPaperResult(null);
  };

  const switchMode = (nextMode: ScanMode) => {
    setMode(nextMode);
    resetSession();
  };

  const handleBarcode = (result: BarcodeScanningResult) => {
    if (mode !== 'qr' || scanLocked || processing) return;

    setScanLocked(true);
    const parsed = parseJobCardQr(result.data);

    if (!parsed.ok) {
      setErrorMessage(parsed.message);
      return;
    }

    onJobScanned({ job: parsed.job });
  };

  const capturePaperPage = async () => {
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

      if (!recognition.text.trim()) {
        setErrorMessage(
          'No readable text was found. Move closer, keep the page flat, and try again.',
        );
        return;
      }

      const nextPage: JobCardSourcePage = {
        pageNumber: capturedPages.length + 1,
        rawText: recognition.text,
        capturedAt: new Date().toISOString(),
      };
      const nextPages = [...capturedPages, nextPage];
      const parsed = parsePaperJobCardPages(
        nextPages.map((page) => page.rawText),
      );

      setCapturedPages(nextPages);

      if (!parsed.ok) {
        setPendingPaperResult({
          job: null,
          warnings: [parsed.message],
          sourcePages: nextPages,
        });
        return;
      }

      setPendingPaperResult({
        job: parsed.job,
        warnings: parsed.warnings,
        sourcePages: nextPages,
      });
    } catch {
      setErrorMessage(
        'The paper job card could not be read. Hold the phone square to the page and try again.',
      );
    } finally {
      setProcessing(false);
    }
  };

  const retakeLastPage = () => {
    setCapturedPages((current) => current.slice(0, -1));
    setPendingPaperResult(null);
    setErrorMessage('');
  };

  const addAnotherPage = () => {
    setPendingPaperResult(null);
    setErrorMessage('');
  };

  const finishPaperScan = () => {
    if (!pendingPaperResult?.job) {
      setErrorMessage(
        'The captured pages do not contain enough header information yet. Add a page with the job-card header.',
      );
      setPendingPaperResult(null);
      return;
    }

    onJobScanned({
      job: pendingPaperResult.job,
      sourcePages: pendingPaperResult.sourcePages,
    });
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

            <View style={styles.overlay} pointerEvents="none">
              {mode === 'paper' ? (
                <>
                  <View style={styles.documentGuide} />
                  <Text style={styles.guideTitle}>Fit the full page inside the frame</Text>
                  <Text style={styles.guideText}>
                    Keep the page flat and square. You can capture all pages before review.
                  </Text>
                  {capturedPages.length ? (
                    <Text style={styles.pageCount}>
                      {capturedPages.length} page{capturedPages.length === 1 ? '' : 's'} captured
                    </Text>
                  ) : null}
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

            {mode === 'paper' && !pendingPaperResult && !errorMessage ? (
              <View style={styles.captureBar}>
                <Pressable
                  style={[
                    styles.captureButton,
                    processing && styles.captureButtonDisabled,
                  ]}
                  onPress={() => {
                    void capturePaperPage();
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
                  {processing
                    ? 'Reading page…'
                    : capturedPages.length
                      ? `Capture page ${capturedPages.length + 1}`
                      : 'Capture page 1'}
                </Text>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.messageCard}>
                <Text style={styles.errorText}>{errorMessage}</Text>
                <View style={styles.warningActions}>
                  {capturedPages.length ? (
                    <Pressable
                      style={styles.secondaryButton}
                      onPress={addAnotherPage}
                      accessibilityRole="button"
                    >
                      <Text style={styles.secondaryButtonText}>Add Page</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={styles.reviewButton}
                    onPress={() => {
                      setErrorMessage('');
                    }}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reviewButtonText}>Try Again</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {pendingPaperResult ? (
              <View style={styles.messageCard}>
                <Text style={styles.warningTitle}>
                  Page {pendingPaperResult.sourcePages.length} captured
                </Text>

                {pendingPaperResult.job ? (
                  <Text style={styles.previewText}>
                    Job #{pendingPaperResult.job.referenceNumber}
                    {pendingPaperResult.job.customerName
                      ? ` • ${pendingPaperResult.job.customerName}`
                      : ''}
                  </Text>
                ) : null}

                {pendingPaperResult.warnings.length ? (
                  <ScrollView style={styles.warningList}>
                    {pendingPaperResult.warnings.map((warning) => (
                      <Text key={warning} style={styles.warningText}>
                        • {warning}
                      </Text>
                    ))}
                  </ScrollView>
                ) : (
                  <Text style={styles.successText}>
                    Main job details were read successfully.
                  </Text>
                )}

                <View style={styles.threeActions}>
                  <Pressable
                    style={styles.compactSecondaryButton}
                    onPress={retakeLastPage}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Retake</Text>
                  </Pressable>
                  <Pressable
                    style={styles.compactSecondaryButton}
                    onPress={addAnotherPage}
                    accessibilityRole="button"
                  >
                    <Text style={styles.secondaryButtonText}>Add Page</Text>
                  </Pressable>
                  <Pressable
                    style={styles.finishButton}
                    onPress={finishPaperScan}
                    accessibilityRole="button"
                  >
                    <Text style={styles.reviewButtonText}>Finish</Text>
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
    maxWidth: 340,
    color: '#eaecf0',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pageCount: {
    marginTop: 9,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.9)',
    color: '#101828',
    fontSize: 13,
    fontWeight: '800',
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
    maxHeight: 300,
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
  warningTitle: {
    color: '#101828',
    fontSize: 16,
    fontWeight: '800',
  },
  previewText: {
    marginTop: 5,
    color: '#344054',
    fontSize: 14,
    fontWeight: '700',
  },
  successText: {
    marginTop: 8,
    color: '#027a48',
    fontSize: 13,
    fontWeight: '700',
  },
  warningList: {
    marginTop: 8,
    maxHeight: 95,
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
  threeActions: {
    flexDirection: 'row',
    gap: 7,
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
  compactSecondaryButton: {
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
    fontSize: 13,
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
  finishButton: {
    minHeight: 44,
    flex: 1.15,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: '#101828',
  },
  reviewButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
});
