const API = '/api';
const inFlightGetRequests = new Map();

async function executeFetchJson(url, retries, options) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!res.ok) {
        let details = null;
        try {
          details = await res.json();
        } catch {
          details = null;
        }
        const error = new Error(details?.error || details?.message || `API error: ${res.status}`);
        error.status = res.status;
        throw error;
      }
      return res.json();
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      const dependencyUnavailable = err?.status === 503;
      const clientError = err?.status >= 400 && err?.status < 500;
      if (attempt < retries && !dependencyUnavailable && !clientError) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }
}

function fetchJson(url, retries = 3, options = undefined) {
  // Coalesce only identical, option-free GETs while they are in progress.
  // There is deliberately no response cache: callers still receive fresh data
  // after writes, and requests carrying AbortSignals remain independently
  // cancellable.
  if (options !== undefined) {
    return executeFetchJson(url, retries, options);
  }

  const key = `${retries}:${url}`;
  const pending = inFlightGetRequests.get(key);
  if (pending) return pending;

  const requestPromise = executeFetchJson(url, retries, options).finally(() => {
    if (inFlightGetRequests.get(key) === requestPromise) {
      inFlightGetRequests.delete(key);
    }
  });
  inFlightGetRequests.set(key, requestPromise);
  return requestPromise;
}

async function putJson(url, data) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  const opts = { method: 'POST' };
  if (body) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(url, opts);
  if (!res.ok) {
    let details = null;
    try {
      details = await res.json();
    } catch {
      details = null;
    }
    throw new Error(details?.error || details?.message || `API error: ${res.status}`);
  }
  return res.json();
}

