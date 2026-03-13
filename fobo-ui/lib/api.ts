const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ReconRecord {
  id: number;
  msbk_bus_dtl_id: number;
  bus_date: string;
  msbk_id: number;
  rec_id: number;
  rec_subcategory_id: number;
  status: string;
  expn: number;
  expncount: number;
  start_time: string;
  end_time: string | null;
  service_name: string;
  is_holiday: string;
  regn_id: string;
  in_motif: string;
  business_area_name: string;
  hierarchy_level: string;
  hierarchy_level7: string;
  last_update: string;
  last_updated_by: string;
}

export interface ReconSummary {
  total: number;
  by_status: Record<string, number>;
  by_region: Record<string, number>;
  by_business_area: Record<string, number>;
  by_hierarchy: Record<string, number>;
  by_service: Record<string, number>;
}

export interface CrosstabResult {
  labels: string[];
  split_keys: string[];
  series: Record<string, number[]>;
}

export interface TitanRecord {
  run_inst_dtl_id: number;
  business_date: string;
  rec_id: number;
  master_book_id: number;
  start_date_time: string;
  end_date_time: string | null;
  status: string;
  log_description: string;
  created_by: string;
  created_date: string;
  updated_by: string;
  updated_date: string;
}

export interface FilterParams {
  bus_date: string;
  status?: string;
  region?: string;
  business_area?: string;
  hierarchy?: string;
  service?: string;
  is_holiday?: string;
  in_motif?: string;
}

function buildQS(params: FilterParams): URLSearchParams {
  const qs = new URLSearchParams();
  qs.set("bus_date", params.bus_date);
  if (params.status) qs.set("status", params.status);
  if (params.region) qs.set("region", params.region);
  if (params.business_area) qs.set("business_area", params.business_area);
  if (params.hierarchy) qs.set("hierarchy", params.hierarchy);
  if (params.service) qs.set("service", params.service);
  if (params.is_holiday) qs.set("is_holiday", params.is_holiday);
  if (params.in_motif) qs.set("in_motif", params.in_motif);
  return qs;
}

export async function fetchRecon(params: FilterParams): Promise<ReconRecord[]> {
  const res = await fetch(`${API_BASE}/api/recon?${buildQS(params).toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchSummary(params: FilterParams): Promise<ReconSummary> {
  const res = await fetch(`${API_BASE}/api/recon/summary?${buildQS(params).toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchCrosstab(
  params: FilterParams & { group_by: string; split_by?: string }
): Promise<CrosstabResult> {
  const qs = buildQS(params);
  qs.set("group_by", params.group_by);
  if (params.split_by) qs.set("split_by", params.split_by);
  const res = await fetch(`${API_BASE}/api/recon/crosstab?${qs.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchReconById(id: number): Promise<ReconRecord> {
  const res = await fetch(`${API_BASE}/api/recon/${id}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchTitan(params: {
  bus_date: string;
  status?: string;
}): Promise<TitanRecord[]> {
  const qs = new URLSearchParams();
  qs.set("bus_date", params.bus_date);
  if (params.status) qs.set("status", params.status);
  const res = await fetch(`${API_BASE}/api/titan?${qs.toString()}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

export async function fetchHealth(): Promise<{ status: string; env: string }> {
  const res = await fetch(`${API_BASE}/health`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
