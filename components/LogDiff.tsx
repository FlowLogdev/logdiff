'use client';

import React from 'react';

export type DiffType = 'match' | 'add' | 'remove' | 'changed';

export interface DiffRow {
  lineNum: number;
  type: DiffType;
  clientLine: string | null;
  dtLine: string | null;
  clientLineNum: number | null;
  dtLineNum: number | null;
}

export interface DiffStats {
  clientTotal: number;
  dtTotal: number;
  matching: number;
  added: number;
  removed: number;
  changed: number;
}

function lcs(a: string[], b: string[]): number[][] {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp;
}

function buildDiff(clientLines: string[], dtLines: string[]): DiffRow[] {
  const LCS_LIMIT = 300;
  const rows: DiffRow[] = [];

  if (clientLines.length <= LCS_LIMIT && dtLines.length <= LCS_LIMIT) {
    const dp = lcs(clientLines, dtLines);
    let i = clientLines.length, j = dtLines.length;
    const ops: Array<{ type: DiffType; ci: number | null; di: number | null }> = [];

    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && clientLines[i - 1] === dtLines[j - 1]) {
        ops.push({ type: 'match', ci: i - 1, di: j - 1 });
        i--; j--;
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        ops.push({ type: 'add', ci: null, di: j - 1 });
        j--;
      } else {
        ops.push({ type: 'remove', ci: i - 1, di: null });
        i--;
      }
    }

    ops.reverse();

    // merge adjacent remove+add into changed
    const merged: typeof ops = [];
    let k = 0;
    while (k < ops.length) {
      if (
        ops[k].type === 'remove' &&
        k + 1 < ops.length &&
        ops[k + 1].type === 'add'
      ) {
        merged.push({ type: 'changed', ci: ops[k].ci, di: ops[k + 1].di });
        k += 2;
      } else {
        merged.push(ops[k]);
        k++;
      }
    }

    let lineNum = 1;
    for (const op of merged) {
      rows.push({
        lineNum: lineNum++,
        type: op.type,
        clientLine: op.ci !== null ? clientLines[op.ci] : null,
        dtLine: op.di !== null ? dtLines[op.di] : null,
        clientLineNum: op.ci !== null ? op.ci + 1 : null,
        dtLineNum: op.di !== null ? op.di + 1 : null,
      });
    }
  } else {
    // positional fallback
    const maxLen = Math.max(clientLines.length, dtLines.length);
    for (let idx = 0; idx < maxLen; idx++) {
      const c = idx < clientLines.length ? clientLines[idx] : null;
      const d = idx < dtLines.length ? dtLines[idx] : null;
      let type: DiffType;
      if (c === null) type = 'add';
      else if (d === null) type = 'remove';
      else if (c === d) type = 'match';
      else type = 'changed';
      rows.push({
        lineNum: idx + 1,
        type,
        clientLine: c,
        dtLine: d,
        clientLineNum: c !== null ? idx + 1 : null,
        dtLineNum: d !== null ? idx + 1 : null,
      });
    }
  }

  return rows;
}

export function computeDiff(clientText: string, dtText: string): { rows: DiffRow[]; stats: DiffStats } {
  const clientLines = clientText === '' ? [] : clientText.split('\n');
  const dtLines = dtText === '' ? [] : dtText.split('\n');
  const rows = buildDiff(clientLines, dtLines);
  const stats: DiffStats = {
    clientTotal: clientLines.length,
    dtTotal: dtLines.length,
    matching: rows.filter(r => r.type === 'match').length,
    added: rows.filter(r => r.type === 'add').length,
    removed: rows.filter(r => r.type === 'remove').length,
    changed: rows.filter(r => r.type === 'changed').length,
  };
  return { rows, stats };
}

const typeMeta: Record<DiffType, { badge: string; color: string }> = {
  match:   { badge: '=',  color: 'var(--badge-match)' },
  add:     { badge: '+',  color: 'var(--badge-add)' },
  remove:  { badge: '−',  color: 'var(--badge-remove)' },
  changed: { badge: '~',  color: 'var(--badge-changed)' },
};

