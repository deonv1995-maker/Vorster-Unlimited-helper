# Project Architecture

## Product goal

Vorster Unlimited Helper is a mobile-first job-card register and planning app for Vorster Unlimited.

The main screen is intentionally spreadsheet-like: one row represents one job card or quote.

## V1 columns

1. Date made
2. Customer name
3. Job card / quote number
4. Delivery / collection
5. Location
6. Amount (ZAR)
7. Delivery date
8. Status

Delivery date is editable from the table through the native platform date picker.

## V1 status values

- Pending
- In Production
- Ready
- Delivered
- Collected
- On Hold
- Cancelled

## Architecture decisions

- Expo + React Native + TypeScript.
- Android-first, while keeping the codebase portable to iOS.
- Domain types live separately from UI code.
- Job-card scanning/import will feed the same JobCard model used by manual entry.
- Scanner OCR/QR parsing must not write directly to UI state. It will produce a parsed draft that is validated before persistence.
- Persistence will be added behind a repository/service boundary rather than storing data directly inside screen components.
- Main/stable branch should remain runnable; feature work happens on branches and is merged only after checks pass.

## Planned increments

### Increment 1 — planner foundation
- Table layout
- Core job-card data model
- Delivery-date picker
- Stable app scaffold

### Increment 2 — editing and persistence
- Add/edit jobs
- Status picker
- Local database
- Search/filter/sort

### Increment 3 — scanning
- Camera permission flow
- QR-first import
- OCR fallback for legacy paper job cards
- Review screen before saving scanned data

### Increment 4 — planning
- Today / tomorrow / this week filters
- Overdue highlighting
- Delivery/collection planning views
