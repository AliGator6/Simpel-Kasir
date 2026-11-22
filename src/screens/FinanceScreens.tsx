import React, { useMemo, useState } from 'react';
import { Search, Settings, ShoppingCart, Calendar, ChevronLeft, ChevronRight, Banknote, CreditCard, Plus, Minus, Trash2, Printer, CheckCircle2 } from 'lucide-react';
import { AppData, CashflowKind, ProgressStatus, ScreenId, Transaction } from '../types';
import { TopBar } from '../components/TopBar';
import { formatDayHeader, formatDayReadable, formatMoney, formatNumber, formatTimeOnly, toDateKey } from '../utils/storage';

interface FinanceProps {
  screen: 'transactions' | 'cashflow' | 'expenses' | 'reports';
  data: AppData;
  onOpenDrawer: () => void;
  onNavigate: (s: ScreenId) => void;
  onOpenReceipt: (tx: Transaction) => void;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  notify: (msg: string) => void;
}

export const FinanceScreens: React.FC<FinanceProps> = ({
  screen, data, onOpenDrawer, onNavigate, onOpenReceipt, onUpdateData, notify,
}) => {
  const [txSearch, setTxSearch] = useState('');
  const [showTxSearch, setShowTxSearch] = useState(false);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [settleAmount, setSettleAmount] = useState('0');
  const [selectedDayTs, setSelectedDayTs] = useState<number>(Date.now());
  const [cashModalKind, setCashModalKind] = useState<CashflowKind | null>(null);
  const [cashTitle, setCashTitle] = useState('');
  const [cashAmount, setCashAmount] = useState('');
  const [cashMethod, setCashMethod] = useState<'tunai' | 'non_tunai'>('tunai');
  const [reportRange, setReportRange] = useState<'today' | 'month' | 'all'>('today');

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

  if (screen === 'transactions') {
    const filtered = data.transactions.filter((t) => {
      const q = txSearch.trim().toLowerCase();
      if (!q) return true;
      return String(t.receiptNo).includes(q) || t.customerName.toLowerCase().includes(q) || t.items.some((i) => i.name.toLowerCase().includes(q));
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
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-24">
        <TopBar
          title="Transaksi"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <>
              <button type="button" onClick={() => setShowTxSearch((s) => !s)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Cari transaksi">
                <Search className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onNavigate('settings_receipt')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Pengaturan transaksi">
                <Settings className="h-5 w-5" />
              </button>
            </>
          }
        />

        {showTxSearch && (
          <div className="bg-white dark:bg-[#1A222C] px-4 py-2.5 border-b border-slate-200 dark:border-slate-800">
            <input type="text" autoFocus value={txSearch} onChange={(e) => setTxSearch(e.target.value)} placeholder="Cari nomor struk (#), nama pelanggan, atau produk..." className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm outline-none" />
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl flex-1">
          {grouped.size === 0 ? (
            <div className="py-20 text-center text-sm text-slate-500">Belum ada transaksi tercatat.</div>
          ) : (
            Array.from(grouped.entries()).map(([key, grp]) => (
              <div key={key}>
                <div className="flex items-center justify-between bg-[#E9ECF0] dark:bg-[#1F2937] px-4 py-2.5 text-sm font-bold">
                  <span className="text-slate-800 dark:text-slate-200">{grp.dayLabel}</span>
                  <span className="tabular-nums text-[#1E2F42] dark:text-sky-300">{formatMoney(grp.total, data.currencySymbol)}</span>
                  <span className="tabular-nums text-slate-800 dark:text-slate-200">{grp.items.length}</span>
                </div>
                <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#1A222C]">
                  {grp.items.map((tx) => {
                    const summary = tx.items.map((i) => `${i.name}:${i.qty}`).join(' ');
                    const statusLabel = tx.paymentStatus === 'lunas' ? 'Lunas' : tx.paymentStatus === 'kurang' ? `Kurang ${formatMoney(Math.max(0, tx.total - tx.paidAmount), data.currencySymbol)}` : 'Belum Dibayar';
                    const statusColor = tx.paymentStatus === 'lunas' ? 'text-[#2C6E58] dark:text-emerald-400' : tx.paymentStatus === 'kurang' ? 'text-[#B86B2B] dark:text-amber-400' : 'text-[#A93F4B] dark:text-rose-400';

                    return (
                      <button key={tx.id} type="button" onClick={() => { setSelectedTx(tx); setSettleAmount(String(Math.max(0, tx.total - tx.paidAmount))); }} className="w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-bold tabular-nums text-[#1E2F42] dark:text-sky-300">{formatMoney(tx.total, data.currencySymbol)}</span>
                          <span className="tabular-nums text-slate-600 dark:text-slate-400">{formatTimeOnly(tx.createdAt)}</span>
                          <span className="font-semibold tabular-nums text-slate-700 dark:text-slate-300">#{tx.receiptNo}</span>
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

        <button type="button" onClick={() => onNavigate('pos')} className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#B55340] text-white shadow-lg" aria-label="Transaksi Baru">
          <ShoppingCart className="h-6 w-6" />
        </button>

        {selectedTx && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold">Transaksi #{selectedTx.receiptNo}</h3>
                <span className="text-xs text-slate-500">{selectedTx.customerName}</span>
              </div>
              <div className="mt-3 max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {selectedTx.items.map((it) => (
                  <div key={it.productId} className="flex justify-between py-1.5">
                    <span>{it.name} x{it.qty}</span>
                    <span className="tabular-nums font-semibold">{formatMoney(it.unitPrice * it.qty - it.discount, data.currencySymbol)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-200 dark:border-slate-700 pt-2 text-sm font-bold">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(selectedTx.total, data.currencySymbol)}</span>
              </div>

              {data.businessFlags.useProgress && (
                <div className="mt-3">
                  <label className="text-xs font-semibold text-slate-500">Status Progres</label>
                  <select
                    value={selectedTx.progressStatus}
                    onChange={(e) => {
                      const nextSt = e.target.value as ProgressStatus;
                      onUpdateData((prev) => ({ ...prev, transactions: prev.transactions.map((t) => (t.id === selectedTx.id ? { ...t, progressStatus: nextSt } : t)) }));
                      setSelectedTx({ ...selectedTx, progressStatus: nextSt });
                      notify('Progres diperbarui');
                    }}
                    className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161D] px-3 py-2 text-sm"
                  >
                    <option value="antri">Antri</option>
                    <option value="proses">Proses</option>
                    <option value="selesai">Selesai</option>
                    <option value="diambil">Diambil</option>
                  </select>
                </div>
              )}

              {selectedTx.paymentStatus !== 'lunas' && (
                <div className="mt-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
                  <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Bayar Cicilan / Pelunasan (Sisa: {formatMoney(selectedTx.total - selectedTx.paidAmount, data.currencySymbol)})
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input type="number" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} className="flex-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-[#11161D] px-2.5 py-1.5 text-sm font-bold tabular-nums" />
                    <button
                      type="button"
                      onClick={() => {
                        const add = Math.max(0, Number(settleAmount) || 0);
                        if (add <= 0) return;
                        onUpdateData((prev) => ({
                          ...prev,
                          transactions: prev.transactions.map((t) => {
                            if (t.id !== selectedTx.id) return t;
                            const nextPaid = t.paidAmount + add;
                            return { ...t, paidAmount: nextPaid, changeAmount: nextPaid - t.total, paidAt: Date.now(), paymentStatus: nextPaid >= t.total ? 'lunas' : 'kurang' };
                          }),
                          cashflows: [{ id: `cf-settle-${Date.now()}`, createdAt: Date.now(), kind: 'in', method: 'tunai', amount: Math.min(add, selectedTx.total - selectedTx.paidAmount), title: `Pelunasan #${selectedTx.receiptNo}`, note: selectedTx.customerName, transactionId: selectedTx.id }, ...prev.cashflows],
                        }));
                        setSelectedTx(null);
                        notify('Pembayaran piutang dicatat');
                      }}
                      className="flex items-center gap-1 rounded-lg bg-[#2C6E58] px-3 py-1.5 text-xs font-bold text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Bayar
                    </button>
                  </div>
                </div>
              )}

              <div className="mt-4 grid grid-cols-3 gap-2">
                <button type="button" onClick={() => { const target = selectedTx; setSelectedTx(null); onOpenReceipt(target); }} className="flex items-center justify-center gap-1 rounded-xl bg-[#1E2F42] py-2.5 text-xs font-bold text-white">
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
                  className="flex items-center justify-center gap-1 rounded-xl bg-[#A93F4B] py-2.5 text-xs font-bold text-white"
                >
                  <Trash2 className="h-4 w-4" /> Retur
                </button>
                <button type="button" onClick={() => setSelectedTx(null)} className="rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-xs font-bold">Tutup</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'cashflow') {
    const cumTunai = data.cashflows.filter((c) => c.method === 'tunai').reduce((acc, c) => (c.kind === 'in' ? acc + c.amount : acc - c.amount), 0);
    const cumNonTunai = data.cashflows.filter((c) => c.method === 'non_tunai').reduce((acc, c) => (c.kind === 'in' ? acc + c.amount : acc - c.amount), 0);
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
      const amt = Math.max(0, Number(cashAmount) || 0);
      if (!cashModalKind || amt <= 0) return;
      const defaultTitle = cashModalKind === 'in' ? 'Uang Masuk' : cashModalKind === 'out_non_profit' ? 'Uang Keluar' : 'Pengeluaran';
      onUpdateData((prev) => ({
        ...prev,
        cashflows: [{ id: `cf-${Date.now()}`, createdAt: selectedDayTs, kind: cashModalKind, method: cashMethod, amount: amt, title: cashTitle.trim() || defaultTitle, note: '' }, ...prev.cashflows],
      }));
      setCashModalKind(null);
      setCashTitle('');
      setCashAmount('');
      notify('Arus kas dicatat');
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-8">
        <TopBar
          title="Arus Kas"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <>
              <button type="button" onClick={() => setSelectedDayTs(Date.now())} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" title="Hari Ini">
                <Calendar className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onNavigate('settings')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10">
                <Settings className="h-5 w-5" />
              </button>
            </>
          }
        />

        <div className="bg-[#232B35] px-4 py-3 text-white">
          <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4">
            <div>
              <p className="flex items-center gap-1.5 text-xs text-slate-300"><Banknote className="h-4 w-4" /> Tunai</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(cumTunai, data.currencySymbol)}</p>
            </div>
            <div className="text-right">
              <p className="inline-flex items-center gap-1.5 text-xs text-slate-300"><CreditCard className="h-4 w-4" /> Non Tunai</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatMoney(cumNonTunai, data.currencySymbol)}</p>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full max-w-4xl px-3 pt-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setCashModalKind('in')} className="flex h-9 w-11 items-center justify-center rounded-lg bg-[#1E2F42] text-white active:scale-95 transition" title="Tambah Uang Masuk">
                <Plus className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setCashModalKind('out_non_profit')} className="flex h-9 w-11 items-center justify-center rounded-lg bg-[#B86B2B] text-white active:scale-95 transition" title="Uang Keluar (Non-Laba)">
                <Minus className="h-4 w-4" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => shiftDay(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
              <span className="min-w-[104px] text-center text-sm font-semibold">{formatDayReadable(selectedDayTs)}</span>
              <button type="button" onClick={() => shiftDay(1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
            </div>
            <button type="button" onClick={() => setCashModalKind('expense_profit')} className="flex h-9 w-11 items-center justify-center rounded-lg bg-[#A93F4B] text-white active:scale-95 transition" title="Catat Pengeluaran (Memotong Laba)">
              <Minus className="h-4 w-4" />
            </button>
          </div>

          <div className="mt-3 divide-y divide-slate-200 dark:divide-slate-800 rounded-xl bg-white dark:bg-[#1A222C] border border-slate-200 dark:border-slate-800">
            {dayEntries.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-400">Belum ada mutasi kas pada tanggal ini.</p>
            ) : (
              dayEntries.map((c) => {
                const isIn = c.kind === 'in';
                return (
                  <div key={c.id} className="px-3.5 py-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="tabular-nums text-slate-500">{new Date(c.createdAt).toLocaleDateString('id-ID')} {formatTimeOnly(c.createdAt)}</span>
                      <span className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${isIn ? 'border-[#2C6E58] text-[#2C6E58] dark:text-emerald-400' : c.kind === 'out_non_profit' ? 'border-[#B86B2B] text-[#B86B2B]' : 'border-[#A93F4B] text-[#A93F4B]'}`}>
                        {c.method === 'tunai' ? 'Tunai' : 'Non Tunai'}
                      </span>
                      <span className={`text-sm font-bold tabular-nums ${isIn ? 'text-slate-900 dark:text-white' : 'text-[#A93F4B]'}`}>
                        {isIn ? '' : '-'}{formatNumber(c.amount)}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{c.title}</p>
                  </div>
                );
              })
            )}
          </div>

          <div className="mt-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1A222C] p-3.5 text-sm">
            <div className="grid grid-cols-3 font-semibold text-slate-500 text-xs pb-2"><span /><span className="text-right">Uang Masuk</span><span className="text-right">Uang Keluar</span></div>
            <div className="grid grid-cols-3 py-1 tabular-nums"><span>Tunai</span><span className="text-right font-semibold">{formatNumber(inTunai)}</span><span className="text-right font-semibold text-[#A93F4B]">{formatNumber(outTunai)}</span></div>
            <div className="grid grid-cols-3 py-1 tabular-nums border-b border-slate-200 dark:border-slate-700 pb-2"><span>Non Tunai</span><span className="text-right font-semibold">{formatNumber(inNonTunai)}</span><span className="text-right font-semibold text-[#A93F4B]">{formatNumber(outNonTunai)}</span></div>
            <div className="grid grid-cols-3 pt-2 tabular-nums font-bold"><span /><span className="text-right">{formatNumber(totalIn)}</span><span className="text-right text-[#A93F4B]">{formatNumber(totalOut)}</span></div>
            <div className="grid grid-cols-3 pt-1.5 tabular-nums font-bold"><span>Neraca</span><span className="text-right text-[#1E2F42] dark:text-sky-300">{formatNumber(neraca)}</span><span /></div>
          </div>

          <div className="mt-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1A222C] p-3.5 text-sm space-y-1.5 tabular-nums">
            <div className="flex justify-between"><span>Laba</span><span className="font-semibold">{formatNumber(grossProfitDay)}</span></div>
            <div className="flex justify-between text-[#A93F4B]"><span>Pengeluaran (laba)</span><span className="font-semibold">{formatNumber(expenseProfitDay)}</span></div>
            <div className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-1.5 font-bold text-base"><span>Laba bersih</span><span className="text-[#2C6E58] dark:text-emerald-400">{formatNumber(netProfitDay)}</span></div>
          </div>
        </div>

        {cashModalKind && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">{cashModalKind === 'in' ? 'Tambah Uang Masuk' : cashModalKind === 'out_non_profit' ? 'Uang Keluar (Non-Laba)' : 'Catat Pengeluaran (Laba)'}</h3>
              <input type="text" value={cashTitle} onChange={(e) => setCashTitle(e.target.value)} placeholder="Keterangan (misal: Beli plastik / Setor bank)" className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Nominal (Rp)" className="mt-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-base font-bold tabular-nums" />
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(['tunai', 'non_tunai'] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setCashMethod(m)} className={`rounded-lg py-2 text-xs font-bold border ${cashMethod === m ? 'border-[#1E2F42] bg-[#1E2F42] text-white' : 'border-slate-300 dark:border-slate-700'}`}>
                    {m === 'tunai' ? 'Tunai' : 'Non Tunai'}
                  </button>
                ))}
              </div>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setCashModalKind(null)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-sm font-semibold">Batal</button>
                <button type="button" onClick={submitCashModal} className="flex-1 rounded-xl bg-[#1E2F42] py-2 text-sm font-semibold text-white">Simpan</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'expenses') {
    const expenses = data.cashflows.filter((c) => c.kind === 'expense_profit');
    const totalExp = expenses.reduce((a, b) => a + b.amount, 0);

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-24">
        <TopBar title="Pengeluaran" mode="menu" onLeftClick={onOpenDrawer} />
        <div className="bg-[#232B35] px-4 py-3 text-white flex justify-between items-center">
          <span className="text-sm text-slate-300">Total Pengeluaran Tercatat</span>
          <span className="text-lg font-bold tabular-nums text-rose-300">{formatMoney(totalExp, data.currencySymbol)}</span>
        </div>

        <div className="mx-auto w-full max-w-4xl divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#1A222C]">
          {expenses.length === 0 ? (
            <p className="py-16 text-center text-sm text-slate-500">Belum ada pengeluaran operasional.</p>
          ) : (
            expenses.map((ex) => (
              <div key={ex.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{ex.title}</p>
                  <p className="text-xs text-slate-500">{formatDayReadable(ex.createdAt)} · {ex.method === 'tunai' ? 'Tunai' : 'Non Tunai'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-[#A93F4B]">-{formatMoney(ex.amount, data.currencySymbol)}</span>
                  <button type="button" onClick={() => onUpdateData((p) => ({ ...p, cashflows: p.cashflows.filter((c) => c.id !== ex.id) }))} className="text-slate-400 hover:text-[#A93F4B]">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <button type="button" onClick={() => setCashModalKind('expense_profit')} className="fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#B55340] text-white shadow-lg" aria-label="Tambah Pengeluaran">
          <Plus className="h-7 w-7" />
        </button>

        {cashModalKind === 'expense_profit' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Tambah Pengeluaran</h3>
              <input type="text" value={cashTitle} onChange={(e) => setCashTitle(e.target.value)} placeholder="Nama biaya (listrik, plastik, gaji...)" className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
              <input type="number" value={cashAmount} onChange={(e) => setCashAmount(e.target.value)} placeholder="Nominal (Rp)" className="mt-2.5 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-base font-bold tabular-nums" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setCashModalKind(null)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    const amt = Math.max(0, Number(cashAmount) || 0);
                    if (amt <= 0) return;
                    onUpdateData((prev) => ({
                      ...prev,
                      cashflows: [{ id: `cf-exp-${Date.now()}`, createdAt: Date.now(), kind: 'expense_profit', method: 'tunai', amount: amt, title: cashTitle.trim() || 'Pengeluaran Operasional', note: '' }, ...prev.cashflows],
                    }));
                    setCashModalKind(null);
                    setCashTitle('');
                    setCashAmount('');
                    notify('Pengeluaran dicatat');
                  }}
                  className="flex-1 rounded-xl bg-[#A93F4B] py-2 text-sm font-semibold text-white"
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

  const totalSales = scopedTx.reduce((a, t) => a + t.total, 0);
  const grossProfit = scopedTx.reduce((a, t) => a + t.totalProfit, 0);
  const totalExpenses = scopedExpenses.reduce((a, c) => a + c.amount, 0);
  const netProfit = grossProfit - totalExpenses;
  const totalReceivable = scopedTx.filter((t) => t.paymentStatus !== 'lunas').reduce((a, t) => a + Math.max(0, t.total - t.paidAmount), 0);

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-10">
      <TopBar title="Laporan" mode="menu" onLeftClick={onOpenDrawer} />
      <div className="mx-auto w-full max-w-4xl p-4 space-y-4">
        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
          {([{ id: 'today', label: 'Hari Ini' }, { id: 'month', label: 'Bulan Ini' }, { id: 'all', label: 'Semua' }] as const).map((r) => (
            <button key={r.id} type="button" onClick={() => setReportRange(r.id)} className={`rounded-lg py-2 text-xs font-bold transition ${reportRange === r.id ? 'bg-[#1E2F42] text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {r.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] p-4">
            <span className="text-xs text-slate-500">Total Omzet</span>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#1E2F42] dark:text-sky-300">{formatMoney(totalSales, data.currencySymbol)}</p>
            <span className="text-[11px] text-slate-400">{scopedTx.length} transaksi</span>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] p-4">
            <span className="text-xs text-slate-500">Laba Bersih</span>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#2C6E58] dark:text-emerald-400">{formatMoney(netProfit, data.currencySymbol)}</p>
            <span className="text-[11px] text-slate-400">Kotor {formatMoney(grossProfit, data.currencySymbol)}</span>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] p-4">
            <span className="text-xs text-slate-500">Pengeluaran</span>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#A93F4B]">{formatMoney(totalExpenses, data.currencySymbol)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] p-4">
            <span className="text-xs text-slate-500">Piutang Belum Lunas</span>
            <p className="mt-1 text-lg font-bold tabular-nums text-[#B86B2B]">{formatMoney(totalReceivable, data.currencySymbol)}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] p-4">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Produk Terlaris</h3>
          {topProducts.length === 0 ? (
            <p className="mt-3 text-xs text-slate-400">Belum ada penjualan pada periode ini.</p>
          ) : (
            <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
              {topProducts.map((tp, idx) => (
                <div key={tp.name} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium">{idx + 1}. {tp.name}</span>
                  <div className="text-right tabular-nums">
                    <span className="font-bold text-[#1E2F42] dark:text-sky-300">{tp.qty} terjual</span>
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
