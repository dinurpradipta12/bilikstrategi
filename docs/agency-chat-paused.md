# Agency Chat paused

Status: paused globally on 2026-08-10.

## Why

The Cloudflare Pages Worker exceeded the free-plan 3 MiB limit. Agency Chat
was the largest optional feature because it included ClickUp Chat API logic,
typing indicators, notification sound, floating chat UI, and chat media
handling. Pausing it keeps the core workspace deployable while the project,
task, attendance, invoice, and other pages remain available.

## Current behavior

- The Agency Chat item is removed from the desktop sidebar and command menu.
- The floating chat button and chat notification sound are removed globally.
- `/chat` redirects to `/attendance` so old bookmarks do not show a broken page.
- Chat is removed from the admin page-access selector.
- Chat API handlers are no longer imported into the shared API dispatcher.
- Existing chat source files and Supabase migrations are retained in git as
  reference material; no chat tables or historical data are deleted.

## Reactivation checklist

1. Restore the previous chat page from git history, for example:
   `git show bcee15d^:'app/(dashboard)/chat/page.tsx' > 'app/(dashboard)/chat/page.tsx'`.
2. Restore the chat imports and props in `app/(dashboard)/layout.tsx`,
   `components/layout/Header.tsx`, `components/layout/Sidebar.tsx`, and
   `components/layout/CommandMenu.tsx`.
3. Restore the `chat` page-access key, option, and default in
   `lib/auth/page-access.ts`.
4. Re-add the chat handler imports and routes in
   `app/api/[[...path]]/route.ts`.
5. Re-test `/api/clickup/chat`, `/api/typing`, media access, Supabase realtime,
   unread badges, notifications, sound permission, and mobile behavior.
6. Check the Cloudflare bundle size before re-enabling the feature. If it is
   still above the plan limit, split chat into a separate Worker or upgrade
   the Cloudflare plan instead of reintroducing it into the core Worker.

Retained implementation files include `components/chat/`,
`lib/chat/`, `lib/clickup/chat.ts`, `app/api/clickup/chat/handler.ts`,
`app/api/chat/media-view/handler.ts`, and `app/api/typing/handler.ts`.
