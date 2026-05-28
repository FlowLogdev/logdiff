'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import LogDiff, { computeDiff, DiffRow, DiffStats } from '@/components/LogDiff';
import AIDialog, { AnalysisResult, EngineState } from '@/components/AIDialog';

const PLACEHOLDER_CLIENT = `[INFO] 2024-01-15 10:00:01 App started
[INFO] 2024-01-15 10:00:02 Connecting to database
[INFO] 2024-01-15 10:00:03 Connection established
[WARN] 2024-01-15 10:00:04 Cache miss for user 1042
[INFO] 2024-01-15 10:00:05 Request GET /api/data completed in 120ms
[ERROR] 2024-01-15 10:00:06 Timeout on downstream service`;

const PLACEHOLDER_DT = `[INFO] 2024-01-15 10:00:01 App started
[INFO] 2024-01-15 10:00:02 Connecting to database
[INFO] 2024-01-15 10:00:03 Connection established
[WARN] 2024-01-15 10:00:04 Cache miss for user 1042
[INFO] 2024-01-15 10:00:05 Request GET /api/data completed in 850ms
[ERROR] 2024-01-15 10:00:06 Timeout on downstream service
[ERROR] 2024-01-15 10:00:07 Circuit breaker OPEN for service payments`;

function buildDiffSummary(rows: DiffRow[]): string {
  return rows
    .filter(r => r.type !== 'match')
    .slice(0, 80)
    .map(r => {
      const c = r.clientLine !== null ? `"${r.clientLine}"` : 'null';
      const d = r.dtLine !== null ? `"${r.dtLine}"` : 'null';
      return `Line ${r.lineNum} (Client:${r.clientLineNum ?? '-'} vs DT:${r.dtLineNum ?? '-'}) [${r.type}]: Client=${c} | Dynatrace=${d}`;
    })
    .join('\n');
}

const emptyEngine: EngineState = { loading: false, error: null, result: null };

async function fetchAnalysis(
  endpoint: string,
  clientLog: string,
  dtLog: string,
  diffSummary: string,
): Promise<AnalysisResult> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientLog, dtLog, diffSummary }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as AnalysisResult;
}

