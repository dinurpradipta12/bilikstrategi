'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

type EditorAccordionProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  defaultOpen?: boolean;
};

export function EditorAccordion({
  title,
  icon,
  children,
  action,
  defaultOpen = false,
}: EditorAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="border-b border-[#E8E8EC] pb-1 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-md py-1 text-left text-xs font-extrabold text-[#24324A] transition hover:text-[#F26B5E]"
        >
          {icon}
          <span className="min-w-0 flex-1">{title}</span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-[#737680] transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        {action}
      </div>
      {open && <div className="mt-3 space-y-3">{children}</div>}
    </section>
  );
}
