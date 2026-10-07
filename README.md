# Vorster Unlimited Helper

Mobile-first production and job-card planning app for Vorster Unlimited.

## First release scope

The first release is intentionally focused on a reliable job-card register:

- Spreadsheet-style job list
- Date made
- Customer name
- Job card / quote number
- Delivery or collection
- Location
- Amount (R)
- Delivery date with calendar selection
- Status
- Foundation for scanning/importing job-card information

See `docs/PROJECT.md` for architecture and product decisions.


## Paper job-card scanning

Paper OCR runs fully on-device using the phone camera. Because OCR uses a custom native module, this feature requires an Android/iOS development or production build; it does not run inside Expo Go.

The scanner supports both legacy Rock Pots / DK Pots job cards and current Vorster Unlimited quote layouts. Scanned values always open in the normal Job Card editor for review before saving.


## Android test APK

GitHub Actions builds a standalone Android APK from the current native configuration. The build runs TypeScript validation, generates the Android project with Expo Prebuild, compiles the release variant, and uploads `app-release.apk` as the `vorster-unlimited-helper-android-test` workflow artifact.

This APK is intended for direct device testing of camera, SQLite, QR scanning, and on-device paper OCR. It is not a Play Store release and should not be treated as the production signing setup.
