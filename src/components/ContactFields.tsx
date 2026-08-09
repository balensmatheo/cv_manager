import { useResume } from '../context/ResumeContext';
import { DN_COLORS } from '../theme/tokens';

// ── Contact fields ────────────────────────────────────────────────────────────
// Each contact line (email, site web, LinkedIn…) can be removed from the CV.
// Removal is stored in settings.hiddenSections under a `contact.<key>` entry,
// the same mechanism used by the section headers.
export const CONTACT_FIELDS = [
  { key: 'email',    label: 'Email' },
  { key: 'phone',    label: 'Téléphone' },
  { key: 'website',  label: 'Site web' },
  { key: 'linkedin', label: 'LinkedIn' },
  { key: 'address',  label: 'Adresse' },
  { key: 'driving',  label: 'Permis' },
] as const;

export type ContactKey = typeof CONTACT_FIELDS[number]['key'];

export const contactHiddenKey = (k: ContactKey) => `contact.${k}`;

const labelOf = (k: ContactKey) => CONTACT_FIELDS.find(f => f.key === k)!.label;

export function useContactVisibility() {
  const { data, editMode, update } = useResume();
  const hidden = data.settings?.hiddenSections || [];

  const isRemoved = (k: ContactKey) => hidden.includes(contactHiddenKey(k));

  return {
    isRemoved,
    /** Rendered when kept by the user and either filled in or currently editable. */
    isVisible: (k: ContactKey, value?: string) => !isRemoved(k) && !!(value || editMode),
    setRemoved: (k: ContactKey, removed: boolean) => update(d => {
      if (!d.settings) d.settings = { theme: 'dn', showLogo: true, accentColor: DN_COLORS.primary, hiddenSections: [''] };
      if (!d.settings.hiddenSections) d.settings.hiddenSections = [];
      const idx = d.settings.hiddenSections.indexOf(contactHiddenKey(k));
      if (removed && idx < 0) d.settings.hiddenSections.push(contactHiddenKey(k));
      if (!removed && idx >= 0) d.settings.hiddenSections.splice(idx, 1);
    }),
  };
}

/** Small ✕ shown next to a contact line in edit mode. */
export function ContactHideBtn({ field, color = '#c4c4c4' }: { field: ContactKey; color?: string }) {
  const { editMode } = useResume();
  const { setRemoved } = useContactVisibility();
  if (!editMode) return null;
  return (
    <button
      className="no-print"
      onClick={() => setRemoved(field, true)}
      title={`Retirer ${labelOf(field)}`}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
        fontSize: '9px', lineHeight: 1, color, flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.color = '#ef4444'; }}
      onMouseLeave={e => { e.currentTarget.style.color = color; }}
    >✕</button>
  );
}
