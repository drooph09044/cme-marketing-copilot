#!/usr/bin/env python3
"""
General Motors Post-Sales CDP synthetic data generator (Pandas version).
Creates one CSV file per table in an output directory.

Notes
-----
- This single-file script mirrors the Databricks notebook schema and relationships as closely
  as practical using Pandas/NumPy on a single machine.
- Pandas is memory-bound, so the default scale is intentionally smaller than the original Spark
  notebook. Large fact tables are generated and written in chunks.
- Each table is written to a separate CSV file.

Usage
-----
python gm_post_sales_cdp_pandas_csv.py --output ./gm_cdp_csv --customers 10000
"""

from __future__ import annotations

import argparse
import math
import os
from datetime import datetime
from pathlib import Path
from typing import Iterable, List

import numpy as np
import pandas as pd


# =========================
# CLI / CONFIG
# =========================

def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate GM post-sales CDP synthetic data as CSV files.")
    parser.add_argument("--output", default="./gm_cdp_csv", help="Output folder")
    parser.add_argument("--customers", type=int, default=1000, help="Number of customers (default: 10000)")
    parser.add_argument("--seed", type=int, default=42, help="Random seed")
    parser.add_argument("--chunk-size", type=int, default=200, help="Chunk size for large tables")
    return parser.parse_args()


# =========================
# Utility helpers
# =========================

class Cfg:
    def __init__(self, output: str, customers: int, seed: int, chunk_size: int):
        self.OUTPUT_PATH = Path(output)
        self.OUTPUT_PATH.mkdir(parents=True, exist_ok=True)
        self.SEED = seed
        self.rng = np.random.default_rng(seed)
        self.N_CUSTOMERS = int(customers)
        self.N_HOUSEHOLDS = int(self.N_CUSTOMERS * 0.75)
        self.N_VEHICLES = int(self.N_CUSTOMERS * 1.40)
        self.N_DEALERS = 60
        self.N_STAFF = 600
        self.N_MONTHS = 36
        self.CHUNK = int(chunk_size)
        self.TARGETS = {
            "customer_addresses": int(self.N_CUSTOMERS * 1.20),
            "customer_contacts": int(self.N_CUSTOMERS * 2.50),
            "vehicle_ownership": self.N_VEHICLES + int(self.N_CUSTOMERS * 0.20),
            "trade_ins": int(self.N_CUSTOMERS * 0.50),
            "financing_contracts": int(self.N_VEHICLES * 0.79),
            "service_appointments": int(self.N_CUSTOMERS * 6.00),
            "service_orders": int(self.N_CUSTOMERS * 5.50),
            "service_line_items": int(self.N_CUSTOMERS * 25.00),
            "recall_responses": int(self.N_CUSTOMERS * 3.00),
            "warranty_claims": int(self.N_CUSTOMERS * 0.80),
            "insurance_policies": int(self.N_CUSTOMERS * 1.10),
            "insurance_claims": int(self.N_CUSTOMERS * 0.25),
            "connected_services_subscriptions": int(self.N_CUSTOMERS * 1.20),
            "telematics_monthly_summary": int(self.N_CUSTOMERS * 35.00),
            "vehicle_health_reports": int(self.N_CUSTOMERS * 35.00),
            "dtc_events": int(self.N_CUSTOMERS * 6.00),
            "loyalty_accounts": int(self.N_CUSTOMERS * 0.70),
            "loyalty_transactions": int(self.N_CUSTOMERS * 15.00),
            "gm_card_accounts": int(self.N_CUSTOMERS * 0.25),
            "campaign_interactions": int(self.N_CUSTOMERS * 50.00),
            "mobile_app_sessions": int(self.N_CUSTOMERS * 30.00),
            "website_sessions": int(self.N_CUSTOMERS * 20.00),
            "support_cases": int(self.N_CUSTOMERS * 1.20),
            "nps_surveys": int(self.N_CUSTOMERS * 2.50),
            "customer_identity_graph": int(self.N_CUSTOMERS * 2.20),
            "customer_segment_membership": int(self.N_CUSTOMERS * 4.00),
        }


def id_series(prefix: str, arr: np.ndarray, width: int = 8) -> pd.Series:
    return pd.Series([f"{prefix}{int(x):0{width}d}" for x in arr])


def pick(values: List, idx: np.ndarray) -> np.ndarray:
    a = np.array(values, dtype=object)
    return a[np.mod(idx.astype(np.int64), len(values))]


def between_dates(start_date: str, end_date: str, idx: np.ndarray, salt: int = 37) -> pd.Series:
    start = pd.to_datetime(start_date)
    end = pd.to_datetime(end_date)
    days = (end - start).days
    offsets = np.mod(idx.astype(np.int64) * salt, max(days, 1))
    return pd.to_datetime(start + pd.to_timedelta(offsets, unit="D"))


def add_audit(df: pd.DataFrame, base_id: np.ndarray) -> pd.DataFrame:
    created_at = pd.Timestamp("2020-01-01 00:00:00") + pd.to_timedelta(base_id.astype(np.int64), unit="s")
    updated_at = created_at + pd.to_timedelta(np.mod(base_id.astype(np.int64), 730), unit="D")
    df["created_at"] = created_at
    df["updated_at"] = updated_at
    return df


def write_df(cfg: Cfg, df: pd.DataFrame, table_name: str, append: bool = False) -> None:
    path = cfg.OUTPUT_PATH / f"{table_name}.csv"
    df.to_csv(path, mode="a" if append else "w", header=not append, index=False)
    action = "Appended" if append else "Wrote"
    print(f"{action:<8} {table_name:<35} rows={len(df):>10} -> {path}")


def iter_chunks(total: int, chunk_size: int) -> Iterable[tuple[int, np.ndarray]]:
    for start in range(0, total, chunk_size):
        stop = min(total, start + chunk_size)
        yield start, np.arange(start, stop, dtype=np.int64)


def customer_id_from_num(cfg: Cfg, num: np.ndarray) -> pd.Series:
    return id_series("CUST", np.mod(num.astype(np.int64), cfg.N_CUSTOMERS), 8)


def vehicle_id_from_num(cfg: Cfg, num: np.ndarray) -> pd.Series:
    return id_series("VEH", np.mod(num.astype(np.int64), cfg.N_VEHICLES), 8)


def dealer_id_from_num(cfg: Cfg, num: np.ndarray) -> pd.Series:
    return id_series("DLR", np.mod(num.astype(np.int64), cfg.N_DEALERS), 5)


def safe_decimal(series, digits=2):
    return np.round(series.astype(float), digits)


def choose_with_rng(cfg: Cfg, values: List, size: int) -> np.ndarray:
    return cfg.rng.choice(np.array(values, dtype=object), size)


# =========================
# Static reference data
# =========================

def build_geo() -> pd.DataFrame:
    geo_rows = [
        (0, "US", "MI", "Detroit", "48226", 42.3314, -83.0458, "Great Lakes"),
        (1, "US", "CA", "Los Angeles", "90001", 34.0522, -118.2437, "West"),
        (2, "US", "TX", "Dallas", "75201", 32.7767, -96.7970, "South Central"),
        (3, "US", "NY", "Buffalo", "14201", 42.8864, -78.8784, "Northeast"),
        (4, "US", "FL", "Tampa", "33602", 27.9506, -82.4572, "Southeast"),
        (5, "US", "IL", "Chicago", "60601", 41.8781, -87.6298, "Great Lakes"),
        (6, "US", "AZ", "Phoenix", "85004", 33.4484, -112.0740, "West"),
        (7, "US", "CO", "Denver", "80202", 39.7392, -104.9903, "Mountain"),
        (8, "US", "WA", "Seattle", "98101", 47.6062, -122.3321, "West"),
        (9, "US", "GA", "Atlanta", "30303", 33.7490, -84.3880, "Southeast"),
        (10, "US", "NC", "Charlotte", "28202", 35.2271, -80.8431, "Southeast"),
        (11, "US", "OH", "Cleveland", "44113", 41.4993, -81.6944, "Great Lakes"),
        (12, "US", "PA", "Pittsburgh", "15219", 40.4406, -79.9959, "Northeast"),
        (13, "US", "MN", "Minneapolis", "55401", 44.9778, -93.2650, "North Central"),
        (14, "US", "TN", "Nashville", "37201", 36.1627, -86.7816, "Southeast"),
        (15, "US", "MO", "Kansas City", "64106", 39.0997, -94.5786, "North Central"),
        (16, "US", "NV", "Las Vegas", "89101", 36.1699, -115.1398, "West"),
        (17, "US", "MA", "Boston", "02108", 42.3601, -71.0589, "Northeast"),
        (18, "CA", "ON", "Toronto", "M5H", 43.6532, -79.3832, "Canada East"),
        (19, "CA", "QC", "Montreal", "H3B", 45.5019, -73.5674, "Canada East"),
        (20, "CA", "BC", "Vancouver", "V6B", 49.2827, -123.1207, "Canada West"),
        (21, "CA", "AB", "Calgary", "T2P", 51.0447, -114.0719, "Canada West"),
    ]
    return pd.DataFrame(geo_rows, columns=[
        "geo_idx", "country_code", "state_province", "city", "postal_code", "latitude", "longitude", "region"
    ])


