import { useState, useRef, type ReactNode } from 'react';
import {
  Briefcase, User, Wrench, GraduationCap, ClipboardList,
  Code, Cpu, Database, Star, Layers, FileText, Settings,
  Trophy, Cloud, BookOpen, Terminal, Mail, Phone, Globe, Linkedin,
  MapPin, Car, Heart,
  type LucideIcon,
} from 'lucide-react';
import { useResume } from '../context/ResumeContext';
import { EditableText, EditableList } from './Editable';
import { SortableList } from './SortableList';
import { FormatToolbar } from './FormatToolbar';
import ColumnDivider, { useColumnSplit } from './ColumnDivider';

const ICON_MAP: Record<string, LucideIcon> = {
  Briefcase, User, Wrench, GraduationCap, ClipboardList,
  Code, Cpu, Database, Star, Layers, FileText, Settings,
  Trophy, Cloud, BookOpen, Terminal, Heart,
};

const ICON_OPTIONS = Object.keys(ICON_MAP);

function IconPicker({ sectionKey, onClose }: { sectionKey: string; onClose: () => void }) {
  const { update, data } = useResume();
  const accent = data.settings?.accentColor || '#C0392B';
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 498 }} onClick={onClose} />
      <div style={{
        position: 'absolute', top: '110%', left: '50%', transform: 'translateX(-50%)',
        background: 'white', borderRadius: '10px', padding: '8px',
        boxShadow: '0 8px 28px rgba(0,0,0,0.22)',
        display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '3px', zIndex: 499, width: '196px', border: '1px solid #ddd',
      }}>
        {ICON_OPTIONS.map(name => {
          const Icon = ICON_MAP[name];
          return (
            <button key={name}
              onClick={() => { update(d => { d.sections[sectionKey as keyof typeof d.sections] = name; }); onClose(); }}
              title={name}
              style={{ padding: '6px', border: 'none', borderRadius: '6px', cursor: 'pointer', background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onMouseEnter={e => { e.currentTarget.style.background = '#f0f0f0'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; }}
            >
              <Icon size={15} color={accent} />
            </button>
          );
        })}
      </div>
    </>
  );
}

function SectionTitle({ iconKey, sectionKey, title, color, hiddenKey }: {
  iconKey: string; sectionKey: string; title: string; color: string; hiddenKey?: string;
}) {
  const { editMode, update } = useResume();
  const [open, setOpen] = useState(false);
  const Icon = ICON_MAP[iconKey] ?? FileText;
  return (
    <div style={{ position: 'relative', marginBottom: '8px', paddingBottom: '4px', borderBottom: `2px solid ${color}` }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '6px',
        fontSize: '11px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color,
      }}>
        <span onClick={() => editMode && setOpen(v => !v)} style={{ display: 'inline-flex', cursor: editMode ? 'pointer' : 'default' }}>
          <Icon size={13} color={color} />
        </span>
        <span style={{ flex: 1 }}>{title}</span>
        {editMode && hiddenKey && (
          <button onClick={() => update(d => {
            if (!d.settings) d.settings = { theme: 'classic', showLogo: true, accentColor: '#C0392B', hiddenSections: [''] };
            if (!d.settings.hiddenSections) d.settings.hiddenSections = [];
            d.settings.hiddenSections.push(hiddenKey);
          })} title={`Masquer ${title}`} style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
            fontSize: '11px', color: '#bbb', lineHeight: 1,
          }}>✕</button>
        )}
      </div>
      {open && <IconPicker sectionKey={sectionKey} onClose={() => setOpen(false)} />}
    </div>
  );
}

