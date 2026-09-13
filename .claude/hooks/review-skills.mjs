#!/usr/bin/env node
// Stop hook: after any task that changed source under src/, hand the model a reminder to keep
// the project's skills (.claude/skills), rules (.claude/rules) AND memory (MEMORY.md + memory
// files) in sync with what changed.
//
// Fires once per DISTINCT src-change state — i.e. once per task that touched src/ — not once
// per session. Loop-safe: the review turn only edits skill/rule/memory files, never src/, so
// `git status -- src` is unchanged on the follow-up Stop and the hook exits without re-firing.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

let input = '';
process.stdin.on('data', (c) => (input += c));
process.stdin.on('end', () => {
  try {
    JSON.parse(input || '{}');
  } catch {
    process.exit(0);
  }

  // Only bother when source code actually changed (the "real work happened" signal).
  const git = spawnSync('git', ['status', '--porcelain', '--', 'src'], { encoding: 'utf8' });
  if (git.status !== 0) process.exit(0);
  const changed = (git.stdout || '').trim();
  if (!changed) process.exit(0);

  const cacheDir = '.claude/.cache';
  const sentinel = join(cacheDir, 'skill-review-state');

  // Already reminded for this exact src state? Then this Stop is either a no-op or the review
  // turn's own Stop — exit cleanly. A new/changed src state means a new task to review.
  let prev = '';
  try {
    prev = existsSync(sentinel) ? readFileSync(sentinel, 'utf8') : '';
  } catch {
    prev = '';
  }
  if (prev === changed) process.exit(0);

  // Record the state we're about to review BEFORE blocking, so the follow-up Stop matches and
  // exits instead of looping.
  try {
    mkdirSync(cacheDir, { recursive: true });
    writeFileSync(sentinel, changed);
  } catch {
    // If we can't persist the state, don't risk an infinite loop — just allow the stop.
    process.exit(0);
  }

  const reason = [
    'Before finishing this task, keep the project knowledge in sync with what changed under',
    'src/. Review all four and UPDATE whatever is now stale:',
    '',
    '1. Rules — `.claude/rules/*.md`: if a convention/constraint changed or a new one appeared.',
    '2. Skills — `.claude/skills/*/SKILL.md`: if a scaffolding pattern/feature changed, or add',
    '   a new skill for a new repeatable workflow.',
    '3. Agents — `.claude/agents/*.md`: if the change makes an agent\'s described layering,',
    '   tech stack, or commands wrong (this has drifted silently before — don\'t skip it just',
    '   because agents aren\'t normally read during a task).',
    '4. Memory — MEMORY.md + your memory files: if this task revealed a durable fact, decision,',
    '   or preference not already captured in the repo, record it (and link it from MEMORY.md).',
    '',
    'Only touch skill/rule/agent/memory files here — no unrelated code edits. If all four are',
    'already in sync, reply briefly "skills/rules/agents/memory already up to date" and stop.',
  ].join('\n');

  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
});
