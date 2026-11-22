import React from 'react';
import { Home, ShoppingCart, Bike, Banknote, Lamp, ReceiptText, Calculator, LayoutGrid, BarChart3, Settings, Store } from 'lucide-react';
import { ScreenId, StoreInfo, UserAccount } from '../types';
import { SimpelKasirLogo } from './Logo';

const MENU_ITEMS: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'pos', label: 'Transaksi Baru', icon: ShoppingCart },
  { id: 'quick_tx', label: 'Transaksi Cepat', icon: Bike },
  { id: 'transactions', label: 'Daftar Transaksi', icon: Banknote },
  { id: 'products', label: 'Produk', icon: Lamp },
  { id: 'expenses', label: 'Pengeluaran', icon: ReceiptText },
  { id: 'cashflow', label: 'Arus Kas', icon: Calculator },
  { id: 'master', label: 'Master', icon: LayoutGrid },
  { id: 'reports', label: 'Laporan', icon: BarChart3 },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export const Drawer: React.FC<{
  open: boolean;
  onClose: () => void;
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  store: StoreInfo;
  activeUser: UserAccount;
}> = ({ open, onClose, currentScreen, onNavigate, store, activeUser }) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="fixed inset-0 bg-black/50 backdrop-blur-[1px]" onClick={onClose} />
      <aside className="relative z-10 flex h-full w-[290px] max-w-[82vw] flex-col bg-white dark:bg-[#1A222C] shadow-2xl">
        <div className="bg-[#232B35] px-4 py-5 text-white flex items-center gap-3.5">
          <div className="h-14 w-14 shrink-0 rounded-full bg-white p-1 flex items-center justify-center shadow-sm">
            <SimpelKasirLogo size={46} className="rounded-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold tracking-tight truncate">{activeUser.name}</p>
            <p className="text-xs text-slate-300 truncate">{store.name}</p>
            <button
              onClick={() => { onNavigate('settings_store'); onClose(); }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-[#B55340] px-3 py-1 text-xs font-semibold text-white hover:bg-[#9E4534]"
            >
              <Store className="h-3.5 w-3.5" /> Toko
            </button>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentScreen === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); onClose(); }}
                className={`w-full flex items-center gap-4 px-5 py-3.5 text-left text-[15px] font-semibold transition-colors ${active ? 'bg-[#B55340] text-white' : 'text-[#1E293B] dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/60'}`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-white' : 'text-[#1E2F42] dark:text-slate-300'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>
    </div>
  );
};
