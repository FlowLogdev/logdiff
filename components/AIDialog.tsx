'use client';

import React from 'react';

export interface Issue {
  lineClient: string | null;
  lineDynatrace: string | null;
  source: 'client' | 'dynatrace' | 'both';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  fix: string;
}

export interface AnalysisResult {
  verdict: 'pass' | 'fail';
  summary: string;
  issues: Issue[];
}

export interface EngineState {
  loading: boolean;
  error: string | null;
  result: AnalysisResult | null;
}

interface Props {
  claude: EngineState;
  openai: EngineState;
}

function Spinner({ label }: { label: string }) {
  const [dots, setDots] = React.useState('');
  React.useEffect(() => {
    const id = setInterval(() => setDots(d => (d.length >= 3 ? '' : d + '.')), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '32px 0' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        border: '3px solid var(--border)',
        borderTopColor: 'var(--accent-client)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 13 }}>
        {label}{dots}
      </span>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const sevStyle: Record<string, { bg: string; color: string; border: string }> = {
  high:   { bg: 'var(--sev-high-dim)',   color: 'var(--sev-high)',   border: 'var(--sev-high)' },
  medium: { bg: 'var(--sev-medium-dim)', color: 'var(--sev-medium)', border: 'var(--sev-medium)' },
  low:    { bg: 'var(--sev-low-dim)',    color: 'var(--sev-low)',    border: 'var(--sev-low)' },
};

const srcStyle: Record<string, { bg: string; color: string; border: string }> = {
  client:    { bg: 'var(--accent-client-dim)', color: 'var(--accent-client)', border: 'var(--accent-client-border)' },
  dynatrace: { bg: 'var(--accent-dt-dim)',     color: 'var(--accent-dt)',     border: 'var(--accent-dt-border)' },
  both:      { bg: 'var(--sev-medium-dim)',    color: 'var(--sev-medium)',    border: 'var(--sev-medium)' },
};

function Badge({ label, style }: { label: string; style: { bg: string; color: string; border: string } }) {
  return (
    <span style={{
      background: style.bg, color: style.color,
      border: `1px solid ${style.border}`,
      borderRadius: 4, padding: '1px 7px',
      fontSize: 11, fontWeight: 600,
      fontFamily: 'var(--font-sans)',
      whiteSpace: 'nowrap',
    }}>{label}</span>
  );
}

function EnginePanel({
  engine, loading, error, result,
}: {
  engine: 'claude' | 'openai';
  loading: boolean;
  error: string | null;
  result: AnalysisResult | null;
}) {
  const accentColor = engine === 'claude' ? 'var(--accent-client)' : 'var(--accent-dt)';
  const label = engine === 'claude' ? 'Claude (Anthropic)' : 'GPT-4o (OpenAI Codex)';
  const icon = engine === 'claude' ? '⬡' : '◈';

  return (
    <div style={{
      flex: 1,
      border: '1px solid var(--border)',
      borderRadius: 10,
      background: 'var(--bg-surface)',
      overflow: 'hidden',
      minWidth: 0,
    }}>
      {/* Panel header */}
      <div style={{
        padding: '8px 14px',
        background: 'var(--bg-surface-2)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 8,
        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
      }}>
        <span style={{ color: accentColor, fontSize: 15 }}>{icon}</span>
        <span style={{ color: accentColor }}>{label}</span>
        {loading && (
          <span style={{
            marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>analyzing…</span>
        )}
        {result && !loading && (
          <span style={{
            marginLeft: 'auto',
            fontSize: 11, fontWeight: 600,
            color: result.verdict === 'pass' ? 'var(--sev-low)' : 'var(--sev-high)',
          }}>
            {result.verdict === 'pass' ? '✓ PASS' : '⚠ FAIL'}
          </span>
        )}
      </div>

      <div style={{ padding: 14 }}>
        {loading && <Spinner label={`Analyzing with ${engine === 'claude' ? 'Claude' : 'OpenAI'}`} />}

        {error && (
          <div style={{
            background: 'var(--sev-high-dim)', border: '1px solid var(--sev-high)',
            borderRadius: 8, padding: '10px 14px',
            color: 'var(--sev-high)', fontFamily: 'var(--font-sans)', fontSize: 13,
          }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Verdict */}
            <div style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: result.verdict === 'pass' ? 'var(--sev-low-dim)' : 'var(--sev-high-dim)',
              border: `1px solid ${result.verdict === 'pass' ? 'var(--sev-low)' : 'var(--sev-high)'}`,
              color: result.verdict === 'pass' ? 'var(--sev-low)' : 'var(--sev-high)',
              fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 13,
            }}>
              {result.verdict === 'pass'
                ? '✓ Logs match'
                : '⚠ Issues found — logs diverge'}
            </div>

            {/* Summary */}
            <div style={{
              padding: '10px 14px',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border)',
              borderRadius: 8,
            }}>
              <div style={{
                fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
                color: 'var(--text-muted)', marginBottom: 5,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>Summary</div>
              <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--text)', lineHeight: 1.6 }}>
                {result.summary}
              </p>
            </div>

            {/* Issues */}
            {result.issues && result.issues.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{
                  fontFamily: 'var(--font-sans)', fontWeight: 600, fontSize: 11,
                  color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
                }}>Issues ({result.issues.length})</div>
                {result.issues.map((issue, i) => {
                  const sevS = sevStyle[issue.severity] ?? sevStyle.low;
                  const srcS = srcStyle[issue.source] ?? srcStyle.both;
                  return (
                    <div key={i} style={{
                      padding: '10px 12px',
                      background: 'var(--bg-surface-2)',
                      border: '1px solid var(--border)',
                      borderLeft: `3px solid ${sevS.color}`,
                      borderRadius: 8,
                      display: 'flex', flexDirection: 'column', gap: 7,
                    }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 5 }}>
                        {(issue.lineClient || issue.lineDynatrace) && (
                          <span style={{
                            fontFamily: 'var(--font-mono)', fontSize: 10,
                            background: 'var(--bg)', border: '1px solid var(--border)',
                            borderRadius: 4, padding: '1px 6px', color: 'var(--text-muted)',
                          }}>
                            {issue.lineClient ? `C:${issue.lineClient}` : ''}
                            {issue.lineClient && issue.lineDynatrace ? '/' : ''}
                            {issue.lineDynatrace ? `DT:${issue.lineDynatrace}` : ''}
                          </span>
                        )}
                        <Badge label={issue.severity.toUpperCase()} style={sevS} />
                        <Badge
                          label={issue.source === 'client' ? 'Client' : issue.source === 'dynatrace' ? 'Dynatrace' : 'Both'}
                          style={srcS}
                        />
                        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {issue.title}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                        {issue.description}
                      </p>
                      <div style={{
                        fontFamily: 'var(--font-mono)', fontSize: 11,
                        color: 'var(--text)',
                        background: 'var(--bg)',
                        borderLeft: '3px solid var(--border)',
                        padding: '6px 10px',
                        borderRadius: '0 4px 4px 0',
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      }}>
                        {issue.fix}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AIDialog({ claude, openai }: Props) {
  const anyActive = claude.loading || claude.error || claude.result ||
                    openai.loading || openai.error || openai.result;

  if (!anyActive) return null;

  const bothActive = (claude.loading || claude.error || claude.result) &&
                     (openai.loading || openai.error || openai.result);

  return (
    <div style={{ marginTop: 20 }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 12,
        fontFamily: 'var(--font-sans)', fontWeight: 700, fontSize: 14, color: 'var(--text)',
      }}>
        <span>🤖</span> AI Analysis
        {bothActive && (
          <span style={{
            fontSize: 11, fontFamily: 'var(--font-mono)',
            background: 'var(--bg-surface)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '1px 6px', color: 'var(--text-muted)',
          }}>side-by-side comparison</span>
        )}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: bothActive ? 'row' : 'column',
        gap: 12,
        alignItems: 'stretch',
      }}>
        {(claude.loading || claude.error || claude.result) && (
          <EnginePanel engine="claude" {...claude} />
        )}
        {(openai.loading || openai.error || openai.result) && (
          <EnginePanel engine="openai" {...openai} />
        )}
      </div>
    </div>
  );
}
