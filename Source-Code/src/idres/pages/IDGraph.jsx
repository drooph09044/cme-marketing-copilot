import React, { useState, useEffect, useRef, useCallback } from 'react'

import * as d3 from 'd3'
import { api } from '../api'
import Pagination from '../components/Pagination'
import IDGraph_ReportingParent from './IDGraph_ReportingParent'
import IDGraph_ReportingChild from './IDGraph_ReportingChild'
import GoldenRecords from './GoldenRecords'
import { readSelectedSourceSystem, writeSelectedSourceSystem } from '../sourceSystem'

const SOURCE_COLORS_MAP = {
  media: {
    Billing: '#3b82f6',
    Streaming: '#8b5cf6',
    App: '#06b6d4',
    Support: '#f59e0b',
    Email: '#ec4899',
    // Unknown: '#64748b',
  },
  sports: {
    Ticketing: '#3b82f6',
    Streaming: '#8b5cf6',
    App: '#06b6d4',
    Orders: '#f59e0b',
    Loyalty: '#ec4899',
    Marketing: '#a855f7',
    Fantasy: '#14b8a6',
    'Fan Account': '#22c55e',
    // Unknown: '#64748b',
  },
  automotive: {
    CRM: '#3b82f6',
    Customer: '#3b82f6',
    Address: '#14b8a6',
    Household: '#94a3b8',
    Contacts: '#06b6d4',
    'Dealer Sales': '#f59e0b',
    Sales: '#f59e0b',
    Service: '#10b981',
    'Connected Vehicle': '#8b5cf6',
    'Connected Services': '#8b5cf6',
    Telematics: '#8b5cf6',
    Loyalty: '#ec4899',
    Insurance: '#14b8a6',
    App: '#22c55e',
    Web: '#64748b',
    NPS: '#f97316',
    Campaign: '#a855f7',
    Dealer: '#f59e0b',
    Vehicle: '#38bdf8',
    Warranty: '#f43f5e',
    Support: '#eab308',
    Survey: '#fb923c',
    Recall: '#a78bfa',
  },
}

const GRAPH_SOURCE_ALIASES = {
  media: [
    { label: 'Billing', terms: ['subscription billing', 'billing history', 'billing'] },
    { label: 'Streaming', terms: ['streaming activity', 'streaming events', 'streaming'] },
    { label: 'App', terms: ['mobile app events', 'app events', 'app'] },
    { label: 'Support', terms: ['customer support', 'support tickets', 'support'] },
    { label: 'Email', terms: ['email engagement', 'email events', 'email'] },
  ],
  sports: [
    { label: 'Fan Account', terms: ['fan accounts', 'fan account'] },
    { label: 'Ticketing', terms: ['ticket orders', 'ticketing', 'attendance'] },
    { label: 'Loyalty', terms: ['loyalty members', 'loyalty activity', 'loyalty'] },
    { label: 'App', terms: ['app events', 'app'] },
    { label: 'Orders', terms: ['commerce orders', 'sports orders', 'orders'] },
    { label: 'Streaming', terms: ['streaming sessions', 'streaming events', 'streaming', 'ott'] },
    { label: 'Marketing', terms: ['marketing campaign events', 'marketing', 'campaign'] },
    { label: 'Fantasy', terms: ['fantasy gaming accounts', 'fantasy'] },
  ],
}


const TIER_COLORS = {
  exact: '#22c55e',
  strong: '#0f766e',
  medium: '#e11d48',
  weak: '#94a3b8',
  household: '#14b8a6',
}

const TIER_WIDTH = {
  exact: 3,
  strong: 2.6,
  medium: 2.1,
  weak: 1.5,
  household: 1.4,
}

const MATCH_TYPE_FILTERS = ['all', 'exact', 'strong', 'medium', 'weak']

function edgeTier(edge = {}) {
  return edge.tier || edge.edge_type || edge.match_tier || 'weak'
}

function edgeTierColor(edge = {}) {
  return TIER_COLORS[edgeTier(edge)] || '#64748b'
}

function edgeLineDash(edge = {}) {
  const tier = edgeTier(edge)
  if (tier === 'medium') return '8,4'
  if (tier === 'weak') return '3,5'
  if (tier === 'household') return '10,4'
  return 'none'
}

const GRAPH_DATA_SOURCES = [
  { value: 'media', label: 'Media & OTT' },
  { value: 'sports', label: 'Sports' },
  { value: 'automotive', label: 'Automotive' },
]

const GRAPH_DATA_SOURCE_VALUES = GRAPH_DATA_SOURCES.map(source => source.value)
const GRAPH_DATA_SOURCE_LABELS = Object.fromEntries(
  GRAPH_DATA_SOURCES.map(source => [source.value, source.label])
)

const ID_GRAPH_FIELD_LABELS = {
  account_id: 'Account ID',
  address: 'Address',
  city: 'City',
  customer_id: 'Customer ID',
  date_of_birth: 'DOB',
  device_id: 'Device ID',
  email: 'Email',
  first_name: 'First Name',
  full_name: 'Full Name',
  ip_address: 'IP Address',
  last_name: 'Last Name',
  loyalty_id: 'Loyalty ID',
  name: 'Name',
  phone: 'Phone',
  state: 'State',
  probabilistic: 'Probabilistic Signal',
  zip: 'Zip',
}

