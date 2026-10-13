/* Capability and use-case pages. Every page uses the same template (see
   pages/Template.jsx), so the site reads as one system:
     hero → the problem → how Zenstra handles it (tabs) → grid → proof → FAQ → CTA.
   Only claims the product and the rest of the site already make are used here.
   Screens: overview | detections | investigation | agent (full console),
            coverage | grants | kpis | riskiest | run (crops). */

const DECIDE_FACT = 'Decided inline at 18 ms p95, before the action runs. If Zenstra is unreachable, the action is held.';

export const CAPABILITY_PAGES = {
  'agent-discovery': {
    eyebrow: 'Agent discovery & inventory',
    title: ['Every agent you run,', 'found and owned.'],
    lede: 'One living inventory of every AI agent, copilot, MCP server and no-code flow, each with an owner and a scope.',
    roll: { lead: 'Finds agents in', words: ['n8n and Zapier.', 'Copilot Studio.', 'MCP servers.', 'Cursor and Claude Code.'] },
    shot: 'coverage',
    chips: [['hold', 'Unregistered agent found', 'n8n:card-dispute · writes to core'], ['allow', 'Owner assigned', 'sar-prep-agent · Ana Ortiz'], ['block', 'Shadow MCP server', 'laptop-114 · cursor · unapproved']],
    problem: {
      h: ['You cannot govern', 'what you cannot see.'],
      p: 'Agents arrive with the platforms you already use. Most aren’t malicious, just unreviewed, with access nobody tracked.',
      cards: [
        { icon: 'eyeoff', h: 'Built without asking', p: 'No-code flows wire agents into core systems before IT sees them.' },
        { icon: 'key', h: 'Access nobody tracked', p: 'Standing credentials and broad scopes, granted at rollout and never revisited.' },
        { icon: 'user', h: 'No owner on record', p: 'Nobody can say who approved an agent or what it should do.' },
      ],
    },
    how: {
      h: ['From discovery', 'to governed, in one place.'],
      p: 'Discovery is only the first step. Zenstra connects what it finds to an owner, a policy and a record.',
      tabs: [
        { label: 'Discover', h: 'One inventory across every platform', p: 'Zenstra maps agents, tools, MCP servers and connections in workflows, in your cloud and on staff devices, and shows how much of each platform is governed.', feats: ['Coverage by platform: governed versus discovered', 'Every hop in n8n, Zapier, LangGraph and CrewAI', 'AI on Windows and macOS, found by the EDR app'], shot: 'coverage' },
        { label: 'Decide', h: 'An owner and a scope for each agent', p: 'Each agent gets an owner, a declared task and the grants it needs. Agents without an owner are flagged until someone takes them.', feats: ['Highest-risk agents ranked, with the main factor', 'Unregistered agents flagged when they write to core systems', 'Agents without an owner shown on the overview'], shot: 'riskiest' },
        { label: 'Prove', h: 'An inventory your examiner can read', p: 'The inventory is kept current automatically and exported as evidence, with the owner and the platform for every agent.', feats: ['Living inventory, tracked automatically', 'Export as PDF and CSV', 'Every change to an agent on the decision record'], shot: 'overview' },
      ],
    },
    grid: {
      eyebrow: 'What it finds', h: ['Agents hide in', 'six places.'],
      items: [
        { h: 'Core-banking agents', p: 'Agent runtimes inside the core platforms you already operate.' },
        { h: 'Employee copilots', p: 'Microsoft Copilot, ChatGPT and Claude on staff devices.' },
        { h: 'No-code automation', p: 'n8n, Zapier and Copilot Studio flows wired into production systems.' },
        { h: 'Agent frameworks', p: 'LangGraph and CrewAI agents built by your own teams.' },
        { h: 'MCP servers', p: 'Tool servers your agents call, approved or not.' },
        { h: 'Coding agents', p: 'Cursor and Claude Code with access to source and secrets.' },
      ],
    },
    related: [['cap', 'agent-identity'], ['use', 'shadow-ai'], ['use', 'audit-readiness']],
    faq: [
      { q: 'How does Zenstra find agents nobody registered?', a: 'Three ways, by where they run: the gateway sees calls in your cloud, Workflow Security maps automation flows, and the Zenstra EDR app finds AI on Windows and macOS devices.' },
      { q: 'Does discovery need agents to be rewritten?', a: 'No. Discovery and enforcement work with the agents you already have, through the SDK, the gateway or the EDR app.' },
      { q: 'What happens to an agent once it is found?', a: 'It appears in the inventory, is checked against your policy straight away, and stays flagged until it has an owner and a declared scope.' },
    ],
  },

  'agent-identity': {
    eyebrow: 'Agent identity & access',
    title: ['Every agent gets an identity.', 'Every grant expires.'],
    lede: 'Each agent gets a cryptographic identity and scoped, expiring grants instead of standing credentials.',
    roll: { lead: 'Scoped grants for', words: ['AWS Bedrock.', 'Azure OpenAI.', 'Vertex AI.', 'core, LOS and CRM.'] },
    shot: 'grants',
    chips: [['allow', 'Agent identity verified', 'copilot-hr-assist · attested 2 ms ago'], ['block', 'Grant out of scope', 'email.send · domain not approved'], ['hold', 'Step-up requested', 'dev-agent-ci · shell.exec (prod)']],
    problem: {
      h: ['Agents inherit', 'more access than any person.'],
      p: 'Most agents run on a shared service account or a long-lived key that reaches far more than any task needs.',
      cards: [
        { icon: 'key', h: 'Standing credentials', p: 'Keys that never expire, shared by several agents.' },
        { icon: 'layers', h: 'Over-scoped by default', p: 'An agent that answers questions can also write, export and email.' },
        { icon: 'search', h: 'No way to tell agents apart', p: 'Logs show the service account, not which agent acted, or for whom.' },
      ],
    },
    how: {
      h: ['Least privilege,', 'per agent and per call.'],
      p: 'Identity and access are decided by the same policy engine as every other action.',
      tabs: [
        { label: 'Identify', h: 'An identity for every agent', p: 'Each agent is attested when it starts, so every action traces back to one agent and the task it acted for.', feats: ['Cryptographic identity per agent', 'Attestation checked before actions run', 'Revoked the moment access drifts'], shot: 'run' },
        { label: 'Scope', h: 'Grants that fit the task', p: 'Every tool an agent uses becomes a scoped grant: which collection, which member, which queue, and for how long.', feats: ['Per-call and per-session grants', 'Short-lived credentials for Bedrock, Azure OpenAI and Vertex AI', 'Approved destinations for outbound actions'], shot: 'grants' },
        { label: 'Revoke', h: 'One switch across every platform', p: 'Stop one agent everywhere it runs with a single revocation, instead of a switch per vendor.', feats: ['Revocation in seconds', 'Grants listed for your risk register', 'Every grant and revocation on the record'], shot: 'agent' },
      ],
    },
    grid: {
      eyebrow: 'Where it applies', h: ['Every connection becomes', 'a scoped grant.'],
      items: [
        { h: 'Core and lending', p: 'Connectors into core, LOS and CRM become scoped, expiring grants.' },
        { h: 'Model providers', p: 'Per-agent credentials for AWS Bedrock, Azure OpenAI and Vertex AI.' },
        { h: 'MCP tools', p: 'Each MCP tool call checked against the agent’s grant.' },
        { h: 'Memory and knowledge', p: 'Signed writes only, so shared knowledge cannot be poisoned.' },
        { h: 'Outbound actions', p: 'Email and exports limited to approved destinations.' },
        { h: 'Production access', p: 'Shell and deploy actions held for a person to approve.' },
      ],
    },
    related: [['cap', 'runtime-enforcement'], ['cap', 'mcp-security'], ['use', 'data-leakage']],
    faq: [
      { q: 'Do agents need new credentials?', a: 'Zenstra issues short-lived credentials to each agent in place of standing keys. Your existing identity provider stays the source of truth for people.' },
      { q: 'What happens when an agent asks for more than its grant?', a: 'The action is blocked or held for a person to approve, according to your policy, and the decision is recorded with the reason.' },
      { q: 'Can we revoke one agent without breaking others?', a: 'Yes. Each agent has its own identity and grants, so revoking one leaves the rest running.' },
    ],
  },

  'runtime-enforcement': {
    eyebrow: 'Runtime policy enforcement',
    title: ['Every action decided', 'before it runs.'],
    lede: 'One policy engine checks every agent action against identity, task and policy, inline at 18 ms p95. Allowed, held for a person, or blocked.',
    roll: { lead: 'Decides every', words: ['tool call.', 'agent hand-off.', 'MCP request.', 'outbound action.'] },
    shot: 'run',
    chips: [['block', 'Policy enforced', 'n8n:card-dispute · write:core · denied'], ['hold', 'Held for approval', 'sar-prep-agent · core.txn.query (90d)'], ['allow', 'Allowed within scope', 'loan-doc-classifier · los.read · 6 ms']],
    problem: {
      h: ['Agents act faster', 'than your controls.'],
      p: 'Alerts arrive after the money moved and the data left. For agents, a control that reports later is a control that was too late.',
      cards: [
        { icon: 'clock', h: 'After the fact', p: 'Logs and alerts describe what an agent already did.' },
        { icon: 'doc', h: 'Policy on paper', p: 'Acceptable-use policies written as PDFs that no agent can read.' },
        { icon: 'layers', h: 'One rulebook per vendor', p: 'Every platform has its own switches, and none of them agree.' },
      ],
    },
    how: {
      h: ['Your policy,', 'enforced as code.'],
      p: DECIDE_FACT,
      tabs: [
        { label: 'Check', h: 'Identity, task and policy together', p: 'Each action is checked against who the agent is, what it was asked to do and what your policy allows.', feats: ['Inline decision, 18 ms at p95', 'Intent checked against the declared task', 'Agent-to-agent hand-offs checked against the original task'], shot: 'run' },
        { label: 'Decide', h: 'Allow, hold or block', p: 'Routine actions pass. Sensitive ones wait for a person. Anything outside policy is stopped, and the agent continues safely where it can.', feats: ['Hold payments and production changes for approval', 'Block data leaving to unapproved destinations', 'Fails closed: if Zenstra is unreachable, actions are held'], shot: 'detections' },
        { label: 'Record', h: 'Why, for every decision', p: 'Every decision lands on the record with the policy version that made it, so you can show what was allowed and why.', feats: ['Policy version on every entry', 'Approvals recorded with who and when', 'Tamper-evident, chained record'], shot: 'investigation' },
      ],
    },
    grid: {
      eyebrow: 'What policies cover', h: ['Write the rule once.', 'It holds everywhere.'],
      items: [
        { h: 'Task scope', p: 'deny tool.call when outside(task.scope).' },
        { h: 'Human approval', p: 'hold payments.* for human approval.' },
        { h: 'Member data', p: 'allow crm.read for the member in the task only.' },
        { h: 'Outbound data', p: 'Block email and exports to unapproved destinations.' },
        { h: 'Production access', p: 'Step-up before shell or deploy actions in production.' },
        { h: 'Acceptable use', p: 'Your AI acceptable-use policy as enforced code, not a PDF.' },
      ],
    },
    related: [['cap', 'decision-record'], ['use', 'prompt-injection'], ['use', 'workflow-agents']],
    faq: [
      { q: 'Does enforcement slow agents down?', a: 'Decisions are made inline at 18 ms at p95, well inside the time a model call takes.' },
      { q: 'What happens if Zenstra is unavailable?', a: 'It fails closed: actions are held rather than allowed, so an outage never becomes an open door.' },
      { q: 'Do we have to rewrite our agents?', a: 'No. Enforcement sits in front of the agents you have, through the SDK, the gateway in your cloud or the EDR app.' },
    ],
  },

  'mcp-security': {
    eyebrow: 'MCP & tool security',
    title: ['A gateway in your cloud', 'for every tool call.'],
    lede: 'A gateway in your VPC sits in front of every MCP server, model and API your agents call. Payloads never leave your environment.',
    roll: { lead: 'Deployed with', words: ['Helm.', 'Terraform.', 'AWS.', 'Azure and Google Cloud.'] },
    shot: 'grants',
    chips: [['block', 'Tool not in grant', 'mcp core-banking · accounts.transfer'], ['block', 'Poisoned tool description', 'mcp kb-sync · instruction quarantined'], ['allow', 'Allowed within scope', 'kb.search · member-faq · 4 ms']],
    problem: {
      h: ['Every tool is', 'a way in.'],
      p: 'MCP made it easy to give agents tools. It also gave attackers a place to hide instructions, widen access or pull data out.',
      cards: [
        { icon: 'flask', h: 'Poisoned tools', p: 'A tool description or result carries instructions the agent follows.' },
        { icon: 'key', h: 'Over-scoped keys', p: 'One MCP server key reaches far more than any task needs.' },
        { icon: 'cloud', h: 'Data leaving your cloud', p: 'Payloads sent to tools and models outside your environment.' },
      ],
    },
    how: {
      h: ['Inspect, scope and stop', 'inside your own cloud.'],
      p: 'The gateway is the decision point for every call your agents make to tools, models and APIs.',
      tabs: [
        { label: 'Inspect', h: 'Every call, inside your VPC', p: 'The gateway sees each MCP, model and API call before it leaves the agent, without sending prompts or payloads anywhere else.', feats: ['Deployed with Helm or Terraform', 'Runs in AWS, Azure or Google Cloud', 'Only decisions and redacted evidence reach the control plane'], shot: 'run' },
        { label: 'Scope', h: 'Each tool becomes a grant', p: 'A tool call is checked against the agent’s grant: which tool, which scope, for how long.', feats: ['Per-agent identity for every call', 'Short-lived grants for model providers', 'Unapproved MCP servers flagged'], shot: 'grants' },
        { label: 'Stop', h: 'Blocked before it lands', p: 'Calls outside the grant, poisoned tool content and data leaving for unapproved destinations are stopped inline.', feats: ['Decisions at 18 ms p95', 'Fails closed if unreachable', 'Every block on the decision record'], shot: 'detections' },
      ],
    },
    grid: {
      eyebrow: 'What it stops', h: ['The attacks that', 'come through tools.'],
      items: [
        { h: 'Tool poisoning', p: 'Instructions hidden in tool descriptions and results.' },
        { h: 'Over-scoped calls', p: 'A transfer when the task only allowed a read.' },
        { h: 'Rogue MCP servers', p: 'Tool servers nobody approved, found and blocked.' },
        { h: 'Data exfiltration', p: 'Payloads headed for destinations outside policy.' },
        { h: 'Credential misuse', p: 'Standing keys replaced by per-agent, expiring grants.' },
        { h: 'Model sprawl', p: 'Calls to unapproved models and endpoints.' },
      ],
    },
    related: [['use', 'tool-poisoning'], ['use', 'cloud-agents'], ['cap', 'agent-identity']],
    faq: [
      { q: 'Where does the gateway run?', a: 'In your environment: your VPC or Kubernetes cluster on AWS, Azure or Google Cloud, deployed with Helm or Terraform.' },
      { q: 'Does any data leave our cloud?', a: 'Prompts and payloads are evaluated inside your environment. Only decisions and redacted evidence reach the Zenstra control plane.' },
      { q: 'Does it work with MCP servers we did not build?', a: 'Yes. The gateway sits in front of the servers your agents call, whoever built them.' },
    ],
  },

  'detection-response': {
    eyebrow: 'AI detection & response',
    title: ['Tell a helpful agent', 'from a hijacked one.'],
    lede: 'Classic EDR can’t tell a helpful coding agent from a hijacked one. Zenstra sees the prompt, the tool call and the device together, and contains one agent in seconds.',
    roll: { lead: 'Watches', words: ['Copilot.', 'ChatGPT.', 'Claude Code.', 'Cursor.'] },
    shot: 'investigation',
    chips: [['block', 'Shadow agent contained', 'cursor · laptop-114 · unregistered MCP'], ['block', 'Prompt injection blocked', 'member-chat-assist · kb.article #4471'], ['hold', 'Investigation opened', 'copilot-hr-assist · poisoned document']],
    problem: {
      h: ['Agent attacks look like', 'normal work.'],
      p: 'A hijacked agent uses the same tools, credentials and device as a helpful one. Without the prompt, every alert is a guess.',
      cards: [
        { icon: 'eyeoff', h: 'No context', p: 'Endpoint tools see processes and files, not prompts and intent.' },
        { icon: 'bolt', h: 'Too much noise', p: 'Every agent action looks unusual to tools built for people.' },
        { icon: 'clock', h: 'Slow containment', p: 'Isolating a whole device to stop one agent stops the person too.' },
      ],
    },
    how: {
      h: ['Detect with context.', 'Respond in seconds.'],
      p: 'Prompt-to-action lineage connects what the agent read, what it planned and what it tried to do.',
      tabs: [
        { label: 'Detect', h: 'Lineage, not noise', p: 'Each detection links the input that caused it, the action the agent planned and the policy that caught it, ranked by severity.', feats: ['Detections ranked by severity', 'The agent and the policy that caught each one', 'Prompt-to-action lineage'], shot: 'detections' },
        { label: 'Investigate', h: 'Start from the outcome', p: 'Investigations open on what happened, the blast radius and the agent run, step by step, with the excerpt that caused it.', feats: ['Replay the agent run', 'Blast radius across agents', 'The retrieved excerpt that carried the attack'], shot: 'investigation' },
        { label: 'Contain', h: 'One agent, one device', p: 'Stop the agent without isolating the laptop, so the person keeps working while the agent is contained.', feats: ['Contain in seconds', 'Windows and macOS', 'Deployed with Intune, Jamf or Kandji'], shot: 'agent' },
      ],
    },
    grid: {
      eyebrow: 'What it catches', h: ['Real agent attack', 'scenarios.'],
      items: [
        { h: 'Prompt injection', p: 'Hidden instructions in documents, email and web pages.' },
        { h: 'Data exfiltration', p: 'Agents sending records to destinations outside the task.' },
        { h: 'Credential access', p: 'Coding agents reading secrets they were never given.' },
        { h: 'Agent-to-agent spread', p: 'Injected instructions passed from one agent to the next.' },
        { h: 'Memory poisoning', p: 'Shared knowledge altered to steer future sessions.' },
        { h: 'Shadow AI', p: 'Unregistered agents and MCP servers on staff devices.' },
      ],
    },
    related: [['use', 'coding-agents'], ['use', 'prompt-injection'], ['cap', 'decision-record']],
    faq: [
      { q: 'Does it replace our EDR?', a: 'No. It works alongside it. Your EDR protects the device; Zenstra EDR understands the AI agents running on it.' },
      { q: 'How is it deployed?', a: 'As an app on Windows and macOS, through your existing device management: Intune, Jamf or Kandji.' },
      { q: 'Which AI tools does it cover?', a: 'Copilot, ChatGPT, Claude Code, Cursor and agents nobody registered.' },
    ],
  },

  'decision-record': {
    eyebrow: 'Decision record & evidence',
    title: ['Every decision,', 'on one record.'],
    lede: 'Every decision Zenstra makes lands on one tamper-evident record, each entry chained to the one before it. Export it as evidence.',
    roll: { lead: 'Ready for', words: ['your auditors.', 'your examiner.', 'your board.', 'incident review.'] },
    shot: 'overview',
    chips: [['allow', 'Hash chain verified', 'ledger · 1.2M entries'], ['hold', 'Approval recorded', 'payments.* · approved by J. Rao'], ['block', 'Decision recorded', 'POL-114 v7 · member-data-egress']],
    problem: {
      h: ['“Show me what it did”', 'should take minutes.'],
      p: 'When an examiner asks what an agent did, the answer sits in vendor logs that disagree and can’t prove they weren’t changed.',
      cards: [
        { icon: 'layers', h: 'Logs spread across vendors', p: 'Each platform keeps its own partial history.' },
        { icon: 'doc', h: 'Only the flagged events', p: 'Most logs keep alerts, not every decision.' },
        { icon: 'lock', h: 'No proof of integrity', p: 'A log that can be edited is not evidence.' },
      ],
    },
    how: {
      h: ['A record built', 'for examination.'],
      p: 'The record is produced as agents work, not assembled before an audit.',
      tabs: [
        { label: 'Record', h: 'Every action, not just alerts', p: 'Allowed actions are recorded alongside the blocks and the holds, with the agent, the task and the policy version.', feats: ['Every decision, every agent', 'Policy version on every entry', 'Approvals with who, when and why'], shot: 'investigation' },
        { label: 'Verify', h: 'Tamper-evident by design', p: 'Each entry is chained to the one before it. Change one and the chain breaks, so the record proves its own integrity.', feats: ['Hash-chained entries', 'Chain verified on export', 'Approvals and policy versions in order'], shot: 'run' },
        { label: 'Export', h: 'Evidence in the format asked for', p: 'Export the inventory, the grants, the approvals and the decisions for an audit, an exam or an incident review.', feats: ['PDF and CSV export', 'Examination pack generated on demand', 'Mapped to how examiners ask questions'], shot: 'overview' },
      ],
    },
    grid: {
      eyebrow: 'What the record answers', h: ['The questions', 'examiners ask.'],
      items: [
        { h: 'Which agents do you run?', p: 'Every agent, one inventory, with an owner.' },
        { h: 'Who approved it?', p: 'A recorded review before production.' },
        { h: 'What can each one reach?', p: 'Scoped, expiring grants, listed.' },
        { h: 'How do you stop one?', p: 'One revocation, in seconds, on the record.' },
        { h: 'Show me what it did.', p: 'One tamper-evident record of every decision.' },
        { h: 'What changed, and when?', p: 'Policy versions and approvals, in order.' },
      ],
    },
    related: [['use', 'audit-readiness'], ['cap', 'runtime-enforcement'], ['ind', 'credit-unions']],
    faq: [
      { q: 'Is every action recorded, or only blocks?', a: 'Every decision: allowed actions, holds and blocks.' },
      { q: 'How do we know the record was not changed?', a: 'Each entry is chained to the one before it, so altering any entry breaks the chain and the change shows when the chain is verified.' },
      { q: 'Can we export it for an exam?', a: 'Yes. The examination pack exports the inventory, grants, approvals and decision ledger as PDF and CSV.' },
    ],
  },
};

