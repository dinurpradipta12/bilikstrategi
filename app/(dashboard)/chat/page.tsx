import { redirect } from 'next/navigation';

export const runtime = 'edge';

// Agency Chat is paused while the workspace is being reduced for Cloudflare
// Pages. Preserve old links without exposing a broken or partially loaded UI.
export default function ChatPage() {
  redirect('/attendance');
}
