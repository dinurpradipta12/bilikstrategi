'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type ModalPortalProps = {
  children: React.ReactNode;
  onClose: () => void;
};

export default function ModalPortal({ children, onClose }: ModalPortalProps) {
  const [mounted, setMounted] = useState(false);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mounted]);

  if (!mounted) return null;

  return createPortal(
    <div
      data-mobile-modal
      className="fixed inset-0 z-[200] flex items-end justify-center bg-[#182238]/45 p-0 md:items-center md:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCloseRef.current();
      }}
    >
      {children}
    </div>,
    document.body
  );
}
