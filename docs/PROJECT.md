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
- SQLite schema migrations are versioned. Schema v2 adds structured delivery instructions, delivery-fee percentage, and per-job source-page OCR storage.

### Increment 3 — scanning
- Camera permission flow
- QR-first import using the versioned `vu-job-card/v1` contract
- Duplicate-safe matching by job card / quote reference number
- Review in the normal Job Card editor before saving
- On-device paper OCR supports the legacy Rock Pots / DK Pots job-card layout and the current Vorster Unlimited quote layout
- Paper OCR extracts the TO customer, normalized trailing document number, delivery address/instructions/fee, amount, and shared job-level fields, then always routes through the normal editor for review
- Paper scanning supports multi-page sessions and persists each page's raw OCR text for future line-item extraction
- Printed Due Date is not mapped to Delivery Date; the app keeps operational delivery planning separate

### Increment 4 — planning
- Independent delivery-date filters: All / Today / Tomorrow / This Week / Overdue
- Delivery filters can be combined with status and search filters
- Overdue, today, tomorrow, and completed delivery dates have distinct visual states
- Planning comparisons use date-only values, not timestamps, to avoid timezone rollover
- "This Week" means today through the coming Sunday


## Order removal

Existing saved orders can be removed from the Job Card editor. Removal requires an explicit destructive confirmation. Deleting a job also deletes its persisted multi-page OCR source data so no orphaned scan records remain. Unsaved new jobs do not show the Remove order action.
