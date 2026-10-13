import { useRef } from 'react';
import A from '../components/A.jsx';
import { usePageFx } from '../lib/usePage.js';
import Intro from '../components/Intro.jsx';
import { VideoButton } from '../components/VideoTour.jsx';
import UseCaseGrid from '../components/UseCaseGrid.jsx';
import { useCore } from '../lib/usePage.js';

export default function Home() {
  const ref = useRef(null);
  usePageFx(ref);
  useCore(ref);
  return (
      <>
        <Intro />
        <main id="main" data-page="home" ref={ref}>
        <section className="hero rails" aria-labelledby="hero-h">
        <div className="lens" data-cx="0.68" data-cy="0.48" aria-hidden="true"></div>
        <div className="wrap hero-grid">
        <div className="hero-copy" data-lens-mask="">
        <h1 className="display" id="hero-h" data-scan=""><span className="scanline"><span className="in">Your AI agents</span><i className="bar"></i></span><span className="scanline"><span className="in">act on their own.</span><i className="bar"></i></span><span className="scanline"><span className="in grad">Give them a perimeter.</span><i className="bar"></i></span></h1>
        <p className="lede sub" data-after="">Zenstra checks every agent action before it runs, across your workflows, inside your cloud and on every device, and records why.</p>
        <p className="switch" data-after=""><span className="muted" aria-hidden="true">One platform for</span>{" "}<span className="slot" data-switch="workflow security.|cloud security.|EDR for AI agents." aria-hidden="true">workflow security.</span><span className="sr-only">One platform for workflow security, cloud security and EDR for AI agents.</span></p>
        <div className="ctas" data-after=""><a href="#products" className="btn primary lg">Explore the platform</a><a href="#core" className="btn secondary lg">Inside the Zenstra core</a></div>
        </div>
        <div className="hero-side" aria-hidden="true">
        <div className="dchips"><div className="dchip" style={{ top: "10%", left: "0" }}></div><div className="dchip" style={{ top: "42%", left: "22%" }}></div><div className="dchip" style={{ top: "74%", left: "4%" }}></div></div>
        </div>
        </div>
        <div className="wrap">
        <div className="works" data-after="">
        <span className="mono-label">Works with</span>
        <p className="sr-only">Works with Microsoft Copilot, ChatGPT Enterprise, Claude, Gemini, Model Context Protocol, n8n, Zapier, LangGraph, CrewAI, AWS Bedrock, Azure OpenAI, Vertex AI, Fiserv, Jack Henry, Temenos.</p><div className="marquee" aria-hidden="true"><div className="marquee-track"><span>Microsoft Copilot</span><span>ChatGPT Enterprise</span><span>Claude</span><span>Gemini</span><span>MCP</span><span>n8n</span><span>Zapier</span><span>LangGraph</span><span>CrewAI</span><span>AWS Bedrock</span><span>Azure OpenAI</span><span>Vertex AI</span><span>Fiserv</span><span>Jack Henry</span><span>Temenos</span><span>Microsoft Copilot</span><span>ChatGPT Enterprise</span><span>Claude</span><span>Gemini</span><span>MCP</span><span>n8n</span><span>Zapier</span><span>LangGraph</span><span>CrewAI</span><span>AWS Bedrock</span><span>Azure OpenAI</span><span>Vertex AI</span><span>Fiserv</span><span>Jack Henry</span><span>Temenos</span></div></div>
        </div>
        </div>
        </section>
        <section className="sec rails" id="products" aria-labelledby="prod-h">
        <i className="xmark" style={{ top: "-6px", left: "max(14px,calc(50% - 646px))" }}></i><i className="xmark" style={{ top: "-6px", right: "max(14px,calc(50% - 646px))" }}></i>
        <div className="wrap">
        <div className="sec-head split">
        <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">The platform</span><h2 className="h2" id="prod-h" data-reveal="">One platform.<br />Three ways in.</h2></div>
        <p className="lede" data-words="">Start with the risk in front of you. Every product shares one agent inventory, one policy engine and one decision record.</p>
        </div>
        <div className="products" data-reveal="">
        <article className="prod" id="workflow" data-viz="workflow" tabIndex="0" aria-expanded="false" aria-label="Workflow Security">
        <div className="viz" aria-hidden="true"></div><i className="timer" aria-hidden="true"></i>
        <div className="prod-top"><span className="num">01</span><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="3" cy="4" r="1.6"></circle><circle cx="13" cy="4" r="1.6"></circle><circle cx="8" cy="12" r="1.6"></circle><path d="M4.6 4h6.8M3.8 5.4l3.4 5.2M12.2 5.4 8.8 10.6"></path></svg></span></div>
        <div className="prod-vt" aria-hidden="true">Workflow<br />Security</div>
        <div className="prod-body">
        <span className="mono-label" style={{ color: "#5cd2ff" }}>Zenstra Workflow Security</span>
        <h3>Every hop in every agent workflow,{" "}<span>decided.</span></h3>
        <p>Multi-agent pipelines fail one hop at a time. Zenstra checks each hop against policy and the task the workflow declared, before the next step runs.</p>
        <ul><li><b>Workflow graph</b>Every agent, tool and MCP hop in n8n, Zapier, LangGraph and CrewAI, mapped and owned.</li><li><b>Per-hop decisions</b>Allow, hold for a person, or block before the next step executes.</li><li><b>Intent across agents</b>Agent-to-agent hand-offs checked against the original task.</li></ul>
        </div>
        </article>
        <article className="prod" id="cloud" data-viz="cloud" tabIndex="0" aria-expanded="false" aria-label="Cloud Security">
        <div className="viz" aria-hidden="true"></div><i className="timer" aria-hidden="true"></i>
        <div className="prod-top"><span className="num">02</span><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 12.5h7a3 3 0 0 0 .3-6A4 4 0 0 0 4.2 6 3.3 3.3 0 0 0 4.5 12.5Z"></path></svg></span></div>
        <div className="prod-vt" aria-hidden="true">Cloud<br />Security</div>
        <div className="prod-body">
        <span className="mono-label" style={{ color: "#5cd2ff" }}>Zenstra Cloud Security</span>
        <h3>Runtime protection,{" "}<span>inside your cloud.</span></h3>
        <p>A gateway in your VPC or Kubernetes cluster sits in front of every MCP server, model and API your agents call. Payloads never leave your environment.</p>
        <ul><li><b>Gateway for MCP and APIs</b>Deployed with Helm or Terraform in AWS, Azure or Google Cloud.</li><li><b>Scoped credentials</b>Per-agent identity and short-lived grants for Bedrock, Azure OpenAI and Vertex AI.</li><li><b>Fail-closed, fast</b>Decisions at 18 ms p95. If Zenstra is unreachable, actions are held.</li></ul>
        </div>
        </article>
        <article className="prod" id="edr" data-viz="edr" tabIndex="0" aria-expanded="false" aria-label="Zenstra EDR">
        <div className="viz" aria-hidden="true"></div><i className="timer" aria-hidden="true"></i>
        <div className="prod-top"><span className="num">03</span><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2M2 8h12"></path></svg></span></div>
        <div className="prod-vt" aria-hidden="true">Zenstra<br />EDR</div>
        <div className="prod-body">
        <span className="mono-label" style={{ color: "#5cd2ff" }}>Zenstra EDR</span>
        <h3>Endpoint detection and response{" "}<span>for AI agents.</span></h3>
        <p>Classic EDR sees a coding agent read credentials and cannot tell help from hijack. Zenstra EDR sees the prompt, the tool call and the device together.</p>
        <ul><li><b>Every AI, every device</b>Copilot, ChatGPT, Claude Code, Cursor and unregistered agents on Windows and macOS.</li><li><b>Context, not noise</b>Prompt-to-action lineage tells a helpful agent from a hijacked one.</li><li><b>Contain in seconds</b>Stop one agent on one device. Deployed with Intune, Jamf or Kandji.</li></ul>
        </div>
        </article>
        </div>
        </div>
        </section>
        <section className="core" id="core" data-core="" aria-labelledby="core-h">
        <div className="wrap core-head">
        <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">Inside the Zenstra core</span><h2 className="h2" id="core-h" data-reveal="">One engine.<br />Every agent, everywhere it runs.</h2></div>
        <p className="lede" data-reveal="">Agents work inside workflows, in your cloud and on every laptop. Take the core apart to see where each attack is stopped, and what lands on the record.</p>
        </div>
        <div className="core-track">
        <div className="core-pin">
        <div className="core-stage">
        <canvas aria-hidden="true"></canvas>
        <div className="core-labels" aria-hidden="true">
        <span className="core-label"><b>Policy engine</b><small>Decides in 18 ms</small></span>
        <span className="core-label"><b>Workflow Security</b><small>Stops injected hand-offs</small></span>
        <span className="core-label"><b>Cloud Security</b><small>Payloads stay in your VPC</small></span>
        <span className="core-label"><b>Zenstra EDR</b><small>Contains hijacked agents</small></span>
        <span className="core-label"><b>Decision record</b><small>Tamper-evident</small></span>
        </div>
        </div>
        <div className="core-cards">
        <article className="core-card pos-tl on" data-name="The exposure"><div className="cc"><span className="cc-n">01 · The exposure</span><h3>Agents act faster than your controls.</h3><p>They read documents, call tools and move data inside workflows, in your cloud and on every laptop. The same few attacks reach all three.</p><div className="cc-tags threat"><span>Prompt injection</span><span>Tool poisoning</span><span>Credential leakage</span><span>Shadow AI</span></div></div></article>
        <article className="core-card pos-br" data-name="One policy engine"><div className="cc"><span className="cc-n">02 · One policy engine</span><h3>One engine decides every action.</h3><p>Each action is checked against the agent’s identity, the task it was given and your policy, inline, before it runs.</p><pre className="cc-code"><span><b>{"deny"}</b>{"  tool.call   when outside(task.scope)"}</span><span><b>{"hold"}</b>{"  payments.*  for human approval"}</span><span><b>{"allow"}</b>{" crm.read    for member in task"}</span></pre><p className="cc-facts">Inline · p95 18 ms · Fails closed</p></div></article>
        <article className="core-card pos-br" data-name="Workflow Security"><div className="cc"><span className="cc-n">03 · Workflow Security</span><h3>Every hop, checked against its task.</h3><dl className="cc-rows"><div><dt>Runs in</dt><dd>n8n, Zapier, LangGraph, CrewAI, Copilot Studio</dd></div><div><dt>Checks</dt><dd>Every hop and agent-to-agent hand-off</dd></div><div><dt>Stops</dt><dd>Injected instructions spreading between agents</dd></div></dl><p className="cc-dec"><span className="vd2 bad">Block</span><code>hop 7 · crm.export → outside email · not in task</code></p></div></article>
        <article className="core-card pos-tl" data-name="Cloud Security"><div className="cc"><span className="cc-n">04 · Cloud Security</span><h3>A gateway inside your cloud.</h3><dl className="cc-rows"><div><dt>Runs in</dt><dd>Your VPC on AWS, Azure or Google Cloud</dd></div><div><dt>Checks</dt><dd>Every MCP, model and API call against the agent’s grant</dd></div><div><dt>Stops</dt><dd>Tool poisoning, over-scoped keys, data leaving your cloud</dd></div></dl><p className="cc-dec"><span className="vd2 bad">Block</span><code>mcp core-banking · accounts.transfer · not in grant</code></p><p className="cc-facts">Prompts and payloads never leave your VPC</p></div></article>
        <article className="core-card pos-br" data-name="Zenstra EDR"><div className="cc"><span className="cc-n">05 · Zenstra EDR</span><h3>AI on every laptop, contained in seconds.</h3><dl className="cc-rows"><div><dt>Runs on</dt><dd>Windows and macOS, through Intune, Jamf or Kandji</dd></div><div><dt>Checks</dt><dd>Copilot, ChatGPT, Claude Code and Cursor: prompt, tool call and device together</dd></div><div><dt>Stops</dt><dd>Hijacked coding agents, secrets pasted into AI, shadow AI</dd></div></dl><p className="cc-dec"><span className="vd2 bad">Block</span><code>laptop-114 · cursor · read ~/.aws · session contained</code></p></div></article>
        <article className="core-card pos-tr" data-name="The record"><div className="cc"><span className="cc-n">06 · The record</span><h3>Every decision, on one record.</h3><p>Each entry is chained to the one before it, so any change shows. Export it as evidence for your auditors and examiners.</p><pre className="cc-code ledger"><span>{"#48213  "}<i className="b">{"block"}</i>{"  POL-114 v7   prev 9f2c…a71e"}</span><span>{"#48214  "}<i className="h">{"hold"}</i>{"   POL-021 v3   prev c07a…5d12"}</span><span>{"#48215  "}<i className="a">{"allow"}</i>{"  POL-003 v12  prev 4be1…09c3"}</span></pre><p className="cc-facts">Inline · p95 18 ms · Fails closed · No agent rewrite</p><a href="#console" className="cc-link">See it in the console{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></a></div></article>
        </div>
        <div className="core-hud" aria-hidden="true"><span data-core-n="">01 / 06</span><span data-core-t="">The exposure</span><i></i></div>
        </div>
        </div>
        </section>
        <section className="sec" id="console" data-show="" aria-labelledby="con-h">
        <div className="wrap">
        <div className="sec-head split">
        <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">The console</span><h2 className="h2" id="con-h" data-reveal="">Your entire agent fleet,<br />on one screen.</h2></div>
        <p className="lede" data-words="">Fleet, detections, investigations and the decision record, where your analysts already triage.</p>
        </div>
        <div className="show-grid">
        <div className="show-tabs" role="tablist" aria-label="Console screens" aria-orientation="vertical" data-reveal="">
        <button className="show-tab" role="tab" aria-selected="true" data-cap="Governed agents, open detections, blocked actions and approvals waiting."><b>Overview</b><span>Governed agents, open detections, blocked actions and approvals waiting.</span><i></i></button>
        <button className="show-tab" role="tab" aria-selected="false" data-cap="Detections ranked by severity, with the agent and the policy that caught them."><b>Detections</b><span>Detections ranked by severity, with the agent and the policy that caught them.</span><i></i></button>
        <button className="show-tab" role="tab" aria-selected="false" data-cap="An investigation that opens on the outcome, the blast radius and the agent run."><b>Investigation</b><span>An investigation that opens on the outcome, the blast radius and the agent run.</span><i></i></button>
        <button className="show-tab" role="tab" aria-selected="false" data-cap="One agent's identity, grants, baseline and history."><b>Agent profile</b><span>One agent's identity, grants, baseline and history.</span><i></i></button>
        </div>
        <div className="show-stage" data-reveal="">
        <div className="show-frame">
        <div className="show-bar"><i></i><i></i><i></i><span>console.zenstra.ai</span><span className="live">Live</span></div>
        <div className="show-view">
        <div className="show-slide"><img className="th-light" src="/img/screen-overview-light.webp" alt="Console overview with governed agents, detections, blocked actions and approvals" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-overview-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
        <div className="show-slide"><img className="th-light" src="/img/screen-detections-light.webp" alt="Detections queue ranked by severity" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-detections-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
        <div className="show-slide"><img className="th-light" src="/img/screen-investigation-light.webp" alt="Investigation showing outcome, blast radius and the agent run" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-investigation-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
        <div className="show-slide"><img className="th-light" src="/img/screen-agent-light.webp" alt="Agent profile with identity, grants and behavior baseline" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-agent-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
        <i className="show-scan" aria-hidden="true"></i>
        <VideoButton />
        </div>
        </div>
        </div>
        <div className="show-caption"><span data-caption="" aria-live="polite"></span></div>
        </div>
        </div>
        </section>
        <section aria-label="Zenstra in numbers" style={{ paddingBottom: "clamp(64px,7vw,104px)" }}>
        <div className="wrap">
        <div className="figures">
        <div className="fig" data-reveal=""><b><span data-count="18">18</span><small>ms</small></b><span>p95 decision latency, inline and fail-closed</span></div>
        <div className="fig" data-reveal="" data-delay="80"><b><span data-count="47" data-suf="+">47+</span></b><span>Agents protected</span></div>
        <div className="fig" data-reveal="" data-delay="160"><b><span data-count="8.7" data-suf="K">8.7K</span></b><span>Threats blocked every month</span></div>
        <div className="fig" data-reveal="" data-delay="240"><b><span data-count="60" data-suf="+">60+</span></b><span>Security policies enforced</span></div>
        </div>
        </div>
        </section>
        <section className="sec" aria-labelledby="uses-h">
        <div className="wrap">
        <div className="sec-head split">
        <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">Use cases</span><h2 className="h2" id="uses-h" data-reveal="">Where Zenstra<br /><span className="grad">fits first.</span></h2></div>
        <p className="lede" data-words="">Pick the risk your team is being asked about today. Each one runs on the same inventory, policy engine and decision record.</p>
        </div>
        <UseCaseGrid />
        </div>
        </section>
        <section className="band sec" aria-labelledby="cu-h">
        <div className="wrap cu-grid">
        <div style={{ display: "grid", gap: "22px", justifyItems: "start" }}>
        <span className="eyebrow" data-reveal="">For credit unions</span>
        <h2 className="h2" id="cu-h" data-reveal="">Ready for the examiner's first question.</h2>
        <p className="lede" data-reveal="">Core platforms, copilots, lending and fraud agents are already live. Zenstra gives every one an owner, a scope and a record your NCUA examiner can read.</p>
        <A to="/credit-unions" className="btn white" data-reveal="">Zenstra for credit unions{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A>
        </div>
        <div className="vs" data-reveal="">
        <div className="vs-row"><div>The examiner asks</div><div>Vendor defaults</div><div className="y">With Zenstra</div></div>
        <div className="vs-row"><div className="q">Which agents do you run?</div><div className="n">Per platform, if at all</div><div className="y">Every agent, one inventory</div></div>
        <div className="vs-row"><div className="q">What can each one reach?</div><div className="n">Standing credentials</div><div className="y">Scoped, expiring grants</div></div>
        <div className="vs-row"><div className="q">How do you stop one?</div><div className="n">A switch per vendor</div><div className="y">One revocation, in seconds</div></div>
        <div className="vs-row"><div className="q">Show me what it did.</div><div className="n">Logs spread across vendors</div><div className="y">One tamper-evident record</div></div>
        </div>
        </div>
        </section>
        <section className="sec" id="trust" aria-labelledby="trust-h">
        <div className="wrap trust-row">
        <div style={{ display: "grid", gap: "18px", justifyItems: "start" }}>
        <span className="eyebrow" data-reveal="">Security & compliance</span>
        <h2 className="h3" id="trust-h" style={{ fontSize: "clamp(26px,2.6vw,36px)" }} data-reveal="">Audited the way you will audit us.</h2>
        <p className="lede" style={{ fontSize: "16.5px" }} data-reveal="">Independent audits every year, reports under NDA, and certificates you can verify with the issuing body.</p>
        <A to="/company#compliance" className="link" data-reveal="">Security & compliance{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A>
        </div>
        <div>
        <div className="certs">
        <div className="cert" data-reveal=""><svg viewBox="0 0 54 54" aria-hidden="true"><circle className="o" cx="27" cy="27" r="25"></circle><circle className="d" cx="27" cy="27" r="21"></circle><circle className="i" cx="27" cy="27" r="17"></circle><text x="27" y="28" textAnchor="middle">SOC 2</text><text className="s" x="27" y="37" textAnchor="middle">TYPE II</text></svg><b>SOC 2 Type II</b><small>Security, availability, confidentiality</small></div>
        <div className="cert" data-reveal="" data-delay="70"><svg viewBox="0 0 54 54" aria-hidden="true"><circle className="o" cx="27" cy="27" r="25"></circle><circle className="d" cx="27" cy="27" r="21"></circle><circle className="i" cx="27" cy="27" r="17"></circle><text x="27" y="28" textAnchor="middle">ISO</text><text className="s" x="27" y="37" textAnchor="middle">27001</text></svg><b>ISO/IEC 27001</b><small>Information security</small></div>
        <div className="cert" data-reveal="" data-delay="140"><svg viewBox="0 0 54 54" aria-hidden="true"><circle className="o" cx="27" cy="27" r="25"></circle><circle className="d" cx="27" cy="27" r="21"></circle><circle className="i" cx="27" cy="27" r="17"></circle><text x="27" y="28" textAnchor="middle">ISO</text><text className="s" x="27" y="37" textAnchor="middle">42001</text></svg><b>ISO/IEC 42001</b><small>AI management system</small></div>
        <div className="cert" data-reveal="" data-delay="210"><svg viewBox="0 0 54 54" aria-hidden="true"><circle className="o" cx="27" cy="27" r="25"></circle><circle className="d" cx="27" cy="27" r="21"></circle><circle className="i" cx="27" cy="27" r="17"></circle><text x="27" y="28" textAnchor="middle">ISO</text><text className="s" x="27" y="37" textAnchor="middle">27701</text></svg><b>ISO/IEC 27701</b><small>Privacy information</small></div>
        </div>
        <p className="trust-note" data-reveal="">HIPAA and GDPR programmes · Reports under NDA · Security review pack on request</p>
        </div>
        </div>
        </section>
        <section aria-labelledby="cta-h" style={{ paddingBottom: "clamp(64px,7vw,104px)" }}>
        <div className="wrap">
        <div className="cta">
        <div className="stream" aria-hidden="true"></div>
        <div className="cta-inner">
        <span className="eyebrow" style={{ color: "#5cd2ff" }} data-reveal="">30-minute technical session</span>
        <h2 className="h2" id="cta-h" data-reveal="">Deploy agents your board can sign off on.</h2>
        <p data-reveal="">See Zenstra enforce a live policy against your own agent, in your own cloud.</p>
        <div className="ctas" data-reveal=""><A to="/demo" className="btn white lg">Request a demo{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A></div>
        <p className="fine" data-reveal="">No agent rewrite · Runs in your cloud · Security review pack included</p>
        </div>
        </div>
        </div>
        </section>
        </main>
      </>
  );
}