function Row({ children, onRemove, dragHandle }: { children: ReactNode; onRemove?: () => void; dragHandle?: ReactNode }) {
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

function SkillBar({ level, color }: { level: number; color: string }) {
  const pct = (level / 5) * 100;
  return (
    <div style={{ width: '100%', height: '4px', background: '#e0e0e0', borderRadius: '2px', marginTop: '2px' }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.3s' }} />
    </div>
  );
}

export default function CVClassic() {
  const { data, update, editMode } = useResume();
  const { personal, sections, summary, experiences, profileSkills, skills, education } = data;
  const interests = data.interests || [];
  const accent = data.settings?.accentColor || '#C0392B';
  const showLogo = data.settings?.showLogo ?? true;
  const hidden = data.settings?.hiddenSections || [];
  const isHidden = (s: string) => hidden.includes(s);
  const bodyRef = useRef<HTMLDivElement>(null);
  const leftPct = useColumnSplit(32);

  return (
    <>
      <FormatToolbar />
      <div className={`cv-page${editMode ? ' edit-active' : ''}`}
        style={{ fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif", fontSize: '10px', color: '#1a1a1a' }}>

        <div ref={bodyRef} style={{ display: 'flex', minHeight: '297mm', position: 'relative' }}>

          <ColumnDivider containerRef={bodyRef} defaultSplit={32} min={22} max={45} />

          {/* ── LEFT SIDEBAR ── */}
          <div style={{
            flex: `0 0 ${leftPct}%`, background: `linear-gradient(180deg, ${accent}08 0%, #F8F8FA 100%)`,
            padding: '22px 18px', borderRight: `2px solid ${accent}25`,
            display: 'flex', flexDirection: 'column',
          }}>
            {/* Photo / Logo area */}
            {showLogo && (
              <div style={{ textAlign: 'center', marginBottom: '14px' }}>
                <img src="/logo-dn.png" alt="Logo" style={{ height: '40px', objectFit: 'contain' }} />
              </div>
            )}

            {/* Name */}
            <div style={{ textAlign: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: `2.5px solid ${accent}` }}>
              <div style={{ fontWeight: 800, fontSize: '19px', color: '#111', lineHeight: 1.15, letterSpacing: '0.03em' }}>
                <EditableText value={personal.firstName} onChange={v => update(d => { d.personal.firstName = v; })} />
                {' '}
                <EditableText value={personal.lastName} onChange={v => update(d => { d.personal.lastName = v; })} />
              </div>
              <div style={{ fontWeight: 600, fontSize: '10.5px', color: accent, marginTop: '5px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                <EditableText value={personal.title} onChange={v => update(d => { d.personal.title = v; })} />
              </div>
            </div>

            {/* Contact */}
            <div style={{ marginBottom: '18px', fontSize: '9px', color: '#444', background: 'white', borderRadius: '8px', padding: '10px 12px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
              {(personal.email || editMode) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <Mail size={11} color={accent} style={{ flexShrink: 0 }} />
                  <EditableText value={personal.email} onChange={v => update(d => { d.personal.email = v; })} />
                </div>
              )}
              {(personal.phone || editMode) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <Phone size={11} color={accent} style={{ flexShrink: 0 }} />
                  <EditableText value={personal.phone} onChange={v => update(d => { d.personal.phone = v; })} />
                </div>
              )}
              {(personal.website || editMode) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <Globe size={11} color={accent} style={{ flexShrink: 0 }} />
                  <EditableText value={personal.website} onChange={v => update(d => { d.personal.website = v; })} />
                </div>
              )}
              {(personal.linkedin || editMode) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <Linkedin size={11} color={accent} style={{ flexShrink: 0 }} />
                  <EditableText value={personal.linkedin} onChange={v => update(d => { d.personal.linkedin = v; })} />
                </div>
              )}
              {(personal.address || editMode) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                  <MapPin size={11} color={accent} style={{ flexShrink: 0 }} />
                  <EditableText value={personal.address || ''} onChange={v => update(d => { d.personal.address = v; })} />
                </div>
              )}
              {(personal.driving || editMode) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Car size={11} color={accent} style={{ flexShrink: 0 }} />
                  <EditableText value={personal.driving || ''} onChange={v => update(d => { d.personal.driving = v; })} />
                </div>
              )}
            </div>

            {/* Profile / Summary */}
            {!isHidden('summary') && <div className="cv-section-block" style={{ marginBottom: '16px' }}>
              <SectionTitle iconKey={sections.summary} sectionKey="summary" title="Profil" color={accent} hiddenKey="summary" />
              <EditableList
                items={summary}
                onChangeItem={(i, v) => update(d => { d.summary[i] = v; })}
                onAddItem={() => update(d => { d.summary.push('Nouvelle compétence'); })}
                onRemoveItem={i => update(d => { d.summary.splice(i, 1); })}
                addLabel="Point"
                renderItem={(_, _idx, editable) => (
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '3px', lineHeight: 1.5, fontSize: '9px' }}>
                    <span style={{ color: accent, fontSize: '7px', flexShrink: 0 }}>●</span>
                    {editable}
                  </div>
                )}
              />
            </div>}

            {/* Skills (simple bullet list for non-technical roles) */}
            {!isHidden('skills') && (skills.length > 0 || editMode) && (
              <div className="cv-section-block" style={{ marginBottom: '16px' }}>
                <SectionTitle iconKey={sections.skills} sectionKey="skills" title="Compétences" color={accent} hiddenKey="skills" />
                <SortableList
                  items={skills}
                  getId={s => s.name}
                  getKey={s => s.name}
                  onReorder={reordered => update(d => { d.skills = reordered; })}
                  renderItem={(skill, si, handle) => (
                    <Row dragHandle={handle} onRemove={() => update(d => { d.skills.splice(si, 1); })}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '4px', lineHeight: 1.5 }}>
                        <span style={{ color: accent, fontSize: '7px', flexShrink: 0 }}>●</span>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: '9px', color: '#222' }}>
                            <EditableText value={skill.name} onChange={v => update(d => { d.skills[si].name = v; })} />
                          </span>
                          {(skill.details || editMode) && (
                            <span style={{ color: '#666', fontSize: '8.5px' }}>
                              {' — '}
                              <EditableText value={skill.details} onChange={v => update(d => { d.skills[si].details = v; })} />
                            </span>
                          )}
                        </div>
                      </div>
                    </Row>
                  )}
                />
                {editMode && (
                  <button onClick={() => update(d => { d.skills.push({ name: 'Compétence', details: '' }); })}
                    style={{ fontSize: '9px', color: accent, background: 'transparent', border: `1px dashed ${accent}`, borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', marginTop: '2px' }}>
                    + Compétence
                  </button>
                )}
              </div>
            )}

            {/* Education */}
            {!isHidden('education') && <div className="cv-section-block" style={{ marginBottom: '16px' }}>
              <SectionTitle iconKey={sections.education} sectionKey="education" title="Formations" color={accent} hiddenKey="education" />
              <SortableList
                items={education}
                getId={e => e.years}
                getKey={e => e.years}
                onReorder={reordered => update(d => { d.education = reordered; })}
                renderItem={(edu, ei, handle) => (
                  <Row dragHandle={handle} onRemove={() => update(d => { d.education.splice(ei, 1); })}>
                    <div style={{ marginBottom: '8px' }}>
                      <div style={{ fontWeight: 700, fontSize: '9.5px', color: accent }}>
                        <EditableText value={edu.years} onChange={v => update(d => { d.education[ei].years = v; })} />
                      </div>
                      <div style={{ fontSize: '9px', color: '#222', lineHeight: 1.4 }}>
                        <EditableText value={edu.degree} onChange={v => update(d => { d.education[ei].degree = v; })} />
                      </div>
                      <div style={{ fontSize: '8.5px', color: '#777', fontStyle: 'italic' }}>
                        <EditableText value={edu.school} onChange={v => update(d => { d.education[ei].school = v; })} />
                      </div>
                    </div>
                  </Row>
                )}
              />
              {editMode && (
                <button onClick={() => update(d => { d.education.push({ years: '20XX', degree: 'Diplôme', school: 'École' }); })}
                  style={{ fontSize: '9px', color: accent, background: 'transparent', border: `1px dashed ${accent}`, borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', marginTop: '2px' }}>
                  + Formation
                </button>
              )}
            </div>}

            {/* Centres d'intérêts */}
            {!isHidden('interests') && (interests.length > 0 || editMode) && (
              <div className="cv-section-block" style={{ marginBottom: '16px' }}>
                <SectionTitle iconKey={sections.interests || 'Heart'} sectionKey="interests" title="Centres d'intérêts" color={accent} hiddenKey="interests" />
                <EditableList
                  items={interests}
                  onChangeItem={(i, v) => update(d => { d.interests[i] = v; })}
                  onAddItem={() => update(d => { d.interests.push('Nouveau centre d\'intérêt'); })}
                  onRemoveItem={i => update(d => { d.interests.splice(i, 1); })}
                  addLabel="Intérêt"
                  renderItem={(_, _idx, editable) => (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '3px', lineHeight: 1.5, fontSize: '9px' }}>
                      <span style={{ color: accent, fontSize: '7px', flexShrink: 0 }}>●</span>
                      {editable}
                    </div>
                  )}
                />
              </div>
            )}

            {/* Profile Skills (bar chart) — only shown if data exists or in edit mode */}
            {!isHidden('profile') && (profileSkills.length > 0 || editMode) && (
              <div className="cv-section-block">
                <SectionTitle iconKey={sections.profile} sectionKey="profile" title="Profil technique" color={accent} hiddenKey="profile" />
                <SortableList
                  items={profileSkills}
                  getId={s => s.name}
                  getKey={s => s.name}
                  onReorder={reordered => update(d => { d.profileSkills = reordered; })}
                  renderItem={(skill, si, handle) => (
                    <Row dragHandle={handle} onRemove={() => update(d => { d.profileSkills.splice(si, 1); })}>
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <EditableText value={skill.name} onChange={v => update(d => { d.profileSkills[si].name = v; })}
                            style={{ fontWeight: 600, fontSize: '9px', color: '#222' }} />
                          {editMode && (
                            <select value={skill.level} onChange={e => update(d => { d.profileSkills[si].level = parseFloat(e.target.value); })}
                              style={{ fontSize: '8px', border: '1px solid #ccc', borderRadius: '3px', padding: '1px 2px' }}>
                              {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map(l => (
                                <option key={l} value={l}>{l}/5</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <SkillBar level={skill.level} color={accent} />
                      </div>
                    </Row>
                  )}
                />
                {editMode && (
                  <button onClick={() => update(d => { d.profileSkills.push({ name: 'Compétence', level: 3 }); })}
                    style={{ fontSize: '9px', color: accent, background: 'transparent', border: `1px dashed ${accent}`, borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', marginTop: '2px' }}>
                    + Compétence
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── RIGHT MAIN AREA ── */}
          <div style={{ flex: 1, padding: '22px 20px 14px 18px' }}>

            {/* Subtitle / Stack */}
            {(personal.subtitle || editMode) && (
              <div style={{ textAlign: 'center', marginBottom: data.hook ? '10px' : '16px', paddingBottom: '10px', borderBottom: data.hook ? 'none' : '1px solid #eee' }}>
                <div style={{ fontWeight: 500, fontSize: '11px', color: accent, letterSpacing: '0.04em' }}>
                  <EditableText value={personal.subtitle} onChange={v => update(d => { d.personal.subtitle = v; })} />
                </div>
                {(personal.company || editMode) && (
                  <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>
                    <EditableText value={personal.company} onChange={v => update(d => { d.personal.company = v; })} />
                  </div>
                )}
              </div>
            )}

            {/* Accroche */}
            {(data.hook || editMode) && (
              <div style={{
                marginBottom: '16px', paddingBottom: '10px', borderBottom: '1px solid #eee',
                fontSize: '9.5px', color: '#444', lineHeight: 1.6, textAlign: 'justify',
              }}>
                <EditableText value={data.hook || ''} onChange={v => update(d => { d.hook = v; })} />
              </div>
            )}

            {/* Experiences */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                <div style={{ flex: 1 }}>
                  <SectionTitle iconKey={sections.experiences} sectionKey="experiences" title="Expériences professionnelles" color={accent} />
                </div>
                {editMode && (
                  <button onClick={() => update(d => {
                    d.experiences.push({
                      id: `exp-${Date.now()}`, title: 'Nouveau poste', client: 'Client',
                      startDate: '2025', endDate: "Aujourd'hui",
                      missions: [{ id: `m-${Date.now()}`, name: 'Description mission', tasks: ['Tâche 1'], tools: '' }],
                    });
                  })} style={{
                    fontSize: '9px', color: accent, background: 'transparent',
                    border: `1px dashed ${accent}`, borderRadius: '4px', padding: '2px 8px',
                    cursor: 'pointer', whiteSpace: 'nowrap', marginBottom: '10px',
                  }}>
                    + Expérience
                  </button>
                )}
              </div>

              <SortableList
                items={experiences}
                getId={exp => exp.id}
                getKey={exp => exp.id}
                onReorder={reordered => update(d => { d.experiences = reordered; })}
                renderItem={(exp, ei, dragHandle) => (
                  <div className="cv-exp-block" style={{
                    marginBottom: '14px', paddingBottom: '12px',
                    borderBottom: ei < experiences.length - 1 ? `1px solid ${accent}15` : 'none',
                  }}>
                    <Row dragHandle={dragHandle} onRemove={() => update(d => { d.experiences.splice(ei, 1); })}>
                      <div style={{ marginBottom: '6px' }}>
                        <div style={{ fontWeight: 700, fontSize: '11.5px', color: '#111', lineHeight: 1.3 }}>
                          <EditableText value={exp.title} onChange={v => update(d => { d.experiences[ei].title = v; })} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span style={{ color: accent, fontWeight: 700, fontSize: '10px' }}>
                            <EditableText value={exp.client} onChange={v => update(d => { d.experiences[ei].client = v; })} />
                          </span>
                          <span style={{ color: '#999', fontSize: '9px', letterSpacing: '0.02em', fontStyle: 'italic' }}>
                            <EditableText value={exp.startDate} onChange={v => update(d => { d.experiences[ei].startDate = v; })} />
                            {' – '}
                            <EditableText value={exp.endDate} onChange={v => update(d => { d.experiences[ei].endDate = v; })} />
                          </span>
                        </div>
                      </div>
                    </Row>

                    {/* Missions — flattened: no "Mission:" label, just tasks directly */}
                    <SortableList
                      items={exp.missions}
                      getId={m => m.id}
                      getKey={m => m.id}
                      onReorder={reordered => update(d => { d.experiences[ei].missions = reordered; })}
                      renderItem={(mission, mi, mHandle) => (
                        <div className="cv-mission-block" style={{ marginBottom: '4px' }}>
                          {/* Show mission name only if multiple missions or in edit mode */}
                          {(exp.missions.length > 1 || editMode) && (
                            <Row dragHandle={mHandle} onRemove={() => update(d => { d.experiences[ei].missions.splice(mi, 1); })}>
                              <div style={{ marginBottom: '2px', lineHeight: 1.5 }}>
                                <span style={{ fontWeight: 600, color: '#333', fontSize: '9.5px' }}>
                                  <EditableText value={mission.name} onChange={v => update(d => { d.experiences[ei].missions[mi].name = v; })} />
                                </span>
                              </div>
                            </Row>
                          )}
                          <EditableList
                            items={mission.tasks}
                            onChangeItem={(ti, v) => update(d => { d.experiences[ei].missions[mi].tasks[ti] = v; })}
                            onAddItem={() => update(d => { d.experiences[ei].missions[mi].tasks.push('Nouvelle tâche'); })}
                            onRemoveItem={ti => update(d => { d.experiences[ei].missions[mi].tasks.splice(ti, 1); })}
                            addLabel="Tâche"
                            renderItem={(_, _ti, editable) => (
                              <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', marginBottom: '2px', paddingLeft: '4px', lineHeight: 1.5 }}>
                                <span style={{ color: accent, flexShrink: 0, fontSize: '7px' }}>●</span>
                                {editable}
                              </div>
                            )}
                          />
                          {editMode && mission.tools && (
                            <div style={{ marginTop: '3px', paddingLeft: '4px' }}>
                              <span style={{ fontSize: '8.5px', color: '#888', fontStyle: 'italic' }}>Outils : </span>
                              <EditableText value={mission.tools}
                                onChange={v => update(d => { d.experiences[ei].missions[mi].tools = v; })}
                                style={{ fontSize: '8.5px', color: '#555', fontStyle: 'italic' }} />
                            </div>
                          )}
                        </div>
                      )}
                    />
                    {editMode && (
                      <button onClick={() => update(d => {
                        d.experiences[ei].missions.push({ id: `m-${Date.now()}`, name: 'Nouvelle mission', tasks: ['Tâche 1'], tools: '' });
                      })} style={{
                        fontSize: '9px', color: accent, background: 'transparent',
                        border: `1px dashed ${accent}`, borderRadius: '4px', padding: '2px 7px', cursor: 'pointer', marginTop: '3px',
                      }}>
                        + Mission
                      </button>
                    )}
                  </div>
                )}
              />
            </div>

            {/* Footer */}
            {(personal.website || editMode) && (
              <div style={{ borderTop: `1px solid ${accent}`, paddingTop: '6px', textAlign: 'center', color: accent, fontSize: '8.5px', letterSpacing: '0.04em', marginTop: '8px' }}>
                <EditableText value={personal.website} onChange={v => update(d => { d.personal.website = v; })} />
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
