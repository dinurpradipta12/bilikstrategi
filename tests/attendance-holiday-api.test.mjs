import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as appRole from '../lib/auth/app-role.ts';
import * as schedule from '../lib/attendance/schedule.ts';

const source = ts.transpileModule(
  readFileSync(new URL('../app/api/attendance/schedule/handler.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function fixture({ role = 'member', control = null } = {}) {
  const writes = [];
  let storedControl = control;
  const supabaseRest = {
    from(table) {
      return {
        select() {
          if (table === 'app_user_roles') {
            return {
              ilike() {
                return {
                  maybeSingle: async () => ({
                    data: { role, is_superuser: false, status: 'active' },
                    error: null,
                  }),
                };
              },
            };
          }
          if (table === 'attendance_work_schedules') {
            return {
              eq() {
                return {
                  maybeSingle: async () => ({
                    data: {
                      workspace_key: schedule.ATTENDANCE_WORKSPACE_KEY,
                      timezone: schedule.DEFAULT_ATTENDANCE_TIMEZONE,
                      days: schedule.DEFAULT_WORK_DAYS,
                    },
                    error: null,
                  }),
                };
              },
            };
          }
          throw new Error(`Unexpected table ${table}`);
        },
      };
    },
  };
  const deps = {
    'next/server': { NextResponse: { json: (body, init) => Response.json(body, init) } },
    '@/lib/clickup/users': { getAuthenticatedUser: async () => ({ user: {} }) },
    '@/lib/auth/app-role': appRole,
    '@/lib/supabase/rest-client': { supabaseRest },
    '@/lib/supabase/admin-rest-client': {
      isSupabaseAdminConfigured: () => true,
      supabaseAdminFetch: async (path, init = {}) => {
        if (path.startsWith('app_settings?select=')) {
          return Response.json(storedControl ? [{ value: storedControl, updated_at: storedControl.updated_at }] : []);
        }
        if (path.startsWith('app_settings?on_conflict=')) {
          const body = JSON.parse(init.body);
          writes.push(body);
          storedControl = body.value;
          return Response.json([{ ...body, updated_at: body.updated_at }]);
        }
        if (path.startsWith('attendance_access_requests?')) return Response.json([]);
        throw new Error(`Unexpected admin path ${path}`);
      },
    },
    '@/lib/attendance/schedule': schedule,
  };
  const context = {
    exports: {},
    URL,
    Response,
    Headers,
    process: { env: {} },
    require: (name) => {
      assert.ok(deps[name], `Unexpected dependency ${name}`);
      return deps[name];
    },
  };
  vm.runInNewContext(source, context);
  const request = ({ method = 'GET', body } = {}) => ({
    method,
    url: 'https://office.example/api/attendance/schedule?date=2026-10-13',
    cookies: {
      get(key) {
        const values = {
          clickup_user_email: 'member@example.com',
          clickup_user_name: role === 'admin' ? 'Admin' : 'Member',
          clickup_user_role: role,
        };
        return values[key] ? { value: values[key] } : undefined;
      },
    },
    json: async () => body || {},
  });
  return { ...context.exports, request, writes };
}

test('ordinary members cannot change the workspace holiday control', async () => {
  const api = fixture({ role: 'member' });
  const response = await api.POST(api.request({
    method: 'POST',
    body: { action: 'update_holiday_control', manual_active: true },
  }));
  assert.equal(response.status, 403);
  assert.equal(api.writes.length, 0);
});

test('admin can close the workspace and remains allowed while members are locked', async () => {
  const admin = fixture({ role: 'admin' });
  const saved = await admin.POST(admin.request({
    method: 'POST',
    body: { action: 'update_holiday_control', manual_active: true, message: 'Hari ini libur.' },
  }));
  assert.equal(saved.status, 200);
  assert.equal(admin.writes[0].key, 'attendance-holiday-control:bilik-strategi');
  assert.equal(admin.writes[0].value.manual_active, true);
  const adminSnapshot = await (await admin.GET(admin.request())).json();
  assert.equal(adminSnapshot.access.is_holiday, true);
  assert.equal(adminSnapshot.access.allowed, true);

  const member = fixture({ role: 'member', control: admin.writes[0].value });
  const memberSnapshot = await (await member.GET(member.request())).json();
  assert.equal(memberSnapshot.access.is_holiday, true);
  assert.equal(memberSnapshot.access.allowed, false);
  assert.equal(memberSnapshot.access.holiday_mode, 'manual');
});
