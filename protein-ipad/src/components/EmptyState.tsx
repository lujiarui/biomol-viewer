import { localize, useI18n } from '../i18n';
interface Props { disabled: boolean; onOpen: () => void; onExample: () => void; }
export function EmptyState({ disabled, onOpen, onExample }: Props) {
  const { language } = useI18n();
  return localize(<section className="empty-state" aria-label="Open a structure">
    <p className="eyebrow">A CLOSER LOOK</p>
    <h2>Explore a protein.</h2>
    <p>Open a structure from your files.<br />Rotate, zoom, and tap to inspect.</p>
    <button className="primary-button" disabled={disabled} onClick={onOpen}>Open Structure</button>
    <button className="text-button" disabled={disabled} onClick={onExample}>Try Example <span aria-hidden="true">→</span></button>
    <small>PDB / mmCIF · Files stay on this device</small>
  </section>, language);
}
