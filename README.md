# Pulseboard

A tiny, zero-dependency service status board for on-call teams.

```bash
npm start      # http://localhost:4173
npm test       # node --test
```

## API

| Endpoint            | Returns                                      |
| ------------------- | -------------------------------------------- |
| `GET /api/services` | `{ services: Service[] }`, optionally filtered with `?status=operational\|degraded\|down` and `?q=<text>` (case-insensitive match on name or team). An invalid `status` returns 400. |
| `GET /api/summary`  | `{ total, counts: { operational, degraded, down }, overall }` |

The dashboard has a search box and status chips; the active filters are kept in the URL (e.g. `/?status=down`).

Service data lives in `data/services.json` (override with `PULSEBOARD_DATA`).

## Project layout

```
server.js          HTTP server + JSON API (node:http, no framework)
lib/services.js    loading and summarising service data
public/            dashboard UI (vanilla JS + CSS)
test/              node:test suite
```

This repo is used as a live demo of [Factory](https://factory.ai)'s Droid taking a GitHub issue to a reviewed pull request.
