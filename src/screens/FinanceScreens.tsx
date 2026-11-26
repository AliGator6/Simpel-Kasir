import React, { useMemo, useState } from 'react';
import {
  Search,
  Settings,
  ShoppingCart,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Banknote,
  CreditCard,
  Plus,
  Minus,
  Trash2,
  Printer,
  CheckCircle2,
  Download,
  Share2,
} from 'lucide-react';
import { AppData, CashflowKind, ProgressStatus, ScreenId, Transaction } from '../types';
import { TopBar, useBackClose } from '../components/TopBar';
import { NumericInput } from '../components/NumericInput';
import {
  formatDayHeader,
  formatDayReadable,
  formatMoney,
  formatNumber,
  formatTimeOnly,
  toDateKey,
} from '../utils/storage';
import {
  printDailyReportThermal,
  saveCanvasPngToDevice,
  shareCanvasPng,
} from '../utils/printer';
import { renderDailyReportToCanvas } from '../utils/receiptImage';

interface FinanceProps {
  screen: 'transactions' | 'cashflow' | 'expenses' | 'reports';
  data: AppData;
  isOwnerLoggedIn: boolean;
  onOpenDrawer: () => void;
  onNavigate: (s: ScreenId) => void;
  onOpenReceipt: (tx: Transaction) => void;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  notify: (msg: string) => void;
}