export const USE_CASE_PAGES = {
  'shadow-ai': {
    eyebrow: 'Shadow AI',
    title: ['Shadow AI is', 'a governance gap, not a mystery.'],
    lede: 'Staff use AI nobody approved, and no-code flows wire agents into core systems unseen. Zenstra finds them and brings each under policy, with an owner.',
    roll: { lead: 'Found in', words: ['browser copilots.', 'no-code flows.', 'coding assistants.', 'unapproved MCP servers.'] },
    shot: 'riskiest',
    chips: [['hold', 'Unregistered agent found', 'n8n:card-dispute · no owner'], ['block', 'Shadow agent contained', 'cursor · laptop-114 · unregistered MCP'], ['allow', 'Agent brought under policy', 'copilot-hr-assist · owner assigned']],
    problem: {
      h: ['The same agent', 'nobody told security about.'],
      p: 'Shadow AI is rarely malicious. It is an agent nobody reviewed, running with access nobody tracked, often already handling sensitive data.',
      cards: [
        { icon: 'laptop', h: 'On staff devices', p: 'Copilots and chat tools used with member and company data.' },
        { icon: 'flow', h: 'In automation tools', p: 'No-code flows writing to core systems with standing access.' },
        { icon: 'plug', h: 'Behind the scenes', p: 'MCP servers added to coding agents without review.' },
      ],
    },
    how: {
      h: ['Find it, govern it,', 'prove it.'],
      p: 'Closing shadow AI isn’t about finding more tools. It’s bringing each one under policy the moment it’s found.',
      tabs: [
        { label: 'Find', h: 'Everything that is running', p: 'The EDR app finds AI on staff devices, Workflow Security maps automation flows and the gateway sees calls in your cloud.', feats: ['AI tools and agents on Windows and macOS', 'No-code flows in n8n, Zapier and Copilot Studio', 'Unapproved MCP servers'], shot: 'coverage' },
        { label: 'Govern', h: 'The same policy, immediately', p: 'A newly found agent is checked against your acceptable-use policy straight away, not left in a holding pattern.', feats: ['Acceptable-use policy as enforced code', 'Agents without an owner flagged', 'Contain one agent on one device'], shot: 'riskiest' },
        { label: 'Prove', h: 'Found before an examiner finds it', p: 'The inventory and every decision about each agent are on the record, ready to export.', feats: ['Living inventory', 'Owner and scope for every agent', 'Exportable evidence'], shot: 'overview' },
      ],
    },
    grid: {
      eyebrow: 'Common shadow AI', h: ['Where it', 'usually starts.'],
      items: [
        { h: 'Employee copilots', p: 'Often the first agentic tools live, usually before a policy exists.' },
        { h: 'Secrets pasted into AI', p: 'Credentials and member data shared with chat tools.' },
        { h: 'No-code agents', p: 'Card-dispute, SAR-prep and lending flows built outside IT.' },
        { h: 'Coding assistants', p: 'Cursor and Claude Code with access to source and keys.' },
        { h: 'Unapproved MCP servers', p: 'Tool servers added to agents without review.' },
        { h: 'Vendor-shipped agents', p: 'Agent runtimes that arrived with a platform update.' },
      ],
    },
    related: [['cap', 'agent-discovery'], ['use', 'coding-agents'], ['cap', 'detection-response']],
    faq: [
      { q: 'Do we have to block AI tools to control shadow AI?', a: 'No. Zenstra lets you allow the tools your policy permits and govern how they are used, instead of a blanket ban that pushes use further out of sight.' },
      { q: 'How quickly does a new agent appear?', a: 'As soon as it is seen by the EDR app, the gateway or Workflow Security, it is added to the inventory and checked against policy.' },
      { q: 'Which product finds it?', a: 'Zenstra EDR finds AI on devices, Workflow Security finds automation flows and Cloud Security sees calls in your cloud. All three share one inventory.' },
    ],
  },

  'prompt-injection': {
    eyebrow: 'Prompt injection',
    title: ['Hidden instructions,', 'stopped before the tool runs.'],
    lede: 'An agent reads a document, email or web page carrying hidden instructions. Zenstra checks the action it then plans against its task, and blocks it before anything leaves.',
    roll: { lead: 'Hidden in', words: ['retrieved documents.', 'inbound email.', 'web pages.', 'tool results.'] },
    shot: 'run',
    chips: [['block', 'Prompt injection blocked', 'member-chat-assist · kb.article #4471'], ['block', 'Intent check failed', 'email.send · not in declared task'], ['allow', 'Safe answer returned', 'quarantined span removed']],
    problem: {
      h: ['The model looks fine.', 'The action is the problem.'],
      p: 'Injection doesn’t need to break the model. It only needs one action outside the task, using access the agent already has.',
      cards: [
        { icon: 'doc', h: 'Indirect injection', p: 'Instructions planted in content the agent retrieves.' },
        { icon: 'flow', h: 'Spreads between agents', p: 'An injected instruction handed from one agent to the next.' },
        { icon: 'drop', h: 'Ends in exfiltration', p: 'The usual goal is data sent somewhere it should not go.' },
      ],
    },
    how: {
      h: ['Judge the action,', 'not just the prompt.'],
      p: 'Screening inputs helps. Checking every planned action against the declared task is what stops the attack.',
      tabs: [
        { label: 'Screen', h: 'Suspicious content quarantined', p: 'Retrieved content is screened, and the span carrying instructions is quarantined before the agent acts on it.', feats: ['Injection screening on retrieved content', 'Quarantined spans shown in the run', 'Member chat and voice agents isolated from malicious input'], shot: 'run' },
        { label: 'Check intent', h: 'Is this action part of the task?', p: 'Each planned action is compared with the task the agent declared. An outbound email in a fee question fails the intent check.', feats: ['Declared task versus planned action', 'Agent-to-agent hand-offs checked against the original task', 'Decision in 18 ms at p95'], shot: 'detections' },
        { label: 'Block & record', h: 'Stopped, explained, kept', p: 'The action is blocked by policy, the agent continues safely where it can, and the run is recorded for investigation.', feats: ['Blocked before the tool runs', 'Safe answer still returned to the member', 'Full run on the decision record'], shot: 'investigation' },
      ],
    },
    grid: {
      eyebrow: 'Attack scenarios', h: ['How injection', 'reaches agents.'],
      items: [
        { h: 'Poisoned knowledge base', p: 'A policy document carrying a “system note” for the assistant.' },
        { h: 'Malicious email', p: 'An inbound message that tells an email agent to forward data.' },
        { h: 'Web content', p: 'A page that instructs a browsing agent to change its task.' },
        { h: 'Tool results', p: 'An MCP tool that returns instructions alongside data.' },
        { h: 'Agent hand-offs', p: 'One compromised agent instructing another.' },
        { h: 'Shared memory', p: 'Instructions written into memory for later sessions.' },
      ],
    },
    related: [['cap', 'runtime-enforcement'], ['use', 'data-leakage'], ['cap', 'detection-response']],
    faq: [
      { q: 'Can prompt injection be fully filtered at the input?', a: 'Not reliably. Zenstra screens inputs and, more importantly, checks every planned action against the declared task, so an injected instruction cannot turn into an action outside it.' },
      { q: 'Does the member still get an answer?', a: 'Yes. The unsafe action is blocked and the agent continues without the quarantined content.' },
      { q: 'Can we see what the attack looked like?', a: 'Yes. The run shows the retrieved excerpt, the planned action, the intent check and the policy that blocked it.' },
    ],
  },

  'tool-poisoning': {
    eyebrow: 'Tool poisoning',
    title: ['Compromised tools,', 'contained at the gateway.'],
    lede: 'A tool server can hide instructions in its descriptions and results. Zenstra’s gateway checks every MCP and API call against the agent’s grant, inside your cloud.',
    roll: { lead: 'Checks every', words: ['MCP server.', 'tool description.', 'tool result.', 'API call.'] },
    shot: 'grants',
    chips: [['block', 'Tool not in grant', 'mcp core-banking · accounts.transfer'], ['block', 'Instruction in tool result', 'mcp kb-sync · quarantined'], ['hold', 'New MCP server', 'awaiting review · laptop-114']],
    problem: {
      h: ['Agents trust', 'their tools.'],
      p: 'An agent follows what its tools tell it. Poison one tool and every agent using it takes orders from someone else.',
      cards: [
        { icon: 'flask', h: 'Poisoned descriptions', p: 'Instructions hidden in how a tool describes itself.' },
        { icon: 'plug', h: 'Rogue servers', p: 'An MCP server added without review, or quietly replaced.' },
        { icon: 'key', h: 'Over-scoped tools', p: 'A tool that can transfer when the task needed a read.' },
      ],
    },
    how: {
      h: ['Every tool call', 'checked against a grant.'],
      p: 'The gateway in your VPC is the decision point between agents and the tools they use.',
      tabs: [
        { label: 'Inventory', h: 'Know every tool server', p: 'MCP servers in use are inventoried, and new ones are flagged for review.', feats: ['Every MCP server agents call', 'Unapproved servers flagged', 'Coverage shown per platform'], shot: 'coverage' },
        { label: 'Scope', h: 'Tools as scoped grants', p: 'Each tool is a grant with a scope and an expiry. A call outside it is blocked, whatever the tool says.', feats: ['Scope per tool and per agent', 'Per-call and per-session expiry', 'Signed writes to memory'], shot: 'grants' },
        { label: 'Contain', h: 'Stopped inside your cloud', p: 'Tool content carrying instructions is quarantined and the call is blocked before data moves.', feats: ['Gateway in your VPC or Kubernetes cluster', 'Payloads never leave your environment', 'Every block on the record'], shot: 'detections' },
      ],
    },
    grid: {
      eyebrow: 'Attack scenarios', h: ['How tools', 'get turned.'],
      items: [
        { h: 'Description injection', p: 'A tool’s description tells agents to do more than they should.' },
        { h: 'Result injection', p: 'Data returned with instructions mixed in.' },
        { h: 'Server swap', p: 'A trusted server replaced by one that behaves differently.' },
        { h: 'Scope creep', p: 'A tool that gains write or transfer abilities over time.' },
        { h: 'Unreviewed servers', p: 'MCP servers added to coding agents on a laptop.' },
        { h: 'Memory writes', p: 'Tools writing unsigned content into shared memory.' },
      ],
    },
    related: [['cap', 'mcp-security'], ['use', 'cloud-agents'], ['use', 'prompt-injection']],
    faq: [
      { q: 'What is tool poisoning?', a: 'An attack where a tool an agent uses, such as an MCP server, carries instructions or behaviour that turns the agent against its task.' },
      { q: 'Where is it stopped?', a: 'At the Zenstra gateway in your cloud, and on devices by Zenstra EDR for MCP servers added to local coding agents.' },
      { q: 'Do we need to vet every MCP server ourselves?', a: 'Zenstra inventories them and checks every call against a grant, so a server you have not vetted cannot reach beyond what the task allows.' },
    ],
  },

  'data-leakage': {
    eyebrow: 'Data & credential leakage',
    title: ['Member data and secrets', 'stay where they belong.'],
    lede: 'Agents move data as part of their work, and that is how it leaks. Zenstra decides each email, export and model call before it runs.',
    roll: { lead: 'Stops leaks through', words: ['email.', 'exports.', 'model calls.', 'coding agents.'] },
    shot: 'run',
    chips: [['block', 'Member data egress blocked', 'POL-114 · email.send · external'], ['block', 'Secret access contained', 'laptop-114 · cursor · read ~/.aws'], ['allow', 'Read within scope', 'crm.read · member in task']],
    problem: {
      h: ['Leaks look like', 'ordinary actions.'],
      p: 'Sending an email, exporting a file and calling a model are normal actions. Whether they leak depends on task, data and destination.',
      cards: [
        { icon: 'drop', h: 'Member data', p: 'Account references sent outside the institution.' },
        { icon: 'key', h: 'Credentials', p: 'Keys and secrets read or pasted into AI tools.' },
        { icon: 'cloud', h: 'Payloads to models', p: 'Sensitive prompts sent to unapproved endpoints.' },
      ],
    },
    how: {
      h: ['Task, data and destination,', 'checked together.'],
      p: DECIDE_FACT,
      tabs: [
        { label: 'Scope', h: 'Only the data the task needs', p: 'Reads are limited to the member and the records in the task, through scoped, expiring grants.', feats: ['Read the requesting member only', 'Per-call grants', 'Signed writes only'], shot: 'grants' },
        { label: 'Stop', h: 'Egress decided before it happens', p: 'Outbound actions are checked against approved destinations and the declared task, and blocked when they do not fit.', feats: ['Approved destinations for email and export', 'Intent check on outbound actions', 'Secrets access contained on devices'], shot: 'run' },
        { label: 'Prove', h: 'What left, and what never did', p: 'The record shows every outbound decision, and the security review pack lists what reaches the control plane.', feats: ['Every egress decision recorded', 'Payloads stay in your environment', 'Redacted evidence only'], shot: 'investigation' },
      ],
    },
    grid: {
      eyebrow: 'Leak paths', h: ['Where data', 'escapes.'],
      items: [
        { h: 'Outbound email', p: 'Agents asked, or tricked, into emailing records.' },
        { h: 'Exports and reports', p: 'Files generated with more data than requested.' },
        { h: 'Model calls', p: 'Sensitive prompts sent to unapproved models.' },
        { h: 'Secrets on devices', p: 'Coding agents reading cloud keys and tokens.' },
        { h: 'Pasted into AI', p: 'Staff pasting secrets and member data into chat tools.' },
        { h: 'Agent hand-offs', p: 'Data passed to another agent outside the task.' },
      ],
    },
    related: [['use', 'prompt-injection'], ['cap', 'agent-identity'], ['use', 'coding-agents']],
    faq: [
      { q: 'Is this a DLP product?', a: 'No. DLP inspects content; Zenstra decides agent actions with the context of the task, the agent and the destination. They work well together.' },
      { q: 'Where is data evaluated?', a: 'Inside your environment. Only decisions and redacted evidence reach the Zenstra control plane.' },
      { q: 'Does it cover secrets on laptops?', a: 'Yes. Zenstra EDR contains coding agents that try to read secrets they were never given.' },
    ],
  },

  'workflow-agents': {
    eyebrow: 'Workflow & no-code agents',
    title: ['Every hop in every workflow,', 'decided.'],
    lede: 'Multi-agent pipelines fail one hop at a time. Zenstra Workflow Security checks each hop against policy and the task the workflow declared, before the next step runs.',
    roll: { lead: 'Runs in', words: ['n8n.', 'Zapier.', 'Copilot Studio.', 'LangGraph and CrewAI.'] },
    shot: 'riskiest',
    chips: [['block', 'Policy enforced', 'n8n:card-dispute · write:core · denied'], ['block', 'Hop blocked', 'hop 7 · crm.export → outside email'], ['allow', 'Hand-off within task', 'intake-agent → triage-agent']],
    problem: {
      h: ['One bad hop', 'and the whole flow follows.'],
      p: 'Workflows chain agents, tools and MCP calls. An injected instruction at one step travels to the next.',
      cards: [
        { icon: 'flow', h: 'Built outside IT', p: 'No-code flows wired into core systems without review.' },
        { icon: 'inject', h: 'Spreads between agents', p: 'Injected instructions passed along every hand-off.' },
        { icon: 'key', h: 'Standing access', p: 'Flows running on keys with far more reach than any step needs.' },
      ],
    },
    how: {
      h: ['Map the flow.', 'Decide every hop.'],
      p: 'Workflow Security sees the whole graph and decides each step before it executes.',
      tabs: [
        { label: 'Map', h: 'The workflow graph', p: 'Every agent, tool and MCP hop in n8n, Zapier, LangGraph and CrewAI, mapped and given an owner.', feats: ['Every hop mapped', 'Owners for every flow', 'Unregistered flows flagged'], shot: 'coverage' },
        { label: 'Decide', h: 'Per-hop decisions', p: 'Each hop is allowed, held for a person or blocked before the next step executes.', feats: ['Allow, hold or block per hop', 'Intent across agents', 'Decisions at 18 ms p95'], shot: 'riskiest' },
        { label: 'Record', h: 'The run, step by step', p: 'Every hop and decision is on the record, so a failed flow can be replayed and explained.', feats: ['Replay any run', 'Policy version per decision', 'Tamper-evident record'], shot: 'investigation' },
      ],
    },
    grid: {
      eyebrow: 'Where it runs', h: ['Built for', 'the tools teams use.'],
      items: [
        { h: 'n8n', p: 'Self-hosted and cloud workflows with agent steps.' },
        { h: 'Zapier', p: 'Automations that call AI and write to business systems.' },
        { h: 'Copilot Studio', p: 'Agents built by business users inside Microsoft 365.' },
        { h: 'LangGraph', p: 'Graph-based agents your engineers build and run.' },
        { h: 'CrewAI', p: 'Multi-agent crews with hand-offs between roles.' },
        { h: 'MCP', p: 'Tool calls made from any step in the flow.' },
      ],
    },
    related: [['cap', 'runtime-enforcement'], ['use', 'prompt-injection'], ['use', 'shadow-ai']],
    faq: [
      { q: 'Do we need to change our workflows?', a: 'No. Workflow Security works with the flows you have; there is no agent rewrite.' },
      { q: 'What does a held hop look like?', a: 'The workflow pauses at that step until a person approves or rejects it, and the decision is recorded.' },
      { q: 'Does it see agent-to-agent hand-offs?', a: 'Yes. Each hand-off is checked against the original task, so an injected instruction cannot ride along.' },
    ],
  },

  'cloud-agents': {
    eyebrow: 'Cloud & homegrown agents',
    title: ['Runtime protection,', 'inside your cloud.'],
    lede: 'Agents built on AWS Bedrock, Azure OpenAI and Vertex AI call models, MCP servers and internal APIs. Zenstra decides those calls at a gateway in your VPC; payloads never leave.',
    roll: { lead: 'Built on', words: ['AWS Bedrock.', 'Azure OpenAI.', 'Vertex AI.', 'Kubernetes.'] },
    shot: 'grants',
    chips: [['block', 'Tool not in grant', 'mcp core-banking · accounts.transfer'], ['allow', 'Short-lived grant issued', 'loan-doc-classifier · Bedrock · 15 min'], ['hold', 'Held for approval', 'payments.* · human approval']],
    problem: {
      h: ['Your agents reach', 'your most sensitive systems.'],
      p: 'Homegrown agents are built to do real work: read accounts, update cases, move money. That makes every call they make a decision worth checking.',
      cards: [
        { icon: 'key', h: 'Over-scoped credentials', p: 'Model and API keys shared across agents and environments.' },
        { icon: 'plug', h: 'Tools everywhere', p: 'MCP servers and internal APIs added faster than reviews.' },
        { icon: 'cloud', h: 'Data residency', p: 'Prompts and payloads that must not leave your cloud.' },
      ],
    },
    how: {
      h: ['A decision point', 'in your own environment.'],
      p: 'The gateway runs where your agents run, in front of every model, MCP server and API.',
      tabs: [
        { label: 'Deploy', h: 'In your VPC, your way', p: 'Deploy the gateway with Helm or Terraform in AWS, Azure or Google Cloud, in your VPC or Kubernetes cluster.', feats: ['Helm or Terraform', 'AWS, Azure or Google Cloud', 'No agent rewrite'], shot: 'run' },
        { label: 'Scope', h: 'Per-agent identity and grants', p: 'Each agent gets its own identity and short-lived grants for the models and tools it uses.', feats: ['Scoped credentials for Bedrock, Azure OpenAI and Vertex AI', 'Per-call and per-session grants', 'Revocation in seconds'], shot: 'grants' },
        { label: 'Decide', h: 'Fail-closed, fast', p: 'Every call is decided at 18 ms p95. If Zenstra is unreachable, actions are held.', feats: ['Inline decisions', 'Fails closed', 'Every decision on the record'], shot: 'detections' },
      ],
    },
    grid: {
      eyebrow: 'What it protects', h: ['Every call', 'your agents make.'],
      items: [
        { h: 'Model calls', p: 'Bedrock, Azure OpenAI and Vertex AI, per-agent credentials.' },
        { h: 'MCP servers', p: 'Each tool call checked against the agent’s grant.' },
        { h: 'Internal APIs', p: 'Core, LOS and CRM connectors as scoped grants.' },
        { h: 'Payments', p: 'Held for a person to approve, by policy.' },
        { h: 'Outbound data', p: 'Approved destinations only.' },
        { h: 'Agent identity', p: 'Attested before actions run.' },
      ],
    },
    related: [['cap', 'mcp-security'], ['cap', 'agent-identity'], ['use', 'tool-poisoning']],
    faq: [
      { q: 'Does the gateway add latency?', a: 'Decisions are made at 18 ms at p95, inline with the call.' },
      { q: 'What reaches the Zenstra control plane?', a: 'Only decisions and redacted evidence. Prompts and payloads stay in your environment.' },
      { q: 'Which clouds are supported?', a: 'AWS, Azure and Google Cloud, deployed in your VPC or Kubernetes cluster.' },
    ],
  },

  'coding-agents': {
    eyebrow: 'AI coding & desktop agents',
    title: ['AI on every laptop,', 'contained in seconds.'],
    lede: 'Copilot, ChatGPT, Claude Code and Cursor work with source code, credentials and production access on staff devices. Zenstra EDR sees the prompt, the tool call and the device together.',
    roll: { lead: 'Covers', words: ['Cursor.', 'Claude Code.', 'Copilot.', 'ChatGPT.'] },
    shot: 'agent',
    chips: [['block', 'Shadow agent contained', 'cursor · laptop-114 · unregistered MCP'], ['block', 'Secret access blocked', 'claude-code · read ~/.aws'], ['hold', 'Step-up requested', 'dev-agent-ci · shell.exec (prod)']],
    problem: {
      h: ['Coding agents hold', 'the keys to production.'],
      p: 'A coding agent can read secrets, run shell commands and push changes. Hijacked, it does all that with the developer’s own access.',
      cards: [
        { icon: 'key', h: 'Secrets on disk', p: 'Cloud keys and tokens a coding agent can read.' },
        { icon: 'plug', h: 'Local MCP servers', p: 'Tools added to agents on a laptop without review.' },
        { icon: 'eyeoff', h: 'Invisible to EDR', p: 'Endpoint tools see a process, not what the agent intended.' },
      ],
    },
    how: {
      h: ['Device, prompt and action,', 'seen together.'],
      p: 'Zenstra EDR runs on Windows and macOS and is deployed through your device management.',
      tabs: [
        { label: 'See', h: 'Every AI on every device', p: 'Copilot, ChatGPT, Claude Code, Cursor and agents nobody registered, found on Windows and macOS.', feats: ['AI tools and agents inventoried', 'Local MCP servers found', 'Deployed with Intune, Jamf or Kandji'], shot: 'coverage' },
        { label: 'Understand', h: 'Help or hijack?', p: 'Prompt-to-action lineage connects what the agent read to what it tried to do, so a helpful agent is not treated like a hijacked one.', feats: ['Prompt-to-action lineage', 'Ranked detections', 'Context, not noise'], shot: 'detections' },
        { label: 'Contain', h: 'One agent, one device', p: 'Stop the agent and keep the laptop working. The developer carries on while the agent is contained.', feats: ['Containment in seconds', 'Step-up for production actions', 'Every action on the record'], shot: 'agent' },
      ],
    },
    grid: {
      eyebrow: 'What it stops', h: ['Risks that start', 'on a laptop.'],
      items: [
        { h: 'Hijacked coding agents', p: 'Injected instructions in a repo or issue.' },
        { h: 'Secrets read by AI', p: 'Agents reading ~/.aws, tokens and env files.' },
        { h: 'Secrets pasted into AI', p: 'Staff sharing keys and data with chat tools.' },
        { h: 'Rogue MCP servers', p: 'Unreviewed tools added to local agents.' },
        { h: 'Production shell access', p: 'Shell and deploy actions held for step-up.' },
        { h: 'Shadow AI', p: 'Unregistered agents on staff devices.' },
      ],
    },
    related: [['cap', 'detection-response'], ['use', 'shadow-ai'], ['use', 'data-leakage']],
    faq: [
      { q: 'Will developers notice it?', a: 'Routine work is allowed inline. Only actions outside policy are held or blocked, with a clear reason.' },
      { q: 'Which operating systems?', a: 'Windows and macOS, deployed with Intune, Jamf or Kandji.' },
      { q: 'Does it replace our EDR?', a: 'No. It complements it by understanding the AI agents on the device.' },
    ],
  },

  'audit-readiness': {
    eyebrow: 'Audit & examination readiness',
    title: ['Ready for the examiner’s', 'first question.'],
    lede: 'Examiners check that you run safely and know what your vendors do. Zenstra creates that proof for AI agents as they work.',
    roll: { lead: 'Evidence for', words: ['your examiner.', 'internal audit.', 'your board.', 'vendor reviews.'] },
    shot: 'overview',
    chips: [['allow', 'Examination pack ready', 'Q3 2026 · PDF + CSV'], ['allow', 'Hash chain verified', 'ledger · 1.2M entries'], ['hold', 'Review recorded', 'sar-prep-agent · approved before production']],
    problem: {
      h: ['Vendor defaults are not', 'institutional governance.'],
      p: 'Platforms describe what an agent can do, not what your institution should allow, who owns the risk or how drift is caught.',
      cards: [
        { icon: 'layers', h: 'Spread across vendors', p: 'Each platform holds part of the story.' },
        { icon: 'doc', h: 'Policy written once', p: 'A policy written at rollout and never enforced.' },
        { icon: 'clock', h: 'Assembled at audit time', p: 'Evidence gathered by hand, weeks after the fact.' },
      ],
    },
    how: {
      h: ['Proof produced', 'as agents work.'],
      p: 'Every control runs inline, before a tool call executes, not reported after the damage is done.',
      tabs: [
        { label: 'Inventory', h: 'Every agent, with an owner', p: 'A living inventory of every agent and connection, tracked automatically.', feats: ['Agent inventory with owners', 'Coverage by platform', 'Agents without owners flagged'], shot: 'coverage' },
        { label: 'Access', h: 'Least privilege, proven', p: 'Least-privilege proof generated as grants are issued, with expiry and last use.', feats: ['Scoped, expiring grants', 'Approvals recorded', 'Revocation on the record'], shot: 'grants' },
        { label: 'Record', h: 'A complete, exportable record', p: 'Every action, not just the flagged ones, on a tamper-evident record ready to export.', feats: ['Examination pack', 'PDF and CSV export', 'Hash chain verified'], shot: 'overview' },
      ],
    },
    grid: {
      eyebrow: 'The questions examiners ask', h: ['Answers on record,', 'not in a spreadsheet.'],
      items: [
        { h: 'Which agents do you run?', p: 'Every agent, one inventory.' },
        { h: 'Who approved it?', p: 'A recorded review before production.' },
        { h: 'What can each one reach?', p: 'Scoped, expiring grants.' },
        { h: 'How do you stop one?', p: 'One revocation, in seconds.' },
        { h: 'Show me what it did.', p: 'One tamper-evident record.' },
        { h: 'How do you catch drift?', p: 'Continuous checks against policy.' },
      ],
    },
    related: [['ind', 'credit-unions'], ['cap', 'decision-record'], ['cap', 'agent-discovery']],
    faq: [
      { q: 'Is there a separate rulebook for AI?', a: 'Examiners apply the expectations you already meet. Zenstra produces the evidence those expectations call for, for your AI agents.' },
      { q: 'What does the examination pack contain?', a: 'The agent inventory, least-privilege grants, recorded approvals and the verified decision ledger, as PDF and CSV.' },
      { q: 'How is Zenstra itself audited?', a: 'Independent audits every year, with reports under NDA: SOC 2 Type II, ISO/IEC 27001, 42001 and 27701.' },
    ],
  },
};
