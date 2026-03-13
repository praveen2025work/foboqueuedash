# FOBO Reconciliation Monitor — Developer Guide

## Architecture

```
fobo-api/          FastAPI backend (Python)
  main.py          API server + Oracle queries
  mock_data.py     Mock data generator for local dev
  .env             Environment config (not committed)
  requirements.txt Python dependencies

fobo-ui/           Next.js frontend (TypeScript + Tailwind)
  app/             App router pages
  components/      ReconDashboard.tsx (main UI)
  lib/api.ts       API client functions
  .env.local       Frontend env vars
```

The backend connects to **two separate Oracle databases**:

| Table | Database | Purpose |
|-------|----------|---------|
| `REC_MSBK_BUS_DTL` | MSBK instance | Reconciliation records |
| `TITAN_RUN_INST_MSB_DTL` | Titan instance | Titan run instance details |

Each table lives in its own schema on a separate Oracle instance, so the backend maintains two independent connection configurations.

---

## Prerequisites

- **Python 3.9+**
- **Node.js 18+** and npm
- **Oracle Instant Client** (required for `cx_Oracle` in dev/uat/prod)
- Access to the Oracle databases for your target environment

### Installing Oracle Instant Client

`cx_Oracle` requires the Oracle Instant Client libraries. Download from [Oracle's website](https://www.oracle.com/database/technologies/instant-client.html) and follow the platform-specific instructions:

- **macOS**: Download the DMG, extract, and set `DYLD_LIBRARY_PATH` or place in `/usr/local/lib`
- **Linux**: Install the RPM/ZIP and set `LD_LIBRARY_PATH`
- **Windows**: Download the ZIP, extract, and add to `PATH`

> **Note**: Oracle Instant Client is NOT needed for `APP_ENV=mock` (local development with mock data).

---

## Local Development (Mock Mode)

Mock mode requires no database — it generates realistic sample data in memory.

### 1. Start the backend

```bash
cd fobo-api
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# .env already has APP_ENV=mock by default
python main.py
```

Backend starts at `http://localhost:8000`. Verify: `curl http://localhost:8000/health`

### 2. Start the frontend

```bash
cd fobo-ui
npm install
npm run dev
```

Frontend starts at `http://localhost:3000`.

---

## Dev / UAT / Prod Setup

### 1. Configure the backend `.env`

Copy `fobo-api/.env` and fill in the real connection details for your environment.

Both tables are on **different Oracle instances**, so you configure two separate connections:

```env
# Environment: dev | uat | prod
APP_ENV=dev

# ──────────────────────────────────────────────
# MSBK Database (REC_MSBK_BUS_DTL table)
# ──────────────────────────────────────────────
MSBK_DB_HOST=msbk-db-host.example.com
MSBK_DB_PORT=1521
MSBK_DB_SID=MSBKDEV
MSBK_DB_USER=recon_reader
MSBK_DB_PASS=<password>
MSBK_DB_SCHEMA=RECON_SCHEMA
TABLE_MSBK_BUS_DTL=REC_MSBK_BUS_DTL

# ──────────────────────────────────────────────
# Titan Database (TITAN_RUN_INST_MSB_DTL table)
# ──────────────────────────────────────────────
TITAN_DB_HOST=titan-db-host.example.com
TITAN_DB_PORT=1521
TITAN_DB_SID=TITANDEV
TITAN_DB_USER=titan_reader
TITAN_DB_PASS=<password>
TITAN_DB_SCHEMA=TITAN_SCHEMA
TABLE_TITAN_RUN_INST=TITAN_RUN_INST_MSB_DTL
```

**Key points:**
- `MSBK_DB_*` vars configure the connection for `REC_MSBK_BUS_DTL`
- `TITAN_DB_*` vars configure the connection for `TITAN_RUN_INST_MSB_DTL`
- The host, port, SID, user, and password can all differ between the two
- Schema and table names are configurable per environment
- Setting `APP_ENV` to anything other than `mock` activates real DB queries

### 2. Configure the frontend `.env.local`

```env
# Point to your backend URL
NEXT_PUBLIC_API_URL=http://localhost:8000
```

For deployed environments, set this to the backend's actual URL (e.g., `https://fobo-api.internal.example.com`).

### 3. Start the services

```bash
# Backend
cd fobo-api
source venv/bin/activate
python main.py

# Frontend (separate terminal)
cd fobo-ui
npm run dev          # development
npm run build && npm start   # production build
```

---

## Environment Variable Reference

### Backend (`fobo-api/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_ENV` | `mock` | Environment mode: `mock`, `dev`, `uat`, `prod` |
| `MSBK_DB_HOST` | — | Oracle host for MSBK database |
| `MSBK_DB_PORT` | `1521` | Oracle port for MSBK database |
| `MSBK_DB_SID` | — | Oracle SID for MSBK database |
| `MSBK_DB_USER` | — | Oracle username for MSBK database |
| `MSBK_DB_PASS` | — | Oracle password for MSBK database |
| `MSBK_DB_SCHEMA` | `YOUR_SCHEMA` | Schema containing `REC_MSBK_BUS_DTL` |
| `TABLE_MSBK_BUS_DTL` | `REC_MSBK_BUS_DTL` | Table name (override if different) |
| `TITAN_DB_HOST` | — | Oracle host for Titan database |
| `TITAN_DB_PORT` | `1521` | Oracle port for Titan database |
| `TITAN_DB_SID` | — | Oracle SID for Titan database |
| `TITAN_DB_USER` | — | Oracle username for Titan database |
| `TITAN_DB_PASS` | — | Oracle password for Titan database |
| `TITAN_DB_SCHEMA` | `YOUR_SCHEMA` | Schema containing `TITAN_RUN_INST_MSB_DTL` |
| `TABLE_TITAN_RUN_INST` | `TITAN_RUN_INST_MSB_DTL` | Table name (override if different) |

### Frontend (`fobo-ui/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Health check, returns `{ status, env }` |
| `GET` | `/api/recon?bus_date=YYYY-MM-DD` | List recon records (filterable) |
| `GET` | `/api/recon/summary?bus_date=YYYY-MM-DD` | Aggregated counts by status, region, etc. |
| `GET` | `/api/recon/crosstab?bus_date=...&group_by=region` | Cross-tabulated data for charts |
| `GET` | `/api/recon/{id}` | Single record by MSBK_BUS_DTL_ID |
| `GET` | `/api/titan?bus_date=YYYY-MM-DD` | Titan run instance records |

### Common filter parameters (recon endpoints)

`status`, `region`, `business_area`, `hierarchy`, `service`, `is_holiday`, `in_motif`

---

## Troubleshooting

**`cx_Oracle` import error** — Oracle Instant Client is not installed or not on the library path. This is only needed when `APP_ENV != mock`.

**Connection timeout** — Verify network access to the Oracle host/port. Check VPN if connecting from local machine.

**"ORA-12154: TNS could not resolve"** — Double-check `DB_SID`. Try using service name instead of SID if your DBA requires it (would need a small code change to use `service_name=` instead of `sid=` in `makedsn()`).

**CORS errors in browser** — The backend allows all origins by default. For production, restrict `allow_origins` in `main.py` to your frontend's domain.
