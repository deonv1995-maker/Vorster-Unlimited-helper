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
- Local SQLite database behind a repository boundary
- Search and operational filters
- Jobs sorted by delivery date, then date made

Implementation notes:
- Money is stored as integer cents and formatted as ZAR in the UI.
- Date-made and delivery-date values are stored as date-only `YYYY-MM-DD` values to avoid timezone rollover.
- Manual entry and future scanner imports write through the same `JobCard` model and repository.
- SQLite schema version starts at `user_version = 1`; future schema changes must use migrations rather than replacing the table.

### Increment 3 — scanning
- Camera permission flow
- QR-first import using the versioned `vu-job-card/v1` contract
- Duplicate-safe matching by job card / quote reference number
- Review in the normal Job Card editor before saving
- OCR fallback for legacy paper job cards remains planned; implement against an actual Vorster Unlimited job-card sample so extraction rules match the real document

### Increment 4 — planning
- Today / tomorrow / this week filters
- Overdue highlighting
- Delivery/collection planning views
