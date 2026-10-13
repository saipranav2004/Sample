import { useParams } from 'react-router';
import Template from './Template.jsx';
import NotFound from './NotFound.jsx';
import { CAPABILITY_PAGES } from '../content/pages.js';
import { CAPABILITIES } from '../content/site.js';

export default function Capability() {
  const { slug } = useParams();
  const page = CAPABILITY_PAGES[slug], meta = CAPABILITIES.find((c) => c.slug === slug);
  if (!page || !meta) return <NotFound />;
  // key: a new capability is a new page (fresh motion and state).
  return <Template key={slug} page={page} kind="capability" icon={meta.icon} />;
}