interface Props {
  rows: DiffRow[];
  stats: DiffStats;
}

export default function LogDiff({ rows, stats }: Props) {
  const identical = stats.added === 0 && stats.removed === 0 && stats.changed === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Stats bar */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center',
        padding: '8px 12px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        fontFamily: 'var(--font-sans)',
        fontSize: 13,
      }}>
        <span style={{ color: 'var(--text-muted)' }}>
          Client: <strong style={{ color: 'var(--text)' }}>{stats.clientTotal}</strong> lines
          &nbsp;·&nbsp;
          Dynatrace: <strong style={{ color: 'var(--text)' }}>{stats.dtTotal}</strong> lines
        </span>
        <span style={{ color: 'var(--border)' }}>|</span>
        {identical ? (
          <span style={{
            background: 'var(--sev-low-dim)', color: 'var(--sev-low)',
            border: '1px solid var(--sev-low)', borderRadius: 4,
            padding: '2px 8px', fontSize: 12, fontWeight: 600,
          }}>✓ Logs are identical</span>
        ) : (
          <>
            <span style={{ color: 'var(--badge-match)' }}>✓ {stats.matching} matching</span>
            {stats.added > 0 && <span style={{ color: 'var(--badge-add)' }}>+ {stats.added} only in Dynatrace</span>}
            {stats.removed > 0 && <span style={{ color: 'var(--badge-remove)' }}>− {stats.removed} only in Client</span>}
            {stats.changed > 0 && <span style={{ color: 'var(--badge-changed)' }}>~ {stats.changed} changed</span>}
          </>
        )}
      </div>

      {/* Diff table */}
      <div style={{
        maxHeight: 360,
        overflowY: 'auto',
        border: '1px solid var(--border)',
        borderRadius: 8,
        background: 'var(--bg-surface)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ background: 'var(--bg-surface-2)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ width: 60, padding: '6px 8px', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600 }}>#</th>
              <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--accent-client)', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, borderLeft: '1px solid var(--border)' }}>Client Side</th>
              <th style={{ padding: '6px 12px', textAlign: 'left', color: 'var(--accent-dt)', fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 600, borderLeft: '1px solid var(--border)' }}>Dynatrace</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = typeMeta[row.type];
              const rowBg = row.type === 'add' ? 'var(--row-add)'
                : row.type === 'remove' ? 'var(--row-remove)'
                : row.type === 'changed' ? 'var(--row-changed)'
                : 'var(--row-match)';

              return (
                <tr key={row.lineNum} style={{ background: rowBg, borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '3px 8px', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    <span style={{ color: 'var(--text-subtle)', fontSize: 11 }}>{row.lineNum}</span>
                    {' '}
                    <span style={{
                      color: meta.color,
                      fontWeight: 700,
                      fontSize: 13,
                      lineHeight: 1,
                    }}>{meta.badge}</span>
                  </td>
                  <td style={{
                    padding: '3px 12px', verticalAlign: 'top',
                    borderLeft: '1px solid var(--border-subtle)',
                    color: row.type === 'add' ? 'var(--text-subtle)' : 'var(--text)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {row.clientLine !== null ? (
                      <span>
                        <span style={{ color: 'var(--text-subtle)', userSelect: 'none', marginRight: 6, fontSize: 10 }}>
                          {row.clientLineNum}
                        </span>
                        {row.clientLine}
                      </span>
                    ) : <span style={{ color: 'var(--border)' }}>—</span>}
                  </td>
                  <td style={{
                    padding: '3px 12px', verticalAlign: 'top',
                    borderLeft: '1px solid var(--border-subtle)',
                    color: row.type === 'remove' ? 'var(--text-subtle)' : 'var(--text)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                  }}>
                    {row.dtLine !== null ? (
                      <span>
                        <span style={{ color: 'var(--text-subtle)', userSelect: 'none', marginRight: 6, fontSize: 10 }}>
                          {row.dtLineNum}
                        </span>
                        {row.dtLine}
                      </span>
                    ) : <span style={{ color: 'var(--border)' }}>—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
