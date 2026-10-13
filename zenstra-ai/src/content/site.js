/* Site map: one source for the header mega menus, the mobile menu, the footer,
   the router and the prerender step. */

export const CAPABILITIES = [
  { slug: 'agent-discovery', name: 'Agent discovery & inventory', short: 'Every agent, MCP server and connection, found and owned.', icon: 'radar' },
  { slug: 'agent-identity', name: 'Agent identity & access', short: 'An identity and scoped, expiring grants for every agent.', icon: 'key' },
  { slug: 'runtime-enforcement', name: 'Runtime policy enforcement', short: 'Every action decided inline, before it runs.', icon: 'gate' },
  { slug: 'mcp-security', name: 'MCP & tool security', short: 'A gateway in your cloud in front of every tool call.', icon: 'plug' },
  { slug: 'detection-response', name: 'AI detection & response', short: 'Tell a helpful agent from a hijacked one, and contain it.', icon: 'pulse' },
  { slug: 'decision-record', name: 'Decision record & evidence', short: 'A tamper-evident record your auditors can read.', icon: 'ledger' },
];

export const USE_CASE_GROUPS = [
  {
    label: 'By risk',
    items: [
      { slug: 'shadow-ai', name: 'Shadow AI', short: 'Agents and copilots nobody approved.', icon: 'eyeoff' },
      { slug: 'prompt-injection', name: 'Prompt injection', short: 'Hidden instructions in what agents read.', icon: 'inject' },
      { slug: 'tool-poisoning', name: 'Tool poisoning', short: 'Compromised MCP servers and tools.', icon: 'flask' },
      { slug: 'data-leakage', name: 'Data & credential leakage', short: 'Secrets and member data leaving in a call.', icon: 'drop' },
    ],
  },
  {
    label: 'By where agents run',
    items: [
      { slug: 'workflow-agents', name: 'Workflow & no-code agents', short: 'n8n, Zapier, Copilot Studio, LangGraph, CrewAI.', icon: 'flow' },
      { slug: 'cloud-agents', name: 'Cloud & homegrown agents', short: 'Bedrock, Azure OpenAI, Vertex AI and MCP.', icon: 'cloud' },
      { slug: 'coding-agents', name: 'AI coding & desktop agents', short: 'Cursor, Claude Code, Copilot and ChatGPT.', icon: 'laptop' },
    ],
  },
  {
    label: 'By need',
    items: [
      { slug: 'audit-readiness', name: 'Audit & examination readiness', short: 'Evidence an examiner can read, as agents work.', icon: 'check' },
    ],
  },
];

export const USE_CASES = USE_CASE_GROUPS.flatMap((g) => g.items);

export const INDUSTRIES = [
  { to: '/credit-unions', name: 'Credit unions', short: 'Examiner-ready AI governance for credit unions.', icon: 'bank' },
];

export const COMPANY = [
  { to: '/company', name: 'About Zenstra' },
  { to: '/company#leadership', name: 'Leadership' },
  { to: '/company#compliance', name: 'Security & compliance' },
  { to: '/company#contact', name: 'Contact' },
];

export const capabilityPath = (slug) => '/platform/' + slug;
export const useCasePath = (slug) => '/use-cases/' + slug;

/* Every route, with the title and description used for the document head and the
   prerendered HTML. */
export const ROUTES = [
  { path: '/', title: 'Zenstra AI · Runtime security for agentic AI', description: 'Zenstra checks every AI agent action before it runs: across workflows, inside your cloud and on every device. Workflow Security, Cloud Security and Zenstra EDR on one platform.' },
  { path: '/platform', title: 'The Zenstra platform · Zenstra AI', description: 'One policy engine, one agent inventory and one decision record for every AI agent, in your workflows, in your cloud and on every device.' },
  ...CAPABILITIES.map((c) => ({ path: capabilityPath(c.slug), title: c.name.charAt(0).toUpperCase() + c.name.slice(1) + ' · Zenstra AI', description: c.short })),
  ...USE_CASES.map((u) => ({ path: useCasePath(u.slug), title: u.name + ' · Zenstra AI', description: u.short })),
  { path: '/credit-unions', title: 'Zenstra AI for credit unions', description: 'Inventory, scoped access and an examiner-ready record for every AI agent in your credit union: core platforms, copilots, lending, fraud and member service.' },
  { path: '/company', title: 'Company · Zenstra AI', description: 'Zenstra AI is built by Deep Algorithms, an AI-native cybersecurity company headquartered in Hyderabad, with offices in Bangalore and Maryland.' },
  { path: '/demo', title: 'Request a demo · Zenstra AI', description: 'A technical session with a Zenstra security engineer, run against one of your own AI agents.' },
  { path: '/privacy', title: 'Privacy Policy · Zenstra AI', description: 'How Zenstra AI collects, uses and protects information when you visit our website or use the Zenstra AI platform.' },
  { path: '/terms', title: 'Terms of Service · Zenstra AI', description: 'The agreement between you and Zenstra AI governing use of our website, platform and related services.' },
];

export const NOT_FOUND = { path: '/404', title: 'Page not found · Zenstra AI', description: 'The page you were looking for does not exist.' };
