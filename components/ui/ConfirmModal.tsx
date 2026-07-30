'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: 'danger' | 'primary';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Hapus',
  cancelText = 'Batal',
  confirmVariant = 'danger',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-fade-in">
      {/* Backdrop overlay */}
      <div className="absolute inset-0" onClick={loading ? undefined : onCancel} />

      <div className="relative z-10 w-full max-w-md bg-white border border-[#E8E8EC] rounded-2xl p-6 shadow-2xl space-y-5 animate-slide-left">
        {/* Header with warning icon */}
        <div className="flex items-start gap-4">
          <div
            className={`p-3 rounded-2xl flex-shrink-0 ${
              confirmVariant === 'danger' ? 'bg-[#FFF0ED] text-[#D95858]' : 'bg-[#EEF2F7] text-[#24324A]'
            }`}
          >
            {confirmVariant === 'danger' ? <Trash2 className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-base font-extrabold text-[#24324A]">{title}</h3>
            <p className="text-xs text-[#737680] mt-1 leading-relaxed">{message}</p>
          </div>

          <button
            onClick={onCancel}
            disabled={loading}
            className="text-[#737680] hover:text-[#24324A] p-1 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E8E8EC]">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-xs font-semibold text-[#737680] hover:bg-[#F7F7F8] rounded-xl transition-colors cursor-pointer"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs font-bold rounded-xl text-white shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              confirmVariant === 'danger'
                ? 'bg-[#D95858] hover:bg-[#b84343]'
                : 'bg-[#24324A] hover:bg-[#1a2536]'
            }`}
          >
            {loading ? (
              <span>Memproses…</span>
            ) : (
              <span>{confirmText}</span>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
