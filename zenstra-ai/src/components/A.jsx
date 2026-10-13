import { Link } from 'react-router';

/* Internal links go through the router (no full page load); everything else
   (mailto:, external, in-page #hash) is a plain anchor. */
export default function A({ to, href, children, ...rest }) {
  if (to != null) return <Link to={to} {...rest}>{children}</Link>;
  return <a href={href} {...rest}>{children}</a>;
}
