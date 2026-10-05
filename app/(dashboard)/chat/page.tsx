'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase/client';

type Message = {
  id: string;
  user_id: string;
  user_name: string;
  user_avatar?: string | null;
  text: string;
  created_at: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState('');
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch('/api/native/chat?channelId=general', { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Pesan gagal dimuat.');
    setMessages(Array.isArray(payload.messages) ? payload.messages : []);
  }, []);

  useEffect(() => {
    fetch('/api/native/user', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setUserId(String(payload.user?.id || '')))
      .catch(() => null);
    load().catch((cause) => setError(cause instanceof Error ? cause.message : 'Pesan gagal dimuat.'));
  }, [load]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const channel = supabase.channel('team-chat-general')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'app_chat_messages' }, () => {
        load().catch(() => null);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [load]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/native/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: 'general', text: draft.trim() }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Pesan gagal dikirim.');
      setDraft('');
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Pesan gagal dikirim.');
    } finally { setSending(false); }
  }

  return (
    <div className="mx-auto flex h-[calc(100dvh-9rem)] min-h-[32rem] max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex items-center gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="flex size-10 items-center justify-center rounded-xl bg-[var(--brand-primary)] text-white"><MessageCircle className="size-5" /></div>
        <div><h1 className="font-semibold text-slate-900 dark:text-white">Diskusi Tim</h1><p className="text-xs text-slate-500">Percakapan bersama seluruh anggota</p></div>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && <p className="py-16 text-center text-sm text-slate-500">Belum ada pesan. Mulai percakapan tim di sini.</p>}
        {messages.map((message) => {
          const mine = message.user_id === userId;
          return <article key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 sm:max-w-[70%] ${mine ? 'ml-auto bg-[var(--brand-primary)] text-white' : 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white'}`}>
            <div className={`mb-1 flex items-center gap-2 text-xs ${mine ? 'text-white/75' : 'text-slate-500 dark:text-slate-400'}`}><strong>{message.user_name || 'Anggota'}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</time></div>
            <p className="whitespace-pre-wrap break-words text-sm">{message.text}</p>
          </article>;
        })}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="border-t border-slate-200 p-4 dark:border-slate-700">
        {error && <p role="alert" className="mb-2 text-sm text-red-600">{error}</p>}
        <div className="flex gap-2"><label htmlFor="team-message" className="sr-only">Pesan untuk tim</label><input id="team-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={4000} placeholder="Tulis pesan untuk tim..." className="min-w-0 flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-[var(--brand-accent)] dark:border-slate-600 dark:bg-slate-800 dark:text-white" /><button type="submit" disabled={!draft.trim() || sending} className="flex items-center gap-2 rounded-xl bg-[var(--brand-primary)] px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"><Send className="size-4" /><span className="hidden sm:inline">Kirim</span></button></div>
      </form>
    </div>
  );
}
