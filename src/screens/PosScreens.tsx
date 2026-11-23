import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownAZ,
  Settings,
  UserPlus,
  ScanBarcode,
  Bike,
  ShoppingBasket,
  Search,
  X,
  Plus,
  Minus,
  ChevronRight,
  Save,
  UserCheck,
  XCircle,
  Percent,
  FileEdit,
  ReceiptText,
  MessageSquarePlus,
  CheckCircle2,
  Banknote,
  Store,
  Printer,
  Share2,
  Home,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import {
  ActiveOrderDraft,
  AppData,
  CartItem,
  Customer,
  Product,
  ProgressStatus,
  ScreenId,
  Transaction,
} from '../types';
import { TopBar, SwitchRow, useBackClose } from '../components/TopBar';
import { NumericInput } from '../components/NumericInput';
import { formatDateShort, formatMoney, formatNumber } from '../utils/storage';
import { printThermalTransaction } from '../utils/printer';
import { shareReceiptWhatsApp } from '../utils/receiptImage';

export type { ActiveOrderDraft };

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
  screen,
  data,
  draft,
  setDraft,
  lastTransaction,
  onOpenDrawer,
  onNavigate,
  onEditProductFromPos,
  onSaveQuickCart,
  onCompleteTransaction,
  notify,
}) => {
  // POS Picker states
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBox, setShowSearchBox] = useState(true);
  const [filterInCartOnly, setFilterInCartOnly] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [visibleLimit, setVisibleLimit] = useState(100);
  const [qtyPopupProduct, setQtyPopupProduct] = useState<Product | null>(null);
  const [qtyInputVal, setQtyInputVal] = useState(1);
  const [priceInputVal, setPriceInputVal] = useState(0);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [barcodeText, setBarcodeText] = useState('');
  const [showCustomerSelectModal, setShowCustomerSelectModal] = useState(false);
  const [showTempCustomerModal, setShowTempCustomerModal] = useState(false);
  const [tempCustomerInput, setTempCustomerInput] = useState('');

  // Cart Review modals
  const [showSaveQuickModal, setShowSaveQuickModal] = useState(false);
  const [quickCartTitle, setQuickCartTitle] = useState('');
  const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null);
  const [showExtraOptionsModal, setShowExtraOptionsModal] = useState(false);
  const [itemDiscountTarget, setItemDiscountTarget] = useState<CartItem | null>(null);
  const [itemDiscountVal, setItemDiscountVal] = useState(0);
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);

  // Back button modal close hooks
  useBackClose(Boolean(qtyPopupProduct), () => setQtyPopupProduct(null));
  useBackClose(showBarcodeModal, () => setShowBarcodeModal(false));
  useBackClose(showCustomerSelectModal, () => setShowCustomerSelectModal(false));
  useBackClose(showTempCustomerModal, () => setShowTempCustomerModal(false));
  useBackClose(showSaveQuickModal, () => setShowSaveQuickModal(false));
  useBackClose(Boolean(editingCartItem), () => setEditingCartItem(null));
  useBackClose(showExtraOptionsModal, () => setShowExtraOptionsModal(false));
  useBackClose(Boolean(itemDiscountTarget), () => setItemDiscountTarget(null));
  useBackClose(showClearCartConfirm, () => setShowClearCartConfirm(false));

  // Payment screen state
  const subtotal = useMemo(
    () => draft.items.reduce((acc, it) => acc + Math.max(0, it.unitPrice * it.qty - it.discount), 0),
    [draft.items]
  );
  const taxAmount = useMemo(() => {
    if (!data.businessFlags.useTax) return 0;
    return Math.round(((subtotal - draft.discount) * data.businessFlags.taxPercent) / 100);
  }, [data.businessFlags, subtotal, draft.discount]);
  const shippingAmount = data.businessFlags.useShipping ? draft.shipping : 0;
  const grandTotal = Math.max(0, subtotal - draft.discount + taxAmount + shippingAmount);

  const totalItemsCount = useMemo(
    () => draft.items.reduce((acc, it) => acc + it.qty, 0),
    [draft.items]
  );

  const [paidInput, setPaidInput] = useState<number>(grandTotal);
  const [hasTappedQuickDenom, setHasTappedQuickDenom] = useState(false);
  const [isNonCash, setIsNonCash] = useState(false);

  // Sync paidInput when entering payment screen
  const prevScreenRef = useRef(screen);
  if (prevScreenRef.current !== screen && screen === 'payment') {
    setPaidInput(grandTotal);
    setHasTappedQuickDenom(false);
    setIsNonCash(false);
  }
  prevScreenRef.current = screen;

  // Long press timer ref for product rows
  const longPressTimerRef = useRef<number | null>(null);
  const longPressTriggeredRef = useRef(false);

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of draft.items) {
      map.set(it.productId, it.qty);
    }
    return map;
  }, [draft.items]);

  const getCartQty = (productId: string) => cartQtyMap.get(productId) || 0;

  const adjustProductQty = (product: Product, delta: number) => {
    setDraft((prev) => {
      const existing = prev.items.find((it) => it.productId === product.id);
      if (!existing && delta > 0) {
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              productId: product.id,
              name: product.name,
              costPrice: product.costPrice,
              unitPrice: product.sellPrice,
              qty: delta,
              discount: 0,
              note: '',
              unit: product.unit || 'pcs',
            },
          ],
        };
      }
      if (!existing) return prev;
      const nextQty = existing.qty + delta;
      if (nextQty <= 0) {
        return { ...prev, items: prev.items.filter((it) => it.productId !== product.id) };
      }
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.productId === product.id ? { ...it, qty: nextQty } : it
        ),
      };
    });
  };

  const setExactProductQty = (product: Product, qty: number, unitPrice?: number) => {
    setDraft((prev) => {
      if (qty <= 0) {
        return { ...prev, items: prev.items.filter((it) => it.productId !== product.id) };
      }
      const existing = prev.items.find((it) => it.productId === product.id);
      if (!existing) {
        return {
          ...prev,
          items: [
            ...prev.items,
            {
              productId: product.id,
              name: product.name,
              costPrice: product.costPrice,
              unitPrice: unitPrice ?? product.sellPrice,
              qty,
              discount: 0,
              note: '',
              unit: product.unit || 'pcs',
            },
          ],
        };
      }
      return {
        ...prev,
        items: prev.items.map((it) =>
          it.productId === product.id
            ? { ...it, qty, unitPrice: unitPrice ?? it.unitPrice }
            : it
        ),
      };
    });
  };

  const sortedProducts = useMemo(() => {
    const collator = new Intl.Collator('id', { sensitivity: 'base' });
    return [...data.products].sort((a, b) =>
      sortAsc ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name)
    );
  }, [data.products, sortAsc]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedProducts.filter((p) => {
      if (filterInCartOnly && (cartQtyMap.get(p.id) || 0) <= 0) return false;
      if (!q) return true;
      if (data.productSettings.strictSearch) {
        return (
          p.name.toLowerCase().startsWith(q) ||
          p.sku.toLowerCase() === q ||
          p.barcode.toLowerCase() === q
        );
      }
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.barcode.toLowerCase().includes(q)
      );
    });
  }, [
    sortedProducts,
    searchQuery,
    filterInCartOnly,
    filterInCartOnly ? cartQtyMap : null,
    data.productSettings.strictSearch,
  ]);

  useEffect(() => {
    setVisibleLimit(100);
  }, [searchQuery, filterInCartOnly, sortAsc, data.products]);

  const visibleProducts = useMemo(
    () => filteredProducts.slice(0, visibleLimit),
    [filteredProducts, visibleLimit]
  );

  const handleBarcodeLookup = () => {
    const code = barcodeText.trim();
    if (!code) return;
    const found = data.products.find(
      (p) => p.barcode.toLowerCase() === code.toLowerCase() || p.sku.toLowerCase() === code.toLowerCase()
    );
    if (found) {
      adjustProductQty(found, 1);
      notify(`${found.name} ditambahkan (+1)`);
      setBarcodeText('');
      setShowBarcodeModal(false);
    } else {
      notify('Barcode / Kode Produk tidak ditemukan');
    }
  };

  const handleClearDraft = () => {
    setDraft({
      items: [],
      customerId: null,
      customerName: 'Umum',
      discount: 0,
      shipping: 0,
      note: '',
      progressStatus: 'antri',
    });
    setFilterInCartOnly(false);
    setShowClearCartConfirm(false);
    notify('Semua item terpilih dihapus');
    if (screen === 'cart') {
      onNavigate('pos');
    }
  };

  const clearConfirmModal = showClearCartConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
      <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
        <h3 className="font-display text-base font-bold text-[#B54B54] dark:text-[#E07A82]">
          Reset Item Terpilih?
        </h3>
        <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
          Semua item di keranjang ({totalItemsCount} item) beserta diskon/catatan transaksi ini akan dihapus.
        </p>
        <div className="mt-4 flex gap-2.5">
          <button
            type="button"
            onClick={() => setShowClearCartConfirm(false)}
            className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleClearDraft}
            className="btn-lux-garnet flex-1 rounded-xl py-2.5 text-sm font-bold"
          >
            Hapus Semua
          </button>
        </div>
      </div>
    </div>
  );

  // ==============================================================
  // 1. SCREEN: POS PICKER (Transaksi Baru - Pilih Produk)
  // ==============================================================
  if (screen === 'pos') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar
          title="Transaksi Baru"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <>
              <button
                type="button"
                onClick={() => setSortAsc((s) => !s)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Urutkan produk"
              >
                <ArrowDownAZ className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => onNavigate('settings_product')}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Pengaturan produk"
              >
                <Settings className="h-5 w-5" />
              </button>
            </>
          }
        />

        {/* 5-Button Top Action Bar (GriyoPos Layout Preserved) */}
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#151E24] px-3 pt-3 pb-2.5 border-b border-[#E5E8E4] dark:border-[#223039]">
          <div className="grid grid-cols-6 gap-2">
            <button
              type="button"
              onClick={() => setShowCustomerSelectModal(true)}
              className="btn-lux-obsidian col-span-2 flex h-10 items-center justify-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold"
              title="Pilih Pelanggan"
            >
              <UserPlus className="h-4 w-4 shrink-0" />
              <span className="truncate">{draft.customerName}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowBarcodeModal(true)}
              className="btn-lux-obsidian flex h-10 items-center justify-center rounded-xl"
              aria-label="Scan Barcode"
            >
              <ScanBarcode className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('quick_tx')}
              className="btn-lux-obsidian flex h-10 items-center justify-center rounded-xl"
              aria-label="Transaksi Cepat"
            >
              <Bike className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setFilterInCartOnly((v) => !v)}
              className={`flex h-10 items-center justify-center rounded-xl ${
                filterInCartOnly ? 'btn-lux-primary' : 'btn-lux-gold'
              }`}
              aria-label="Filter item di keranjang"
            >
              <ShoppingBasket className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowSearchBox((s) => !s)}
              className="btn-lux-obsidian flex h-10 items-center justify-center rounded-xl"
              aria-label="Cari Produk"
            >
              <Search className="h-5 w-5" />
            </button>
          </div>

          {showSearchBox && (
            <div className="mt-2.5 flex items-center rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-[#F8F9F7] dark:bg-[#0E1418] px-3 h-11 focus-within:border-[#165B49] transition-colors">
              <Search className="h-4 w-4 text-[#165B49] dark:text-[#4BB89A] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk, SKU, atau barcode..."
                className="w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          )}
        </div>

        {/* Product Rows */}
        <div className="mx-auto w-full max-w-4xl flex-1 divide-y divide-[#EAECE8] dark:divide-[#223039] bg-white dark:bg-[#151E24]">
          {filteredProducts.length === 0 ? (
            <div className="py-16 text-center px-4">
              <p className="text-sm font-medium text-slate-500">Tidak ada produk yang cocok.</p>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="btn-lux-primary mt-3 rounded-xl px-4 py-2 text-xs font-semibold"
              >
                Kelola Produk
              </button>
            </div>
          ) : (
            visibleProducts.map((product) => {
              const qty = getCartQty(product.id);

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
                <div key={product.id} className="flex min-h-[78px] items-center">
                  {/* Left area: Short tap = qty popup, Long press = Edit Product */}
                  <div
                    role="button"
                    tabIndex={0}
                    onPointerDown={startPress}
                    onPointerUp={cancelPress}
                    onPointerLeave={cancelPress}
                    onPointerCancel={cancelPress}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      onEditProductFromPos(product);
                    }}
                    onClick={() => {
                      if (longPressTriggeredRef.current) return;
                      setQtyPopupProduct(product);
                      setQtyInputVal(qty > 0 ? qty : 1);
                      setPriceInputVal(product.sellPrice);
                    }}
                    className="flex flex-1 flex-col justify-center px-4 py-3 text-left select-none cursor-pointer active:bg-[#F5F7F5] dark:active:bg-[#1B262E] transition"
                  >
                    <p className="font-display text-[16px] font-semibold text-[#17252B] dark:text-[#ECF1EF] leading-snug">
                      {product.name}
                    </p>
                    {data.productSettings.useSku && product.sku && (
                      <p className="mt-0.5 text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                        {product.sku}
                      </p>
                    )}
                    <p className="mt-0.5 text-sm font-semibold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                      {formatMoney(product.sellPrice, data.currencySymbol)}
                      {data.businessFlags.useStock && (
                        <span className="ml-2 text-xs font-normal text-slate-400">· Stok: {product.stock}</span>
                      )}
                    </p>
                  </div>

                  {/* Right Action Area: Tactile Keycap + or [- | Emerald Qty] */}
                  {qty === 0 ? (
                    <button
                      type="button"
                      onClick={() => adjustProductQty(product, 1)}
                      className="btn-lux-soft mr-3 my-2 flex h-12 w-20 shrink-0 items-center justify-center rounded-2xl text-[#165B49] dark:text-[#4BB89A]"
                      aria-label={`Tambah ${product.name}`}
                    >
                      <Plus className="h-5 w-5 stroke-[2.4]" />
                    </button>
                  ) : (
                    <div className="mr-3 my-2 flex h-12 w-36 shrink-0 items-stretch gap-1.5">
                      <button
                        type="button"
                        onClick={() => adjustProductQty(product, -1)}
                        className="btn-lux-soft flex flex-1 items-center justify-center rounded-2xl text-[#B54B54] dark:text-[#E07A82]"
                        aria-label={`Kurangi ${product.name}`}
                      >
                        <Minus className="h-5 w-5 stroke-[2.5]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => adjustProductQty(product, 1)}
                        className="btn-lux-primary font-display flex flex-1 items-center justify-center rounded-2xl text-lg font-bold tabular-nums"
                        aria-label={`Tambah lagi ${product.name}`}
                      >
                        {qty}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
          {filteredProducts.length > visibleLimit && (
            <div className="p-4 text-center">
              <button
                type="button"
                onClick={() => setVisibleLimit((v) => v + 100)}
                className="btn-lux-soft w-full rounded-xl py-2.5 text-xs font-bold text-[#165B49] dark:text-[#4BB89A]"
              >
                Tampilkan 100 Produk Lainnya ({filteredProducts.length - visibleLimit} tersisa)
              </button>
            </div>
          )}
        </div>

        {/* Floating Luxury Emerald Checkout Bar + Reset Button */}
        {draft.items.length > 0 && (
          <div className="fixed bottom-3 left-3 right-3 z-40 mx-auto flex max-w-4xl items-center gap-2">
            <button
              type="button"
              onClick={() => setShowClearCartConfirm(true)}
              className="btn-lux-garnet flex h-[54px] w-[54px] shrink-0 items-center justify-center rounded-2xl"
              aria-label="Hapus semua item terpilih"
              title="Reset item terpilih"
            >
              <Trash2 className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('cart')}
              className="btn-lux-primary flex flex-1 items-center justify-between rounded-2xl px-5 py-3.5"
            >
              <div className="flex items-center gap-3">
                <ShoppingBasket className="h-5 w-5" />
                <span className="font-display text-base font-bold tabular-nums">{totalItemsCount} item</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-display text-base font-bold tabular-nums">
                  {formatMoney(grandTotal, data.currencySymbol)}
                </span>
                <ChevronRight className="h-5 w-5" />
              </div>
            </button>
          </div>
        )}

        {/* Pop-up Ketik Jumlah Manual */}
        {qtyPopupProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold text-[#17252B] dark:text-white truncate">
                {qtyPopupProduct.name}
              </h3>
              {data.productSettings.useSku && qtyPopupProduct.sku && (
                <p className="mt-0.5 text-xs font-semibold text-[#165B49] dark:text-[#4BB89A] truncate">
                  {qtyPopupProduct.sku}
                </p>
              )}
              <p className="mt-0.5 text-xs text-slate-500">
                Ketik jumlah (tahan baris produk untuk edit master produk)
              </p>
              <label className="mt-4 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                Jumlah ({qtyPopupProduct.unit || 'pcs'})
              </label>
              <NumericInput
                min={0}
                allowDecimal
                autoFocus
                value={qtyInputVal}
                onValueChange={setQtyInputVal}
                className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-lg font-bold tabular-nums outline-none focus:border-[#165B49]"
              />
              {qtyPopupProduct.priceEditable && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    Harga Jual Satuan
                  </label>
                  <NumericInput
                    min={0}
                    value={priceInputVal}
                    onValueChange={setPriceInputVal}
                    className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-base font-semibold tabular-nums outline-none focus:border-[#165B49]"
                  />
                </>
              )}
              <div className="mt-5 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setQtyPopupProduct(null)}
                  className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const q = Math.max(0, qtyInputVal);
                    const p = qtyPopupProduct.priceEditable
                      ? Math.max(0, priceInputVal)
                      : undefined;
                    setExactProductQty(qtyPopupProduct, q, p);
                    setQtyPopupProduct(null);
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Terapkan
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barcode Lookup Modal */}
        {showBarcodeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Scan / Input Barcode</h3>
              <p className="mt-1 text-xs text-slate-500">
                Masukkan atau tembak kode barcode / SKU produk
              </p>
              <input
                type="text"
                autoFocus
                value={barcodeText}
                onChange={(e) => setBarcodeText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                placeholder="Contoh: 8998899111001"
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm font-mono-tabular outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowBarcodeModal(false)}
                  className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  onClick={handleBarcodeLookup}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Tambah
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Select Saved Customer Modal */}
        {showCustomerSelectModal && (
          <CustomerSelectorModal
            customers={data.customers}
            onClose={() => setShowCustomerSelectModal(false)}
            onSelect={(cust) => {
              setDraft((prev) => ({
                ...prev,
                customerId: cust ? cust.id : null,
                customerName: cust ? cust.name : 'Umum',
              }));
              setShowCustomerSelectModal(false);
            }}
          />
        )}
        {clearConfirmModal}
      </div>
    );
  }

  // ==============================================================
  // 2. SCREEN: CART REVIEW (Review Keranjang - GriyoPos Layout)
  // ==============================================================
  if (screen === 'cart') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar
          title="Transaksi Baru"
          mode="back"
          onLeftClick={() => onNavigate('pos')}
          rightContent={
            <>
              {draft.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearCartConfirm(true)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#B54B54]/25 text-[#F6B8BD] hover:bg-[#B54B54]/40 active:scale-95 transition"
                  aria-label="Hapus semua item terpilih"
                  title="Reset item terpilih"
                >
                  <Trash2 className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setQuickCartTitle(draft.customerName !== 'Umum' ? draft.customerName : '');
                  setShowSaveQuickModal(true);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Simpan ke Transaksi Cepat"
              >
                <Save className="h-5 w-5" />
              </button>
            </>
          }
        />

        <div className="mx-auto w-full max-w-4xl flex-1">
          {/* Customer Bar (Temp Name vs Saved Customers) */}
          <div className="flex items-center gap-2.5 bg-white dark:bg-[#151E24] px-3.5 py-3 border-b border-[#E5E8E4] dark:border-[#223039]">
            <button
              type="button"
              onClick={() => {
                setTempCustomerInput(draft.customerId ? '' : draft.customerName === 'Umum' ? '' : draft.customerName);
                setShowTempCustomerModal(true);
              }}
              className="btn-lux-gold flex h-10 w-12 items-center justify-center rounded-xl"
              title="Tulis nama pembeli sementara (tanpa disimpan)"
            >
              <UserPlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowCustomerSelectModal(true)}
              className="btn-lux-soft flex h-10 w-12 items-center justify-center rounded-xl text-[#165B49] dark:text-[#4BB89A]"
              title="Pilih pelanggan tersimpan"
            >
              <UserCheck className="h-5 w-5" />
            </button>
            <span className="font-display ml-1 text-base font-semibold text-[#8C6A2E] dark:text-[#D5B26E] truncate">
              {draft.customerName}
            </span>
          </div>

          {/* Cart Items */}
          <div className="divide-y divide-[#EAECE8] dark:divide-[#223039] bg-white dark:bg-[#151E24]">
            {draft.items.map((item) => {
              const lineSub = Math.max(0, item.unitPrice * item.qty - item.discount);
              return (
                <div key={item.productId} className="px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-display flex-1 text-[16px] font-semibold text-[#17252B] dark:text-white truncate">
                      {item.name}
                    </span>
                    <span className="w-12 text-center text-[15px] font-semibold tabular-nums text-slate-700 dark:text-slate-200">
                      {item.qty}
                    </span>
                    <span className="font-display w-24 text-right text-[16px] font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                      {formatNumber(lineSub)}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm tabular-nums text-slate-600 dark:text-slate-400">
                    {formatNumber(item.unitPrice)}
                    {item.discount > 0 && ` (Diskon -${formatNumber(item.discount)})`}
                  </p>
                  {item.note && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Cat: {item.note}
                    </p>
                  )}

                  {/* 3 Action Buttons per Item */}
                  <div className="mt-2.5 flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDraft((prev) => ({
                          ...prev,
                          items: prev.items.filter((it) => it.productId !== item.productId),
                        }))
                      }
                      className="btn-lux-garnet flex h-8 w-11 items-center justify-center rounded-xl"
                      aria-label={`Hapus ${item.name}`}
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setItemDiscountTarget(item);
                        setItemDiscountVal(item.discount);
                      }}
                      className="btn-lux-gold flex h-8 w-11 items-center justify-center rounded-xl"
                      aria-label={`Diskon ${item.name}`}
                    >
                      <Percent className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingCartItem({ ...item })}
                      className="btn-lux-obsidian flex h-8 w-11 items-center justify-center rounded-xl"
                      aria-label={`Edit ${item.name}`}
                    >
                      <FileEdit className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Summary Section */}
          <div className="px-4 py-4">
            <div className="surface-card rounded-2xl p-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Produk: <span className="tabular-nums font-bold text-[#17252B] dark:text-white">{draft.items.length}</span>
                </p>
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                  Jumlah item: <span className="tabular-nums font-bold text-[#17252B] dark:text-white">{totalItemsCount}</span>
                </p>
                <div className="mt-3 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setShowExtraOptionsModal(true)}
                    className="btn-lux-obsidian flex h-9 w-12 items-center justify-center rounded-xl"
                    aria-label="Diskon Nota"
                  >
                    <Percent className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowExtraOptionsModal(true)}
                    className="btn-lux-obsidian flex h-9 w-12 items-center justify-center rounded-xl"
                    aria-label="Catatan & Biaya"
                  >
                    <ReceiptText className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="text-right">
                <p className="font-display text-lg font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                  <span className="mr-2 text-xs font-medium text-slate-500">Total</span>
                  {formatMoney(grandTotal, data.currencySymbol)}
                </p>
                {draft.discount > 0 && (
                  <p className="text-xs text-[#B54B54] tabular-nums">
                    Diskon: -{formatMoney(draft.discount, data.currencySymbol)}
                  </p>
                )}
                {shippingAmount > 0 && (
                  <p className="text-xs text-slate-500 tabular-nums">
                    Ongkir: {formatMoney(shippingAmount, data.currencySymbol)}
                  </p>
                )}
                {taxAmount > 0 && (
                  <p className="text-xs text-slate-500 tabular-nums">
                    Pajak ({data.businessFlags.taxPercent}%): {formatMoney(taxAmount, data.currencySymbol)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar: Champagne Extra Options + Wide Emerald KE PEMBAYARAN > */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E5E8E4] dark:border-[#223039] bg-white/95 dark:bg-[#151E24]/95 px-3 py-2.5 backdrop-blur-md">
          <div className="mx-auto flex max-w-4xl items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowExtraOptionsModal(true)}
              className="btn-lux-gold flex h-12 w-16 shrink-0 items-center justify-center rounded-2xl"
              aria-label="Opsi tambahan transaksi"
            >
              <MessageSquarePlus className="h-5 w-5" />
            </button>
            <button
              type="button"
              disabled={draft.items.length === 0}
              onClick={() => onNavigate('payment')}
              className="btn-lux-primary font-display flex h-12 flex-1 items-center justify-between rounded-2xl px-5 text-sm font-bold tracking-wide disabled:opacity-40"
            >
              <span className="mx-auto">KE PEMBAYARAN</span>
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Modals */}
        {showTempCustomerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Nama Pembeli Sementara</h3>
              <p className="mt-1 text-xs text-slate-500">Hanya dicetak di struk ini tanpa masuk daftar pelanggan.</p>
              <input
                type="text"
                autoFocus
                value={tempCustomerInput}
                onChange={(e) => setTempCustomerInput(e.target.value)}
                placeholder="Nama pembeli..."
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setShowTempCustomerModal(false)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((p) => ({
                      ...p,
                      customerId: null,
                      customerName: tempCustomerInput.trim() || 'Umum',
                    }));
                    setShowTempCustomerModal(false);
                  }}
                  className="btn-lux-gold flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Pakai
                </button>
              </div>
            </div>
          </div>
        )}

        {showCustomerSelectModal && (
          <CustomerSelectorModal
            customers={data.customers}
            onClose={() => setShowCustomerSelectModal(false)}
            onSelect={(cust) => {
              setDraft((prev) => ({
                ...prev,
                customerId: cust ? cust.id : null,
                customerName: cust ? cust.name : 'Umum',
              }));
              setShowCustomerSelectModal(false);
            }}
          />
        )}

        {showSaveQuickModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Simpan ke Transaksi Cepat</h3>
              <p className="mt-1 text-xs text-slate-500">Beri nama agar bisa dipanggil cepat lewat ikon sepeda.</p>
              <input
                type="text"
                autoFocus
                value={quickCartTitle}
                onChange={(e) => setQuickCartTitle(e.target.value)}
                placeholder="Contoh: Pesanan Meja 2 / Warung Bu Ani"
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setShowSaveQuickModal(false)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSaveQuickCart(quickCartTitle.trim() || `Pesanan #${data.quickCarts.length + 1}`);
                    setShowSaveQuickModal(false);
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {itemDiscountTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Diskon Item: {itemDiscountTarget.name}</h3>
              <NumericInput
                min={0}
                autoFocus
                value={itemDiscountVal}
                onValueChange={setItemDiscountVal}
                placeholder="Nominal diskon (Rp)"
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-base font-semibold tabular-nums outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setItemDiscountTarget(null)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const disc = Math.max(0, itemDiscountVal);
                    setDraft((prev) => ({
                      ...prev,
                      items: prev.items.map((it) =>
                        it.productId === itemDiscountTarget.productId ? { ...it, discount: disc } : it
                      ),
                    }));
                    setItemDiscountTarget(null);
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {editingCartItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold truncate">Edit {editingCartItem.name}</h3>
              <label className="mt-3 block text-xs font-semibold text-slate-500">Jumlah</label>
              <NumericInput
                min={1}
                allowDecimal
                value={editingCartItem.qty}
                onValueChange={(qty) => setEditingCartItem({ ...editingCartItem, qty })}
                className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-[#165B49]"
              />
              <label className="mt-3 block text-xs font-semibold text-slate-500">Harga Satuan</label>
              <NumericInput
                min={0}
                value={editingCartItem.unitPrice}
                onValueChange={(unitPrice) => setEditingCartItem({ ...editingCartItem, unitPrice })}
                className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-[#165B49]"
              />
              <label className="mt-3 block text-xs font-semibold text-slate-500">Catatan Item</label>
              <input
                type="text"
                value={editingCartItem.note}
                onChange={(e) => setEditingCartItem({ ...editingCartItem, note: e.target.value })}
                placeholder="Opsional..."
                className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setEditingCartItem(null)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({
                      ...prev,
                      items: prev.items.map((it) =>
                        it.productId === editingCartItem.productId ? editingCartItem : it
                      ),
                    }));
                    setEditingCartItem(null);
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {showExtraOptionsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-sm rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Opsi Tambahan Transaksi</h3>
              <label className="mt-3 block text-xs font-semibold text-slate-500">Diskon Nota (Rp)</label>
              <NumericInput
                min={0}
                value={draft.discount}
                onValueChange={(discount) => setDraft((p) => ({ ...p, discount }))}
                className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-[#165B49]"
              />
              {data.businessFlags.useShipping && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate-500">Ongkos Kirim (Rp)</label>
                  <NumericInput
                    min={0}
                    value={draft.shipping}
                    onValueChange={(shipping) => setDraft((p) => ({ ...p, shipping }))}
                    className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm font-semibold tabular-nums outline-none focus:border-[#165B49]"
                  />
                </>
              )}
              {data.businessFlags.useProgress && (
                <>
                  <label className="mt-3 block text-xs font-semibold text-slate-500">Status Progres Awal</label>
                  <select
                    value={draft.progressStatus}
                    onChange={(e) => setDraft((p) => ({ ...p, progressStatus: e.target.value as ProgressStatus }))}
                    className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#0E1418] px-3 py-2 text-sm"
                  >
                    <option value="antri">Antri</option>
                    <option value="proses">Proses</option>
                    <option value="selesai">Selesai</option>
                    <option value="diambil">Diambil</option>
                  </select>
                </>
              )}
              <label className="mt-3 block text-xs font-semibold text-slate-500">Catatan Struk</label>
              <textarea
                rows={2}
                value={draft.note}
                onChange={(e) => setDraft((p) => ({ ...p, note: e.target.value }))}
                placeholder="Tulis catatan yang akan dicetak di struk..."
                className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <button
                type="button"
                onClick={() => setShowExtraOptionsModal(false)}
                className="btn-lux-primary mt-4 w-full rounded-2xl py-2.5 text-sm font-semibold"
              >
                Tutup
              </button>
            </div>
          </div>
        )}
        {clearConfirmModal}
      </div>
    );
  }

  // ==============================================================
  // 3. SCREEN: PAYMENT (Pembayaran - GriyoPos Layout Preserved)
  // ==============================================================
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
      const tx = onCompleteTransaction(
        payLater ? 0 : paidInput,
        isNonCash ? 'non_tunai' : 'tunai',
        payLater
      );
      if (data.printerSettings.autoPrintAfterTx && !payLater) {
        try {
          await printThermalTransaction(
            tx,
            data.store,
            data.receiptSettings,
            data.printerSettings,
            data.currencySymbol
          );
        } catch (err) {
          notify((err as Error).message || 'Printer belum tersambung');
        }
      }
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar
          title="Pembayaran"
          mode="back"
          onLeftClick={() => onNavigate('cart')}
          rightContent={
            <button
              type="button"
              onClick={() => onNavigate('settings_receipt')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Pengaturan Struk"
            >
              <Settings className="h-5 w-5" />
            </button>
          }
        />

        <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-3 pt-3 pb-48">
          {/* Obsidian Emerald Tagihan Banner */}
          <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-[#132622] via-[#1B3731] to-[#132622] px-4 py-3.5 text-white shadow-md border border-white/10">
            <div className="flex items-center gap-2.5">
              <Banknote className="h-5 w-5 shrink-0 text-[#D5B26E]" />
              <span className="text-xs font-medium text-emerald-100/80">Total Tagihan</span>
            </div>
            <span className="font-display text-xl font-bold tabular-nums">
              {formatMoney(grandTotal, data.currencySymbol)}
            </span>
          </div>

          {/* Center Numeric Input */}
          <div className="mt-8 flex flex-col items-center">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nominal Pembayaran</span>
            <NumericInput
              min={0}
              value={paidInput}
              onValueChange={(val) => {
                setHasTappedQuickDenom(true);
                setPaidInput(val);
              }}
              className="font-display mt-1.5 w-64 border-b-2 border-[#D4DBD5] dark:border-[#2A3944] bg-transparent pb-1.5 text-center text-3xl font-bold tabular-nums text-[#17252B] dark:text-white outline-none focus:border-[#165B49]"
            />
            {diff > 0 && (
              <p className="font-display mt-3 text-base font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                Kembalian: {formatMoney(diff, data.currencySymbol)}
              </p>
            )}
            {diff < 0 && (
              <p className="font-display mt-3 text-base font-bold tabular-nums text-[#B54B54] dark:text-[#E07A82]">
                Kurang: {formatMoney(Math.abs(diff), data.currencySymbol)}
              </p>
            )}
          </div>

          {/* Toggle Non Tunai */}
          <div className="mt-6 flex justify-end px-2">
            <div className="surface-card w-56 rounded-2xl overflow-hidden">
              <SwitchRow label="Bayar Non Tunai" checked={isNonCash} onChange={setIsNonCash} />
            </div>
          </div>
        </div>

        {/* Fixed Bottom: Denomination Quick Cards + BAYAR SEKARANG / BAYAR NANTI */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#E5E8E4] dark:border-[#223039] bg-white/95 dark:bg-[#151E24]/95 px-3 pt-3 pb-3.5 backdrop-blur-md">
          <div className="mx-auto max-w-4xl">
            {/* Horizontal Quick Denomination Cards */}
            <div className="flex gap-2 overflow-x-auto pb-3 no-scrollbar">
              {denoms.map((d) => (
                <div
                  key={d.label}
                  className="flex w-[76px] shrink-0 flex-col overflow-hidden rounded-2xl border border-[#DCE1DC] dark:border-[#2A3944] shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => handleAddDenom(d.val)}
                    className="btn-lux-obsidian font-display flex h-12 items-center justify-center rounded-none border-0 text-base font-bold"
                  >
                    {d.label}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubDenom(d.val)}
                    className="btn-lux-garnet flex h-8 items-center justify-center rounded-none border-0"
                    aria-label={`Kurangi ${d.label}`}
                  >
                    <Minus className="h-4 w-4 stroke-[2.5]" />
                  </button>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2.5">
              <button
                type="button"
                onClick={() => finishTx(false)}
                className="btn-lux-primary font-display col-span-3 flex h-12 items-center justify-center gap-2 rounded-2xl px-3 text-sm font-bold"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span>BAYAR SEKARANG</span>
              </button>
              <button
                type="button"
                onClick={() => finishTx(true)}
                className="btn-lux-soft font-display col-span-2 flex h-12 items-center justify-center rounded-2xl px-3 text-sm font-bold"
              >
                BAYAR NANTI
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==============================================================
  // 4. SCREEN: RECEIPT (Struk - GriyoPos + Quick Nav Buttons Preserved)
  // ==============================================================
  const tx = lastTransaction;
  if (!tx) {
    return (
      <div className="flex min-h-screen flex-col bg-[#0E1418] text-white">
        <TopBar title="Struk" mode="back" onLeftClick={() => onNavigate('home')} />
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-slate-400">Belum ada struk aktif.</p>
        </div>
      </div>
    );
  }

  const cfg = data.receiptSettings;
  const money = (v: number) =>
    formatMoney(v, cfg.showCurrency ? data.currencySymbol : '', cfg.currencySpace, cfg.currencyRight);

  return (
    <div className="flex min-h-screen flex-col bg-[#0E1418] pb-20">
      <TopBar
        title="Struk"
        mode="back"
        onLeftClick={() => onNavigate('home')}
        rightContent={
          <>
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Ke Home"
              title="Home"
            >
              <Home className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Transaksi Baru"
              title="Transaksi Baru"
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings_store')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Edit Info Toko"
              title="Toko"
            >
              <Store className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => onNavigate('settings_printer')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Pengaturan Printer"
              title="Pengaturan"
            >
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
      />

      <div className="flex flex-1 items-center justify-center p-4">
        <div
          id="receipt-print-area"
          className={`w-full rounded-md bg-white p-6 text-slate-900 shadow-2xl ${
            cfg.paperWidth === '80' ? 'max-w-[400px]' : 'max-w-[330px]'
          }`}
        >
          {/* Store Header */}
          <div className="text-center">
            <h2 className={`${cfg.largeStoreName ? 'text-2xl' : 'text-xl'} font-semibold tracking-tight`}>
              {data.store.name}
            </h2>
            {data.store.address && <p className="mt-1 text-sm text-slate-700">{data.store.address}</p>}
            {data.store.city && <p className="text-sm text-slate-700">{data.store.city}</p>}
            {data.store.phone && <p className="text-sm text-slate-700">{data.store.phone}</p>}
          </div>

          {/* Date + #ReceiptNo */}
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

          {/* Items */}
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
                      {cfg.showUnit === 'all' ? `${cfg.unitSpace ? ' ' : ''}${item.unit}` : ''}x{' '}
                      {formatNumber(item.unitPrice)}
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

          {/* Totals */}
          {!cfg.noTotalMode && (
            <div className="space-y-1 text-sm tabular-nums">
              {tx.discount > 0 && (
                <div className="flex justify-between">
                  <span>Diskon Nota</span>
                  <span>-{money(tx.discount)}</span>
                </div>
              )}
              {tx.tax > 0 && (
                <div className="flex justify-between">
                  <span>Pajak</span>
                  <span>{money(tx.tax)}</span>
                </div>
              )}
              {tx.shipping > 0 && (
                <div className="flex justify-between">
                  <span>Ongkir</span>
                  <span>{money(tx.shipping)}</span>
                </div>
              )}
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
                  <div className="flex justify-between font-bold text-[#B54B54]">
                    <span>Status</span>
                    <span>Belum Dibayar</span>
                  </div>
                )
              )}
              {cfg.showPaidStatus && tx.paymentStatus === 'lunas' && (
                <div className="flex justify-between font-semibold text-[#165B49]">
                  <span>Status</span>
                  <span>Lunas</span>
                </div>
              )}
            </div>
          )}

          {tx.note && (
            <p className="mt-2.5 border-t border-dashed border-slate-400 pt-2 text-xs text-slate-700">
              Catatan: {tx.note}
            </p>
          )}

          {data.store.footer && (
            <p className={`mt-4 text-sm text-slate-800 ${cfg.centerFooter ? 'text-center' : 'text-left'}`}>
              {data.store.footer}
            </p>
          )}
        </div>
      </div>

      {/* Bottom 3-Button Bar: Pengaturan | Cetak | WhatsApp */}
      <div className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-3 gap-2 border-t border-[#E5E8E4] dark:border-[#223039] bg-white/95 dark:bg-[#151E24]/95 px-3 py-2 backdrop-blur-md">
        <button
          type="button"
          onClick={() => onNavigate('settings_receipt')}
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[#17252B] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2B33] active:scale-95 transition"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs font-semibold">Pengaturan</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              const mode = await printThermalTransaction(
                tx,
                data.store,
                data.receiptSettings,
                data.printerSettings,
                data.currencySymbol
              );
              notify(mode === 'native' ? 'Struk dikirim ke printer Bluetooth' : 'Membuka dialog cetak');
            } catch (e) {
              notify((e as Error).message || 'Gagal mencetak struk');
            }
          }}
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[#17252B] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1E2B33] active:scale-95 transition"
        >
          <Printer className="h-5 w-5" />
          <span className="text-xs font-semibold">Cetak</span>
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              const res = await shareReceiptWhatsApp(
                tx,
                data.store,
                data.receiptSettings,
                data.currencySymbol
              );
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
          className="flex flex-col items-center justify-center gap-1 rounded-xl py-1.5 text-[#165B49] dark:text-[#4BB89A] hover:bg-emerald-50 dark:hover:bg-[#1B2D28] active:scale-95 transition"
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
}> = ({ customers, onClose, onSelect }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
      <div className="surface-card animate-modal-in w-full max-w-sm rounded-3xl p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-bold">Pilih Pelanggan</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-[#EAECE8] dark:divide-[#223039]">
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="w-full py-3 text-left text-sm font-semibold text-[#8C6A2E] dark:text-[#D5B26E]"
          >
            Umum (Default)
          </button>
          {customers.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c)}
              className="w-full py-2.5 text-left hover:bg-[#F7F9F7] dark:hover:bg-[#1B262E] rounded-lg px-1"
            >
              <p className="text-sm font-semibold text-[#17252B] dark:text-white">{c.name}</p>
              {c.phone && <p className="text-xs text-slate-500">{c.phone}</p>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
