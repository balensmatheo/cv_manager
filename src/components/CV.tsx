import { useState, type ReactNode } from 'react';
import {
  Briefcase, User, Wrench, GraduationCap, ClipboardList,
  Code, Cpu, Database, Star, Layers, FileText, Settings,
  Trophy, Cloud, BookOpen, Terminal, type LucideIcon,
} from 'lucide-react';
import { useResume } from '../context/ResumeContext';
import { EditableText, EditableList } from './Editable';
import { SortableList } from './SortableList';
import { FormatToolbar } from './FormatToolbar';

// ── Constants ─────────────────────────────────────────────────────────────────
const P = '#7B2882';
const P2 = '#9B3AA8';

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase, User, Wrench, GraduationCap, ClipboardList,
  Code, Cpu, Database, Star, Layers, FileText, Settings,
  Trophy, Cloud, BookOpen, Terminal,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

// ── Icon Picker ───────────────────────────────────────────────────────────────
function IconPicker({ sectionKey, onClose }: { sectionKey: string; onClose: () => void }) {
  const { update } = useResume();
  return (
    <>
      {/* Backdrop */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 498 }}
        onClick={onClose}
      />
      {/* Picker popup */}
      <div style={{
        position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)',
        background: 'white', borderRadius: '10px', padding: '8px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '3px', zIndex: 499, width: '196px',
        border: '1px solid #EDD5F5',
      }}>
        {ICON_OPTIONS.map(name => {
          const Icon = ICON_MAP[name];
          return (
            <button
              key={name}
              onClick={() => { update(d => { d.sections[sectionKey as keyof typeof d.sections] = name; }); onClose(); }}
              title={name}
              style={{
                padding: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = '#F5EBF7'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <Icon size={15} color={P} />
            </button>
          );
        })}
      </div>
    </>
  );
}

