import assert from 'node:assert/strict';

import {
  createBackup, parseBackup, type BackupRecords, type JobBackup,
} from '../src/domain/backup';

const now = '2026-10-08T12:00:00.000Z';

function fixture(): BackupRecords {
  return {
    delivery_areas: [
      { name: 'Other', color: '#98A2B3', text_color: '#FFFFFF',
        sort_order: 999, is_system: 1, created_at: now },
      { name: 'Pretoria', color: '#2E7D32', text_color: '#FFFFFF',
        sort_order: 10, is_system: 1, created_at: now },
    ],
    job_cards: [{
      id: 'job-1', date_made: '2026-10-08', customer_name: 'Test Nursery',
      reference_number: 'Q-123', fulfilment_type: 'Delivery', delivery_area: 'Pretoria',
      location: 'Pretoria', amount_cents: 12345, delivery_date: '2026-10-09',
      status: 'Scheduled', created_at: now, updated_at: now,
      delivery_instructions: 'Gate 2', delivery_fee_percent: null,
    }],
    job_card_source_pages: [{
      id: 'page-1', job_card_id: 'job-1', page_number: 1,
      raw_text: '2 x SMR027', captured_at: now,
    }],
    job_card_items: [{
      id: 'item-1', job_card_id: 'job-1', position: 0,
      product_code: 'SMR027', description: 'Pot', quantity: 2, source_page: 1,
    }],
    delivery_allocations: [{
      id: 'allocation-1', job_card_id: 'job-1',
      vehicle_id: 'vehicle-1', load_percent: 30, created_at: now, updated_at: now,
    }],
  };
}

function clone(backup: JobBackup): JobBackup {
  return JSON.parse(JSON.stringify(backup)) as JobBackup;
}

function shouldReject(backup: JobBackup, pattern: RegExp) {
  assert.throws(() => parseBackup(JSON.stringify(backup)), pattern);
}

const backup = createBackup(fixture(), now);
const restored = parseBackup(JSON.stringify(backup));
assert.deepEqual(restored, backup);
assert.equal(restored.counts.job_cards, 1);
assert.equal(restored.counts.job_card_items, 1);
assert.equal(restored.counts.job_card_source_pages, 1);
assert.equal(restored.counts.delivery_allocations, 1);

{
  const invalid = clone(backup);
  invalid.schemaVersion = 4 as 5;
  shouldReject(invalid, /unsupported database version/);
}
{
  const invalid = clone(backup);
  invalid.counts.job_cards = 2;
  shouldReject(invalid, /incorrect job_cards count/);
}
{
  const invalid = clone(backup);
  invalid.tables.job_card_items[0].job_card_id = 'deleted-job';
  shouldReject(invalid, /orphaned records/);
}
{
  const invalid = clone(backup);
  invalid.tables.job_cards[0].delivery_area = 'Unknown';
  shouldReject(invalid, /unknown area/);
}
{
  const invalid = clone(backup);
  invalid.tables.delivery_allocations[0].load_percent = 120;
  shouldReject(invalid, /vehicle load percentage/);
}
{
  const invalid = clone(backup);
  invalid.tables.delivery_areas.push({
    ...invalid.tables.delivery_areas[0], name: 'OTHER',
  });
  invalid.counts.delivery_areas += 1;
  shouldReject(invalid, /duplicate area name/);
}
{
  const invalid = clone(backup);
  delete invalid.tables.job_cards[0].delivery_instructions;
  shouldReject(invalid, /incompatible columns/);
}
{
  const invalid = clone(backup);
  invalid.tables.job_card_items.push({ ...invalid.tables.job_card_items[0], id: 'item-2' });
  invalid.counts.job_card_items += 1;
  shouldReject(invalid, /duplicate job entries/);
}
assert.throws(() => parseBackup('not json'), /not valid JSON/);
console.log('Backup contract: 10 validation and round-trip cases passed.');
