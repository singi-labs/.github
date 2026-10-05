// Jev issue pre-classification (shadow mode) for gh-aw issue-triage workflows.
//
// Reads the `issues` event from GITHUB_EVENT_PATH, asks Jev the batched
// questions defined in @singi-labs/sifa-sdk/jev/issue, writes JSON to
// JEV_TRIAGE_OUT and a Markdown table to GITHUB_STEP_SUMMARY. Never applies
// labels, never exits non-zero: any failure becomes { ok: false, reason }.
//
// Runs from $RUNNER_TEMP/jev-issue-triage next to its own node_modules (the
// action copies it there), so the bare package imports resolve.

import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

import {
  ISSUE_NEEDS_INFO_MAX_ACTIONABLE,
  ISSUE_ROUTING_THRESHOLD,
  ISSUE_STREAM_CONFIDENCE_FLOOR,
  ISSUE_TYPE_CONFIDENCE_FLOOR,
  buildIssueTriageQuestions,
  buildIssueTriageState,
  issueLabelsFromAnswers,
  issueTriageAnswersSchema,
} from '@singi-labs/sifa-sdk/jev/issue';
import { TypeSafeClient } from '@typesafe-ai/sdk';

const OUT = process.env.JEV_TRIAGE_OUT || '/tmp/gh-aw/jev-triage.json';
const MODEL = process.env.JEV_MODEL || 'jev-latest';
const THRESHOLDS = {
  typeFloor: ISSUE_TYPE_CONFIDENCE_FLOOR,
  streamFloor: ISSUE_STREAM_CONFIDENCE_FLOOR,
  needsInfoMaxActionable: ISSUE_NEEDS_INFO_MAX_ACTIONABLE,
  routingThreshold: ISSUE_ROUTING_THRESHOLD,
};

function log(msg, extra = {}) {
  console.log(JSON.stringify({ script: 'jev-issue-triage', msg, ...extra }));
}

function pct(p) {
  return `${Math.round(p * 100)}%`;
}

function renderMarkdown(out) {
  if (!out.ok) return `### Jev pre-classification (shadow)\n\nNo result: \`${out.reason}\`.\n`;
  const a = out.answers;
  const s = out.suggestions;
  const labels = s.labels.length > 0 ? s.labels.map((l) => `\`${l}\``).join(', ') : 'none';
  const usage = out.usage ? `, ${out.usage.input_tokens + out.usage.output_tokens} tokens` : '';
  return [
    '### Jev pre-classification (shadow)',
    '',
    `Suggested labels: ${labels}`,
    '',
    '| Question | Answer | Confidence |',
    '|---|---|---|',
    `| Type | ${a.issueType.choice} | ${pct(a.issueType.confidence)} |`,
    `| Stream | ${a.issueStream.choice} | ${pct(a.issueStream.confidence)} |`,
    `| Actionable as written | ${s.needsInfo ? 'no' : 'yes'} | ${pct(a.issueActionable.noul)} |`,
    `| Security | ${s.security ? 'yes' : 'no'} | ${pct(a.issueSecurity.noul)} |`,
    `| Regression | ${s.regression ? 'yes' : 'no'} | ${pct(a.issueRegression.noul)} |`,
    '',
    `Model ${out.model}${usage}.`,
    '',
  ].join('\n');
}

function writeOutputs(out) {
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(out, null, 2));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${renderMarkdown(out)}\n`);
  log('jev triage output written', { path: OUT, ok: out.ok });
}

function readEvent() {
  const path = process.env.GITHUB_EVENT_PATH;
  if (!path) throw new Error('GITHUB_EVENT_PATH not set');
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const issue = raw && raw.issue;
  const repo = raw && raw.repository && raw.repository.full_name;
  if (!issue || typeof issue.number !== 'number' || typeof issue.title !== 'string' || typeof repo !== 'string') {
    throw new Error('event payload has no issue');
  }
  return {
    number: issue.number,
    repo,
    title: issue.title,
    body: typeof issue.body === 'string' ? issue.body : undefined,
    existingLabels: Array.isArray(issue.labels) ? issue.labels.map((l) => l && l.name).filter(Boolean) : [],
  };
}

async function main() {
  const ev = readEvent();
  const base = { mode: 'shadow', issue: ev.number, repo: ev.repo };
  const key = process.env.TYPESAFE_API_KEY;
  if (!key) {
    writeOutputs({ ...base, ok: false, reason: 'not_configured' });
    return;
  }
  const input = { repo: ev.repo, title: ev.title, existingLabels: ev.existingLabels };
  if (ev.body) input.body = ev.body;
  const state = buildIssueTriageState(input);
  const questions = buildIssueTriageQuestions();

  const client = new TypeSafeClient({ apiKey: key, defaultModel: MODEL, timeout: 10_000, logLevel: 'off' });
  let result;
  try {
    result = await client.systemOne({ state, questions });
  } catch (err) {
    // Never log the raw error: its cause can carry request headers.
    const name = err && err.name ? err.name : 'unknown';
    const status = err && typeof err.status === 'number' ? err.status : undefined;
    log('jev systemOne failed', { errName: name, status });
    writeOutputs({ ...base, ok: false, reason: status ? `http_${status}` : name });
    return;
  }
  log('jev systemOne', { model: result.model, questionIds: Object.keys(questions), usage: result.usage });

  const parsed = issueTriageAnswersSchema.safeParse(result.answers);
  if (!parsed.success) {
    writeOutputs({ ...base, ok: false, reason: 'invalid_answers' });
    return;
  }
  const suggestions = issueLabelsFromAnswers(parsed.data, THRESHOLDS);
  writeOutputs({
    ...base,
    ok: true,
    model: result.model,
    ...(result.usage ? { usage: result.usage } : {}),
    answers: parsed.data,
    suggestions,
    thresholds: THRESHOLDS,
  });
}

main().catch((err) => {
  log('jev triage pre-step failed', { errName: err && err.name, errMessage: err && err.message });
});
