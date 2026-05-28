import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 1000,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
    });

    const raw = response.choices[0]?.message?.content?.trim() ?? '';

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: `Failed to parse OpenAI response: ${raw.slice(0, 200)}` }, { status: 502 });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
