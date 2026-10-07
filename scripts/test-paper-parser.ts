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



const distortedCrisandra = `
QUOTE
NUMBER:
QUOOD00077
REFERENCE:
BACK ORDER 2
DATE:
25/09/2026
DUE DATE:
15/10/2026
PAGE:
1/4

TO
Disc
CRISANDRA KWEKERY :CREO02
CUSTOMER VAT NO: 4740209723
POSTAL ADDRESS: PHYSICAL ADDRESS:
Call Before Delivery
3 Vaal Drive, Sykviavale AH
crisranra@telkomsa.net
Vanderbijlpark
Delivery Fee: 15%
1911
Description
Disc %
VAT %
BALANCE DUE
R14,303.88
`;

const distortedResult = parsePaperJobCardText(distortedCrisandra);
assert.equal(distortedResult.ok, true);
if (distortedResult.ok) {
  assert.equal(distortedResult.job.referenceNumber, '77');
  assert.equal(distortedResult.job.customerName, 'CRISANDRA KWEKERY');
  assert.equal(distortedResult.job.fulfilmentType, 'Delivery');
  assert.equal(distortedResult.job.deliveryInstructions, 'Call Before Delivery');
  assert.equal(distortedResult.job.deliveryFeePercent, 15);
  assert.equal(distortedResult.job.amountCents, 1430388);
  assert.match(distortedResult.job.location, /3 Vaal Drive/i);
  assert.match(distortedResult.job.location, /Vanderbijlpark/i);
  assert.match(distortedResult.job.location, /1911/);
}


const flattenedObservedScan = `
QUOTE
NUMBER:
REFERENCE:
DATE:
DUE DATE:
SALES REP:
OVERALL DISCOUNT %:
PAGE:
QUOOD00077
BACK ORDER 2
25/09/2026
15/10/2026
DEON JNR VORTSER
0.00%
1/4

FROM
VORSTER UNLIMITED TRADING
TO
Disc
CRISANDRA KWEKERY :CREO02
CUSTOMER VAT NO: 4740209723
POSTAL ADDRESS:
Call Before Delivery
PHYSICAL ADDRESS:
VORSTER UNLIMITED TRADING
CRISANDRA KWEKERY :CRE002
VOKOco
RSTER
4J4
V
3 Vaal Drive, Sykviavale AH
Vanderbijlpark
Delivery Fee: 15%
1911

Description
Disc %
VAT %
Grand Total:
R14,303.88
BALANCE DUE
R14,303.88
`;

const flattenedObservedResult = parsePaperJobCardText(flattenedObservedScan);
assert.equal(flattenedObservedResult.ok, true);
if (flattenedObservedResult.ok) {
  assert.equal(flattenedObservedResult.job.referenceNumber, '77');
  assert.equal(flattenedObservedResult.job.dateMade, '2026-09-25');
  assert.equal(flattenedObservedResult.job.customerName, 'CRISANDRA KWEKERY');
  assert.equal(flattenedObservedResult.job.fulfilmentType, 'Delivery');
  assert.equal(flattenedObservedResult.job.deliveryInstructions, 'Call Before Delivery');
  assert.equal(flattenedObservedResult.job.deliveryFeePercent, 15);
  assert.equal(flattenedObservedResult.job.amountCents, 1430388);
  assert.match(flattenedObservedResult.job.location, /3 Vaal Drive/i);
  assert.match(flattenedObservedResult.job.location, /Vanderbijlpark/i);
  assert.match(flattenedObservedResult.job.location, /1911/);
  assert.doesNotMatch(flattenedObservedResult.job.location, /VORSTER UNLIMITED TRADING/i);
}

console.log('Paper parser regression tests passed.');
