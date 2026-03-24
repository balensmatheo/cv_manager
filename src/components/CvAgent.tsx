import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import { fetchAuthSession } from 'aws-amplify/auth';
import { toast } from 'sonner';
import {
  Sparkles, Send, X, ChevronDown, ChevronUp, Wrench,
  AlertCircle, Square, Check,
} from 'lucide-react';
import { useResume, type ResumeData } from '../context/ResumeContext';
import outputs from '../../amplify_outputs.json';
import { DN_COLORS } from '../theme/tokens';

const STREAM_URL = (outputs as Record<string, unknown> & { custom?: { cv_agent_stream_url?: string } }).custom?.cv_agent_stream_url || '';
const P = DN_COLORS.primary;
const GRAD = `linear-gradient(135deg, ${DN_COLORS.primary} 0%, ${DN_COLORS.primaryLight} 100%)`;

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  type?: 'text' | 'actions' | 'error';
}

type LoadingPhase = null | 'sending' | 'analyzing' | 'tool_use' | 'applying';

const PHASE_LABELS: Record<string, string> = {
  sending:   'Connexion',
  analyzing: 'Réflexion',
  tool_use:  'Modification du CV',
  applying:  'Finalisation',
};

const SUGGESTIONS = [
  'Reformule mes expériences de manière plus impactante',
  'Y a-t-il des fautes dans mon CV ?',
  'Traduis mon CV en anglais',
  'Adapte mon CV pour un poste de chef de projet',
];

// ── Markdown renderer ────────────────────────────────────────────────────────
function Markdown({ text }: { text: string }) {
  return <>{parseBlocks(text)}</>;
}

function parseBlocks(text: string): ReactNode[] {
  const lines = text.split('\n');
  const result: ReactNode[] = [];
  let listItems: ReactNode[] = [];
  let blockKey = 0;

  const flushList = () => {
    if (listItems.length > 0) {
      result.push(
        <ul key={`ul-${blockKey++}`} style={{ margin: '3px 0', paddingLeft: '14px', listStyle: 'none' }}>
          {listItems}
        </ul>
      );
      listItems = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const headingMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const sizes = { 1: '13px', 2: '12px', 3: '11.5px' } as Record<number, string>;
      result.push(
        <div key={`h-${blockKey++}`} style={{
          fontWeight: 700, fontSize: sizes[level] || '12px',
          color: level <= 2 ? P : '#333',
          margin: '6px 0 3px',
          paddingBottom: level === 1 ? '2px' : undefined,
          borderBottom: level === 1 ? `1px solid ${P}30` : undefined,
        }}>{renderInline(headingMatch[2])}</div>
      );
      continue;
    }

    if (/^\s*[-*]{3,}\s*$/.test(line)) {
      flushList();
      result.push(<hr key={`hr-${blockKey++}`} style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '6px 0' }} />);
      continue;
    }

    const listMatch = line.match(/^\s*(?:[-*•]|\d+[.)]\s)\s*(.+)/);
    if (listMatch) {
      listItems.push(
        <li key={`li-${blockKey++}`} style={{ marginBottom: '2px', paddingLeft: '4px', position: 'relative' }}>
          <span style={{ color: P, position: 'absolute', left: '-10px', top: '0' }}>•</span>
          {renderInline(listMatch[1])}
        </li>
      );
      continue;
    }

    flushList();

    if (!line.trim()) {
      result.push(<div key={`sp-${blockKey++}`} style={{ height: '5px' }} />);
      continue;
    }

    result.push(
      <div key={`p-${blockKey++}`} style={{ marginBottom: '2px' }}>{renderInline(line)}</div>
    );
  }
  flushList();
  return result;
}

