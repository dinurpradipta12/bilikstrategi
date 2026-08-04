import React from 'react';

type ChatMember = { username: string };

type RenderChatMessageOptions = {
  own?: boolean;
};

const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<]*)?/gi;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function trimUrlPunctuation(value: string) {
  let url = value;
  let trailing = '';

  while (/[.,!?;:]$/.test(url)) {
    trailing = url.slice(-1) + trailing;
    url = url.slice(0, -1);
  }

  while (/[)\]}]$/.test(url)) {
    const closing = url.slice(-1);
    const opening = closing === ')' ? '(' : closing === ']' ? '[' : '{';
    const openCount = (url.match(new RegExp(`\\${opening}`, 'g')) || []).length;
    const closeCount = (url.match(new RegExp(`\\${closing}`, 'g')) || []).length;
    if (closeCount <= openCount) break;
    trailing = closing + trailing;
    url = url.slice(0, -1);
  }

  return { url, trailing };
}

function renderWithLineBreaks(value: string, keyPrefix: string) {
  return value.split('\n').map((line, index) => (
    <React.Fragment key={`${keyPrefix}-line-${index}`}>
      {index > 0 && <br />}
      {line}
    </React.Fragment>
  ));
}

function isImageUrl(url: string) {
  if (!url) return false;
  if (url.startsWith('data:image/')) return true;

  // MUST start with http:// or https:// to be a valid remote image URL!
  if (!/^https?:\/\//i.test(url)) return false;

  const clean = url.toLowerCase().split('?')[0];
  if (
    clean.endsWith('.png') ||
    clean.endsWith('.jpg') ||
    clean.endsWith('.jpeg') ||
    clean.endsWith('.gif') ||
    clean.endsWith('.webp') ||
    clean.endsWith('.svg') ||
    clean.includes('attachments.clickup.com') ||
    clean.includes('supabase.co/storage')
  ) {
    return true;
  }
  return false;
}

function renderImagePreview(src: string, alt: string, own: boolean, key: string) {
  const fileName = alt || src.split('/').pop()?.split('?')[0] || 'Gambar';
  return (
    <div key={key} className="my-2 max-w-xs md:max-w-sm rounded-xl overflow-hidden border border-[#E8E8EC] shadow-sm bg-black/5 group/img relative">
      <a href={src} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={fileName}
          className="w-full max-h-72 object-contain bg-neutral-900/40 rounded-t-xl transition-transform duration-200 group-hover/img:scale-[1.01] cursor-pointer"
          loading="lazy"
          onError={(e) => {
            // Fallback if image fails to load
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      </a>
      <div className="p-2 bg-[#1E293B] text-white text-[11px] flex items-center justify-between gap-2 backdrop-blur-xs">
        <span className="truncate max-w-[180px] font-medium text-neutral-200">{fileName}</span>
        <a
          href={src}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(e) => e.stopPropagation()}
          className="text-xs font-bold text-blue-300 hover:text-blue-100 underline decoration-1 underline-offset-2 flex-shrink-0"
        >
          Buka Full ↗
        </a>
      </div>
    </div>
  );
}

function renderLinks(value: string, own: boolean, keyPrefix: string) {
  if (!value) return [];

  // 1. Check markdown image pattern: ![alt](url)
  const markdownImgRegex = /!\[([^\]]*)\]\(((?:https?:\/\/|data:image\/)[^\s)]+)\)/gi;
  const mdMatches = Array.from(value.matchAll(markdownImgRegex));

  if (mdMatches.length > 0) {
    const nodes: React.ReactNode[] = [];
    let cursor = 0;
    mdMatches.forEach((match, idx) => {
      const start = match.index ?? 0;
      const alt = match[1] || 'Gambar';
      const imgUrl = match[2];

      if (start > cursor) {
        nodes.push(...renderLinks(value.slice(cursor, start), own, `${keyPrefix}-premd-${idx}`));
      }

      nodes.push(renderImagePreview(imgUrl, alt, own, `${keyPrefix}-mdimg-${idx}`));
      cursor = start + match[0].length;
    });

    if (cursor < value.length) {
      nodes.push(...renderLinks(value.slice(cursor), own, `${keyPrefix}-postmd`));
    }
    return nodes;
  }

  // 2. Standard URL pattern matching
  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  let linkIndex = 0;

  for (const match of value.matchAll(URL_PATTERN)) {
    const raw = match[0];
    const start = match.index ?? 0;

    // Do not turn the domain portion of an email address into a link.
    if (start > 0 && /[@\w.-]/.test(value[start - 1])) continue;

    const { url, trailing } = trimUrlPunctuation(raw);
    if (!url) continue;

    // IMPORTANT: Skip converting plain filenames (like "20.20.26.png") into broken domains unless they start with http/https/www
    if (!/^(?:https?:\/\/|www\.)/i.test(url) && !url.includes('/')) {
      continue;
    }

    nodes.push(...renderWithLineBreaks(value.slice(cursor, start), `${keyPrefix}-text-${linkIndex}`));
    const href = /^(?:https?:\/\/)/i.test(url) ? url : `https://${url}`;

    if (isImageUrl(href)) {
      const fileName = url.split('/').pop()?.split('?')[0] || 'Gambar';
      nodes.push(renderImagePreview(href, fileName, own, `${keyPrefix}-img-${linkIndex}`));
    } else {
      nodes.push(
        <a
          key={`${keyPrefix}-link-${linkIndex}`}
          href={href}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => event.stopPropagation()}
          className={`font-semibold underline decoration-[#93C5FD] underline-offset-2 break-all transition-colors ${
            own
              ? 'text-[#1D4ED8] decoration-[#93C5FD] hover:text-[#1E40AF]'
              : 'text-[#0369A1] decoration-[#7DD3FC] hover:text-[#075985]'
          }`}
        >
          {url}
        </a>,
      );
    }

    if (trailing) nodes.push(...renderWithLineBreaks(trailing, `${keyPrefix}-trailing-${linkIndex}`));

    cursor = start + raw.length;
    linkIndex += 1;
  }

    if (trailing) nodes.push(...renderWithLineBreaks(trailing, `${keyPrefix}-trailing-${linkIndex}`));

    cursor = start + raw.length;
    linkIndex += 1;
  }

  nodes.push(...renderWithLineBreaks(value.slice(cursor), `${keyPrefix}-tail`));
  return nodes;
}

