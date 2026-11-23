import React, { useMemo, useRef, useState } from 'react';
import {
  Search,
  ArrowDownAZ,
  MoreVertical,
  Plus,
  CreditCard,
  Banknote,
  CircleDollarSign,
  ScanBarcode,
  XCircle,
  Gift,
  RefreshCw,
  MessageSquare,
  Save,
  Trash2,
  Bike,
  ShoppingCart,
  Users,
  Phone,
  MapPin,
} from 'lucide-react';
import { AppData, Customer, Product, SavedQuickCart, ScreenId } from '../types';
import { TopBar, useBackClose } from '../components/TopBar';
import { NumericInput } from '../components/NumericInput';
import {
  exportProductsToCsv,
  formatDateShort,
  formatMoney,
  parseProductsFromCsv,
} from '../utils/storage';
import { saveExportFile } from '../utils/printer';

interface InventoryProps {
  screen: 'products' | 'product_form' | 'quick_tx' | 'customers' | 'master' | 'catalog';
  data: AppData;
  editingProduct: Product | null;
  onBackFromForm: () => void;
  onOpenDrawer: () => void;
  onNavigate: (s: ScreenId) => void;
  onEditProduct: (p: Product | null) => void;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  onLoadQuickCart: (qc: SavedQuickCart) => void;
  onQuickAddProductToCart: (p: Product) => void;
  notify: (msg: string) => void;
}