function renderInline(text: string): ReactNode {
  const segments: ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    let m = remaining.match(/^(.*?)\*\*(.+?)\*\*(.*)/s);
    if (!m) m = remaining.match(/^(.*?)__(.+?)__(.*)/s);
    if (m) {
      if (m[1]) segments.push(m[1]);
      segments.push(<strong key={key++} style={{ fontWeight: 700 }}>{renderInline(m[2])}</strong>);
      remaining = m[3];
      continue;
    }

    m = remaining.match(/^(.*?)\*(.+?)\*(.*)/s);
    if (m) {
      if (m[1]) segments.push(m[1]);
      segments.push(<em key={key++}>{renderInline(m[2])}</em>);
      remaining = m[3];
      continue;
    }

    m = remaining.match(/^(.*?)`(.+?)`(.*)/s);
    if (m) {
      if (m[1]) segments.push(m[1]);
      segments.push(
        <code key={key++} style={{
          background: '#F0EDF3', padding: '1px 5px', borderRadius: '4px',
          fontSize: '0.92em', fontFamily: "'SF Mono', 'Fira Code', monospace", color: P,
        }}>{m[2]}</code>
      );
      remaining = m[3];
      continue;
    }

    m = remaining.match(/^(.*?)(\b\w[\w\s]*?)\s*:\s+(.+)/);
    if (m && !m[1] && m[2].length < 30) {
      segments.push(<strong key={key++} style={{ fontWeight: 600 }}>{m[2]} :</strong>);
      segments.push(' ');
      remaining = m[3];
      continue;
    }

    segments.push(remaining);
    break;
  }

  if (segments.length === 0) return text;
  if (segments.length === 1) return segments[0];
  return <>{segments.map((s, i) => typeof s === 'string' ? <span key={`t${i}`}>{s}</span> : s)}</>;
}

// ── Thinking indicator (bouncing dots) ───────────────────────────────────────
function ThinkingBubble({ phase }: { phase: LoadingPhase }) {
  const label = phase ? PHASE_LABELS[phase] : null;
  return (
    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', borderRadius: '14px', borderBottomLeftRadius: '4px',
        background: '#F3F4F6',
      }}>
        {/* Bouncing dots */}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: P,
              animation: `cvagent-bounce 1.2s ease-in-out ${i * 0.15}s infinite`,
            }} />
          ))}
        </div>
        {label && (
          <span style={{ fontSize: '11px', color: '#888', fontWeight: 500 }}>{label}</span>
        )}
      </div>
    </div>
  );
}

// ── Streaming bubble ─────────────────────────────────────────────────────────
function StreamingBubble({ content, phase }: { content: string; phase: LoadingPhase }) {
  const showPhase = phase === 'tool_use' || phase === 'applying';
  return (
    <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'flex-start' }}>
      <div style={{
        maxWidth: '88%', padding: '8px 12px', borderRadius: '14px',
        fontSize: '12px', lineHeight: 1.6,
        background: '#F3F4F6', color: '#333',
        borderBottomLeftRadius: '4px',
      }}>
        <Markdown text={content} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ animation: 'cvagent-blink 0.7s ease-in-out infinite', color: P, fontSize: '14px', lineHeight: 1 }}>▍</span>
        </span>
        {showPhase && phase && (
          <div style={{
            marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '10px', color: '#999', fontWeight: 500,
          }}>
            <span style={{ display: 'inline-flex', animation: 'cvagent-spin 1.5s linear infinite' }}>
              <Wrench size={10} />
            </span>
            {PHASE_LABELS[phase]}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Static bubble ────────────────────────────────────────────────────────────
function StaticBubble({ msg }: { msg: Message }) {
  const isError = msg.type === 'error';
  const isActions = msg.type === 'actions';

  return (
    <div style={{
      marginBottom: '8px', display: 'flex', justifyContent: 'flex-start',
      animation: 'cvagent-fadein 0.2s ease-out',
    }}>
      <div style={{
        maxWidth: '88%', padding: '8px 12px', borderRadius: '14px',
        fontSize: '12px', lineHeight: 1.6,
        background: isError ? '#FEF2F2' : isActions ? `${P}0A` : '#F3F4F6',
        color: isError ? '#dc2626' : '#333',
        borderBottomLeftRadius: '4px',
        border: isActions ? `1px solid ${P}18` : isError ? '1px solid #fecaca' : 'none',
      }}>
        {isError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px', fontWeight: 600, fontSize: '11px' }}>
            <AlertCircle size={12} /> Erreur
          </div>
        )}
        {isActions && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', fontWeight: 600, fontSize: '11px', color: P }}>
            <Check size={12} strokeWidth={2.5} /> Modifications appliquées
          </div>
        )}
        <Markdown text={msg.content} />
      </div>
    </div>
  );
}

