# Paper Job Card OCR

## Supported source documents

The first OCR rules are based on the paper formats currently used by Vorster Unlimited:

- Legacy Rock Pots / DK Pots job cards
- Newer Vorster Unlimited Trading quotes
- Multi-page variants of both formats

The parser uses shared document anchors rather than relying on one fixed page coordinate.

## Imported fields

| App field | Paper source |
| --- | --- |
| Date made | `DATE` |
| Customer name | `TO` customer block; legacy fallback near `Customer VAT No` |
| Job card / quote # | `NUMBER` / QU-style reference |
| Delivery / Collection | Delivery only when an explicit delivery-fee marker is detected; otherwise Collection is selected for review |
| Location | Customer `PHYSICAL ADDRESS` |
| Amount | Prefer `BALANCE DUE`, then `GRAND TOTAL`, then `TOTAL DUE` |
| Delivery date | Deliberately left blank |
| Status | Pending |

## Delivery date rule

The paper document's `DUE DATE` is an accounting/document due date. It is **not** imported as the operational delivery date.

The app's Delivery Date remains a separate planning value chosen with the calendar.

## Multi-page documents

The accounting system repeats identifying information and final totals on later pages. A user can therefore scan any page that includes the header/customer/total information.

The app stores one row per job card or quote. Existing reference numbers are matched before saving so rescanning another page does not intentionally create a second row.

## Scan flow

1. Open **Scan Job Card**.
2. Choose **Paper** (default) or **QR Code**.
3. Fit the whole paper page inside the document guide.
4. Take the photo.
5. OCR runs on-device.
6. Parsed fields are validated.
7. Any uncertain fields are called out.
8. The normal Job Card editor opens for final review.
9. Save through the same repository used by manual and QR entry.

## Extraction safety

- OCR never writes directly to SQLite.
- Customer name and reference number still pass through the normal editor validation.
- Amounts are converted to integer cents.
- Printed handwritten notes are not used as authoritative structured data.
- The product line-item table is intentionally ignored in this first OCR increment because the planner currently stores job-level information only.
