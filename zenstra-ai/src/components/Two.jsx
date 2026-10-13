/* A heading in two tones: the first part in ink, the second in the brand gradient. */
export default function Two({ t }) {
  return (<>{t[0]}<br /><span className="grad">{t[1]}</span></>);
}