export function renderChatMessageText(
  text: string,
  members: ChatMember[] = [],
  options: RenderChatMessageOptions = {},
): React.ReactNode[] {
  const own = Boolean(options.own);
  const memberNames = Array.from(
    new Set(members.map((member) => member.username.trim()).filter(Boolean)),
  ).sort((a, b) => b.length - a.length);

  const mentionRegex = memberNames.length
    ? new RegExp(`(@(?:${memberNames.map(escapeRegExp).join('|')}))`, 'gi')
    : null;
  const parts = mentionRegex ? text.split(mentionRegex) : [text];
  const nodes: React.ReactNode[] = [];

  parts.forEach((part, index) => {
    const matchedMember = part.startsWith('@') && memberNames.some(
      (name) => name.toLowerCase() === part.slice(1).toLowerCase(),
    );

    if (!matchedMember) {
      nodes.push(...renderLinks(part, own, `part-${index}`));
      return;
    }

    nodes.push(
      <span
        key={`mention-${index}`}
        className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md font-extrabold text-[11px] mx-0.5 border align-baseline ${
          own
            ? 'bg-[#DCE9FF] text-[#1D4ED8] border-[#B8D1FF]'
            : 'bg-[#F0EAFD] text-[#6D28D9] border-[#DDD6FE]'
        }`}
      >
        <span aria-hidden="true">@</span>
        {part.slice(1)}
      </span>,
    );
  });

  return nodes;
}