def build_vehicle_models() -> tuple[pd.DataFrame, list[int], list[int]]:
    model_specs = [
        ("Chevrolet", "Silverado", "Pickup", "ICE", 45000, 75000),
        ("Chevrolet", "Equinox", "SUV", "ICE", 29000, 42000),
        ("Chevrolet", "Tahoe", "SUV", "ICE", 58000, 79000),
        ("Chevrolet", "Suburban", "SUV", "ICE", 62000, 83000),
        ("Chevrolet", "Malibu", "Sedan", "ICE", 26000, 34000),
        ("Chevrolet", "Trailblazer", "SUV", "ICE", 24000, 34000),
        ("Chevrolet", "Bolt EV", "Hatchback", "EV", 28000, 36000),
        ("Chevrolet", "Bolt EUV", "SUV", "EV", 30000, 39000),
        ("GMC", "Sierra", "Pickup", "ICE", 47000, 82000),
        ("GMC", "Yukon", "SUV", "ICE", 62000, 89000),
        ("GMC", "Canyon", "Pickup", "ICE", 39000, 56000),
        ("GMC", "Acadia", "SUV", "ICE", 37000, 54000),
        ("GMC", "Terrain", "SUV", "ICE", 30000, 43000),
        ("GMC", "Hummer EV", "Pickup", "EV", 98000, 116000),
        ("Buick", "Enclave", "SUV", "ICE", 46000, 62000),
        ("Buick", "Encore GX", "SUV", "ICE", 28000, 39000),
        ("Buick", "Envista", "SUV", "ICE", 24000, 34000),
        ("Cadillac", "Escalade", "SUV", "ICE", 84000, 115000),
        ("Cadillac", "XT4", "SUV", "ICE", 39000, 52000),
        ("Cadillac", "XT5", "SUV", "ICE", 47000, 64000),
        ("Cadillac", "XT6", "SUV", "ICE", 53000, 72000),
        ("Cadillac", "CT4", "Sedan", "ICE", 36000, 52000),
        ("Cadillac", "CT5", "Sedan", "ICE", 42000, 68000),
        ("Cadillac", "LYRIQ", "SUV", "EV", 62000, 92000),
    ]
    trims = ["Base", "LT", "RS", "Premier", "Denali", "Avenir", "Luxury", "Sport"]
    rows = []
    for i in range(120):
        brand, model, body, powertrain, low, high = model_specs[i % len(model_specs)]
        year = 2020 + (i // len(model_specs))
        trim = trims[i % len(trims)]
        rows.append((i, f"MOD{i:04d}", brand, model, year, trim, body, powertrain, float(low), float(high)))
    df = pd.DataFrame(rows, columns=[
        "model_num", "model_id", "brand", "model_name", "model_year", "trim", "body_style",
        "powertrain_type", "msrp_low", "msrp_high"
    ])
    ev_model_nums = [i for i in range(120) if model_specs[i % len(model_specs)][3] == "EV"]
    ice_model_nums = [i for i in range(120) if model_specs[i % len(model_specs)][3] != "EV"]
    return df, ev_model_nums, ice_model_nums


# =========================
# Small reference / dimension tables
# =========================

def create_vehicle_models(cfg: Cfg) -> pd.DataFrame:
    df, _, _ = build_vehicle_models()
    df = add_audit(df, df["model_num"].to_numpy())
    out = df.drop(columns=["model_num"])
    write_df(cfg, out, "vehicle_models")
    return out


def create_dealers(cfg: Cfg, geo: pd.DataFrame) -> pd.DataFrame:
    ids = np.arange(cfg.N_DEALERS, dtype=np.int64)
    geo_idx = np.where(ids % 10 == 0, 18 + (ids % 4), ids % 18).astype(int)
    g = geo.set_index("geo_idx").loc[geo_idx].reset_index(drop=True)
    df = pd.DataFrame({
        "dealer_id": id_series("DLR", ids, 5),
        "dealer_code": pd.Series([f"GM{i:05d}" for i in ids]),
        "dealer_name": pd.Series(pick(["Metro", "Heritage", "Summit", "Lakeside", "Pioneer", "Capital"], ids)) + " " + g["city"].astype(str) + " " + pick(["Chevrolet", "GMC", "Buick", "Cadillac", "Multi-brand"], ids),
        "brand_affiliation": pick(["Chevrolet", "GMC", "Buick", "Cadillac", "Multi-brand"], ids),
        "country_code": g["country_code"].to_numpy(),
        "state_province": g["state_province"].to_numpy(),
        "city": g["city"].to_numpy(),
        "postal_code": g["postal_code"].to_numpy(),
        "region": g["region"].to_numpy(),
        "latitude": g["latitude"].to_numpy() + (cfg.rng.random(cfg.N_DEALERS) - 0.5) / 3,
        "longitude": g["longitude"].to_numpy() + (cfg.rng.random(cfg.N_DEALERS) - 0.5) / 3,
        "opened_date": between_dates("1985-01-01", "2021-01-01", ids, 91),
        "csi_score": np.round(72 + cfg.rng.random(cfg.N_DEALERS) * 27, 1),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "dealers")
    return df


def create_dealer_staff(cfg: Cfg) -> pd.DataFrame:
    ids = np.arange(cfg.N_STAFF, dtype=np.int64)
    gt = 0.06  # just to keep same semantics as spark rand > 0.06
    df = pd.DataFrame({
        "staff_id": id_series("STF", ids, 7),
        "dealer_id": dealer_id_from_num(cfg, ids),
        "first_name": pick(["Alex", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Jamie", "Drew"], ids),
        "last_name": pick(["Smith", "Johnson", "Williams", "Brown", "Garcia", "Miller", "Davis", "Wilson", "Anderson", "Martin"], ids * 3),
        "role": pick(["Sales Advisor", "Service Advisor", "Finance Manager", "Service Technician", "BDC Representative"], ids),
        "hire_date": between_dates("2012-01-01", "2025-01-01", ids, 19),
        "active_flag": cfg.rng.random(cfg.N_STAFF) > gt,
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "dealer_staff")
    return df


def create_warranty_plans(cfg: Cfg) -> pd.DataFrame:
    rows = [
        (0, "Bumper-to-Bumper Limited", "Basic", 36, 36000, 0.0, 0.0, "USD"),
        (1, "Powertrain Limited", "Powertrain", 60, 60000, 0.0, 0.0, "USD"),
        (2, "EV Battery Limited", "Battery", 96, 100000, 0.0, 0.0, "USD"),
        (3, "Platinum Protection", "Extended", 84, 100000, 100.0, 2495.0, "USD"),
        (4, "Silver Protection", "Extended", 60, 75000, 100.0, 1495.0, "USD"),
        (5, "Certified Pre-Owned", "CPO", 72, 100000, 0.0, 995.0, "USD"),
        (6, "Roadside Plus", "Roadside", 60, 60000, 0.0, 299.0, "USD"),
        (7, "Canadian Comprehensive", "Basic", 36, 60000, 0.0, 0.0, "CAD"),
        (8, "Canadian Powertrain", "Powertrain", 60, 100000, 0.0, 0.0, "CAD"),
        (9, "Canadian Extended Guard", "Extended", 84, 160000, 150.0, 2995.0, "CAD"),
    ]
    df = pd.DataFrame(rows, columns=[
        "id", "plan_name", "coverage_type", "term_months", "mileage_limit", "deductible_amount", "plan_price", "currency_code"
    ])
    df = add_audit(df, df["id"].to_numpy())
    df.insert(0, "warranty_plan_id", id_series("WAR", df["id"].to_numpy(), 3))
    df = df.drop(columns=["id"])
    write_df(cfg, df, "warranty_plans")
    return df


def create_recalls(cfg: Cfg, model_specs_names: List[str]) -> pd.DataFrame:
    ids = np.arange(25, dtype=np.int64)
    start_year = 2020 + (ids % 3)
    df = pd.DataFrame({
        "recall_id": id_series("REC", ids, 4),
        "campaign_code": pd.Series([f"N{2020 + (i % 6)}{i:04d}" for i in ids]),
        "campaign_name": pd.Series(pick(["Airbag", "Brake Module", "Battery Cable", "Seat Belt", "Infotainment", "Fuel Pump"], ids)) + " Service Update",
        "issue_category": pick(["Safety", "Emissions", "Powertrain", "Electrical", "Software"], ids),
        "affected_brand": pick(["Chevrolet", "GMC", "Buick", "Cadillac"], ids),
        "affected_model": pick(model_specs_names, ids * 5),
        "affected_model_year_start": start_year,
        "affected_model_year_end": start_year + 2,
        "launch_date": between_dates("2021-01-01", "2025-10-01", ids, 47),
        "severity": pick(["Low", "Medium", "High"], ids),
        "remedy_description": pd.Series(["Dealer inspection and "]) + pd.Series(pick(["software update", "part replacement", "calibration", "harness repair"], ids)),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "recalls")
    return df


def create_marketing_campaigns(cfg: Cfg) -> pd.DataFrame:
    ids = np.arange(150, dtype=np.int64)
    campaign_type = pick(["Service Reminder", "Recall Outreach", "OnStar Upsell", "EV Education", "Lease Pull-Ahead", "Loyalty Offer"], ids)
    target_segment = pick(["Lapsed Service", "EV Intender", "High CLV", "New Owner", "Connected Trial", "GM Card Holder"], ids * 2)
    start_date = between_dates("2020-11-01", "2025-11-01", ids, 29)
    end_date = start_date + pd.to_timedelta(21 + (ids % 45), unit="D")
    df = pd.DataFrame({
        "campaign_id": id_series("CMP", ids, 5),
        "campaign_name": pd.Series(target_segment) + " - " + pd.Series(campaign_type) + " " + pd.Series((2020 + (ids % 6)).astype(str)),
        "campaign_type": campaign_type,
        "target_segment": target_segment,
        "channel": pick(["Email", "SMS", "Direct Mail", "In-App", "Paid Media"], ids),
        "start_date": start_date,
        "end_date": end_date,
        "budget_amount": np.round(15000 + cfg.rng.random(len(ids)) * 235000, 2),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "marketing_campaigns")
    return df


def create_customer_segments(cfg: Cfg) -> pd.DataFrame:
    rows = [
        ("SEG001", "EV Intender", "ICE owners engaging with EV content", "Behavioral", "Daily"),
        ("SEG002", "Lapsed Service", "No dealer service in 12+ months with active vehicle", "Lifecycle", "Daily"),
        ("SEG003", "High CLV", "Top projected lifetime value customers", "Value", "Weekly"),
        ("SEG004", "Warranty Risk", "Elevated claim volume or severity", "Risk", "Weekly"),
        ("SEG005", "Connected Trial Expiring", "OnStar trial ending soon", "Lifecycle", "Daily"),
        ("SEG006", "GM Card Holder", "Active GM Card customers", "Value", "Daily"),
        ("SEG007", "Recall Open", "Open recall with no scheduled appointment", "Operational", "Daily"),
        ("SEG008", "Service Loyalist", "Regular dealer service usage", "Behavioral", "Weekly"),
        ("SEG009", "No-Show Risk", "High service appointment no-show probability", "ML", "Daily"),
        ("SEG010", "Lease Maturity", "Lease ending within 180 days", "Lifecycle", "Daily"),
        ("SEG011", "Premium SUV Owner", "Escalade/Yukon/Suburban/Tahoe owners", "Product", "Weekly"),
        ("SEG012", "Truck Loyalist", "Silverado/Sierra/Canyon owners", "Product", "Weekly"),
        ("SEG013", "Low NPS Recovery", "Recent low NPS or CSAT", "Experience", "Daily"),
        ("SEG014", "High Mileage", "Above-average monthly mileage", "Usage", "Monthly"),
        ("SEG015", "Urban Commuter", "Short frequent trips in metro markets", "Usage", "Monthly"),
        ("SEG016", "Safety Upsell", "Eligible for OnStar Safety & Security", "Offer", "Weekly"),
        ("SEG017", "Parts Heavy", "High parts revenue customer", "Value", "Monthly"),
        ("SEG018", "Collision Claim", "Recent insurance collision claim", "Risk", "Daily"),
        ("SEG019", "New Owner Welcome", "Purchased in last 90 days", "Lifecycle", "Daily"),
        ("SEG020", "VIP Loyalty", "Platinum rewards or high point balance", "Value", "Weekly"),
    ]
    df = pd.DataFrame(rows, columns=["segment_id", "segment_name", "segment_description", "segment_type", "refresh_frequency"])
    ids = np.arange(len(df), dtype=np.int64)
    df = add_audit(df, ids)
    write_df(cfg, df, "customer_segments")
    return df


def create_households(cfg: Cfg, geo: pd.DataFrame) -> pd.DataFrame:
    ids = np.arange(cfg.N_HOUSEHOLDS, dtype=np.int64)
    geo_idx = np.where(ids % 10 == 0, 18 + (ids % 4), ids % 18).astype(int)
    g = geo.set_index("geo_idx").loc[geo_idx].reset_index(drop=True)
    income_bands = ["Under $50K", "$50K-$75K", "$75K-$100K", "$100K-$150K", "$150K+"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Martin", "Lee"]
    df = pd.DataFrame({
        "household_id": id_series("HH", ids, 8),
        "household_name": pd.Series(pick(last_names, ids)) + " Household",
        "home_country": g["country_code"].to_numpy(),
        "home_state_province": g["state_province"].to_numpy(),
        "home_city": g["city"].to_numpy(),
        "income_band": pick(income_bands, ids * 7),
        "household_size": 1 + (ids % 5),
        "vehicles_in_household": 1 + (ids % 3),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "households")
    return df


def create_customers(cfg: Cfg, geo: pd.DataFrame) -> pd.DataFrame:
    ids = np.arange(cfg.N_CUSTOMERS, dtype=np.int64)
    geo_idx = np.where(ids % 10 == 0, 18 + (ids % 4), ids % 18).astype(int)
    g = geo.set_index("geo_idx").loc[geo_idx].reset_index(drop=True)
    income_bands = ["Under $50K", "$50K-$75K", "$75K-$100K", "$100K-$150K", "$150K+"]
    first_names = ["James", "Mary", "Robert", "Patricia", "John", "Jennifer", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara", "Richard", "Susan", "Joseph", "Jessica", "Thomas", "Sarah", "Charles", "Karen"]
    last_names = ["Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Martin", "Lee"]
    age = (22 + ((ids * 13) % 58)).astype(int)
    birth_date = pd.Timestamp(datetime.utcnow().date()) - pd.to_timedelta(age * 365, unit="D")
    generation = np.where(age < 29, "Gen Z", np.where(age < 44, "Millennial", np.where(age < 60, "Gen X", "Boomer")))
    base_ev = cfg.rng.random(cfg.N_CUSTOMERS)
    city_bonus = np.where(pd.Series(g["city"]).isin(["Los Angeles", "Seattle", "Denver", "Vancouver", "Toronto"]), 0.18, 0.0)
    ev_propensity = np.minimum(0.98, base_ev + city_bonus)
    preferred_language = np.where(g["country_code"].to_numpy() == "CA", pick(["English", "French"], ids), pick(["English", "Spanish"], ids))
    df = pd.DataFrame({
        "customer_id": id_series("CUST", ids, 8),
        "household_id": id_series("HH", ids % cfg.N_HOUSEHOLDS, 8),
        "first_name": pick(first_names, ids * 5),
        "last_name": pick(last_names, ids * 11),
        "gender": pick(["Female", "Male", "Non-binary", "Prefer not to say"], ids),
        "birth_date": birth_date,
        "age": age,
        "generation": generation,
        "lifecycle_stage": pick(["Prospect", "New Owner", "Active Owner", "Loyalist", "At Risk", "Inactive"], ids * 3),
        "customer_since": between_dates("2010-01-01", "2025-11-01", ids, 41),
        "preferred_language": preferred_language,
        "primary_country": g["country_code"].to_numpy(),
        "primary_state_province": g["state_province"].to_numpy(),
        "primary_city": g["city"].to_numpy(),
        "income_band": pick(income_bands, ids * 7),
        "estimated_clv": np.round(1800 + cfg.rng.random(cfg.N_CUSTOMERS) * 65000, 2),
        "churn_risk_score": np.round(cfg.rng.random(cfg.N_CUSTOMERS), 4),
        "ev_propensity_score": np.round(ev_propensity, 4),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "customers")
    return df


def create_customer_addresses(cfg: Cfg, geo: pd.DataFrame) -> None:
    total = cfg.TARGETS["customer_addresses"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        geo_idx = np.where(ids % 10 == 0, 18 + (ids % 4), ids % 18).astype(int)
        g = geo.set_index("geo_idx").loc[geo_idx].reset_index(drop=True)
        line1 = (100 + (ids % 8900)).astype(str)
        line1 = pd.Series(line1) + " " + pd.Series(pick(["Main", "Oak", "Maple", "Lake", "Grand", "Market"], ids)) + " " + pd.Series(pick(["St", "Ave", "Rd", "Blvd", "Dr"], ids * 2))
        valid_from = between_dates("2018-01-01", "2025-01-01", ids, 23)
        has_end = cfg.rng.random(len(ids)) < 0.04
        valid_to = valid_from + pd.to_timedelta(500, unit="D")
        valid_to = valid_to.where(has_end, pd.NaT)
        df = pd.DataFrame({
            "address_id": id_series("ADDR", ids, 9),
            "customer_id": customer_id_from_num(cfg, ids),
            "address_type": pick(["Billing", "Garage", "Mailing"], ids),
            "line1": line1,
            "city": g["city"].to_numpy(),
            "state_province": g["state_province"].to_numpy(),
            "postal_code": g["postal_code"].to_numpy(),
            "country_code": g["country_code"].to_numpy(),
            "latitude": g["latitude"].to_numpy() + (cfg.rng.random(len(ids)) - 0.5) / 2,
            "longitude": g["longitude"].to_numpy() + (cfg.rng.random(len(ids)) - 0.5) / 2,
            "is_primary": ids < cfg.N_CUSTOMERS,
            "valid_from": valid_from,
            "valid_to": valid_to,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "customer_addresses", append=start > 0)


def create_customer_contacts(cfg: Cfg) -> None:
    total = cfg.TARGETS["customer_contacts"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        contact_type = np.where((ids % 5) < 3, "Email", "Phone")
        cids = customer_id_from_num(cfg, ids)
        email_domain = pick(["gmail.com", "yahoo.com", "outlook.com", "icloud.com", "hotmail.com", "gmail.ca"], ids)
        emails = cids.str.lower() + "@" + pd.Series(email_domain)
        phones = "+1-" + pd.Series((200 + (ids % 700)).astype(str)).str.zfill(3) + "-" + pd.Series(((ids * 17) % 10000).astype(str)).str.zfill(4)
        contact_value = np.where(contact_type == "Email", emails, phones)
        df = pd.DataFrame({
            "contact_id": id_series("CONT", ids, 9),
            "customer_id": cids,
            "contact_type": contact_type,
            "contact_value": contact_value,
            "is_primary": ids < cfg.N_CUSTOMERS,
            "is_verified": cfg.rng.random(len(ids)) < 0.91,
            "marketing_opt_in": cfg.rng.random(len(ids)) < 0.85,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "customer_contacts", append=start > 0)


def create_customer_consents(cfg: Cfg) -> pd.DataFrame:
    ids = np.arange(cfg.N_CUSTOMERS, dtype=np.int64)
    effective_at = between_dates("2020-01-01", "2025-11-01", ids, 31)
    df = pd.DataFrame({
        "consent_id": id_series("CONS", ids, 8),
        "customer_id": customer_id_from_num(cfg, ids),
        "consent_type": pick(["Marketing", "Telematics", "Data Sharing", "Personalization"], ids),
        "consent_status": np.where(cfg.rng.random(cfg.N_CUSTOMERS) < 0.82, "Opted In", "Opted Out"),
        "consent_source": pick(["Dealer", "Mobile App", "Website", "Call Center"], ids),
        "effective_at": effective_at,
        "expires_at": pd.NaT,
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "customer_consents")
    return df


# =========================
# Vehicle / sales domain
# =========================

def create_vehicles(cfg: Cfg, vehicle_models_tmp: pd.DataFrame, ev_model_nums: List[int], ice_model_nums: List[int]) -> pd.DataFrame:
    ids = np.arange(cfg.N_VEHICLES, dtype=np.int64)
    model_num = np.where((ids % 100) < 6, np.array(ev_model_nums, dtype=int)[ids % len(ev_model_nums)], np.array(ice_model_nums, dtype=int)[ids % len(ice_model_nums)])
    joined = vehicle_models_tmp.set_index("model_num").loc[model_num].reset_index(drop=True)
    build_date = between_dates("2020-01-01", "2025-10-01", ids, 11)
    in_service_date = build_date + pd.to_timedelta(20 + (ids % 120), unit="D")
    vin_core = pd.Series(ids.astype(str)).map(lambda s: pd.util.hash_pandas_object(pd.Series([s]), index=False).astype(str).iloc[0])
    # simplify VIN to deterministic 17-char surrogate starting with 1G
    vin = pd.Series([("1G" + hex(abs(hash(int(i))))[2:].upper().zfill(15))[:17] for i in ids])
    vehicle_status = np.where(cfg.rng.random(cfg.N_VEHICLES) < 0.94, "Active", pick(["Sold", "Total Loss", "Exported"], ids))
    df = pd.DataFrame({
        "vehicle_id": id_series("VEH", ids, 8),
        "vin": vin,
        "model_id": joined["model_id"].to_numpy(),
        "brand": joined["brand"].to_numpy(),
        "model_name": joined["model_name"].to_numpy(),
        "model_year": joined["model_year"].to_numpy(),
        "trim": joined["trim"].to_numpy(),
        "powertrain_type": joined["powertrain_type"].to_numpy(),
        "exterior_color": pick(["Summit White", "Black", "Sterling Gray", "Radiant Red", "Northsky Blue", "Crystal White", "Silver Ice"], ids),
        "build_date": build_date,
        "in_service_date": in_service_date,
        "current_mileage": (500 + ((ids * 809) % 98000)).astype(int),
        "vehicle_status": vehicle_status,
        "selling_dealer_id": dealer_id_from_num(cfg, ids * 7),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "vehicles")
    return df


def create_sales_transactions(cfg: Cfg, vehicles_tmp: pd.DataFrame, vehicle_models_tmp: pd.DataFrame) -> pd.DataFrame:
    ids = np.arange(cfg.N_VEHICLES, dtype=np.int64)
    # map model pricing from model_id back to numeric model row for price range
    pricing = vehicle_models_tmp.drop(columns=["brand", "model_name", "model_year", "trim", "body_style", "powertrain_type"]).set_index("model_id")
    joined = pricing.loc[vehicles_tmp["model_id"]].reset_index(drop=True)
    msrp = np.round(joined["msrp_low"].to_numpy() + cfg.rng.random(cfg.N_VEHICLES) * (joined["msrp_high"].to_numpy() - joined["msrp_low"].to_numpy()), 2)
    incentives = np.round(cfg.rng.random(cfg.N_VEHICLES) * 4500, 2)
    negotiated = np.round(msrp - incentives - (cfg.rng.random(cfg.N_VEHICLES) * 2500), 2)
    taxes_fees = np.round(negotiated * 0.072 + 499, 2)
    total_drive_off = np.round(negotiated + taxes_fees, 2)
    df = pd.DataFrame({
        "sales_transaction_id": id_series("SALE", ids, 8),
        "vehicle_id": vehicles_tmp["vehicle_id"].to_numpy(),
        "customer_id": customer_id_from_num(cfg, ids * 17),
        "dealer_id": vehicles_tmp["selling_dealer_id"].to_numpy(),
        "sales_date": between_dates("2020-11-01", "2025-11-01", ids, 17),
        "transaction_type": np.where(ids % 5 == 0, "Lease", "Purchase"),
        "sale_channel": pick(["Showroom", "Online Lead", "Phone", "Fleet"], ids),
        "msrp": msrp,
        "negotiated_price": negotiated,
        "incentives_amount": incentives,
        "taxes_fees_amount": taxes_fees,
        "total_drive_off_amount": total_drive_off,
        "currency_code": np.where((ids % 10) == 0, "CAD", "USD"),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "sales_transactions")
    return df


def create_vehicle_ownership(cfg: Cfg) -> None:
    current_ids = np.arange(cfg.N_VEHICLES, dtype=np.int64)
    current_df = pd.DataFrame({
        "ownership_id": id_series("OWN", current_ids, 9),
        "vehicle_id": vehicle_id_from_num(cfg, current_ids),
        "customer_id": customer_id_from_num(cfg, current_ids * 17),
        "ownership_type": np.where(current_ids % 5 == 0, "Lease", "Owner"),
        "start_date": between_dates("2020-11-01", "2025-11-01", current_ids, 17),
        "end_date": pd.NaT,
        "is_current_owner": True,
        "acquisition_channel": pick(["New Sale", "CPO", "Private Transfer", "Fleet"], current_ids),
    })
    current_df = add_audit(current_df, current_ids)
    write_df(cfg, current_df, "vehicle_ownership")

    prev_count = cfg.TARGETS["vehicle_ownership"] - cfg.N_VEHICLES
    if prev_count > 0:
        for start, ids in iter_chunks(prev_count, cfg.CHUNK):
            ids2 = ids + cfg.N_VEHICLES
            start_date = between_dates("2018-01-01", "2022-06-01", ids, 31)
            end_date = start_date + pd.to_timedelta(365 + (ids % 900), unit="D")
            prev_df = pd.DataFrame({
                "ownership_id": id_series("OWN", ids2, 9),
                "vehicle_id": vehicle_id_from_num(cfg, ids),
                "customer_id": customer_id_from_num(cfg, ids * 29 + 7),
                "ownership_type": "Owner",
                "start_date": start_date,
                "end_date": end_date,
                "is_current_owner": False,
                "acquisition_channel": "Trade-In",
            })
            prev_df = add_audit(prev_df, ids2)
            write_df(cfg, prev_df, "vehicle_ownership", append=True)


def create_trade_ins(cfg: Cfg) -> None:
    total = cfg.TARGETS["trade_ins"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        traded_vin = pd.Series([("2G" + hex(abs(hash("T" + str(int(i)))))[2:].upper().zfill(15))[:17] for i in ids])
        payoff_zero = cfg.rng.random(len(ids)) >= 0.35
        payoff = np.round(np.where(payoff_zero, 0, cfg.rng.random(len(ids)) * 18000), 2)
        df = pd.DataFrame({
            "trade_in_id": id_series("TRD", ids, 8),
            "sales_transaction_id": id_series("SALE", ids * 2, 8),
            "customer_id": customer_id_from_num(cfg, ids * 17),
            "traded_vin": traded_vin,
            "make": pick(["Chevrolet", "GMC", "Buick", "Cadillac", "Ford", "Toyota", "Honda", "Jeep"], ids),
            "model": pick(["Silverado", "Equinox", "Sierra", "Camry", "F-150", "Wrangler", "CR-V", "Escalade"], ids * 2),
            "model_year": 2012 + (ids % 12),
            "mileage": 18000 + ((ids * 997) % 142000),
            "appraised_value": np.round(3000 + cfg.rng.random(len(ids)) * 42000, 2),
            "payoff_amount": payoff,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "trade_ins", append=start > 0)


def create_financing_contracts(cfg: Cfg) -> None:
    total = cfg.TARGETS["financing_contracts"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        term_months = pick([24, 36, 48, 60, 72, 84], ids).astype(int)
        amount_financed = np.round(18000 + cfg.rng.random(len(ids)) * 78000, 2)
        apr = np.round(1.9 + cfg.rng.random(len(ids)) * 7.5, 2)
        monthly_payment = np.round(amount_financed / term_months * (1 + apr / 100), 2)
        start_date = between_dates("2020-11-01", "2025-11-01", ids, 17)
        maturity_date = start_date + pd.to_timedelta(term_months * 30, unit="D")
        contract_status = np.where(maturity_date < pd.Timestamp(datetime.utcnow().date()), "Matured", "Active")
        df = pd.DataFrame({
            "finance_contract_id": id_series("FIN", ids, 8),
            "sales_transaction_id": id_series("SALE", ids, 8),
            "customer_id": customer_id_from_num(cfg, ids * 17),
            "vehicle_id": vehicle_id_from_num(cfg, ids),
            "finance_type": np.where(ids % 5 == 0, "Lease", "Loan"),
            "lender_name": pick(["GM Financial", "Ally", "Capital One Auto", "TD Auto Finance", "RBC Auto Finance"], ids),
            "apr": apr,
            "term_months": term_months,
            "monthly_payment": monthly_payment,
            "amount_financed": amount_financed,
            "down_payment": np.round(cfg.rng.random(len(ids)) * 9000, 2),
            "start_date": start_date,
            "maturity_date": maturity_date,
            "contract_status": contract_status,
            "currency_code": np.where((ids % 10) == 0, "CAD", "USD"),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "financing_contracts", append=start > 0)


# =========================
# Service / recall domain
# =========================

def create_service_appointments(cfg: Cfg) -> None:
    total = cfg.TARGETS["service_appointments"]
    service_reasons = ["Oil Change", "Tire Rotation", "Brake Inspection", "Battery Check", "Recall Repair", "Check Engine Light", "Scheduled Maintenance", "Collision Repair"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 7) % cfg.N_VEHICLES
        no_show = cfg.rng.random(len(ids)) < 0.08
        cancel = cfg.rng.random(len(ids)) < 0.03
        status = np.where(no_show, "No Show", np.where(cancel, "Cancelled", "Completed"))
        df = pd.DataFrame({
            "appointment_id": id_series("APT", ids, 9),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "dealer_id": dealer_id_from_num(cfg, vehicle_num * 7 + ids),
            "scheduled_date": between_dates("2022-11-01", "2025-11-01", ids, 13),
            "appointment_channel": pick(["Phone", "Website", "Mobile App", "Dealer Walk-In"], ids),
            "appointment_reason": pick(service_reasons, ids),
            "appointment_status": status,
            "no_show_flag": no_show,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "service_appointments", append=start > 0)


def create_service_orders(cfg: Cfg) -> None:
    total = cfg.TARGETS["service_orders"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 7) % cfg.N_VEHICLES
        opened_date = between_dates("2022-11-01", "2025-11-01", ids, 13)
        closed_date = opened_date + pd.to_timedelta(ids % 5, unit="D")
        labor = np.round(65 + cfg.rng.random(len(ids)) * 900, 2)
        parts = np.round(35 + cfg.rng.random(len(ids)) * 1600, 2)
        tax = np.round((labor + parts) * 0.072, 2)
        total_amount = np.round(labor + parts + tax, 2)
        df = pd.DataFrame({
            "service_order_id": id_series("RO", ids, 9),
            "appointment_id": id_series("APT", ids, 9),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "dealer_id": dealer_id_from_num(cfg, vehicle_num * 7 + ids),
            "opened_date": opened_date,
            "closed_date": closed_date,
            "odometer": 2500 + ((ids * 541) % 115000),
            "ro_status": "Closed",
            "total_labor_amount": labor,
            "total_parts_amount": parts,
            "total_tax_amount": tax,
            "total_amount": total_amount,
            "currency_code": np.where((ids % 10) == 0, "CAD", "USD"),
            "advisor_staff_id": id_series("STF", (ids * 3) % cfg.N_STAFF, 7),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "service_orders", append=start > 0)


def create_service_line_items(cfg: Cfg) -> None:
    total = cfg.TARGETS["service_line_items"]
    service_reasons = ["Oil Change", "Tire Rotation", "Brake Inspection", "Battery Check", "Recall Repair", "Check Engine Light", "Scheduled Maintenance", "Collision Repair"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        service_category = pick(["Maintenance", "Repair", "Recall", "Warranty", "Tires", "Collision"], ids)
        labor_hours = np.round(0.2 + cfg.rng.random(len(ids)) * 4.5, 1)
        labor_amount = np.round(labor_hours * (95 + cfg.rng.random(len(ids)) * 85), 2)
        parts_amount = np.round(cfg.rng.random(len(ids)) * 1200, 2)
        df = pd.DataFrame({
            "service_line_item_id": id_series("SLI", ids, 10),
            "service_order_id": id_series("RO", ids % cfg.TARGETS["service_orders"], 9),
            "line_number": 1 + (ids % 6),
            "service_category": service_category,
            "operation_code": pd.Series(np.char.upper(np.char.array(pd.Series(service_category).str[:3].to_numpy().astype(str)))) + pd.Series((ids % 999).astype(str)).str.zfill(3),
            "description": pd.Series(service_category) + " - " + pd.Series(pick(service_reasons, ids * 2)),
            "labor_hours": labor_hours,
            "labor_amount": labor_amount,
            "parts_amount": parts_amount,
            "warranty_covered_flag": pd.Series(service_category).isin(["Recall", "Warranty"]).to_numpy(),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "service_line_items", append=start > 0)


def create_recall_responses(cfg: Cfg) -> None:
    total = cfg.TARGETS["recall_responses"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 11) % cfg.N_VEHICLES
        r1 = cfg.rng.random(len(ids))
        r2 = cfg.rng.random(len(ids))
        status = np.where(r1 < 0.68, "Completed", np.where(r2 < 0.78, "Scheduled", "Open"))
        notification_date = between_dates("2021-01-01", "2025-11-01", ids, 37)
        completed_date = notification_date + pd.to_timedelta(7 + (ids % 240), unit="D")
        completed_date = completed_date.where(status == "Completed", pd.NaT)
        df = pd.DataFrame({
            "recall_response_id": id_series("RSP", ids, 9),
            "recall_id": id_series("REC", ids % 25, 4),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "dealer_id": dealer_id_from_num(cfg, vehicle_num * 7),
            "notification_date": notification_date,
            "response_status": status,
            "completed_date": completed_date,
            "outreach_channel": pick(["Email", "SMS", "Direct Mail", "Phone", "In-App"], ids),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "recall_responses", append=start > 0)


# =========================
# Warranty / insurance
# =========================

def create_warranty_claims(cfg: Cfg) -> None:
    total = cfg.TARGETS["warranty_claims"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 19) % cfg.N_VEHICLES
        status = pick(["Approved", "Approved", "Approved", "Denied", "Pending"], ids)
        requested = np.round(120 + cfg.rng.random(len(ids)) * 5400, 2)
        approved = np.round(np.where(status == "Denied", 0, requested * (0.72 + cfg.rng.random(len(ids)) * 0.28)), 2)
        fraud = np.round(np.where(ids % 997 == 0, 0.85 + cfg.rng.random(len(ids)) * 0.14, cfg.rng.random(len(ids)) * 0.45), 4)
        df = pd.DataFrame({
            "warranty_claim_id": id_series("WCL", ids, 8),
            "warranty_plan_id": id_series("WAR", ids % 10, 3),
            "service_order_id": id_series("RO", (ids * 5) % cfg.TARGETS["service_orders"], 9),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "dealer_id": dealer_id_from_num(cfg, vehicle_num * 7),
            "claim_date": between_dates("2022-11-01", "2025-11-01", ids, 23),
            "claim_status": status,
            "claim_category": pick(["Powertrain", "Electrical", "Infotainment", "Battery", "HVAC", "Safety"], ids),
            "requested_amount": requested,
            "approved_amount": approved,
            "fraud_signal_score": fraud,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "warranty_claims", append=start > 0)


def create_insurance_policies(cfg: Cfg) -> None:
    total = cfg.TARGETS["insurance_policies"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 13) % cfg.N_VEHICLES
        start_date = between_dates("2021-01-01", "2025-09-01", ids, 41)
        end_date = start_date + pd.to_timedelta(365, unit="D")
        deductible = pick([250, 500, 750, 1000, 1500], ids).astype(float)
        df = pd.DataFrame({
            "insurance_policy_id": id_series("POL", ids, 8),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "provider_name": pick(["OnStar Insurance", "State Farm", "Allstate", "Progressive", "GEICO", "TD Insurance", "Intact"], ids),
            "policy_type": pick(["Full Coverage", "Liability", "Commercial", "Lease Required"], ids),
            "policy_status": np.where(cfg.rng.random(len(ids)) < 0.92, "Active", "Cancelled"),
            "start_date": start_date,
            "end_date": end_date,
            "annual_premium": np.round(750 + cfg.rng.random(len(ids)) * 2900, 2),
            "deductible_amount": deductible,
            "telematics_discount_flag": cfg.rng.random(len(ids)) < 0.28,
            "currency_code": np.where((ids % 10) == 0, "CAD", "USD"),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "insurance_policies", append=start > 0)


def create_insurance_claims(cfg: Cfg) -> None:
    total = cfg.TARGETS["insurance_claims"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 13) % cfg.N_VEHICLES
        status = pick(["Closed Paid", "Closed Denied", "Open", "Subrogation"], ids)
        loss = np.round(300 + cfg.rng.random(len(ids)) * 18000, 2)
        paid = np.round(np.where(status == "Closed Denied", 0, loss * (0.55 + cfg.rng.random(len(ids)) * 0.42)), 2)
        df = pd.DataFrame({
            "insurance_claim_id": id_series("ICL", ids, 8),
            "insurance_policy_id": id_series("POL", (ids * 3) % cfg.TARGETS["insurance_policies"], 8),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "claim_date": between_dates("2022-11-01", "2025-11-01", ids, 29),
            "claim_type": pick(["Collision", "Comprehensive", "Glass", "Theft", "Weather"], ids),
            "claim_status": status,
            "loss_amount": loss,
            "paid_amount": paid,
            "at_fault_flag": cfg.rng.random(len(ids)) < 0.48,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "insurance_claims", append=start > 0)


# =========================
# Connected services / telematics
# =========================

def create_connected_services_subscriptions(cfg: Cfg) -> None:
    total = cfg.TARGETS["connected_services_subscriptions"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 5) % cfg.N_VEHICLES
        plan_name = pick(["Connected Vehicle", "Remote Access", "Safety & Security", "Premium"], ids)
        status = np.where(cfg.rng.random(len(ids)) < 0.78, "Active", pick(["Trial", "Cancelled", "Expired"], ids))
        start_date = between_dates("2020-11-01", "2025-11-01", ids, 19)
        end_date = start_date + pd.to_timedelta(90 + (ids % 720), unit="D")
        end_date = end_date.where(pd.Series(status).isin(["Cancelled", "Expired"]), pd.NaT)
        monthly_fee = np.where(plan_name == "Premium", 49.99, np.where(plan_name == "Safety & Security", 29.99, np.where(plan_name == "Remote Access", 14.99, 9.99)))
        df = pd.DataFrame({
            "subscription_id": id_series("SUB", ids, 8),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "plan_name": plan_name,
            "subscription_status": status,
            "trial_flag": status == "Trial",
            "start_date": start_date,
            "end_date": end_date,
            "monthly_fee": monthly_fee,
            "auto_renew_flag": cfg.rng.random(len(ids)) < 0.74,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "connected_services_subscriptions", append=start > 0)


def create_telematics_monthly_summary(cfg: Cfg) -> None:
    total = cfg.TARGETS["telematics_monthly_summary"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = ids % cfg.N_VEHICLES
        month_idx = ((ids // cfg.N_VEHICLES) % cfg.N_MONTHS).astype(int)
        month_start = pd.to_datetime("2022-11-01") + pd.to_timedelta(month_idx * 30, unit="D")
        months = pd.DatetimeIndex(month_start)
        season_factor = np.where(months.month.isin([12, 1, 2]), 0.82, np.where(months.month.isin([6, 7, 8]), 1.12, 1.0))
        miles_driven = np.round((650 + cfg.rng.random(len(ids)) * 1100) * season_factor, 0).astype(int)
        trip_count = (20 + ((ids * 7) % 95)).astype(int)
        avg_trip = np.round(miles_driven / trip_count, 1)
        odometer_start = (month_idx * miles_driven + ((vehicle_num * 997) % 25000)).astype(int)
        odometer_end = odometer_start + miles_driven
        is_ev = (vehicle_num % 100) < 6
        fuel_gallons = np.where(is_ev, 0, np.round(miles_driven / (18 + cfg.rng.random(len(ids)) * 14), 1))
        kwh = np.where(is_ev, np.round(miles_driven * (0.27 + cfg.rng.random(len(ids)) * 0.11), 1), 0)
        hard_brake = ((ids * 3) % 18).astype(int)
        hard_acc = ((ids * 5) % 16).astype(int)
        nighttime = ((ids * 2) % 20).astype(int)
        idle = np.where(is_ev, 0, ((ids * 23) % 620).astype(int))
        safety = np.round(np.maximum(42, 100 - hard_brake * 1.3 - hard_acc * 1.1 - cfg.rng.random(len(ids)) * 8), 1)
        df = pd.DataFrame({
            "telematics_month_id": id_series("TEL", ids, 10),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "month_start": month_start,
            "odometer_start": odometer_start,
            "odometer_end": odometer_end,
            "miles_driven": miles_driven,
            "trip_count": trip_count,
            "avg_trip_miles": avg_trip,
            "fuel_gallons": fuel_gallons,
            "kwh_consumed": kwh,
            "hard_brake_count": hard_brake,
            "hard_acceleration_count": hard_acc,
            "nighttime_trip_count": nighttime,
            "idle_minutes": idle,
            "safety_score": safety,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "telematics_monthly_summary", append=start > 0)


def create_vehicle_health_reports(cfg: Cfg) -> None:
    total = cfg.TARGETS["vehicle_health_reports"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = ids % cfg.N_VEHICLES
        month_idx = ((ids // cfg.N_VEHICLES) % cfg.N_MONTHS).astype(int)
        month_start = pd.to_datetime("2022-11-01") + pd.to_timedelta(month_idx * 30, unit="D")
        oil_life = np.mod(100 - month_idx * 7 - np.mod(vehicle_num, 19), 101).astype(int)
        battery = (72 + ((vehicle_num * 5) % 29)).astype(int)
        brake_life = (25 + np.mod(100 - month_idx * 2 - np.mod(vehicle_num, 25), 75)).astype(int)
        health_status = np.where((oil_life < 15) | (brake_life < 25), "Action Needed", np.where(battery < 78, "Watch", "Good"))
        df = pd.DataFrame({
            "health_report_id": id_series("HLT", ids, 10),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "month_start": month_start,
            "oil_life_pct": oil_life,
            "tire_pressure_fl_psi": np.round(31 + cfg.rng.random(len(ids)) * 6, 1),
            "tire_pressure_fr_psi": np.round(31 + cfg.rng.random(len(ids)) * 6, 1),
            "tire_pressure_rl_psi": np.round(31 + cfg.rng.random(len(ids)) * 6, 1),
            "tire_pressure_rr_psi": np.round(31 + cfg.rng.random(len(ids)) * 6, 1),
            "battery_health_pct": battery,
            "brake_pad_life_pct": brake_life,
            "health_status": health_status,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "vehicle_health_reports", append=start > 0)


def create_dtc_events(cfg: Cfg) -> None:
    total = cfg.TARGETS["dtc_events"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 17) % cfg.N_VEHICLES
        month_idx = (ids % cfg.N_MONTHS).astype(int)
        month_start = pd.to_datetime("2022-11-01") + pd.to_timedelta(month_idx * 30, unit="D")
        df = pd.DataFrame({
            "dtc_event_id": id_series("DTC", ids, 9),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "month_start": month_start,
            "dtc_code": pick(["P0300", "P0420", "P0128", "U0100", "B101D", "C0561", "P0A80"], ids),
            "dtc_category": pick(["Powertrain", "Emissions", "Electrical", "Body", "Chassis", "Battery"], ids),
            "event_count": 1 + (ids % 5),
            "severity": pick(["Low", "Medium", "High"], ids),
            "resolved_flag": cfg.rng.random(len(ids)) < 0.76,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "dtc_events", append=start > 0)


# =========================
# Loyalty / campaigns
# =========================

def create_loyalty_accounts(cfg: Cfg) -> None:
    total = cfg.TARGETS["loyalty_accounts"]
    ids = np.arange(total, dtype=np.int64)
    lifetime = (1000 + ((ids * 149) % 240000)).astype(int)
    df = pd.DataFrame({
        "loyalty_account_id": id_series("LOY", ids, 8),
        "customer_id": customer_id_from_num(cfg, ids * 7),
        "program_name": "My GM Rewards",
        "tier": pick(["Bronze", "Silver", "Gold", "Platinum"], ids),
        "enrollment_date": between_dates("2018-01-01", "2025-11-01", ids, 27),
        "points_balance": (lifetime % 65000).astype(int),
        "lifetime_points": lifetime,
        "account_status": np.where(cfg.rng.random(total) < 0.95, "Active", "Inactive"),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "loyalty_accounts")


def create_loyalty_transactions(cfg: Cfg) -> None:
    total = cfg.TARGETS["loyalty_transactions"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        account_idx = ids % cfg.TARGETS["loyalty_accounts"]
        transaction_type = pick(["Earn", "Earn", "Earn", "Redeem", "Expire"], ids)
        points = (50 + ((ids * 13) % 8000)).astype(int)
        points = np.where(transaction_type == "Redeem", -points, points)
        source_category = pick(["Service", "Vehicle Purchase", "GM Card", "OnStar", "Parts", "Accessories"], ids)
        related = np.where(source_category == "Service", id_series("RO", ids % cfg.TARGETS["service_orders"], 9), id_series("SALE", ids % cfg.N_VEHICLES, 8))
        df = pd.DataFrame({
            "loyalty_transaction_id": id_series("LTX", ids, 10),
            "loyalty_account_id": id_series("LOY", account_idx, 8),
            "customer_id": customer_id_from_num(cfg, account_idx * 7),
            "transaction_date": between_dates("2022-11-01", "2025-11-01", ids, 17),
            "transaction_type": transaction_type,
            "source_category": source_category,
            "points": points,
            "monetary_value": np.round(np.abs(points) * 0.01, 2),
            "related_entity_id": related,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "loyalty_transactions", append=start > 0)


def create_gm_card_accounts(cfg: Cfg) -> None:
    total = cfg.TARGETS["gm_card_accounts"]
    ids = np.arange(total, dtype=np.int64)
    credit_limit = np.round(2500 + cfg.rng.random(total) * 27500, 2)
    current_balance = np.round(cfg.rng.random(total) * credit_limit * 0.72, 2)
    df = pd.DataFrame({
        "gm_card_account_id": id_series("GMCARD", ids, 7),
        "customer_id": customer_id_from_num(cfg, ids * 4),
        "open_date": between_dates("2018-01-01", "2025-11-01", ids, 43),
        "card_tier": pick(["My GM Rewards Card", "My GM Rewards Mastercard", "GM Business Card"], ids),
        "account_status": np.where(cfg.rng.random(total) < 0.90, "Active", "Closed"),
        "credit_limit": credit_limit,
        "current_balance": current_balance,
        "rewards_earned_ytd": 200 + ((ids * 97) % 35000),
    })
    df = add_audit(df, ids)
    write_df(cfg, df, "gm_card_accounts")


def create_campaign_interactions(cfg: Cfg) -> None:
    total = cfg.TARGETS["campaign_interactions"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        opened = cfg.rng.random(len(ids)) < 0.42
        clicked = opened & (cfg.rng.random(len(ids)) < 0.28)
        converted = clicked & (cfg.rng.random(len(ids)) < 0.11)
        conversion_value = np.round(np.where(converted, 25 + cfg.rng.random(len(ids)) * 1500, 0), 2)
        df = pd.DataFrame({
            "campaign_interaction_id": id_series("CIN", ids, 10),
            "campaign_id": id_series("CMP", ids % 150, 5),
            "customer_id": customer_id_from_num(cfg, ids * 11),
            "interaction_date": between_dates("2020-11-01", "2025-11-01", ids, 7),
            "channel": pick(["Email", "SMS", "Direct Mail", "In-App", "Paid Media"], ids),
            "interaction_type": pick(["Sent", "Open", "Click", "Conversion"], ids),
            "opened_flag": opened,
            "clicked_flag": clicked,
            "converted_flag": converted,
            "conversion_value": conversion_value,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "campaign_interactions", append=start > 0)


# =========================
# Digital / support / survey
# =========================

def create_mobile_app_sessions(cfg: Cfg) -> None:
    total = cfg.TARGETS["mobile_app_sessions"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 5) % cfg.N_VEHICLES
        month_idx = (ids % cfg.N_MONTHS).astype(int)
        month_start = pd.to_datetime("2022-11-01") + pd.to_timedelta(month_idx * 30, unit="D")
        df = pd.DataFrame({
            "app_session_id": id_series("APP", ids, 10),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "month_start": month_start,
            "app_name": pick(["myChevrolet", "myGMC", "myBuick", "myCadillac"], vehicle_num),
            "session_count": 1 + ((ids * 3) % 48),
            "remote_start_count": (ids % 22).astype(int),
            "lock_unlock_count": ((ids * 2) % 30).astype(int),
            "vehicle_status_views": ((ids * 4) % 55).astype(int),
            "service_schedule_clicks": (ids % 5).astype(int),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "mobile_app_sessions", append=start > 0)


def create_website_sessions(cfg: Cfg) -> None:
    total = cfg.TARGETS["website_sessions"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        month_idx = (ids % 60).astype(int)
        month_start = pd.to_datetime("2020-11-01") + pd.to_timedelta(month_idx * 30, unit="D")
        ev_views = np.where(cfg.rng.random(len(ids)) < 0.22, ids % 12, 0).astype(int)
        builds = np.where(cfg.rng.random(len(ids)) < 0.13, ids % 4, 0).astype(int)
        leads = np.where(cfg.rng.random(len(ids)) < 0.04, 1, 0).astype(int)
        df = pd.DataFrame({
            "website_session_id": id_series("WEB", ids, 10),
            "customer_id": customer_id_from_num(cfg, ids * 23),
            "month_start": month_start,
            "site_brand": pick(["Chevrolet", "GMC", "Buick", "Cadillac", "GM"], ids),
            "session_count": 1 + ((ids * 5) % 24),
            "ev_page_views": ev_views,
            "service_page_views": ((ids * 2) % 10).astype(int),
            "offer_page_views": ((ids * 3) % 9).astype(int),
            "build_price_starts": builds,
            "lead_submit_count": leads,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "website_sessions", append=start > 0)


def create_support_cases(cfg: Cfg) -> None:
    total = cfg.TARGETS["support_cases"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 31) % cfg.N_VEHICLES
        open_date = between_dates("2022-11-01", "2025-11-01", ids, 31)
        closed = cfg.rng.random(len(ids)) < 0.89
        close_date = open_date + pd.to_timedelta(ids % 18, unit="D")
        close_date = close_date.where(closed, pd.NaT)
        df = pd.DataFrame({
            "support_case_id": id_series("CASE", ids, 8),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "case_open_date": open_date,
            "case_close_date": close_date,
            "channel": pick(["Phone", "Chat", "Email", "Dealer Escalation", "Social"], ids),
            "case_category": pick(["OnStar", "Warranty", "Service", "Connected App", "Recall", "Billing", "Vehicle Quality"], ids),
            "priority": pick(["Low", "Medium", "High", "Critical"], ids),
            "status": np.where(pd.isna(close_date), "Open", "Closed"),
            "resolution_code": pick(["Resolved", "Dealer Follow-Up", "Goodwill", "Information Provided", "Escalated"], ids),
            "sentiment_score": np.round(cfg.rng.random(len(ids)) * 2 - 1, 3),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "support_cases", append=start > 0)


def create_nps_surveys(cfg: Cfg) -> None:
    total = cfg.TARGETS["nps_surveys"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        vehicle_num = (ids * 37) % cfg.N_VEHICLES
        df = pd.DataFrame({
            "nps_survey_id": id_series("NPS", ids, 9),
            "customer_id": customer_id_from_num(cfg, vehicle_num * 17),
            "vehicle_id": vehicle_id_from_num(cfg, vehicle_num),
            "dealer_id": dealer_id_from_num(cfg, vehicle_num * 7),
            "survey_date": between_dates("2022-11-01", "2025-11-01", ids, 19),
            "survey_context": pick(["Sales", "Service", "OnStar", "Support", "Recall"], ids),
            "nps_score": ((ids * 7) % 11).astype(int),
            "csat_score": (1 + ((ids * 3) % 5)).astype(int),
            "verbatim_theme": pick(["Advisor helpful", "Long wait", "Easy app", "Parts delay", "Great vehicle", "Billing confusion"], ids),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "nps_surveys", append=start > 0)


def create_customer_identity_graph(cfg: Cfg) -> None:
    total = cfg.TARGETS["customer_identity_graph"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        source_system = pick(["CRM", "Dealer DMS", "OnStar", "My GM Rewards", "GM Financial", "Marketing Cloud", "Support Center"], ids)
        source_key = pd.Series(source_system) + "-" + pd.Series([hex(abs(hash(int(i))))[2:].upper().zfill(12)[:12] for i in ids])
        df = pd.DataFrame({
            "identity_id": id_series("IDG", ids, 9),
            "customer_id": customer_id_from_num(cfg, ids),
            "source_system": source_system,
            "source_customer_key": source_key,
            "identity_type": pick(["Email Hash", "Phone Hash", "Loyalty ID", "DMS Customer ID", "OnStar Account ID", "Finance Account ID"], ids),
            "confidence_score": np.round(0.78 + cfg.rng.random(len(ids)) * 0.22, 4),
            "first_seen_at": between_dates("2018-01-01", "2025-01-01", ids, 23),
            "last_seen_at": between_dates("2024-01-01", "2025-11-01", ids, 11),
            "is_active": cfg.rng.random(len(ids)) < 0.96,
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "customer_identity_graph", append=start > 0)


def create_customer_segment_membership(cfg: Cfg) -> None:
    total = cfg.TARGETS["customer_segment_membership"]
    for start, ids in iter_chunks(total, cfg.CHUNK):
        df = pd.DataFrame({
            "segment_membership_id": id_series("CSM", ids, 9),
            "segment_id": id_series("SEG", 1 + (ids % 20), 3),
            "customer_id": customer_id_from_num(cfg, ids * 19),
            "assigned_date": between_dates("2023-01-01", "2025-11-01", ids, 11),
            "score": np.round(cfg.rng.random(len(ids)), 4),
            "is_active": cfg.rng.random(len(ids)) < 0.83,
            "source_model": pick(["rules_v1", "propensity_xgb", "churn_gbt", "nps_model", "dealer_batch"], ids),
        })
        df = add_audit(df, ids)
        write_df(cfg, df, "customer_segment_membership", append=start > 0)


# =========================
# Main
# =========================

def summarize_counts(cfg: Cfg) -> pd.DataFrame:
    table_names = [
        "households", "customers", "customer_addresses", "customer_contacts", "customer_consents",
        "dealers", "dealer_staff", "vehicle_models", "vehicles", "vehicle_ownership",
        "sales_transactions", "financing_contracts", "trade_ins", "service_appointments",
        "service_orders", "service_line_items", "recalls", "recall_responses", "warranty_plans",
        "warranty_claims", "insurance_policies", "insurance_claims",
        "connected_services_subscriptions", "telematics_monthly_summary", "vehicle_health_reports", "dtc_events",
        "loyalty_accounts", "loyalty_transactions", "gm_card_accounts", "marketing_campaigns", "campaign_interactions",
        "mobile_app_sessions", "website_sessions", "support_cases", "nps_surveys",
        "customer_identity_graph", "customer_segments", "customer_segment_membership"
    ]
    rows = []
    for name in table_names:
        path = cfg.OUTPUT_PATH / f"{name}.csv"
        if path.exists():
            # count lines without fully loading large CSVs
            with open(path, "r", encoding="utf-8") as f:
                line_count = max(sum(1 for _ in f) - 1, 0)
            rows.append((name, line_count))
    count_df = pd.DataFrame(rows, columns=["table_name", "row_count"]).sort_values("table_name")
    write_df(cfg, count_df, "_table_counts")
    return count_df


def main() -> None:
    args = parse_args()
    cfg = Cfg(args.output, args.customers, args.seed, args.chunk_size)

    print("=" * 80)
    print("GM Post-Sales CDP synthetic data generator (Pandas / CSV)")
    print(f"Output path    : {cfg.OUTPUT_PATH.resolve()}")
    print(f"Customers      : {cfg.N_CUSTOMERS}")
    print(f"Vehicles       : {cfg.N_VEHICLES}")
    print(f"Chunk size     : {cfg.CHUNK}")
    print("=" * 80)

    geo = build_geo()
    vehicle_models_tmp, ev_model_nums, ice_model_nums = build_vehicle_models()
    model_specs_names = [
        "Silverado", "Equinox", "Tahoe", "Suburban", "Malibu", "Trailblazer", "Bolt EV", "Bolt EUV",
        "Sierra", "Yukon", "Canyon", "Acadia", "Terrain", "Hummer EV", "Enclave", "Encore GX",
        "Envista", "Escalade", "XT4", "XT5", "XT6", "CT4", "CT5", "LYRIQ"
    ]

    create_vehicle_models(cfg)
    create_dealers(cfg, geo)
    create_dealer_staff(cfg)
    create_warranty_plans(cfg)
    create_recalls(cfg, model_specs_names)
    create_marketing_campaigns(cfg)
    create_customer_segments(cfg)
    create_households(cfg, geo)
    create_customers(cfg, geo)
    create_customer_addresses(cfg, geo)
    create_customer_contacts(cfg)
    create_customer_consents(cfg)
    vehicles = create_vehicles(cfg, vehicle_models_tmp, ev_model_nums, ice_model_nums)
    create_sales_transactions(cfg, vehicles, vehicle_models_tmp)
    create_vehicle_ownership(cfg)
    create_trade_ins(cfg)
    create_financing_contracts(cfg)
    create_service_appointments(cfg)
    create_service_orders(cfg)
    create_service_line_items(cfg)
    create_recall_responses(cfg)
    create_warranty_claims(cfg)
    create_insurance_policies(cfg)
    create_insurance_claims(cfg)
    create_connected_services_subscriptions(cfg)
    create_telematics_monthly_summary(cfg)
    create_vehicle_health_reports(cfg)
    create_dtc_events(cfg)
    create_loyalty_accounts(cfg)
    create_loyalty_transactions(cfg)
    create_gm_card_accounts(cfg)
    create_campaign_interactions(cfg)
    create_mobile_app_sessions(cfg)
    create_website_sessions(cfg)
    create_support_cases(cfg)
    create_nps_surveys(cfg)
    create_customer_identity_graph(cfg)
    create_customer_segment_membership(cfg)
    counts = summarize_counts(cfg)
    print("\nGeneration complete. Table counts:")
    print(counts.to_string(index=False))

    #----------------------------------
    import shutil

    source_dir = Path("./gm_cdp_csv")
    destination_dir = Path("./generated_data/automotive")
    destination_dir.mkdir(parents=True, exist_ok=True)

    files = [
        'aut_campaign_eligibility.csv',
        'aut_campaign_interactions.csv',
        'aut_campaign_validation_report.csv',
        'aut_connected_services_subscriptions.csv',
        'aut_customers.csv',
        'aut_customer_addresses.csv',
        'aut_customer_contacts.csv',
        'aut_dealers.csv',
        'aut_dealer_staff.csv',
        'aut_dtc_events.csv',
        'aut_households.csv',
        'aut_insurance_claims.csv',
        'aut_insurance_policies.csv',
        'aut_loyalty_accounts.csv',
        'aut_loyalty_transactions.csv',
        'aut_mobile_app_sessions.csv',
        'aut_nps_surveys.csv',
        'aut_recalls.csv',
        'aut_recall_responses.csv',
        'aut_sales_transactions.csv',
        'aut_service_appointments.csv',
        'aut_service_line_items.csv',
        'aut_service_orders.csv',
        'aut_support_cases.csv',
        'aut_telematics_monthly_summary.csv',
        'aut_trade_ins.csv',
        'aut_vehicles.csv',
        'aut_vehicle_health_reports.csv',
        'aut_vehicle_models.csv',
        'aut_vehicle_ownership.csv',
        'aut_warranty_claims.csv',
        'aut_website_sessions.csv',
    ]

    for dest_file in files:
        src_file = dest_file.replace("aut_", "", 1)
        src_path = source_dir / src_file
        dest_path = destination_dir / dest_file
        if src_path.exists():
            shutil.copy2(src_path, dest_path)
            print(f"Copied: {src_file} -> {dest_file}")
        else:
            print(f"Missing: {src_path}")


if __name__ == "__main__":
    main()
