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

function renderLinks(value: string, own: boolean, keyPrefix: string) {
  if (!value) return [];

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

    nodes.push(...renderWithLineBreaks(value.slice(cursor, start), `${keyPrefix}-text-${linkIndex}`));
    const href = /^(?:https?:\/\/)/i.test(url) ? url : `https://${url}`;
    nodes.push(
      <a
        key={`${keyPrefix}-link-${linkIndex}`}
        href={href}
        target="_blank"
        rel="noreferrer noopener"
        onClick={(event) => event.stopPropagation()}
        className={`font-semibold underline decoration-1 underline-offset-2 break-all transition-colors ${
          own
            ? 'text-[#1D4ED8] decoration-[#93C5FD] hover:text-[#1E40AF]'
            : 'text-[#0369A1] decoration-[#7DD3FC] hover:text-[#075985]'
        }`}
      >
        {url}
      </a>,
    );
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
) {
  const own = Boolean(options.own);
  const memberNames = Array.from(
    new Set(members.map((member) => member.username.trim()).filter(Boolean)),
  ).sort((a, b) => b.length - a.length);

  const mentionRegex = memberNames.length
    ? new RegExp(`(@(?:${memberNames.map(escapeRegExp).join('|')}))`, 'gi')
    : null;
  const parts = mentionRegex ? text.split(mentionRegex) : [text];

  return parts.flatMap((part, index) => {
    const matchedMember = part.startsWith('@') && memberNames.some(
      (name) => name.toLowerCase() === part.slice(1).toLowerCase(),
    );

    if (!matchedMember) return renderLinks(part, own, `part-${index}`);

    return [
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
    ];
  });
}
