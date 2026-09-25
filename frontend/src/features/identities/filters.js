import { ACTOR_CATEGORIES, ACTOR_CATEGORY_ORDER, actorTypeMeta } from '../../lib/domain';

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

/**
 * Actor category, as a facet.
 *
 * This is the filter that replaced "identity type", which used to offer
 * IAM_ROLE and IAM_USER - two credential kinds, not two kinds of identity. A
 * category here is what the actor IS: compute, a pipeline, an agent, a data
 * job, a vendor platform outside the account.
 */
export const ACTOR_CATEGORY_OPTIONS = ACTOR_CATEGORY_ORDER.filter((value) => value !== 'HUMAN').map((value) => ({
  value,
  label: ACTOR_CATEGORIES[value],
}));

export const OWNER_TYPE_OPTIONS = [
  /* Where the owner was resolved from - the values discovery records. */
  { value: 'TAG_OWNER', label: 'Owner tag' },
  { value: 'TEAM_TAG', label: 'Team tag' },
  { value: 'CLOUDTRAIL_CREATOR', label: 'Creator, from CloudTrail' },
  { value: 'ORPHANED', label: 'Orphaned' },
];

export const FILTER_PARAMS = [
  'search',
  'classification',
  'actor_category',
  'identity_type',
  'owner_type',
  ...FACETS.map((facet) => facet.param),
];

/** Reads the explorer's query object out of URL search params. */
export function readFilters(searchParams) {
  const filters = {
    search: searchParams.get('search') || '',
    classification: searchParams.get('classification') || '',
    actorCategory: searchParams.get('actor_category') || '',
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

  const actorCategory = searchParams.get('actor_category');
  if (actorCategory) {
    chips.push({ key: 'actor_category', label: 'Actor', value: ACTOR_CATEGORIES[actorCategory] || actorCategory });
  }

  const identityType = searchParams.get('identity_type');
  if (identityType) {
    chips.push({ key: 'identity_type', label: 'Actor type', value: actorTypeMeta(identityType).label });
  }

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
