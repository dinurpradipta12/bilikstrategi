import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_HOLIDAY_CONTROL,
  normalizeHolidayControl,
  resolveHolidayControl,
} from '../lib/attendance/schedule.ts';

test('holiday control defaults to an open workspace', () => {
  const control = normalizeHolidayControl(null, false);
  assert.equal(control.configured, false);
  assert.equal(control.manualActive, false);
  assert.equal(control.scheduledEnabled, false);
  assert.deepEqual(resolveHolidayControl(control, Date.parse('2026-10-13T01:00:00.000Z')), {
    active: false,
    mode: null,
    nextOpenAt: null,
  });
});

test('manual closure takes priority and stays active until an admin turns it off', () => {
  const control = normalizeHolidayControl({
    manual_active: true,
    scheduled_enabled: true,
    scheduled_start: '2026-10-13T00:00:00.000Z',
    scheduled_end: '2026-10-13T02:00:00.000Z',
  });
  assert.deepEqual(resolveHolidayControl(control, Date.parse('2026-10-13T01:00:00.000Z')), {
    active: true,
    mode: 'manual',
    nextOpenAt: null,
  });
});

test('scheduled closure is active only inside its configured window', () => {
  const control = normalizeHolidayControl({
    scheduled_enabled: true,
    scheduled_start: '2026-10-13T00:00:00.000Z',
    scheduled_end: '2026-10-13T08:30:00.000Z',
  });
  assert.equal(resolveHolidayControl(control, Date.parse('2026-10-12T23:59:59.000Z')).active, false);
  assert.deepEqual(resolveHolidayControl(control, Date.parse('2026-10-13T04:00:00.000Z')), {
    active: true,
    mode: 'scheduled',
    nextOpenAt: '2026-10-13T08:30:00.000Z',
  });
  assert.equal(resolveHolidayControl(control, Date.parse('2026-10-13T08:30:00.000Z')).active, false);
});

test('invalid dates cannot accidentally close the workspace', () => {
  const control = normalizeHolidayControl({
    scheduled_enabled: true,
    scheduled_start: 'invalid',
    scheduled_end: 'also-invalid',
    message: '',
  });
  assert.equal(control.scheduledStart, null);
  assert.equal(control.scheduledEnd, null);
  assert.equal(control.message, DEFAULT_HOLIDAY_CONTROL.message);
  assert.equal(resolveHolidayControl(control, Date.now()).active, false);
});