function formatFieldLabel(field) {
  return ID_GRAPH_FIELD_LABELS[field] || String(field || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

const EDGE_FEATURE_PRIORITY = ['key_identifier', 'email', 'phone', 'name', 'dob', 'address', 'probabilistic']

const FIELD_HIGHLIGHT_COLORS = {
  email: 'rgba(34,197,94,0.14)',
  phone: 'rgba(59,130,246,0.14)',
  name: 'rgba(139,92,246,0.14)',
  address: 'rgba(245,158,11,0.14)',
  probabilistic: 'rgba(100,116,139,0.14)',
}

function probabilisticSignalLabel(edge = {}) {
  const techniques = String(edge.matching_techniques || '').toLowerCase()
  const matchedFields = String(edge.matched_fields || '').toLowerCase()
  if (techniques.includes('same device') || matchedFields.includes('device_id')) {
    return 'Probabilistic Signal (Device ID)'
  }
  if (techniques.includes('same ip') || matchedFields.includes('ip_address')) {
    return 'Probabilistic Signal (IP Address)'
  }
  return 'Probabilistic Signal'
}

function getEdgeFeatureEvidence(edge = {}) {
  const nonFeatureConfidenceFields = new Set([
    'final_confidence',
    'raw_confidence',
    'available_person_confidence',
  ])
  const discoveredFeatures = Object.keys(edge)
    .filter(key => key.endsWith('_confidence') && !nonFeatureConfidenceFields.has(key))
    .map(key => key.replace(/_confidence$/, ''))
    .filter(feature =>
      EDGE_FEATURE_PRIORITY.includes(feature) ||
      Object.prototype.hasOwnProperty.call(edge, `${feature}_weight`) ||
      Object.prototype.hasOwnProperty.call(edge, `${feature}_contribution`)
    )
  const orderedFeatures = [
    ...EDGE_FEATURE_PRIORITY,
    ...discoveredFeatures.filter(feature => !EDGE_FEATURE_PRIORITY.includes(feature)),
  ].filter((feature, index, all) => all.indexOf(feature) === index)

  return orderedFeatures.map(feature => {
    const confidence = Number(edge[`${feature}_confidence`])
    const weight = Number(edge[`${feature}_weight`])
    const contribution = Number(edge[`${feature}_contribution`])
    if (![confidence, weight, contribution].some(Number.isFinite)) return null
    if (!confidence && !weight && !contribution) return null
    return {
      feature,
      label: feature === 'probabilistic' ? probabilisticSignalLabel(edge) : formatFieldLabel(feature),
      confidence: Number.isFinite(confidence) ? confidence : 0,
      weight: Number.isFinite(weight) ? weight : 0,
      contribution: Number.isFinite(contribution) ? contribution : 0,
    }
  }).filter(Boolean)
}

function formatEvidenceNumber(value, digits = 1) {
  const number = Number(value)
  if (!Number.isFinite(number)) return '-'
  return Number.isInteger(number) ? String(number) : number.toFixed(digits)
}

function formatMatchingTechniques(value = '') {
  const simplifyTechnique = (feature, technique) => {
    const lower = technique.toLowerCase()
    if (feature === 'email') {
      if (lower.includes('raw email exact')) return 'Exact'
      if (lower.includes('standardized email exact')) return 'Standardized Exact'
      if (lower.includes('provider mismatch')) return 'Provider Mismatch'
      return technique
    }
    if (feature === 'phone') {
      if (lower.includes('phone exact')) return 'Exact'
      return technique
    }
    if (feature === 'name') {
      if (lower.includes('exact first') || lower.includes('first name + last name')) return 'Exact First + Last'
      const parts = []
      if (lower.includes('initials')) parts.push('Initials')
      if (lower.includes('first 3')) parts.push('First 3 Characters')
      if (lower.includes('first initial')) parts.push('First Initial + Last')
      if (lower.includes('full first')) parts.push('First Name + Last Initial')
      if (lower.includes('soundex')) parts.push('Soundex')
      if (lower.includes('jaro')) parts.push('Jaro-Winkler')
      if (lower.includes('similarity') && !parts.includes('Jaro-Winkler')) parts.push('Similarity')
      if (parts.length) return parts.join(' + ')
      return technique
    }
    if (feature === 'address') {
      if (lower.includes('zip + house number + street')) return 'ZIP + Street'
      if (lower.includes('similar address')) return 'Similar Address'
      return technique
    }
    if (feature === 'probabilistic') {
      if (lower.includes('device')) return 'Device ID'
      if (lower.includes('ip')) return 'IP Address'
      return technique
    }
    if (feature === 'key_identifier') return 'Exact'
    return technique
  }

  const seen = new Set()
  return String(value || '')
    .split('|')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      const [feature, ...rest] = item.split(':')
      const technique = rest.join(':').trim()
      if (!technique) return formatFieldLabel(item)
      const cleanFeature = feature.trim()
      return `${formatFieldLabel(cleanFeature)}: ${simplifyTechnique(cleanFeature, technique)}`
    })
    .filter(item => {
      const key = item.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function edgeNodeId(value) {
  return typeof value === 'object' ? value?.id : value
}

function edgeKey(edge = {}) {
  const source = edgeNodeId(edge.source)
  const target = edgeNodeId(edge.target)
  if (!source || !target) return ''
  return source < target ? `${source}__${target}` : `${target}__${source}`
}

function edgeFeatureSet(edge = {}) {
  const fields = new Set()
  String(edge.matched_fields || '')
    .split(String(edge.matched_fields || '').includes('|') ? '|' : '+')
    .map(field => field.trim().toLowerCase())
    .filter(Boolean)
    .forEach(field => fields.add(field))

  getEdgeFeatureEvidence(edge)
    .filter(row => row.confidence > 0 || row.contribution > 0)
    .forEach(row => fields.add(row.feature))

  return fields
}

function edgeEvidenceStrength(edge = {}) {
  const tierRank = { exact: 4, strong: 3, medium: 2, weak: 1, household: 0 }
  const featureCount = edgeFeatureSet(edge).size
  return (tierRank[edgeTier(edge)] || 0) * 10000 + Number(edge.score || edge.final_confidence || 0) * 100 + featureCount
}

function readableGraphEdges(allEdges = [], nodes = [], maxEdges = 80) {
  if (!Array.isArray(allEdges) || allEdges.length <= maxEdges) return allEdges

  const nodeIds = new Set((nodes || []).map(node => node.id).filter(Boolean))
  const sortedEdges = [...allEdges].sort((a, b) => edgeEvidenceStrength(b) - edgeEvidenceStrength(a))
  const selected = []
  const selectedKeys = new Set()
  const coveredNodeIds = new Set()

  const addEdge = edge => {
    const source = edgeNodeId(edge.source)
    const target = edgeNodeId(edge.target)
    if (!source || !target) return false
    const key = edgeKey(edge)
    if (selectedKeys.has(key)) return false
    selectedKeys.add(key)
    selected.push(edge)
    coveredNodeIds.add(source)
    coveredNodeIds.add(target)
    return true
  }

  ;['exact', 'strong', 'medium', 'weak'].forEach(tier => {
    sortedEdges
      .filter(edge => edgeTier(edge) === tier)
      .slice(0, tier === 'exact' ? 18 : 14)
      .forEach(edge => {
        if (selected.length < maxEdges) addEdge(edge)
      })
  })

  sortedEdges.forEach(edge => {
    if (selected.length >= maxEdges || coveredNodeIds.size >= nodeIds.size) return
    const source = edgeNodeId(edge.source)
    const target = edgeNodeId(edge.target)
    if (!coveredNodeIds.has(source) || !coveredNodeIds.has(target)) {
      addEdge(edge)
    }
  })

  sortedEdges.forEach(edge => {
    if (selected.length < maxEdges) addEdge(edge)
  })

  return selected
}

function resolveAutomotiveVehicleId(node = {}) {
  const normalizeVehicleId = value => String(value || '').trim().replace(/^VEH(?=\d{8}\b)/i, 'VIN')
  const candidates = [node.vehicle_id, node.device_id]
  for (const candidate of candidates) {
    if (candidate == null) continue
    const parts = String(candidate)
      .split(/[,|;/]+/)
      .map(value => value.trim())
      .filter(Boolean)
    for (const part of parts) {
      if (/^(VIN|VEH)(\b|[-_A-Z0-9])/i.test(part)) {
        return normalizeVehicleId(part)
      }
    }
    const raw = String(candidate).trim()
    if (/^(VIN|VEH)(\b|[-_A-Z0-9])/i.test(raw)) {
      return normalizeVehicleId(raw)
    }
  }
  return ''
}

const LEGACY_PRIMARY_TAG_DEFAULTS = {
  email: {
    tags: {
      email: { comparison_method: 'exact', match_threshold: 1.0, weight: 52 },
      phone: { comparison_method: 'exact', match_threshold: 1.0, weight: 28 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 12 },
      last_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 13 },
      address: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
      zip: { comparison_method: 'exact', match_threshold: 1.0, weight: 5 },
      device_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 18 },
      ip_address: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
    },
    rules: [
      { name: 'Email Match', chain: [{ tag: 'email', char_count: null }], enabled: true },
      { name: 'Phone Match', chain: [{ tag: 'phone', char_count: null }], enabled: true },
      {
        name: 'Name + Zip',
        chain: [
          { tag: 'first_name', char_count: 3 },
          { tag: 'last_name', char_count: 4 },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Address + Zip',
        chain: [
          { tag: 'address', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      { name: 'Device ID', chain: [{ tag: 'device_id', char_count: null }], enabled: true },
      { name: 'IP Address', chain: [{ tag: 'ip_address', char_count: null }], enabled: true },
    ],
  },
  phone: {
    tags: {
      phone: { comparison_method: 'exact', match_threshold: 1.0, weight: 50 },
      email: { comparison_method: 'exact', match_threshold: 1.0, weight: 30 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 12 },
      last_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 13 },
      address: { comparison_method: 'exact', match_threshold: 1.0, weight: 10 },
      zip: { comparison_method: 'exact', match_threshold: 1.0, weight: 5 },
      device_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 15 },
      ip_address: { comparison_method: 'exact', match_threshold: 1.0, weight: 6 },
    },
    rules: [
      { name: 'Phone Match', chain: [{ tag: 'phone', char_count: null }], enabled: true },
      { name: 'Email Match', chain: [{ tag: 'email', char_count: null }], enabled: true },
      {
        name: 'Name + Zip',
        chain: [
          { tag: 'first_name', char_count: 3 },
          { tag: 'last_name', char_count: 4 },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Address + Zip',
        chain: [
          { tag: 'address', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      { name: 'Device ID', chain: [{ tag: 'device_id', char_count: null }], enabled: true },
      { name: 'IP Address', chain: [{ tag: 'ip_address', char_count: null }], enabled: true },
    ],
  },
  device_id: {
    tags: {
      device_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 50 },
      email: { comparison_method: 'exact', match_threshold: 1.0, weight: 25 },
      phone: { comparison_method: 'exact', match_threshold: 1.0, weight: 20 },
      ip_address: { comparison_method: 'exact', match_threshold: 1.0, weight: 15 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 8 },
      last_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 8 },
      address: { comparison_method: 'exact', match_threshold: 1.0, weight: 5 },
      zip: { comparison_method: 'exact', match_threshold: 1.0, weight: 4 },
    },
    rules: [
      { name: 'Device ID', chain: [{ tag: 'device_id', char_count: null }], enabled: true },
      { name: 'Email Match', chain: [{ tag: 'email', char_count: null }], enabled: true },
      { name: 'Phone Match', chain: [{ tag: 'phone', char_count: null }], enabled: true },
      { name: 'IP Address', chain: [{ tag: 'ip_address', char_count: null }], enabled: true },
      {
        name: 'Name + Zip',
        chain: [
          { tag: 'first_name', char_count: 3 },
          { tag: 'last_name', char_count: 4 },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Address + Zip',
        chain: [
          { tag: 'address', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
    ],
  },
}

const LEGACY_AUTOMOTIVE_PRIMARY_TAG_DEFAULTS = {
  customer_id: {
    tags: {
      customer_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 100 },
      date_of_birth: { comparison_method: 'exact', match_threshold: 1.0, weight: 45 },
      vehicle_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 35 },
      email: { comparison_method: 'exact', match_threshold: 1.0, weight: 30 },
      phone: { comparison_method: 'exact', match_threshold: 1.0, weight: 25 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 10 },
      last_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 10 },
      address: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
      zip: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
      device_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
    },
    rules: [
      { name: 'Customer ID Match', chain: [{ tag: 'customer_id', char_count: null }], enabled: true },
      {
        name: 'Customer ID + Email + Phone',
        chain: [
          { tag: 'customer_id', char_count: null },
          { tag: 'email', char_count: null },
          { tag: 'phone', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Name + DOB + Zip',
        chain: [
          { tag: 'first_name', char_count: 3 },
          { tag: 'last_name', char_count: 4 },
          { tag: 'date_of_birth', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Vehicle + Customer',
        chain: [
          { tag: 'vehicle_id', char_count: null },
          { tag: 'customer_id', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Phone + Zip',
        chain: [
          { tag: 'phone', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Email + Phone',
        chain: [
          { tag: 'email', char_count: null },
          { tag: 'phone', char_count: null },
        ],
        enabled: true,
      },
    ],
  },
  phone: {
    tags: {
      customer_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 65 },
      phone: { comparison_method: 'exact', match_threshold: 1.0, weight: 55 },
      date_of_birth: { comparison_method: 'exact', match_threshold: 1.0, weight: 38 },
      vehicle_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 28 },
      email: { comparison_method: 'exact', match_threshold: 1.0, weight: 25 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 10 },
      last_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 10 },
      address: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
      zip: { comparison_method: 'exact', match_threshold: 1.0, weight: 10 },
      device_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
    },
    rules: [
      { name: 'Phone Match', chain: [{ tag: 'phone', char_count: null }], enabled: true },
      {
        name: 'Phone + Zip',
        chain: [
          { tag: 'phone', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Email + Phone',
        chain: [
          { tag: 'email', char_count: null },
          { tag: 'phone', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Customer ID + Email + Phone',
        chain: [
          { tag: 'customer_id', char_count: null },
          { tag: 'email', char_count: null },
          { tag: 'phone', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Name + DOB + Zip',
        chain: [
          { tag: 'first_name', char_count: 3 },
          { tag: 'last_name', char_count: 4 },
          { tag: 'date_of_birth', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      { name: 'Vehicle ID', chain: [{ tag: 'vehicle_id', char_count: null }], enabled: true },
    ],
  },
  email: {
    tags: {
      customer_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 65 },
      email: { comparison_method: 'exact', match_threshold: 1.0, weight: 55 },
      date_of_birth: { comparison_method: 'exact', match_threshold: 1.0, weight: 38 },
      vehicle_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 28 },
      phone: { comparison_method: 'exact', match_threshold: 1.0, weight: 25 },
      first_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 10 },
      last_name: { comparison_method: 'phonetic', match_threshold: 0.85, weight: 10 },
      address: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
      zip: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
      device_id: { comparison_method: 'exact', match_threshold: 1.0, weight: 8 },
    },
    rules: [
      { name: 'Email Match', chain: [{ tag: 'email', char_count: null }], enabled: true },
      {
        name: 'Email + Phone',
        chain: [
          { tag: 'email', char_count: null },
          { tag: 'phone', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Customer ID + Email + Phone',
        chain: [
          { tag: 'customer_id', char_count: null },
          { tag: 'email', char_count: null },
          { tag: 'phone', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Name + DOB + Zip',
        chain: [
          { tag: 'first_name', char_count: 3 },
          { tag: 'last_name', char_count: 4 },
          { tag: 'date_of_birth', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      {
        name: 'Phone + Zip',
        chain: [
          { tag: 'phone', char_count: null },
          { tag: 'zip', char_count: null },
        ],
        enabled: true,
      },
      { name: 'Vehicle ID', chain: [{ tag: 'vehicle_id', char_count: null }], enabled: true },
    ],
  },
}

function getPrimaryTagDefaults(source, tag) {
  if (source === 'media') return tag ? undefined : {}
  const defaults = source === 'automotive' ? LEGACY_AUTOMOTIVE_PRIMARY_TAG_DEFAULTS : LEGACY_PRIMARY_TAG_DEFAULTS
  return tag ? defaults[tag] : defaults
}

function graphSourceSystemForNode(node = {}, sourceSystem = '') {
  const requested = String(sourceSystem || '').trim().toLowerCase()
  if (SOURCE_COLORS_MAP[requested]) return requested

  const lineage = [
    node.id,
    node.source_record_id,
    node.source_file,
  ].join(' ').toLowerCase()
  if (/(^|\W)(spt|sports)[-_]/.test(lineage)) return 'sports'
  if (/(^|\W)(aut|auto|automotive)[-_]/.test(lineage)) return 'automotive'
  return 'media'
}

function rawSourceLabelForNode(node = {}) {
  const explicit = node.source_label || node.source
  if (explicit && explicit !== 'Unknown') return explicit

  const fileName = String(node.source_file || '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.csv$/i, '')
    .replace(/^(aut|auto|med|spt|tel)_/i, '')

  if (!fileName) return 'Unknown'
  return fileName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function sourceLabelForNode(node = {}, sourceSystem = '') {
  const rawLabel = rawSourceLabelForNode(node)
  const resolvedSource = graphSourceSystemForNode(node, sourceSystem)
  if (SOURCE_COLORS_MAP[resolvedSource]?.[rawLabel]) return rawLabel

  const searchText = `${rawLabel} ${node.source_file || ''}`
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  const alias = (GRAPH_SOURCE_ALIASES[resolvedSource] || []).find(entry =>
    entry.terms.some(term => searchText.includes(term))
  )
  return alias?.label || rawLabel
}

function displaySourceLabelForNode(node = {}, sourceSystem = '') {
  return sourceLabelForNode(node, sourceSystem)
}

function displayNameForNode(node = {}) {
  if (String(node.name_resolution || '').trim()) {
    return String(node.display_name || '').trim() || '—'
  }
  const explicitName = [
    node.display_name,
    node.resolved_name,
    node.name,
    node.full_name,
    node.customer_name,
    node.profile_name,
  ].find(value => String(value || '').trim())
  if (explicitName) return String(explicitName).trim()

  const combined = [node.first_name, node.last_name]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join(' ')
  return combined || '—'
}

function displayEmailForNode(node = {}) {
  const email = node.email || node.email_standardized || node.cleaned_email
  return String(email || '').trim() || '—'
}

function isDatasetScopedBlockingConfig(cfg) {
  return !!cfg && GRAPH_DATA_SOURCE_VALUES.some(source => cfg[source]?.blocking_rules || cfg[source]?.edge_tiers || cfg[source]?.tags)
}

function cloneBlockingConfig(cfg) {
  return cfg ? JSON.parse(JSON.stringify(cfg)) : null
}

function getBlockingConfigForSource(rawConfig, source) {
  if (!rawConfig) return null
  if (rawConfig[source]) return cloneBlockingConfig(rawConfig[source])
  if (isDatasetScopedBlockingConfig(rawConfig)) {
    const fallbackSource = GRAPH_DATA_SOURCE_VALUES.find(value => rawConfig[value])
    return fallbackSource ? cloneBlockingConfig(rawConfig[fallbackSource]) : null
  }
  return cloneBlockingConfig(rawConfig)
}

function mergeBlockingConfigForSource(rawConfig, source, sourceConfig) {
  if (isDatasetScopedBlockingConfig(rawConfig)) {
    return {
      ...rawConfig,
      [source]: cloneBlockingConfig(sourceConfig),
    }
  }
  return cloneBlockingConfig(sourceConfig)
}

const getInitialGraphSource = () => {
  const sourceSystem = readSelectedSourceSystem()
  return GRAPH_DATA_SOURCE_VALUES.includes(sourceSystem) ? sourceSystem : 'media'
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    ...options,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const message = data?.error || data?.message || `${response.status} ${response.statusText}`
    throw new Error(message)
  }

  return data
}



function normalizeSource(source) {
  return source
}



async function fetchClustersApi(page = 1, limit = 50, minSize = 2, search = '', source = 'media') {

  const params = new URLSearchParams({
    search: search || '',
    source,
    page: String(page),
    limit: String(limit),
    min_size: String(minSize),
    _: String(Date.now()),
  })

  return fetchJson(`/api/clusters?${params.toString()}`)
}

async function fetchGraphApi(clusterId, source = 'media') {
  const params = new URLSearchParams({ source, _: String(Date.now()) })
  return fetchJson(`/api/graph/${encodeURIComponent(clusterId)}?${params.toString()}`)
}

function CollapsibleSection({ title, defaultOpen = true, children, rightContent = null, cardStyle = {} }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="card mb-24" style={cardStyle}>
      <div
        className="card-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <button
          type="button"
          onClick={() => setOpen(prev => !prev)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
            color: 'inherit',
            fontFamily: 'inherit',
          }}
        >
          <span className="card-title">{title}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{open ? '▾' : '▸'}</span>
        </button>
        {rightContent}
      </div>
      {open && <div>{children}</div>}
    </div>
  )
}

function ConfigurationTab({ sourceSystem = 'media', onPipelineRunSuccess }) {
  const selectedSource = GRAPH_DATA_SOURCE_VALUES.includes(sourceSystem) ? sourceSystem : 'media'
  const selectedSourceLabel = GRAPH_DATA_SOURCE_LABELS[selectedSource] || selectedSource
  const [rawConfig, setRawConfig] = useState(null)
  const [config, setConfig] = useState(null)
  const [enhancedConfig, setEnhancedConfig] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [primaryTag, setPrimaryTag] = useState('')
  const [globalStrategy, setGlobalStrategy] = useState('preferred_source')
  const [sourcePrefs, setSourcePrefs] = useState({})
  const [canonicalTagsSources, setCanonicalTagsSources] = useState({})
  const [running, setRunning] = useState(false)
  const [steps, setSteps] = useState([])
  const [ran, setRan] = useState(false)
  const intervalRef = useRef(null)

  const PREF_TAGS = ['email', 'phone', 'address']

  const GLOBAL_STRATEGIES = [
    { value: 'preferred_source', label: 'Most Preferred Source' },
    { value: 'most_recent', label: 'Most Recent' },
    { value: 'most_frequent', label: 'Most Frequent' },
  ]

  const TIER_STYLES = {
    exact: { background: 'rgba(16,185,129,0.15)', color: '#10b981' },
    strong: { background: 'rgba(59,130,246,0.15)', color: '#3b82f6' },
    medium: { background: 'rgba(249,115,22,0.15)', color: '#f97316' },
    weak: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
  }

  const fetchSteps = useCallback(async () => {
    if (!api.getSteps) return
    try {
      const data = await api.getSteps()
      setSteps(data || [])
    } catch {
      // ignore polling errors
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setLoading(true)

    const loadLegacyConfiguration = stepDataFromEnhancedCheck => {
      Promise.all([
        api.getBlockingConfig(),
        api.getSourcePreferences?.().catch(() => ({})) ?? Promise.resolve({}),
        api.getCanonicalTagsSources?.().catch(() => ({})) ?? Promise.resolve({}),
        stepDataFromEnhancedCheck
          ? Promise.resolve(stepDataFromEnhancedCheck)
          : (api.getSteps?.().catch(() => []) ?? Promise.resolve([])),
      ])
        .then(([cfg, prefs, tagSources, stepData]) => {
          if (!mounted) return

          const scopedConfig = getBlockingConfigForSource(cfg, selectedSource)
          setRawConfig(cfg)
          setConfig(scopedConfig)
          setEnhancedConfig(null)
          setPrimaryTag(scopedConfig?.primary_tag || '')
          setSourcePrefs(prefs || {})
          setCanonicalTagsSources(tagSources || {})
          setSteps(stepData || [])

          const strategies = PREF_TAGS.map(tag => (prefs?.[tag] || {}).strategy).filter(Boolean)
          const allSame = strategies.length > 0 && strategies.every(s => s === strategies[0])

          if (allSame && (strategies[0] === 'most_recent' || strategies[0] === 'most_frequent')) {
            setGlobalStrategy(strategies[0])
          } else {
            setGlobalStrategy('preferred_source')
          }

          setLoading(false)
        })
        .catch(() => {
          if (mounted) setLoading(false)
        })
    }

    Promise.all([
      api.getEnhancedIdentityConfig
        ? api.getEnhancedIdentityConfig(selectedSource).catch(() => null)
        : Promise.resolve(null),
      api.getSteps?.().catch(() => []) ?? Promise.resolve([]),
    ])
      .then(([enhancedCfg, stepData]) => {
        if (!mounted) return

        if (enhancedCfg) {
          setRawConfig(null)
          setConfig(null)
          setEnhancedConfig(enhancedCfg)
          setPrimaryTag('')
          setSourcePrefs({})
          setCanonicalTagsSources({})
          setSteps(stepData || [])
          setGlobalStrategy('preferred_source')
          setLoading(false)
          return
        }

        loadLegacyConfiguration(stepData)
      })
      .catch(() => {
        loadLegacyConfiguration()
      })

    intervalRef.current = setInterval(fetchSteps, 3000)

    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [fetchSteps, selectedSource])

  const handlePrimaryTagChange = tag => {
    setPrimaryTag(tag)
    setConfig(prev => {
      const preset = getPrimaryTagDefaults(selectedSource, tag)
      if (!preset) {
        return {
          ...prev,
          primary_tag: tag,
        }
      }

      return {
        ...prev,
        primary_tag: tag,
        tags: cloneBlockingConfig(preset.tags),
        blocking_rules: cloneBlockingConfig(preset.rules),
      }
    })
    setSaved(false)
  }

  const toggleRule = idx => {
    setConfig(prev => {
      const rules = [...(prev?.blocking_rules || [])]
      rules[idx] = { ...rules[idx], enabled: !rules[idx].enabled }
      return { ...prev, blocking_rules: rules }
    })
    setSaved(false)
  }

  const updateTier = (tier, val) => {
    setConfig(prev => ({
      ...prev,
      edge_tiers: {
        ...(prev?.edge_tiers || {}),
        [tier]: {
          ...(prev?.edge_tiers?.[tier] || {}),
          min_score: parseInt(val, 10),
        },
      },
    }))
    setSaved(false)
  }

  const handleGlobalStrategyChange = strategy => {
    setGlobalStrategy(strategy)

    if (strategy !== 'preferred_source') {
      const updated = {}
      PREF_TAGS.forEach(tag => {
        updated[tag] = { source: '', strategy }
      })
      setSourcePrefs(updated)
    } else {
      setSourcePrefs(prev => {
        const updated = {}
        PREF_TAGS.forEach(tag => {
          const existing = prev[tag] || {}
          updated[tag] = {
            source: existing.source || '',
            strategy: 'preferred_source',
          }
        })
        return updated
      })
    }

    setSaved(false)
  }

  const handlePrefSourceChange = (tag, value) => {
    setSourcePrefs(prev => {
      const existing = prev[tag] || { source: '', strategy: 'preferred_source' }
      return {
        ...prev,
        [tag]: {
          ...existing,
          source: value,
        },
      }
    })
    setSaved(false)
  }

  const updateEnhancedWeight = (feature, value) => {
    const numericValue = Math.max(0, Math.min(100, Number(value) || 0))
    setEnhancedConfig(prev => ({
      ...prev,
      features: {
        ...(prev?.features || {}),
        [feature]: {
          ...(prev?.features?.[feature] || {}),
          weight: numericValue,
        },
      },
    }))
    setSaved(false)
  }

  const updateEnhancedMatchTier = (tier, value) => {
    const numericValue = Math.max(0, Math.min(100, Number(value) || 0))
    setEnhancedConfig(prev => ({
      ...prev,
      match_classification: {
        ...(prev?.match_classification || {}),
        edge_tiers: {
          ...(prev?.match_classification?.edge_tiers || {}),
          [tier]: {
            ...(prev?.match_classification?.edge_tiers?.[tier] || {}),
            min_score: numericValue,
          },
        },
      },
    }))
    setSaved(false)
  }

  const updateEnhancedProbabilistic = (key, value) => {
    setEnhancedConfig(prev => {
      const nextMethods = {
        ...(prev?.features?.probabilistic?.methods || {}),
        [key]: {
          ...(prev?.features?.probabilistic?.methods?.[key] || {}),
          enabled: value,
        },
      }
      const anyProbabilisticEnabled = Object.values(nextMethods).some(method => Boolean(method?.enabled))

      return {
        ...prev,
        features: {
          ...(prev?.features || {}),
          address: {
            ...(prev?.features?.address || {}),
            weight: anyProbabilisticEnabled ? 5 : 10,
          },
          probabilistic: {
            ...(prev?.features?.probabilistic || {}),
            weight: anyProbabilisticEnabled ? 5 : 0,
            methods: nextMethods,
          },
        },
      }
    })
    setSaved(false)
  }

  const applyEnhancedPrimaryTagPreset = tag => {
    setEnhancedConfig(prev => {
      const preset = prev?.primary_tag_presets?.[tag]
      const nextConfig = {
        ...prev,
        identity_matching: {
          ...(prev?.identity_matching || {}),
          primary_tag: tag,
        },
      }

      if (!preset) return nextConfig
      const nextFeatures = { ...(prev?.features || {}) }
      Object.entries(preset.feature_weights || {}).forEach(([feature, weight]) => {
        nextFeatures[feature] = {
          ...(nextFeatures[feature] || {}),
          weight,
        }
      })
      const anyProbabilisticEnabled = Object.values(nextFeatures.probabilistic?.methods || {}).some(method =>
        Boolean(method?.enabled)
      )
      if (nextFeatures.address && nextFeatures.probabilistic) {
        nextFeatures.address = {
          ...nextFeatures.address,
          weight: anyProbabilisticEnabled ? 5 : 10,
        }
        nextFeatures.probabilistic = {
          ...nextFeatures.probabilistic,
          weight: anyProbabilisticEnabled ? 5 : 0,
        }
      }

      return {
        ...nextConfig,
        features: nextFeatures,
        candidate_generation: {
          ...(prev?.candidate_generation || {}),
          strategy_order: preset.candidate_strategy_order || prev?.candidate_generation?.strategy_order || [],
        },
        clustering: {
          ...(prev?.clustering || {}),
          identifier_priority: preset.identifier_priority || prev?.clustering?.identifier_priority || [],
        },
      }
    })
    setSaved(false)
  }

  const waitForPipelineCompletion = useCallback(async (stepIds = []) => {
    const maxAttempts = 1200
    const delayMs = 3000

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const stepData = (await api.getSteps?.()) || []
        setSteps(stepData)
        const relevantSteps = stepIds.length
          ? stepData.filter(step => stepIds.includes(step.id))
          : stepData

        if (stepIds.length) {
          const failedStep = relevantSteps.find(step => step.run_status === 'error')
          if (failedStep) {
            const logLines = String(failedStep.log || '')
              .split('\n')
              .map(line => line.trim())
              .filter(Boolean)
            const detail = logLines.at(-1)
            const pipelineError = new Error(
              `${failedStep.name || failedStep.id} failed${detail ? `: ${detail}` : ''}`
            )
            pipelineError.name = 'IdentityPipelineError'
            throw pipelineError
          }
        }

        const stillRunning = relevantSteps.some(
          step =>
            step.run_status === 'running' ||
            step.run_status === 'queued' ||
            step.run_status === 'pending'
        )

        const completedRequestedSteps =
          !stepIds.length ||
          (relevantSteps.length === stepIds.length &&
            relevantSteps.every(step => step.run_status === 'done'))

        if (!stillRunning && completedRequestedSteps) {
          await new Promise(resolve => setTimeout(resolve, 500))
          return true
        }
      } catch (e) {
        if (e?.name === 'IdentityPipelineError') throw e
        console.error('Failed while waiting for pipeline completion', e)
      }

      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    throw new Error('Pipeline did not finish in time')
  }, [])

  const waitForEnhancedPipelineCompletion = useCallback(async (runId) => {
    if (!runId || !api.getEnhancedIdentityRunStatus) {
      return waitForPipelineCompletion(['step2b', 'step3', 'step4', 'step5'])
    }

    const maxAttempts = 4800
    const delayMs = 3000
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const run = await api.getEnhancedIdentityRunStatus(runId)
        const runSteps = Array.isArray(run?.steps) ? run.steps : []
        setSteps(current => {
          const currentById = new Map((current || []).map(step => [step.id, step]))
          runSteps.forEach(step => {
            currentById.set(step.id, {
              ...(currentById.get(step.id) || {}),
              ...step,
              run_status: step.status,
              outputs_ready: step.status === 'done',
            })
          })
          return Array.from(currentById.values())
        })

        if (run?.status === 'error') {
          const failedStep = runSteps.find(step => step.status === 'error')
          const logLines = String(failedStep?.log || '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
          const detail = logLines.at(-1)
          throw new Error(
            `${failedStep?.name || failedStep?.id || 'Identity pipeline'} failed${
              detail ? `: ${detail}` : ''
            }`
          )
        }
        if (run?.status === 'done') return true
      } catch (error) {
        if (error?.status === 404) {
          throw new Error(`Identity pipeline run ${runId} is no longer available`)
        }
        if (String(error?.message || '').toLowerCase().includes('failed')) throw error
        console.error(`Failed to read identity run ${runId}`, error)
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    throw new Error(`Identity pipeline run ${runId} did not finish in time`)
  }, [waitForPipelineCompletion])

  const waitForTrackedPipelineCompletion = useCallback(async (runId) => {
    if (!runId || !api.getPipelineRunStatus) {
      return waitForPipelineCompletion()
    }

    const maxAttempts = 4800
    const delayMs = 3000
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const run = await api.getPipelineRunStatus(runId)
        const runSteps = Array.isArray(run?.steps) ? run.steps : []
        setSteps(
          runSteps.map(step => ({
            ...step,
            run_status: step.status,
            outputs_ready: step.status === 'done',
          }))
        )
        if (run?.status === 'error') {
          const failedStep = runSteps.find(step => step.status === 'error')
          const detail = String(failedStep?.log || '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .at(-1)
          throw new Error(
            `${failedStep?.name || failedStep?.id || 'Identity pipeline'} failed${
              detail ? `: ${detail}` : ''
            }`
          )
        }
        if (run?.status === 'done') return true
      } catch (error) {
        if (error?.status === 404) {
          throw new Error(`Pipeline run ${runId} is no longer available`)
        }
        if (String(error?.message || '').toLowerCase().includes('failed')) throw error
        console.error(`Failed to read pipeline run ${runId}`, error)
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    throw new Error(`Pipeline run ${runId} did not finish in time`)
  }, [waitForPipelineCompletion])

  const handleSaveAndRunResolution = async () => {
    setRan(false)
    setSaving(true)

    if (enhancedConfig && api.updateEnhancedIdentityConfig) {
      const configuredWeights = Object.entries(enhancedConfig?.features || {})
        .filter(([, settings]) => settings && Object.prototype.hasOwnProperty.call(settings, 'weight'))
        .map(([, settings]) => Number(settings.weight) || 0)
      const configuredWeightTotal = configuredWeights.reduce((total, value) => total + value, 0)
      if (Math.round(configuredWeightTotal * 100) / 100 !== 100) {
        alert(`Feature weights must add up to 100 before running. Current total is ${configuredWeightTotal}.`)
        setSaving(false)
        return
      }

      try {
        await api.updateEnhancedIdentityConfig(enhancedConfig, selectedSource)
        setSaved(true)
      } catch (e) {
        alert('Failed to save identity configuration: ' + e.message)
        setSaving(false)
        return
      }

      setSaving(false)
      setRunning(true)

      try {
        // Saving an enhanced configuration must refresh the source data before
        // matching.  Running only /enhanced-identity/run reuses whichever
        // standardized snapshot already exists and can leave newly ingested
        // identity-eligible records out of ID Graph and Customer Profile.
        // The tracked full pipeline performs preprocessing and standardization,
        // then _run_pipeline_step_script selects the enhanced Media/Sports
        // preparation, scoring, clustering, and golden-record stages.
        const run = await api.runAll(selectedSource)
        await waitForTrackedPipelineCompletion(run?.run_id)
        await fetchSteps()

        if (onPipelineRunSuccess) {
          await onPipelineRunSuccess()
        }

        setRan(true)
      } catch (e) {
        alert('Failed to run identity resolution: ' + e.message)
      } finally {
        setRunning(false)
      }
      return
    }

    try {
      const nextRawConfig = mergeBlockingConfigForSource(rawConfig, selectedSource, config)
      await api.updateBlockingConfig(nextRawConfig)
      setRawConfig(nextRawConfig)
      if (api.updateSourcePreferences) {
        await api.updateSourcePreferences(sourcePrefs)
      }
      setSaved(true)
    } catch (e) {
      alert('Failed to save configuration: ' + e.message)
      setSaving(false)
      return
    }

    setSaving(false)
    setRunning(true)

    try {
      const run = await api.runAll(selectedSource)
      await waitForTrackedPipelineCompletion(run?.run_id)
      await fetchSteps()

      if (onPipelineRunSuccess) {
        await onPipelineRunSuccess()
      }

      setRan(true)
    } catch (e) {
      alert('Failed to run resolution: ' + e.message)
    } finally {
      setRunning(false)
    }
  }

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" /> Loading...
      </div>
    )
  }

  const anyRunning = steps.some(s => s.run_status === 'running')
  const isEnhancedIdentity = Boolean(enhancedConfig)

  if (isEnhancedIdentity) {
    const identityMatching = enhancedConfig?.identity_matching || {}
    const featureWeights = Object.fromEntries(
      Object.entries(enhancedConfig?.features || {})
        .filter(([, settings]) => settings && Object.prototype.hasOwnProperty.call(settings, 'weight'))
        .map(([feature, settings]) => [feature, settings.weight])
    )
    const matchTiers = enhancedConfig?.match_classification?.edge_tiers || {}
    const probabilisticMethods = enhancedConfig?.features?.probabilistic?.methods || {}
    const probabilistic = {
      same_device: Boolean(probabilisticMethods?.same_device?.enabled),
      same_ip: Boolean(probabilisticMethods?.same_ip?.enabled),
    }
    const candidateGeneration = enhancedConfig?.candidate_generation || {}
    const candidateStrategyDefinitions = candidateGeneration?.strategy_definitions || {}
    const candidateStrategyOrder = candidateGeneration?.strategy_order || Object.keys(candidateStrategyDefinitions)
    const candidateStrategies = candidateStrategyOrder
      .filter(strategy => candidateStrategyDefinitions[strategy])
      .map(strategy => ({
        id: strategy,
        ...(candidateStrategyDefinitions[strategy] || {}),
      }))
    const primaryTagOptions = identityMatching?.available_primary_identifiers || [
      ...(identityMatching?.available_key_identifiers || []),
      ...(identityMatching?.available_pii_fields || []),
    ]
    const visiblePrimaryTagOptions = primaryTagOptions.length
      ? Array.from(new Set(primaryTagOptions))
      : ['email', 'phone']
    const selectedPrimaryIdentifier = identityMatching.primary_tag || visiblePrimaryTagOptions[0] || 'email'
    const keyIdentifierOptions = new Set(identityMatching?.available_key_identifiers || [])
    const selectedPrimaryIsKeyIdentifier = keyIdentifierOptions.has(selectedPrimaryIdentifier)
    const featureLabels = {
      key_identifier: {
        label: enhancedConfig?.features?.key_identifier?.display_label || 'Key Identifier',
        color: '#0f766e',
      },
      email: { label: 'Email', color: '#3b82f6' },
      phone: { label: 'Phone', color: '#10b981' },
      name: { label: 'Name', color: '#8b5cf6' },
      dob: { label: 'Date of Birth', color: '#ec4899' },
      address: { label: 'Address', color: '#f59e0b' },
      probabilistic: { label: 'Probabilistic Signals', color: '#64748b' },
    }
    const visibleFeatureWeights = Object.entries(featureWeights).filter(([feature]) => {
      if (!featureLabels[feature]) return false
      if (feature === 'key_identifier' && !selectedPrimaryIsKeyIdentifier) return false
      return true
    })
    const visibleFeatureWeightTotal = visibleFeatureWeights.reduce(
      (total, [, value]) => total + (Number(value) || 0),
      0
    )
    return (
      <div>
        <div
          style={{
            background: 'rgba(59,130,246,0.06)',
            border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: 10,
            padding: '10px 14px',
            marginBottom: 12,
            display: 'flex',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <span style={{ fontSize: 18, marginTop: 1 }}>i</span>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: 2,
              }}
            >
              Configuration
            </div>
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                lineHeight: 1.35,
              }}
            >
              Manage {selectedSourceLabel} primary identifier, identity weights, match thresholds, probabilistic signals, and run
              the identity resolution pipeline from one place.
            </div>
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginLeft: 'auto',
              whiteSpace: 'nowrap',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
              Primary Identifier
            </span>
            <select
              value={selectedPrimaryIdentifier}
              onChange={e => applyEnhancedPrimaryTagPreset(e.target.value)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: '1px solid var(--border)',
                background: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                minWidth: 130,
                fontSize: 12,
              }}
            >
              {visiblePrimaryTagOptions.map(tag => (
                <option key={tag} value={tag}>
                  {formatFieldLabel(tag)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(360px, 1fr)',
            gap: 12,
            alignItems: 'stretch',
            marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', minHeight: '100%' }}>
            <CollapsibleSection title="Feature Weights" defaultOpen={true} cardStyle={{ width: '100%', height: '100%' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0 0 8px',
                  fontSize: 12,
                  color: visibleFeatureWeightTotal === 100 ? 'var(--text-muted)' : '#dc2626',
                  fontWeight: 700,
                }}
              >
                <span>Total weight</span>
                <span>{visibleFeatureWeightTotal}/100</span>
              </div>
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>Feature</th>
                      <th>Weight</th>
                      <th style={{ width: 58, textAlign: 'center' }}>Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFeatureWeights.map(([feature]) => {
                      const meta = featureLabels[feature] || { label: formatFieldLabel(feature), color: 'var(--accent)' }
                      const value = featureWeights[feature] ?? 0
                      return (
                        <tr key={feature}>
                          <td style={{ fontWeight: 600 }}>
                            <span
                              style={{
                                fontSize: 11,
                                padding: '2px 8px',
                                borderRadius: 12,
                                background: 'rgba(0,102,204,0.10)',
                                color: 'var(--accent-light)',
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 6,
                              }}
                            >
                              <span
                                style={{
                                  width: 7,
                                  height: 7,
                                  borderRadius: '50%',
                                  background: meta.color,
                                  display: 'inline-block',
                                }}
                              />
                              {meta.label}
                            </span>
                          </td>
                          <td>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={value}
                              onChange={e => updateEnhancedWeight(feature, e.target.value)}
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700, color: meta.color }}>
                            {value}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          </div>

          <CollapsibleSection title="Match Type Thresholds" defaultOpen={true} cardStyle={{ height: '100%' }}>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Match Type</th>
                    <th>Threshold</th>
                    <th style={{ width: 58, textAlign: 'center' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {['exact', 'strong', 'medium', 'weak'].map(tier => {
                    const cfg = matchTiers[tier] || {}
                    const displayValue = Number(cfg.min_score ?? 0)
                    return (
                      <tr key={tier}>
                        <td style={{ fontWeight: 600 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: '3px 10px',
                              borderRadius: 10,
                              ...(TIER_STYLES[tier] || {}),
                              fontWeight: 700,
                              textTransform: 'capitalize',
                            }}
                          >
                            {tier}
                          </span>
                        </td>
                        <td>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={displayValue}
                            onChange={e => updateEnhancedMatchTier(tier, e.target.value)}
                            style={{ width: '100%' }}
                          />
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: TIER_COLORS[tier] || 'var(--text-primary)' }}>
                          {displayValue}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
            gap: 12,
            alignItems: 'start',
            marginBottom: 16,
          }}
        >
          <CollapsibleSection title="Candidate Generation Strategies" defaultOpen={false}>
            <div
              style={{
                padding: '6px 12px',
                background: 'rgba(59,130,246,0.05)',
                borderBottom: '1px solid var(--border)',
                fontSize: 11,
                color: 'var(--text-muted)',
              }}
            >
              Candidate strategies only discover possible record pairs. Match type is decided later by feature scoring.
            </div>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Strategy</th>
                    <th>Fields Used</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateStrategies.map(strategy => {
                    const fields = strategy.fields || [
                      strategy.first_name_field,
                      strategy.last_name_field,
                      strategy.zip_field,
                    ].filter(Boolean)
                    return (
                      <tr key={strategy.id}>
                        <td style={{ fontWeight: 700 }}>
                          {strategy.label || formatFieldLabel(strategy.id)}
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                          {fields.length ? fields.join(', ') : '-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>

          <CollapsibleSection title="Advanced Probabilistic Signals" defaultOpen={false}>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Signal</th>
                    <th style={{ width: 90, textAlign: 'center' }}>Enabled</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['same_device', 'Same Device'],
                    ['same_ip', 'Same IP'],
                  ].map(([key, label]) => (
                    <tr key={key}>
                      <td style={{ fontWeight: 600 }}>{label}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => updateEnhancedProbabilistic(key, !probabilistic[key])}
                          style={{
                            background: probabilistic[key]
                              ? 'rgba(16,185,129,0.15)'
                              : 'rgba(100,116,139,0.12)',
                            border: 'none',
                            borderRadius: 9999,
                            padding: '3px 10px',
                            cursor: 'pointer',
                            color: probabilistic[key] ? '#10b981' : 'var(--text-muted)',
                            fontSize: 10,
                            fontWeight: 700,
                            fontFamily: 'inherit',
                          }}
                        >
                          {probabilistic[key] ? 'ON' : 'OFF'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <button
            className="btn btn-primary"
            onClick={handleSaveAndRunResolution}
            disabled={saving || running}
          >
            {saving || running ? 'Processing...' : 'Save Configuration and Run'}
          </button>
          <div style={{ marginTop: 8, textAlign: 'center' }}>
            <span style={{ color: 'var(--success)', fontSize: 13 }}>
              {saving
                ? 'Saving configuration...'
                : running
                    ? `Running ${selectedSourceLabel} identity resolution...`
                  : ran
                    ? 'Identity resolution completed successfully'
                    : ''}
            </span>
          </div>
        </div>
      </div>
    )
  }

  if (!config) return null

  const tags = config.tags || {}
  const rules = config.blocking_rules || []
  const primaryTagPresetMap = getPrimaryTagDefaults(selectedSource)
  const primaryTagOptions = Object.keys(primaryTagPresetMap || {})
  const fallbackPrimaryTagOptions = Object.keys(tags)
  const visiblePrimaryTagOptions = primaryTagOptions.length ? primaryTagOptions : fallbackPrimaryTagOptions

  return (
    <div>
      <div
        style={{
          background: 'rgba(59,130,246,0.06)',
          border: '1px solid rgba(59,130,246,0.2)',
          borderRadius: 10,
          padding: '16px 20px',
          marginBottom: 24,
          display: 'flex',
          gap: 14,
        }}
      >
        <span style={{ fontSize: 18, marginTop: 1 }}>ℹ️</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}
          >
            Configuration
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.6,
            }}
          >
            Manage weighted identity rules, blocking rules, match thresholds, preferred data
            source selection, and run the identity resolution pipeline from one place.
          </div>
        </div>
      </div>

      <CollapsibleSection
        title="Blocking Rules"
        defaultOpen={false}
        rightContent={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Primary Identifier:</span>
            <select
              value={primaryTag}
              onChange={e => handlePrimaryTagChange(e.target.value)}
              style={{
                padding: '4px 8px',
                fontSize: 11,
                borderRadius: 4,
                border: '1px solid var(--border)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
              }}
            >
              {visiblePrimaryTagOptions.map(tag => (
                <option key={tag} value={tag}>
                  {formatFieldLabel(tag)}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div
          style={{
            padding: '8px 16px',
            background: 'rgba(16,185,129,0.05)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11,
            color: '#10b981',
          }}
        >
          1P data only - blocking is restricted to first-party identity sources for {selectedSourceLabel}.
        </div>

        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 50 }}>Active</th>
                <th>Rule Name</th>
                <th>Blocking Key Chain</th>
                <th style={{ width: 100 }}>Weight</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule, rIdx) => {
                const ruleWeight = (rule.chain || []).reduce(
                  (sum, item) => sum + (tags[item.tag]?.weight || 0),
                  0
                )

                return (
                  <tr key={rIdx} style={{ opacity: rule.enabled ? 1 : 0.45 }}>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        onClick={() => toggleRule(rIdx)}
                        style={{
                          background: rule.enabled
                            ? 'rgba(16,185,129,0.15)'
                            : 'rgba(100,116,139,0.12)',
                          border: 'none',
                          borderRadius: 9999,
                          padding: '3px 10px',
                          cursor: 'pointer',
                          color: rule.enabled ? '#10b981' : 'var(--text-muted)',
                          fontSize: 10,
                          fontWeight: 700,
                          fontFamily: 'inherit',
                        }}
                      >
                        {rule.enabled ? 'ON' : 'OFF'}
                      </button>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {rule.name}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        {(rule.chain || []).map((item, cIdx) => (
                          <span key={cIdx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            {cIdx > 0 && (
                              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>+</span>
                            )}
                            <span
                              style={{
                                fontSize: 12,
                                padding: '3px 10px',
                                borderRadius: 12,
                                background: 'rgba(0,102,204,0.12)',
                                color: 'var(--text-primary)',
                                fontWeight: 500,
                              }}
                            >
                              {item.tag}
                              {item.char_count && (
                                <span style={{ opacity: 0.6, marginLeft: 3 }}>
                                  ({item.char_count}ch)
                                </span>
                              )}
                            </span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            width: Math.max(ruleWeight * 1.2, 4),
                            height: 6,
                            borderRadius: 3,
                            background: 'var(--accent)',
                            maxWidth: 80,
                          }}
                        />
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: 'var(--text-primary)',
                          }}
                        >
                          {ruleWeight}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CollapsibleSection>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
          gap: 16,
          alignItems: 'stretch',
          marginBottom: 24,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <CollapsibleSection title="Match Thresholds" defaultOpen={true}>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Tier</th>
                    <th>Min Score</th>
                    <th style={{ width: 60, textAlign: 'center' }}>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {['exact', 'strong', 'medium', 'weak']
                    .filter(tier => config?.edge_tiers?.[tier])
                    .map(tier => {
                      const cfg = config.edge_tiers[tier]
                      return (
                        <tr key={tier}>
                          <td>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: 600,
                                padding: '4px 14px',
                                borderRadius: 12,
                                textTransform: 'capitalize',
                                display: 'inline-block',
                                ...(TIER_STYLES[tier] || {}),
                              }}
                            >
                              {tier}
                            </span>
                          </td>
                          <td>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={cfg.min_score}
                              onChange={e => updateTier(tier, e.target.value)}
                              style={{ width: '100%' }}
                            />
                          </td>
                          <td style={{ textAlign: 'center', fontWeight: 700 }}>{cfg.min_score}</td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </CollapsibleSection>
        </div>

        <div style={{ minWidth: 0 }}>
          <CollapsibleSection title="Preferred Data Source per Tag" defaultOpen={true}>
            <p
              style={{
                padding: '0 16px',
                fontSize: 12,
                color: 'var(--text-muted)',
                margin: '12px 0 12px',
              }}
            >
              Configure how each field is selected during golden record generation. Only 1P sources
              are eligible.
            </p>

            <div style={{ padding: '0 16px 16px' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  Strategy:
                </span>
                <select
                  value={globalStrategy}
                  onChange={e => handleGlobalStrategyChange(e.target.value)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 12,
                    borderRadius: 4,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    width: '100%',
                    maxWidth: 260,
                  }}
                >
                  {GLOBAL_STRATEGIES.map(strategy => (
                    <option key={strategy.value} value={strategy.value}>
                      {strategy.label}
                    </option>
                  ))}
                </select>
              </div>

              {globalStrategy === 'preferred_source' && (
                <div className="data-table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 80 }}>Tag</th>
                        <th>Preferred Source</th>
                      </tr>
                    </thead>
                    <tbody>
                      {PREF_TAGS.map(tag => {
                        const entry = sourcePrefs[tag] || {}
                        const sources = canonicalTagsSources[tag] || []

                        return (
                          <tr key={tag}>
                            <td>
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 600,
                                  padding: '3px 10px',
                                  borderRadius: 4,
                                  background: 'rgba(59,130,246,0.1)',
                                  color: '#3b82f6',
                                  fontFamily: 'var(--font-mono)',
                                  textTransform: 'capitalize',
                                }}
                              >
                                {tag}
                              </span>
                            </td>
                            <td>
                              <select
                                value={entry.source || ''}
                                onChange={e => handlePrefSourceChange(tag, e.target.value)}
                                style={{
                                  padding: '5px 10px',
                                  fontSize: 12,
                                  borderRadius: 4,
                                  border: '1px solid var(--border)',
                                  background: 'var(--bg-primary)',
                                  color: 'var(--text-primary)',
                                  width: '100%',
                                }}
                              >
                                <option value="">Any (auto-select)</option>
                                {sources.map(source => (
                                  <option key={source} value={source}>
                                    {source.replace('.csv', '').replace(/_/g, ' ')}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </CollapsibleSection>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          width: '100%',
        }}
      >
        <button
          className="btn btn-primary"
          onClick={handleSaveAndRunResolution}
          disabled={saving || running || anyRunning}
        >
          {saving || running || anyRunning ? 'Processing...' : 'Save Configuration and Run'}
        </button>
        <div style={{ marginTop: 8, textAlign: 'center' }}>
          <span style={{ color: 'var(--success)', fontSize: 13 }}>
            {saving
              ? 'Saving Configuration...'
              : running || anyRunning
                ? 'Resolving Identities...'
                : ran
                  ? 'Configuration saved & identity resolution completed successfully'
                  : ''}
          </span>
        </div>
      </div>
    </div>
  )
}

function buildEdgesFromNodes(nodes = []) {
  const groups = new Map()

  const addToGroup = (key, id) => {
    if (!key) return
    const list = groups.get(key) || []
    list.push(id)
    groups.set(key, list)
  }

  nodes.forEach(n => {
    addToGroup(`email:${(n.email || '').trim().toUpperCase()}`, n.id)
    addToGroup(`phonezip:${(n.phone || '').trim()}|${(n.zip || '').trim()}`, n.id)
  })

  const edges = []
  const seen = new Set()

  const pushEdge = (a, b, matched_fields, tier, score) => {
    const k = a < b ? `${a}__${b}` : `${b}__${a}`
    if (seen.has(k)) return
    seen.add(k)
    edges.push({ source: a, target: b, matched_fields, tier, score })
  }

  for (const [key, ids] of groups.entries()) {
    const clean = ids.filter(Boolean)
    if (clean.length < 2) continue

    // connect as a chain to avoid n^2 explosion
    for (let i = 0; i < clean.length - 1; i++) {
      const a = clean[i]
      const b = clean[i + 1]

      if (key.startsWith('email:')) pushEdge(a, b, 'email', 'strong', 90)
      if (key.startsWith('phonezip:')) pushEdge(a, b, 'phone+zip', 'strong', 85)
    }
  }

  return edges
}

export default function IDGraph() {
  const [activeSection, setActiveSection] = useState('configuration')

  const [clusters, setClusters] = useState(null)
  const [clustersLoading, setClustersLoading] = useState(false)
  const [clustersError, setClustersError] = useState('')

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const [graphData, setGraphData] = useState(null)
  const [graphLoading, setGraphLoading] = useState(false)

  const [selectedCluster, setSelectedCluster] = useState('')
  const [hoverInfo, setHoverInfo] = useState(null)
  const [selectedEdge, setSelectedEdge] = useState(null)
  const [relationshipFilter, setRelationshipFilter] = useState('all')
  const [viewMode, setViewMode] = useState('graph')
  const [copiedId, setCopiedId] = useState(null)
  const [clusterPanelOpen, setClusterPanelOpen] = useState(true)
  const [clusterListKey, setClusterListKey] = useState(0)
  const [dataSource, setDataSource] = useState(() => getInitialGraphSource())
  const SOURCE_COLORS =
    SOURCE_COLORS_MAP[graphData?.cluster_source || dataSource] || SOURCE_COLORS_MAP.media
  const [blockingConfig, setBlockingConfig] = useState(null)
  const [allClusters, setAllClusters] = useState([])
  const [pageSize, setPageSize] = useState(10)
  const didFetchRef = useRef(false)


  const svgRef = useRef(null)
  const simRef = useRef(null)
  const clusterListBodyRef = useRef(null)

  const clusterRequestIdRef = useRef(0)
  const graphRequestIdRef = useRef(0)

  useEffect(() => {
    writeSelectedSourceSystem(dataSource)
  }, [dataSource])

  useEffect(() => {
    let mounted = true
    api.getBlockingConfig()
      .then(cfg => {
        if (mounted) setBlockingConfig(cfg)
      })
      .catch(error => {
        console.error('Failed to fetch blocking config for ID Graph table view', error)
      })
    return () => {
      mounted = false
    }
  }, [])

  const resetGraphView = useCallback(() => {
    graphRequestIdRef.current += 1

    setSelectedCluster('')
    setGraphData(null)
    setHoverInfo(null)
    setSelectedEdge(null)
    setRelationshipFilter('all')
    setViewMode('graph')
    setCopiedId(null)
    setGraphLoading(false)

    if (simRef.current) {
      simRef.current.stop()
    }
  }, [])

  const refreshClusters = useCallback(async (nextPage = 1, nextSearch = '', src = dataSource, nextPageSize = pageSize) => {
    const requestId = ++clusterRequestIdRef.current

    setClustersLoading(true)
    setClustersError('')

    try {
      const data = await fetchClustersApi(nextPage, nextPageSize, 2, nextSearch, src)
      if (requestId !== clusterRequestIdRef.current) return
      const clusterPage = Array.isArray(data?.clusters) ? data.clusters : []
      setAllClusters(clusterPage)
      setPage(Number(data?.page) || nextPage)
      setClusters({
        ...data,
        clusters: clusterPage,
        pages: Number(data?.pages) || 0,
        total: Number(data?.total) || clusterPage.length,
      })

    } catch (e) {
      console.error('Failed to fetch clusters', e)
      if (requestId === clusterRequestIdRef.current) {
        setClusters(null)
        setClustersError(e?.message || 'Unable to read ID Graph clusters from Unity Catalog.')
      }
    } finally {
      if (requestId === clusterRequestIdRef.current) {
        setClustersLoading(false)
      }
    }
  }, [dataSource, pageSize])

  const searchClusters = useCallback(
    async (nextPage = 1, nextSearch = search, src = dataSource, nextPageSize = pageSize) => {
      setPage(nextPage)
      await refreshClusters(nextPage, nextSearch, src, nextPageSize)
    },
    [refreshClusters, search, dataSource, pageSize]
  )

  const loadGraph = useCallback(async (clusterId, src = dataSource) => {
    const requestId = ++graphRequestIdRef.current

    setSelectedCluster(clusterId)
    setGraphLoading(true)
    setHoverInfo(null)
    setSelectedEdge(null)
    setRelationshipFilter('all')
    setViewMode('report')

    try {
      const data = await fetchGraphApi(clusterId, src)

      console.log('SOURCE SELECTED:', src)
      console.log('GRAPH RESPONSE:', data)

      if (requestId !== graphRequestIdRef.current) return
      setGraphData(data)
    } catch (e) {
      console.error('Failed to fetch graph', e)
      if (requestId === graphRequestIdRef.current) {
        setGraphData(null)
      }
    } finally {
      if (requestId === graphRequestIdRef.current) {
        setGraphLoading(false)
      }
    }
  }, [dataSource])

  const handlePipelineRunSuccess = useCallback(async () => {
    resetGraphView()

    setSearch('')
    setPage(1)
    setCopiedId(null)
    setClusterPanelOpen(true)

    setClusterListKey(prev => prev + 1)

    await refreshClusters(1, '', dataSource)

    requestAnimationFrame(() => {
      if (clusterListBodyRef.current) {
        clusterListBodyRef.current.scrollTop = 0
      }
    })
  }, [resetGraphView, refreshClusters, dataSource])

  const handleDataSourceChange = useCallback(nextSource => {
    setDataSource(nextSource)
    resetGraphView()
    setSearch('')
    setPage(1)
    setCopiedId(null)
    setClusterPanelOpen(true)
    setClusterListKey(prev => prev + 1)
    setClusters(null)

    requestAnimationFrame(() => {
      if (clusterListBodyRef.current) {
        clusterListBodyRef.current.scrollTop = 0
      }
    })
  }, [resetGraphView])

  useEffect(() => {
    if (typeof window === 'undefined') return undefined

    const syncSourceFromDataOverview = () => {
      const nextSource = getInitialGraphSource()
      if (nextSource !== dataSource) {
        handleDataSourceChange(nextSource)
      }
    }

    window.addEventListener('focus', syncSourceFromDataOverview)
    window.addEventListener('storage', syncSourceFromDataOverview)
    window.addEventListener('cdp-source-system-change', syncSourceFromDataOverview)
    syncSourceFromDataOverview()

    return () => {
      window.removeEventListener('focus', syncSourceFromDataOverview)
      window.removeEventListener('storage', syncSourceFromDataOverview)
      window.removeEventListener('cdp-source-system-change', syncSourceFromDataOverview)
    }
  }, [dataSource, handleDataSourceChange])


  useEffect(() => {
    refreshClusters(1, '', dataSource)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataSource])


  useEffect(() => {
    return () => {
      if (simRef.current) simRef.current.stop()
    }
  }, [])

  const drawGraph = useCallback(() => {
    if (!graphData || !graphData.nodes?.length || !svgRef.current || viewMode !== 'graph') return

    const displayGraphData = graphData

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const width = svgRef.current.clientWidth
    const height = 500

    const defs = svg.append('defs')

    const dropShadow = defs
      .append('filter')
      .attr('id', 'node-shadow')
      .attr('x', '-50%')
      .attr('y', '-50%')
      .attr('width', '200%')
      .attr('height', '200%')

    dropShadow
      .append('feDropShadow')
      .attr('dx', 0)
      .attr('dy', 1)
      .attr('stdDeviation', 3)
      .attr('flood-opacity', 0.4)
      .attr('flood-color', '#000')

    Object.entries(SOURCE_COLORS).forEach(([name, color]) => {
      const glowFilter = defs
        .append('filter')
        .attr('id', `glow-${name}`)
        .attr('x', '-100%')
        .attr('y', '-100%')
        .attr('width', '300%')
        .attr('height', '300%')

      glowFilter
        .append('feGaussianBlur')
        .attr('stdDeviation', '5')
        .attr('in', 'SourceGraphic')
        .attr('result', 'blur')

      glowFilter
        .append('feColorMatrix')
        .attr('in', 'blur')
        .attr('type', 'matrix')
        .attr('values', '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0')
        .attr('result', 'mask')

      glowFilter
        .append('feFlood')
        .attr('flood-color', color)
        .attr('flood-opacity', '0.35')
        .attr('result', 'color')

      glowFilter
        .append('feComposite')
        .attr('in', 'color')
        .attr('in2', 'mask')
        .attr('operator', 'in')
        .attr('result', 'glow')

      const merge = glowFilter.append('feMerge')
      merge.append('feMergeNode').attr('in', 'glow')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')
    })

    Object.entries(SOURCE_COLORS).forEach(([name, color]) => {
      const grad = defs
        .append('radialGradient')
        .attr('id', `fill-${name}`)
        .attr('cx', '40%')
        .attr('cy', '35%')
        .attr('r', '60%')

      grad.append('stop').attr('offset', '0%').attr('stop-color', color).attr('stop-opacity', 1)
      grad.append('stop').attr('offset', '100%').attr('stop-color', color).attr('stop-opacity', 0.6)
    })

    const specGrad = defs
      .append('radialGradient')
      .attr('id', 'spec-highlight')
      .attr('cx', '35%')
      .attr('cy', '30%')
      .attr('r', '40%')

    specGrad.append('stop').attr('offset', '0%').attr('stop-color', '#fff').attr('stop-opacity', 0.45)
    specGrad.append('stop').attr('offset', '100%').attr('stop-color', '#fff').attr('stop-opacity', 0)

    const fallGrad = defs
      .append('radialGradient')
      .attr('id', 'fill-default')
      .attr('cx', '40%')
      .attr('cy', '35%')
      .attr('r', '60%')

    fallGrad.append('stop').attr('offset', '0%').attr('stop-color', '#64748b').attr('stop-opacity', 1)
    fallGrad.append('stop').attr('offset', '100%').attr('stop-color', '#64748b').attr('stop-opacity', 0.6)

    const textHalo = defs
      .append('filter')
      .attr('id', 'text-halo')
      .attr('x', '-20%')
      .attr('y', '-20%')
      .attr('width', '140%')
      .attr('height', '140%')

    textHalo
      .append('feMorphology')
      .attr('in', 'SourceAlpha')
      .attr('operator', 'dilate')
      .attr('radius', '2.5')
      .attr('result', 'dilated')

    textHalo
      .append('feGaussianBlur')
      .attr('in', 'dilated')
      .attr('stdDeviation', '1.2')
      .attr('result', 'haloBlur')

    textHalo
      .append('feFlood')
      .attr('flood-color', '#080c14')
      .attr('flood-opacity', '0.9')
      .attr('result', 'haloColor')

    textHalo
      .append('feComposite')
      .attr('in', 'haloColor')
      .attr('in2', 'haloBlur')
      .attr('operator', 'in')
      .attr('result', 'halo')

    const textMerge = textHalo.append('feMerge')
    textMerge.append('feMergeNode').attr('in', 'halo')
    textMerge.append('feMergeNode').attr('in', 'SourceGraphic')

    const g = svg.append('g')

    svg.call(
      d3.zoom().scaleExtent([0.2, 4]).on('zoom', event => {
        g.attr('transform', event.transform)
      })
    )

    const safeEdges =
      displayGraphData.edges?.length ? displayGraphData.edges : buildEdgesFromNodes(displayGraphData.nodes)
    const filteredRawEdges =
      relationshipFilter === 'all'
        ? safeEdges
        : safeEdges.filter(edge => edgeTier(edge) === relationshipFilter)
    const edges = readableGraphEdges(filteredRawEdges, displayGraphData.nodes).map(edge => ({ ...edge }))

    const connectedIds = new Set()
    edges.forEach(edge => {
      connectedIds.add(typeof edge.source === 'object' ? edge.source.id : edge.source)
      connectedIds.add(typeof edge.target === 'object' ? edge.target.id : edge.target)
    })

    const nodes = (
      relationshipFilter === 'all'
        ? displayGraphData.nodes
        : displayGraphData.nodes.filter(node => connectedIds.has(node.id))
    ).map(node => ({ ...node }))

    if (simRef.current) simRef.current.stop()

    const simulation = d3
      .forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide(20))

    simRef.current = simulation

    const linkVisible = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', d => edgeTierColor(d))
      .attr('stroke-width', d => {
        const isSelected = selectedEdge && edgeKey(selectedEdge) === edgeKey(d)
        return (TIER_WIDTH[edgeTier(d)] || 1.5) + (isSelected ? 1.5 : 0)
      })
      .attr('stroke-opacity', d => {
        const isSelected = selectedEdge && edgeKey(selectedEdge) === edgeKey(d)
        return isSelected ? 1 : edgeTier(d) === 'weak' ? 0.65 : 0.78
      })
      .attr('stroke-linecap', 'round')
      .attr('stroke-dasharray', d => edgeLineDash(d))

    const linkHitArea = g
      .append('g')
      .selectAll('line')
      .data(edges)
      .join('line')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 16)
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation()
        setSelectedEdge({
          ...d,
          source: typeof d.source === 'object' ? d.source.id : d.source,
          target: typeof d.target === 'object' ? d.target.id : d.target,
        })
      })
      .on('mouseover', (_, d) => {
        setHoverInfo({
          type: 'edge',
          data: {
            ...d,
            source: typeof d.source === 'object' ? d.source.id : d.source,
            target: typeof d.target === 'object' ? d.target.id : d.target,
            score: d.score,
            tier: d.tier,
          },
        })

        linkVisible
          .filter(linkDatum => linkDatum === d)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', d2 => (TIER_WIDTH[edgeTier(d2)] || 1.5) + 2)
      })
      .on('mouseout', (_, d) => {
        setHoverInfo(null)

        linkVisible
          .filter(linkDatum => linkDatum === d)
          .attr('stroke-opacity', linkDatum => {
            const isSelected = selectedEdge && edgeKey(selectedEdge) === edgeKey(linkDatum)
            return isSelected ? 1 : edgeTier(linkDatum) === 'weak' ? 0.65 : 0.78
          })
          .attr('stroke-width', d2 => {
            const isSelected = selectedEdge && edgeKey(selectedEdge) === edgeKey(d2)
            return (TIER_WIDTH[edgeTier(d2)] || 1.5) + (isSelected ? 1.5 : 0)
          })
      })

    const nodeGroup = g
      .append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart()
            d.fx = d.x
            d.fy = d.y
          })
          .on('drag', (event, d) => {
            d.fx = event.x
            d.fy = event.y
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0)
            d.fx = null
            d.fy = null
          })
      )

    nodeGroup
      .append('circle')
      .attr('r', 14)
      .attr('fill', 'none')
      .attr('filter', d => {
        const sourceLabel = sourceLabelForNode(d)
        return `url(#glow-${SOURCE_COLORS[sourceLabel] ? sourceLabel : 'Billing'})`
      })
      .attr('stroke', d => SOURCE_COLORS[sourceLabelForNode(d)] || '#64748b')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3)
      .attr('pointer-events', 'none')

    nodeGroup
      .append('circle')
      .attr('r', 9)
      .attr('fill', d => {
        const sourceLabel = sourceLabelForNode(d)
        return `url(#fill-${SOURCE_COLORS[sourceLabel] ? sourceLabel : 'default'})`
      })
      .attr('stroke', d => SOURCE_COLORS[sourceLabelForNode(d)] || '#64748b')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6)
      .attr('filter', 'url(#node-shadow)')

    nodeGroup
      .append('circle')
      .attr('r', 7)
      .attr('fill', 'url(#spec-highlight)')
      .attr('pointer-events', 'none')

    nodeGroup
      .append('text')
      .text(d => d.id)
      .attr('font-size', 8.5)
      .attr('fill', '#e2e8f0')
      .attr('text-anchor', 'middle')
      .attr('dy', -17)
      .attr('font-family', 'var(--font-mono), Consolas, monospace')
      .attr('font-weight', 500)
      .attr('letter-spacing', '0.02em')
      .attr('filter', 'url(#text-halo)')
      .attr('pointer-events', 'none')

    nodeGroup
      .on('mouseover', (event, d) => {
        setHoverInfo({ type: 'node', data: d })

        const group = d3.select(event.currentTarget)
        group.select('circle:nth-child(1)').transition().duration(200).attr('r', 18).attr('stroke-opacity', 0.5)
        group.select('circle:nth-child(2)').transition().duration(200).attr('r', 12)
        group.select('circle:nth-child(3)').transition().duration(200).attr('r', 9.5)
      })
      .on('mouseout', event => {
        setHoverInfo(null)

        const group = d3.select(event.currentTarget)
        group.select('circle:nth-child(1)').transition().duration(300).attr('r', 14).attr('stroke-opacity', 0.3)
        group.select('circle:nth-child(2)').transition().duration(300).attr('r', 9)
        group.select('circle:nth-child(3)').transition().duration(300).attr('r', 7)
      })

    simulation.on('tick', () => {
      linkVisible
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      linkHitArea
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)

      nodeGroup.attr('transform', d => `translate(${d.x},${d.y})`)
    })
  }, [graphData, dataSource, relationshipFilter, selectedEdge, viewMode])

  useEffect(() => {
    drawGraph()
  }, [drawGraph])

  const selectedClusterInfo = clusters?.clusters?.find(cluster => cluster.cluster_id === selectedCluster)
  const clusterSummary = clusters?.cluster_summary || null
  const blockedLinkCount = Number(clusterSummary?.rejected_guardrail_edge_count || clusterSummary?.rejected_edge_count || 0)
  const displayGraphData = graphData
  const graphDisplayEdges = graphData
    ? readableGraphEdges(displayGraphData.edges || [], displayGraphData.nodes || [])
    : []
  const stats = graphData
    ? (() => {
      const filteredEdges =
        relationshipFilter === 'all'
          ? displayGraphData.edges || []
          : (displayGraphData.edges || []).filter(edge => edgeTier(edge) === relationshipFilter)
      return {
        nodes: Number(displayGraphData.nodes.length || selectedClusterInfo?.size || graphData.nodes.length),
        rawNodes: Number(graphData.record_count || selectedClusterInfo?.size || graphData.nodes.length),
        edges: filteredEdges.length,
        shownEdges: graphDisplayEdges.length,
        householdLinks: Number(graphData.household_link_count || graphData.household_links?.length || 0),
        sources: [...new Set(displayGraphData.nodes.map(node => sourceLabelForNode(node)))].length,
        avgScore:
          filteredEdges.length > 0
            ? Math.round(
              filteredEdges.reduce((sum, edge) => sum + (edge.score || 0), 0) /
              filteredEdges.length
            )
            : 0,
      }
    })()
    : null

  const renderTooltip = () => {
    if (!hoverInfo) return null

    const tipStyle = {
      position: 'absolute',
      top: 12,
      right: 12,
      background: 'var(--bg-card)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: '12px 16px',
      fontSize: 12,
      minWidth: 220,
      zIndex: 10,
      boxShadow: 'var(--shadow-lg)',
      pointerEvents: 'none',
    }

    if (hoverInfo.type === 'node') {
      const d = hoverInfo.data
      const sourceLabel = sourceLabelForNode(d, dataSource)
      const displayName = displayNameForNode(d)
      const displayEmail = displayEmailForNode(d)
      const nameResolutionLabel = d.name_resolution === 'matched_email'
        ? 'Resolved via matching email'
        : d.name_resolution === 'matched_phone'
          ? 'Resolved via matching phone'
          : d.name_resolution === 'governed_profile'
            ? 'Resolved from governed customer profile'
          : d.name_resolution === 'cluster_consensus'
            ? 'Resolved from unique cluster identity'
            : ''

      return (
        <div style={tipStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: SOURCE_COLORS[sourceLabel] || '#64748b',
              }}
            />
            <span style={{ fontWeight: 700, color: 'var(--accent-light)' }}>
              ID: {d.id || '—'}
            </span>
          </div>
          <div style={{ color: 'var(--text-muted)', marginBottom: 2 }}>
            Source: <span style={{ color: SOURCE_COLORS[sourceLabel] || '#fff' }}>{sourceLabel}</span>
          </div>
          <div style={{ color: 'var(--text-secondary)' }}>Name: {displayName}</div>
          {nameResolutionLabel && (
            <div style={{ color: 'var(--text-muted)', fontSize: 10, marginTop: 2 }}>
              {nameResolutionLabel}
            </div>
          )}
          <div style={{ color: 'var(--text-secondary)' }}>Email: {displayEmail}</div>
        </div>
      )
    }

    if (hoverInfo.type === 'edge') {
      const d = hoverInfo.data
      const evidenceRows = getEdgeFeatureEvidence(d)
      const fields = [
        ...(d.matched_fields || '')
          .split((d.matched_fields || '').includes('|') ? '|' : '+')
          .filter(Boolean)
          .map(field => field.trim()),
        ...evidenceRows.filter(row => row.contribution > 0 || row.confidence > 0).map(row => row.feature),
      ].filter((field, index, all) => field && all.indexOf(field) === index)
      const techniques = formatMatchingTechniques(d.matching_techniques)

      return (
        <div
          style={{
            ...tipStyle,
            border: `1px solid ${edgeTierColor(d) || 'var(--border)'}`,
            minWidth: 260,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
            Match Edge
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: 'var(--text-muted)' }}>Score:</span>
            <span style={{ fontWeight: 700 }}>{d.score}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: 'var(--text-muted)' }}>Match Type:</span>
            <span style={{ fontWeight: 800, color: edgeTierColor(d) }}>{edgeTier(d)}</span>
          </div>
          {fields.length > 0 && (
            <>
              <div
                style={{
                  color: 'var(--text-muted)',
                  marginBottom: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Matched Fields
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: evidenceRows.length ? 10 : 0 }}>
                {fields.map(field => (
                  <span key={field} className="tag-chip" style={{ fontSize: 10, padding: '1px 6px' }}>
                    {formatFieldLabel(field)}
                  </span>
                ))}
              </div>
            </>
          )}

          {evidenceRows.length > 0 && (
            <>
              <div
                style={{
                  color: 'var(--text-muted)',
                  marginBottom: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Feature Evidence
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {evidenceRows.map(row => (
                  <div
                    key={row.feature}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '78px 58px auto',
                      gap: 8,
                      alignItems: 'center',
                      fontSize: 11,
                    }}
                  >
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{row.label}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {(row.confidence * 100).toFixed(0)}%
                    </span>
                    <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                      {row.weight ? `${formatEvidenceNumber(row.contribution)}/${formatEvidenceNumber(row.weight, 0)}` : '-'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {techniques.length > 0 && (
            <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5 }}>
              {techniques.slice(0, 4).map(item => (
                <div key={item}>{item}</div>
              ))}
            </div>
          )}
        </div>
      )
    }

    return null
  }

  const renderSelectedEdgePanel = () => {
    if (!selectedEdge) return null

    const evidenceRows = getEdgeFeatureEvidence(selectedEdge)
      .filter(row => row.contribution > 0 || row.confidence > 0)
    const matchedFields = String(selectedEdge.matched_fields || '')
      .split(String(selectedEdge.matched_fields || '').includes('|') ? '|' : '+')
      .map(field => field.trim())
      .filter(Boolean)
      .filter((field, index, all) => all.indexOf(field) === index)
    const techniques = formatMatchingTechniques(selectedEdge.matching_techniques)
    const tier = edgeTier(selectedEdge)

    return (
      <div
        style={{
          position: 'absolute',
          right: 14,
          top: 14,
          width: 340,
          maxWidth: 'calc(100% - 28px)',
          background: 'rgba(15,23,42,0.96)',
          border: `1px solid ${edgeTierColor(selectedEdge)}`,
          borderRadius: 12,
          padding: 14,
          boxShadow: 'var(--shadow-lg)',
          zIndex: 8,
        }}
      >
        <div className="flex-between" style={{ marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 800, textTransform: 'uppercase' }}>
              Selected Match Link
            </div>
            <div style={{ marginTop: 2, color: 'var(--text-secondary)', fontSize: 11, fontFamily: 'var(--font-mono)' }}>
              {selectedEdge.source}{' -> '}{selectedEdge.target}
            </div>
          </div>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setSelectedEdge(null)}
            style={{ padding: '3px 8px' }}
          >
            Close
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>
              Relationship
            </div>
            <span
              className="badge"
              style={{
                marginTop: 4,
                background: `${edgeTierColor(selectedEdge)}22`,
                color: edgeTierColor(selectedEdge),
              }}
            >
              {tier}
            </span>
          </div>
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 800 }}>
              Overall Score
            </div>
            <div style={{ marginTop: 3, color: 'var(--text-primary)', fontSize: 20, fontWeight: 800 }}>
              {selectedEdge.score || selectedEdge.final_confidence || '-'}
            </div>
          </div>
        </div>

        {matchedFields.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 800, marginBottom: 5 }}>
              Matched Fields
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {matchedFields.map(field => (
                <span key={field} className="tag-chip" style={{ fontSize: 10, padding: '2px 7px' }}>
                  {formatFieldLabel(field)}
                </span>
              ))}
            </div>
          </div>
        )}

        {evidenceRows.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 800, marginBottom: 6 }}>
              Feature Evidence
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 76px 76px',
                gap: 8,
                color: 'var(--text-muted)',
                fontSize: 10,
                fontWeight: 800,
                marginBottom: 5,
                textTransform: 'uppercase',
              }}
            >
              <span>Feature</span>
              <span style={{ textAlign: 'right' }}>Confidence</span>
              <span style={{ textAlign: 'right' }}>Score</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evidenceRows.map(row => (
                <div
                  key={row.feature}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 76px 76px',
                    gap: 8,
                    alignItems: 'center',
                    fontSize: 11,
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)', fontWeight: 700 }}>{row.label}</span>
                  <span style={{ color: 'var(--text-muted)', textAlign: 'right' }}>{(row.confidence * 100).toFixed(0)}%</span>
                  <span style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-mono)', textAlign: 'right' }}>
                    {row.weight
                      ? `${formatEvidenceNumber(row.contribution)}/${formatEvidenceNumber(row.weight, 0)}`
                      : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {techniques.length > 0 && (
          <div>
            <div style={{ color: 'var(--text-muted)', fontSize: 10, textTransform: 'uppercase', fontWeight: 800, marginBottom: 5 }}>
              Matching Techniques
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, color: 'var(--text-secondary)', fontSize: 11 }}>
              {techniques.map(item => (
                <div key={item}>{item}</div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderDetailView = () => {
    if (!graphData) return null

    const detailGraphData = graphData
    const nodeMap = {}
    detailGraphData.nodes.forEach(node => {
      nodeMap[node.id] = node
    })

    let baseId = detailGraphData.nodes[0]?.id
    let bestScore = -1

    const validIdentityValue = (...values) => values.some(value => String(value || '').trim())
    const nodeIdentityQualityScore = node => {
      let score = 0
      if (validIdentityValue(node.email_standardized, node.email)) score += 40
      if (validIdentityValue(node.phone_standardized)) score += 30
      if (
        validIdentityValue(node.first_name) &&
        validIdentityValue(node.last_name)
      ) {
        score += 20
      } else if (validIdentityValue(node.full_name, node.name)) {
        score += 10
      }
      if (validIdentityValue(node.address_standardized, node.address) && validIdentityValue(node.zip, node.zip_code)) {
        score += 10
      }
      return score
    }

    detailGraphData.nodes.forEach(node => {
      const score = nodeIdentityQualityScore(node)
      if (score > bestScore) {
        bestScore = score
        baseId = node.id
      }
    })

    const baseNode = nodeMap[baseId]
    if (!baseNode) return null

    const parseEdgeFields = raw => {
      const fieldSet = new Set()
      const parts = (raw || '').includes('|') ? (raw || '').split('|') : (raw || '').split('+')

      parts
        .filter(Boolean)
        .forEach(field => {
          const match = field.trim().match(/^([^(]+)/)
          if (match) fieldSet.add(match[1].trim().toLowerCase())
        })

      return fieldSet
    }

    const TIER_RANK = { exact: 0, strong: 1, medium: 2, weak: 3 }
    const betterEdgeInfo = (candidate, existing) => {
      if (!existing) return true
      const candidateTierRank = TIER_RANK[edgeTier(candidate)] ?? 9
      const existingTierRank = TIER_RANK[edgeTier(existing.edgeEvidence)] ?? 9
      if (candidateTierRank !== existingTierRank) return candidateTierRank < existingTierRank
      return Number(candidate.score || candidate.final_confidence || 0) > Number(existing.score || 0)
    }

    const evidenceEdges =
      relationshipFilter === 'all'
        ? detailGraphData.edges
        : detailGraphData.edges.filter(edge => edgeTier(edge) === relationshipFilter)

    const matchInfoMap = {}

    evidenceEdges.forEach(edge => {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target

      if (sourceId !== baseId && targetId !== baseId) return

      const otherId = sourceId === baseId ? targetId : sourceId
      const existing = matchInfoMap[otherId]

      if (betterEdgeInfo(edge, existing)) {
        matchInfoMap[otherId] = {
          tier: edgeTier(edge),
          score: edge.score || edge.final_confidence || '',
          relationship: edgeTier(edge),
          edgeEvidence: edge,
          matchedFields: parseEdgeFields(edge.matched_fields),
          evidenceScope: 'Direct to base',
        }
      } else if (existing) {
        parseEdgeFields(edge.matched_fields).forEach(field => existing.matchedFields.add(field))
      }
    })

    evidenceEdges.forEach(edge => {
      const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
      const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target

      ;[sourceId, targetId].forEach(nodeId => {
        if (!nodeId || nodeId === baseId) return
        const existing = matchInfoMap[nodeId]
        if (existing?.evidenceScope === 'Direct to base') return
        if (betterEdgeInfo(edge, existing)) {
          matchInfoMap[nodeId] = {
            tier: edgeTier(edge),
            score: edge.score || edge.final_confidence || '',
            relationship: edgeTier(edge),
            edgeEvidence: edge,
            matchedFields: parseEdgeFields(edge.matched_fields),
            evidenceScope: 'Cluster path',
          }
        }
      })
    })

    const splitName = name => {
      if (!name) return { first: '', last: '' }
      const parts = name.trim().split(/\s+/)
      return {
        first: parts[0] || '',
        last: parts.slice(1).join(' ') || '',
      }
    }

    const currentGraphSource = graphData?.cluster_source || dataSource
    const isAutomotiveGraph = currentGraphSource === 'automotive'
    const sourceBlockingConfig = getBlockingConfigForSource(blockingConfig, currentGraphSource)
    const configuredTagKeys = Object.keys(sourceBlockingConfig?.tags || {})
    const visibleConfiguredTagKeys =
      isAutomotiveGraph && configuredTagKeys.includes('vehicle_id')
        ? configuredTagKeys.filter(tag => tag !== 'device_id')
        : configuredTagKeys
    const useConfiguredTags = isAutomotiveGraph && visibleConfiguredTagKeys.length > 0
    const defaultIdentityColumns = [
      { key: 'first_name', label: 'First Name', matchKey: 'first_name' },
      { key: 'last_name', label: 'Last Name', matchKey: 'last_name' },
      { key: 'phone', label: 'Phone', matchKey: 'phone' },
      { key: 'email', label: 'Email', matchKey: 'email' },
      { key: 'device_id', label: isAutomotiveGraph ? 'Vehicle ID' : 'Device ID', matchKey: 'device_id' },
      { key: 'ip_address', label: 'IP Address', matchKey: 'ip_address' },
      { key: 'address', label: 'Address', matchKey: 'address' },
      { key: 'zip', label: 'Zip', matchKey: 'zip' },
    ]
    const configuredIdentityColumns = visibleConfiguredTagKeys.map(tag => ({
      key: tag,
      label: isAutomotiveGraph && tag === 'device_id' ? 'Vehicle ID' : formatFieldLabel(tag),
      matchKey: tag,
    }))

    const hasGroupedSportsRows =
      dataSource === 'sports' &&
      detailGraphData.nodes.some(node => Number(node.grouped_record_count || 0) > 1)

    const columns = [
      { key: 'source', label: 'Source', matchKey: null },
      ...(hasGroupedSportsRows ? [{ key: 'record_count', label: 'Records', matchKey: null }] : []),
      ...(useConfiguredTags ? configuredIdentityColumns : defaultIdentityColumns),
      { key: 'relationship', label: 'Relationship', matchKey: null },
      { key: 'matched_fields', label: 'Matched Fields', matchKey: null },
      { key: 'overall_score', label: 'Overall Score', matchKey: null },
    ]

    const getCellValue = (node, columnKey) => {
      if (columnKey === 'source') return displaySourceLabelForNode(node)
      if (columnKey === 'first_name') return node.first_name || splitName(node.full_name || node.name).first
      if (columnKey === 'last_name') return node.last_name || splitName(node.full_name || node.name).last
      if (columnKey === 'full_name' || columnKey === 'name') return node.full_name || node.name || ''
      if (columnKey === 'zip') return node.zip || node.zip_code || ''
      if (columnKey === 'record_count') return Number(node.grouped_record_count || 1)
      if (isAutomotiveGraph && (columnKey === 'vehicle_id' || columnKey === 'device_id')) return resolveAutomotiveVehicleId(node)
      if (['relationship', 'matched_fields', 'overall_score'].includes(columnKey)) return ''
      return node[columnKey] || ''
    }

    const otherNodes = detailGraphData.nodes
      .filter(node => node.id !== baseId)
      .map(node => ({ node, info: matchInfoMap[node.id] || null }))
      .filter(entry => relationshipFilter === 'all' || entry.info)
      .sort((a, b) => {
        const tierRank = { exact: 0, strong: 1, medium: 2, weak: 3 }
        const tierDiff =
          (tierRank[edgeTier(a.info?.edgeEvidence)] ?? 99) -
          (tierRank[edgeTier(b.info?.edgeEvidence)] ?? 99)
        if (tierDiff !== 0) return tierDiff
        return (b.info?.score ?? 0) - (a.info?.score ?? 0)
      })

    const normalizeMatchedField = field => {
      if (field === 'full_name' || field === 'name') return ['first_name', 'last_name']
      if (field === 'address') return ['address', 'zip']
      if (isAutomotiveGraph && field === 'device_id') return ['vehicle_id']
      return [field]
    }

    const fieldMatchesColumn = (fields, matchKey) => {
      const fieldSet = new Set(fields || [])
      if (!matchKey) return false
      if (fieldSet.has(matchKey)) return true
      if (matchKey === 'ticket_account_id' && fieldSet.has('key_identifier')) return true
      if ((matchKey === 'first_name' || matchKey === 'last_name' || matchKey === 'full_name') && fieldSet.has('name')) return true
      if ((matchKey === 'address' || matchKey === 'zip') && fieldSet.has('address')) return true
      if ((matchKey === 'device_id' || matchKey === 'ip_address') && fieldSet.has('probabilistic')) return true
      return false
    }

    const highlightColorForColumn = matchKey => {
      if (matchKey === 'email') return FIELD_HIGHLIGHT_COLORS.email
      if (matchKey === 'phone') return FIELD_HIGHLIGHT_COLORS.phone
      if (matchKey === 'first_name' || matchKey === 'last_name' || matchKey === 'full_name') return FIELD_HIGHLIGHT_COLORS.name
      if (matchKey === 'address' || matchKey === 'zip') return FIELD_HIGHLIGHT_COLORS.address
      if (matchKey === 'device_id' || matchKey === 'ip_address') return FIELD_HIGHLIGHT_COLORS.probabilistic
      return 'rgba(255,255,0,0.10)'
    }

    const getComparedFields = info => {
      if (!info) return []
      const evidenceFields = getEdgeFeatureEvidence(info.edgeEvidence)
        .filter(row => row.confidence > 0)
        .map(row => row.feature)
      const rawFields = [...(info.matchedFields || new Set()), ...evidenceFields]
      const fields = rawFields.flatMap(normalizeMatchedField)
      const visibleMatchKeys = new Set(columns.map(column => column.matchKey).filter(Boolean))
      const visibleFields = fields.filter(field => visibleMatchKeys.has(field))
      if (visibleFields.includes('customer_id')) return ['customer_id']
      if (visibleFields.length) return [...new Set(visibleFields)]
      return []
    }

    const tableRows = otherNodes.map(entry => ({
      ...entry,
      comparedFields: getComparedFields(entry.info),
    }))

    const selectedTierHasBaseEdge =
      relationshipFilter === 'all' ||
      evidenceEdges.some(edge => {
        const sourceId = typeof edge.source === 'object' ? edge.source.id : edge.source
        const targetId = typeof edge.target === 'object' ? edge.target.id : edge.target
        return sourceId === baseId || targetId === baseId
      })

    if (relationshipFilter !== 'all' && tableRows.length === 0) {
      return (
        <div className="empty-state" style={{ padding: 56 }}>
          <div className="empty-state-title">No {relationshipFilter} links in this cluster</div>
          <p>Select another match type or switch back to All to view the full cluster.</p>
        </div>
      )
    }

    const renderComparedFields = (info, precomputedFields = null) => {
      const fields = precomputedFields || getComparedFields(info)
      if (!fields.length) {
        return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>
      }
      return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {fields.map(field => (
            <span
              key={field}
              className="tag-chip"
              style={{
                fontSize: 10,
                padding: '2px 7px',
                borderRadius: 9999,
                background:
                  field === 'email' ? FIELD_HIGHLIGHT_COLORS.email
                    : field === 'phone' ? FIELD_HIGHLIGHT_COLORS.phone
                      : (field === 'first_name' || field === 'last_name' || field === 'name') ? FIELD_HIGHLIGHT_COLORS.name
                        : (field === 'address' || field === 'zip') ? FIELD_HIGHLIGHT_COLORS.address
                          : FIELD_HIGHLIGHT_COLORS.probabilistic,
                whiteSpace: 'nowrap',
              }}
            >
              {formatFieldLabel(field)}
            </span>
          ))}
        </div>
      )
    }

    const renderOverallScore = info => {
      const score = info?.score || info?.edgeEvidence?.final_confidence || ''
      if (!score) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>
      return (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--text-primary)' }}>
          {score}
        </span>
      )
    }

    return (
      <div className="data-table-wrapper" style={{ maxHeight: 500, overflow: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(column => (
                <th
                  key={column.key}
                  style={
                    column.key === 'relationship'
                      ? { width: 110, textAlign: 'center' }
                      : column.key === 'matched_fields'
                        ? { minWidth: 170 }
                        : column.key === 'overall_score'
                          ? { width: 120, textAlign: 'center' }
                          : column.key === 'record_count'
                            ? { width: 80, textAlign: 'center' }
                          : {}
                  }
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {selectedTierHasBaseEdge && (
              <tr style={{ background: 'rgba(59,130,246,0.10)', borderLeft: '3px solid var(--accent)' }}>
                {columns.map(column => {
                  if (column.key === 'relationship') {
                    return (
                      <td key={column.key} style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: 10,
                            background: 'rgba(59,130,246,0.15)',
                            color: '#3b82f6',
                            textTransform: 'uppercase',
                            letterSpacing: '0.03em',
                          }}
                        >
                          Base Record
                        </span>
                      </td>
                    )
                  }

                  if (column.key === 'matched_fields') {
                    return (
                      <td key={column.key}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>-</span>
                      </td>
                    )
                  }

                  if (column.key === 'overall_score') {
                    return (
                      <td key={column.key} style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>100</span>
                      </td>
                    )
                  }

                  if (column.key === 'record_count') {
                    return (
                      <td key={column.key} style={{ textAlign: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                          {getCellValue(baseNode, column.key) || 1}
                        </span>
                      </td>
                    )
                  }

                  if (column.key === 'source') {
                    const sourceLabel = sourceLabelForNode(baseNode)
                    return (
                      <td key={column.key}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span
                            style={{
                              display: 'inline-block',
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              background: SOURCE_COLORS[sourceLabel] || '#64748b',
                            }}
                          />
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                            }}
                          >
                            {displaySourceLabelForNode(baseNode)}
                          </div>
                        </div>
                      </td>
                    )
                  }

                  return (
                    <td
                      key={column.key}
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {getCellValue(baseNode, column.key) || '-'}
                    </td>
                  )
                })}
              </tr>
            )}

            {tableRows.map((entry, index) => {
              const node = entry.node
              const info = entry.info
              const tier = edgeTier(info?.edgeEvidence)

              return (
                <tr key={index}>
                  {columns.map(column => {
                    if (column.key === 'relationship') {
                      return (
                        <td key={column.key} style={{ textAlign: 'center' }}>
                          {info ? (
                            <span
                              className="badge"
                              style={{
                                background: `${TIER_COLORS[tier] || '#64748b'}22`,
                                color: TIER_COLORS[tier] || '#64748b',
                              }}
                            >
                              {tier}
                            </span>
                          ) : (
                            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Cluster Member</span>
                          )}
                        </td>
                      )
                    }

                    if (column.key === 'matched_fields') {
                      return (
                        <td key={column.key}>
                          {renderComparedFields(info, entry.comparedFields)}
                        </td>
                      )
                    }

                    if (column.key === 'overall_score') {
                      return (
                        <td key={column.key} style={{ textAlign: 'center' }}>
                          {renderOverallScore(info)}
                        </td>
                      )
                    }

                    if (column.key === 'record_count') {
                      const count = Number(node.grouped_record_count || 1)
                      return (
                        <td key={column.key} style={{ textAlign: 'center' }}>
                          <span
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: count > 1 ? 800 : 500,
                              color: count > 1 ? 'var(--text-primary)' : 'var(--text-muted)',
                            }}
                          >
                            {count}
                          </span>
                        </td>
                      )
                    }

                    if (column.key === 'source') {
                      const sourceLabel = sourceLabelForNode(node)
                      return (
                        <td key={column.key}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span
                              style={{
                                display: 'inline-block',
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                background: SOURCE_COLORS[sourceLabel] || '#64748b',
                              }}
                            />
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                              {displaySourceLabelForNode(node)}
                            </div>
                          </div>
                        </td>
                      )
                    }

                    const value = getCellValue(node, column.key)
                    const isMatched =
                      column.matchKey &&
                      value &&
                      fieldMatchesColumn(entry.comparedFields, column.matchKey)

                    return (
                      <td
                        key={column.key}
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: 13,
                          color: isMatched ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontWeight: isMatched ? 600 : 400,
                          background: isMatched ? highlightColorForColumn(column.matchKey) : 'transparent',
                        }}
                      >
                        {value || '-'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const selectedSourceLabel =
    GRAPH_DATA_SOURCES.find(option => option.value === dataSource)?.label || 'Media & OTT'
  const selectedSourceColor =
    dataSource === 'sports' ? '#f97316' : dataSource === 'automotive' ? '#8b5cf6' : '#3b82f6'

  return (
    <>
      <div className="page-header">
        <h1 className="page-title">ID Graph</h1>
        <p className="page-description">
          Interactive view of identity clusters, match-tier links, and matching evidence
        </p>
      </div>

      <div className="page-body">
        <div
          style={{
            display: 'flex',
            gap: 0,
            marginBottom: 24,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {[
            { id: 'configuration', label: 'Configuration' },
            { id: 'graph', label: 'ID Graph' },
            { id: 'reporting', label: 'ID Graph Reporting' },
            { id: 'golden-records', label: 'Golden Records' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              style={{
                padding: '9px 20px',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                borderBottom:
                  activeSection === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                background: 'transparent',
                color:
                  activeSection === tab.id ? 'var(--accent-light)' : 'var(--text-muted)',
                fontFamily: 'inherit',
                marginBottom: -1,
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeSection === 'configuration' && (
          <ConfigurationTab sourceSystem={dataSource} onPipelineRunSuccess={handlePipelineRunSuccess} />
        )}

        {activeSection === 'graph' && (
          <>
            {stats && (
              <div
                className="kpi-grid"
                style={{
                  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                {[
                  { label: 'Records', value: stats.nodes, cls: 'accent' },
                  { label: 'Match Edges', value: stats.edges, cls: 'success' },
                  { label: 'Sources', value: stats.sources, cls: '' },
                  { label: 'Avg Score', value: stats.avgScore, cls: 'warning' },
                  ...(blockedLinkCount > 0
                    ? [{ label: 'Guardrail Blocked', value: blockedLinkCount, cls: 'warning' }]
                    : []),
                ].map(stat => (
                  <div key={stat.label} className="kpi-card" style={{ padding: '10px 14px' }}>
                    <div className="kpi-label" style={{ fontSize: 10, marginBottom: 2 }}>
                      {stat.label}
                    </div>
                    <div className={`kpi-value ${stat.cls}`} style={{ fontSize: 22 }}>
                      {stat.value}
                    </div>
                  </div>
                ))}

                {graphData?.household_id && (
                  <div className="kpi-card" style={{ padding: '10px 14px' }}>
                    <div className="kpi-label" style={{ fontSize: 10, marginBottom: 2 }}>
                      Household
                    </div>
                    <div
                      className="kpi-value"
                      style={{
                        fontSize: 16,
                        color: '#8b5cf6',
                        fontFamily: 'var(--font-mono)',
                      }}
                    >
                      {graphData.household_id}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div
              className="grid-2 mb-24"
              style={{
                gridTemplateColumns: clusterPanelOpen ? '280px 1fr' : '40px 1fr',
                transition: 'grid-template-columns 0.3s ease',
              }}
            >
              <div
                key={`cluster-panel-${clusterListKey}-${dataSource}`}
                className="card"
                style={{
                  maxHeight: 620,
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'hidden',
                  transition: 'all 0.3s ease',
                }}
              >
                <div
                  className="card-header"
                  style={{
                    justifyContent: clusterPanelOpen ? 'space-between' : 'center',
                    padding: clusterPanelOpen ? undefined : '12px 8px',
                  }}
                >
                  {clusterPanelOpen && <span className="card-title">Clusters</span>}
                  <button
                    onClick={() => setClusterPanelOpen(prev => !prev)}
                    title={clusterPanelOpen ? 'Collapse panel' : 'Expand panel'}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                      padding: 4,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--accent-light)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--text-muted)'
                    }}
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ width: 16, height: 16 }}
                    >
                      {clusterPanelOpen ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
                    </svg>
                  </button>
                </div>

                {clusterPanelOpen && (
                  <>
                    <form
                      onSubmit={e => {
                        e.preventDefault()
                        searchClusters(1, search, dataSource)
                      }}
                      className="search-box mb-16"
                      style={{ maxWidth: '100%' }}
                    >
                      <span className="search-icon">&#128269;</span>
                      <input
                        placeholder="Search cluster, email, name, household..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            searchClusters(1, search, dataSource)
                          }
                        }}
                      />
                    </form>

                    <div ref={clusterListBodyRef} style={{ flex: 1, overflow: 'auto' }}>
                      {clustersError ? (
                        <div
                          role="alert"
                          style={{
                            margin: 8,
                            padding: 12,
                            borderRadius: 8,
                            border: '1px solid rgba(239,68,68,0.35)',
                            background: 'rgba(239,68,68,0.08)',
                            color: '#fca5a5',
                            fontSize: 12,
                            lineHeight: 1.5,
                          }}
                        >
                          <div style={{ fontWeight: 700, marginBottom: 4 }}>ID Graph data is unavailable</div>
                          <div>{clustersError}</div>
                          <button
                            className="btn btn-sm btn-secondary"
                            style={{ marginTop: 10 }}
                            onClick={() => refreshClusters(1, search, dataSource, pageSize)}
                          >
                            Retry
                          </button>
                        </div>
                      ) : clustersLoading && !clusters?.clusters?.length ? (
                        <div className="loading" style={{ padding: 24 }}>
                          <div className="spinner" /> Loading clusters...
                        </div>
                      ) : (
                        clusters?.clusters?.map(cluster => (
                          <div
                            key={`${dataSource}-${cluster.cluster_id}`}
                            onClick={() => loadGraph(cluster.cluster_id, dataSource)}
                            style={{
                              padding: '10px 12px',
                              borderBottom: '1px solid var(--border)',
                              cursor: 'pointer',
                              background:
                                selectedCluster === cluster.cluster_id
                                  ? 'rgba(0,102,204,0.1)'
                                  : 'transparent',
                              borderLeft:
                                selectedCluster === cluster.cluster_id
                                  ? '3px solid var(--accent)'
                                  : '3px solid transparent',
                              opacity: graphLoading && selectedCluster === cluster.cluster_id ? 0.8 : 1,
                            }}
                          >
                            <div className="flex-between">
                              <span
                                style={{
                                  fontWeight: 600,
                                  fontSize: 12,
                                  color: 'var(--accent-light)',
                                }}
                              >
                                {cluster.cluster_id}
                              </span>
                              <span className="badge badge-strong">{cluster.size} records</span>
                            </div>

                            {cluster.golden_id && (
                              <div
                                onClick={e => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(cluster.golden_id)
                                  setCopiedId(cluster.golden_id)
                                  setTimeout(() => {
                                    setCopiedId(prev => (prev === cluster.golden_id ? null : prev))
                                  }, 1500)
                                }}
                                title="Click to copy"
                                style={{
                                  marginTop: 3,
                                  padding: '1px 4px',
                                  marginLeft: -4,
                                  borderRadius: 3,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  background:
                                    copiedId === cluster.golden_id
                                      ? 'rgba(16,185,129,0.12)'
                                      : 'transparent',
                                  transition: 'background 0.4s ease',
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontFamily: 'var(--font-mono)',
                                    color:
                                      copiedId === cluster.golden_id
                                        ? '#10b981'
                                        : 'var(--accent-light)',
                                    transition: 'color 0.4s ease',
                                  }}
                                >
                                  {cluster.golden_id}
                                </span>
                              </div>
                            )}

                            {cluster.household_id && (
                              <div
                                onClick={e => {
                                  e.stopPropagation()
                                  navigator.clipboard.writeText(cluster.household_id)
                                  setCopiedId(cluster.household_id)
                                  setTimeout(() => {
                                    setCopiedId(prev => (prev === cluster.household_id ? null : prev))
                                  }, 1500)
                                }}
                                title="Click to copy"
                                style={{ marginTop: 1, cursor: 'pointer' }}
                              >
                                <span
                                  style={{
                                    fontSize: 10,
                                    fontFamily: 'var(--font-mono)',
                                    padding: '1px 3px',
                                    borderRadius: 3,
                                    color:
                                      copiedId === cluster.household_id ? '#10b981' : '#8b5cf6',
                                    background:
                                      copiedId === cluster.household_id
                                        ? 'rgba(139,92,246,0.12)'
                                        : 'transparent',
                                    transition: 'color 0.4s ease, background 0.4s ease',
                                  }}
                                >
                                  {cluster.household_id}
                                </span>
                              </div>
                            )}

                            {cluster.sample_name && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                                {cluster.sample_name}
                              </div>
                            )}

                            {cluster.sample_email && (
                              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                {cluster.sample_email}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>

                    {clusters && (
                      <div style={{ borderTop: '1px solid var(--border)' }}>
                        <Pagination
                          page={page}
                          totalPages={clusters.pages || 0}
                          pageSize={pageSize}
                          total={clusters.total || 0}
                          onPage={nextPage => {
                            searchClusters(nextPage, search, dataSource)
                          }}
                          onPageSize={size => {
                            setPageSize(size)
                            searchClusters(1, search, dataSource, size)
                          }}
                        />
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="graph-container" style={{ minHeight: 560 }}>
                <div className="graph-legend">
                  {(() => {
                    let activeSources = null

                    if (graphData) {
                      const filteredEdges =
                        relationshipFilter === 'all'
                          ? displayGraphData.edges
                          : displayGraphData.edges.filter(edge => edgeTier(edge) === relationshipFilter)

                      const connectedIds = new Set()
                      filteredEdges.forEach(edge => {
                        connectedIds.add(typeof edge.source === 'object' ? edge.source.id : edge.source)
                        connectedIds.add(typeof edge.target === 'object' ? edge.target.id : edge.target)
                      })

                      const visibleNodes =
                        relationshipFilter === 'all'
                          ? displayGraphData.nodes
                          : displayGraphData.nodes.filter(node => connectedIds.has(node.id))

                      activeSources = new Set(visibleNodes.map(node => sourceLabelForNode(node)))
                    }

                    return Object.entries(SOURCE_COLORS).map(([name, color]) => {
                      const isActive = !activeSources || activeSources.has(name)

                      return (
                        <div key={name} className="legend-item" style={{ opacity: isActive ? 1 : 0.2 }}>
                          <div className="legend-dot" style={{ background: color }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                        </div>
                      )
                    })
                  })()}

                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
                    {MATCH_TYPE_FILTERS.filter(tier => tier !== 'all').map(tier => {
                      const color = TIER_COLORS[tier]
                      return (
                        <div key={tier} className="legend-item">
                          <svg width="30" height="8" style={{ flexShrink: 0 }}>
                            <line
                              x1="1"
                              y1="4"
                              x2="29"
                              y2="4"
                              stroke={color}
                              strokeWidth={TIER_WIDTH[tier] || 2}
                              strokeLinecap="round"
                              strokeDasharray={edgeLineDash({ tier })}
                            />
                          </svg>
                          <span style={{ color: 'var(--text-secondary)' }}>
                            {tier}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {graphData && (
                  <div
                    style={{
                      padding: '10px 16px',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        fontWeight: 600,
                      }}
                    >
                      MATCH TYPE:
                    </span>

                    {MATCH_TYPE_FILTERS.map(relationship => (
                      <button
                        key={relationship}
                        className={`btn btn-sm ${relationshipFilter === relationship ? 'btn-primary' : 'btn-secondary'}`}
                        style={
                          relationship !== 'all' && relationshipFilter !== relationship
                            ? { border: `1px solid ${TIER_COLORS[relationship]}`, color: TIER_COLORS[relationship] }
                            : {}
                        }
                        onClick={() => setRelationshipFilter(relationship)}
                      >
                        {relationship === 'all' ? 'All' : relationship.charAt(0).toUpperCase() + relationship.slice(1)}
                      </button>
                    ))}

                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                      {
                        (displayGraphData?.edges || []).filter(edge => relationshipFilter === 'all' || edgeTier(edge) === relationshipFilter)
                          .length
                      }{' '}
                      edges
                    </span>

                    <div style={{ marginLeft: 'auto', display: 'flex', gap: 0 }}>
                       <button
                        className={`btn btn-sm ${viewMode === 'report' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)', borderLeft: 'none' }}
                        onClick={() => setViewMode('report')}
                      >
                        Report View
                      </button>
                      
                      <button
                        className={`btn btn-sm ${viewMode === 'graph' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ borderRadius: '0 0 0 0' }}
                        onClick={() => setViewMode('graph')}
                      >
                        Graph View
                      </button>
                      <button
                        className={`btn btn-sm ${viewMode === 'detail' ? 'btn-primary' : 'btn-secondary'}`}
                        style={{
                          borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
                          borderLeft: 'none',
                        }}
                        onClick={() => setViewMode('detail')}
                      >
                        Tabular View
                      </button>


                     


                    </div>
                  </div>
                )}

                {graphLoading ? (
                  <div className="loading" style={{ minHeight: 500 }}>
                    <div className="spinner" /> Loading graph...
                  </div>
                ) : graphData ? (

                  viewMode === 'graph' ? (
                    <div style={{ position: 'relative' }}>
                      <svg ref={svgRef} width="100%" height="500" style={{ background: '#080c14' }} />
                      {renderTooltip()}
                      {renderSelectedEdgePanel()}
                    </div>
                  ) : viewMode === 'detail' ? (
                    renderDetailView()
                  ) : (
                    <IDGraph_ReportingChild
                      graphData={displayGraphData || graphData}
                      tierFilter={relationshipFilter}
                      selectedClusterInfo={selectedClusterInfo}
                      sourceLabelForNode={sourceLabelForNode}
                      tierColors={TIER_COLORS}
                    />
                  )
                ) : (

                  <div className="empty-state" style={{ padding: 100 }}>
                    <div className="empty-state-title">Select a cluster</div>
                    <p>Choose a cluster from the list to visualize its identity graph</p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {activeSection === 'reporting' && (
          <IDGraph_ReportingParent
            dataSource={dataSource}
            selectedSourceLabel={selectedSourceLabel}
            selectedSourceColor={selectedSourceColor}
          />
        )}

        {activeSection === 'golden-records' && (
          <GoldenRecords />
        )}
      </div>
    </>
  )
}
