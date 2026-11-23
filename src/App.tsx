import React, { useEffect, useRef, useState } from 'react';
import { ActiveOrderDraft, AppData, Product, SavedQuickCart, ScreenId, Transaction } from './types';
import {
  EMPTY_DRAFT,
  clearActiveDraft,
  loadActiveDraft,
  loadAppData,
  saveActiveDraft,
  saveAppData,
} from './utils/storage';
import { Drawer } from './components/Drawer';
import { HomeScreen } from './screens/HomeScreen';
import { PosFlowScreens } from './screens/PosScreens';
import { InventoryScreens } from './screens/InventoryScreens';
import { FinanceScreens } from './screens/FinanceScreens';
import { SettingsScreens } from './screens/SettingsScreens';
import { SyncScreen } from './screens/SyncScreen';

declare global {
  interface Window {
    __handleAndroidBack?: () => 'handled' | 'exit';
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan tampilan yang tidak terduga.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F6F4] dark:bg-[#0E1418] p-6 text-center text-[#17252B] dark:text-[#ECF1EF]">
          <div className="surface-card w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-3">
            <h2 className="font-display text-lg font-bold text-[#B54B54] dark:text-[#E07A82]">
              Tampilan Sedang Dipulihkan
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Data produk dan transaksi Anda tetap aman tersimpan. Ketuk tombol di bawah untuk melanjutkan.
            </p>
            {this.state.errorMessage && (
              <p className="rounded-xl bg-slate-100 dark:bg-[#1B262E] p-2.5 text-[11px] font-mono text-slate-500 break-words">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="btn-lux-primary w-full rounded-xl py-3 text-sm font-bold"
            >
              Pulihkan Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [screen, setScreen] = useState<ScreenId>('home');
  const [prevScreen, setPrevScreen] = useState<ScreenId>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<ActiveOrderDraft>(() => loadActiveDraft());
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const lastNavToHomeAtRef = useRef<number>(0);
  const homeExitTapAtRef = useRef<number>(0);

  useEffect(() => {
    saveAppData(data);
    const root = document.documentElement;
    if (data.darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [data]);

  useEffect(() => {
    saveActiveDraft(draft);
  }, [draft]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  const navigate = (next: ScreenId) => {
    if (next === 'home' && screen !== 'home') {
      lastNavToHomeAtRef.current = Date.now();
      homeExitTapAtRef.current = 0;
    }
    setPrevScreen(screen);
    setScreen(next);
  };

  // Android Taskbar / Hardware Back Button Guard & Hierarchical Navigation
  const stateRef = useRef({
    screen,
    prevScreen,
    drawerOpen,
    draft,
  });
  stateRef.current = { screen, prevScreen, drawerOpen, draft };

  useEffect(() => {
    window.__handleAndroidBack = (): 'handled' | 'exit' => {
      const { screen: cur, prevScreen: prev, drawerOpen: isDrawer, draft: curDraft } = stateRef.current;

      // 1. Close Drawer if open
      if (isDrawer) {
        setDrawerOpen(false);
        return 'handled';
      }

      // 2. Close any open Modal / Dropdown / Sheet first
      const backEvent = new CustomEvent('simpelkasir-back-request', { cancelable: true });
      window.dispatchEvent(backEvent);
      if (backEvent.defaultPrevented) {
        return 'handled';
      }

      // 3. Hierarchical back navigation (preserving cart draft at all times!)
      if (cur !== 'home') {
        let nextTarget: ScreenId = 'home';
        if (cur === 'payment') nextTarget = 'cart';
        else if (cur === 'cart') nextTarget = 'pos';
        else if (cur === 'pos') nextTarget = 'home';
        else if (cur === 'receipt') nextTarget = 'home';
        else if (cur === 'product_form') nextTarget = prev === 'pos' ? 'pos' : 'products';
        else if (cur.startsWith('settings_')) {
          nextTarget = prev === 'receipt' || prev === 'pos' || prev === 'products' ? prev : 'settings';
        } else {
          nextTarget = 'home';
        }

        if (nextTarget === 'home') {
          lastNavToHomeAtRef.current = Date.now();
          homeExitTapAtRef.current = 0;
        }
        setPrevScreen(cur);
        setScreen(nextTarget);
        return 'handled';
      }

      // 4. Already at Home: debounce rapid accidental double-tap from sub-screen
      const now = Date.now();
      if (now - lastNavToHomeAtRef.current < 700) {
        return 'handled';
      }

      const elapsedSinceFirstHomeTap = now - homeExitTapAtRef.current;
      // Require deliberate 2nd tap between 250ms and 2200ms (prevents 1-finger accidental bounce)
      if (elapsedSinceFirstHomeTap >= 250 && elapsedSinceFirstHomeTap <= 2200) {
        return 'exit';
      }

      homeExitTapAtRef.current = now;
      const itemCount = curDraft.items.reduce((sum, it) => sum + it.qty, 0);
      if (itemCount > 0) {
        notify(`Keranjang (${itemCount} item) tersimpan aman. Tekan kembali lagi untuk keluar`);
      } else {
        notify('Tekan kembali sekali lagi untuk keluar');
      }
      return 'handled';
    };

    return () => {
      delete window.__handleAndroidBack;
    };
  }, []);

  const activeUser = data.users.find((u) => u.id === data.activeUserId) || data.users[0];

  const handleSaveQuickCart = (name: string) => {
    const entry: SavedQuickCart = {
      id: `qc-${Date.now()}`,
      name,
      customerId: draft.customerId,
      customerName: draft.customerName,
      items: draft.items,
      discount: draft.discount,
      note: draft.note,
      shipping: draft.shipping,
      updatedAt: Date.now(),
    };
    setData((prev) => ({
      ...prev,
      quickCarts: [entry, ...prev.quickCarts],
    }));
    notify(`"${name}" disimpan ke Transaksi Cepat`);
  };

  const handleLoadQuickCart = (qc: SavedQuickCart) => {
    setDraft({
      items: qc.items.map((i) => ({ ...i })),
      customerId: qc.customerId,
      customerName: qc.customerName,
      discount: qc.discount,
      shipping: qc.shipping,
      note: qc.note,
      progressStatus: 'antri',
    });
    navigate('cart');
    notify(`Memuat "${qc.name}"`);
  };

  const handleCompleteTransaction = (
    paidAmount: number,
    paymentMethod: 'tunai' | 'non_tunai',
    isPayLater: boolean
  ): Transaction => {
    const subtotal = draft.items.reduce(
      (acc, it) => acc + Math.max(0, it.unitPrice * it.qty - it.discount),
      0
    );
    const tax = data.businessFlags.useTax
      ? Math.round(((subtotal - draft.discount) * data.businessFlags.taxPercent) / 100)
      : 0;
    const shipping = data.businessFlags.useShipping ? draft.shipping : 0;
    const total = Math.max(0, subtotal - draft.discount + tax + shipping);
    const totalCost = draft.items.reduce((acc, it) => acc + it.costPrice * it.qty, 0);
    const totalProfit = total - tax - shipping - totalCost;
    const actualPaid = isPayLater ? 0 : paidAmount;
    const changeAmount = actualPaid - total;
    const paymentStatus =
      actualPaid >= total ? 'lunas' : actualPaid > 0 ? 'kurang' : 'belum_dibayar';

    const cust = draft.customerId
      ? data.customers.find((c) => c.id === draft.customerId)
      : undefined;

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      receiptNo: data.nextReceiptNo,
      createdAt: Date.now(),
      paidAt: actualPaid > 0 ? Date.now() : null,
      customerId: draft.customerId,
      customerName: draft.customerName,
      customerPhone: cust?.phone,
      customerAddress: cust?.address,
      items: draft.items.map((i) => ({ ...i })),
      subtotal,
      discount: draft.discount,
      tax,
      shipping,
      total,
      totalCost,
      totalProfit,
      paidAmount: actualPaid,
      changeAmount,
      paymentMethod,
      paymentStatus,
      progressStatus: draft.progressStatus,
      note: draft.note,
      cashierName: activeUser.name,
    };

    const cashIn = Math.min(actualPaid, total);

    setData((prev) => ({
      ...prev,
      nextReceiptNo: prev.nextReceiptNo + 1,
      products: prev.businessFlags.useStock
        ? prev.products.map((p) => {
            const ordered = draft.items.find((it) => it.productId === p.id);
            return ordered ? { ...p, stock: Math.max(0, p.stock - ordered.qty) } : p;
          })
        : prev.products,
      transactions: [tx, ...prev.transactions],
      cashflows:
        cashIn > 0
          ? [
              {
                id: `cf-tx-${Date.now()}`,
                createdAt: tx.createdAt,
                kind: 'in',
                method: paymentMethod,
                amount: cashIn,
                title: `Transaksi #${tx.receiptNo}`,
                note: tx.customerName,
                transactionId: tx.id,
              },
              ...prev.cashflows,
            ]
          : prev.cashflows,
    }));

    setLastTx(tx);
    setDraft(EMPTY_DRAFT);
    clearActiveDraft();
    setScreen('receipt');
    return tx;
  };

  return (
    <AppErrorBoundary>
      <div className="min-h-screen bg-[#F5F6F4] dark:bg-[#0E1418] text-[#17252B] dark:text-[#ECF1EF]">
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentScreen={screen}
        onNavigate={navigate}
        store={data.store}
        activeUser={activeUser}
      />

      {screen === 'home' && (
        <HomeScreen
          data={data}
          draft={draft}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
        />
      )}

      {(screen === 'pos' || screen === 'cart' || screen === 'payment' || screen === 'receipt') && (
        <PosFlowScreens
          screen={screen}
          data={data}
          draft={draft}
          setDraft={setDraft}
          lastTransaction={lastTx}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
          onEditProductFromPos={(product) => {
            setEditingProduct(product);
            navigate('product_form');
          }}
          onSaveQuickCart={handleSaveQuickCart}
          onCompleteTransaction={handleCompleteTransaction}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {(screen === 'products' ||
        screen === 'product_form' ||
        screen === 'quick_tx' ||
        screen === 'customers' ||
        screen === 'master' ||
        screen === 'catalog') && (
        <InventoryScreens
          screen={screen}
          data={data}
          editingProduct={editingProduct}
          onBackFromForm={() => setScreen(prevScreen === 'pos' ? 'pos' : 'products')}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
          onEditProduct={setEditingProduct}
          onUpdateData={setData}
          onLoadQuickCart={handleLoadQuickCart}
          onQuickAddProductToCart={(p) => {
            setDraft((prev) => {
              const ex = prev.items.find((i) => i.productId === p.id);
              if (ex) {
                return {
                  ...prev,
                  items: prev.items.map((i) =>
                    i.productId === p.id ? { ...i, qty: i.qty + 1 } : i
                  ),
                };
              }
              return {
                ...prev,
                items: [
                  ...prev.items,
                  {
                    productId: p.id,
                    name: p.name,
                    costPrice: p.costPrice,
                    unitPrice: p.sellPrice,
                    qty: 1,
                    discount: 0,
                    note: '',
                    unit: p.unit || 'pcs',
                  },
                ],
              };
            });
            notify(`${p.name} masuk keranjang`);
          }}
          notify={notify}
        />
      )}

      {(screen === 'transactions' ||
        screen === 'cashflow' ||
        screen === 'expenses' ||
        screen === 'reports') && (
        <FinanceScreens
          screen={screen}
          data={data}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
          onOpenReceipt={(tx) => {
            setLastTx(tx);
            navigate('receipt');
          }}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {(screen === 'settings' ||
        screen === 'settings_business' ||
        screen === 'settings_product' ||
        screen === 'settings_receipt' ||
        screen === 'settings_printer' ||
        screen === 'settings_users' ||
        screen === 'settings_store' ||
        screen === 'settings_backup') && (
        <SettingsScreens
          screen={screen}
          data={data}
          onOpenDrawer={() => setDrawerOpen(true)}
          onBack={() =>
            setScreen(
              prevScreen === 'receipt' || prevScreen === 'pos' || prevScreen === 'products'
                ? prevScreen
                : 'settings'
            )
          }
          onNavigate={navigate}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {screen === 'sync' && (
        <SyncScreen
          data={data}
          onOpenDrawer={() => setDrawerOpen(true)}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-2xl bg-[#132622]/95 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-xl border border-white/15 backdrop-blur-md">
          {toastMsg}
        </div>
      )}
      </div>
    </AppErrorBoundary>
  );
}
