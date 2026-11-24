import React, { useMemo, useState } from 'react';
import {
  User,
  HelpCircle,
  Settings,
  ShoppingCart,
  Banknote,
  Bike,
  BarChart3,
  Lamp,
  Users,
  LayoutGrid,
  Calculator,
  ReceiptText,
  BookOpen,
  Store,
  ChevronRight,
  X,
} from 'lucide-react';
import { ActiveOrderDraft, AppData, ScreenId } from '../types';
import { TopBar, useBackClose } from '../components/TopBar';
import { SimpelKasirLogo } from '../components/Logo';
import { formatMoney, toDateKey } from '../utils/storage';

interface HomeScreenProps {
  data: AppData;
  draft: ActiveOrderDraft;
  onOpenDrawer: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ data, draft, onOpenDrawer, onNavigate }) => {
  const [showHelp, setShowHelp] = useState(false);
  useBackClose(showHelp, () => setShowHelp(false));

  const activeUser = data.users.find((u) => u.id === data.activeUserId) || data.users[0];

  const draftSummary = useMemo(() => {
    const count = draft.items.reduce((acc, it) => acc + it.qty, 0);
    const subtotal = draft.items.reduce((acc, it) => acc + Math.max(0, it.unitPrice * it.qty - it.discount), 0);
    return { count, total: Math.max(0, subtotal - draft.discount) };
  }, [draft]);

  const chartDays = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toDateKey(d.getTime());
      const sum = data.transactions
        .filter((t) => toDateKey(t.createdAt) === key)
        .reduce((acc, t) => acc + t.total, 0);
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total: sum });
    }
    return days;
  }, [data.transactions]);

  const maxChart = Math.max(...chartDays.map((d) => d.total), 0);

  const quickTiles: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }>; tone: 'obsidian' | 'gold' }[] = [
    { id: 'products', label: 'Produk', icon: Lamp, tone: 'obsidian' },
    { id: 'customers', label: 'Pelanggan', icon: Users, tone: 'gold' },
    { id: 'master', label: 'Master', icon: LayoutGrid, tone: 'gold' },
    { id: 'cashflow', label: 'Arus Kas', icon: Calculator, tone: 'obsidian' },
    { id: 'expenses', label: 'Pengeluaran', icon: ReceiptText, tone: 'gold' },
    { id: 'catalog', label: 'Katalog', icon: BookOpen, tone: 'gold' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
      <TopBar
        title="SimpelKasir"
        mode="menu"
        onLeftClick={onOpenDrawer}
        rightContent={
          <>
            <button
              type="button"
              onClick={() => onNavigate('settings_users')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Profil Pengguna"
            >
              <User className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Bantuan"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Pengaturan"
            >
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-8 pt-4">
        {/* Top Store Chip + Active User */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onNavigate('settings_store')}
            className="btn-lux-gold inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold"
          >
            <Store className="h-3.5 w-3.5" />
            <span className="truncate max-w-[180px]">{data.store.name}</span>
          </button>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {activeUser.name} · {activeUser.role}
          </span>
        </div>

        {/* Active Draft Recovery / Resume Card (When Cart Has Saved Items) */}
        {draftSummary.count > 0 && (
          <button
            type="button"
            onClick={() => onNavigate('cart')}
            className="mt-3.5 flex w-full items-center justify-between rounded-2xl border border-[#165B49]/25 dark:border-[#2CA585]/30 bg-[#EBF3F0] dark:bg-[#142722] px-4 py-2.5 text-left shadow-xs active:scale-[0.99] transition"
          >
            <div className="min-w-0">
              <p className="text-xs font-bold text-[#165B49] dark:text-[#57C7A8]">
                Keranjang Aktif Tersimpan · {draft.items.length} produk
              </p>
              <p className="text-xs tabular-nums text-slate-600 dark:text-slate-300 truncate">
                {draft.customerName} · {formatMoney(draftSummary.total, data.currencySymbol)}
              </p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#165B49] dark:text-[#57C7A8]">
              Lanjutkan <ChevronRight className="h-4 w-4" />
            </span>
          </button>
        )}

        {/* Hero Primary CTA: Big Circular Emerald Cart+ (GriyoPos Center Layout) */}
        <div className="mt-7 flex flex-col items-center">
          <button
            type="button"
            onClick={() => onNavigate('pos')}
            className="btn-lux-primary group relative flex h-32 w-32 items-center justify-center rounded-full ring-8 ring-[#165B49]/10 dark:ring-[#2CA585]/15"
            aria-label="Transaksi Baru"
          >
            <div className="flex flex-col items-center">
              <ShoppingCart className="h-11 w-11 stroke-[2]" />
              <span className="font-display mt-1.5 text-xs font-bold tracking-widest text-white/95">
                KASIR
              </span>
            </div>
          </button>
        </div>

        {/* 3 Secondary Circular Shortcuts (GriyoPos 3-col Layout) */}
        <div className="mt-8 grid grid-cols-3 gap-4 px-2">
          <button
            type="button"
            onClick={() => onNavigate('transactions')}
            className="flex flex-col items-center gap-2 group"
          >
            <span className="btn-lux-obsidian flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-slate-900/5 dark:ring-white/5">
              <Banknote className="h-6 w-6" />
            </span>
            <span className="font-display text-sm font-semibold text-[#17252B] dark:text-slate-200">
              Transaksi
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('quick_tx')}
            className="flex flex-col items-center gap-2 group"
          >
            <span className="btn-lux-obsidian flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-slate-900/5 dark:ring-white/5">
              <Bike className="h-6 w-6" />
            </span>
            <span className="font-display text-sm font-semibold text-[#17252B] dark:text-slate-200">
              Cepat
            </span>
          </button>

          <button
            type="button"
            onClick={() => onNavigate('reports')}
            className="flex flex-col items-center gap-2 group"
          >
            <span className="btn-lux-obsidian flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-slate-900/5 dark:ring-white/5">
              <BarChart3 className="h-6 w-6" />
            </span>
            <span className="font-display text-sm font-semibold text-[#17252B] dark:text-slate-200">
              Laporan
            </span>
          </button>
        </div>

        {/* Horizontal Scrollable Module Tiles (GriyoPos Ribbon Layout) */}
        <div className="mt-8 flex items-start gap-3.5 overflow-x-auto pb-2 no-scrollbar lg:grid lg:grid-cols-6">
          {quickTiles.map((tile) => {
            const Icon = tile.icon;
            const isObsidian = tile.tone === 'obsidian';
            return (
              <button
                key={tile.id}
                type="button"
                onClick={() => onNavigate(tile.id)}
                className="flex shrink-0 flex-col items-center gap-1.5 group"
              >
                <span
                  className={`flex h-12 w-16 items-center justify-center rounded-2xl ${
                    isObsidian ? 'btn-lux-obsidian' : 'btn-lux-gold'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <span
                  className={`text-xs font-semibold whitespace-nowrap ${
                    isObsidian
                      ? 'text-[#1E2E35] dark:text-slate-200'
                      : 'text-[#8C6A2E] dark:text-[#D5B26E]'
                  }`}
                >
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom 7-Day Summary Chart Area */}
        <section className="surface-card mt-8 flex-1 rounded-3xl p-5 flex flex-col justify-center min-h-[190px]">
          {maxChart === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="font-display text-sm font-semibold text-[#8C6A2E] dark:text-[#D5B26E]">
                Belum ada data grafik penjualan.
              </p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Ketuk tombol Kasir di atas untuk memulai transaksi pertama.
              </p>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Penjualan 7 Hari Terakhir
                </span>
                <span className="font-display text-sm font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                  {formatMoney(chartDays.reduce((a, b) => a + b.total, 0), data.currencySymbol)}
                </span>
              </div>
              <div className="flex h-32 items-end gap-2 pt-2">
                {chartDays.map((d) => {
                  const pct = Math.max(6, Math.round((d.total / maxChart) * 100));
                  return (
                    <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                      <div
                        className="w-full max-w-[34px] rounded-t-lg bg-gradient-to-t from-[#165B49] to-[#27856D] dark:from-[#1D735D] dark:to-[#3EB494] transition-all"
                        style={{ height: `${d.total > 0 ? pct : 4}%`, opacity: d.total > 0 ? 1 : 0.2 }}
                        title={`${d.label}: ${formatMoney(d.total, data.currencySymbol)}`}
                      />
                      <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">
                        {d.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
          <div className="surface-card animate-modal-in w-full max-w-md rounded-3xl p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SimpelKasirLogo size={34} />
                <h2 className="font-display text-base font-bold">Panduan Cepat SimpelKasir</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowHelp(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li>• <strong>Ketuk kotak +</strong> di layar kasir untuk langsung menambah +1 item.</li>
              <li>• <strong>Ketuk nama produk</strong> untuk mengetik jumlah manual lewat pop-up.</li>
              <li>• <strong>Tahan ketuk (long press)</strong> pada baris produk di kasir untuk langsung mengedit produk tersebut.</li>
              <li>• <strong>Tombol Disket</strong> di Review Keranjang menyimpan pesanan ke menu <strong>Transaksi Cepat</strong>.</li>
              <li>• <strong>Keranjang Otomatis Tersimpan:</strong> Item terpilih tetap aman meski aplikasi ditutup atau tombol Kembali ditekan.</li>
            </ul>
            <button
              type="button"
              onClick={() => setShowHelp(false)}
              className="btn-lux-primary mt-5 w-full rounded-2xl py-2.5 text-sm font-semibold"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
