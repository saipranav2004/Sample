import { useRef } from 'react';
import A from '../components/A.jsx';
import { usePageFx } from '../lib/usePage.js';

export default function Company() {
  const ref = useRef(null);
  usePageFx(ref);
  return (
      <main id="main" data-page="company" ref={ref}>
      <section className="co-hero rails" aria-labelledby="hero-h">
      <div className="wrap co-grid">
      <div>
      <span className="chip-live" data-after=""><i></i>Zenstra AI · by Deep Algorithms</span>
      <h1 className="display" id="hero-h" data-scan=""><span className="scanline"><span className="in">Defence as intelligent</span><i className="bar"></i></span><span className="scanline"><span className="in grad">as the attack.</span><i className="bar"></i></span></h1>
      <p className="lede" data-after="">Zenstra AI is built by Deep Algorithms, an AI-native cybersecurity company headquartered in Hyderabad. We build platforms that think continuously, respond autonomously, and get smarter with every threat they see.</p>
      <div className="ctas" data-after="" style={{ marginTop: "32px" }}><a href="#leadership" className="btn primary lg">Meet the leadership{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></a><a href="#contact" className="btn secondary lg">Contact us</a></div>
      </div>
      <dl className="facts" data-after="" aria-label="Company facts">
      <div><dt>Company</dt><dd>Deep Algorithms<small>Deep Algorithms Solutions Pvt Ltd.</small></dd></div>
      <div><dt>Founded</dt><dd>2022</dd></div>
      <div><dt>Headquarters</dt><dd>Hyderabad, India</dd></div>
      <div><dt>Offices</dt><dd>Hyderabad · Bangalore · Maryland, USA</dd></div>
      <div><dt>Focus</dt><dd>AI-native security<small>Serving organisations globally</small></dd></div>
      </dl>
      </div>
      </section>
      <section className="sec" aria-labelledby="story-h" style={{ paddingTop: "clamp(56px,6vw,88px)" }}>
      <div className="wrap story">
      <div className="story-copy">
      <span className="eyebrow" data-reveal="">Our story</span>
      <h2 className="h2" id="story-h" data-reveal="">Built from a belief that the defence must be as intelligent as the attack.</h2>
      <p data-reveal="">Deep Algorithms was founded on a single observation: the threat landscape changed fundamentally when attackers adopted AI. Bots that mimic human behaviour perfectly. Identity compromises that drift invisibly for months. Data access violations that look exactly like legitimate work. Traditional tools, built for a rule-based world, cannot keep pace.</p>
      <p data-reveal="">We set out to build something different. Not a faster version of existing tools. An entirely new class of security intelligence, one that learns your environment continuously, understands what normal looks like in your specific context, and detects deviation before it becomes a breach.</p>
      <p data-reveal=""><b>Zenstra AI applies that thinking to the newest identities in the enterprise: autonomous AI agents.</b>{" "}Every agent gets an identity, every call is checked against policy before it runs, and every decision leaves a tamper-evident record.</p>
      </div>
      <blockquote className="quote" data-reveal="">
      <p>“We don’t sell security products. We build defence that thinks.”</p>
      <footer>Deep Algorithms founding philosophy</footer>
      </blockquote>
      </div>
      </section>
      <section className="sec alt" aria-labelledby="fam-h">
      <div className="wrap">
      <div className="sec-head split">
      <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">The platforms</span><h2 className="h2" id="fam-h" data-reveal="">One architecture, four platforms.</h2></div>
      <p className="lede" data-words="">Every Deep Algorithms product shares the same foundation: continuous, autonomous and adaptive.</p>
      </div>
      <div className="family">
      <div className="fam here" data-reveal=""><span className="tag">You are here</span><b>Zenstra AI</b><i>Govern every agent. Secure every workflow.</i><p>Identity, policy enforcement, threat defense and audit for autonomous agent activity.</p><A to="/" className="go">Explore Zenstra{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A></div>
      <a href="https://deepalgorithms.io/adapid-ai" className="fam" data-reveal="" data-delay="60" rel="noopener"><span className="tag">Identity risk</span><b>adapID AI</b><i>Continuous Identity Risk Management.</i><p>Scores every identity for anomalous behaviour, detecting threats that traditional tools miss for months.</p><span className="go">deepalgorithms.io{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></span></a>
      <a href="https://deepalgorithms.io/botshield-ai" className="fam" data-reveal="" data-delay="120" rel="noopener"><span className="tag">Bots and DDoS</span><b>BotShield AI</b><i>Intent intelligence over signature blocking.</i><p>Continuous threat exposure management, behavioural bot fingerprinting, and DDoS detection with auto-mitigation.</p><span className="go">deepalgorithms.io{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></span></a>
      <a href="https://deepalgorithms.io/dpdpa-compliance" className="fam" data-reveal="" data-delay="180" rel="noopener"><span className="tag">Compliance</span><b>ICMS Compliance Suite</b><i>Automated DPDPA evidence generation.</i><p>Personal data access monitoring, with reporting for DPDPA, RBI and SEBI.</p><span className="go">deepalgorithms.io{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></span></a>
      </div>
      </div>
      </section>
      <section className="sec" aria-labelledby="bel-h">
      <div className="wrap">
      <div className="sec-head"><span className="eyebrow" data-reveal="">What we believe</span><h2 className="h2" id="bel-h" data-reveal="">Six principles behind every product.</h2></div>
      <div className="beliefs">
      <div data-reveal=""><span className="n">01</span><b>Continuous over periodic</b><p>Security that runs on a schedule gives attackers the gaps between. Everything we build operates in real time, always.</p></div>
      <div data-reveal="" data-delay="60"><span className="n">02</span><b>Behaviour over signatures</b><p>Signatures describe yesterday’s attacks. Behavioural intelligence catches attacks that have never been seen before.</p></div>
      <div data-reveal="" data-delay="120"><span className="n">03</span><b>Autonomous over manual</b><p>Human-speed response cannot match machine-speed attacks. Autonomous action is not a feature; it is a requirement.</p></div>
      <div data-reveal=""><span className="n">04</span><b>Context-first by design</b><p>Every threat environment has its own regulatory obligations, attack patterns and infrastructure risks. Our platforms are built from first principles for the environment they protect, not ported from a generic template.</p></div>
      <div data-reveal="" data-delay="60"><span className="n">05</span><b>Evidence over assertion</b><p>Every detection is explainable. Every compliance claim is documented. Our customers can always show their work.</p></div>
      <div data-reveal="" data-delay="120"><span className="n">06</span><b>Platform over product</b><p>Individual tools create gaps between them. A unified intelligence layer across identity, traffic and compliance leaves nowhere to hide.</p></div>
      </div>
      </div>
      </section>
      <section className="sec alt" id="leadership" aria-labelledby="lead-h">
      <div className="wrap">
      <div className="sec-head"><span className="eyebrow" data-reveal="">Leadership</span><h2 className="h2" id="lead-h" data-reveal="">The team behind Zenstra.</h2></div>
      <div className="leaders">
      <div className="leader" data-reveal=""><div className="ph"><img src="/img/lead-jp-mishra.webp" alt="JP Mishra" width="360" height="360" loading="lazy" decoding="async" /></div><b>JP Mishra</b><span className="role">Founder & CEO</span><ul><li>EPBA, IIM Calcutta</li><li>18+ years in AI, cybersecurity, cloud and blockchain</li></ul><a href="https://www.linkedin.com/in/jp-mishra-97272011/" className="in" rel="noopener"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3"></circle><path d="M3 14c.8-2.6 2.8-4 5-4s4.2 1.4 5 4"></path></svg>{" "}LinkedIn<span className="sr-only">: JP Mishra</span></a></div>
      <div className="leader" data-reveal="" data-delay="60"><div className="ph"><img src="/img/lead-manish-parganiha.webp" alt="Manish Parganiha" width="360" height="360" loading="lazy" decoding="async" /></div><b>Manish Parganiha</b><span className="role">CTO</span><ul><li>M.Tech, IIIT Bangalore</li><li>21+ years in solution design, cloud, blockchain, AI and analytics</li></ul><a href="https://www.linkedin.com/in/manishparganiha/" className="in" rel="noopener"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3"></circle><path d="M3 14c.8-2.6 2.8-4 5-4s4.2 1.4 5 4"></path></svg>{" "}LinkedIn<span className="sr-only">: Manish Parganiha</span></a></div>
      <div className="leader" data-reveal="" data-delay="120"><div className="ph"><img src="/img/lead-amit-shukla.webp" alt="Dr. Amit Shukla" width="360" height="360" loading="lazy" decoding="async" /></div><b>Dr. Amit Shukla</b><span className="role">CRO</span><ul><li>B.Tech, IIT Kanpur · PhD, Imperial College London</li><li>16+ years of experience · Chairperson at IIT Mandi</li></ul><a href="https://www.linkedin.com/in/amit-shukla-11a0391a/" className="in" rel="noopener"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3"></circle><path d="M3 14c.8-2.6 2.8-4 5-4s4.2 1.4 5 4"></path></svg>{" "}LinkedIn<span className="sr-only">: Dr. Amit Shukla</span></a></div>
      <div className="leader" data-reveal="" data-delay="180"><div className="ph"><img src="/img/lead-abhishek-tripathi.webp" alt="Abhishek Tripathi" width="360" height="360" loading="lazy" decoding="async" /></div><b>Abhishek Tripathi</b><span className="role">Chief of Innovation</span><ul><li>B.Tech, JNTU Hyderabad</li><li>6+ patents · 5+ years in innovation and research</li></ul><a href="https://www.linkedin.com/in/abhishek-tripathi-software/" className="in" rel="noopener"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="8" cy="6" r="3"></circle><path d="M3 14c.8-2.6 2.8-4 5-4s4.2 1.4 5 4"></path></svg>{" "}LinkedIn<span className="sr-only">: Abhishek Tripathi</span></a></div>
      </div>
      <div className="advisors">
      <h3 data-reveal="">Advisors and mentors</h3>
      <div className="adv" data-reveal="">
      <div><span><b>Dr. Amarendra Sahoo</b><small>Senior Advisor</small></span><p>31+ years at RBI · Former World Bank consultant · Multi-firm board member</p></div>
      <div><span><b>Yogesh Chadha</b><small>Business Growth Advisor</small></span><p>30+ years in investment banking and private equity · JPMorgan Chase · Mirae Asset · Multi-firm board member</p></div>
      <div><span><b>Prakash Govindan</b><small>Strategic Advisor</small></span><p>Co-Founder and CEO, Gradiant · Driving clean water access through cutting-edge technologies</p></div>
      <div><span><b>Himanshu Singhal</b><small>Strategic Advisor</small></span><p>Chief Executive Officer · Times 40 under 40 · Indian culture ambassador</p></div>
      <div><span><b>Ajitesh Shukla</b><small>Technology Mentor</small></span><p>25 years of industry experience in AI, analytics, cloud and enterprise security</p></div>
      <div><span><b>Amit Shukla</b><small>Business Mentor</small></span><p>Founder and MD, EasyGov (Jio Platforms)</p></div>
      <div><span><b>Dr. Anil Rachamalla</b><small>Business Growth Advisor</small></span><p>Founder, End Now Foundation · 26 years of experience</p></div>
      <div><span><b>Dr. Satvasheel Powar</b><small>Advisor</small></span><p>Dean (Finance and Accounts), IIT Mandi · Clean energy research-to-scale leader</p></div>
      </div>
      </div>
      </div>
      </section>
      <section className="sec" id="compliance" aria-labelledby="comp-h">
      <div className="wrap trust-row">
      <div style={{ display: "grid", gap: "18px", justifyItems: "start" }}>
      <span className="eyebrow" data-reveal="">Security & Compliance</span>
      <h2 className="h3" id="comp-h" style={{ fontSize: "clamp(26px,2.6vw,36px)" }} data-reveal="">Built to the world’s highest standards.</h2>
      <p className="lede" style={{ fontSize: "16.5px" }} data-reveal="">Our certifications are independently audited and renewed annually to ensure your data is always protected.</p>
      </div>
      <div>
      <div className="certs certs-6"><div className="cert" data-reveal="" data-delay="0"><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="o" cx="32" cy="32" r="30"></circle><circle className="d" cx="32" cy="32" r="25.5"></circle><circle className="i" cx="32" cy="32" r="21"></circle><text className="t" x="32" y="29.5" textAnchor="middle">ISO</text><line className="ln" x1="19" y1="34" x2="45" y2="34"></line><text className="s" x="32" y="42.5" textAnchor="middle">27001</text></svg><b>ISO 27001</b><small>Information Security Management</small><span className="kind">Certified</span></div><div className="cert" data-reveal="" data-delay="70"><svg viewBox="0 0 64 64" aria-hidden="true"><rect className="o" x="3" y="3" width="58" height="58" rx="17"></rect><rect className="d" x="7.5" y="7.5" width="49" height="49" rx="13"></rect><rect className="i" x="12" y="12" width="40" height="40" rx="10"></rect><text className="t" x="32" y="31" textAnchor="middle">SOC 2</text><text className="s" x="32" y="41" textAnchor="middle">TYPE II</text></svg><b>SOC 2 Type II</b><small>Security, Availability & Confidentiality</small><span className="kind">Audit report</span></div><div className="cert" data-reveal="" data-delay="140"><svg viewBox="0 0 64 64" aria-hidden="true"><path className="o" d="M32 2.5 57 11.5V30c0 15.5-10.6 26.4-25 31.5C17.6 56.4 7 45.5 7 30V11.5Z"></path><path className="i" d="M32 9.5 51 16.4V30c0 11.7-7.8 20.2-19 24.6C20.8 50.2 13 41.7 13 30V16.4Z"></path><text className="t sm" x="32" y="35" textAnchor="middle">HIPAA</text></svg><b>HIPAA</b><small>Health Data Privacy & Security</small><span className="kind">Compliance programme</span></div><div className="cert" data-reveal="" data-delay="0"><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="o" cx="32" cy="32" r="30"></circle><circle className="i" cx="32" cy="32" r="19"></circle><circle className="st" cx="32.00" cy="8.00" r="1.9"></circle><circle className="st" cx="44.00" cy="11.22" r="1.9"></circle><circle className="st" cx="52.78" cy="20.00" r="1.9"></circle><circle className="st" cx="56.00" cy="32.00" r="1.9"></circle><circle className="st" cx="52.78" cy="44.00" r="1.9"></circle><circle className="st" cx="44.00" cy="52.78" r="1.9"></circle><circle className="st" cx="32.00" cy="56.00" r="1.9"></circle><circle className="st" cx="20.00" cy="52.78" r="1.9"></circle><circle className="st" cx="11.22" cy="44.00" r="1.9"></circle><circle className="st" cx="8.00" cy="32.00" r="1.9"></circle><circle className="st" cx="11.22" cy="20.00" r="1.9"></circle><circle className="st" cx="20.00" cy="11.22" r="1.9"></circle><text className="t sm" x="32" y="35.5" textAnchor="middle">GDPR</text></svg><b>GDPR</b><small>EU General Data Protection Regulation</small><span className="kind">Compliance programme</span></div><div className="cert" data-reveal="" data-delay="70"><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="o" cx="32" cy="32" r="30"></circle><circle className="d" cx="32" cy="32" r="25.5"></circle><circle className="i" cx="32" cy="32" r="21"></circle><text className="t" x="32" y="29.5" textAnchor="middle">ISO</text><line className="ln" x1="19" y1="34" x2="45" y2="34"></line><text className="s" x="32" y="42.5" textAnchor="middle">42001</text></svg><b>ISO/IEC 42001:2023</b><small>Artificial Intelligence Management System (AIMS)</small><span className="kind">Certified</span></div><div className="cert" data-reveal="" data-delay="140"><svg viewBox="0 0 64 64" aria-hidden="true"><circle className="o" cx="32" cy="32" r="30"></circle><circle className="d" cx="32" cy="32" r="25.5"></circle><circle className="i" cx="32" cy="32" r="21"></circle><text className="t" x="32" y="29.5" textAnchor="middle">ISO</text><line className="ln" x1="19" y1="34" x2="45" y2="34"></line><text className="s" x="32" y="42.5" textAnchor="middle">27701</text></svg><b>ISO/IEC 27701:2025</b><small>Privacy Information Management</small><span className="kind">Certified</span></div></div>
      </div>
      </div>
      </section>
      <section className="sec alt" id="contact" aria-labelledby="off-h">
      <div className="wrap">
      <div className="sec-head split">
      <div style={{ display: "grid", gap: "20px" }}><span className="eyebrow" data-reveal="">Offices and contact</span><h2 className="h2" id="off-h" data-reveal="">Talk to the team.</h2></div>
      <p className="lede" data-words="">For a product walkthrough, the fastest route is a demo request. For anything else, write to us and a person will reply.</p>
      </div>
      <div className="offices">
      <div className="office" data-reveal=""><span className="tag">Headquarters</span><b>Hyderabad</b><address>Shanta Sriram Tech Park, adjacent to DLF Cyber City, Gachibowli, Hyderabad 500032, India</address></div>
      <div className="office" data-reveal="" data-delay="60"><span className="tag">India</span><b>Bangalore</b><address>Prestige Shantiniketan, ITPL Main Road, Whitefield, Bangalore 560048, India</address></div>
      <div className="office" data-reveal="" data-delay="120"><span className="tag">United States</span><b>Maryland</b><address>23231 Aurora Hills Drive, Clarksburg, MD 20871, United States</address></div>
      <div className="office mail" data-reveal="" data-delay="180"><span className="tag">Zenstra AI mailing address</span><b>Delaware</b><address>Zenstra AI, c/o Northwest Registered Agent Service, Inc., 8 The Green, Suite B, Dover, DE 19901, United States</address></div>
      </div>
      <div className="contact">
      <div data-reveal=""><h3>Zenstra AI</h3><p>Product, partnership and security questions.</p><a href="mailto:info@zenstra.ai" className="mail">info@zenstra.ai</a><A to="/demo" className="link">Request a demo{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></A></div>
      <div data-reveal="" data-delay="60"><h3>Deep Algorithms</h3><p>Company enquiries and the wider platform family.</p><a href="mailto:info@deepalgorithms.in" className="mail">info@deepalgorithms.in</a><a href="tel:+917702846856" className="mail">+91 77028 46856</a><a href="https://www.linkedin.com/company/deepalgorithms.in" className="link" rel="noopener">Deep Algorithms on LinkedIn{" "}<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4"></path></svg></a></div>
      <div data-reveal="" data-delay="120"><h3>Careers</h3><p>We’re looking for AI engineers, security researchers and product builders who want to work on the world’s hardest security problems.</p><a href="mailto:hr@deepalgorithms.in" className="mail">hr@deepalgorithms.in</a></div>
      </div>
      </div>
      </section>
      </main>
  );
}