export const InventoryScreens: React.FC<InventoryProps> = ({
  screen,
  data,
  editingProduct,
  onBackFromForm,
  onOpenDrawer,
  onNavigate,
  onEditProduct,
  onUpdateData,
  onLoadQuickCart,
  onQuickAddProductToCart,
  notify,
}) => {
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [sortAsc, setSortAsc] = useState(true);
  const [showCsvMenu, setShowCsvMenu] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);

  // Product Form state
  const [formState, setFormState] = useState<Product>(() =>
    editingProduct || {
      id: '',
      name: '',
      sku: '',
      costPrice: 0,
      sellPrice: 0,
      priceEditable: false,
      barcode: '',
      stock: 0,
      unit: data.master.units[0] || 'pcs',
      category: data.master.categories[0] || 'Lainnya',
      composition: '',
      image: '',
      catalogNote: '',
      createdAt: Date.now(),
    }
  );
  const prevEditIdRef = useRef<string | null | undefined>(undefined);
  const currentEditKey = editingProduct ? editingProduct.id : 'NEW';
  if (prevEditIdRef.current !== currentEditKey && screen === 'product_form') {
    prevEditIdRef.current = currentEditKey;
    setFormState(
      editingProduct
        ? { ...editingProduct }
        : {
            id: '',
            name: '',
            sku: '',
            costPrice: 0,
            sellPrice: 0,
            priceEditable: false,
            barcode: '',
            stock: 0,
            unit: data.master.units[0] || 'pcs',
            category: data.master.categories[0] || 'Lainnya',
            composition: '',
            image: '',
            catalogNote: '',
            createdAt: Date.now(),
          }
    );
  }
  if (screen !== 'product_form') {
    prevEditIdRef.current = undefined;
  }

  // Customer modal state
  const [custModalOpen, setCustModalOpen] = useState(false);
  const [custForm, setCustForm] = useState<Customer>({ id: '', name: '', phone: '', address: '', note: '' });

  // Back button modal close hooks
  useBackClose(showCsvMenu, () => setShowCsvMenu(false));
  useBackClose(custModalOpen, () => setCustModalOpen(false));

  // Master tab state
  const [masterTab, setMasterTab] = useState<'units' | 'categories' | 'suppliers'>('units');
  const [masterInput, setMasterInput] = useState('');
  const [supPhone, setSupPhone] = useState('');

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...data.products]
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode.toLowerCase().includes(q))
      .sort((a, b) => (sortAsc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)));
  }, [data.products, search, sortAsc]);

  // =========================================================
  // 1. PRODUK LIST
  // =========================================================
  if (screen === 'products') {
    const handleExportCsv = async () => {
      const csv = exportProductsToCsv(data.products);
      const safeStore = data.store.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      try {
        const res = await saveExportFile(`produk_${safeStore}.csv`, csv, 'text/csv;charset=utf-8;');
        setShowCsvMenu(false);
        notify(res.isNative ? `Tersimpan di ${res.savedPath}` : 'Data produk diekspor ke CSV');
      } catch (err) {
        setShowCsvMenu(false);
        notify((err as Error).message || 'Gagal mengekspor CSV');
      }
    };

    const handleImportCsv = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const imported = parseProductsFromCsv(String(reader.result || ''));
        if (imported.length === 0) {
          notify('File CSV kosong atau format tidak sesuai');
          return;
        }
        onUpdateData((prev) => {
          const unitSet = new Set(prev.master.units);
          const catSet = new Set(prev.master.categories);
          imported.forEach((p) => {
            if (p.unit) unitSet.add(p.unit);
            if (p.category) catSet.add(p.category);
          });
          return {
            ...prev,
            products: imported,
            master: {
              ...prev.master,
              units: Array.from(unitSet),
              categories: Array.from(catSet),
            },
          };
        });
        notify(`${imported.length} produk diimpor (menggantikan daftar sebelumnya)`);
      };
      reader.readAsText(file);
      e.target.value = '';
      setShowCsvMenu(false);
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar
          title="Produk"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <div className="relative flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowSearch((s) => !s)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Cari produk"
              >
                <Search className="h-5 w-5" />
              </button>
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
                onClick={() => setShowCsvMenu((m) => !m)}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
                aria-label="Opsi CSV"
              >
                <MoreVertical className="h-5 w-5" />
              </button>

              {showCsvMenu && (
                <div className="surface-card animate-modal-in absolute right-1 top-12 z-50 w-56 rounded-2xl py-1.5 text-[#17252B] dark:text-slate-100 shadow-2xl">
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-[#1E2A32]"
                  >
                    Ekspor Data Produk (CSV)
                  </button>
                  <button
                    type="button"
                    onClick={() => csvInputRef.current?.click()}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium hover:bg-slate-100 dark:hover:bg-[#1E2A32]"
                  >
                    Impor Produk CSV (Ganti Semua)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowCsvMenu(false);
                      onNavigate('settings_product');
                    }}
                    className="w-full px-4 py-2.5 text-left text-sm font-medium border-t border-[#EAECE8] dark:border-[#223039] hover:bg-slate-100 dark:hover:bg-[#1E2A32]"
                  >
                    Pengaturan Field Produk
                  </button>
                </div>
              )}
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/comma-separated-values,text/plain,application/vnd.ms-excel"
                className="hidden"
                onChange={handleImportCsv}
              />
            </div>
          }
        />

        {/* Sub-header Count */}
        <div className="bg-[#18312C] px-4 py-2 text-xs font-semibold text-emerald-100/90 border-b border-white/10">
          Total Produk: <span className="tabular-nums font-bold text-white">{filteredProducts.length}</span>
        </div>

        {showSearch && (
          <div className="bg-white dark:bg-[#151E24] px-4 py-2.5 border-b border-[#E5E8E4] dark:border-[#223039]">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama, kode SKU, atau barcode..."
              className="w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
            />
          </div>
        )}

        <div className="mx-auto w-full max-w-4xl divide-y divide-[#EAECE8] dark:divide-[#223039] bg-white dark:bg-[#151E24]">
          {filteredProducts.map((p) => {
            const profit = p.sellPrice - p.costPrice;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onEditProduct(p);
                  onNavigate('product_form');
                }}
                className="flex w-full items-center justify-between px-4 py-3.5 text-left hover:bg-[#F7F9F7] dark:hover:bg-[#1B262E] transition"
              >
                <div className="min-w-0 pr-3">
                  <p className="font-display text-[16px] font-semibold text-[#17252B] dark:text-white truncate">{p.name}</p>
                  {(data.productSettings.useSku || data.productSettings.useStock) && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {data.productSettings.useSku && p.sku ? p.sku : ''}
                      {data.productSettings.useSku && p.sku && data.productSettings.useStock ? ' · ' : ''}
                      {data.productSettings.useStock ? `Stok: ${p.stock} ${p.unit || ''}` : ''}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  <p className="font-display text-[16px] font-bold text-[#165B49] dark:text-[#4BB89A]">
                    {formatMoney(p.sellPrice, data.currencySymbol)}
                  </p>
                  <p className="text-xs text-[#8C6A2E] dark:text-[#D5B26E]">
                    Laba: {formatMoney(profit, data.currencySymbol)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Luxury Emerald FAB + */}
        <button
          type="button"
          onClick={() => {
            onEditProduct(null);
            onNavigate('product_form');
          }}
          className="btn-lux-primary fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full"
          aria-label="Tambah Produk Baru"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>
    );
  }

  // =========================================================
  // 2. FORM TAMBAH / EDIT PRODUK
  // =========================================================
  if (screen === 'product_form') {
    const ps = data.productSettings;
    const profit = formState.sellPrice - formState.costPrice;

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        setFormState((s) => ({ ...s, image: String(reader.result || '') }));
      };
      reader.readAsDataURL(file);
    };

    const handleSave = () => {
      if (!formState.name.trim()) {
        notify('Nama produk wajib diisi');
        return;
      }
      if (formState.id) {
        onUpdateData((prev) => ({
          ...prev,
          products: prev.products.map((p) => (p.id === formState.id ? formState : p)),
        }));
        notify('Produk diperbarui');
      } else {
        const created: Product = {
          ...formState,
          id: `p-${Date.now()}`,
          createdAt: Date.now(),
        };
        onUpdateData((prev) => ({
          ...prev,
          products: [created, ...prev.products],
        }));
        notify('Produk ditambahkan');
      }
      onBackFromForm();
    };

    const handleDelete = () => {
      if (!formState.id) return;
      onUpdateData((prev) => ({
        ...prev,
        products: prev.products.filter((p) => p.id !== formState.id),
      }));
      notify('Produk dihapus');
      onBackFromForm();
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar
          title="Produk"
          mode="back"
          onLeftClick={onBackFromForm}
          rightContent={
            formState.id ? (
              <button
                type="button"
                onClick={handleDelete}
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 text-rose-200 active:scale-95 transition"
                aria-label="Hapus Produk"
              >
                <Trash2 className="h-5 w-5" />
              </button>
            ) : undefined
          }
        />

        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#151E24] divide-y divide-[#EAECE8] dark:divide-[#223039]">
          {/* Nama */}
          <div className="flex items-center gap-3.5 px-4 py-3.5">
            <CreditCard className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
            <input
              type="text"
              value={formState.name}
              onChange={(e) => setFormState({ ...formState, name: e.target.value })}
              placeholder="Nama"
              className="w-full bg-transparent text-[16px] font-medium outline-none placeholder:text-slate-400"
            />
          </div>

          {/* Kode Produk (SKU) */}
          {ps.useSku && (
            <div className="flex items-center gap-3.5 px-4 py-3.5">
              <CreditCard className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
              <input
                type="text"
                value={formState.sku}
                onChange={(e) => setFormState({ ...formState, sku: e.target.value })}
                placeholder="Kode Produk"
                className="w-full bg-transparent text-[16px] font-medium outline-none placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Harga Pokok */}
          <div className="flex items-center gap-3.5 px-4 py-3">
            <Banknote className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
            <div className="flex-1">
              <label className="block text-xs text-slate-500">Harga Pokok</label>
              <NumericInput
                min={0}
                value={formState.costPrice}
                onValueChange={(newCost) => {
                  setFormState((s) => ({
                    ...s,
                    costPrice: newCost,
                    sellPrice: ps.useFixedProfit ? newCost + (s.sellPrice - s.costPrice) : s.sellPrice,
                  }));
                }}
                className="w-full bg-transparent text-base font-semibold tabular-nums outline-none"
              />
            </div>
          </div>

          {/* Harga Jual + Laba (2 kolom) */}
          <div className="grid grid-cols-5">
            <div className="col-span-3 flex items-center gap-3.5 px-4 py-3">
              <Banknote className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
              <div className="flex-1">
                <label className="block text-xs text-slate-500">Harga Jual</label>
                <NumericInput
                  min={0}
                  value={formState.sellPrice}
                  onValueChange={(sellPrice) => setFormState({ ...formState, sellPrice })}
                  className="w-full bg-transparent text-base font-semibold tabular-nums outline-none"
                />
              </div>
            </div>
            <div className="col-span-2 flex items-center gap-3 bg-[#F3F5F2] dark:bg-[#1B262E] px-4 py-3">
              <CircleDollarSign className="h-5 w-5 shrink-0 text-[#8C6A2E] dark:text-[#D5B26E]" />
              <div className="min-w-0">
                <span className="block text-xs text-slate-500">Laba</span>
                <span className="font-display block text-base font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A] truncate">
                  {profit}
                </span>
              </div>
            </div>
          </div>

          {/* Checkbox Harga bisa diganti */}
          <label className="flex items-center gap-3.5 px-4 py-3.5 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.priceEditable}
              onChange={(e) => setFormState({ ...formState, priceEditable: e.target.checked })}
              className="h-5 w-5 rounded border-slate-400 accent-[#165B49]"
            />
            <span className="text-[15px] text-[#17252B] dark:text-slate-200">
              Harga bisa diganti ketika transaksi
            </span>
          </label>

          {/* Barcode */}
          {ps.useBarcode && (
            <div className="flex items-center gap-2.5 px-4 py-3">
              <ScanBarcode className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
              <input
                type="text"
                value={formState.barcode}
                onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
                placeholder="Barcode"
                className="flex-1 bg-transparent text-base outline-none placeholder:text-slate-400"
              />
              {formState.barcode && (
                <button
                  type="button"
                  onClick={() => setFormState({ ...formState, barcode: '' })}
                  className="text-slate-400 hover:text-slate-600"
                  aria-label="Hapus barcode"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              )}
              <button
                type="button"
                onClick={() =>
                  setFormState({
                    ...formState,
                    barcode: String(Math.floor(8990000000000 + Math.random() * 999999999)),
                  })
                }
                className="btn-lux-obsidian flex h-10 w-12 items-center justify-center rounded-xl"
                title="Generate / Scan Barcode"
              >
                <ScanBarcode className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Stok, Satuan, Kategori */}
          {ps.useStock && (
            <div className="flex items-center gap-3.5 px-4 py-3">
              <div className="w-5 shrink-0 text-center text-xs font-bold text-[#165B49] dark:text-[#4BB89A]">STK</div>
              <div className="flex-1">
                <label className="block text-xs text-slate-500">Stok Tersedia</label>
                <NumericInput
                  min={0}
                  allowDecimal
                  value={formState.stock}
                  onValueChange={(stock) => setFormState({ ...formState, stock })}
                  className="w-full bg-transparent text-base font-semibold tabular-nums outline-none"
                />
              </div>
            </div>
          )}

          {ps.useUnit && (
            <div className="flex items-center gap-3.5 px-4 py-3">
              <span className="text-xs font-bold text-[#165B49] dark:text-[#4BB89A]">SAT</span>
              <select
                value={formState.unit}
                onChange={(e) => setFormState({ ...formState, unit: e.target.value })}
                className="flex-1 bg-transparent text-base outline-none dark:bg-[#151E24]"
              >
                {data.master.units.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          )}

          {ps.useCategory && (
            <div className="flex items-center gap-3.5 px-4 py-3">
              <span className="text-xs font-bold text-[#165B49] dark:text-[#4BB89A]">GRP</span>
              <select
                value={formState.category}
                onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                className="flex-1 bg-transparent text-base outline-none dark:bg-[#151E24]"
              >
                {data.master.categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          )}

          {ps.useIngredients && (
            <div className="flex items-center gap-3.5 px-4 py-3">
              <span className="text-xs font-bold text-[#165B49] dark:text-[#4BB89A]">BHN</span>
              <input
                type="text"
                value={formState.composition}
                onChange={(e) => setFormState({ ...formState, composition: e.target.value })}
                placeholder="Bahan baku / komposisi"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Gambar Produk */}
          <div className="flex flex-col items-center py-5 px-4">
            <span className="font-display text-sm font-bold text-[#17252B] dark:text-slate-200">Gambar Produk</span>
            <div className="mt-3 flex h-32 w-32 items-center justify-center overflow-hidden rounded-2xl border border-[#DCE1DC] dark:border-[#2A3944] bg-[#F5F6F4] dark:bg-[#0E1418]">
              {formState.image ? (
                <img src={formState.image} alt={formState.name} className="h-full w-full object-cover" />
              ) : (
                <Gift className="h-9 w-9 text-slate-400" />
              )}
            </div>
            <div className="mt-3 flex items-center gap-2.5">
              <label className="btn-lux-obsidian flex h-9 w-14 cursor-pointer items-center justify-center rounded-xl">
                <RefreshCw className="h-4 w-4" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              <button
                type="button"
                onClick={() => setFormState({ ...formState, image: '' })}
                className="btn-lux-garnet flex h-9 w-14 items-center justify-center rounded-xl"
                aria-label="Hapus gambar"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Keterangan untuk katalog */}
          <div className="flex items-center gap-3.5 px-4 py-4">
            <MessageSquare className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
            <input
              type="text"
              value={formState.catalogNote}
              onChange={(e) => setFormState({ ...formState, catalogNote: e.target.value })}
              placeholder="Keterangan untuk katalog"
              className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
            />
          </div>
        </div>

        {/* Sticky Bottom SIMPAN */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#151E24]/95 p-3 border-t border-[#E5E8E4] dark:border-[#223039] backdrop-blur-md">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={handleSave}
              className="btn-lux-primary font-display flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold tracking-wide"
            >
              <Save className="h-5 w-5" />
              <span>SIMPAN</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. TRANSAKSI CEPAT
  // =========================================================
  if (screen === 'quick_tx') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar
          title="Transaksi Cepat"
          mode="menu"
          onLeftClick={onOpenDrawer}
          rightContent={
            <button
              type="button"
              onClick={() => onNavigate('pos')}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 hover:bg-white/15 active:scale-95 transition"
              aria-label="Ke Kasir"
            >
              <ShoppingCart className="h-5 w-5" />
            </button>
          }
        />

        <div className="mx-auto w-full max-w-4xl flex-1 p-4">
          {data.quickCarts.length === 0 ? (
            <div className="mt-16 flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#165B49]/10 text-[#165B49] dark:bg-[#165B49]/20 dark:text-[#4BB89A]">
                <Bike className="h-8 w-8" />
              </div>
              <p className="font-display mt-4 text-base font-semibold">Belum ada Transaksi Cepat tersimpan</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Pilih produk di Transaksi Baru → buka keranjang → ketuk ikon Disket di kanan atas untuk menyimpan paket/pesanan cepat.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('pos')}
                className="btn-lux-primary mt-5 rounded-2xl px-5 py-2.5 text-sm font-semibold"
              >
                Buka Transaksi Baru
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {data.quickCarts.map((qc) => {
                const total = qc.items.reduce((a, b) => a + b.unitPrice * b.qty - b.discount, 0);
                return (
                  <div
                    key={qc.id}
                    className="surface-card flex items-center justify-between rounded-2xl p-4"
                  >
                    <button
                      type="button"
                      onClick={() => onLoadQuickCart(qc)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="font-display text-base font-bold text-[#17252B] dark:text-white truncate">{qc.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500 truncate">
                        {qc.items.map((i) => `${i.name} (${i.qty})`).join(', ')}
                      </p>
                      <p className="mt-1 text-sm font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                        {formatMoney(total, data.currencySymbol)} · {formatDateShort(qc.updatedAt)}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateData((prev) => ({
                          ...prev,
                          quickCarts: prev.quickCarts.filter((q) => q.id !== qc.id),
                        }))
                      }
                      className="ml-2 flex h-10 w-10 items-center justify-center rounded-xl text-[#B54B54] hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      aria-label="Hapus"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================
  // 4. PELANGGAN
  // =========================================================
  if (screen === 'customers') {
    const getCustomerDebt = (cid: string) =>
      data.transactions
        .filter((t) => t.customerId === cid && t.paymentStatus !== 'lunas')
        .reduce((acc, t) => acc + Math.max(0, t.total - t.paidAmount), 0);

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar title="Pelanggan" mode="menu" onLeftClick={onOpenDrawer} />
        <div className="mx-auto w-full max-w-4xl divide-y divide-[#EAECE8] dark:divide-[#223039] bg-white dark:bg-[#151E24]">
          {data.customers.map((c) => {
            const debt = getCustomerDebt(c.id);
            return (
              <div key={c.id} className="flex items-center justify-between px-4 py-3.5">
                <button
                  type="button"
                  onClick={() => {
                    setCustForm(c);
                    setCustModalOpen(true);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="font-display text-base font-bold text-[#17252B] dark:text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-[#165B49] dark:text-[#4BB89A]" />
                    {c.name}
                  </p>
                  {c.phone && (
                    <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="h-3 w-3" /> {c.phone}
                    </p>
                  )}
                  {c.address && (
                    <p className="mt-0.5 text-xs text-slate-500 flex items-center gap-1.5 truncate">
                      <MapPin className="h-3 w-3 shrink-0" /> {c.address}
                    </p>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  {debt > 0 && (
                    <span className="text-xs font-bold tabular-nums text-[#B54B54]">
                      Piutang: {formatMoney(debt, data.currencySymbol)}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateData((prev) => ({
                        ...prev,
                        customers: prev.customers.filter((x) => x.id !== c.id),
                      }))
                    }
                    className="p-2 text-[#B54B54]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            setCustForm({ id: '', name: '', phone: '', address: '', note: '' });
            setCustModalOpen(true);
          }}
          className="btn-lux-primary fixed bottom-6 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full"
          aria-label="Tambah Pelanggan"
        >
          <Plus className="h-7 w-7" />
        </button>

        {custModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-sm rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">{custForm.id ? 'Edit Pelanggan' : 'Tambah Pelanggan'}</h3>
              <input
                type="text"
                value={custForm.name}
                onChange={(e) => setCustForm({ ...custForm, name: e.target.value })}
                placeholder="Nama pelanggan"
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <input
                type="text"
                value={custForm.phone}
                onChange={(e) => setCustForm({ ...custForm, phone: e.target.value })}
                placeholder="No. WhatsApp / Telepon"
                className="mt-2.5 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <input
                type="text"
                value={custForm.address}
                onChange={(e) => setCustForm({ ...custForm, address: e.target.value })}
                placeholder="Alamat"
                className="mt-2.5 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setCustModalOpen(false)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!custForm.name.trim()) return;
                    onUpdateData((prev) => ({
                      ...prev,
                      customers: custForm.id
                        ? prev.customers.map((x) => (x.id === custForm.id ? custForm : x))
                        : [...prev.customers, { ...custForm, id: `cust-${Date.now()}` }],
                    }));
                    setCustModalOpen(false);
                    notify('Pelanggan disimpan');
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-semibold"
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
  // 5. MASTER (Satuan, Kategori, Supplier)
  // =========================================================
  if (screen === 'master') {
    const addMasterItem = () => {
      const v = masterInput.trim();
      if (!v) return;
      onUpdateData((prev) => {
        if (masterTab === 'units') {
          return { ...prev, master: { ...prev.master, units: [...prev.master.units, v] } };
        }
        if (masterTab === 'categories') {
          return { ...prev, master: { ...prev.master, categories: [...prev.master.categories, v] } };
        }
        return {
          ...prev,
          master: {
            ...prev.master,
            suppliers: [...prev.master.suppliers, { id: `sup-${Date.now()}`, name: v, phone: supPhone, debt: 0 }],
          },
        };
      });
      setMasterInput('');
      setSupPhone('');
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar title="Master Data" mode="menu" onLeftClick={onOpenDrawer} />
        <div className="mx-auto w-full max-w-4xl p-4">
          <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#E6EAE5] dark:bg-[#1A242B] p-1">
            {(['units', 'categories', 'suppliers'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setMasterTab(tab)}
                className={`rounded-xl py-2 text-xs font-bold transition ${
                  masterTab === tab ? 'btn-lux-primary' : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                {tab === 'units' ? 'Satuan' : tab === 'categories' ? 'Kategori' : 'Supplier'}
              </button>
            ))}
          </div>

          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={masterInput}
              onChange={(e) => setMasterInput(e.target.value)}
              placeholder={masterTab === 'units' ? 'Tambah satuan (misal: dus)' : masterTab === 'categories' ? 'Tambah kategori...' : 'Nama supplier...'}
              className="flex-1 rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#151E24] px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
            />
            {masterTab === 'suppliers' && (
              <input
                type="text"
                value={supPhone}
                onChange={(e) => setSupPhone(e.target.value)}
                placeholder="No. Telp"
                className="w-32 rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#151E24] px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
              />
            )}
            <button
              type="button"
              onClick={addMasterItem}
              className="btn-lux-gold rounded-xl px-4 text-sm font-bold"
            >
              Tambah
            </button>
          </div>

          <div className="surface-card mt-4 divide-y divide-[#EAECE8] dark:divide-[#223039] rounded-2xl">
            {masterTab === 'units' &&
              data.master.units.map((u) => (
                <div key={u} className="flex items-center justify-between px-4 py-3 text-sm font-medium">
                  <span>{u}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateData((p) => ({ ...p, master: { ...p.master, units: p.master.units.filter((x) => x !== u) } }))
                    }
                    className="text-[#B54B54]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            {masterTab === 'categories' &&
              data.master.categories.map((c) => (
                <div key={c} className="flex items-center justify-between px-4 py-3 text-sm font-medium">
                  <span>{c}</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateData((p) => ({
                        ...p,
                        master: { ...p.master, categories: p.master.categories.filter((x) => x !== c) },
                      }))
                    }
                    className="text-[#B54B54]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            {masterTab === 'suppliers' &&
              data.master.suppliers.map((s) => (
                <div key={s.id} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-bold">{s.name}</p>
                    {s.phone && <p className="text-xs text-slate-500">{s.phone}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateData((p) => ({
                        ...p,
                        master: { ...p.master, suppliers: p.master.suppliers.filter((x) => x.id !== s.id) },
                      }))
                    }
                    className="text-[#B54B54]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 6. KATALOG PRODUK
  // =========================================================
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
      <TopBar title="Katalog" mode="menu" onLeftClick={onOpenDrawer} />
      <div className="mx-auto grid w-full max-w-4xl grid-cols-2 gap-3 p-4 sm:grid-cols-3">
        {data.products.map((p) => (
          <div
            key={p.id}
            className="surface-card flex flex-col overflow-hidden rounded-2xl"
          >
            <div className="flex h-32 items-center justify-center bg-[#EEF1ED] dark:bg-[#1B262E]">
              {p.image ? (
                <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <Gift className="h-9 w-9 text-slate-400" />
              )}
            </div>
            <div className="flex flex-1 flex-col p-3">
              <p className="font-display text-sm font-bold text-[#17252B] dark:text-white line-clamp-2">{p.name}</p>
              {p.catalogNote && <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{p.catalogNote}</p>}
              <p className="font-display mt-auto pt-2 text-base font-bold tabular-nums text-[#165B49] dark:text-[#4BB89A]">
                {formatMoney(p.sellPrice, data.currencySymbol)}
              </p>
              <button
                type="button"
                onClick={() => onQuickAddProductToCart(p)}
                className="btn-lux-primary mt-2 w-full rounded-xl py-2 text-xs font-semibold"
              >
                + Tambah ke Kasir
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
