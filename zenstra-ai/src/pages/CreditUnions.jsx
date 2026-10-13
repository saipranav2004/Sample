import { useRef } from 'react';
import A from '../components/A.jsx';
import { usePageFx } from '../lib/usePage.js';

export default function CreditUnions() {
  const ref = useRef(null);
  usePageFx(ref);
  return (
      <main id="main" data-page="credit-unions" ref={ref}>
      <section className="hero rails" aria-labelledby="hero-h">
      <div className="lens" data-cx="0.72" data-cy="0.5" aria-hidden="true"></div>
      <div className="wrap hero-grid">
      <div className="hero-copy" data-lens-mask="">
      <a href="#products-cu" className="chip-live" data-after=""><i></i>Zenstra for credit unions</a>
      <h1 className="display" id="hero-h" data-scan=""><span className="scanline"><span className="in">Your credit union</span><i className="bar"></i></span><span className="scanline"><span className="in">already runs</span><i className="bar"></i></span><span className="scanline"><span className="in grad">agentic AI.</span><i className="bar"></i></span></h1>
      <p className="lede sub" data-after="">Core platforms, copilots, lending and fraud tools are adding agents faster than policy can follow. Zenstra gives every one an owner, a scope and a record.</p>
      <p className="switch" data-after=""><span className="muted" aria-hidden="true">Zenstra makes it</span>{" "}<span className="slot" data-switch="visible.|governed.|examiner-ready." aria-hidden="true">visible.</span><span className="sr-only">Zenstra makes it visible, governed and examiner-ready.</span></p>
      <div className="ctas" data-after=""><A to="/demo" className="btn primary lg">Request a demo{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A><a href="#controls" className="btn secondary lg">The eight controls</a></div>
      </div>
      <div className="pack-wrap" data-after="">
      <div className="pack" data-pack="" aria-label="Example examination pack">
      <div className="pack-head"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6 8 2.5 14 6M3.5 6.5v6M6.5 6.5v6M9.5 6.5v6M12.5 6.5v6M2 13.5h12"></path></svg></span><span><b>Examination pack</b><small>Northbank FCU · Q3 2026</small></span><span className="st">Ready</span></div>
      <div className="pack-rows">
      <div className="prow"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"></circle><path d="m6 10.5 2.6 2.6L14 7.6"></path></svg><span><b>Agent inventory</b><small>Every agent, owner and platform</small></span><span className="v">47 agents</span></div>
      <div className="prow"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"></circle><path d="m6 10.5 2.6 2.6L14 7.6"></path></svg><span><b>Least-privilege grants</b><small>Scoped, expiring, last used</small></span><span className="v">212 grants</span></div>
      <div className="prow"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"></circle><path d="m6 10.5 2.6 2.6L14 7.6"></path></svg><span><b>Approvals recorded</b><small>Who approved, when and why</small></span><span className="v">38 reviews</span></div>
      <div className="prow"><svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="10"></circle><path d="m6 10.5 2.6 2.6L14 7.6"></path></svg><span><b>Decision ledger</b><small>Hash chain verified</small></span><span className="v">1.2M entries</span></div>
      </div>
      <div className="pack-foot"><span>Generating</span><span className="bar"><i></i></span><span>PDF + CSV</span></div>
      </div>
      </div>
      </div>
      </section>
      <section style={{ padding: "clamp(56px,7vw,96px) 0 0" }} aria-label="Credit unions and agentic AI">
      <div className="wrap">
      <div className="stats">
      <div data-reveal=""><b><span data-count="59">59</span>%</b><span>of credit unions run generative AI in production</span></div>
      <div data-reveal="" data-delay="100"><b><span data-count="17">17</span>%</b><span>have already deployed agentic AI</span></div>
      <div data-reveal="" data-delay="200"><b>{"<1 in 5"}</b><span>call their deployment enterprise-ready</span></div>
      </div>
      </div>
      </section>
      <section className="sec" id="products-cu" aria-labelledby="map-h">
      <div className="wrap">
      <div className="sec-head split">
      <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">Three products, one programme</span><h2 className="h2" id="map-h" data-reveal="">Mapped to how a credit union actually runs.</h2></div>
      <p className="lede" data-words="">Start with the exposure your examiner will ask about first. Each product shares the same inventory, policies and record.</p>
      </div>
      <div className="map">
      <div className="map-row" data-reveal=""><div className="p"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 5V3a1 1 0 0 1 1-1h2M11 2h2a1 1 0 0 1 1 1v2M14 11v2a1 1 0 0 1-1 1h-2M5 14H3a1 1 0 0 1-1-1v-2M2 8h12"></path></svg></span><span><b>Zenstra EDR</b><small>Staff devices</small></span></div><p>Copilot, ChatGPT and other AI tools on branch and back-office computers, found and governed by your acceptable-use policy. Deployed through your existing device management.</p><div className="tags"><span>Microsoft Copilot</span><span>ChatGPT</span><span>Intune</span><span>Jamf</span></div></div>
      <div className="map-row" data-reveal=""><div className="p"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4.5 12.5h7a3 3 0 0 0 .3-6A4 4 0 0 0 4.2 6 3.3 3.3 0 0 0 4.5 12.5Z"></path></svg></span><span><b>Cloud Security</b><small>Core and lending</small></span></div><p>A gateway in your environment in front of every connector into core, LOS and CRM. Each becomes a scoped, expiring grant your risk register can list.</p><div className="tags"><span>Fiserv agentOS</span><span>Jack Henry</span><span>Temenos</span><span>LOS</span></div></div>
      <div className="map-row" data-reveal=""><div className="p"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="3" cy="4" r="1.6"></circle><circle cx="13" cy="4" r="1.6"></circle><circle cx="8" cy="12" r="1.6"></circle><path d="M4.6 4h6.8M3.8 5.4l3.4 5.2M12.2 5.4 8.8 10.6"></path></svg></span><span><b>Workflow Security</b><small>Automations</small></span></div><p>Card-dispute, SAR-prep and lending workflows checked hop by hop, including the no-code flows IT never saw being built.</p><div className="tags"><span>n8n</span><span>Zapier</span><span>Copilot Studio</span><span>MCP</span></div></div>
      </div>
      </div>
      </section>
      <section className="sec alt" aria-labelledby="where-h">
      <div className="wrap">
      <div className="sec-head"><span className="eyebrow" data-reveal="">Where agents already run</span><h2 className="h2" id="where-h" data-reveal="">It shipped with the platforms you already use.</h2></div>
      <div className="areas">
      <div className="area" data-reveal=""><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2 6 8 2.5 14 6M3.5 6.5v6M6.5 6.5v6M9.5 6.5v6M12.5 6.5v6M2 13.5h12"></path></svg></span><b>Core-banking agents</b><p>Agent runtimes inside the core you already operate, whether or not you asked.</p><span className="by">Cloud Security</span></div>
      <div className="area" data-reveal="" data-delay="60"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3"></circle><path d="M3 14c.8-2.6 2.8-4 5-4s4.2 1.4 5 4"></path></svg></span><b>Employee copilots</b><p>Often the first agentic tools live, usually before a policy exists.</p><span className="by">Zenstra EDR</span></div>
      <div className="area" data-reveal="" data-delay="120"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 1.5h5.5L12.5 4.5v10h-8.5Z M9 1.5v3.5h3.5M6 8.5h4.5M6 11h4.5"></path></svg></span><b>Lending and underwriting</b><p>Document and decisioning agents that touch loan files end to end.</p><span className="by">Cloud + Workflow</span></div>
      <div className="area" data-reveal=""><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="8" r="5.5"></circle><circle cx="8" cy="8" r="2"></circle></svg></span><b>Fraud and AML</b><p>Pattern and SAR-prep agents with standing access to transaction data.</p><span className="by">Workflow Security</span></div>
      <div className="area" data-reveal="" data-delay="60"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2Z"></path></svg></span><b>Member service</b><p>Chat and voice agents sharing a knowledge base with staff assistants.</p><span className="by">Cloud Security</span></div>
      <div className="area" data-reveal="" data-delay="120"><span className="ic"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5.5 2.5v3.5M10.5 2.5v3.5M3.5 6h9v2a4.5 4.5 0 0 1-9 0Z M8 12.5v1.5"></path></svg></span><b>Shadow automation</b><p>No-code tools wiring agents into core systems without IT seeing it.</p><span className="by">Workflow + EDR</span></div>
      </div>
      </div>
      </section>
      <section className="band sec" aria-labelledby="gap-h">
      <div className="wrap cu-grid">
      <div style={{ display: "grid", gap: "22px", justifyItems: "start" }}>
      <span className="eyebrow" data-reveal="">The gap</span>
      <h2 className="h2" id="gap-h" data-reveal="">Vendor defaults are not institutional governance.</h2>
      <p className="lede" data-reveal="">Core platforms describe what an agent can do. They do not say what your institution should allow, who owns the risk, or how drift is caught six months from now.</p>
      </div>
      <div className="vs" data-reveal="">
      <div className="vs-row"><div>The examiner asks</div><div>Vendor defaults</div><div className="y">With Zenstra</div></div>
      <div className="vs-row"><div className="q">Which agents do you run?</div><div className="n">Per platform, if at all</div><div className="y">Every agent, one inventory</div></div>
      <div className="vs-row"><div className="q">Who approved it?</div><div className="n">A policy written at rollout</div><div className="y">A recorded review before production</div></div>
      <div className="vs-row"><div className="q">What can each one reach?</div><div className="n">Standing credentials</div><div className="y">Scoped, expiring grants</div></div>
      <div className="vs-row"><div className="q">How do you stop one?</div><div className="n">A switch per vendor</div><div className="y">One revocation, in seconds</div></div>
      <div className="vs-row"><div className="q">Show me what it did.</div><div className="n">Logs spread across vendors</div><div className="y">One tamper-evident record</div></div>
      </div>
      </div>
      </section>
      <section className="sec" id="controls" aria-labelledby="ctl-h">
      <div className="wrap">
      <div className="sec-head split">
      <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">What Zenstra provides</span><h2 className="h2" id="ctl-h" data-reveal="">Eight controls, mapped to how credit unions work.</h2></div>
      <p className="lede" data-words="">Every control runs inline, before a tool call executes, not reported after the damage is done.</p>
      </div>
      <div className="ctl8">
      <div data-reveal=""><span className="n">01</span><div><b>Shadow AI discovery</b><p>Copilots and no-code flows wired into core, found before an examiner finds them.</p></div></div>
      <div data-reveal="" data-delay="60"><span className="n">02</span><div><b>Agent identity</b><p>A cryptographic identity for every agent, revoked the moment access drifts.</p></div></div>
      <div data-reveal="" data-delay="120"><span className="n">03</span><div><b>Secure tool access</b><p>Each connector into core, LOS or CRM becomes a scoped, expiring grant.</p></div></div>
      <div data-reveal="" data-delay="180"><span className="n">04</span><div><b>Runtime detection</b><p>An agent reaching beyond its task is caught before it reaches a member's file.</p></div></div>
      <div data-reveal=""><span className="n">05</span><div><b>Prompt injection defense</b><p>Member chat and voice agents isolated from malicious input.</p></div></div>
      <div data-reveal="" data-delay="60"><span className="n">06</span><div><b>Memory protection</b><p>Shared knowledge layers that cannot be poisoned across sessions.</p></div></div>
      <div data-reveal="" data-delay="120"><span className="n">07</span><div><b>Policy enforcement</b><p>Your acceptable-use policy as enforced code, not a PDF.</p></div></div>
      <div data-reveal="" data-delay="180"><span className="n">08</span><div><b>Immutable audit trail</b><p>A tamper-evident record of every decision, ready for an NCUA examiner.</p></div></div>
      </div>
      </div>
      </section>
      <section className="sec alt" data-show="" aria-labelledby="exam-h">
      <div className="wrap">
      <div className="sec-head split">
      <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">Built for examination</span><h2 className="h2" id="exam-h" data-reveal="">No separate rulebook for AI. The proof comes from you.</h2></div>
      <p className="lede" data-words="">Examiners already check that you run safely, treat members fairly and know what your vendors do. Zenstra creates that proof as your agents work.</p>
      </div>
      <div className="show-grid">
      <div className="show-tabs" role="tablist" aria-label="Examination evidence" aria-orientation="vertical" data-reveal="">
      <button className="show-tab" role="tab" aria-selected="true" data-cap="A living inventory: every agent and connection, tracked automatically, with an owner."><b>Living inventory</b><span>A living inventory: every agent and connection, tracked automatically, with an owner.</span><i></i></button>
      <button className="show-tab" role="tab" aria-selected="false" data-cap="Only the access it needs: least-privilege proof generated as grants are issued."><b>Least privilege</b><span>Only the access it needs: least-privilege proof generated as grants are issued.</span><i></i></button>
      <button className="show-tab" role="tab" aria-selected="false" data-cap="A complete record: every action, not just the flagged ones, ready to export."><b>Complete record</b><span>A complete record: every action, not just the flagged ones, ready to export.</span><i></i></button>
      </div>
      <div className="show-stage" data-reveal="">
      <div className="show-frame">
      <div className="show-bar"><i></i><i></i><i></i><span>console.zenstra.ai</span><span className="live">Live</span></div>
      <div className="show-view">
      <div className="show-slide"><img className="th-light" src="/img/screen-overview-light.webp" alt="Overview with governed agents, owners and coverage by platform" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-overview-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
      <div className="show-slide"><img className="th-light" src="/img/screen-agent-light.webp" alt="Agent profile with scoped grants, expiry and last use" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-agent-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
      <div className="show-slide"><img className="th-light" src="/img/screen-investigation-light.webp" alt="Investigation with the full agent run and decision record" width="1600" height="1000" loading="lazy" decoding="async" /><img className="th-dark" src="/img/screen-investigation-dark.webp" alt="" width="1600" height="1000" loading="lazy" decoding="async" /></div>
      <i className="show-scan" aria-hidden="true"></i>
      </div>
      </div>
      </div>
      <div className="show-caption"><span data-caption="" aria-live="polite"></span></div>
      </div>
      </div>
      </section>
      <section className="sec" aria-labelledby="faq-h">
      <div className="wrap faq">
      <div style={{ display: "grid", gap: "18px", alignContent: "start" }}><span className="eyebrow" data-reveal="">FAQ</span><h2 className="h2" id="faq-h" style={{ fontSize: "clamp(28px,3vw,42px)" }} data-reveal="">Questions credit unions ask first.</h2></div>
      <div data-reveal="">
      <details><summary>Does Zenstra replace our core provider's agent controls?</summary><div className="a"><p>No. It sits underneath them. Your core provider's controls still apply; Zenstra adds an inventory, a policy and a revocation switch that work across every platform, so your institution can verify them independently.</p></div></details>
      <details><summary>Which product should we start with?</summary><div className="a"><p>Most credit unions start with Zenstra EDR for staff copilots, because that is where unapproved AI use appears first, then add Cloud Security in front of core and lending connectors.</p></div></details>
      <details><summary>What does deployment involve for our IT team?</summary><div className="a"><p>The EDR app is deployed through your existing device management. The gateway runs in your environment in front of core and agent platforms. Most credit unions start with a pilot group and one platform.</p></div></details>
      <details><summary>Where does member data go?</summary><div className="a"><p>Prompts and payloads are evaluated inside your environment. Only decisions and redacted evidence reach the Zenstra control plane. The security review pack, available on request, lists exactly what leaves and what never does.</p></div></details>
      </div>
      </div>
      </section>
      </main>
  );
}
