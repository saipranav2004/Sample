/**
 * Identity explorer filters.
 *
 * Every entry maps one-to-one onto a query parameter `GET /api/identities`
 * accepts. Filter state lives in the URL so a drill-through from the posture
 * dashboard, a bookmark and a shared link all produce the same list.
 */
/**
 * `summaryField` names the counter on `GET /api/dashboard/summary` that sizes
 * the facet. Facets with no counterpart counter simply show no number rather
 * than an estimate - `has_credentials` is the only one in that position.
 */
export const FACETS = [
  {
    param: 'without_mfa',
    label: 'No MFA',
    tone: 'critical',
    summaryField: 'total_humans_without_mfa',
    hint: 'Human identities with MFA disabled',
  },
  {
    param: 'is_admin',
    label: 'Admin access',
    tone: 'critical',
    summaryField: 'total_admin',
    hint: 'Administrator-equivalent policy attached',
  },
  {
    param: 'is_stale',
    label: 'Stale 90+ days',
    tone: 'high',
    summaryField: 'total_stale_90plus',
    hint: 'No recorded activity for over 90 days',
  },
  {
    param: 'is_inactive',
    label: 'Inactive 30-90 days',
    tone: 'medium',
    summaryField: 'total_inactive_30plus',
    hint: 'Dormant but not yet stale',
  },
  {
    param: 'is_secret',
    label: 'Secret-backed',
    tone: 'medium',
    summaryField: 'total_secrets',
    hint: 'Credentials stored in a secret store entry',
  },
  {
    param: 'has_credentials',
    label: 'Holds credentials',
    tone: 'info',
    hint: 'Owns at least one key, password or certificate',
  },
  {
    param: 'is_federated',
    label: 'Federated trust',
    tone: 'info',
    summaryField: 'total_federated',
    hint: 'Assumed via SAML or OIDC',
  },
];

export const OWNER_TYPE_OPTIONS = [
  { value: 'HUMAN', label: 'Human owner' },
  { value: 'NHI_CICD', label: 'CI/CD managed' },
  { value: 'NHI_IAC', label: 'IaC managed' },
  { value: 'AWS_SERVICE', label: 'AWS service' },
  { value: 'ORPHANED', label: 'Orphaned' },
];

export const FILTER_PARAMS = [
  'search',
  'classification',
  'identity_type',
  'owner_type',
  ...FACETS.map((facet) => facet.param),
];

/** Reads the explorer's query object out of URL search params. */
export function readFilters(searchParams) {
  const filters = {
    search: searchParams.get('search') || '',
    classification: searchParams.get('classification') || '',
    identityType: searchParams.get('identity_type') || '',
    ownerType: searchParams.get('owner_type') || '',
    page: Number(searchParams.get('page')) || 1,
    pageSize: Number(searchParams.get('page_size')) || 25,
  };

  for (const facet of FACETS) {
    if (searchParams.get(facet.param) === 'true') {
      filters[camel(facet.param)] = 'true';
    }
  }
  return filters;
}

function camel(value) {
  return value.replace(/_([a-z])/g, (_, char) => char.toUpperCase());
}

/** Human-readable chips describing what is currently applied. */
export function describeFilters(searchParams) {
  const chips = [];
  const search = searchParams.get('search');
  if (search) chips.push({ key: 'search', label: 'Search', value: search });

  const classification = searchParams.get('classification');
  if (classification) chips.push({ key: 'classification', label: 'Class', value: classification });

  const identityType = searchParams.get('identity_type');
  if (identityType) chips.push({ key: 'identity_type', label: 'Type', value: identityType });

  const ownerType = searchParams.get('owner_type');
  if (ownerType) {
    const match = OWNER_TYPE_OPTIONS.find((option) => option.value === ownerType);
    chips.push({ key: 'owner_type', label: 'Owner', value: match?.label || ownerType });
  }

  for (const facet of FACETS) {
    if (searchParams.get(facet.param) === 'true') {
      chips.push({ key: facet.param, label: 'Facet', value: facet.label });
    }
  }
  return chips;
}
