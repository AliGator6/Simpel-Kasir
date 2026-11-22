import { useEffect, useState } from 'react';
import { AppData, Product, SavedQuickCart, ScreenId, Transaction } from './types';
import { loadAppData, saveAppData } from './utils/storage';
import { Drawer } from './components/Drawer';
import { HomeScreen } from './screens/HomeScreen';
import { ActiveOrderDraft, PosFlowScreens } from './screens/PosScreens';
import { InventoryScreens } from './screens/InventoryScreens';
import { FinanceScreens } from './screens/FinanceScreens';
import { SettingsScreens } from './screens/SettingsScreens';

const EMPTY_DRAFT: ActiveOrderDraft = {
  items: [], customerId: null, customerName: 'Umum', discount: 0, shipping: 0, note: '', progressStatus: 'antri',
};

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [screen, setScreen] = useState<ScreenId>('home');
  const [prevScreen, setPrevScreen] = useState<ScreenId>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<ActiveOrderDraft>(EMPTY_DRAFT);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    saveAppData(data);
    const root = document.documentElement;
    if (data.darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [data]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => setToastMsg((cur) => (cur === msg ? null : cur)), 2600);
  };

  const navigate = (next: ScreenId) => {
    setPrevScreen(screen);
    setScreen(next);
  };

  const activeUser = data.users.find((u) => u.id === data.activeUserId) || data.users[0];

  const handleSaveQuickCart = (name: string) => {
    const entry: SavedQuickCart = {
      id: `qc-${Date.now()}`, name, customerId: draft.customerId, customerName: draft.customerName,
      items: draft.items, discount: draft.discount, note: draft.note, shipping: draft.shipping, updatedAt: Date.now(),
    };
    setData((prev) => ({ ...prev, quickCarts: [entry, ...prev.quickCarts] }));
    notify(`"${name}" disimpan ke Transaksi Cepat`);
  };

  const handleLoadQuickCart = (qc: SavedQuickCart) => {
    setDraft({
      items: qc.items.map((i) => ({ ...i })), customerId: qc.customerId, customerName: qc.customerName,
      discount: qc.discount, shipping: qc.shipping, note: qc.note, progressStatus: 'antri',
    });
    navigate('cart');
    notify(`Memuat "${qc.name}"`);
  };

  const handleCompleteTransaction = (paidAmount: number, paymentMethod: 'tunai' | 'non_tunai', isPayLater: boolean): Transaction => {
    const subtotal = draft.items.reduce((acc, it) => acc + Math.max(0, it.unitPrice * it.qty - it.discount), 0);
    const tax = data.businessFlags.useTax ? Math.round(((subtotal - draft.discount) * data.businessFlags.taxPercent) / 100) : 0;
    const shipping = data.businessFlags.useShipping ? draft.shipping : 0;
    const total = Math.max(0, subtotal - draft.discount + tax + shipping);
    const totalCost = draft.items.reduce((acc, it) => acc + it.costPrice * it.qty, 0);
    const totalProfit = total - tax - shipping - totalCost;
    const actualPaid = isPayLater ? 0 : paidAmount;
    const changeAmount = actualPaid - total;
    const paymentStatus = actualPaid >= total ? 'lunas' : actualPaid > 0 ? 'kurang' : 'belum_dibayar';
    const cust = draft.customerId ? data.customers.find((c) => c.id === draft.customerId) : undefined;

    const tx: Transaction = {
      id: `tx-${Date.now()}`, receiptNo: data.nextReceiptNo, createdAt: Date.now(), paidAt: actualPaid > 0 ? Date.now() : null,
      customerId: draft.customerId, customerName: draft.customerName, customerPhone: cust?.phone, customerAddress: cust?.address,
      items: draft.items.map((i) => ({ ...i })), subtotal, discount: draft.discount, tax, shipping, total, totalCost, totalProfit,
      paidAmount: actualPaid, changeAmount, paymentMethod, paymentStatus, progressStatus: draft.progressStatus, note: draft.note, cashierName: activeUser.name,
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
      cashflows: cashIn > 0
        ? [{ id: `cf-tx-${Date.now()}`, createdAt: tx.createdAt, kind: 'in', method: paymentMethod, amount: cashIn, title: `Transaksi #${tx.receiptNo}`, note: tx.customerName, transactionId: tx.id }, ...prev.cashflows]
        : prev.cashflows,
    }));

    setLastTx(tx);
    setDraft(EMPTY_DRAFT);
    setScreen('receipt');
    return tx;
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] dark:bg-[#11161D] text-[#1A202C] dark:text-[#EDF2F7]">
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} currentScreen={screen} onNavigate={navigate} store={data.store} activeUser={activeUser} />

      {screen === 'home' && <HomeScreen data={data} onOpenDrawer={() => setDrawerOpen(true)} onNavigate={navigate} />}

      {(screen === 'pos' || screen === 'cart' || screen === 'payment' || screen === 'receipt') && (
        <PosFlowScreens
          screen={screen} data={data} draft={draft} setDraft={setDraft} lastTransaction={lastTx}
          onOpenDrawer={() => setDrawerOpen(true)} onNavigate={navigate}
          onEditProductFromPos={(product) => { setEditingProduct(product); navigate('product_form'); }}
          onSaveQuickCart={handleSaveQuickCart} onCompleteTransaction={handleCompleteTransaction}
          onUpdateData={setData} notify={notify}
        />
      )}

      {(screen === 'products' || screen === 'product_form' || screen === 'quick_tx' || screen === 'customers' || screen === 'master' || screen === 'catalog') && (
        <InventoryScreens
          screen={screen} data={data} editingProduct={editingProduct}
          onBackFromForm={() => setScreen(prevScreen === 'pos' ? 'pos' : 'products')}
          onOpenDrawer={() => setDrawerOpen(true)} onNavigate={navigate} onEditProduct={setEditingProduct}
          onUpdateData={setData} onLoadQuickCart={handleLoadQuickCart}
          onQuickAddProductToCart={(p) => {
            setDraft((prev) => {
              const ex = prev.items.find((i) => i.productId === p.id);
              if (ex) return { ...prev, items: prev.items.map((i) => (i.productId === p.id ? { ...i, qty: i.qty + 1 } : i)) };
              return { ...prev, items: [...prev.items, { productId: p.id, name: p.name, costPrice: p.costPrice, unitPrice: p.sellPrice, qty: 1, discount: 0, note: '', unit: p.unit || 'pcs' }] };
            });
            notify(`${p.name} masuk keranjang`);
          }}
          notify={notify}
        />
      )}

      {(screen === 'transactions' || screen === 'cashflow' || screen === 'expenses' || screen === 'reports') && (
        <FinanceScreens
          screen={screen} data={data} onOpenDrawer={() => setDrawerOpen(true)} onNavigate={navigate}
          onOpenReceipt={(tx) => { setLastTx(tx); navigate('receipt'); }}
          onUpdateData={setData} notify={notify}
        />
      )}

      {(screen === 'settings' || screen === 'settings_business' || screen === 'settings_product' || screen === 'settings_receipt' || screen === 'settings_printer' || screen === 'settings_users' || screen === 'settings_store') && (
        <SettingsScreens
          screen={screen} data={data} onOpenDrawer={() => setDrawerOpen(true)}
          onBack={() => setScreen(prevScreen === 'receipt' || prevScreen === 'pos' || prevScreen === 'products' ? prevScreen : 'settings')}
          onNavigate={navigate} onUpdateData={setData} notify={notify}
        />
      )}

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[#1E2F42] px-4 py-2.5 text-xs font-semibold text-white shadow-xl border border-white/10">
          {toastMsg}
        </div>
      )}
    </div>
  );
}