export const FinanceScreens: React.FC<FinanceProps> = ({
  screen,
  data,
  isOwnerLoggedIn,
  onOpenDrawer,
  onNavigate,
  onOpenReceipt,
  onUpdateData,
  notify,
}) => {
  const [txSearch, setTxSearch] = useState('');
  const [showTxSearch, setShowTxSearch] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [settleAmount, setSettleAmount] = useState(0);

  // Cashflow day state
  const [selectedDayTs, setSelectedDayTs] = useState<number>(Date.now());
  const [cashModalKind, setCashModalKind] = useState<CashflowKind | null>(null);
  const [cashTitle, setCashTitle] = useState('');
  const [cashAmount, setCashAmount] = useState(0);
  const [cashMethod, setCashMethod] = useState<'tunai' | 'non_tunai'>('tunai');

  // Back button modal close hooks
  useBackClose(Boolean(selectedTx), () => setSelectedTx(null));
  useBackClose(Boolean(cashModalKind), () => setCashModalKind(null));

  // Reports filter
  const [reportRange, setReportRange] = useState<'today' | 'month' | 'all'>('today');
  const [reportDateKey, setReportDateKey] = useState<string>(() => toDateKey(Date.now()));
  const [busyReportAction, setBusyReportAction] = useState<'print' | 'wa' | 'save' | null>(null);

  // Unconditional report memos (must stay above any conditional return to satisfy Rules of Hooks)
  const now = new Date();
  const todayKey = toDateKey(now.getTime());
  const monthPrefix = todayKey.slice(0, 7);

  const scopedTx = useMemo(
    () =>
      data.transactions.filter((t) => {
        if (reportRange === 'today') return toDateKey(t.createdAt) === todayKey;
        if (reportRange === 'month') return toDateKey(t.createdAt).startsWith(monthPrefix);
        return true;
      }),
    [data.transactions, reportRange, todayKey, monthPrefix]
  );

  const scopedExpenses = useMemo(
    () =>
      data.cashflows.filter((c) => {
        if (c.kind !== 'expense_profit') return false;
        if (reportRange === 'today') return toDateKey(c.createdAt) === todayKey;
        if (reportRange === 'month') return toDateKey(c.createdAt).startsWith(monthPrefix);
        return true;
      }),
    [data.cashflows, reportRange, todayKey, monthPrefix]
  );

  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    scopedTx.forEach((t) => {
      t.items.forEach((i) => {
        const cur = map.get(i.productId) || { name: i.name, qty: 0, revenue: 0 };
        cur.qty += i.qty;
        cur.revenue += i.unitPrice * i.qty - i.discount;
        map.set(i.productId, cur);
      });
    });
    return Array.from(map.values()).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [scopedTx]);

  const dailyReportTx = useMemo(
    () =>
      data.transactions
        .filter((t) => toDateKey(t.createdAt) === reportDateKey)
        .sort((a, b) => a.receiptNo - b.receiptNo || a.createdAt - b.createdAt),
    [data.transactions, reportDateKey]
  );

  // =========================================================
  // 1. DAFTAR TRANSAKSI
  // =========================================================
  if (screen === 'transactions') {
    const filtered = data.transactions.filter((t) => {
      const q = txSearch.trim().toLowerCase();
      if (!q) return true;
      return (
        String(t.receiptNo).includes(q) ||
        t.customerName.toLowerCase().includes(q) ||
        t.items.some((i) => i.name.toLowerCase().includes(q))
      );
    });

    const grouped = new Map<string, { dayLabel: string; items: Transaction[]; total: number }>();
    filtered.forEach((tx) => {
      const key = toDateKey(tx.createdAt);
      const entry = grouped.get(key) || { dayLabel: formatDayHeader(tx.createdAt), items: [], total: 0 };
      entry.items.push(tx);
      entry.total += tx.total;
      grouped.set(key, entry);
    });

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar
          title="Transaksi"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <>
              <button
                type="button"
                onClick={() => setShowTxSearch((s) => !s)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Cari transaksi"
              >
                <Search className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings_receipt')}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Pengaturan transaksi"
              >
                <Settings className="h-5 w-5" />
              </button>
            </>
          }
        />

        {showTxSearch && (
          <div className="bg-white dark:bg-[#151E24] px-4 py-2.5 border-b border-[#E5E8E4] dark:border-[#223039]">
            <input
              type="text"
              autoFocus
              value={txSearch}
              onChange={(e) => setTxSearch(e.target.value)}
              placeholder="Cari nomor struk (#), nama pelanggan, atau produk..."
              className="w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
            />
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl flex-1">
          {grouped.size === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500">
              Belum ada transaksi tercatat.
            </div>
          ) : (
            Array.from(grouped.entries()).map(([key, grp]) => (
              <div key={key}>
                {/* Daily Header Bar */}
                <div className="flex items-center justify-between bg-[#E9EDE8] dark:bg-[#1A252C] px-4 py-2.5 text-sm font-bold">
                  <span className="text-[#17252B] dark:text-slate-200">{grp.dayLabel}</span>
                  <span className="font-display tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                    {formatMoney(grp.total, data.currencySymbol)}
                  </span>
                  <span className="tabular-nums text-[#17252B] dark:text-slate-200">{grp.items.length}</span>
                </div>

                {/* Day Transactions */}
                <div className="divide-y divide-[#EAECE8] dark:divide-[#223039] bg-white dark:bg-[#151E24]">
                  {grp.items.map((tx) => {
                    const summary = tx.items.map((i) => `${i.name}:${i.qty}`).join(' ');
                    const statusLabel =
                      tx.paymentStatus === 'lunas'
                        ? 'Lunas'
                        : tx.paymentStatus === 'kurang'
                        ? `Kurang ${formatMoney(Math.max(0, tx.total - tx.paidAmount), data.currencySymbol)}`
                        : 'Belum Dibayar';
                    const statusColor =
                      tx.paymentStatus === 'lunas'
                        ? 'text-[#165B49] dark:text-[#4BB89A]'
                        : tx.paymentStatus === 'kurang'
                        ? 'text-[#B07D32] dark:text-[#DFAA56]'
                        : 'text-[#B54B54] dark:text-[#E07A82]';

                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => {
                          setSelectedTx(tx);
                          setSettleAmount(Math.max(0, tx.total - tx.paidAmount));
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-[#F7F9F7] dark:hover:bg-[#1B262E] transition"
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-display font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                            {formatMoney(tx.total, data.currencySymbol)}
                          </span>
                          <span className="tabular-nums text-slate-600 dark:text-slate-400">
                            {formatTimeOnly(tx.createdAt)}
                          </span>
                          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">
                            #{tx.receiptNo}
                          </span>
                        </div>
                        <div className="mt-1 flex items-start justify-between gap-4">
                          <span className="text-xs text-slate-500">
                            {tx.customerName === 'Umum' ? '-' : tx.customerName}
                            {data.businessFlags.useProgress && ` · ${tx.progressStatus.toUpperCase()}`}
                          </span>
                          <div className="text-right">
                            <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">{summary}</p>
                            <p className={`mt-0.5 text-xs font-bold ${statusColor}`}>{statusLabel}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Luxury Emerald FAB */}
        <button
          type="button"
          onClick={() => onNavigate('pos')}
          className="btn-lux-primary fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full"
          aria-label="Transaksi Baru"
        >
          <ShoppingCart className="h-6 w-6" />
        </button>

        {/* Transaction Detail Modal */}
        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-sm rounded-3xl p-5 shadow-2xl">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-base font-bold">Transaksi #{selectedTx.receiptNo}</h3>
                <span className="text-xs text-slate-500">{selectedTx.customerName}</span>
              </div>
              <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-[#EAECE8] dark:divide-[#223039] text-sm">
                {selectedTx.items.map((it) => (
                  <div key={it.productId} className="flex justify-between py-1.5">
                    <span>
                      {it.name} x{it.qty}
                    </span>
                    <span className="tabular-nums font-semibold">
                      {formatMoney(it.unitPrice * it.qty - it.discount, data.currencySymbol)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-[#E5E8E4] dark:border-[#223039] pt-2 text-sm font-bold">
                <span>Total</span>
                <span className="font-display tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                  {formatMoney(selectedTx.total, data.currencySymbol)}
                </span>
              </div>

              {data.businessFlags.useProgress && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-500">Status Progres</label>
                  <select
                    value={selectedTx.progressStatus}
                    onChange={(e) => {
                      const nextSt = e.target.value as ProgressStatus;
                      onUpdateData((prev) => ({
                        ...prev,
                        transactions: prev.transactions.map((t) =>
                          t.id === selectedTx.id ? { ...t, progressStatus: nextSt } : t
                        ),
                      }));
                      setSelectedTx({ ...selectedTx, progressStatus: nextSt });
                      notify('Progres diperbarui');
                    }}
                    className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#0E1418] px-3 py-2 text-sm"
                  >
                    <option value="antri">Antri</option>
                    <option value="proses">Proses</option>
                    <option value="selesai">Selesai</option>
                    <option value="diambil">Diambil</option>
                  </select>
                </div>
              )}

              {selectedTx.paymentStatus !== 'lunas' && (
                <div className="mt-3 rounded-2xl bg-[#F5F6F4] dark:bg-[#1B262E] p-3">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Bayar Cicilan / Pelunasan (Sisa: {formatMoney(selectedTx.total - selectedTx.paidAmount, data.currencySymbol)})
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <NumericInput
                      min={0}
                      value={settleAmount}
                      onValueChange={setSettleAmount}
                      className="flex-1 rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#0E1418] px-2.5 py-1.5 text-sm font-bold tabular-nums outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const add = Math.max(0, settleAmount);
                        if (add <= 0) return;
                        onUpdateData((prev) => ({
                          ...prev,
                          transactions: prev.transactions.map((t) => {
                            if (t.id !== selectedTx.id) return t;
                            const nextPaid = t.paidAmount + add;
                            return {
                              ...t,
                              paidAmount: nextPaid,
                              changeAmount: nextPaid - t.total,
                              paidAt: Date.now(),
                              paymentStatus: nextPaid >= t.total ? 'lunas' : 'kurang',
                            };
                          }),
                          cashflows: [
                            {
                              id: `cf-settle-${Date.now()}`,
                              createdAt: Date.now(),
                              kind: 'in',
                              method: 'tunai',
                              amount: Math.min(add, selectedTx.total - selectedTx.paidAmount),
                              title: `Pelunasan #${selectedTx.receiptNo}`,
                              note: selectedTx.customerName,
                              transactionId: selectedTx.id,
                            },
                            ...prev.cashflows,
                          ],
                        }));
                        setSelectedTx(null);
                        notify('Pembayaran piutang dicatat');
                      }}
                      className="btn-lux-primary flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Bayar
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selectedTx;
                    setSelectedTx(null);
                    onOpenReceipt(target);
                  }}
                  className="btn-lux-primary flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold"
                >
                  <Printer className="h-4 w-4" /> Struk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateData((prev) => ({
                      ...prev,
                      transactions: prev.transactions.filter((t) => t.id !== selectedTx.id),
                      cashflows: prev.cashflows.filter((c) => c.transactionId !== selectedTx.id),
                    }));
                    setSelectedTx(null);
                    notify('Transaksi dibatalkan / diretur');
                  }}
                  className="btn-lux-garnet flex items-center justify-center gap-1 rounded-xl py-2.5 text-xs font-bold"
                >
                  <Trash2 className="h-4 w-4" /> Retur
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedTx(null)}
                  className="btn-lux-soft rounded-xl py-2.5 text-xs font-bold"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 2. ARUS KAS
  // =========================================================
  if (screen === 'cashflow') {
    const cumTunai = data.cashflows
      .filter((c) => c.method === 'tunai')
      .reduce((acc, c) => (c.kind === 'in' ? acc + c.amount : acc - c.amount), 0);
    const cumNonTunai = data.cashflows
      .filter((c) => c.method === 'non_tunai')
      .reduce((acc, c) => (c.kind === 'in' ? acc + c.amount : acc - c.amount), 0);

    const dayKey = toDateKey(selectedDayTs);
    const dayEntries = data.cashflows.filter((c) => toDateKey(c.createdAt) === dayKey);
    const dayTx = data.transactions.filter((t) => toDateKey(t.createdAt) === dayKey);

    const inTunai = dayEntries.filter((c) => c.kind === 'in' && c.method === 'tunai').reduce((a, b) => a + b.amount, 0);
    const inNonTunai = dayEntries.filter((c) => c.kind === 'in' && c.method === 'non_tunai').reduce((a, b) => a + b.amount, 0);
    const outTunai = dayEntries.filter((c) => c.kind !== 'in' && c.method === 'tunai').reduce((a, b) => a + b.amount, 0);
    const outNonTunai = dayEntries.filter((c) => c.kind !== 'in' && c.method === 'non_tunai').reduce((a, b) => a + b.amount, 0);

    const totalIn = inTunai + inNonTunai;
    const totalOut = outTunai + outNonTunai;
    const neraca = totalIn - totalOut;

    const grossProfitDay = dayTx.reduce((a, t) => a + t.totalProfit, 0);
    const expenseProfitDay = dayEntries.filter((c) => c.kind === 'expense_profit').reduce((a, b) => a + b.amount, 0);
    const netProfitDay = grossProfitDay - expenseProfitDay;

    const shiftDay = (delta: number) => {
      const d = new Date(selectedDayTs);
      d.setDate(d.getDate() + delta);
      setSelectedDayTs(d.getTime());
    };

    const submitCashModal = () => {
      const amt = Math.max(0, cashAmount);
      if (!cashModalKind || amt <= 0) return;
      const defaultTitle =
        cashModalKind === 'in' ? 'Uang Masuk' : cashModalKind === 'out_non_profit' ? 'Uang Keluar' : 'Pengeluaran';
      onUpdateData((prev) => ({
        ...prev,
        cashflows: [
          {
            id: `cf-${Date.now()}`,
            createdAt: selectedDayTs,
            kind: cashModalKind,
            method: cashMethod,
            amount: amt,
            title: cashTitle.trim() || defaultTitle,
            note: '',
          },
          ...prev.cashflows,
        ],
      }));
      setCashModalKind(null);
      setCashTitle('');
      setCashAmount(0);
      notify('Arus kas dicatat');
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-8">
        <TopBar
          title="Arus Kas"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <>
              <button
                type="button"
                onClick={() => setSelectedDayTs(Date.now())}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                title="Hari Ini"
              >
                <Calendar className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings')}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              >
                <Settings className="h-5 w-5" />
              </button>
            </>
          }
        />

        {/* Top Obsidian Cumulative Balance Banner */}
        <div className="bg-gradient-to-br from-[#132622] to-[#1A332E] px-4 py-3.5 text-white border-b border-white/10">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-emerald-100/80">
                <Banknote className="h-4 w-4 text-[#D5B26E]" /> Tunai
              </p>
              <p className="font-display mt-1 text-xl font-bold tabular-nums">{formatMoney(cumTunai, data.currencySymbol)}</p>
            </div>
            <div className="text-right">
              <p className="inline-flex items-center gap-1.5 text-xs text-emerald-100/80">
                <CreditCard className="h-4 w-4 text-[#D5B26E]" /> Non Tunai
              </p>
              <p className="font-display mt-1 text-xl font-bold tabular-nums">{formatMoney(cumNonTunai, data.currencySymbol)}</p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl px-3 pt-3">
          {/* Action + Date Switcher Row */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCashModalKind('in')}
                className="btn-lux-primary flex h-9 w-11 items-center justify-center rounded-xl"
                title="Tambah Uang Masuk"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCashModalKind('out_non_profit')}
                className="btn-lux-gold flex h-9 w-11 items-center justify-center rounded-xl"
                title={isOwnerLoggedIn ? 'Uang Keluar (Non-Laba)' : 'Uang Keluar'}
              >
                <Minus className="h-4 w-4" />
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftDay(-1)}
                className="btn-lux-soft flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-[104px] text-center text-sm font-semibold">
                {formatDayReadable(selectedDayTs)}
              </span>
              <button
                type="button"
                onClick={() => shiftDay(1)}
                className="btn-lux-soft flex h-9 w-9 items-center justify-center rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCashModalKind('expense_profit')}
              className="btn-lux-garnet flex h-9 w-11 items-center justify-center rounded-xl"
              title={isOwnerLoggedIn ? 'Catat Pengeluaran (Memotong Laba)' : 'Catat Pengeluaran'}
            >
              <Minus className="h-4 w-4" />
            </button>
          </div>

          {/* Daily Entries List */}
          <div className="surface-card mt-3 divide-y divide-[#EAECE8] dark:divide-[#223039] rounded-2xl">
            {dayEntries.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Belum ada mutasi kas pada tanggal ini.</p>
            ) : (
              dayEntries.map((c) => {
                const isIn = c.kind === 'in';
                return (
                  <div key={c.id} className="px-3.5 py-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="tabular-nums text-slate-500">
                        {new Date(c.createdAt).toLocaleDateString('id-ID')} {formatTimeOnly(c.createdAt)}
                      </span>
                      <span
                        className={`text-[11px] font-semibold ${
                          isIn
                            ? 'text-[#165B49] dark:text-[#4BB89A]'
                            : c.kind === 'out_non_profit'
                            ? 'text-[#B07D32]'
                            : 'text-[#B54B54]'
                        }`}
                      >
                        {c.method === 'tunai' ? 'Tunai' : 'Non Tunai'}
                      </span>
                      <span className={`font-display text-sm font-bold tabular-nums ${isIn ? 'text-[#17252B] dark:text-white' : 'text-[#B54B54]'}`}>
                        {isIn ? '' : '-'}
                        {formatNumber(c.amount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-[#17252B] dark:text-slate-200">{c.title}</p>
                  </div>
                );
              })
            )}
          </div>

          {/* Summary Card 1: Uang Masuk / Uang Keluar / Neraca */}
          <div className="surface-card mt-3 rounded-2xl p-4 text-sm">
            <div className="grid grid-cols-3 font-semibold text-slate-500 text-xs pb-2">
              <span />
              <span className="text-right">Uang Masuk</span>
              <span className="text-right">Uang Keluar</span>
            </div>
            <div className="grid grid-cols-3 py-1 tabular-nums">
              <span>Tunai</span>
              <span className="text-right font-semibold">{formatNumber(inTunai)}</span>
              <span className="text-right font-semibold text-[#B54B54]">{formatNumber(outTunai)}</span>
            </div>
            <div className="grid grid-cols-3 py-1 tabular-nums border-b border-[#EAECE8] dark:border-[#223039] pb-2">
              <span>Non Tunai</span>
              <span className="text-right font-semibold">{formatNumber(inNonTunai)}</span>
              <span className="text-right font-semibold text-[#B54B54]">{formatNumber(outNonTunai)}</span>
            </div>
            <div className="grid grid-cols-3 pt-2 tabular-nums font-bold">
              <span />
              <span className="text-right">{formatNumber(totalIn)}</span>
              <span className="text-right text-[#B54B54]">{formatNumber(totalOut)}</span>
            </div>
            <div className="grid grid-cols-3 pt-1.5 tabular-nums font-bold">
              <span>Neraca</span>
              <span className="font-display text-right text-[#165B49] dark:text-[#4BB89A]">{formatNumber(neraca)}</span>
              <span />
            </div>
          </div>

          {/* Summary Card 2: Laba / Pengeluaran / Laba bersih (Hanya tampil jika pemilik login) */}
          {isOwnerLoggedIn && (
            <div className="surface-card mt-3 rounded-2xl p-4 text-sm space-y-1.5 tabular-nums">
              <div className="flex justify-between">
                <span>Laba</span>
                <span className="font-semibold">{formatNumber(grossProfitDay)}</span>
              </div>
              <div className="flex justify-between text-[#B54B54]">
                <span>Pengeluaran (laba)</span>
                <span className="font-semibold">{formatNumber(expenseProfitDay)}</span>
              </div>
              <div className="flex justify-between border-t border-[#EAECE8] dark:border-[#223039] pt-1.5 font-bold text-base">
                <span>Laba bersih</span>
                <span className="font-display text-[#165B49] dark:text-[#4BB89A]">{formatNumber(netProfitDay)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Add Cashflow Modal */}
        {cashModalKind && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">
                {cashModalKind === 'in'
                  ? 'Tambah Uang Masuk'
                  : cashModalKind === 'out_non_profit'
                  ? (isOwnerLoggedIn ? 'Uang Keluar (Non-Laba)' : 'Uang Keluar')
                  : (isOwnerLoggedIn ? 'Catat Pengeluaran (Laba)' : 'Catat Pengeluaran')}
              </h3>
              <input
                type="text"
                value={cashTitle}
                onChange={(e) => setCashTitle(e.target.value)}
                placeholder="Keterangan (misal: Beli plastik / Setor bank)"
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <NumericInput
                min={0}
                value={cashAmount}
                onValueChange={setCashAmount}
                placeholder="Nominal (Rp)"
                className="mt-2.5 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-base font-bold tabular-nums outline-none focus:border-[#165B49]"
              />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['tunai', 'non_tunai'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCashMethod(m)}
                    className={`rounded-xl py-2 text-xs font-bold transition ${
                      cashMethod === m
                        ? 'btn-lux-primary'
                        : 'btn-lux-soft'
                    }`}
                  >
                    {m === 'tunai' ? 'Tunai' : 'Non Tunai'}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setCashModalKind(null)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button type="button" onClick={submitCashModal} className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 3. PENGELUARAN
  // =========================================================
  if (screen === 'expenses') {
    const expenses = data.cashflows.filter((c) => c.kind === 'expense_profit');
    const totalExp = expenses.reduce((a, b) => a + b.amount, 0);

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar title="Pengeluaran" mode="menu" onLeftClick={onOpenDrawer} />
        <div className="bg-gradient-to-r from-[#132622] to-[#1A332E] px-4 py-3.5 text-white flex justify-between items-center border-b border-white/10">
          <span className="text-sm text-emerald-100/80">Total Pengeluaran Tercatat</span>
          <span className="font-display text-lg font-bold tabular-nums text-rose-300">
            {formatMoney(totalExp, data.currencySymbol)}
          </span>
        </div>

        <div className="mx-auto w-full max-w-4xl divide-y divide-[#EAECE8] dark:divide-[#223039] bg-white dark:bg-[#151E24]">
          {expenses.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Belum ada pengeluaran operasional.</p>
          ) : (
            expenses.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-[#17252B] dark:text-white">{ex.title}</p>
                  <p className="text-xs text-slate-500">
                    {formatDayReadable(ex.createdAt)} · {ex.method === 'tunai' ? 'Tunai' : 'Non Tunai'}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-display text-sm font-bold tabular-nums text-[#B54B54]">
                    -{formatMoney(ex.amount, data.currencySymbol)}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateData((p) => ({ ...p, cashflows: p.cashflows.filter((c) => c.id !== ex.id) }))
                    }
                    className="text-slate-400 hover:text-[#B54B54]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button
          type="button"
          onClick={() => setCashModalKind('expense_profit')}
          className="btn-lux-garnet fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full"
          aria-label="Tambah Pengeluaran"
        >
          <Plus className="h-7 w-7" />
        </button>

        {cashModalKind === 'expense_profit' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Tambah Pengeluaran</h3>
              <input
                type="text"
                value={cashTitle}
                onChange={(e) => setCashTitle(e.target.value)}
                placeholder="Nama biaya (listrik, plastik, gaji...)"
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <NumericInput
                min={0}
                value={cashAmount}
                onValueChange={setCashAmount}
                placeholder="Nominal (Rp)"
                className="mt-2.5 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-base font-bold tabular-nums outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setCashModalKind(null)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const amt = Math.max(0, cashAmount);
                    if (amt <= 0) return;
                    onUpdateData((prev) => ({
                      ...prev,
                      cashflows: [
                        {
                          id: `cf-exp-${Date.now()}`,
                          createdAt: Date.now(),
                          kind: 'expense_profit',
                          method: 'tunai',
                          amount: amt,
                          title: cashTitle.trim() || 'Pengeluaran Operasional',
                          note: '',
                        },
                        ...prev.cashflows,
                      ],
                    }));
                    setCashModalKind(null);
                    setCashTitle('');
                    setCashAmount(0);
                    notify('Pengeluaran dicatat');
                  }}
                  className="btn-lux-garnet flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 4. LAPORAN (Reports)
  // =========================================================
  const totalSales = scopedTx.reduce((a, t) => a + t.total, 0);
  const grossProfit = scopedTx.reduce((a, t) => a + t.totalProfit, 0);
  const totalExpenses = scopedExpenses.reduce((a, c) => a + c.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const totalReceivable = scopedTx
    .filter((t) => t.paymentStatus !== 'lunas')
    .reduce((a, t) => a + Math.max(0, t.total - t.paidAmount), 0);

  const dailyReportTotal = dailyReportTx.reduce((acc, t) => acc + t.total, 0);
  const [ry, rm, rd] = reportDateKey.split('-').map(Number);
  const reportDateLabel = formatDayReadable(
    new Date(ry || now.getFullYear(), (rm || now.getMonth() + 1) - 1, rd || now.getDate()).getTime()
  );

  const handlePrintDailyReport = async () => {
    if (busyReportAction) return;
    setBusyReportAction('print');
    try {
      const res = await printDailyReportThermal(
        reportDateLabel,
        dailyReportTx,
        data.store,
        data.receiptSettings,
        data.printerSettings,
        data.currencySymbol
      );
      notify(res === 'native' ? `Laporan ${reportDateLabel} dicetak!` : 'Dialog cetak laporan dibuka');
    } catch (err) {
      notify((err as Error).message || 'Gagal mencetak laporan harian');
    } finally {
      setBusyReportAction(null);
    }
  };

  const handleShareDailyReportWa = async () => {
    if (busyReportAction) return;
    setBusyReportAction('wa');
    try {
      const canvas = renderDailyReportToCanvas(
        reportDateLabel,
        dailyReportTx,
        data.store,
        data.receiptSettings,
        data.currencySymbol
      );
      const fileName = `Laporan_Harian_${reportDateKey}.png`;
      const res = await shareCanvasPng(
        fileName,
        canvas,
        `Laporan Harian ${data.store.name}`,
        `Laporan Penjualan ${reportDateLabel} (${dailyReportTx.length} transaksi)`
      );
      if (res === 'saved_fallback') {
        notify(`Gambar laporan disimpan ke Download/SimpelKasir/${fileName}`);
      } else {
        notify('Pilih WhatsApp untuk mengirim gambar laporan');
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        notify((err as Error).message || 'Gagal membagikan gambar laporan');
      }
    } finally {
      setBusyReportAction(null);
    }
  };

  const handleSaveDailyReportPng = async () => {
    if (busyReportAction) return;
    setBusyReportAction('save');
    try {
      const canvas = renderDailyReportToCanvas(
        reportDateLabel,
        dailyReportTx,
        data.store,
        data.receiptSettings,
        data.currencySymbol
      );
      const fileName = `Laporan_Harian_${reportDateKey}.png`;
      const res = await saveCanvasPngToDevice(fileName, canvas, 'SimpelKasir');
      notify(res.isNative ? `Gambar tersimpan di ${res.savedPath}` : `Gambar laporan diunduh: ${fileName}`);
    } catch (err) {
      notify((err as Error).message || 'Gagal menyimpan gambar laporan');
    } finally {
      setBusyReportAction(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-10">
      <TopBar title="Laporan" mode="menu" onLeftClick={onOpenDrawer} />
      <div className="mx-auto w-full max-w-4xl p-4 space-y-4">
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#E6EAE5] dark:bg-[#1A242B] p-1">
          {(
            [
              { id: 'today', label: 'Hari Ini' },
              { id: 'month', label: 'Bulan Ini' },
              { id: 'all', label: 'Semua' },
            ] as const
          ).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReportRange(r.id)}
              className={`rounded-xl py-2 text-xs font-bold transition ${
                reportRange === r.id ? 'btn-lux-primary' : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="surface-card rounded-2xl p-4">
            <span className="text-xs text-slate-500">Total Omzet</span>
            <p className="font-display mt-1 text-lg font-bold tabular-nums text-[#17252B] dark:text-white">
              {formatMoney(totalSales, data.currencySymbol)}
            </p>
            <span className="text-[11px] text-slate-400">{scopedTx.length} transaksi</span>
          </div>
          {isOwnerLoggedIn && (
            <div className="surface-card rounded-2xl p-4">
              <span className="text-xs text-slate-500">Laba Bersih</span>
              <p className="font-display mt-1 text-lg font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                {formatMoney(netProfit, data.currencySymbol)}
              </p>
              <span className="text-[11px] text-slate-400">
                Kotor {formatMoney(grossProfit, data.currencySymbol)}
              </span>
            </div>
          )}
          <div className="surface-card rounded-2xl p-4">
            <span className="text-xs text-slate-500">Pengeluaran</span>
            <p className="font-display mt-1 text-lg font-bold tabular-nums text-[#B54B54]">
              {formatMoney(totalExpenses, data.currencySymbol)}
            </p>
          </div>
          <div className="surface-card rounded-2xl p-4">
            <span className="text-xs text-slate-500">Piutang Belum Lunas</span>
            <p className="font-display mt-1 text-lg font-bold tabular-nums text-[#B07D32]">
              {formatMoney(totalReceivable, data.currencySymbol)}
            </p>
          </div>
        </div>

        {/* Cetak & Softfile Laporan Harian (Pilih Tanggal) */}
        <div className="surface-card rounded-2xl p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-display text-sm font-bold text-[#17252B] dark:text-white">
                Cetak Laporan Harian
              </h3>
              <p className="text-[11px] text-slate-500">
                Pilih tanggal untuk mencetak atau menyimpan laporan nomor transaksi &amp; total harga.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setReportDateKey(todayKey)}
              className="btn-lux-soft rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-[#165B49] dark:text-[#4BB89A]"
            >
              Hari Ini
            </button>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-slate-500 shrink-0">Tanggal:</label>
            <input
              type="date"
              value={reportDateKey}
              onChange={(e) => {
                if (e.target.value) setReportDateKey(e.target.value);
              }}
              className="flex-1 rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-xs font-bold tabular-nums outline-none focus:border-[#165B49]"
            />
          </div>

          {/* Pratinjau Struk/Softfile Harian */}
          <div className="rounded-xl border border-[#DCE1DC] dark:border-[#2A3944] bg-[#F7F8F5] dark:bg-[#1B262E] p-3 text-xs space-y-2">
            <div className="flex items-center justify-between border-b border-dashed border-slate-300 dark:border-slate-600 pb-2 font-bold">
              <span>{reportDateLabel}</span>
              <span className="text-[#165B49] dark:text-[#4BB89A]">
                {dailyReportTx.length} transaksi
              </span>
            </div>
            {dailyReportTx.length === 0 ? (
              <p className="py-3 text-center text-slate-400">
                Belum ada transaksi pada tanggal {reportDateLabel}.
              </p>
            ) : (
              <div className="max-h-44 overflow-y-auto space-y-1 pr-1 tabular-nums">
                <div className="flex justify-between text-[11px] font-semibold text-slate-500 pb-0.5">
                  <span>No. Transaksi</span>
                  <span>Total Harga</span>
                </div>
                {dailyReportTx.map((tx) => (
                  <div key={tx.id} className="flex justify-between font-medium">
                    <span>#{tx.receiptNo}</span>
                    <span>{formatMoney(tx.total, data.currencySymbol)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between border-t border-dashed border-slate-300 dark:border-slate-600 pt-2 font-bold text-[#165B49] dark:text-[#4BB89A] tabular-nums">
              <span>Total Penjualan</span>
              <span>{formatMoney(dailyReportTotal, data.currencySymbol)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={Boolean(busyReportAction)}
              onClick={handlePrintDailyReport}
              className="btn-lux-primary flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold disabled:opacity-60"
            >
              <Printer className="h-4 w-4 shrink-0" />
              <span>{busyReportAction === 'print' ? 'Mencetak...' : 'Cetak Laporan'}</span>
            </button>
            <button
              type="button"
              disabled={Boolean(busyReportAction)}
              onClick={handleShareDailyReportWa}
              className="btn-lux-gold flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold disabled:opacity-60"
            >
              <Share2 className="h-4 w-4 shrink-0" />
              <span>{busyReportAction === 'wa' ? 'Menyiapkan...' : 'Kirim WA (Gambar)'}</span>
            </button>
            <button
              type="button"
              disabled={Boolean(busyReportAction)}
              onClick={handleSaveDailyReportPng}
              className="btn-lux-obsidian flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold disabled:opacity-60"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>{busyReportAction === 'save' ? 'Menyimpan...' : 'Simpan Gambar'}</span>
            </button>
          </div>
        </div>

        {/* Top Products */}
        <div className="surface-card rounded-2xl p-4">
          <h3 className="font-display text-sm font-bold text-[#17252B] dark:text-white">Produk Terlaris</h3>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Belum ada penjualan pada periode ini.</p>
          ) : (
            <div className="mt-3 divide-y divide-[#EAECE8] dark:divide-[#223039]">
              {topProducts.map((tp, idx) => (
                <div key={tp.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">
                    {idx + 1}. {tp.name}
                  </span>
                  <div className="text-right tabular-nums">
                    <span className="font-bold text-[#165B49] dark:text-[#4BB89A]">{tp.qty} terjual</span>
                    <p className="text-xs text-slate-400">{formatMoney(tp.revenue, data.currencySymbol)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
