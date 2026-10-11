'use strict';

// Personal mailbox providers. A demo is prepared for the visitor's environment,
// so we ask for a work address, as Wiz, Vanta, Snyk and Abnormal do.
const FREE = new Set(`
gmail.com googlemail.com yahoo.com yahoo.co.uk yahoo.co.in yahoo.fr yahoo.de yahoo.es yahoo.it yahoo.ca ymail.com rocketmail.com
hotmail.com hotmail.co.uk hotmail.fr hotmail.de hotmail.it hotmail.es outlook.com outlook.co.uk outlook.fr outlook.de live.com live.co.uk live.fr msn.com passport.com
icloud.com me.com mac.com aol.com aim.com proton.me protonmail.com protonmail.ch pm.me tutanota.com tutanota.de tuta.io tutamail.com
gmx.com gmx.net gmx.de gmx.at gmx.ch web.de mail.com email.com usa.com post.com zoho.com zohomail.com yandex.com yandex.ru ya.ru mail.ru inbox.ru list.ru bk.ru
qq.com 163.com 126.com yeah.net sina.com sohu.com aliyun.com naver.com daum.net hanmail.net rediffmail.com
fastmail.com fastmail.fm hushmail.com hey.com duck.com skiff.com mailbox.org posteo.de posteo.net runbox.com startmail.com
comcast.net verizon.net att.net sbcglobal.net bellsouth.net charter.net cox.net earthlink.net optonline.net frontier.com windstream.net centurylink.net
btinternet.com sky.com virginmedia.com talktalk.net orange.fr free.fr laposte.net sfr.fr wanadoo.fr libero.it virgilio.it tiscali.it t-online.de freenet.de arcor.de
shaw.ca rogers.com sympatico.ca bigpond.com optusnet.com.au telus.net xtra.co.nz
`.split(/\s+/).filter(Boolean));

// Throwaway inbox services.
const DISPOSABLE = new Set(`
mailinator.com mailinator.net guerrillamail.com guerrillamail.net guerrillamail.org sharklasers.com grr.la 10minutemail.com 10minutemail.net
tempmail.com temp-mail.org temp-mail.io tempmailo.com tempmail.dev tempr.email throwawaymail.com trashmail.com trashmail.de yopmail.com yopmail.fr yopmail.net
getnada.com nada.email dispostable.com maildrop.cc mailnesia.com mintemail.com mohmal.com moakt.com emailondeck.com fakeinbox.com spamgourmet.com
mailcatch.com mytemp.email tempinbox.com discard.email burnermail.io inboxkitten.com mail.tm mailpoof.com emailfake.com fakemail.net 33mail.com
spambox.us spam4.me tmpmail.org tmpmail.net mailsac.com harakirimail.com mvrht.com anonbox.net jetable.org mailexpire.com incognitomail.org
`.split(/\s+/).filter(Boolean));

function domainOf(email) {
  const at = email.lastIndexOf('@');
  return at < 0 ? '' : email.slice(at + 1).toLowerCase();
}

// Matches the domain itself and any of its subdomains.
function inSet(set, domain) {
  const parts = domain.split('.');
  for (let i = 0; i < parts.length - 1; i++) if (set.has(parts.slice(i).join('.'))) return true;
  return false;
}

function classify(domain) {
  if (inSet(DISPOSABLE, domain)) return 'disposable';
  if (inSet(FREE, domain)) return 'free';
  return 'work';
}

module.exports = { FREE, DISPOSABLE, domainOf, classify };
