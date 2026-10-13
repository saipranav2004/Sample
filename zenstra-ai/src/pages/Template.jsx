import { useRef } from 'react';
import { usePageFx } from '../lib/usePage.js';
import { WorksWith } from '../components/Motion.jsx';
import { PageHero, HeroVisual, Problem, HowTabs, Grid, Proof, Related, Faq, Cta } from '../components/Sections.jsx';

/* The one template every capability and use-case page uses (after zenity.io):
   hero → rolling "works with" → the problem → how Zenstra handles it → rolling scenarios
   → rolling proof cards → related → FAQ → CTA. */
export default function Template({ page, kind, icon }) {
  const ref = useRef(null);
  usePageFx(ref);
  return (
    <main id="main" data-page="template" data-kind={kind} ref={ref}>
      <PageHero eyebrow={page.eyebrow} icon={icon} title={page.title} lede={page.lede} roll={page.roll} visual={<HeroVisual shot={page.shot} chips={page.chips} />} />
      <section className="works-band"><div className="wrap"><WorksWith standalone /></div></section>
      <Problem h={page.problem.h} p={page.problem.p} cards={page.problem.cards} />
      <HowTabs h={page.how.h} p={page.how.p} tabs={page.how.tabs} />
      <Grid eyebrow={page.grid.eyebrow} h={page.grid.h} items={page.grid.items} />
      <Proof />
      <Related items={page.related} />
      <Faq items={page.faq} />
      <Cta />
    </main>
  );
}