// ── Section Bar ───────────────────────────────────────────────────────────────
function SectionBar({ iconKey, sectionKey, title, right = false }: {
  iconKey: string; sectionKey: string; title: string; right?: boolean;
}) {
  const { editMode } = useResume();
  const [open, setOpen] = useState(false);
  const Icon = ICON_MAP[iconKey] ?? FileText;

  const iconEl = (
    <span
      onClick={() => editMode && setOpen(v => !v)}
      title={editMode ? 'Cliquer pour changer l\'icône' : undefined}
      style={{
        display: 'inline-flex', alignItems: 'center',
        cursor: editMode ? 'pointer' : 'default',
        padding: editMode ? '2px' : '0',
        borderRadius: '4px',
        transition: 'background 0.15s',
        background: editMode && open ? 'rgba(255,255,255,0.2)' : 'transparent',
      }}
      onMouseEnter={e => { if (editMode) e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
      onMouseLeave={e => { if (!open) e.currentTarget.style.background = 'transparent'; }}
    >
      <Icon size={13} color="white" />
    </span>
  );

  return (
    <div style={{ position: 'relative', marginBottom: '10px' }}>
      <div style={{
        background: P, color: 'white',
        display: 'flex', alignItems: 'center',
        justifyContent: right ? 'flex-end' : 'flex-start',
        gap: '6px', padding: '5px 10px',
        fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase',
      }}>
        {right ? <><span>{title}</span>{iconEl}</> : <>{iconEl}<span>{title}</span></>}
      </div>
      {open && <IconPicker sectionKey={sectionKey} onClose={() => setOpen(false)} />}
    </div>
  );
}

// ── Tool Badges ───────────────────────────────────────────────────────────────
function ToolBadges({ tools }: { tools: string }) {
  return (
    <div style={{ marginTop: '5px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
      {tools.split(',').map((t, i) => t.trim() && (
        <span key={i} style={{
          background: '#EDD5F5', color: P, fontSize: '8.5px',
          fontWeight: 600, padding: '2px 7px', borderRadius: '10px',
          letterSpacing: '0.02em',
        }}>
          {t.trim()}
        </span>
      ))}
    </div>
  );
}

// ── Skill level label (ATS-readable text) ─────────────────────────────────────
function levelLabel(level: number): string {
  if (level >= 5) return 'Expert';
  if (level >= 4) return 'Avancé';
  if (level >= 3) return 'Intermédiaire';
  if (level >= 2) return 'Débutant';
  return 'Notions';
}

// ── Skill Chevrons ────────────────────────────────────────────────────────────
function SkillChevrons({ level, onChange }: { level: number; onChange?: (l: number) => void }) {
  const { editMode } = useResume();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
      {/* ATS-readable text label — placed before chevrons so chevrons stay right-aligned */}
      <span style={{ fontSize: '7px', color: '#bbb', fontStyle: 'italic', whiteSpace: 'nowrap', marginRight: '2px' }}>
        {levelLabel(level)}
      </span>
      {[1, 2, 3, 4, 5].map(i => {
        const isFull = level >= i;
        const isHalf = !isFull && level >= i - 0.5;
        // Left zone: toggle half. Right zone: toggle full.
        const clickLeft = () => onChange && onChange(isHalf ? i - 1 : i - 0.5);
        const clickRight = () => onChange && onChange(isFull ? i - 0.5 : i);
        return (
          <div key={i} style={{ position: 'relative', width: 16, height: 12, flexShrink: 0 }}>
            <svg width="16" height="12" viewBox="0 0 16 12" aria-hidden="true">
              {/* Left arrow — lit when half OR full */}
              <path d="M1 1L5 6L1 11"
                stroke={isHalf || isFull ? P : '#D8B4E2'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              {/* Right arrow — lit only when full */}
              <path d="M7 1L11 6L7 11"
                stroke={isFull ? P : '#D8B4E2'}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </svg>
            {editMode && (
              <>
                <div style={{ position: 'absolute', top: 0, left: 0, width: '50%', height: '100%', cursor: 'pointer' }}
                  onClick={clickLeft} title="Demi niveau" />
                <div style={{ position: 'absolute', top: 0, left: '50%', width: '50%', height: '100%', cursor: 'pointer' }}
                  onClick={clickRight} title="Niveau plein" />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Section row wrapper with remove button ────────────────────────────────────
function Row({ children, onRemove, dragHandle }: {
  children: ReactNode; onRemove?: () => void; dragHandle?: ReactNode;
}) {
  const { editMode } = useResume();
  return (
    <div className="edit-row" style={{ display: 'flex', alignItems: 'flex-start', gap: '3px' }}>
      {editMode && dragHandle}
      <div style={{ flex: 1 }}>{children}</div>
      {editMode && onRemove && (
        <button className="edit-btn-remove" onClick={onRemove}
          style={{ color: '#cc3333', fontSize: '13px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px', flexShrink: 0 }}>
          ✕
        </button>
      )}
    </div>
  );
}

// ── Main CV ───────────────────────────────────────────────────────────────────
export default function CV() {
  const { data, update, editMode } = useResume();
  const { personal, sections, summary, experiences, profileSkills, skills, education } = data;

  return (
    <>
      <FormatToolbar />

      <div
        className={`cv-page${editMode ? ' edit-active' : ''}`}
        style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", fontSize: '10px', color: '#1a1a1a' }}
      >
        {/* ── HEADER ── */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '14px 18px 12px', borderBottom: `2.5px solid ${P}`,
        }}>
          <img src="/logo-dn.png" alt="Decision Network" style={{ height: '52px', objectFit: 'contain' }} />
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: P, fontWeight: 800, fontSize: '16px', letterSpacing: '0.04em', lineHeight: 1.1 }}>
              <EditableText value={personal.firstName} onChange={v => update(d => { d.personal.firstName = v; })} />
              {' '}
              <EditableText value={personal.lastName} onChange={v => update(d => { d.personal.lastName = v; })} />
            </div>
            <div style={{ color: '#777', fontSize: '8.5px', marginTop: '4px', letterSpacing: '0.02em', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <EditableText value={personal.email} onChange={v => update(d => { d.personal.email = v; })} />
              <span style={{ color: '#ccc' }}>·</span>
              <EditableText value={personal.phone} onChange={v => update(d => { d.personal.phone = v; })} />
              <span style={{ color: '#ccc' }}>·</span>
              <EditableText value={personal.website} onChange={v => update(d => { d.personal.website = v; })} />
            </div>
            <div style={{ color: '#7B2882', fontSize: '8.5px', marginTop: '1px', letterSpacing: '0.02em', textAlign: 'right', opacity: 0.8 }}>
              <EditableText value={personal.linkedin} onChange={v => update(d => { d.personal.linkedin = v; })} />
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ display: 'flex', minHeight: 'calc(297mm - 84px)' }}>

          {/* ──── LEFT COLUMN ──── */}
          <div style={{ flex: '1 1 59%', padding: '14px 14px 14px 18px', borderRight: `1px solid #E8D5F0` }}>

            {/* Title */}
            <div style={{ textAlign: 'center', marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid #EDD5F5` }}>
              <div style={{ fontWeight: 800, fontSize: '14px', letterSpacing: '0.04em', color: '#111' }}>
                <EditableText value={personal.title} onChange={v => update(d => { d.personal.title = v; })} />
              </div>
              <div style={{ fontWeight: 500, fontSize: '11px', color: P2, marginTop: '3px', letterSpacing: '0.04em' }}>
                <EditableText value={personal.subtitle} onChange={v => update(d => { d.personal.subtitle = v; })} />
              </div>
            </div>

            {/* ── EN BREF ── */}
            <div style={{ marginBottom: '14px' }}>
              <SectionBar iconKey={sections.summary} sectionKey="summary" title="Profil" />
              <EditableList
                items={summary}
                onChangeItem={(i, v) => update(d => { d.summary[i] = v; })}
                onAddItem={() => update(d => { d.summary.push('Nouvelle compétence'); })}
                onRemoveItem={i => update(d => { d.summary.splice(i, 1); })}
                addLabel="Ajouter un point"
                renderItem={(_, _idx, editable) => (
                  <div style={{
                    display: 'flex', alignItems: 'baseline', gap: '6px',
                    marginBottom: '4px', lineHeight: 1.55,
                    fontWeight: 400,
                    color: '#222',
                  }}>
                    <span style={{ color: P, fontSize: '8px', flexShrink: 0 }}>◆</span>
                    {editable}
                  </div>
                )}
              />
            </div>

            {/* ── MISSIONS / EXPERIENCES ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ flex: 1 }}>
                  <SectionBar iconKey={sections.experiences} sectionKey="experiences" title="Expériences professionnelles" />
                </div>
                {editMode && (
                  <button
                    onClick={() => update(d => {
                      d.experiences.push({
                        id: `exp-${Date.now()}`,
                        title: 'Nouveau poste', client: 'Client', startDate: '2025', endDate: "Aujourd'hui",
                        missions: [{ id: `m-${Date.now()}`, name: 'Description mission', tasks: ['Tâche 1'], tools: '' }],
                      });
                    })}
                    style={{
                      fontSize: '9.5px', color: P, background: 'rgba(123,40,130,0.07)',
                      border: '1px dashed ' + P, borderRadius: '4px', padding: '2px 8px',
                      cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '10px',
                    }}
                  >
                    + Expérience
                  </button>
                )}
              </div>

              <SortableList
                items={experiences}
                getId={(exp) => exp.id}
                getKey={(exp) => exp.id}
                onReorder={reordered => update(d => { d.experiences = reordered; })}
                renderItem={(exp, ei, dragHandle) => (
                  <div style={{
                    marginBottom: '14px', paddingBottom: '10px',
                    borderBottom: ei < experiences.length - 1 ? '1px solid #F5EBF7' : 'none',
                  }}>
                    {/* Exp header */}
                    <Row
                      dragHandle={dragHandle}
                      onRemove={() => update(d => { d.experiences.splice(ei, 1); })}
                    >
                      <div style={{ marginBottom: '5px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', color: '#111', lineHeight: 1.25 }}>
                          <EditableText value={exp.title} onChange={v => update(d => { d.experiences[ei].title = v; })} />
                          {exp.client && (
                            <span style={{ color: P, fontWeight: 600 }}>
                              {' — '}
                              <EditableText value={exp.client} onChange={v => update(d => { d.experiences[ei].client = v; })} />
                            </span>
                          )}
                        </div>
                        <div style={{ color: '#999', fontSize: '9px', marginTop: '2px', letterSpacing: '0.02em' }}>
                          <EditableText value={exp.startDate} onChange={v => update(d => { d.experiences[ei].startDate = v; })} />
                          {' – '}
                          <EditableText value={exp.endDate} onChange={v => update(d => { d.experiences[ei].endDate = v; })} />
                        </div>
                      </div>
                    </Row>

                    {/* Missions */}
                    <SortableList
                      items={exp.missions}
                      getId={(m) => m.id}
                      getKey={(m) => m.id}
                      onReorder={reordered => update(d => { d.experiences[ei].missions = reordered; })}
                      renderItem={(mission, mi, mHandle) => (
                        <div style={{ marginBottom: '8px', paddingLeft: editMode ? '0' : '4px' }}>
                          <Row dragHandle={mHandle} onRemove={() => update(d => { d.experiences[ei].missions.splice(mi, 1); })}>
                            <div style={{ marginBottom: '4px', lineHeight: 1.5 }}>
                              <span style={{ fontWeight: 600, color: '#333' }}>Mission : </span>
                              <EditableText value={mission.name} onChange={v => update(d => { d.experiences[ei].missions[mi].name = v; })} />
                            </div>
                          </Row>

                          {/* Tasks */}
                          <EditableList
                            items={mission.tasks}
                            onChangeItem={(ti, v) => update(d => { d.experiences[ei].missions[mi].tasks[ti] = v; })}
                            onAddItem={() => update(d => { d.experiences[ei].missions[mi].tasks.push('Nouvelle tâche'); })}
                            onRemoveItem={ti => update(d => { d.experiences[ei].missions[mi].tasks.splice(ti, 1); })}
                            addLabel="Ajouter une tâche"
                            renderItem={(_, _ti, editable) => (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '2px', paddingLeft: '8px', lineHeight: 1.5 }}>
                                <span style={{ color: P, flexShrink: 0, fontSize: '9px' }}>○</span>
                                {editable}
                              </div>
                            )}
                          />

                          {/* Tools */}
                          {editMode ? (
                            <div style={{ marginTop: '4px' }}>
                              <span style={{ fontSize: '9px', color: '#888', fontStyle: 'italic' }}>Outils : </span>
                              <EditableText
                                value={mission.tools}
                                onChange={v => update(d => { d.experiences[ei].missions[mi].tools = v; })}
                                style={{ fontSize: '9px', color: '#555', fontStyle: 'italic' }}
                              />
                            </div>
                          ) : (
                            mission.tools && <ToolBadges tools={mission.tools} />
                          )}
                        </div>
                      )}
                    />

                    {editMode && (
                      <button onClick={() => update(d => {
                        d.experiences[ei].missions.push({ id: `m-${Date.now()}`, name: 'Nouvelle mission', tasks: ['Tâche 1'], tools: '' });
                      })} style={{
                        fontSize: '9px', color: P, background: 'rgba(123,40,130,0.06)',
                        border: '1px dashed ' + P, borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', marginTop: '4px',
                      }}>
                        + Mission
                      </button>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Footer */}
            <div style={{ borderTop: `1px solid ${P}`, paddingTop: '6px', textAlign: 'center', color: P, fontSize: '9px', letterSpacing: '0.04em', marginTop: '8px' }}>
              <EditableText value={personal.website} onChange={v => update(d => { d.personal.website = v; })} />
            </div>
          </div>

          {/* ──── RIGHT COLUMN ──── */}
          <div style={{ flex: '0 0 41%', padding: '14px 18px 14px 12px', background: '#FAFAFA' }}>

            {/* ── PROFIL ── */}
            <div style={{ marginBottom: '16px' }}>
              <SectionBar iconKey={sections.profile} sectionKey="profile" title="Profil technique" right />
              <div style={{ padding: '0 4px' }}>
                <SortableList
                  items={profileSkills}
                  getId={(s) => s.name}
                  getKey={(s) => s.name}
                  onReorder={reordered => update(d => { d.profileSkills = reordered; })}
                  renderItem={(skill, si, handle) => (
                    <Row dragHandle={handle} onRemove={() => update(d => { d.profileSkills.splice(si, 1); })}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '9px', gap: '6px' }}>
                        <EditableText
                          value={skill.name}
                          onChange={v => update(d => { d.profileSkills[si].name = v; })}
                          style={{ fontWeight: 600, fontSize: '10px', color: '#111', flex: 1 }}
                        />
                        <SkillChevrons level={skill.level} onChange={l => update(d => { d.profileSkills[si].level = l; })} />
                      </div>
                    </Row>
                  )}
                />
                {editMode && (
                  <button onClick={() => update(d => { d.profileSkills.push({ name: 'Compétence', level: 2 }); })}
                    style={{ fontSize: '9.5px', color: P, background: 'rgba(123,40,130,0.07)', border: '1px dashed ' + P, borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', marginTop: '2px' }}>
                    + Compétence
                  </button>
                )}
              </div>
            </div>

            {/* ── COMPETENCES ── */}
            <div style={{ marginBottom: '16px' }}>
              <SectionBar iconKey={sections.skills} sectionKey="skills" title="Compétences" right />
              <div style={{ textAlign: 'center' }}>
                <SortableList
                  items={skills}
                  getId={(s) => s.name}
                  getKey={(s) => s.name}
                  onReorder={reordered => update(d => { d.skills = reordered; })}
                  renderItem={(skill, si, handle) => (
                    <Row dragHandle={handle} onRemove={() => update(d => { d.skills.splice(si, 1); })}>
                      <div style={{ marginBottom: '9px', textAlign: 'center' }}>
                        <div style={{ fontWeight: 700, color: P2, fontSize: '10px', marginBottom: '1px' }}>
                          <EditableText value={skill.name} onChange={v => update(d => { d.skills[si].name = v; })} />
                        </div>
                        {(skill.details || editMode) && (
                          <div style={{ color: '#555', fontSize: '9px', lineHeight: 1.5, whiteSpace: 'pre-line' }}>
                            <EditableText value={skill.details} onChange={v => update(d => { d.skills[si].details = v; })} />
                          </div>
                        )}
                      </div>
                    </Row>
                  )}
                />
                {editMode && (
                  <button onClick={() => update(d => { d.skills.push({ name: 'Outil', details: 'Détails' }); })}
                    style={{ fontSize: '9.5px', color: P, background: 'rgba(123,40,130,0.07)', border: '1px dashed ' + P, borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', marginTop: '2px' }}>
                    + Compétence
                  </button>
                )}
              </div>
            </div>

            {/* ── FORMATIONS ── */}
            <div>
              <SectionBar iconKey={sections.education} sectionKey="education" title="Formations" right />
              <div style={{ textAlign: 'center' }}>
                <SortableList
                  items={education}
                  getId={(e) => e.years}
                  getKey={(e) => e.years}
                  onReorder={reordered => update(d => { d.education = reordered; })}
                  renderItem={(edu, ei, handle) => (
                    <Row dragHandle={handle} onRemove={() => update(d => { d.education.splice(ei, 1); })}>
                      <div style={{ marginBottom: '9px', paddingBottom: '7px', textAlign: 'center', borderBottom: ei < education.length - 1 ? '1px solid #EDD5F5' : 'none' }}>
                        <div style={{ fontWeight: 700, color: P, fontSize: '10px' }}>
                          <EditableText value={edu.years} onChange={v => update(d => { d.education[ei].years = v; })} />
                        </div>
                        <div style={{ fontSize: '9.5px', color: '#222', lineHeight: 1.4 }}>
                          <EditableText value={edu.degree} onChange={v => update(d => { d.education[ei].degree = v; })} />
                        </div>
                        <div style={{ fontSize: '9px', color: '#777', fontStyle: 'italic' }}>
                          <EditableText value={edu.school} onChange={v => update(d => { d.education[ei].school = v; })} />
                        </div>
                      </div>
                    </Row>
                  )}
                />
                {editMode && (
                  <button onClick={() => update(d => { d.education.push({ years: '20XX – 20XX', degree: 'Diplôme', school: 'École' }); })}
                    style={{ fontSize: '9.5px', color: P, background: 'rgba(123,40,130,0.07)', border: '1px dashed ' + P, borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', marginTop: '2px' }}>
                    + Formation
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
