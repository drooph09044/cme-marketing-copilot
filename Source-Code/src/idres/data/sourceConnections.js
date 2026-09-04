export const SOURCE_TYPE_DEFINITIONS = [
  { id: 'file', label: 'File System', desc: 'Upload CSV, TSV, or flat files from your local machine', ready: true },
  { id: 'warehouse', label: 'Data Warehouse', desc: 'Snowflake, BigQuery, Redshift, Databricks', ready: true },
  { id: 'database', label: 'Database', desc: 'PostgreSQL, MySQL, SQL Server, Oracle', ready: true },
  { id: 'api', label: 'API / Webhook', desc: 'REST APIs, webhooks, event streams', ready: true },
  { id: 'cloud', label: 'Cloud Storage', desc: 'Amazon S3, GCS, Azure Blob, SFTP', ready: true },
  { id: 'crm', label: 'CRM / SaaS', desc: 'Salesforce, HubSpot, Marketo, Segment', ready: false },
  { id: 'streaming', label: 'Streaming', desc: 'Kafka, Kinesis, Pub/Sub', ready: false },
  { id: 'manual', label: 'Manual Entry', desc: 'Define schema and enter records', ready: false },
]

export const CONNECTOR_LIBRARY = {
  warehouse: [
    { id: 'databricks', label: 'Databricks', status: 'active', supportsIngest: true },
  ],
  database: [
    { id: 'postgresql', label: 'PostgreSQL', status: 'active', supportsIngest: true },
    { id: 'mysql', label: 'MySQL', status: 'active', supportsIngest: true },
  ],
  api: [
    { id: 'rest_api', label: 'REST API', status: 'active', supportsIngest: true },
  ],
  cloud: [
    { id: 'azure_blob', label: 'Azure Blob Storage', status: 'active', supportsIngest: true },
    { id: 'amazon_s3', label: 'Amazon S3', status: 'active', supportsIngest: true },
  ],
}

// Temporary registry until Application Settings owns connection management.
// Credentials and workspace identifiers must be supplied through server-side
// runtime configuration; never place them in this browser-delivered module.
export const SAVED_CONNECTIONS = [
  {
    id: 'dbx_marketing_workspace',
    sourceType: 'warehouse',
    connectorId: 'databricks',
    label: 'Databricks - Marketing Workspace',
    configured: true,
    description: 'Uses the Databricks App identity and configured SQL warehouse.',
    config: {
      connection_mode: 'runtime',
    },
  },
  {
    id: 'postgres_primary',
    sourceType: 'database',
    connectorId: 'postgresql',
    label: 'PostgreSQL - Primary',
    configured: false,
    description: 'Enter host, port, database, username, password, and optional sslmode to enable PostgreSQL ingestion.',
    config: {
      host: '',
      port: 5432,
      database: '',
      username: '',
      password: '',
      sslmode: 'prefer',
    },
  },
  {
    id: 'mysql_primary',
    sourceType: 'database',
    connectorId: 'mysql',
    label: 'MySQL - Primary',
    configured: false,
    description: 'Enter host, port, database, username, and password to enable MySQL ingestion.',
    config: {
      host: '',
      port: 3306,
      database: '',
      username: '',
      password: '',
    },
  },
  {
    id: 'rest_customer_api',
    sourceType: 'api',
    connectorId: 'rest_api',
    label: 'REST API - Customer Feed',
    configured: false,
    description: 'Enter base URL, auth type, and optional endpoints/default headers to enable REST API ingestion.',
    config: {
      base_url: '',
      auth_type: 'none',
      api_key: '',
      bearer_token: '',
      username: '',
      password: '',
      default_headers: {},
      endpoints: [
        '/customers',
      ],
    },
  },
  {
    id: 'azure_blob_exports',
    sourceType: 'cloud',
    connectorId: 'azure_blob',
    label: 'Azure Blob - Exports',
    configured: false,
    description: 'Enter container name with either a connection string or account URL + SAS token to enable Azure Blob ingestion.',
    config: {
      container_name: '',
      connection_string: '',
      account_url: '',
      sas_token: '',
      prefix: '',
    },
  },
  {
    id: 's3_loyalty_bucket',
    sourceType: 'cloud',
    connectorId: 'amazon_s3',
    label: 'Amazon S3 - Loyalty Bucket',
    configured: false,
    description: 'Enter bucket, region, access key, secret key, and optional session token/prefix to enable S3 ingestion.',
    config: {
      bucket: '',
      region: '',
      access_key_id: '',
      secret_access_key: '',
      session_token: '',
      prefix: '',
    },
  },
]

export function getConnectorsForSourceType(sourceType) {
  return CONNECTOR_LIBRARY[sourceType] || []
}

export function getSavedConnectionsFor(sourceType, connectorId) {
  return SAVED_CONNECTIONS.filter(
    item => item.sourceType === sourceType && (!connectorId || item.connectorId === connectorId)
  )
}
