import React, { useMemo, useRef, useState } from 'react';
import { ArrowDownAZ, Settings, UserPlus, ScanBarcode, Bike, ShoppingBasket, Search, X, Plus, Minus, ChevronRight, Save, UserCheck, XCircle, Percent, FileEdit, ReceiptText, MessageSquarePlus, CheckCircle2, Banknote, Store, Printer, Share2, Home, ShoppingCart } from 'lucide-react';
import { AppData, CartItem, Customer, Product, ProgressStatus, ScreenId, Transaction } from '../types';
import { TopBar, SwitchRow } from '../components/TopBar';
import { formatDateShort, formatMoney, formatNumber } from '../utils/storage';
import { printThermalTransaction } from '../utils/printer';
import { shareReceiptWhatsApp } from '../utils/receiptImage';

export interface ActiveOrderDraft {
  items: CartItem[];
  customerId: string | null;
  customerName: string;
  discount: number;
  shipping: number;
  note: string;
  progressStatus: ProgressStatus;
}

interface PosFlowProps {
  screen: 'pos' | 'cart' | 'payment' | 'receipt';
  data: AppData;
  draft: ActiveOrderDraft;
  setDraft: React.Dispatch<React.SetStateAction<ActiveOrderDraft>>;
  lastTransaction: Transaction | null;
  onOpenDrawer: () => void;
  onNavigate: (s: ScreenId) => void;
  onEditProductFromPos: (product: Product) => void;
  onSaveQuickCart: (name: string) => void;
  onCompleteTransaction: (paidAmount: number, paymentMethod: 'tunai' | 'non_tunai', isPayLater: boolean) => Transaction;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  notify: (msg: string) => void;
}

