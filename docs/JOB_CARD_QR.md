# Job Card QR Format

Vorster Unlimited Helper uses a versioned JSON payload inside QR codes.

## Schema identifier

`vu-job-card/v1`

The schema identifier lets future app versions support new fields without breaking older printed job cards.

## Example payload

```json
{
  "schema": "vu-job-card/v1",
  "dateMade": "2026-10-07",
  "customerName": "Green Olive",
  "referenceNumber": "JC-1245",
  "fulfilmentType": "Delivery",
  "deliveryArea": "Pretoria",
  "location": "Zambezi, Pretoria",
  "amountCents": 845000,
  "deliveryDate": "2026-10-10",
  "status": "Pending"
}
```

## Required fields

- `schema`
- `customerName`
- `referenceNumber`

## Optional fields

- `dateMade` — `YYYY-MM-DD`
- `fulfilmentType` — `Delivery` or `Collection`
- `deliveryArea` — `Pretoria`, `Centurion`, `East Rand`, `Alberton`, or `Other`; if omitted, the app attempts to infer it from `location`
- `location` — retained as background address data for route/directions use
- `amountCents` — integer cents, so R8,450.00 is `845000`
- `deliveryDate` — `YYYY-MM-DD`
- `status` — one of the app's supported job statuses

Missing optional fields use safe defaults and are reviewed in the editor before saving.

## Duplicate handling

`referenceNumber` is the scanner match key. If a scanned reference number already exists in the local planner, the scanned data is loaded into that existing row for review instead of creating a duplicate row.

## Import flow

1. Scan QR.
2. Validate schema and field types.
3. Match an existing row by reference number when possible.
4. Open the normal Job Card editor.
5. User reviews or corrects details.
6. Save through the same repository used by manual entry.

QR imports never write directly to the database.