export default function Home() {
  const [clientLog, setClientLog] = useState('');
  const [dtLog, setDtLog] = useState('');
  const [diffResult, setDiffResult] = useState<{ rows: DiffRow[]; stats: DiffStats } | null>(null);
  const [claudeState, setClaudeState] = useState<EngineState>(emptyEngine);
  const [openaiState, setOpenaiState] = useState<EngineState>(emptyEngine);
  const analysisRef = useRef<HTMLDivElement>(null);

  const hasDiff = diffResult !== null && (
    diffResult.stats.added > 0 || diffResult.stats.removed > 0 || diffResult.stats.changed > 0
  );
  const anyLoading = claudeState.loading || openaiState.loading;

  const runCompare = useCallback(() => {
    if (!clientLog.trim() && !dtLog.trim()) return;
    const result = computeDiff(clientLog, dtLog);
    setDiffResult(result);
    setClaudeState(emptyEngine);
    setOpenaiState(emptyEngine);
  }, [clientLog, dtLog]);

  const handleClear = () => {
    setClientLog('');
    setDtLog('');
    setDiffResult(null);
    setClaudeState(emptyEngine);
    setOpenaiState(emptyEngine);
  };

  const handleSwap = () => {
    const newClient = dtLog;
    const newDt = clientLog;
    setClientLog(newClient);
    setDtLog(newDt);
    if (diffResult) {
      const result = computeDiff(newClient, newDt);
      setDiffResult(result);
      setClaudeState(emptyEngine);
      setOpenaiState(emptyEngine);
    }
  };

  const scrollToAnalysis = () => {
    setTimeout(() => {
      analysisRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  };

  const runClaude = async (rows: DiffRow[]) => {
    setClaudeState({ loading: true, error: null, result: null });
    try {
      const result = await fetchAnalysis('/api/analyze', clientLog, dtLog, buildDiffSummary(rows));
      setClaudeState({ loading: false, error: null, result });
    } catch (e) {
      setClaudeState({ loading: false, error: e instanceof Error ? e.message : String(e), result: null });
    }
  };

  const runOpenAI = async (rows: DiffRow[]) => {
    setOpenaiState({ loading: true, error: null, result: null });
    try {
      const result = await fetchAnalysis('/api/analyze-openai', clientLog, dtLog, buildDiffSummary(rows));
      setOpenaiState({ loading: false, error: null, result });
    } catch (e) {
      setOpenaiState({ loading: false, error: e instanceof Error ? e.message : String(e), result: null });
    }
  };

  const handleAnalyzeClaude = () => {
    if (!diffResult || anyLoading) return;
    scrollToAnalysis();
    runClaude(diffResult.rows);
  };

  const handleAnalyzeOpenAI = () => {
    if (!diffResult || anyLoading) return;
    scrollToAnalysis();
    runOpenAI(diffResult.rows);
  };

  const handleAnalyzeBoth = () => {
    if (!diffResult || anyLoading) return;
    scrollToAnalysis();
    // fire both in parallel
    runClaude(diffResult.rows);
    runOpenAI(diffResult.rows);
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        runCompare();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [runCompare]);

  const btnBase: React.CSSProperties = {
    padding: '7px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    fontFamily: 'var(--font-sans)',
    fontWeight: 600,
    fontSize: 12,
    display: 'flex', alignItems: 'center', gap: 5,
    whiteSpace: 'nowrap',
    background: 'transparent',
    color: 'var(--text-muted)',
    transition: 'background 0.15s, border-color 0.15s, color 0.15s',
  };

  const analyzeEnabled = hasDiff && !anyLoading;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '0 0 60px' }}>
      {/* Top bar */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
        padding: '0 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 52,
        position: 'sticky', top: 0, zIndex: 100,
        gap: 12,
      }}>
        {/* Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>Log Diff + AI Analysis</span>
          <span style={{
            fontSize: 10, fontFamily: 'var(--font-mono)',
            background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            borderRadius: 4, padding: '1px 5px', color: 'var(--text-subtle)',
          }}>Ctrl+Enter</span>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <button onClick={handleClear} style={btnBase}>✕ Clear</button>
          <button onClick={handleSwap} style={btnBase}>⇄ Swap</button>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          <button
            onClick={runCompare}
            style={{ ...btnBase, background: 'var(--bg-surface-2)', color: 'var(--text)', borderColor: 'var(--border)' }}
          >
            ⊞ Compare
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--border)' }} />

          {/* Claude button */}
          <button
            onClick={handleAnalyzeClaude}
            disabled={!analyzeEnabled}
            title="Analyze with Claude (Anthropic)"
            style={{
              ...btnBase,
              background: analyzeEnabled ? 'var(--accent-client-dim)' : 'transparent',
              color: analyzeEnabled ? 'var(--accent-client)' : 'var(--text-subtle)',
              borderColor: analyzeEnabled ? 'var(--accent-client-border)' : 'var(--border)',
              cursor: analyzeEnabled ? 'pointer' : 'not-allowed',
              opacity: analyzeEnabled ? 1 : 0.5,
            }}
          >
            ⬡ Claude
          </button>

          {/* OpenAI button */}
          <button
            onClick={handleAnalyzeOpenAI}
            disabled={!analyzeEnabled}
            title="Analyze with GPT-4o (OpenAI Codex)"
            style={{
              ...btnBase,
              background: analyzeEnabled ? 'var(--accent-dt-dim)' : 'transparent',
              color: analyzeEnabled ? 'var(--accent-dt)' : 'var(--text-subtle)',
              borderColor: analyzeEnabled ? 'var(--accent-dt-border)' : 'var(--border)',
              cursor: analyzeEnabled ? 'pointer' : 'not-allowed',
              opacity: analyzeEnabled ? 1 : 0.5,
            }}
          >
            ◈ Codex
          </button>

          {/* Both button */}
          <button
            onClick={handleAnalyzeBoth}
            disabled={!analyzeEnabled}
            title="Run both Claude and OpenAI in parallel"
            style={{
              ...btnBase,
              background: analyzeEnabled ? 'var(--bg-surface-2)' : 'transparent',
              color: analyzeEnabled ? 'var(--text)' : 'var(--text-subtle)',
              borderColor: analyzeEnabled ? 'var(--border)' : 'var(--border)',
              cursor: analyzeEnabled ? 'pointer' : 'not-allowed',
              opacity: analyzeEnabled ? 1 : 0.5,
              fontWeight: 700,
            }}
          >
            ✦ Analyze Both
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', maxWidth: 1600, margin: '0 auto' }}>
        {/* Log panels */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Client Side */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-client)', fontFamily: 'var(--font-sans)' }}>
                Client Side
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-sans)' }}>provided</span>
            </div>
            <textarea
              value={clientLog}
              onChange={e => setClientLog(e.target.value)}
              placeholder={PLACEHOLDER_CLIENT}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 240, resize: 'vertical',
                fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5,
                background: 'var(--bg-surface)', color: 'var(--text)',
                border: '1px solid var(--accent-client-border)',
                borderRadius: 8, padding: '10px 12px', outline: 'none',
                caretColor: 'var(--accent-client)',
              }}
            />
          </div>

          {/* Dynatrace */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--accent-dt)', fontFamily: 'var(--font-sans)' }}>
                Dynatrace
              </span>
              <span style={{ fontSize: 11, color: 'var(--text-subtle)', fontFamily: 'var(--font-sans)' }}>pulled</span>
            </div>
            <textarea
              value={dtLog}
              onChange={e => setDtLog(e.target.value)}
              placeholder={PLACEHOLDER_DT}
              spellCheck={false}
              style={{
                width: '100%', minHeight: 240, resize: 'vertical',
                fontFamily: 'var(--font-mono)', fontSize: 12, lineHeight: 1.5,
                background: 'var(--bg-surface)', color: 'var(--text)',
                border: '1px solid var(--accent-dt-border)',
                borderRadius: 8, padding: '10px 12px', outline: 'none',
                caretColor: 'var(--accent-dt)',
              }}
            />
          </div>
        </div>

        {/* Diff results */}
        {diffResult && <LogDiff rows={diffResult.rows} stats={diffResult.stats} />}

        {/* AI dialog */}
        <div ref={analysisRef}>
          <AIDialog claude={claudeState} openai={openaiState} />
        </div>
      </div>
    </div>
  );
}
