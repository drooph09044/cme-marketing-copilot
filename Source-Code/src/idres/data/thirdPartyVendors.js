export const THIRD_PARTY_VENDOR_REGISTRY = {
  sports: [
    {
      id: 'acxiom',
      name: 'Acxiom',
      matchKeys: ['email_hash', 'address_hash', 'device_id_hash'],
      tableMatchers: ['acxiom'],
      expectedTables: [
        'spt_3p_acxiom_fan_affinity_attributes',
        'sports_3p_acxiom_sports_demographics',
        'spt_3p_acxiom_venue_visit_signals',
      ],
    },
    {
      id: 'infutor',
      name: 'Infutor',
      matchKeys: ['email_hash', 'address_hash'],
      tableMatchers: ['infutor'],
      expectedTables: [
        'spt_3p_infutor_household_identity_enrichment',
      ],
    },
    {
      id: 'nielsen',
      name: 'Nielsen',
      matchKeys: ['email_hash', 'device_id_hash'],
      tableMatchers: ['nielsen', 'neilson'],
      expectedTables: [
        'spt_3p_nielsen_audience_viewing_segments',
      ],
    },
  ],
  telecom: [
    {
      id: 'acxiom',
      name: 'Acxiom',
      matchKeys: ['email_hash', 'address_hash', 'phone_hash'],
      tableMatchers: ['acxiom'],
      expectedTables: [],
    },
    {
      id: 'infutor',
      name: 'Infutor',
      matchKeys: ['email_hash', 'address_hash', 'phone_hash'],
      tableMatchers: ['infutor'],
      expectedTables: [],
    },
    {
      id: 'nielsen',
      name: 'Nielsen',
      matchKeys: ['email_hash', 'device_id_hash'],
      tableMatchers: ['nielsen', 'neilson'],
      expectedTables: [],
    },
  ],
  automotive: [
    {
      id: 'acxiom',
      name: 'Acxiom',
      matchKeys: ['email_hash', 'address_hash', 'phone_hash'],
      tableMatchers: ['acxiom'],
      expectedTables: [],
    },
    {
      id: 'infutor',
      name: 'Infutor',
      matchKeys: ['email_hash', 'address_hash'],
      tableMatchers: ['infutor'],
      expectedTables: [],
    },
    {
      id: 'nielsen',
      name: 'Nielsen',
      matchKeys: ['email_hash', 'device_id_hash'],
      tableMatchers: ['nielsen', 'neilson'],
      expectedTables: [],
    },
  ],
  media: [
    {
      id: 'acxiom',
      name: 'Acxiom',
      matchKeys: ['email_hash', 'address_hash', 'device_id_hash'],
      tableMatchers: ['acxiom'],
      expectedTables: [
        'med_3p_acxiom_household_streaming_enrichment',
        'med_3p_acxiom_content_affinity_segments',
      ],
    },
    {
      id: 'infutor',
      name: 'Infutor',
      matchKeys: ['email_hash', 'address_hash'],
      tableMatchers: ['infutor'],
      expectedTables: [
        'med_3p_infutor_household_identity_enrichment',
      ],
    },
    {
      id: 'nielsen',
      name: 'Nielsen',
      matchKeys: ['email_hash', 'device_id_hash'],
      tableMatchers: ['nielsen', 'neilson'],
      expectedTables: [
        'med_3p_nielsen_audience_viewing_segments',
        'med_3p_nielsen_content_engagement_signals',
      ],
    },
  ],
}
