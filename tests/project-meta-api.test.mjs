import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';

const source = ts.transpileModule(readFileSync(new URL('../app/api/supabase/project-meta/handler.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function fixture({ upsertError = null } = {}) {
  const rows = new Map();
  const supabase = {
    from: () => ({
      select() { return this; },
      eq() { return this; },
      async maybeSingle() { return { data: null, error: { message: 'not found' } }; },
      async upsert(value) {
        if (!upsertError) rows.set(value.project_id, value);
        return { error: upsertError ? { message: upsertError } : null };
      },
    }),
  };
  const deps = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/supabase/rest-client': { supabaseRest: supabase },
    '@/lib/notifications/server': { publishProjectAssignments: async () => {}, publishProjectEvent: async () => {} },
  };
  const context = { exports: {}, URL, Response, console, require: name => deps[name] };
  vm.runInNewContext(source, context);
  const request = meta => new Request('https://office.example/api/supabase/project-meta', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId: 'project-one', meta, notification_silent: true }),
  });
  return { ...context.exports, request, rows };
}

test('project metadata reports success only after the database accepts the milestone', async () => {
  const f = fixture(), meta = { description: 'Scope', milestones: [{ id: 'ms-1', name: 'Launch', date: '2026-10-08', status: 'pending' }] };
  const response = await f.POST(f.request(meta));
  assert.equal(response.status, 200);
  assert.deepEqual(f.rows.get('project-one').meta, meta);
});

test('project metadata returns a visible failure when the milestone cannot be persisted', async () => {
  const f = fixture({ upsertError: 'database unavailable' });
  const response = await f.POST(f.request({ milestones: [{ id: 'ms-1' }] }));
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /belum tersimpan/);
  assert.equal(f.rows.size, 0);
});
