"""FOBO Reconciliation Monitor — FastAPI Backend."""
from __future__ import annotations
import os
from datetime import datetime
from typing import Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

load_dotenv()

APP_ENV = os.getenv("APP_ENV", "mock")

# --- MSBK database connection ---
MSBK_DB_HOST = os.getenv("MSBK_DB_HOST", os.getenv("DB_HOST", ""))
MSBK_DB_PORT = os.getenv("MSBK_DB_PORT", os.getenv("DB_PORT", "1521"))
MSBK_DB_SID = os.getenv("MSBK_DB_SID", os.getenv("DB_SID", ""))
MSBK_DB_USER = os.getenv("MSBK_DB_USER", os.getenv("DB_USER", ""))
MSBK_DB_PASS = os.getenv("MSBK_DB_PASS", os.getenv("DB_PASS", ""))
MSBK_DB_SCHEMA = os.getenv("MSBK_DB_SCHEMA", os.getenv("DB_SCHEMA", "YOUR_SCHEMA"))
TABLE_MSBK = os.getenv("TABLE_MSBK_BUS_DTL", "REC_MSBK_BUS_DTL")

# --- Titan database connection ---
TITAN_DB_HOST = os.getenv("TITAN_DB_HOST", os.getenv("DB_HOST", ""))
TITAN_DB_PORT = os.getenv("TITAN_DB_PORT", os.getenv("DB_PORT", "1521"))
TITAN_DB_SID = os.getenv("TITAN_DB_SID", os.getenv("DB_SID", ""))
TITAN_DB_USER = os.getenv("TITAN_DB_USER", os.getenv("DB_USER", ""))
TITAN_DB_PASS = os.getenv("TITAN_DB_PASS", os.getenv("DB_PASS", ""))
TITAN_DB_SCHEMA = os.getenv("TITAN_DB_SCHEMA", os.getenv("DB_SCHEMA", "YOUR_SCHEMA"))
TABLE_TITAN = os.getenv("TABLE_TITAN_RUN_INST", "TITAN_RUN_INST_MSB_DTL")

