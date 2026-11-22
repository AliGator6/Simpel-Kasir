import React, { useEffect, useRef } from 'react';
import { ArrowLeft, Menu } from 'lucide-react';

export function useBackClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!active) return;
    const handler = (e: Event) => {
      if (e.defaultPrevented) return;
      e.preventDefault();
      onCloseRef.current();
    };
    window.addEventListener('simpelkasir-back-request', handler);
    return () => window.removeEventListener('simpelkasir-back-request', handler);
  }, [active]);
}

interface TopBarProps {
  title: string;
  mode: 'menu' | 'back';
  onLeftClick: () => void;
  rightContent?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ title, mode, onLeftClick, rightContent }) => {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-gradient-to-r from-[#122622] via-[#17302B] to-[#122622] px-3 text-[#F4F7F5] shadow-[0_4px_16px_-4px_rgba(12,26,22,0.35)] border-b border-white/10">
      <div className="flex min-w-0 items-center gap-2">
        <button
          type="button"
          onClick={onLeftClick}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition-all duration-150"
          aria-label={mode === 'menu' ? 'Buka menu' : 'Kembali'}
        >
          {mode === 'menu' ? <Menu className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
        </button>
        <h1 className="font-display truncate text-[18px] font-semibold tracking-tight">{title}</h1>
      </div>
      {rightContent && <div className="flex shrink-0 items-center gap-1">{rightContent}</div>}
    </header>
  );
};

interface SwitchRowProps {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  indented?: boolean;
}

export const SwitchRow: React.FC<SwitchRowProps> = ({
  label,
  sublabel,
  checked,
  onChange,
  indented = false,
}) => {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between gap-4 border-b border-[#EAECE8] dark:border-[#223039] py-3.5 text-left transition hover:bg-[#F7F9F7] dark:hover:bg-[#1B262E]/70 ${
        indented ? 'pl-9 pr-4 bg-[#F9FAF8] dark:bg-[#11191E]/60' : 'px-4'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-[#17252B] dark:text-[#ECF1EF] leading-snug">{label}</p>
        {sublabel && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>}
      </div>
      <div
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ${
          checked ? 'bg-[#165B49]/30 dark:bg-[#24826A]/35' : 'bg-slate-300 dark:bg-slate-700'
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-5 bg-[#165B49] dark:bg-[#2CA585]' : 'translate-x-0.5 bg-white dark:bg-slate-300'
          }`}
        />
      </div>
    </button>
  );
};
