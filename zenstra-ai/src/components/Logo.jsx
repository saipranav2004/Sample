/* The Zenstra mark and wordmark, each in a light-theme and a dark-theme file. */
export function Mark({ className = 'logo-mark' }) {
  return (
    <span className={className}>
      <img className="th-light" src="/img/zenstra-mark.png" alt="" width="138" height="126" />
      <img className="th-dark" src="/img/zenstra-mark-dark.png" alt="" width="138" height="126" />
    </span>
  );
}

export function Wordmark({ className = 'logo-word' }) {
  return (
    <span className={className}>
      <img className="th-light" src="/img/zenstra-wordmark.png" alt="" width="657" height="55" />
      <img className="th-dark" src="/img/zenstra-wordmark-dark.png" alt="" width="657" height="55" />
    </span>
  );
}

export default function Logo() {
  return (<><Mark /><Wordmark /></>);
}
