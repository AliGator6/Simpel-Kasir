import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';

interface TopBarProps {
  title: string;
  mode: 'menu' | 'back';
  onLeftClick: () => void;
  rightContent?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ title, mode, onLeftClick, rightContent }) => (
  <header className="sticky top-0 z-30 flex h-14 items-center justify-between bg-[#1E2F42] px-3 text-white shadow-sm">
    <div className="flex min-w-0 items-center gap-2">
      <button type="button" onClick={onLeftClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg hover:bg-white/10 active:bg-white/20 transition" aria-label={mode === 'menu' ? 'Buka menu' : 'Kembali'}>
        {mode === 'menu' ? <Menu className="h-6 w-6" /> : <ArrowLeft className="h-6 w-6" />}
      </button>
      <h1 className="truncate text-[18px] font-semibold tracking-tight">{title}</h1>
    </div>
    {rightContent && <div className="flex shrink-0 items-center gap-1">{rightContent}</div>}
  </header>
);

export const SwitchRow: React.FC<{ label: string; sublabel?: string; checked: boolean; onChange: (checked: boolean) => void; indented?: boolean }> = ({ label, sublabel, checked, onChange, indented = false }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`flex w-full items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 py-3.5 text-left transition hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${indented ? 'pl-9 pr-4 bg-slate-50/50 dark:bg-slate-900/30' : 'px-4'}`}
  >
    <div className="min-w-0 flex-1">
      <p className="text-[15px] font-medium text-slate-800 dark:text-slate-100 leading-snug">{label}</p>
      {sublabel && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sublabel}</p>}
    </div>
    <div className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-[#B55340]/35' : 'bg-slate-300 dark:bg-slate-700'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full shadow transition-transform ${checked ? 'translate-x-5 bg-[#B55340]' : 'translate-x-0.5 bg-white dark:bg-slate-300'}`} />
    </div>
  </button>
);