async function deleteJson(url) {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

function sourceUrl(name) {
  return String(name || '').split('/').map(encodeURIComponent).join('/');
}

export const api = {
  // Pipeline
  getSteps: () => fetchJson(`${API}/pipeline/steps`, 0),
  runStep: (id, sourceSystem) =>
    postJson(`${API}/pipeline/run/${id}`, sourceSystem ? { source_system: sourceSystem } : undefined),
  runAll: (sourceSystem) =>
    postJson(`${API}/pipeline/run-all`, sourceSystem ? { source_system: sourceSystem } : undefined),
  getPipelineRunStatus: (runId) =>
    fetchJson(`${API}/pipeline/runs/${encodeURIComponent(runId)}`, 0),

  // Sources
  getSources: (sourceSystem, options) =>
    fetchJson(
      `${API}/sources${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`,
      3,
      options,
    ),
  getSourcePreview: (name, limit = 100) => fetchJson(`${API}/sources/${sourceUrl(name)}/preview?limit=${limit}`),
  getSourceRandom: (name, limit = 50) => fetchJson(`${API}/sources/${sourceUrl(name)}/random?limit=${limit}`),
  getSourceCompleteness: (name) => fetchJson(`${API}/sources/${sourceUrl(name)}/completeness`),
  uploadSource: async (file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API}/sources/upload`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Upload error: ${res.status}`);
    return res.json();
  },
  databricksTestConnection: (body) => postJson(`${API}/connectors/databricks/test`, body),
  databricksCatalogs: (body) => postJson(`${API}/connectors/databricks/catalogs`, body),
  databricksSchemas: (body) => postJson(`${API}/connectors/databricks/schemas`, body),
  databricksTables: (body) => postJson(`${API}/connectors/databricks/tables`, body),
  databricksPreview: (body) => postJson(`${API}/connectors/databricks/preview`, body),
  databricksIngest: (body) => postJson(`${API}/connectors/databricks/ingest`, body),
  connectorTest: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/test`, body),
  connectorSchemas: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/schemas`, body),
  connectorTables: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/tables`, body),
  connectorEndpoints: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/endpoints`, body),
  connectorObjects: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/objects`, body),
  connectorPreview: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/preview`, body),
  connectorIngest: (connectorId, body) => postJson(`${API}/connectors/${connectorId}/ingest`, body),
  autoTagSource: (name, threshold = 0.35) =>
    postJson(`${API}/sources/${sourceUrl(name)}/auto-tag?threshold=${threshold}`),
  deleteSource: (name) => deleteJson(`${API}/sources/${sourceUrl(name)}/delete`),

  // Preprocessed / Standardized
  getPreprocessedPreview: (limit = 100) => fetchJson(`${API}/preprocessed/preview?limit=${limit}`),
  getStandardizedPreview: (limit = 100) => fetchJson(`${API}/standardized/preview?limit=${limit}`),
  getStandardizedSources: () => fetchJson(`${API}/standardized/sources`),
  getStandardizationSummary: (sourceSystem) =>
    fetchJson(`${API}/standardization/summary${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`),
  getStandardizationReportMetrics: (sourceSystem, options = undefined) =>
    fetchJson(
      `${API}/standardization/report-metrics${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`,
      0,
      options,
    ),
  getDataQualityReport: (sourceSystem, options = undefined) =>
    fetchJson(
      `${API}/standardization/report-metrics${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`,
      0,
      options,
    ),
  getDataQualityRecords: (
    sourceSystem,
    {
      category = 'affected', issueType = '', sourceTable = '', offset = 0, limit = 50,
      representative = false,
    } = {},
    options = undefined,
  ) => {
    const params = new URLSearchParams({
      source: sourceSystem || '',
      category,
      offset: String(offset),
      limit: String(limit),
    });
    if (issueType) params.set('issue_type', issueType);
    if (sourceTable) params.set('source_table', sourceTable);
    if (representative) params.set('selection', 'representative');
    return fetchJson(
      `${API}/standardization/quality-records?${params.toString()}`,
      0,
      options,
    );
  },

  // Blocking config
  getBlockingConfig: () => fetchJson(`${API}/blocking-config`),
  updateBlockingConfig: (data) => putJson(`${API}/blocking-config`, data),
  getEnhancedIdentityConfig: (sourceSystem = 'media') =>
    fetchJson(`${API}/enhanced-identity/config?source=${encodeURIComponent(sourceSystem)}`),
  updateEnhancedIdentityConfig: (data, sourceSystem = 'media') =>
    putJson(`${API}/enhanced-identity/config?source=${encodeURIComponent(sourceSystem)}`, data),
  runEnhancedIdentityPipeline: (sourceSystem = 'media') =>
    postJson(`${API}/enhanced-identity/run`, { source_system: sourceSystem }),
  getEnhancedIdentityRunStatus: (runId) =>
    fetchJson(`${API}/enhanced-identity/run/${encodeURIComponent(runId)}`, 0),

  // Tag mappings
  getTagMappings: (options) => fetchJson(`${API}/tag-mappings`, 3, options),
  updateTagMappings: (data) => putJson(`${API}/tag-mappings`, data),
  getTagVocabulary: () => fetchJson(`${API}/tag-vocabulary`),

  // Source preferences (preferred data source per tag)
  getSourcePreferences: () => fetchJson(`${API}/source-preferences`),
  updateSourcePreferences: (data) => putJson(`${API}/source-preferences`, data),
  getCanonicalTagsSources: () => fetchJson(`${API}/canonical-tags-sources`),

  // Evaluation
  getEvaluation: () => fetchJson(`${API}/evaluation`),

  // Summary
  getSummary: () => fetchJson(`${API}/summary`),

  // Golden records
  getGoldenRecords: (page = 1, limit = 50, search = '', sourceSystem = '') =>
    fetchJson(`${API}/golden-records?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}${sourceSystem ? `&source=${encodeURIComponent(sourceSystem)}` : ''}`),
  getSuperseded: (goldenId, sourceSystem = '') =>
    fetchJson(`${API}/golden-records/${goldenId}/superseded${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`),
  getProvenance: (goldenId, sourceSystem = '') =>
    fetchJson(`${API}/golden-records/${goldenId}/provenance${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`),

  // Match deep dive
  getMatchSources: () => fetchJson(`${API}/match/sources`),
  getMatchPairs: (source1, source2, matchType, page = 1, limit = 50) =>
    fetchJson(`${API}/match/pairs?source1=${source1}&source2=${source2}&match_type=${matchType}&page=${page}&limit=${limit}`),
  getMatchPairDetail: (rid1, rid2) =>
    fetchJson(`${API}/match/pair-detail?record_id_1=${rid1}&record_id_2=${rid2}`),

  // Record trace
  traceRecord: (recordId) => fetchJson(`${API}/trace/${recordId}`),

  // ID Graph
  getGraph: (clusterId) => fetchJson(`${API}/graph/${clusterId}`),
  getClusters: (page = 1, limit = 50, minSize = 2, search = '') =>
    fetchJson(`${API}/clusters?page=${page}&limit=${limit}&min_size=${minSize}&search=${encodeURIComponent(search)}`),
};
