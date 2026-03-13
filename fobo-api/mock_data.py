"""Mock data generator for FOBO Reconciliation Monitor."""
from __future__ import annotations
import random
from datetime import datetime, timedelta
from typing import List, Dict

REGIONS = ["AMER", "APAC", "EMEA"]
STATUSES = ["COMPLETE", "PROCESSING", "PENDING", "FAILED"]
STATUS_WEIGHTS = [0.65, 0.15, 0.12, 0.08]

BUSINESS_AREAS = [
    "Securitized Products Origination Primary",
    "Municipal Secondary Trading",
    "Asset Loans",
    "Securitized Products Trading",
    "Agency RMBS Trading",
    "FI Credit",
    "DM LATAM",
    "Fixed Income Financing",
    "Developed Markets",
    "Municipals",
    "EM Credit",
    "Emerging Markets",
    "FI Rates",
    "Structured Finance",
    "CMBS - Brite",
    "Private Placements",
    "Special Situations",
    "CLO Management",
    "Leveraged Finance",
    "Investment Grade Credit",
]

REC_LEVEL_STATUSES = ["Awaiting", "Processing", "Completed"]
MSB_STATUSES = [
    "Awaiting MSB from Motif",
    "Awaiting for AVRO feed",
    "FOBO Service processing",
    "Titan Process",
    "Rec Complete",
    "Extract generated",
]

HIERARCHY_LEVELS = [
    "Level 1", "Level 2", "Level 3", "Level 4",
    "Level 5", "Level 6", "Level 7",
]


def _random_time(base_date: str, hour_start: int = 1, hour_end: int = 18):
    h = random.randint(hour_start, hour_end)
    m = random.randint(0, 59)
    s = random.randint(0, 59)
    return f"{base_date} {h:02d}:{m:02d}:{s:02d}"


def generate_mock_records(bus_date: str = None, count: int = 120) -> list[dict]:
    if not bus_date:
        bus_date = datetime.now().strftime("%Y-%m-%d")

    records = []
    for i in range(1, count + 1):
        status = random.choices(STATUSES, weights=STATUS_WEIGHTS, k=1)[0]
        region = random.choice(REGIONS)
        ba = random.choice(BUSINESS_AREAS)
        start = _random_time(bus_date, 1, 12)
        end_h = random.randint(13, 23)
        end = _random_time(bus_date, end_h, min(end_h + 2, 23)) if status == "COMPLETE" else None

        expn = random.randint(0, 300) if status in ("COMPLETE", "FAILED") else 0
        expncount = expn

        records.append({
            "id": 3000 + i,
            "msbk_bus_dtl_id": 9000 + i,
            "bus_date": bus_date,
            "msbk_id": random.randint(100000, 999999),
            "rec_id": random.randint(100, 999),
            "rec_subcategory_id": random.randint(1400000, 1500000),
            "status": status,
            "expn": expn,
            "expncount": expncount,
            "start_time": start,
            "end_time": end,
            "service_name": "FOBO Service",
            "is_holiday": random.choice(["Y", "N"]),
            "regn_id": region,
            "in_motif": random.choice(["Y", "N"]),
            "business_area_name": ba,
            "hierarchy_level": random.choice(HIERARCHY_LEVELS),
            "hierarchy_level7": random.choice(HIERARCHY_LEVELS),
            "last_update": _random_time(bus_date, 14, 22),
            "last_updated_by": random.choice(["FOBO_SERVICE", "SYSTEM", "BATCH_JOB", "ADMIN"]),
        })
    return records


# Titan run instance mock data
def generate_titan_records(bus_date: str = None, count: int = 60) -> list[dict]:
    if not bus_date:
        bus_date = datetime.now().strftime("%Y-%m-%d")

    records = []
    for i in range(1, count + 1):
        status = random.choice(MSB_STATUSES)
        start = _random_time(bus_date, 1, 12)
        end = _random_time(bus_date, 13, 22) if status in ("Rec Complete", "Extract generated") else None

        records.append({
            "run_inst_dtl_id": 5000 + i,
            "business_date": bus_date,
            "rec_id": random.randint(100, 999),
            "master_book_id": random.randint(100000, 999999),
            "start_date_time": start,
            "end_date_time": end,
            "status": status,
            "log_description": f"Processing batch {i} for {bus_date}",
            "created_by": random.choice(["FOBO_SERVICE", "SYSTEM", "TITAN"]),
            "created_date": bus_date,
            "updated_by": random.choice(["FOBO_SERVICE", "SYSTEM", "TITAN"]),
            "updated_date": bus_date,
        })
    return records
