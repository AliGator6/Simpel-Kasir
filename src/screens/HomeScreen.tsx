import React, { useMemo, useState } from 'react';
import { User, HelpCircle, Settings, ShoppingCart, Banknote, Bike, BarChart3, Lamp, Users, LayoutGrid, Calculator, ReceiptText, BookOpen, Store, X } from 'lucide-react';
import { AppData, ScreenId } from '../types';
import { TopBar } from '../components/TopBar';
import { SimpelKasirLogo } from '../components/Logo';
import { formatMoney, toDateKey } from '../utils/storage';

interface HomeScreenProps {
  data: AppData;
  onOpenDrawer: () => void;
  onNavigate: (screen: ScreenId) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ data, onOpenDrawer, onNavigate }) => {
  const [showHelp, setShowHelp] = useState(false);
  const activeUser = data.users.find((u) => u.id === data.activeUserId) || data.users[0];

  const chartDays = useMemo(() => {
    const days: { label: string; total: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toDateKey(d.getTime());
      const sum = data.transactions.filter((t) => toDateKey(t.createdAt) === key).reduce((acc, t) => acc + t.total, 0);
      days.push({ label: `${d.getDate()}/${d.getMonth() + 1}`, total: sum });
    }
    return days;
  }, [data.transactions]);

  const maxChart = Math.max(...chartDays.map((d) => d.total), 0);

  const quickTiles: { id: ScreenId; label: string; icon: React.ComponentType<{ className?: string }>; tone: 'navy' | 'terracotta' }[] = [
    { id: 'products', label: 'Produk', icon: Lamp, tone: 'navy' },
    { id: 'customers', label: 'Pelanggan', icon: Users, tone: 'terracotta' },
    { id: 'master', label: 'Master', icon: LayoutGrid, tone: 'terracotta' },
    { id: 'cashflow', label: 'Arus Kas', icon: Calculator, tone: 'navy' },
    { id: 'expenses', label: 'Pengeluaran', icon: ReceiptText, tone: 'terracotta' },
    { id: 'catalog', label: 'Katalog', icon: BookOpen, tone: 'terracotta' },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
      <TopBar
        title="SimpelKasir"
        mode="menu"
        onLeftClick={onOpenDrawer}
        rightContent={
          <>
            <button type="button" onClick={() => onNavigate('settings_users')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Profil Pengguna">
              <User className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setShowHelp(true)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Bantuan">
              <HelpCircle className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => onNavigate('settings')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Pengaturan">
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 pb-8 pt-4">
        <div className="flex items-center justify-between gap-2">
          <button type="button" onClick={() => onNavigate('settings_store')} className="inline-flex items-center gap-2 rounded-lg bg-[#B55340] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#9E4534] active:scale-[0.98] transition">
            <Store className="h-3.5 w-3.5" />
            <span className="truncate max-w-[180px]">{data.store.name}</span>
          </button>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            {activeUser.name} · {activeUser.role}
          </span>
        </div>

        <div className="mt-6 flex flex-col items-center">
          <button type="button" onClick={() => onNavigate('pos')} className="group relative flex h-32 w-32 items-center justify-center rounded-full bg-[#B55340] text-white shadow-lg shadow-[#B55340]/25 hover:bg-[#A14736] active:scale-[0.96] transition" aria-label="Transaksi Baru">
            <div className="flex flex-col items-center">
              <ShoppingCart className="h-12 w-12 stroke-[2.1]" />
              <span className="mt-1 text-[11px] font-semibold tracking-wide text-white/95">KASIR</span>
            </div>
          </button>
        </div>

        <div className="mt-8 grid grid-cols-3 gap-4 px-2">
          <button type="button" onClick={() => onNavigate('transactions')} className="flex flex-col items-center gap-2 group">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E2F42] text-white shadow-md group-hover:bg-[#273E56] group-active:scale-95 transition">
              <Banknote className="h-7 w-7" />
            </span>
            <span className="text-sm font-semibold text-[#1E2F42] dark:text-slate-200">Transaksi</span>
          </button>
          <button type="button" onClick={() => onNavigate('quick_tx')} className="flex flex-col items-center gap-2 group">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E2F42] text-white shadow-md group-hover:bg-[#273E56] group-active:scale-95 transition">
              <Bike className="h-7 w-7" />
            </span>
            <span className="text-sm font-semibold text-[#1E2F42] dark:text-slate-200">Cepat</span>
          </button>
          <button type="button" onClick={() => onNavigate('reports')} className="flex flex-col items-center gap-2 group">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#1E2F42] text-white shadow-md group-hover:bg-[#273E56] group-active:scale-95 transition">
              <BarChart3 className="h-7 w-7" />
            </span>
            <span className="text-sm font-semibold text-[#1E2F42] dark:text-slate-200">Laporan</span>
          </button>
        </div>

        <div className="mt-8 flex items-start gap-3.5 overflow-x-auto pb-2 no-scrollbar lg:grid lg:grid-cols-6">
          {quickTiles.map((tile) => {
            const Icon = tile.icon;
            const isNavy = tile.tone === 'navy';
            return (
              <button key={tile.id} type="button" onClick={() => onNavigate(tile.id)} className="flex shrink-0 flex-col items-center gap-1.5 group">
                <span className={`flex h-12 w-16 items-center justify-center rounded-xl text-white shadow-sm group-active:scale-95 transition ${isNavy ? 'bg-[#1E2F42] hover:bg-[#283E56]' : 'bg-[#B55340] hover:bg-[#9E4534]'}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className={`text-xs font-semibold whitespace-nowrap ${isNavy ? 'text-[#1E2F42] dark:text-slate-200' : 'text-[#B55340] dark:text-[#E08A79]'}`}>
                  {tile.label}
                </span>
              </button>
            );
          })}
        </div>

        <section className="mt-8 flex-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] p-4 flex flex-col justify-center min-h-[190px]">
          {maxChart === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="text-sm font-medium text-[#B8862D] dark:text-amber-400">Belum ada data grafik penjualan.</p>
              <p className="mt-1 text-xs text-slate-400">Ketuk tombol keranjang merah di atas untuk transaksi pertama.</p>
            </div>
          ) : (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Penjualan 7 Hari Terakhir</span>
                <span className="text-xs font-bold tabular-nums text-[#1E2F42] dark:text-slate-200">
                  {formatMoney(chartDays.reduce((a, b) => a + b.total, 0), data.currencySymbol)}
                </span>
              </div>
              <div className="flex h-32 items-end gap-2 pt-2">
                {chartDays.map((d) => {
                  const pct = Math.max(6, Math.round((d.total / maxChart) * 100));
                  return (
                    <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5 h-full justify-end">
                      <div className="w-full max-w-[34px] rounded-t-md bg-[#1E2F42] dark:bg-[#B55340] transition-all" style={{ height: `${d.total > 0 ? pct : 4}%`, opacity: d.total > 0 ? 1 : 0.25 }} title={`${d.label}: ${formatMoney(d.total, data.currencySymbol)}`} />
                      <span className="text-[10px] font-medium tabular-nums text-slate-500 dark:text-slate-400">{d.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </main>

      {showHelp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <SimpelKasirLogo size={34} />
                <h2 className="text-base font-bold">Panduan Cepat SimpelKasir</h2>
              </div>
              <button type="button" onClick={() => setShowHelp(false)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600 dark:text-slate-300">
              <li>• <strong>Ketuk kotak hijau / +</strong> di layar kasir untuk langsung menambah +1 item.</li>
              <li>• <strong>Ketuk nama produk</strong> untuk mengetik jumlah manual lewat pop-up.</li>
              <li>• <strong>Tahan ketuk (long press)</strong> pada baris produk di kasir untuk langsung mengedit produk tersebut.</li>
              <li>• <strong>Tombol Disket</strong> di Review Keranjang menyimpan pesanan ke menu <strong>Transaksi Cepat</strong>.</li>
              <li>• <strong>Kartu Pecahan</strong> di Pembayaran mulai menghitung dari 0 pada ketukan pertama, tombol merah (-) mengurangi.</li>
            </ul>
            <button type="button" onClick={() => setShowHelp(false)} className="mt-5 w-full rounded-xl bg-[#1E2F42] py-2.5 text-sm font-semibold text-white">Mengerti</button>
          </div>
        </div>
      )}
    </div>
  );
};