app = FastAPI(title="FOBO Reconciliation Monitor", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Pydantic Models ----------

class ReconRecord(BaseModel):
    id: Optional[int] = None
    msbk_bus_dtl_id: Optional[int] = None
    bus_date: Optional[str] = None
    msbk_id: Optional[int] = None
    rec_id: Optional[int] = None
    rec_subcategory_id: Optional[int] = None
    status: Optional[str] = None
    expn: Optional[int] = None
    expncount: Optional[int] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    service_name: Optional[str] = None
    is_holiday: Optional[str] = None
    regn_id: Optional[str] = None
    in_motif: Optional[str] = None
    business_area_name: Optional[str] = None
    hierarchy_level: Optional[str] = None
    hierarchy_level7: Optional[str] = None
    last_update: Optional[str] = None
    last_updated_by: Optional[str] = None


class TitanRecord(BaseModel):
    run_inst_dtl_id: Optional[int] = None
    business_date: Optional[str] = None
    rec_id: Optional[int] = None
    master_book_id: Optional[int] = None
    start_date_time: Optional[str] = None
    end_date_time: Optional[str] = None
    status: Optional[str] = None
    log_description: Optional[str] = None
    created_by: Optional[str] = None
    created_date: Optional[str] = None
    updated_by: Optional[str] = None
    updated_date: Optional[str] = None


# ---------- DB Connection ----------

def get_msbk_connection():
    """Create Oracle DB connection for the MSBK (recon) schema."""
    import cx_Oracle
    dsn = cx_Oracle.makedsn(MSBK_DB_HOST, int(MSBK_DB_PORT), sid=MSBK_DB_SID)
    return cx_Oracle.connect(user=MSBK_DB_USER, password=MSBK_DB_PASS, dsn=dsn)


def get_titan_connection():
    """Create Oracle DB connection for the Titan schema."""
    import cx_Oracle
    dsn = cx_Oracle.makedsn(TITAN_DB_HOST, int(TITAN_DB_PORT), sid=TITAN_DB_SID)
    return cx_Oracle.connect(user=TITAN_DB_USER, password=TITAN_DB_PASS, dsn=dsn)


MSBK_COLUMNS = [
    "ID", "MSBK_BUS_DTL_ID", "BUS_DATE", "MSBK_ID", "REC_ID",
    "REC_SUBCATEGORY_ID", "STATUS", "EXPN", "EXPNCOUNT",
    "START_TIME", "END_TIME", "SERVICE_NAME", "ISHOLIDAY",
    "REGN_ID", "IN_MOTIF", "BUSINESSAREANAME", "HIERARCHYLEVEL7",
    "LASTUPDATE", "LASTUPDATED_BY",
]

MSBK_FIELD_MAP = {
    "ID": "id",
    "MSBK_BUS_DTL_ID": "msbk_bus_dtl_id",
    "BUS_DATE": "bus_date",
    "MSBK_ID": "msbk_id",
    "REC_ID": "rec_id",
    "REC_SUBCATEGORY_ID": "rec_subcategory_id",
    "STATUS": "status",
    "EXPN": "expn",
    "EXPNCOUNT": "expncount",
    "START_TIME": "start_time",
    "END_TIME": "end_time",
    "SERVICE_NAME": "service_name",
    "ISHOLIDAY": "is_holiday",
    "REGN_ID": "regn_id",
    "IN_MOTIF": "in_motif",
    "BUSINESSAREANAME": "business_area_name",
    "HIERARCHYLEVEL7": "hierarchy_level7",
    "LASTUPDATE": "last_update",
    "LASTUPDATED_BY": "last_updated_by",
}


def row_to_dict(row, columns, field_map):
    result = {}
    for col, val in zip(columns, row):
        key = field_map.get(col, col.lower())
        if hasattr(val, "strftime"):
            val = val.strftime("%Y-%m-%d %H:%M:%S")
        result[key] = val
    return result


def query_msbk(bus_date: str, status: str = None, region: str = None,
               business_area: str = None, hierarchy: str = None,
               service: str = None, is_holiday: str = None, in_motif: str = None):
    """Query REC_MSBK_BUS_DTL from Oracle."""
    conn = get_msbk_connection()
    try:
        cursor = conn.cursor()
        sql = f"""SELECT {', '.join(MSBK_COLUMNS)}
                  FROM {MSBK_DB_SCHEMA}.{TABLE_MSBK}
                  WHERE BUS_DATE = TO_DATE(:bus_date, 'YYYY-MM-DD')"""
        params = {"bus_date": bus_date}

        if status:
            sql += " AND STATUS = :status"
            params["status"] = status
        if region:
            sql += " AND REGN_ID = :region"
            params["region"] = region
        if business_area:
            sql += " AND BUSINESSAREANAME = :business_area"
            params["business_area"] = business_area
        if hierarchy:
            sql += " AND HIERARCHYLEVEL7 = :hierarchy"
            params["hierarchy"] = hierarchy
        if service:
            sql += " AND SERVICE_NAME = :service"
            params["service"] = service
        if is_holiday:
            sql += " AND ISHOLIDAY = :is_holiday"
            params["is_holiday"] = is_holiday
        if in_motif:
            sql += " AND IN_MOTIF = :in_motif"
            params["in_motif"] = in_motif

        cursor.execute(sql, params)
        rows = cursor.fetchall()
        return [row_to_dict(r, MSBK_COLUMNS, MSBK_FIELD_MAP) for r in rows]
    finally:
        conn.close()


def query_msbk_by_id(record_id: int):
    conn = get_msbk_connection()
    try:
        cursor = conn.cursor()
        sql = f"""SELECT {', '.join(MSBK_COLUMNS)}
                  FROM {MSBK_DB_SCHEMA}.{TABLE_MSBK}
                  WHERE MSBK_BUS_DTL_ID = :record_id"""
        cursor.execute(sql, {"record_id": record_id})
        row = cursor.fetchone()
        if not row:
            return None
        return row_to_dict(row, MSBK_COLUMNS, MSBK_FIELD_MAP)
    finally:
        conn.close()


# ---------- Mock data cache ----------
_mock_cache: dict[str, list[dict]] = {}


def get_mock_data(bus_date: str):
    from mock_data import generate_mock_records
    if bus_date not in _mock_cache:
        _mock_cache[bus_date] = generate_mock_records(bus_date)
    return _mock_cache[bus_date]


def get_mock_titan_data(bus_date: str):
    from mock_data import generate_titan_records
    key = f"titan_{bus_date}"
    if key not in _mock_cache:
        _mock_cache[key] = generate_titan_records(bus_date)
    return _mock_cache[key]


# ---------- Endpoints ----------

@app.get("/health")
def health():
    return {"status": "ok", "env": APP_ENV}


def _filter_mock(data, status=None, region=None, business_area=None,
                  hierarchy=None, service=None, is_holiday=None, in_motif=None):
    """Apply filters to mock data list."""
    if status:
        data = [r for r in data if r["status"] == status]
    if region:
        data = [r for r in data if r["regn_id"] == region]
    if business_area:
        data = [r for r in data if r["business_area_name"] == business_area]
    if hierarchy:
        data = [r for r in data if r["hierarchy_level7"] == hierarchy]
    if service:
        data = [r for r in data if r["service_name"] == service]
    if is_holiday:
        data = [r for r in data if r["is_holiday"] == is_holiday]
    if in_motif:
        data = [r for r in data if r["in_motif"] == in_motif]
    return data


@app.get("/api/recon", response_model=list[ReconRecord])
def get_recon(
    bus_date: str = Query(..., description="Business date YYYY-MM-DD"),
    status: Optional[str] = None,
    region: Optional[str] = None,
    business_area: Optional[str] = None,
    hierarchy: Optional[str] = None,
    service: Optional[str] = None,
    is_holiday: Optional[str] = None,
    in_motif: Optional[str] = None,
):
    if APP_ENV == "mock":
        data = get_mock_data(bus_date)
        return _filter_mock(data, status, region, business_area,
                            hierarchy, service, is_holiday, in_motif)
    return query_msbk(bus_date, status, region, business_area,
                      hierarchy, service, is_holiday, in_motif)


@app.get("/api/recon/summary")
def get_summary(
    bus_date: str = Query(..., description="Business date YYYY-MM-DD"),
    status: Optional[str] = None,
    region: Optional[str] = None,
    business_area: Optional[str] = None,
    hierarchy: Optional[str] = None,
    service: Optional[str] = None,
    is_holiday: Optional[str] = None,
    in_motif: Optional[str] = None,
):
    if APP_ENV == "mock":
        data = get_mock_data(bus_date)
        data = _filter_mock(data, status, region, business_area,
                            hierarchy, service, is_holiday, in_motif)
    else:
        data = query_msbk(bus_date, status, region, business_area,
                          hierarchy, service, is_holiday, in_motif)

    by_status: dict[str, int] = {}
    by_region: dict[str, int] = {}
    by_business_area: dict[str, int] = {}
    by_hierarchy: dict[str, int] = {}
    by_service: dict[str, int] = {}

    for r in data:
        s = r.get("status", "UNKNOWN")
        by_status[s] = by_status.get(s, 0) + 1

        reg = r.get("regn_id", "UNKNOWN")
        by_region[reg] = by_region.get(reg, 0) + 1

        ba = r.get("business_area_name", "UNKNOWN")
        by_business_area[ba] = by_business_area.get(ba, 0) + 1

        hl = r.get("hierarchy_level7", "UNKNOWN")
        by_hierarchy[hl] = by_hierarchy.get(hl, 0) + 1

        svc = r.get("service_name", "UNKNOWN")
        by_service[svc] = by_service.get(svc, 0) + 1

    return {
        "total": len(data),
        "by_status": by_status,
        "by_region": by_region,
        "by_business_area": by_business_area,
        "by_hierarchy": by_hierarchy,
        "by_service": by_service,
    }


GROUP_FIELD_MAP = {
    "region": "regn_id",
    "business_area": "business_area_name",
    "hierarchy": "hierarchy_level7",
    "service": "service_name",
    "status": "status",
}


@app.get("/api/recon/crosstab")
def get_crosstab(
    bus_date: str = Query(..., description="Business date YYYY-MM-DD"),
    group_by: str = Query(..., description="region|business_area|hierarchy|service"),
    split_by: str = Query("status", description="Field to split by (default: status)"),
    status: Optional[str] = None,
    region: Optional[str] = None,
    business_area: Optional[str] = None,
    hierarchy: Optional[str] = None,
    service: Optional[str] = None,
    is_holiday: Optional[str] = None,
    in_motif: Optional[str] = None,
):
    if group_by not in GROUP_FIELD_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid group_by: {group_by}")
    if split_by not in GROUP_FIELD_MAP:
        raise HTTPException(status_code=400, detail=f"Invalid split_by: {split_by}")

    if APP_ENV == "mock":
        data = get_mock_data(bus_date)
        data = _filter_mock(data, status, region, business_area,
                            hierarchy, service, is_holiday, in_motif)
    else:
        data = query_msbk(bus_date, status, region, business_area,
                          hierarchy, service, is_holiday, in_motif)

    group_field = GROUP_FIELD_MAP[group_by]
    split_field = GROUP_FIELD_MAP[split_by]

    # Build nested counts: {group_val: {split_val: count}}
    nested: dict[str, dict[str, int]] = {}
    split_keys: set[str] = set()
    for r in data:
        gv = r.get(group_field, "UNKNOWN")
        sv = r.get(split_field, "UNKNOWN")
        split_keys.add(sv)
        if gv not in nested:
            nested[gv] = {}
        nested[gv][sv] = nested[gv].get(sv, 0) + 1

    # Sort labels by total descending, cap at 15
    labels_sorted = sorted(nested.keys(),
                           key=lambda k: sum(nested[k].values()), reverse=True)[:15]
    split_keys_sorted = sorted(split_keys)

    # Build series arrays
    series: dict[str, list[int]] = {}
    for sk in split_keys_sorted:
        series[sk] = [nested.get(label, {}).get(sk, 0) for label in labels_sorted]

    return {
        "labels": labels_sorted,
        "split_keys": split_keys_sorted,
        "series": series,
    }


@app.get("/api/recon/{msbk_bus_dtl_id}", response_model=ReconRecord)
def get_recon_by_id(msbk_bus_dtl_id: int):
    if APP_ENV == "mock":
        for date_key, records in _mock_cache.items():
            if date_key.startswith("titan_"):
                continue
            for r in records:
                if r["msbk_bus_dtl_id"] == msbk_bus_dtl_id:
                    return r
        raise HTTPException(status_code=404, detail="Record not found")
    record = query_msbk_by_id(msbk_bus_dtl_id)
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.get("/api/titan", response_model=list[TitanRecord])
def get_titan(
    bus_date: str = Query(..., description="Business date YYYY-MM-DD"),
    status: Optional[str] = None,
):
    if APP_ENV == "mock":
        data = get_mock_titan_data(bus_date)
        if status:
            data = [r for r in data if r["status"] == status]
        return data
    # Oracle query for titan table (separate DB instance)
    conn = get_titan_connection()
    try:
        cursor = conn.cursor()
        sql = f"""SELECT RUN_INST_DTL_ID, BUSINESS_DATE, REC_ID, MASTER_BOOK_ID,
                         START_DATE_TIME, END_DATE_TIME, STATUS, LOG_DESCRIPTION,
                         CREATED_BY, CREATED_DATE, UPDATED_BY, UPDATED_DATE
                  FROM {TITAN_DB_SCHEMA}.{TABLE_TITAN}
                  WHERE BUSINESS_DATE = TO_DATE(:bus_date, 'YYYY-MM-DD')"""
        params = {"bus_date": bus_date}
        if status:
            sql += " AND STATUS = :status"
            params["status"] = status
        cursor.execute(sql, params)
        cols = ["run_inst_dtl_id", "business_date", "rec_id", "master_book_id",
                "start_date_time", "end_date_time", "status", "log_description",
                "created_by", "created_date", "updated_by", "updated_date"]
        rows = cursor.fetchall()
        results = []
        for row in rows:
            d = {}
            for c, v in zip(cols, row):
                if hasattr(v, "strftime"):
                    v = v.strftime("%Y-%m-%d %H:%M:%S")
                d[c] = v
            results.append(d)
        return results
    finally:
        conn.close()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
