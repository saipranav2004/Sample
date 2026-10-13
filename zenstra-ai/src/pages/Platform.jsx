import { useRef } from 'react';
import A from '../components/A.jsx';
import Icon from '../components/Icon.jsx';
import VideoTour from '../components/VideoTour.jsx';
import { WorksWith, ScrollPath, ScrollSteps } from '../components/Motion.jsx';
import { usePageFx } from '../lib/usePage.js';
import { PageHero, HeroVisual, Two, Arrow, Proof, Faq, Cta } from '../components/Sections.jsx';
import { CAPABILITIES, capabilityPath, useCasePath } from '../content/site.js';

const LAYERS = [
  { h: 'Discover', p: 'Every agent, tool and MCP server, with an owner.' },
  { h: 'Decide', p: 'Each action checked inline: allow, hold or block.' },
  { h: 'Prove', p: 'Every decision on one tamper-evident record.' },
];

const WAYS = [
  { slug: 'workflow-agents', tag: 'Zenstra Workflow Security', h: 'Every hop in every agent workflow.', p: 'Checks each hop against policy and the task the workflow declared, before the next step runs.', runs: 'n8n, Zapier, LangGraph, CrewAI, Copilot Studio', icon: 'flow' },
  { slug: 'cloud-agents', tag: 'Zenstra Cloud Security', h: 'A gateway inside your cloud.', p: 'Sits in front of every MCP server, model and API your agents call. Payloads never leave your environment.', runs: 'Your VPC on AWS, Azure or Google Cloud', icon: 'cloud' },
  { slug: 'coding-agents', tag: 'Zenstra EDR', h: 'AI on every laptop, contained in seconds.', p: 'Sees the prompt, the tool call and the device together, and stops one agent on one device.', runs: 'Windows and macOS, through Intune, Jamf or Kandji', icon: 'laptop' },
];

const GAPS = [
  { h: 'DLP and CASB', icon: 'drop', p: 'Inspect content and destinations, but not the task an agent was given or the action it planned.' },
  { h: 'EDR and XDR', icon: 'laptop', p: 'See a process read credentials, but cannot tell a helpful coding agent from a hijacked one.' },
  { h: 'IAM and API gateways', icon: 'key', p: 'See a service account, not which agent acted, for whom, or whether the call fits its task.' },
];

