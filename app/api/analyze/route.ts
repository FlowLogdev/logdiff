import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { clientLog, dtLog, diffSummary } = await req.json();

    if (!clientLog && !dtLog) {
      return NextResponse.json({ error: 'No log content provided' }, { status: 400 });
    }

    const prompt = `You are a log analysis expert. Compare the following two logs and diagnose differences.

CLIENT SIDE LOG:
${clientLog || '(empty)'}

DYNATRACE LOG:
${dtLog || '(empty)'}

DIFF SUMMARY (up to 80 changed lines):
${diffSummary || '(none)'}

Respond with ONLY a raw JSON object — no markdown, no backticks, no explanation outside the JSON. Use this exact schema:
{
  "verdict": "pass" or "fail",
  "summary": "2-3 sentence plain-English explanation of what differs, likely root cause, and which side (client or Dynatrace) has the problem",
  "issues": [
    {
      "lineClient": "line number as string or null",
      "lineDynatrace": "line number as string or null",
      "source": "client" or "dynatrace" or "both",
      "severity": "high" or "medium" or "low",
      "title": "short issue title",
      "description": "what is wrong and why it matters",
      "fix": "where to point and what to investigate"
    }
  ]
}`;

    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = (message.content[0] as { type: string; text: string }).text.trim();

    // strip any accidental markdown fences
    const jsonStr = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return NextResponse.json({ error: `Failed to parse Claude response: ${raw.slice(0, 200)}` }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
