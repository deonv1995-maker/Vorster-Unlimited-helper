# Project Architecture

## Product goal

Vorster Unlimited Helper is a mobile-first job-card register and planning app for Vorster Unlimited.

The main screen is intentionally spreadsheet-like: one row represents one job card or quote.

## V1 columns

1. Date made
2. Customer name
3. Job card / quote number
4. Delivery / collection
5. Delivery area
6. Amount (ZAR)
7. Delivery date
8. Status

Delivery date is edited through the app's delivery-planning calendar, which can show colour dots for areas already booked on each date.

## Job status values

- Pending
- Scheduled
- In Production
- In Dispatch
- Ready
- Delivered
- Collected
- On Hold
- Canceled

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
- SQLite schema migrations are versioned. Schema v2 adds structured delivery instructions, delivery-fee percentage, and per-job source-page OCR storage. Schema v3 adds the delivery-area planning field while retaining the scanned street address as background route data.

### Increment 3 — scanning
- Camera permission flow
- QR-first import using the versioned `vu-job-card/v1` contract
- Duplicate-safe matching by job card / quote reference number
- Review in the normal Job Card editor before saving
- On-device paper OCR supports the legacy Rock Pots / DK Pots job-card layout and the current Vorster Unlimited quote layout
- Paper OCR extracts the TO customer, normalized trailing document number, delivery address/instructions/fee, amount, and shared job-level fields. The address is used to infer the planning area and is retained for future routing, while the user plans with Area rather than the raw address.
- Paper scanning supports multi-page sessions and persists each page's raw OCR text for future line-item extraction
- Printed Due Date is not mapped to Delivery Date; the app keeps operational delivery planning separate

### Increment 4 — planning
- Independent delivery-date filters: All / Today / Tomorrow / This Week / Overdue
- Delivery filters can be combined with status and search filters
- Overdue, today, tomorrow, and completed delivery dates have distinct visual states
- Planning comparisons use date-only values, not timestamps, to avoid timezone rollover
- "This Week" means today through the coming Sunday
- Delivery areas are persistent user-managed data. The app seeds Pretoria green, Centurion light green, East Rand blue, Alberton light blue, and Other grey.
- New delivery areas can be created directly from the Job Card Delivery Area section by entering a name and selecting a colour.
- The same saved area colour is used in the planner table and delivery-date calendar.
- The delivery-date calendar shows one coloured dot per area already scheduled on each date, excluding the job currently being edited and closed/canceled deliveries


## Order removal

Existing saved orders can be removed from the Job Card editor. Removal requires an explicit destructive confirmation. Deleting a job also deletes its persisted multi-page OCR source data so no orphaned scan records remain. Unsaved new jobs do not show the Remove order action.


### Increment 5 — order contents and vehicle capacity

- Scanned OCR pages are the source of truth for order line items.
- Structured order items are stored separately from the JobCard row as code, description, quantity, page number, and display order.
- Existing scanned jobs are backfilled on demand the first time the Amount cell is opened.
- Tapping **Amount R** opens the Order Load screen instead of the basic Job Card editor.
- The Order Load screen shows scanned items and quantities plus delivery vehicle capacity controls.
- Vehicle allocations are stored separately from JobCard data so an order can be split across more than one vehicle.
- The initial fleet model is Vehicle 1 and Vehicle 2; vehicle identity is centralized so names can be replaced later without changing allocation records.
- Vehicle load is selected in 5% steps or quick values (0/25/50/75/100).
- Capacity is enforced per delivery date and vehicle. Saving an allocation that would make a vehicle exceed 100% is rejected.
- Changing a delivery date also revalidates any existing vehicle allocations before the date change is saved.
- Rescanning a job invalidates its derived structured item rows while preserving the OCR source pages as the source of truth.


### Increment 6 — configurable areas and expanded workflow

- SQLite schema v5 stores delivery areas as records rather than a compile-time list.
- Default delivery areas are seeded during migration, while user-created areas persist across app restarts and updates.
- Imported/scanned jobs with a previously unknown area automatically register that area with a neutral grey colour so the JobCard never references an unavailable area.
- Area names are unique case-insensitively.
- The status workflow is now Pending → Scheduled → In Production → In Dispatch → Ready → Delivered / Collected, with On Hold and Canceled available as exception states.
- Existing `Cancelled` rows migrate automatically to `Canceled`.
