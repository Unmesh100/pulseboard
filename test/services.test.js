import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { InvalidFilterError, filterServices, summarize } from '../lib/services.js';
import { createApp } from '../server.js';

test('summarize counts services by status', () => {
  const result = summarize([
    { status: 'operational' },
    { status: 'operational' },
    { status: 'degraded' },
  ]);
  assert.deepEqual(result.counts, { operational: 2, degraded: 1, down: 0 });
  assert.equal(result.total, 3);
  assert.equal(result.overall, 'partial_outage');
});

test('summarize reports a major outage when anything is down', () => {
  assert.equal(summarize([{ status: 'down' }, { status: 'degraded' }]).overall, 'major_outage');
});

test('summarize reports operational for a healthy fleet', () => {
  assert.equal(summarize([{ status: 'operational' }]).overall, 'operational');
});

async function withServer(fn) {
  const server = createApp();
  server.listen(0);
  await once(server, 'listening');
  const { port } = server.address();
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    server.close();
  }
}

test('GET /api/services returns every service', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/services`);
    assert.equal(res.status, 200);
    const { services } = await res.json();
    assert.equal(services.length, 12);
  });
});

test('GET /api/summary returns counts', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/summary`);
    const summary = await res.json();
    assert.equal(summary.total, 12);
    assert.equal(summary.overall, 'major_outage');
  });
});

test('unknown paths return 404', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/nope.txt`);
    assert.equal(res.status, 404);
  });
});

const SAMPLE = [
  { name: 'Auth API', team: 'Identity', status: 'operational' },
  { name: 'Payments Gateway', team: 'Billing', status: 'degraded' },
  { name: 'Notifications', team: 'Messaging', status: 'down' },
  { name: 'Invoice Worker', team: 'Billing', status: 'down' },
];
const names = (list) => list.map((s) => s.name);

test('filterServices returns everything without filters', () => {
  assert.equal(filterServices(SAMPLE).length, 4);
  assert.equal(filterServices(SAMPLE, { status: '', q: '  ' }).length, 4);
});

test('filterServices filters by status', () => {
  assert.deepEqual(names(filterServices(SAMPLE, { status: 'down' })), ['Notifications', 'Invoice Worker']);
});

test('filterServices matches name or team case-insensitively', () => {
  assert.deepEqual(names(filterServices(SAMPLE, { q: 'AUTH' })), ['Auth API']);
  assert.deepEqual(names(filterServices(SAMPLE, { q: 'billing' })), ['Payments Gateway', 'Invoice Worker']);
});

test('filterServices combines status and q', () => {
  assert.deepEqual(names(filterServices(SAMPLE, { status: 'down', q: 'billing' })), ['Invoice Worker']);
  assert.deepEqual(filterServices(SAMPLE, { status: 'operational', q: 'billing' }), []);
});

test('filterServices rejects an invalid status', () => {
  assert.throws(() => filterServices(SAMPLE, { status: 'broken' }), InvalidFilterError);
});

test('GET /api/services?status= filters results', async () => {
  await withServer(async (base) => {
    const { services } = await (await fetch(`${base}/api/services?status=down`)).json();
    assert.ok(services.length > 0 && services.length < 12);
    assert.ok(services.every((s) => s.status === 'down'));
  });
});

test('GET /api/services?q= matches name or team case-insensitively', async () => {
  await withServer(async (base) => {
    const { services } = await (await fetch(`${base}/api/services?q=AUTH`)).json();
    assert.ok(services.length > 0);
    assert.ok(services.every((s) => /auth/i.test(s.name) || /auth/i.test(s.team)));
    const team = await (await fetch(`${base}/api/services?q=billing`)).json();
    assert.ok(team.services.some((s) => s.team === 'Billing'));
  });
});

test('GET /api/services combines status and q', async () => {
  await withServer(async (base) => {
    const { services } = await (await fetch(`${base}/api/services?status=degraded&q=billing`)).json();
    assert.ok(services.every((s) => s.status === 'degraded' && /billing/i.test(`${s.name} ${s.team}`)));
    const none = await (await fetch(`${base}/api/services?status=operational&q=zzzz-nope`)).json();
    assert.deepEqual(none.services, []);
  });
});

test('GET /api/services with an invalid status returns 400', async () => {
  await withServer(async (base) => {
    const res = await fetch(`${base}/api/services?status=broken`);
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(typeof body.error, 'string');
    assert.ok(body.error.length > 0);
  });
});
