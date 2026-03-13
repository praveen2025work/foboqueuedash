# Claude CLI Prompt — Recreate This Project

Use this prompt with `claude` CLI in an empty directory to regenerate the FOBO Reconciliation Monitor dashboard.

```
Build a FOBO Reconciliation Monitor dashboard with two parts:

**Backend (fobo-api/)** — Python FastAPI:
- Connects to TWO separate Oracle databases via cx_Oracle:
  - MSBK DB: table REC_MSBK_BUS_DTL (columns: ID, MSBK_BUS_DTL_ID, BUS_DATE, MSBK_ID, REC_ID, REC_SUBCATEGORY_ID, STATUS, EXPN, EXPNCOUNT, START_TIME, END_TIME, SERVICE_NAME, ISHOLIDAY, REGN_ID, IN_MOTIF, BUSINESSAREANAME, HIERARCHYLEVEL7, LASTUPDATE, LASTUPDATED_BY)
  - Titan DB: table TITAN_RUN_INST_MSB_DTL (columns: RUN_INST_DTL_ID, BUSINESS_DATE, REC_ID, MASTER_BOOK_ID, START_DATE_TIME, END_DATE_TIME, STATUS, LOG_DESCRIPTION, CREATED_BY, CREATED_DATE, UPDATED_BY, UPDATED_DATE)
- Each DB has separate env vars: MSBK_DB_HOST/PORT/SID/USER/PASS/SCHEMA and TITAN_DB_HOST/PORT/SID/USER/PASS/SCHEMA
- APP_ENV=mock uses generated mock data (no Oracle needed), dev/uat/prod use real DB
- Mock data: ~120 records with weighted status distribution (65% COMPLETE, 15% PROCESSING, 12% PENDING, 8% FAILED), 3 regions (AMER/APAC/EMEA), 20 business areas, 7 hierarchy levels
- Endpoints: GET /health, GET /api/recon (8 filters: status, region, business_area, hierarchy, service, is_holiday, in_motif + bus_date), GET /api/recon/summary, GET /api/recon/crosstab (group_by + split_by for stacked charts), GET /api/recon/{id}, GET /api/titan
- Schema/table names from env vars, parameterized queries (no SQL injection), no hardcoded schema names
- Python 3.9 compatible (use from __future__ import annotations)

**Frontend (fobo-ui/)** — Next.js with TypeScript and Tailwind CSS v4:
- Single ReconDashboard component with dark sidebar navigation
- Dark theme (default) + light theme toggle using CSS custom properties and data-theme attribute on html, stored in localStorage
- Glassmorphism UI style (backdrop-blur, translucent surfaces)
- 3 tabs: Management (KPI cards + charts), Operations (filterable table with detail drawer), Admin (full table + CSV export)
- Management tab: 5 KPI cards (Total, Complete, Processing, Pending, Failed), chart with 5 group-by dimension pills (Status, Region, Business Area, Hierarchy, Service), Simple vs "By Status" toggle that shows stacked horizontal bar chart using crosstab API
- Operations tab: sticky-header table, click row to open detail drawer, status/region color badges
- Collapsible filter bar: Status, Region, Business Area always visible + expandable "More Filters" for Hierarchy, Service, Holiday, In Motif
- Auto-refresh every 30 seconds with countdown timer
- Admin tab: red left border on rows with expn > 100, Export CSV button
- Google Fonts: Inter + JetBrains Mono loaded via link tags in layout.tsx head (not CSS @import, to avoid Tailwind v4 ordering issues)

Also create a DEVELOPER_GUIDE.md explaining the dual-database architecture, local mock setup, and dev/uat/prod configuration.
```