export const PosFlowScreens: React.FC<PosFlowProps> = ({
  screen, data, draft, setDraft, lastTransaction, onOpenDrawer, onNavigate,
  onEditProductFromPos, onSaveQuickCart, onCompleteTransaction, notify,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(true);
  const [filterInCartOnly, setFilterInCartOnly] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [qtyPopupProduct, setQtyPopupProduct] = useState<Product | null>(null);
  const [qtyInputVal, setQtyInputVal] = useState('1');
  const [priceInputVal, setPriceInputVal] = useState('0');
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeText, setBarcodeText] = useState('');
  const [showCustomerSelectModal, setShowCustomerSelectModal] = useState(false);
  const [showTempCustomerModal, setShowTempCustomerModal] = useState(false);
  const [tempCustomerInput, setTempCustomerInput] = useState('');
  const [showSaveQuickModal, setShowSaveQuickModal] = useState(false);
  const [quickCartTitle, setQuickCartTitle] = useState('');
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [showExtraOptionsModal, setShowExtraOptionsModal] = useState(false);
  const [itemDiscountTarget, setItemDiscountTarget] = useState<CartItem | null>(null);
  const [itemDiscountVal, setItemDiscountVal] = useState('0');

  const subtotal = useMemo(() => draft.items.reduce((acc, it) => acc + Math.max(0, it.unitPrice * it.qty - it.discount), 0), [draft.items]);
  const taxAmount = useMemo(() => {
    if (!data.businessFlags.useTax) return 0;
    return Math.round(((subtotal - draft.discount) * data.businessFlags.taxPercent) / 100);
  }, [data.businessFlags, subtotal, draft.discount]);
  const shippingAmount = data.businessFlags.useShipping ? draft.shipping : 0;
  const grandTotal = Math.max(0, subtotal - draft.discount + taxAmount + shippingAmount);
  const totalCost = useMemo(() => draft.items.reduce((acc, it) => acc + it.costPrice * it.qty, 0), [draft.items]);
  const totalProfit = grandTotal - shippingAmount - taxAmount - totalCost;
  const totalItemsCount = useMemo(() => draft.items.reduce((acc, it) => acc + it.qty, 0), [draft.items]);

  const [paidInput, setPaidInput] = useState<number>(grandTotal);
  const [hasTappedQuickDenom, setHasTappedQuickDenom] = useState(false);
  const [isNonCash, setIsNonCash] = useState(false);

  const prevScreenRef = useRef(screen);
  if (prevScreenRef.current !== screen && screen === 'payment') {
    setPaidInput(grandTotal);
    setHasTappedQuickDenom(false);
    setIsNonCash(false);
  }
  prevScreenRef.current = screen;

  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const getCartQty = (productId: string) => draft.items.find((it) => it.productId === productId)?.qty || 0;

  const adjustProductQty = (product: Product, delta: number) => {
    setDraft((prev) => {
      const existing = prev.items.find((it) => it.productId === product.id);
      if (!existing && delta > 0) {
        return {
          ...prev,
          items: [...prev.items, { productId: product.id, name: product.name, costPrice: product.costPrice, unitPrice: product.sellPrice, qty: delta, discount: 0, note: '', unit: product.unit || 'pcs' }],
        };
      }
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) return { ...prev, items: prev.items.filter((it) => it.productId !== product.id) };
      return { ...prev, items: prev.items.map((it) => (it.productId === product.id ? { ...it, qty: nextQty } : it)) };
    });
  };

  const setExactProductQty = (product: Product, qty: number, unitPrice?: number) => {
    setDraft((prev) => {
      if (qty <= 0) return { ...prev, items: prev.items.filter((it) => it.productId !== product.id) };
      const existing = prev.items.find((it) => it.productId === product.id);
      if (!existing) {
        return {
          ...prev,
          items: [...prev.items, { productId: product.id, name: product.name, costPrice: product.costPrice, unitPrice: unitPrice ?? product.sellPrice, qty, discount: 0, note: '', unit: product.unit || 'pcs' }],
        };
      }
      return {
        ...prev,
        items: prev.items.map((it) => (it.productId === product.id ? { ...it, qty, unitPrice: unitPrice ?? it.unitPrice } : it)),
      };
    });
  };

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.products
      .filter((p) => {
        if (filterInCartOnly && getCartQty(p.id) <= 0) return false;
        if (!q) return true;
        if (data.productSettings.strictSearch) {
          return p.name.toLowerCase().startsWith(q) || p.sku.toLowerCase() === q || p.barcode.toLowerCase() === q;
        }
        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q);
      })
      .sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [data.products, searchQuery, filterInCartOnly, sortAsc, draft.items, data.productSettings.strictSearch]);

  const handleBarcodeLookup = () => {
    const code = barcodeText.trim();
    if (!code) return;
    const found = data.products.find((p) => p.barcode.toLowerCase() === code.toLowerCase() || p.sku.toLowerCase() === code.toLowerCase());
    if (found) {
      adjustProductQty(found, 1);
      notify(`${found.name} ditambahkan (+1)`);
      setBarcodeText('');
      setShowBarcodeModal(false);
    } else {
      notify('Barcode / Kode Produk tidak ditemukan');
    }
  };

  if (screen === 'pos') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-20">
        <TopBar
          title="Transaksi Baru"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <>
              <button type="button" onClick={() => setSortAsc((s) => !s)} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Urutkan produk">
                <ArrowDownAZ className="h-5 w-5" />
              </button>
              <button type="button" onClick={() => onNavigate('settings_product')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Pengaturan produk">
                <Settings className="h-5 w-5" />
              </button>
            </>
          }
        />

        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#1A222C] px-2.5 pt-2.5 pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="grid grid-cols-6 gap-1.5">
            <button type="button" onClick={() => setShowCustomerSelectModal(true)} className="col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[#1E2F42] px-2 text-xs font-semibold text-white active:scale-95 transition" title="Pilih Pelanggan">
              <UserPlus className="h-4 w-4 shrink-0" />
              <span className="truncate">{draft.customerName}</span>
            </button>
            <button type="button" onClick={() => setShowBarcodeModal(true)} className="flex h-10 items-center justify-center rounded-lg bg-[#1E2F42] text-white active:scale-95 transition" aria-label="Scan Barcode">
              <ScanBarcode className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => onNavigate('quick_tx')} className="flex h-10 items-center justify-center rounded-lg bg-[#1E2F42] text-white active:scale-95 transition" aria-label="Transaksi Cepat">
              <Bike className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setFilterInCartOnly((v) => !v)} className={`flex h-10 items-center justify-center rounded-lg text-white active:scale-95 transition ${filterInCartOnly ? 'bg-[#2C6E58]' : 'bg-[#B55340]'}`} aria-label="Filter item di keranjang">
              <ShoppingBasket className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setShowSearchBox((s) => !s)} className="flex h-10 items-center justify-center rounded-lg bg-[#1E2F42] text-white active:scale-95 transition" aria-label="Cari Produk">
              <Search className="h-5 w-5" />
            </button>
          </div>

          {showSearchBox && (
            <div className="mt-2 flex items-center rounded-lg border-2 border-[#1E2F42] bg-white dark:bg-[#11161D] px-2.5 h-11">
              <Search className="h-4 w-4 text-[#1E2F42] dark:text-slate-300 shrink-0" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Cari nama produk, SKU, atau barcode..." className="w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-slate-400" />
              {searchQuery && (
                <button type="button" onClick={() => setSearchQuery('')} className="flex h-8 w-8 items-center justify-center text-[#1E2F42] dark:text-slate-300">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mx-auto w-full max-w-4xl flex-1 divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#1A222C]">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center px-4">
              <p className="text-sm font-medium text-slate-500">Tidak ada produk yang cocok.</p>
              <button type="button" onClick={() => onNavigate('products')} className="mt-3 rounded-lg bg-[#1E2F42] px-4 py-2 text-xs font-semibold text-white">Kelola Produk</button>
            </div>
          ) : (
            filteredProducts.map((product) => {
              const qty = getCartQty(product.id);
              const profit = product.sellPrice - product.costPrice;
              const startPress = () => {
                longPressTriggeredRef.current = false;
                longPressTimerRef.current = window.setTimeout(() => {
                  longPressTriggeredRef.current = true;
                  onEditProductFromPos(product);
                }, 480);
              };
              const cancelPress = () => {
                if (longPressTimerRef.current) {
                  clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = null;
                }
              };

              return (
                <div key={product.id} className="flex min-h-[76px] items-stretch">
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={startPress}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onPointerCancel={cancelPress}
                    onContextMenu={(e) => { e.preventDefault(); onEditProductFromPos(product); }}
                    onClick={() => {
                      if (longPressTriggeredRef.current) return;
                      setQtyPopupProduct(product);
                      setQtyInputVal(String(qty > 0 ? qty : 1));
                      setPriceInputVal(String(product.sellPrice));
                    }}
                    className="flex flex-1 flex-col justify-center px-4 py-2.5 text-left select-none cursor-pointer active:bg-slate-50 dark:active:bg-slate-800/50 transition"
                  >
                    <p className="text-[16px] font-semibold text-slate-900 dark:text-slate-100 leading-snug">{product.name}</p>
                    <p className="mt-0.5 text-sm font-medium tabular-nums text-slate-700 dark:text-slate-300">
                      {formatMoney(product.sellPrice, data.currencySymbol)}
                      {data.businessFlags.useStock && <span className="ml-2 text-xs text-slate-400">· Stok: {product.stock}</span>}
                    </p>
                    {qty > 0 && <p className="mt-0.5 text-xs tabular-nums text-slate-500 dark:text-slate-400">Laba: {formatMoney(profit * qty, data.currencySymbol)}</p>}
                  </div>

                  {qty === 0 ? (
                    <button type="button" onClick={() => adjustProductQty(product, 1)} className="flex w-24 shrink-0 items-center justify-center bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 active:bg-slate-300 transition" aria-label={`Tambah ${product.name}`}>
                      <Plus className="h-6 w-6" />
                    </button>
                  ) : (
                    <div className="flex w-40 shrink-0 items-stretch">
                      <button type="button" onClick={() => adjustProductQty(product, -1)} className="flex flex-1 items-center justify-center bg-slate-100 dark:bg-slate-800 text-[#A93F4B] hover:bg-slate-200 active:bg-slate-300 transition" aria-label={`Kurangi ${product.name}`}>
                        <Minus className="h-5 w-5 stroke-[2.5]" />
                      </button>
                      <button type="button" onClick={() => adjustProductQty(product, 1)} className="flex flex-1 items-center justify-center bg-[#2C6E58] text-lg font-bold tabular-nums text-white hover:bg-[#245C49] active:scale-[0.98] transition" aria-label={`Tambah lagi ${product.name}`}>
                        {qty}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {draft.items.length > 0 && (
          <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto max-w-4xl">
            <button type="button" onClick={() => onNavigate('cart')} className="flex w-full items-center justify-between rounded-xl bg-[#B55340] px-4 py-3.5 text-white shadow-lg shadow-[#B55340]/30 hover:bg-[#9E4534] active:scale-[0.99] transition">
              <div className="flex items-center gap-3">
                <ShoppingBasket className="h-5 w-5" />
                <span className="text-base font-bold tabular-nums">{totalItemsCount}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-base font-bold tabular-nums">{formatMoney(grandTotal, data.currencySymbol)}</span>
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          </div>
        )}

        {qtyPopupProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold text-slate-900 dark:text-white truncate">{qtyPopupProduct.name}</h3>
              <p className="mt-0.5 text-xs text-slate-500">Ketik jumlah (tahan baris produk untuk edit master produk)</p>
              <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">Jumlah ({qtyPopupProduct.unit || 'pcs'})</label>
              <input type="number" min={0} autoFocus value={qtyInputVal} onChange={(e) => setQtyInputVal(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-lg font-bold tabular-nums outline-none focus:border-[#1E2F42]" />
              {qtyPopupProduct.priceEditable && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">Harga Jual Satuan</label>
                  <input type="number" min={0} value={priceInputVal} onChange={(e) => setPriceInputVal(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-[#1E2F42]" />
                </>
              )}
              <div className="mt-5 flex gap-2">
                <button type="button" onClick={() => setQtyPopupProduct(null)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    const q = Math.max(0, Number(qtyInputVal) || 0);
                    const p = qtyPopupProduct.priceEditable ? Math.max(0, Number(priceInputVal) || 0) : undefined;
                    setExactProductQty(qtyPopupProduct, q, p);
                    setQtyPopupProduct(null);
                  }}
                  className="flex-1 rounded-xl bg-[#1E2F42] py-2.5 text-sm font-semibold text-white"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        )}

        {showBarcodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Scan / Input Barcode</h3>
              <p className="mt-1 text-xs text-slate-500">Masukkan atau tembak kode barcode / SKU produk</p>
              <input type="text" autoFocus value={barcodeText} onChange={(e) => setBarcodeText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()} placeholder="Contoh: 8998899111001" className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm font-mono-tabular outline-none focus:border-[#1E2F42]" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowBarcodeModal(false)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2.5 text-sm font-semibold">Tutup</button>
                <button type="button" onClick={handleBarcodeLookup} className="flex-1 rounded-xl bg-[#1E2F42] py-2.5 text-sm font-semibold text-white">Tambah</button>
              </div>
            </div>
          </div>
        )}

        {showCustomerSelectModal && (
          <CustomerSelectorModal
            customers={data.customers}
            onClose={() => setShowCustomerSelectModal(false)}
            onSelect={(cust) => {
              setDraft((prev) => ({ ...prev, customerId: cust ? cust.id : null, customerName: cust ? cust.name : 'Umum' }));
              setShowCustomerSelectModal(false);
            }}
          />
        )}
      </div>
    );
  }

  if (screen === 'cart') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-20">
        <TopBar
          title="Transaksi Baru"
          mode="back"
          onLeftClick={() => onNavigate('pos')}
          rightContent={
            <button
              type="button"
              onClick={() => {
                setQuickCartTitle(draft.customerName !== 'Umum' ? draft.customerName : '');
                setShowSaveQuickModal(true);
              }}
              className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10"
              aria-label="Simpan ke Transaksi Cepat"
            >
              <Save className="h-5 w-5" />
            </button>
          }
        />

        <div className="mx-auto w-full max-w-4xl flex-1">
          <div className="flex items-center gap-2 bg-white dark:bg-[#1A222C] px-3 py-2.5 border-b border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setTempCustomerInput(draft.customerId ? '' : draft.customerName === 'Umum' ? '' : draft.customerName);
                setShowTempCustomerModal(true);
              }}
              className="flex h-10 w-12 items-center justify-center rounded-lg border-2 border-[#B55340] text-[#B55340] hover:bg-[#B55340]/10 transition"
              title="Tulis nama pembeli sementara (tanpa disimpan)"
            >
              <UserPlus className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => setShowCustomerSelectModal(true)} className="flex h-10 w-12 items-center justify-center rounded-lg border-2 border-[#1E2F42] dark:border-slate-500 text-[#1E2F42] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition" title="Pilih pelanggan tersimpan">
              <UserCheck className="h-5 w-5" />
            </button>
            <span className="ml-1 text-base font-semibold text-[#B55340] dark:text-[#E08A79] truncate">{draft.customerName}</span>
          </div>

          <div className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#1A222C]">
            {draft.items.map((item) => {
              const lineSub = Math.max(0, item.unitPrice * item.qty - item.discount);
              const lineProfit = lineSub - item.costPrice * item.qty;
              return (
                <div key={item.productId} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex-1 text-[16px] font-semibold text-slate-900 dark:text-white truncate">{item.name}</span>
                    <span className="w-12 text-center text-[16px] font-semibold tabular-nums text-slate-800 dark:text-slate-200">{item.qty}</span>
                    <span className="w-24 text-right text-[16px] font-bold tabular-nums text-[#1E2F42] dark:text-sky-300">{formatNumber(lineSub)}</span>
                  </div>
                  <p className="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-400">
                    {formatNumber(item.unitPrice)}
                    {item.discount > 0 && ` (Diskon -${formatNumber(item.discount)})`}
                  </p>
                  <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                    Laba: {formatNumber(lineProfit)}
                    {item.note && ` · Cat: ${item.note}`}
                  </p>
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <button type="button" onClick={() => setDraft((prev) => ({ ...prev, items: prev.items.filter((it) => it.productId !== item.productId) }))} className="flex h-8 w-11 items-center justify-center rounded-md bg-[#A93F4B] text-white active:scale-95 transition" aria-label={`Hapus ${item.name}`}>
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => { setItemDiscountTarget(item); setItemDiscountVal(String(item.discount)); }} className="flex h-8 w-11 items-center justify-center rounded-md bg-[#3F4854] text-white active:scale-95 transition" aria-label={`Diskon ${item.name}`}>
                      <Percent className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => setEditingCartItem({ ...item })} className="flex h-8 w-11 items-center justify-center rounded-md bg-[#1E2F42] text-white active:scale-95 transition" aria-label={`Edit ${item.name}`}>
                      <FileEdit className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-4 py-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Produk: <span className="tabular-nums font-bold">{draft.items.length}</span></p>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah item: <span className="tabular-nums font-bold">{totalItemsCount}</span></p>
                <div className="mt-3 flex items-center gap-2.5">
                  <button type="button" onClick={() => setShowExtraOptionsModal(true)} className="flex h-9 w-12 items-center justify-center rounded-md bg-[#3F4854] text-white active:scale-95 transition" aria-label="Diskon Nota">
                    <Percent className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setShowExtraOptionsModal(true)} className="flex h-9 w-12 items-center justify-center rounded-md bg-[#3F4854] text-white active:scale-95 transition" aria-label="Catatan & Biaya">
                    <ReceiptText className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  <span className="mr-2 text-sm font-medium text-slate-500">Total</span>
                  {formatMoney(grandTotal, data.currencySymbol)}
                </p>
                <p className="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-400">Laba: {formatMoney(totalProfit, data.currencySymbol)}</p>
                {draft.discount > 0 && <p className="text-xs text-[#A93F4B] tabular-nums">Diskon: -{formatMoney(draft.discount, data.currencySymbol)}</p>}
                {shippingAmount > 0 && <p className="text-xs text-slate-500 tabular-nums">Ongkir: {formatMoney(shippingAmount, data.currencySymbol)}</p>}
                {taxAmount > 0 && <p className="text-xs text-slate-500 tabular-nums">Pajak ({data.businessFlags.taxPercent}%): {formatMoney(taxAmount, data.currencySymbol)}</p>}
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#1A222C]/95 px-3 py-2.5 backdrop-blur-sm">
          <div className="mx-auto flex max-w-4xl items-center gap-2.5">
            <button type="button" onClick={() => setShowExtraOptionsModal(true)} className="flex h-12 w-16 shrink-0 items-center justify-center rounded-xl bg-[#B55340] text-white hover:bg-[#9E4534] active:scale-95 transition" aria-label="Opsi tambahan transaksi">
              <MessageSquarePlus className="h-5 w-5" />
            </button>
            <button type="button" disabled={draft.items.length === 0} onClick={() => onNavigate('payment')} className="flex h-12 flex-1 items-center justify-between rounded-xl bg-[#1E2F42] px-5 text-sm font-bold tracking-wide text-white hover:bg-[#273E56] disabled:opacity-40 active:scale-[0.99] transition">
              <span className="mx-auto">KE PEMBAYARAN</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {showTempCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Nama Pembeli Sementara</h3>
              <p className="mt-1 text-xs text-slate-500">Hanya dicetak di struk ini tanpa masuk daftar pelanggan.</p>
              <input type="text" autoFocus value={tempCustomerInput} onChange={(e) => setTempCustomerInput(e.target.value)} placeholder="Nama pembeli..." className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#1E2F42]" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowTempCustomerModal(false)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-sm font-semibold">Batal</button>
                <button type="button" onClick={() => { setDraft((p) => ({ ...p, customerId: null, customerName: tempCustomerInput.trim() || 'Umum' })); setShowTempCustomerModal(false); }} className="flex-1 rounded-xl bg-[#B55340] py-2 text-sm font-semibold text-white">Pakai</button>
              </div>
            </div>
          </div>
        )}

        {showCustomerSelectModal && (
          <CustomerSelectorModal
            customers={data.customers}
            onClose={() => setShowCustomerSelectModal(false)}
            onSelect={(cust) => {
              setDraft((prev) => ({ ...prev, customerId: cust ? cust.id : null, customerName: cust ? cust.name : 'Umum' }));
              setShowCustomerSelectModal(false);
            }}
          />
        )}

        {showSaveQuickModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Simpan ke Transaksi Cepat</h3>
              <p className="mt-1 text-xs text-slate-500">Beri nama agar bisa dipanggil cepat lewat ikon sepeda.</p>
              <input type="text" autoFocus value={quickCartTitle} onChange={(e) => setQuickCartTitle(e.target.value)} placeholder="Contoh: Pesanan Meja 2 / Warung Bu Ani" className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#1E2F42]" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowSaveQuickModal(false)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-sm font-semibold">Batal</button>
                <button type="button" onClick={() => { onSaveQuickCart(quickCartTitle.trim() || `Pesanan #${data.quickCarts.length + 1}`); setShowSaveQuickModal(false); }} className="flex-1 rounded-xl bg-[#1E2F42] py-2 text-sm font-semibold text-white">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {itemDiscountTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Diskon Item: {itemDiscountTarget.name}</h3>
              <input type="number" min={0} autoFocus value={itemDiscountVal} onChange={(e) => setItemDiscountVal(e.target.value)} placeholder="Nominal diskon (Rp)" className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-base font-semibold tabular-nums outline-none" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setItemDiscountTarget(null)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    const disc = Math.max(0, Number(itemDiscountVal) || 0);
                    setDraft((prev) => ({ ...prev, items: prev.items.map((it) => (it.productId === itemDiscountTarget.productId ? { ...it, discount: disc } : it)) }));
                    setItemDiscountTarget(null);
                  }}
                  className="flex-1 rounded-xl bg-[#1E2F42] py-2 text-sm font-semibold text-white"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {editingCartItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold truncate">Edit {editingCartItem.name}</h3>
              <label className="mt-3 block text-xs font-semibold text-slate-500">Jumlah</label>
              <input type="number" min={1} value={editingCartItem.qty} onChange={(e) => setEditingCartItem({ ...editingCartItem, qty: Math.max(1, Number(e.target.value) || 1) })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-semibold tabular-nums" />
              <label className="mt-3 block text-xs font-semibold text-slate-500">Harga Satuan</label>
              <input type="number" min={0} value={editingCartItem.unitPrice} onChange={(e) => setEditingCartItem({ ...editingCartItem, unitPrice: Math.max(0, Number(e.target.value) || 0) })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-semibold tabular-nums" />
              <label className="mt-3 block text-xs font-semibold text-slate-500">Catatan Item</label>
              <input type="text" value={editingCartItem.note} onChange={(e) => setEditingCartItem({ ...editingCartItem, note: e.target.value })} placeholder="Opsional..." className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setEditingCartItem(null)} className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 py-2 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, items: prev.items.map((it) => (it.productId === editingCartItem.productId ? editingCartItem : it)) }));
                    setEditingCartItem(null);
                  }}
                  className="flex-1 rounded-xl bg-[#1E2F42] py-2 text-sm font-semibold text-white"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {showExtraOptionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Opsi Tambahan Transaksi</h3>
              <label className="mt-3 block text-xs font-semibold text-slate-500">Diskon Nota (Rp)</label>
              <input type="number" min={0} value={draft.discount} onChange={(e) => setDraft((p) => ({ ...p, discount: Math.max(0, Number(e.target.value) || 0) }))} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-semibold tabular-nums" />
              {data.businessFlags.useShipping && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate-500">Ongkos Kirim (Rp)</label>
                  <input type="number" min={0} value={draft.shipping} onChange={(e) => setDraft((p) => ({ ...p, shipping: Math.max(0, Number(e.target.value) || 0) }))} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-semibold tabular-nums" />
                </>
              )}
              {data.businessFlags.useProgress && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate-500">Status Progres Awal</label>
                  <select value={draft.progressStatus} onChange={(e) => setDraft((p) => ({ ...p, progressStatus: e.target.value as ProgressStatus }))} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161D] px-3 py-2 text-sm">
                    <option value="antri">Antri</option>
                    <option value="proses">Proses</option>
                    <option value="selesai">Selesai</option>
                    <option value="diambil">Diambil</option>
                  </select>
                </>
              )}
              <label className="mt-3 block text-xs font-semibold text-slate-500">Catatan Struk</label>
              <textarea rows={2} value={draft.note} onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))} placeholder="Tulis catatan yang akan dicetak di struk..." className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
              <button type="button" onClick={() => setShowExtraOptionsModal(false)} className="mt-4 w-full rounded-xl bg-[#1E2F42] py-2.5 text-sm font-semibold text-white">Tutup</button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'payment') {
    const diff = paidInput - grandTotal;
    const denoms = [
      { label: '100K', val: 100000 },
      { label: '50K', val: 50000 },
      { label: '20K', val: 20000 },
      { label: '10K', val: 10000 },
      { label: '5K', val: 5000 },
      { label: '2K', val: 2000 },
      { label: '1K', val: 1000 },
    ];

    const handleAddDenom = (val: number) => {
      if (!hasTappedQuickDenom) {
        setPaidInput(val);
        setHasTappedQuickDenom(true);
      } else {
        setPaidInput((p) => p + val);
      }
    };

    const handleSubDenom = (val: number) => {
      setHasTappedQuickDenom(true);
      setPaidInput((p) => Math.max(0, p - val));
    };

    const finishTx = async (payLater: boolean) => {
      const tx = onCompleteTransaction(payLater ? 0 : paidInput, isNonCash ? 'non_tunai' : 'tunai', payLater);
      if (data.printerSettings.autoPrintAfterTx && !payLater) {
        try {
          await printThermalTransaction(tx, data.store, data.receiptSettings, data.printerSettings, data.currencySymbol);
        } catch {
          // silently open receipt screen if printer not connected
        }
      }
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
        <TopBar
          title="Pembayaran"
          mode="back"
          onLeftClick={() => onNavigate('cart')}
          rightContent={
            <button type="button" onClick={() => onNavigate('settings_receipt')} className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Pengaturan Struk">
              <Settings className="h-5 w-5" />
            </button>
          }
        />

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 pt-3 pb-44">
          <div className="flex items-center gap-3 rounded-xl bg-[#3D434D] px-4 py-3 text-white shadow-sm">
            <Banknote className="h-5 w-5 shrink-0 text-slate-200" />
            <span className="text-xl font-bold tabular-nums">{formatMoney(grandTotal, data.currencySymbol)}</span>
          </div>

          <div className="mt-8 flex flex-col items-center">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Pembayaran</span>
            <input
              type="number"
              min={0}
              value={paidInput}
              onChange={(e) => {
                setHasTappedQuickDenom(true);
                setPaidInput(Math.max(0, Number(e.target.value) || 0));
              }}
              className="mt-1 w-64 border-b-2 border-slate-300 dark:border-slate-700 bg-transparent pb-1.5 text-center text-3xl font-bold tabular-nums text-slate-900 dark:text-white outline-none focus:border-[#1E2F42]"
            />
            {diff > 0 && <p className="mt-2.5 text-base font-bold tabular-nums text-[#2C6E58] dark:text-emerald-400">Kembalian: {formatMoney(diff, data.currencySymbol)}</p>}
            {diff < 0 && <p className="mt-2.5 text-base font-bold tabular-nums text-[#A93F4B] dark:text-rose-400">Kurang: {formatMoney(Math.abs(diff), data.currencySymbol)}</p>}
          </div>

          <div className="mt-6 flex justify-end px-2">
            <div className="w-56 rounded-xl bg-white dark:bg-[#1A222C] border border-slate-200 dark:border-slate-800 overflow-hidden">
              <SwitchRow label="Bayar Non Tunai" checked={isNonCash} onChange={setIsNonCash} />
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#1A222C]/95 px-3 pt-2.5 pb-3 backdrop-blur-sm">
          <div className="mx-auto max-w-4xl">
            <div className="flex gap-2 overflow-x-auto pb-2.5 no-scrollbar">
              {denoms.map((d) => (
                <div key={d.label} className="flex w-[74px] shrink-0 flex-col overflow-hidden rounded-lg border border-slate-300 dark:border-slate-700 shadow-sm">
                  <button type="button" onClick={() => handleAddDenom(d.val)} className="flex h-12 items-center justify-center bg-[#3D434D] text-base font-bold text-white hover:bg-[#4C5460] active:bg-slate-600 transition">{d.label}</button>
                  <button type="button" onClick={() => handleSubDenom(d.val)} className="flex h-8 items-center justify-center bg-[#B55340] text-white hover:bg-[#9E4534] active:bg-[#863829] transition" aria-label={`Kurangi ${d.label}`}>
                    <Minus className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              <button type="button" onClick={() => finishTx(false)} className="col-span-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1E2F42] px-3 text-sm font-bold text-white hover:bg-[#273E56] active:scale-[0.98] transition">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>BAYAR SEKARANG</span>
              </button>
              <button type="button" onClick={() => finishTx(true)} className="col-span-2 flex h-12 items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 px-3 text-sm font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700 active:scale-[0.98] transition">
                BAYAR NANTI
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tx = lastTransaction;
  if (!tx) {
    return (
      <div className="flex min-h-screen flex-col bg-[#11161D] text-white">
        <TopBar title="Struk" mode="back" onLeftClick={() => onNavigate('home')} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">Belum ada struk aktif.</p>
        </div>
      </div>
    );
  }

  const cfg = data.receiptSettings;
  const money = (v: number) => formatMoney(v, cfg.showCurrency ? data.currencySymbol : '', cfg.currencySpace, cfg.currencyRight);

  return (
    <div className="flex min-h-screen flex-col bg-[#11161D] pb-20">
      <TopBar
        title="Struk"
        mode="back"
        onLeftClick={() => onNavigate('home')}
        rightContent={
          <>
            <button type="button" onClick={() => onNavigate('home')} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Ke Home" title="Home">
              <Home className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => onNavigate('pos')} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Transaksi Baru" title="Transaksi Baru">
              <ShoppingCart className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => onNavigate('settings_store')} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Edit Info Toko" title="Toko">
              <Store className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => onNavigate('settings_printer')} className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-white/10" aria-label="Pengaturan Printer" title="Pengaturan">
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <div id="receipt-print-area" className={`w-full rounded-sm bg-white p-6 text-slate-900 shadow-2xl ${cfg.paperWidth === '80' ? 'max-w-[400px]' : 'max-w-[330px]'}`}>
          <div className="text-center">
            <h2 className={`${cfg.largeStoreName ? 'text-2xl' : 'text-xl'} font-semibold tracking-tight`}>{data.store.name}</h2>
            {data.store.address && <p className="mt-1 text-sm text-slate-700">{data.store.address}</p>}
            {data.store.city && <p className="text-sm text-slate-700">{data.store.city}</p>}
            {data.store.phone && <p className="text-sm text-slate-700">{data.store.phone}</p>}
          </div>

          <div className="mt-5 flex items-center justify-between text-sm tabular-nums text-slate-800">
            <span>{formatDateShort(tx.createdAt)}</span>
            {cfg.showTxIdMode !== 'none' && <span>#{tx.receiptNo}</span>}
          </div>
          {tx.customerName && tx.customerName !== 'Umum' && (
            <div className="mt-1 flex justify-between text-sm">
              <span>Pelanggan</span>
              <span className={cfg.largeCustomer ? 'font-bold text-base' : 'font-medium'}>{tx.customerName}</span>
            </div>
          )}
          {cfg.showCashier && (
            <div className="flex justify-between text-xs text-slate-600">
              <span>Kasir</span>
              <span>{tx.cashierName}</span>
            </div>
          )}

          <div className="my-2.5 border-b border-dashed border-slate-500" />

          <div className="space-y-1.5 text-sm">
            {tx.items.map((item, idx) => {
              const sub = Math.max(0, item.unitPrice * item.qty - item.discount);
              return (
                <div key={item.productId}>
                  <p className={`font-bold ${cfg.largeItemName ? 'text-base' : 'text-sm'}`}>
                    {cfg.showItemIndex ? `${idx + 1}. ` : ''}
                    {item.name}
                  </p>
                  <div className={`flex justify-between pl-3 tabular-nums ${cfg.largeItemPrice ? 'text-base' : 'text-sm'}`}>
                    <span>
                      {item.qty}
                      {cfg.showUnit === 'all' ? `${cfg.unitSpace ? ' ' : ''}${item.unit}` : ''}x {formatNumber(item.unitPrice)}
                    </span>
                    <span>{formatNumber(sub)}</span>
                  </div>
                  {item.discount > 0 && (
                    <div className="flex justify-between pl-3 text-xs text-slate-600 tabular-nums">
                      <span>Diskon item</span>
                      <span>-{formatNumber(item.discount)}</span>
                    </div>
                  )}
                  {item.note && <p className="pl-3 text-xs italic text-slate-600">Cat: {item.note}</p>}
                </div>
              );
            })}
          </div>

          <div className="my-2.5 border-b border-dashed border-slate-500" />

          {!cfg.noTotalMode && (
            <div className="space-y-1 text-sm tabular-nums">
              {tx.discount > 0 && <div className="flex justify-between"><span>Diskon Nota</span><span>-{money(tx.discount)}</span></div>}
              {tx.tax > 0 && <div className="flex justify-between"><span>Pajak</span><span>{money(tx.tax)}</span></div>}
              {tx.shipping > 0 && <div className="flex justify-between"><span>Ongkir</span><span>{money(tx.shipping)}</span></div>}
              <div className={`flex justify-between font-bold ${cfg.largeTotal ? 'text-lg' : 'text-base'}`}>
                <span>Total</span>
                <span>{money(tx.total)}</span>
              </div>
              {tx.paidAmount > 0 ? (
                <>
                  <div className={`flex justify-between ${cfg.largePayment ? 'text-base font-semibold' : ''}`}>
                    <span>{tx.paymentMethod === 'non_tunai' ? 'Non Tunai' : 'Tunai'}</span>
                    <span>{money(tx.paidAmount)}</span>
                  </div>
                  <div className={`flex justify-between ${cfg.largeChange ? 'text-base font-semibold' : ''}`}>
                    <span>{tx.changeAmount >= 0 ? 'Kembali' : 'Kurang'}</span>
                    <span>{money(Math.abs(tx.changeAmount))}</span>
                  </div>
                </>
              ) : (
                cfg.showUnpaidStatus && (
                  <div className="flex justify-between font-bold text-[#A93F4B]">
                    <span>Status</span>
                    <span>Belum Dibayar</span>
                  </div>
                )
              )}
              {cfg.showPaidStatus && tx.paymentStatus === 'lunas' && (
                <div className="flex justify-between font-semibold text-[#2C6E58]">
                  <span>Status</span>
                  <span>Lunas</span>
                </div>
              )}
            </div>
          )}

          {tx.note && <p className="mt-2.5 border-t border-dashed border-slate-400 pt-2 text-xs text-slate-700">Catatan: {tx.note}</p>}
          {data.store.footer && <p className={`mt-4 text-sm text-slate-800 ${cfg.centerFooter ? 'text-center' : 'text-left'}`}>{data.store.footer}</p>}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1A222C] py-2">
        <button type="button" onClick={() => onNavigate('settings_receipt')} className="flex flex-col items-center justify-center gap-1 py-1 text-[#1E2F42] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
          <Settings className="h-5 w-5" />
          <span className="text-xs font-semibold">Pengaturan</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              const mode = await printThermalTransaction(tx, data.store, data.receiptSettings, data.printerSettings, data.currencySymbol);
              notify(mode === 'native' ? 'Struk dikirim ke printer Bluetooth' : 'Membuka dialog cetak');
            } catch (e) {
              notify((e as Error).message || 'Gagal mencetak struk');
            }
          }}
          className="flex flex-col items-center justify-center gap-1 py-1 text-[#1E2F42] dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Printer className="h-5 w-5" />
          <span className="text-xs font-semibold">Cetak</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await shareReceiptWhatsApp(tx, data.store, data.receiptSettings, data.currencySymbol);
              if (res === 'shared_image') {
                notify('Gambar struk siap dibagikan ke WhatsApp');
              } else {
                notify('Gambar struk diunduh & teks disiapkan untuk WhatsApp');
                window.open(`https://wa.me/?text=${encodeURIComponent(res)}`, '_blank');
              }
            } catch {
              notify('Gagal membagikan struk');
            }
          }}
          className="flex flex-col items-center justify-center gap-1 py-1 text-[#2C6E58] dark:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Share2 className="h-5 w-5" />
          <span className="text-xs font-semibold">WhatsApp</span>
        </button>
      </div>
    </div>
  );
};

const CustomerSelectorModal: React.FC<{
  customers: Customer[];
  onClose: () => void;
  onSelect: (cust: Customer | null) => void;
}> = ({ customers, onClose, onSelect }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
    <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold">Pilih Pelanggan</h3>
        <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
        <button type="button" onClick={() => onSelect(null)} className="w-full py-3 text-left text-sm font-semibold text-[#B55340]">
          Umum (Default)
        </button>
        {customers.map((c) => (
          <button key={c.id} type="button" onClick={() => onSelect(c)} className="w-full py-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
            {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
          </button>
        ))}
      </div>
    </div>
  </div>
);
