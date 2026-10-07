import assert from 'node:assert/strict';

import {
  parsePaperJobCardPages,
  parsePaperJobCardText,
} from '../src/features/jobCards/paperJobCardImport';

const crisandra = `
QUOTE
NUMBER:
QU00000077
REFERENCE:
BACK ORDER 2
DATE:
25/09/2026
DUE DATE:
15/10/2026
PAGE:
1/4

FROM
VORSTER UNLIMITED TRADING
POSTAL ADDRESS:
Farm 118, Unit 426 Rietfontein
PHYSICAL ADDRESS:
Farm 118, Unit 426 Rietfontein
Muldersdrift
1739

TO
CRISANDRA KWEKERY :CRE002
CUSTOMER VAT NO: 4740209723
POSTAL ADDRESS:
Call Before Delivery
crisranra@telkomsa.net
PHYSICAL ADDRESS:
3 Vaal Drive, Sykviavale AH
Vanderbijlpark
Delivery Fee: 15%
1911

Description
SMR027 - Cone Lip Large
Grand Total:
R14,303.88
BALANCE DUE
R14,303.88
`;

const result = parsePaperJobCardText(crisandra);
assert.equal(result.ok, true);

if (result.ok) {
  assert.equal(result.job.referenceNumber, '77');
  assert.equal(result.job.customerName, 'CRISANDRA KWEKERY');
  assert.equal(result.job.dateMade, '2026-09-25');
  assert.equal(result.job.fulfilmentType, 'Delivery');
  assert.equal(result.job.deliveryInstructions, 'Call Before Delivery');
  assert.equal(result.job.deliveryFeePercent, 15);
  assert.equal(result.job.amountCents, 1430388);
  assert.match(result.job.location, /3 Vaal Drive/i);
  assert.match(result.job.location, /Vanderbijlpark/i);
  assert.match(result.job.location, /1911/);
}

const legacy = `
JOBCARD
NUMBER:
QU125188
DATE:
18/09/2026
TO
ANTIQUE SHACK
PHYSICAL ADDRESS:
Pretoria
TOTAL DUE:
R141.40
`;

const legacyResult = parsePaperJobCardText(legacy);
assert.equal(legacyResult.ok, true);
if (legacyResult.ok) {
  assert.equal(legacyResult.job.referenceNumber, '125188');
  assert.equal(legacyResult.job.customerName, 'ANTIQUE SHACK');
  assert.equal(legacyResult.job.amountCents, 14140);
}

const page1 = `
QUOTE
NUMBER: QU00000075
DATE: 23/09/2026
TO
GOODIES FOR GARDENS
CUSTOMER VAT NO: 4310271707
PHYSICAL ADDRESS:
4 Vlei Street
Glen Marais
Kempton Park
Delivery Fee: 15%
`;

const page2 = `
QUOTE
NUMBER: QU00000075
PAGE: 2/3
Description
ANT017B - Classic Half Pot Small
20
R94.01
`;

const page3 = `
QUOTE
NUMBER: QU00000075
PAGE: 3/3
DF - Delivery Fee
BALANCE DUE
R31,368.99
`;

const multiPageResult = parsePaperJobCardPages([page1, page2, page3]);
assert.equal(multiPageResult.ok, true);
if (multiPageResult.ok) {
  assert.equal(multiPageResult.job.referenceNumber, '75');
  assert.equal(multiPageResult.job.customerName, 'GOODIES FOR GARDENS');
  assert.equal(multiPageResult.job.amountCents, 3136899);
}

console.log('Paper parser regression tests passed.');
