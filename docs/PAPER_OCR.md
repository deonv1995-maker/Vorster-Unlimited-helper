# Paper Job Card OCR

## Supported source documents

The OCR rules are based on the paper formats currently used by Vorster Unlimited:

- Legacy Rock Pots / DK Pots job cards
- Current Vorster Unlimited Trading quotes
- Multi-page variants of both formats

The parser uses document anchors rather than one fixed page coordinate.

## Imported fields

| App field | Paper source |
| --- | --- |
| Date made | `DATE` |
| Customer name | Customer name under the `TO` block |
| Job card / quote # | Numeric tail of `NUMBER`; leading zero padding and QU/JC prefixes are removed |
| Delivery / Collection | Delivery when a delivery fee or delivery instruction is detected |
| Delivery area | Inferred from the customer `PHYSICAL ADDRESS`; the raw address is retained only for future routing/directions |
| Delivery instructions | Recognized instructions such as `Call Before Delivery` |
| Delivery fee % | `Delivery Fee: n%` |
| Amount | Prefer `BALANCE DUE`, then `GRAND TOTAL`, then `TOTAL DUE` |
| Delivery date | Deliberately left blank |
| Status | Pending |

Example: printed number `QU00000077` is stored and displayed as job/quote number `77`.

Customer codes printed after the TO name, such as `:CRE002` or `:MGC026`, are not included in the customer display name.

## Delivery date rule

The paper document's `DUE DATE` is an accounting/document due date. It is **not** imported as the operational Delivery Date.

The app's Delivery Date remains a separate planning value chosen with the calendar.

## Multi-page capture

Paper scanning is a capture session rather than a one-photo action:

1. Capture page 1.
2. Choose **Retake**, **Add Page**, or **Finish**.
3. Repeat **Add Page** for the remaining pages.
4. Finish only when all useful pages have been captured.
5. Review the combined job-level fields in the normal Job Card editor.
6. Saving the job also stores the raw OCR text of every captured page in page order.

The stored page OCR is intentionally separate from the current job-level columns. It gives future product-line extraction, production analysis, or document reprocessing access to the whole multi-page document without changing the core JobCard model again.

A later scan of the same normalized job/quote number matches the existing row. When that reviewed scan is saved, its source-page set replaces the previous source-page set for that job.

## Extraction safety

- OCR never writes directly to SQLite.
- The user reviews all parsed values before saving.
- Customer extraction prioritizes the TO customer block and rejects address/delivery instruction text as a customer name.
- Amounts are stored as integer cents.
- Printed handwritten notes are not used as authoritative structured data.
- Product line-item tables are retained in the saved page OCR but are not yet promoted into structured product rows.
- Delivery-area inference uses the single shared delivery-area definition used by the editor, planner table, and calendar.
