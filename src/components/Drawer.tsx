import React from 'react';
import {
  Home,
  ShoppingCart,
  Bike,
  Banknote,
  Lamp,
  ReceiptText,
  Calculator,
  LayoutGrid,
  BarChart3,
  Wifi,
  Settings,
  Store,
  Lock,
  LockOpen,
  LogOut,
} from 'lucide-react';
import { ScreenId, StoreInfo, UserAccount } from '../types';
import { SimpelKasirLogo } from './Logo';

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  currentScreen: ScreenId;
  onNavigate: (screen: ScreenId) => void;
  store: StoreInfo;
  activeUser: UserAccount;
  isOwnerLoggedIn: boolean;
  onOpenOwnerAuth: () => void;
}

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
  { id: 'sync', label: 'Sinkron', icon: Wifi },
  { id: 'settings', label: 'Pengaturan', icon: Settings },
];

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  currentScreen,
  onNavigate,
  store,
  activeUser,
  isOwnerLoggedIn,
  onOpenOwnerAuth,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-[#0B1311]/55 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
      />
      <aside className="relative z-10 flex h-full w-[292px] max-w-[82vw] flex-col bg-[#F9FAF8] dark:bg-[#131C21] shadow-2xl border-r border-[#E2E6E1] dark:border-[#223039]">
        {/* Header Drawer */}
        <div className="bg-gradient-to-br from-[#132622] via-[#18312C] to-[#0E1D1A] px-4 py-5 text-white flex items-center gap-3.5 border-b border-white/10">
          <div className="h-14 w-14 shrink-0 rounded-2xl bg-white/95 p-1 flex items-center justify-center shadow-md ring-1 ring-white/25">
            <SimpelKasirLogo size={46} className="rounded-xl" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-bold tracking-tight truncate">
              {isOwnerLoggedIn ? 'Pemilik Toko' : activeUser.name}
            </p>
            <p className="text-xs text-emerald-100/75 truncate">{store.name}</p>
            <button
              type="button"
              onClick={() => {
                onNavigate('settings_store');
                onClose();
              }}
              className="btn-lux-gold mt-2 inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
            >
              <Store className="h-3.5 w-3.5" />
              Toko
            </button>
          </div>
        </div>

        {/* Menu List */}
        <nav className="flex-1 overflow-y-auto p-2.5 space-y-1">
          {MENU_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = currentScreen === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-xl text-left text-[14px] font-semibold transition-all duration-150 ${
                  active
                    ? 'btn-lux-primary'
                    : 'text-[#1E2E33] dark:text-[#DCE5E2] hover:bg-[#ECEFEA] dark:hover:bg-[#1B272E] active:scale-[0.98]'
                }`}
              >
                <Icon className={`h-[18px] w-[18px] shrink-0 ${active ? 'text-white' : 'text-[#165B49] dark:text-[#4BB89A]'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer Akun Pemilik */}
        <div className="border-t border-[#E2E6E1] dark:border-[#223039] p-3">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenOwnerAuth();
            }}
            className={`w-full flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
              isOwnerLoggedIn
                ? 'btn-lux-garnet'
                : 'btn-lux-obsidian'
            }`}
          >
            <span className="flex items-center gap-2">
              {isOwnerLoggedIn ? <LogOut className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span>{isOwnerLoggedIn ? 'Logout Pemilik' : 'Login Pemilik'}</span>
            </span>
            <span className="flex items-center gap-1 text-[10px] opacity-90">
              {isOwnerLoggedIn ? <LockOpen className="h-3.5 w-3.5" /> : null}
              {isOwnerLoggedIn ? 'Aktif' : 'Laba Terkunci'}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
};
