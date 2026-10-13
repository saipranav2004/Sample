import { useParams } from 'react-router';
import Template from './Template.jsx';
import NotFound from './NotFound.jsx';
import { USE_CASE_PAGES } from '../content/pages.js';
import { USE_CASES } from '../content/site.js';

export default function UseCase() {
  const { slug } = useParams();
  const page = USE_CASE_PAGES[slug], meta = USE_CASES.find((u) => u.slug === slug);
  if (!page || !meta) return <NotFound />;
  return <Template key={slug} page={page} kind="use-case" icon={meta.icon} />;
}
