import { Facebook, Instagram, MessageCircle, Send, X } from 'lucide-react';

import { tr } from '../i18n';
const socialLinks = [
  { name: 'Instagram', href: 'https://instagram.com/peu_ar', icon: Instagram },
  { name: 'X', href: 'https://x.com/peu_ar', icon: X },
  { name: 'Facebook', href: 'https://facebook.com/PabloUntroib', icon: Facebook },
  { name: 'WhatsApp', href: 'https://wa.me/541154099160', icon: MessageCircle },
  { name: 'Telegram', href: 'https://t.me/pablopeu', icon: Send },
];

export function SiteFooter() {
  return (
    <footer
      className="site-footer"
      aria-label={tr('Patterns y redes del autor')}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <div className="site-footer-line">
        <span className="site-footer-copy">
          <strong>{tr('Patterns')}</strong> — {tr('Hecho con pasión por un cuchillero.')}
        </span>
        <span className="site-footer-divider" aria-hidden="true" />
        <span>
          <strong className="site-footer-follow">{tr('¿Te gustan los cuchillos?')}</strong> {tr('Seguime en:')}
        </span>
        <nav className="site-footer-social" aria-label={tr('Redes de Pablo')}>
          {socialLinks.map(({ name, href, icon: Icon }) => (
            <a
              key={name}
              href={href}
              aria-label={name}
              title={name}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon size={16} strokeWidth={2} aria-hidden="true" />
            </a>
          ))}
          <a
            className="site-footer-web"
            href="https://peu.net"
            title={tr('PEU.NET')}
            target="_blank"
            rel="noopener noreferrer"
          >
            PEU.NET
          </a>
        </nav>
      </div>
    </footer>
  );
}