export default function Platform() {
  const ref = useRef(null);
  usePageFx(ref);
  return (
    <main id="main" data-page="platform" ref={ref}>
      <PageHero
        eyebrow="The Zenstra platform"
        icon="platform"
        title={['Runtime security', 'for every AI agent.']}
        lede="Zenstra checks every agent action before it runs, across your workflows, inside your cloud and on every device, and records why. Three ways in, one inventory, one policy engine and one decision record."
        roll={{ lead: 'One platform for', words: ['workflow security.', 'cloud security.', 'EDR for AI agents.'] }}
        visual={<HeroVisual shot="overview" chips={[['block', 'Prompt injection blocked', 'member-chat-assist · kb.article #4471'], ['hold', 'Held for approval', 'sar-prep-agent · core.txn.query (90d)'], ['allow', 'Allowed within scope', 'loan-doc-classifier · los.read · 6 ms']]} />}
        secondary={<a href="#capabilities" className="btn secondary lg">Explore capabilities</a>}
      />

      <section className="works-band"><div className="wrap"><WorksWith standalone /></div></section>

      <ScrollSteps
        id="layers"
        h={['Every layer feeds', 'one decision.']}
        p="What an agent can reach, who it acts for and what it was asked to do meet at one decision point."
        steps={LAYERS}
      />

      <section className="sec alt" id="capabilities" aria-labelledby="caps-h">
        <div className="wrap">
          <div className="sec-head split">
            <div style={{ display: 'grid', gap: 20 }}>
              <span className="eyebrow" data-reveal="">Capabilities</span>
              <h2 className="h2" id="caps-h" data-reveal=""><Two t={['Purpose-built for', 'agent security.']} /></h2>
            </div>
            <p className="lede" data-words="">Six capabilities on one policy engine. Start with the one your risk calls for; each shares the same inventory and record.</p>
          </div>
          <div className="capgrid">
            {CAPABILITIES.map((c, i) => (
              <A key={c.slug} to={capabilityPath(c.slug)} className="capcard" data-reveal="" data-delay={(i % 3) * 90}>
                <span className="mm-ic"><Icon name={c.icon} /></span>
                <b>{c.name.charAt(0).toUpperCase() + c.name.slice(1)}</b>
                <small>{c.short}</small>
                <span className="link">Learn more <Arrow /></span>
              </A>
            ))}
          </div>
        </div>
      </section>

      <section className="sec" aria-labelledby="ways-h">
        <div className="wrap">
          <div className="sec-head">
            <span className="eyebrow" data-reveal="">Where agents run</span>
            <h2 className="h2" id="ways-h" data-reveal=""><Two t={['All platforms.', 'Everywhere.']} /></h2>
          </div>
          <div className="ways">
            {WAYS.map((w, i) => (
              <A key={w.slug} to={useCasePath(w.slug)} className="way" data-reveal="" data-delay={i * 100}>
                <span className="way-ic"><Icon name={w.icon} /></span>
                <span className="mono-label">{w.tag}</span>
                <b>{w.h}</b>
                <p>{w.p}</p>
                <small><span className="mono-label">Runs in</span>{w.runs}</small>
                <span className="link">Learn more <Arrow /></span>
              </A>
            ))}
          </div>
        </div>
      </section>

      <section className="sec alt" aria-labelledby="tour-h">
        <div className="wrap">
          <div className="sec-head split">
            <div style={{ display: 'grid', gap: 20 }}>
              <span className="eyebrow" data-reveal="">The console</span>
              <h2 className="h2" id="tour-h" data-reveal=""><Two t={['Your entire agent fleet,', 'on one screen.']} /></h2>
            </div>
            <p className="lede" data-words="">Fleet, detections, investigations and the decision record, where your analysts already triage.</p>
          </div>
          <VideoTour />
        </div>
      </section>

      <ScrollPath
        id="changes"
        eyebrow="What changes"
        h={['What changes when every', 'action is decided.']}
        items={[
          { icon: 'radar', h: 'Every agent, found and owned', p: 'See every agent, tool and MCP server, with an owner for each.' },
          { icon: 'gate', h: 'Risk stopped before runtime', p: 'Scope access and block risky setups before an agent runs.' },
          { icon: 'pulse', h: 'Detections with context', p: 'Prompt, plan and action together, so an alert means something.' },
          { icon: 'bolt', h: 'Contain one agent in seconds', p: 'Stop one agent on one device or flow, not the whole system.' },
          { icon: 'ledger', h: 'Evidence on every decision', p: 'One tamper-evident record your auditors can read.' },
        ]}
      />

      <section className="sec" aria-labelledby="gap-h">
        <div className="wrap">
          <div className="sec-head center">
            <span className="eyebrow" data-reveal="">Why a new layer</span>
            <h2 className="h2" id="gap-h" data-reveal=""><Two t={['Existing tools were not', 'built with agents in mind.']} /></h2>
            <p className="lede" data-words="">Each sees part of what an agent does. None of them sees the task, the plan and the action together, which is where agent risk lives.</p>
          </div>
          <div className="icards">
            {GAPS.map((g, i) => (
              <div className="icard" key={g.h} data-reveal="" data-delay={i * 90}>
                <span className="icard-ic"><Icon name={g.icon} /></span>
                <h3>{g.h}</h3>
                <p>{g.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="sec alt" aria-labelledby="deploy-h">
        <div className="wrap deploy">
          <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
            <span className="eyebrow" data-reveal="">Deployment</span>
            <h2 className="h2" id="deploy-h" data-reveal=""><Two t={['Deploys the way', 'your stack already works.']} /></h2>
            <p className="lede" data-reveal="">No agent rewrite. Prompts and payloads are evaluated inside your environment; only decisions and redacted evidence reach the Zenstra control plane.</p>
          </div>
          <div className="deploy-list" data-reveal="">
            <div><span className="mm-ic"><Icon name="doc" /></span><b>SDK</b><p>For agents your teams build: identity, task and every tool call checked inline.</p></div>
            <div><span className="mm-ic"><Icon name="cloud" /></span><b>Gateway</b><p>In your VPC or Kubernetes cluster, deployed with Helm or Terraform on AWS, Azure or Google Cloud.</p></div>
            <div><span className="mm-ic"><Icon name="laptop" /></span><b>EDR app</b><p>On Windows and macOS, deployed through Intune, Jamf or Kandji.</p></div>
          </div>
        </div>
      </section>

      <Proof />
      <Faq items={[
        { q: 'Which product should we start with?', a: 'The one that matches your first risk: Zenstra EDR for AI on staff devices, Cloud Security for agents calling your systems, or Workflow Security for automations. All three share one console, inventory and record.' },
        { q: 'Do we need to rewrite our agents?', a: 'No. Zenstra works with the agents you already run, through the SDK, the gateway or the EDR app.' },
        { q: 'Where does our data go?', a: 'Prompts and payloads are evaluated inside your environment. Only decisions and redacted evidence reach the Zenstra control plane. The security review pack lists exactly what leaves and what never does.' },
        { q: 'How fast are decisions?', a: '18 ms at p95, inline. If Zenstra is unreachable, actions are held rather than allowed.' },
      ]} />
      <Cta />
    </main>
  );
}
