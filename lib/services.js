import { readFile } from 'node:fs/promises';

export const STATUSES = ['operational', 'degraded', 'down'];

export async function loadServices(file) {
  const raw = await readFile(file, 'utf8');
  const services = JSON.parse(raw);
  if (!Array.isArray(services)) {
    throw new TypeError(`${file} must contain a JSON array of services`);
  }
  return services;
}

export function summarize(services) {
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const service of services) {
    if (service.status in counts) counts[service.status] += 1;
  }

  let overall = 'operational';
  if (counts.down > 0) overall = 'major_outage';
  else if (counts.degraded > 0) overall = 'partial_outage';

  return { total: services.length, counts, overall };
}
