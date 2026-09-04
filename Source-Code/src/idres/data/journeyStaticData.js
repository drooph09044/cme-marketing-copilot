// src/data/journeyStaticData.js

/* ---------------------------------- */
/* Journeys (Static Sample Data)      */
/* ---------------------------------- */
export const STATIC_JOURNEYS = [
    {
      id: 'JRN-001',
      name: 'New User Onboarding',
      type: 'Lifecycle',
      active: true,
      run_status: 'running',
      last_run: '5 mins ago',
      owner: 'Growth Team',
      created_at: '2025-11-10',
      audience: 'New registered users',
      goal: 'Drive first meaningful action within 7 days',
      log: 'Processing onboarding steps: welcome email → profile completion → first action nudges.',
    },
    {
      id: 'JRN-002',
      name: 'Abandoned Cart Recovery',
      type: 'Revenue',
      active: true,
      run_status: 'done',
      last_run: 'Today 09:30 AM',
      owner: 'Marketing',
      created_at: '2025-09-18',
      audience: 'Shoppers who left without checkout',
      goal: 'Recover lost carts through reminders and incentives',
      log: 'Cart reminders executed successfully. Checkout conversions tracked and attributed to campaign.',
    },
    {
      id: 'JRN-003',
      name: 'Subscription Renewal Reminder',
      type: 'Revenue',
      active: true,
      run_status: 'idle',
      last_run: '2 days ago',
      owner: 'Retention Ops',
      created_at: '2025-10-05',
      audience: 'Subscribers due for renewal in 7 days',
      goal: 'Increase renewal completion rate',
      log: 'Idle. Waiting for next renewal batch schedule (D-7).',
    },
    {
      id: 'JRN-004',
      name: 'Churn Risk Retention',
      type: 'Retention',
      active: false,
      run_status: 'error',
      last_run: 'Yesterday',
      owner: 'Customer Success',
      created_at: '2025-07-02',
      audience: 'Users flagged as high churn risk',
      goal: 'Reduce churn via re-engagement tactics',
      log: 'Error: webhook delivery failed. Token expired. Update destination credentials.',
    },
  ]
  
  /* ---------------------------------- */
  /* Measurements (Static Sample Data)  */
  /* ---------------------------------- */
  /**
   * Metrics definition:
   * - impressions: eligible audience size
   * - entries: users who entered the journey
   * - completions: users who completed the goal step
   * - drop_off: users who dropped off before completion
   * - avg_time_minutes: avg time spent inside journey
   * - revenue_generated: attributed revenue (if applicable)
   */
  export const STATIC_JOURNEY_MEASUREMENTS = [
    {
      journey_id: 'JRN-001',
      impressions: 12840,
      entries: 8450,
      completions: 6320,
      drop_off: 2130,
      avg_time_minutes: 18.4,
      revenue_generated: 0,
    },
    {
      journey_id: 'JRN-002',
      impressions: 9020,
      entries: 4120,
      completions: 1380,
      drop_off: 2740,
      avg_time_minutes: 6.2,
      revenue_generated: 214500,
    },
    {
      journey_id: 'JRN-003',
      impressions: 5300,
      entries: 2680,
      completions: 1940,
      drop_off: 740,
      avg_time_minutes: 4.8,
      revenue_generated: 129000,
    },
    {
      journey_id: 'JRN-004',
      impressions: 6220,
      entries: 2960,
      completions: 1890,
      drop_off: 1070,
      avg_time_minutes: 12.9,
      revenue_generated: 48500,
    },
  ]
  
  /* ---------------------------------- */
  /* Overview Trend (Totals by Day)     */
  /* ---------------------------------- */
  export const STATIC_MEASUREMENT_TREND = [
    { day: 'Mon', entries: 2680, completions: 1930, drop_off: 750 },
    { day: 'Tue', entries: 2890, completions: 2010, drop_off: 880 },
    { day: 'Wed', entries: 3120, completions: 2260, drop_off: 860 },
    { day: 'Thu', entries: 3410, completions: 2510, drop_off: 900 },
    { day: 'Fri', entries: 3650, completions: 2710, drop_off: 940 },
    { day: 'Sat', entries: 3340, completions: 2450, drop_off: 890 },
    { day: 'Sun', entries: 3010, completions: 2210, drop_off: 800 },
  ]
  
  /* ---------------------------------- */
  /* Detail Trend (Per Journey)         */
  /* ---------------------------------- */
  export const STATIC_JOURNEY_DETAIL_TRENDS = {
    'JRN-001': [
      { day: 'Mon', entries: 1180, completions: 890, drop_off: 290 },
      { day: 'Tue', entries: 1220, completions: 920, drop_off: 300 },
      { day: 'Wed', entries: 1250, completions: 940, drop_off: 310 },
      { day: 'Thu', entries: 1290, completions: 980, drop_off: 310 },
      { day: 'Fri', entries: 1320, completions: 1010, drop_off: 310 },
      { day: 'Sat', entries: 1180, completions: 860, drop_off: 320 },
      { day: 'Sun', entries: 1010, completions: 720, drop_off: 290 },
    ],
    'JRN-002': [
      { day: 'Mon', entries: 520, completions: 170, drop_off: 350 },
      { day: 'Tue', entries: 560, completions: 180, drop_off: 380 },
      { day: 'Wed', entries: 590, completions: 190, drop_off: 400 },
      { day: 'Thu', entries: 620, completions: 220, drop_off: 400 },
      { day: 'Fri', entries: 680, completions: 250, drop_off: 430 },
      { day: 'Sat', entries: 610, completions: 200, drop_off: 410 },
      { day: 'Sun', entries: 540, completions: 170, drop_off: 370 },
    ],
    'JRN-003': [
      { day: 'Mon', entries: 360, completions: 260, drop_off: 100 },
      { day: 'Tue', entries: 370, completions: 270, drop_off: 100 },
      { day: 'Wed', entries: 390, completions: 280, drop_off: 110 },
      { day: 'Thu', entries: 410, completions: 300, drop_off: 110 },
      { day: 'Fri', entries: 430, completions: 320, drop_off: 110 },
      { day: 'Sat', entries: 380, completions: 270, drop_off: 110 },
      { day: 'Sun', entries: 340, completions: 240, drop_off: 100 },
    ],
    'JRN-004': [
      { day: 'Mon', entries: 430, completions: 270, drop_off: 160 },
      { day: 'Tue', entries: 450, completions: 280, drop_off: 170 },
      { day: 'Wed', entries: 470, completions: 300, drop_off: 170 },
      { day: 'Thu', entries: 490, completions: 320, drop_off: 170 },
      { day: 'Fri', entries: 510, completions: 340, drop_off: 170 },
      { day: 'Sat', entries: 470, completions: 300, drop_off: 170 },
      { day: 'Sun', entries: 430, completions: 280, drop_off: 150 },
    ],
  }
  
  /* ---------------------------------- */
  /* Detail Table (Step-level metrics)  */
  /* ---------------------------------- */
  export const STATIC_JOURNEY_STEP_METRICS = {
    'JRN-001': [
      { step: 'Welcome Email', channel: 'Email', audience: 8450, completed: 7420, drop_off: 1030, ctr: '42.8%' },
      { step: 'Profile Completion', channel: 'In-App', audience: 7420, completed: 6840, drop_off: 580, ctr: '61.2%' },
      { step: 'First Action Nudge', channel: 'Push', audience: 6840, completed: 6320, drop_off: 520, ctr: '36.5%' },
    ],
    'JRN-002': [
      { step: 'Cart Reminder 1', channel: 'Email', audience: 4120, completed: 920, drop_off: 3200, ctr: '18.6%' },
      { step: 'Cart Reminder 2', channel: 'SMS', audience: 1850, completed: 340, drop_off: 1510, ctr: '24.1%' },
      { step: 'Discount Incentive', channel: 'Email', audience: 860, completed: 120, drop_off: 740, ctr: '14.8%' },
    ],
    'JRN-003': [
      { step: 'Renewal Reminder', channel: 'Email', audience: 2680, completed: 1610, drop_off: 1070, ctr: '39.7%' },
      { step: 'Plan Benefits Prompt', channel: 'In-App', audience: 1610, completed: 230, drop_off: 1380, ctr: '22.9%' },
      { step: 'Renew Now Push', channel: 'Push', audience: 840, completed: 100, drop_off: 740, ctr: '11.9%' },
    ],
    'JRN-004': [
      { step: 'Risk Alert Email', channel: 'Email', audience: 2960, completed: 1180, drop_off: 1780, ctr: '27.4%' },
      { step: 'Offer Reminder', channel: 'SMS', audience: 1780, completed: 510, drop_off: 1270, ctr: '23.5%' },
      { step: 'CSM Outreach', channel: 'Webhook', audience: 820, completed: 200, drop_off: 620, ctr: '16.2%' },
    ],
  }
  