import { useEffect, useRef, useState } from 'react';
import Icon from './Icon.jsx';
import { PRODUCT_VIDEO } from '../content/media.js';
import { reduced } from '../lib/env.js';

/* The product video (configured in content/media.js): once set, "Watch the product
   tour" appears on the home console and on the platform page, opening a player. */
export function useHasVideo() {
  return !!PRODUCT_VIDEO.src;
}

/* Play button and the dialog it opens. Renders nothing until the video exists. */
export function VideoButton({ className = '' }) {
  const ok = useHasVideo();
  const [open, setOpen] = useState(false);
  const dlg = useRef(null), vid = useRef(null), btn = useRef(null);
  useEffect(() => {
    const d = dlg.current; if (!d) return;
    if (open && !d.open) { d.showModal(); if (vid.current) vid.current.play().catch(() => {}); }
    if (!open && d.open) d.close();
  }, [open]);
  if (!ok) return null;
  const close = () => { if (vid.current) vid.current.pause(); setOpen(false); if (btn.current) btn.current.focus(); };
  return (
    <>
      <button ref={btn} type="button" className={'vt-play ' + className} onClick={() => setOpen(true)} aria-haspopup="dialog">
        <span className="vt-play-ic"><Icon name="play" /></span>
        <span><b>Watch the product tour</b><small>{PRODUCT_VIDEO.length}</small></span>
      </button>
      <dialog ref={dlg} className="vt-dialog" aria-label={PRODUCT_VIDEO.title} onClose={() => { if (vid.current) vid.current.pause(); setOpen(false); }} onClick={(e) => { if (e.target === dlg.current) close(); }}>
        <button type="button" className="vt-close" onClick={close} aria-label="Close video">
          <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9" /></svg>
        </button>
        <video ref={vid} src={open ? PRODUCT_VIDEO.src : undefined} poster={PRODUCT_VIDEO.poster} controls playsInline preload="none" />
      </dialog>
    </>
  );
}

/* Framed slot: a quiet tour of real console screens, with the play button on top
   once the video is in place. */
const SCREENS = [['overview', 'Overview'], ['detections', 'Detections'], ['investigation', 'Investigation'], ['agent', 'Agent profile']];
export default function VideoTour() {
  const ok = useHasVideo();
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced()) return undefined;
    const id = setInterval(() => { if (!document.hidden) setI((n) => (n + 1) % SCREENS.length); }, 4200);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="vt-frame" data-reveal="">
      <div className="vt-chrome" aria-hidden="true"><i /><i /><i /><span>console.zenstra.ai</span></div>
      <div className="vt-stage">
        {SCREENS.map(([s], k) => (
          <div key={s} className={'vt-shot' + (k === i ? ' on' : '')} aria-hidden={k === 0 ? undefined : true}>
            <img className="th-light" src={'/img/screen-' + s + '-light.webp'} alt={k === 0 ? 'The Zenstra console' : ''} loading="lazy" width="1600" height="1000" />
            <img className="th-dark" src={'/img/screen-' + s + '-dark.webp'} alt={k === 0 ? 'The Zenstra console' : ''} loading="lazy" width="1600" height="1000" />
          </div>
        ))}
        <div className="vt-shade" aria-hidden="true" />
        {ok ? null : <div className="vt-cap" aria-hidden="true"><span className="vt-dot" />{SCREENS[i][1]}</div>}
        <VideoButton />
      </div>
    </div>
  );
}
