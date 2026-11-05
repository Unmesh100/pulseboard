import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { summarize } from '../lib/services.js';
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
