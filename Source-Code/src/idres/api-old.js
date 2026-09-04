const API = '/api';

async function fetchJson(url, retries = 3) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
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
  if (!res.ok) throw new Error(`API error: ${res.status}`);
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

  // Sources
  getSources: (sourceSystem) =>
    fetchJson(`${API}/sources${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`),
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
  autoTagSource: (name, threshold = 0.35) =>
    postJson(`${API}/sources/${sourceUrl(name)}/auto-tag?threshold=${threshold}`),
  deleteSource: (name) => deleteJson(`${API}/sources/${sourceUrl(name)}/delete`),

  // Preprocessed / Standardized
  getPreprocessedPreview: (limit = 100) => fetchJson(`${API}/preprocessed/preview?limit=${limit}`),
  getStandardizedPreview: (limit = 100) => fetchJson(`${API}/standardized/preview?limit=${limit}`),
  getStandardizedSources: () => fetchJson(`${API}/standardized/sources`),
  getStandardizationSummary: (sourceSystem) =>
    fetchJson(`${API}/standardization/summary${sourceSystem ? `?source=${encodeURIComponent(sourceSystem)}` : ''}`),

  // Blocking config
  getBlockingConfig: () => fetchJson(`${API}/blocking-config`),
  updateBlockingConfig: (data) => putJson(`${API}/blocking-config`, data),

  // Tag mappings
  getTagMappings: () => fetchJson(`${API}/tag-mappings`),
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