// ── User bubble ──────────────────────────────────────────────────────────────
function UserBubble({ content }: { content: string }) {
  return (
    <div style={{
      marginBottom: '8px', display: 'flex', justifyContent: 'flex-end',
      animation: 'cvagent-fadein 0.15s ease-out',
    }}>
      <div style={{
        maxWidth: '85%', padding: '8px 12px', borderRadius: '14px',
        fontSize: '12px', lineHeight: 1.5,
        background: P, color: 'white',
        borderBottomRightRadius: '4px',
      }}>
        {content}
      </div>
    </div>
  );
}

// ── Component ────────────────────────────────────────────────────────────────
export default function CvAgent() {
  const { data, loadData } = useResume();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<LoadingPhase>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, phase, streamingText]);

  useEffect(() => {
    if (open && !minimized) inputRef.current?.focus();
  }, [open, minimized]);

  const buildHistory = useCallback((msgs: Message[]): string => {
    const entries = msgs
      .filter(m => m.type !== 'error')
      .map(m => ({ role: m.role, content: m.content }));
    return JSON.stringify(entries);
  }, []);

  const handleStop = () => {
    abortRef.current?.abort();
  };

  const handleSubmit = async () => {
    const text = prompt.trim();
    if (!text || loading) return;

    setPrompt('');
    const userMsg: Message = { role: 'user', content: text, timestamp: new Date() };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setLoading(true);
    setPhase('sending');
    setStreamingText('');
    setIsStreaming(false);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const session = await fetchAuthSession();
      const idToken = session.tokens?.idToken?.toString();
      if (!idToken) throw new Error('Non authentifié');

      const cvJson = JSON.stringify(data);
      const history = buildHistory(updatedMessages.slice(0, -1));

      setPhase('analyzing');

      const response = await fetch(STREAM_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          cvJson,
          prompt: text,
          history: history !== '[]' ? history : undefined,
        }),
        signal: abort.signal,
      });

      if (!response.ok) throw new Error(`Erreur serveur (${response.status})`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Streaming non supporté');

      setIsStreaming(true);

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';
      const accumulatedActions: string[] = [];
      let finalCv: ResumeData | null = null;
      let finalTokens = { input: 0, output: 0, total: 0 };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventType = '';
        for (const line of lines) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            const dataStr = line.slice(6);
            try {
              const eventData = JSON.parse(dataStr);
              switch (eventType) {
                case 'phase':
                  setPhase(eventData.phase as LoadingPhase);
                  break;
                case 'text':
                  accumulatedText += eventData.delta;
                  setStreamingText(accumulatedText);
                  break;
                case 'tool_start':
                  break;
                case 'action':
                  accumulatedActions.push(eventData.text);
                  break;
                case 'done':
                  finalCv = eventData.cv as ResumeData;
                  finalTokens = eventData.tokens;
                  break;
                case 'error':
                  throw new Error(eventData.message);
              }
            } catch (e) {
              if (e instanceof Error && e.message !== dataStr) throw e;
            }
            eventType = '';
          }
        }
      }

      setIsStreaming(false);
      setStreamingText('');

      if (finalCv && accumulatedActions.length > 0) {
        loadData(finalCv);
      }

      const newMessages: Message[] = [];

      if (accumulatedText.trim()) {
        newMessages.push({
          role: 'assistant', content: accumulatedText.trim(),
          timestamp: new Date(), type: 'text',
        });
      }

      if (accumulatedActions.length > 0) {
        newMessages.push({
          role: 'assistant', content: accumulatedActions.map(a => `- ${a}`).join('\n'),
          timestamp: new Date(), type: 'actions',
        });
      }

      if (newMessages.length === 0) {
        newMessages.push({
          role: 'assistant', content: 'Aucune modification effectuée.',
          timestamp: new Date(), type: 'text',
        });
      }

      const last = newMessages[newMessages.length - 1];
      last.content += `\n\n${finalTokens.total} tokens`;

      setMessages(prev => [...prev, ...newMessages]);

      if (accumulatedActions.length > 0) {
        toast.success(`${accumulatedActions.length} modification${accumulatedActions.length > 1 ? 's' : ''} appliquée${accumulatedActions.length > 1 ? 's' : ''}`);
      }
    } catch (err) {
      if (abort.signal.aborted) {
        setMessages(prev => [...prev, {
          role: 'assistant', content: 'Requête annulée.',
          timestamp: new Date(), type: 'text',
        }]);
        setIsStreaming(false);
        setStreamingText('');
        setLoading(false);
        setPhase(null);
        abortRef.current = null;
        return;
      }
      setIsStreaming(false);
      setStreamingText('');
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      setMessages(prev => [...prev, {
        role: 'assistant', content: msg,
        timestamp: new Date(), type: 'error',
      }]);
      toast.error(msg);
    } finally {
      setLoading(false);
      setPhase(null);
      abortRef.current = null;
    }
  };

  // ── Floating button ──
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="no-print"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 500,
          width: '52px', height: '52px', borderRadius: '50%',
          background: GRAD,
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 20px ${P}66`,
          transition: 'transform 0.2s, box-shadow 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = `0 6px 28px ${P}80`; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = `0 4px 20px ${P}66`; }}
        title="Assistant CV"
      >
        <Sparkles size={22} color="white" />
      </button>
    );
  }

  // ── What to show in the message area below existing messages ──
  const renderLiveArea = () => {
    // Streaming text is arriving — show it
    if (isStreaming && streamingText) {
      return <StreamingBubble content={streamingText} phase={phase} />;
    }
    // Loading but no text yet — show thinking dots
    if (loading) {
      return <ThinkingBubble phase={phase} />;
    }
    return null;
  };

  return (
    <div
      className="no-print"
      style={{
        position: 'fixed', bottom: '24px', right: '24px', zIndex: 500,
        width: minimized ? '300px' : '400px',
        background: 'white', borderRadius: '16px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
        border: '1px solid #E5E7EB',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s',
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        background: GRAD,
        padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer',
      }}
        onClick={() => setMinimized(!minimized)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
          <Sparkles size={16} />
          <span style={{ fontWeight: 700, fontSize: '13px' }}>Assistant CV</span>
          {loading && phase && (
            <span style={{
              fontSize: '10px', opacity: 0.9,
              background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '10px',
              display: 'flex', alignItems: 'center', gap: '4px',
              animation: 'cvagent-fadein 0.2s ease-out',
            }}>
              <span style={{
                width: '5px', height: '5px', borderRadius: '50%',
                background: '#4ade80',
                animation: 'cvagent-pulse-dot 1.5s ease-in-out infinite',
              }} />
              {PHASE_LABELS[phase] || 'En cours'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button onClick={e => { e.stopPropagation(); setMinimized(!minimized); }} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px',
            padding: '4px', cursor: 'pointer', display: 'flex', color: 'white',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            {minimized ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button onClick={e => {
            e.stopPropagation();
            abortRef.current?.abort();
            setOpen(false);
          }} style={{
            background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: '6px',
            padding: '4px', cursor: 'pointer', display: 'flex', color: 'white',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.25)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.15)'; }}
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {!minimized && (
        <>
          {/* Messages */}
          <div style={{
            flex: 1, maxHeight: '400px', minHeight: '200px',
            overflowY: 'auto', padding: '12px',
          }}>
            {messages.length === 0 && !loading && (
              <div style={{ textAlign: 'center', padding: '20px 8px' }}>
                <div style={{
                  width: '44px', height: '44px', borderRadius: '14px',
                  background: `${P}10`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 12px',
                }}>
                  <Sparkles size={22} color={P} />
                </div>
                <p style={{ fontSize: '13px', fontWeight: 600, color: '#333', margin: '0 0 4px' }}>
                  Assistant CV
                </p>
                <p style={{ fontSize: '11.5px', color: '#999', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Modifier, analyser, corriger ou traduire votre CV en langage naturel.
                </p>
                {!STREAM_URL && (
                  <p style={{ fontSize: '11px', color: '#ef4444', margin: '0 0 8px' }}>
                    URL de streaming non configurée. Déployez le backend.
                  </p>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {SUGGESTIONS.map((s, i) => (
                    <button key={i} onClick={() => { setPrompt(s); inputRef.current?.focus(); }} style={{
                      background: 'white', border: '1px solid #E5E7EB', borderRadius: '10px',
                      padding: '8px 12px', fontSize: '11.5px', color: '#555',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                      transition: 'all 0.15s', lineHeight: 1.4,
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = `${P}08`; e.currentTarget.style.borderColor = `${P}30`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) =>
              msg.role === 'user'
                ? <UserBubble key={i} content={msg.content} />
                : <StaticBubble key={i} msg={msg} />
            )}

            {renderLiveArea()}
            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div style={{ borderTop: '1px solid #E5E7EB', padding: '10px 12px' }}>
            {/* Stop button when loading */}
            {loading && (
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
                <button
                  onClick={handleStop}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '6px',
                    padding: '5px 14px', borderRadius: '20px',
                    background: 'white', border: '1px solid #E5E7EB',
                    fontSize: '11px', fontWeight: 600, color: '#666',
                    cursor: 'pointer', fontFamily: 'inherit',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#FEF2F2'; e.currentTarget.style.borderColor = '#fecaca'; e.currentTarget.style.color = '#dc2626'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'white'; e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.color = '#666'; }}
                >
                  <Square size={10} fill="currentColor" /> Arrêter
                </button>
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <textarea
                ref={inputRef}
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Modifier ou analyser mon CV..."
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, resize: 'none', border: '1px solid #E5E7EB',
                  borderRadius: '12px', padding: '9px 12px',
                  fontSize: '12px', fontFamily: 'inherit',
                  outline: 'none', maxHeight: '80px',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  opacity: loading ? 0.5 : 1,
                }}
                onFocus={e => { e.currentTarget.style.borderColor = P; e.currentTarget.style.boxShadow = `0 0 0 3px ${P}15`; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#E5E7EB'; e.currentTarget.style.boxShadow = 'none'; }}
              />
              <button
                onClick={() => { void handleSubmit(); }}
                disabled={loading || !prompt.trim()}
                style={{
                  width: '36px', height: '36px', borderRadius: '12px',
                  background: loading || !prompt.trim() ? '#E5E7EB' : GRAD,
                  border: 'none', cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, transition: 'all 0.15s',
                }}
              >
                <Send size={14} color="white" />
              </button>
            </div>

            {/* Char count */}
            <div style={{ padding: '4px 0 0', textAlign: 'right' }}>
              <span style={{ fontSize: '10px', color: prompt.length > 1800 ? '#ef4444' : '#ccc' }}>
                {prompt.length > 0 && `${prompt.length}/2000`}
              </span>
            </div>
          </div>
        </>
      )}

      <style>{`
        @keyframes cvagent-bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        @keyframes cvagent-pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes cvagent-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes cvagent-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes cvagent-fadein {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
