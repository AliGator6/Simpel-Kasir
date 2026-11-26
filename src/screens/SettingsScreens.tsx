import React, { useState } from 'react';
import {
  Lamp,
  Banknote,
  ReceiptText,
  CircleDollarSign,
  CalendarClock,
  Percent,
  HelpCircle,
  FileText,
  Printer,
  Database,
  Lock,
  LockOpen,
  Trash2,
  Moon,
  Save,
  RefreshCw,
  CheckCircle2,
  UserPlus,
  Store,
  ShieldCheck,
  KeyRound,
  Smartphone,
} from 'lucide-react';
import { AppData, ScreenId } from '../types';
import { TopBar, SwitchRow, useBackClose } from '../components/TopBar';
import { NumericInput } from '../components/NumericInput';
import { DEFAULT_APP_DATA } from '../utils/storage';
import { LicenseEvaluation } from '../utils/license';
import {
  PairedDevice,
  runTestPrint,
  scanPairedBluetoothPrinters,
  testBluetoothPrinterConnection,
} from '../utils/printer';

interface SettingsProps {
  screen:
    | 'settings'
    | 'settings_business'
    | 'settings_product'
    | 'settings_receipt'
    | 'settings_printer'
    | 'settings_users'
    | 'settings_store';
  data: AppData;
  isOwnerLoggedIn: boolean;
  deviceId: string;
  licenseEvaluation: LicenseEvaluation;
  onOpenActivation: () => void;
  onOpenVendorGenerator: () => void;
  onOpenOwnerAuth: () => void;
  onOpenDrawer: () => void;
  onBack: () => void;
  onNavigate: (s: ScreenId) => void;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  notify: (msg: string) => void;
}

export const SettingsScreens: React.FC<SettingsProps> = ({
  screen,
  data,
  isOwnerLoggedIn,
  deviceId,
  licenseEvaluation,
  onOpenActivation,
  onOpenVendorGenerator,
  onOpenOwnerAuth,
  onOpenDrawer,
  onBack,
  onNavigate,
  onUpdateData,
  notify,
}) => {
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [scanningPrinter, setScanningPrinter] = useState(false);
  const [connectingAddr, setConnectingAddr] = useState<string | null>(null);
  const [testingPrint, setTestingPrint] = useState(false);

  const [storeForm, setStoreForm] = useState(data.store);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Admin' | 'Kasir'>('Kasir');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyInput, setCurrencyInput] = useState(data.currencySymbol);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxInput, setTaxInput] = useState(data.businessFlags.taxPercent);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [versionTapCount, setVersionTapCount] = useState(0);

  // Back button modal close hooks
  useBackClose(showCurrencyModal, () => setShowCurrencyModal(false));
  useBackClose(showTaxModal, () => setShowTaxModal(false));
  useBackClose(showResetConfirm, () => setShowResetConfirm(false));

  // =========================================================
  // 1. HUB PENGATURAN (GriyoPos 3-Column Grid Layout)
  // =========================================================
  if (screen === 'settings') {

    const gridButtons: {
      label: string;
      icon: React.ReactNode;
      tone: 'obsidian' | 'emerald' | 'gold' | 'garnet' | 'flag';
      onClick: () => void;
    }[] = [
      {
        label: 'Produk',
        icon: <Lamp className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => onNavigate('settings_product'),
      },
      {
        label: 'Transaksi',
        icon: <Banknote className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => onNavigate('settings_business'),
      },
      {
        label: 'Pembayaran',
        icon: <ReceiptText className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => onNavigate('settings_receipt'),
      },
      {
        label: 'Mata Uang',
        icon: <CircleDollarSign className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => {
          setCurrencyInput(data.currencySymbol);
          setShowCurrencyModal(true);
        },
      },
      {
        label: 'Bahasa',
        icon: (
          <div className="h-7 w-9 overflow-hidden rounded-sm border border-slate-300 shadow-xs">
            <div className="h-1/2 bg-[#B54B54]" />
            <div className="h-1/2 bg-white" />
          </div>
        ),
        tone: 'flag',
        onClick: () => notify('Bahasa aktif: Indonesia'),
      },
      {
        label: 'Toko',
        icon: <CalendarClock className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => {
          setStoreForm(data.store);
          onNavigate('settings_store');
        },
      },
      {
        label: 'Pajak',
        icon: <Percent className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => {
          setTaxInput(data.businessFlags.taxPercent);
          setShowTaxModal(true);
        },
      },
      {
        label: 'Jenis Usaha',
        icon: <HelpCircle className="h-6 w-6" />,
        tone: 'gold',
        onClick: () => onNavigate('settings_business'),
      },
      {
        label: 'Struk',
        icon: <FileText className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () => onNavigate('settings_receipt'),
      },
      {
        label: 'Printer',
        icon: <Printer className="h-6 w-6" />,
        tone: 'emerald',
        onClick: () => onNavigate('settings_printer'),
      },
      {
        label: 'Backup & Sinkron',
        icon: <Database className="h-6 w-6" />,
        tone: 'emerald',
        onClick: () => onNavigate('sync'),
      },
      {
        label: 'Login Pemilik',
        icon: isOwnerLoggedIn ? <LockOpen className="h-6 w-6" /> : <Lock className="h-6 w-6" />,
        tone: 'emerald',
        onClick: () => onNavigate('settings_users'),
      },
      {
        label: 'Hapus Data',
        icon: <Trash2 className="h-6 w-6" />,
        tone: 'garnet',
        onClick: () => setShowResetConfirm(true),
      },
      {
        label: data.darkMode ? 'Mode Terang' : 'Mode Gelap',
        icon: <Moon className="h-6 w-6" />,
        tone: 'obsidian',
        onClick: () =>
          onUpdateData((prev) => ({
            ...prev,
            darkMode: !prev.darkMode,
          })),
      },
    ];

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar title="Pengaturan" mode="menu" onLeftClick={onOpenDrawer} />
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                const next = versionTapCount + 1;
                if (next >= 7) {
                  setVersionTapCount(0);
                  onOpenVendorGenerator();
                } else {
                  setVersionTapCount(next);
                  if (next >= 5) {
                    notify(`${7 - next} ketukan lagi untuk Generator Lisensi`);
                  }
                }
              }}
              className="px-3 py-1 text-center text-xs font-medium text-slate-500 dark:text-slate-400 active:opacity-70"
            >
              SimpelKasir · v{data.version}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-y-6 gap-x-3">
            {gridButtons.map((btn) => {
              const circleBg =
                btn.tone === 'emerald'
                  ? 'btn-lux-primary'
                  : btn.tone === 'gold'
                  ? 'btn-lux-gold'
                  : btn.tone === 'garnet'
                  ? 'btn-lux-garnet'
                  : btn.tone === 'flag'
                  ? 'btn-lux-soft'
                  : 'btn-lux-obsidian';
              const labelColor =
                btn.tone === 'emerald'
                  ? 'text-[#165B49] dark:text-[#4BB89A]'
                  : btn.tone === 'gold'
                  ? 'text-[#8C6A2E] dark:text-[#D5B26E]'
                  : btn.tone === 'garnet'
                  ? 'text-[#B54B54] dark:text-[#E07A82]'
                  : 'text-[#17252B] dark:text-slate-200';
              return (
                <button
                  key={btn.label}
                  type="button"
                  onClick={btn.onClick}
                  className="flex flex-col items-center gap-2 group"
                >
                  <span
                    className={`flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-slate-900/5 dark:ring-white/5 ${circleBg}`}
                  >
                    {btn.icon}
                  </span>
                  <span className={`font-display text-center text-xs font-semibold leading-tight ${labelColor}`}>
                    {btn.label}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Status Lisensi & Aktivasi Perangkat */}
          <div className="surface-card mt-7 rounded-2xl p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/12 text-[#165B49] dark:text-[#4BB89A]">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-display text-sm font-bold text-[#17252B] dark:text-white">
                    {licenseEvaluation.headline}
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {licenseEvaluation.detail}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 font-mono text-xs font-bold text-[#165B49] dark:text-[#4BB89A] tabular-nums">
                    <Smartphone className="h-3.5 w-3.5 shrink-0" />
                    <span>ID: {deviceId}</span>
                  </p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onOpenActivation}
              className="btn-lux-primary flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
            >
              <KeyRound className="h-4 w-4" />
              <span>
                {licenseEvaluation.status === 'licensed_permanent'
                  ? 'Lihat Info Lisensi & ID Perangkat'
                  : 'Masukkan Kode Aktivasi'}
              </span>
            </button>
          </div>
        </div>

        {showCurrencyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Simbol Mata Uang</h3>
              <input
                type="text"
                value={currencyInput}
                onChange={(e) => setCurrencyInput(e.target.value)}
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm font-bold outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setShowCurrencyModal(false)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateData((p) => ({ ...p, currencySymbol: currencyInput.trim() || 'Rp' }));
                    setShowCurrencyModal(false);
                    notify('Mata uang diperbarui');
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-bold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {showTaxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold">Persentase Pajak (%)</h3>
              <NumericInput
                min={0}
                allowDecimal
                value={taxInput}
                onValueChange={setTaxInput}
                className="mt-3 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-base font-bold tabular-nums outline-none focus:border-[#165B49]"
              />
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setShowTaxModal(false)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateData((p) => ({
                      ...p,
                      businessFlags: { ...p.businessFlags, taxPercent: Math.max(0, taxInput) },
                    }));
                    setShowTaxModal(false);
                    notify('Pajak diperbarui');
                  }}
                  className="btn-lux-primary flex-1 rounded-xl py-2.5 text-sm font-bold"
                >
                  Simpan
                </button>
              </div>
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/55 backdrop-blur-xs p-4">
            <div className="surface-card animate-modal-in w-full max-w-xs rounded-3xl p-5 shadow-2xl">
              <h3 className="font-display text-base font-bold text-[#B54B54]">Hapus Semua Data?</h3>
              <p className="mt-1.5 text-xs text-slate-500">
                Semua transaksi, arus kas, dan pengaturan akan dikembalikan ke setelan awal Toko Cahaya.
              </p>
              <div className="mt-4 flex gap-2.5">
                <button type="button" onClick={() => setShowResetConfirm(false)} className="btn-lux-soft flex-1 rounded-xl py-2.5 text-sm font-semibold">Batal</button>
                <button
                  type="button"
                  onClick={() => {
                    onUpdateData(() => DEFAULT_APP_DATA);
                    setShowResetConfirm(false);
                    notify('Data direset ke setelan awal');
                  }}
                  className="btn-lux-garnet flex-1 rounded-xl py-2.5 text-sm font-bold"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================
  // 2. JENIS USAHA ANDA
  // =========================================================
  if (screen === 'settings_business') {
    const bf = data.businessFlags;
    const setBf = (patch: Partial<typeof bf>) =>
      onUpdateData((prev) => ({
        ...prev,
        businessFlags: { ...prev.businessFlags, ...patch },
        productSettings: {
          ...prev.productSettings,
          useStock: patch.useStock ?? prev.productSettings.useStock,
          useIngredients: patch.useIngredients ?? prev.productSettings.useIngredients,
          useBarcode: patch.useBarcode ?? prev.productSettings.useBarcode,
        },
      }));

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar title="Pengaturan Transaksi" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl flex-1 bg-white dark:bg-[#151E24]">
          <h2 className="font-display border-b border-[#EAECE8] dark:border-[#223039] py-5 text-center text-xl font-bold">
            Transaksi & Jenis Usaha
          </h2>
          <SwitchRow label="Gunakan stok" checked={bf.useStock} onChange={(v) => setBf({ useStock: v })} />
          <SwitchRow label="Gunakan bahan baku/komposisi" checked={bf.useIngredients} onChange={(v) => setBf({ useIngredients: v })} />
          <SwitchRow label="Gunakan barcode" checked={bf.useBarcode} onChange={(v) => setBf({ useBarcode: v })} />
          <SwitchRow label="Aktifkan pajak" checked={bf.useTax} onChange={(v) => setBf({ useTax: v })} />
          <SwitchRow label="Gunakan alur progres" checked={bf.useProgress} onChange={(v) => setBf({ useProgress: v })} />
          <SwitchRow label="Gunakan ongkos kirim" checked={bf.useShipping} onChange={(v) => setBf({ useShipping: v })} />
          <SwitchRow
            label="Tampilkan tambah produk saat transaksi"
            sublabel="Menampilkan tombol tambah produk di sebelah kanan barcode pada layar Transaksi Baru"
            checked={bf.showQuickAddProductInPos ?? true}
            onChange={(v) => setBf({ showQuickAddProductInPos: v })}
          />
          <p className="px-4 py-4 text-xs text-slate-500">
            Anda masih bisa mengubah opsi di atas kapan saja melalui menu Pengaturan.
          </p>
          <div className="flex justify-center pb-8 pt-2">
            <button
              type="button"
              onClick={() => {
                notify('Konfigurasi jenis usaha disimpan');
                onBack();
              }}
              className="btn-lux-primary font-display inline-flex items-center gap-2 rounded-2xl px-8 py-3 text-sm font-bold"
            >
              <Save className="h-4 w-4" /> SIMPAN
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 3. PENGATURAN PRODUK
  // =========================================================
  if (screen === 'settings_product') {
    const ps = data.productSettings;
    const setPs = (patch: Partial<typeof ps>) =>
      onUpdateData((prev) => ({
        ...prev,
        productSettings: { ...prev.productSettings, ...patch },
      }));

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar title="Produk" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#151E24]">
          <SwitchRow label="Gunakan kode produk (SKU)" checked={ps.useSku} onChange={(v) => setPs({ useSku: v })} />
          <SwitchRow label="Gunakan barcode" checked={ps.useBarcode} onChange={(v) => setPs({ useBarcode: v })} />
          {ps.useBarcode && (
            <SwitchRow
              indented
              label="Gunakan kamera depan"
              sublabel="Tips: tekan lama tombol scan untuk mengaktifkan/nonaktifkan flash"
              checked={ps.useFrontCamera}
              onChange={(v) => setPs({ useFrontCamera: v })}
            />
          )}
          <SwitchRow label="Gunakan satuan" checked={ps.useUnit} onChange={(v) => setPs({ useUnit: v })} />
          <SwitchRow label="Gunakan grup produk" checked={ps.useCategory} onChange={(v) => setPs({ useCategory: v })} />
          <SwitchRow label="Gunakan stok" checked={ps.useStock} onChange={(v) => setPs({ useStock: v })} />
          <SwitchRow label="Gunakan bahan baku/komposisi" checked={ps.useIngredients} onChange={(v) => setPs({ useIngredients: v })} />
          <SwitchRow label="Gunakan laba tetap" checked={ps.useFixedProfit} onChange={(v) => setPs({ useFixedProfit: v })} />
          <SwitchRow label="Gunakan mode pencarian ketat" checked={ps.strictSearch} onChange={(v) => setPs({ strictSearch: v })} />
          <SwitchRow label="Set catatan item ketika memilih Harga Lain" checked={ps.autoNoteAltPrice} onChange={(v) => setPs({ autoNoteAltPrice: v })} />
        </div>
      </div>
    );
  }

  // =========================================================
  // 4. PENGATURAN STRUK
  // =========================================================
  if (screen === 'settings_receipt') {
    const rs = data.receiptSettings;
    const setRs = (patch: Partial<typeof rs>) =>
      onUpdateData((prev) => ({
        ...prev,
        receiptSettings: { ...prev.receiptSettings, ...patch },
      }));

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-10">
        <TopBar title="Pengaturan Struk" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#151E24]">
          {/* Paper size */}
          <div className="border-b border-[#EAECE8] dark:border-[#223039] px-4 py-3.5">
            <p className="text-sm font-semibold">Kertas Printer/WhatsApp</p>
            <div className="mt-2.5 flex gap-6">
              {(['58', '80'] as const).map((w) => (
                <label key={w} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={rs.paperWidth === w}
                    onChange={() => setRs({ paperWidth: w })}
                    className="accent-[#165B49] h-4 w-4"
                  />
                  <span>{w} mm</span>
                </label>
              ))}
            </div>
          </div>

          {/* Unit */}
          <div className="border-b border-[#EAECE8] dark:border-[#223039] px-4 py-3.5">
            <p className="text-sm font-semibold">Tampilkan satuan (kg, pcs)</p>
            <div className="mt-2.5 flex gap-5">
              {(
                [
                  { id: 'none', l: 'Tidak' },
                  { id: 'decimal', l: 'Desimal' },
                  { id: 'all', l: 'Semua' },
                ] as const
              ).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={rs.showUnit === u.id}
                    onChange={() => setRs({ showUnit: u.id })}
                    className="accent-[#165B49] h-4 w-4"
                  />
                  <span>{u.l}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ID mode */}
          <div className="border-b border-[#EAECE8] dark:border-[#223039] px-4 py-3.5">
            <p className="text-sm font-semibold">Tampilkan id/kode transaksi</p>
            <div className="mt-2.5 flex flex-wrap gap-4">
              {(
                [
                  { id: 'id', l: 'ID' },
                  { id: 'code', l: 'Kode' },
                  { id: 'both', l: 'Keduanya' },
                  { id: 'none', l: 'Tidak ada' },
                ] as const
              ).map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={rs.showTxIdMode === m.id}
                    onChange={() => setRs({ showTxIdMode: m.id })}
                    className="accent-[#165B49] h-4 w-4"
                  />
                  <span>{m.l}</span>
                </label>
              ))}
            </div>
          </div>

          <SwitchRow label="Tampilkan nomor urut item" checked={rs.showItemIndex} onChange={(v) => setRs({ showItemIndex: v })} />
          <SwitchRow label="Tampilkan kasir" checked={rs.showCashier} onChange={(v) => setRs({ showCashier: v })} />
          <SwitchRow label='Tampilkan status "Lunas"' checked={rs.showPaidStatus} onChange={(v) => setRs({ showPaidStatus: v })} />
          <SwitchRow label='Tampilkan status "Belum Dibayar"' checked={rs.showUnpaidStatus} onChange={(v) => setRs({ showUnpaidStatus: v })} />
          <SwitchRow label="Tampilkan alur progres" checked={rs.showProgress} onChange={(v) => setRs({ showProgress: v })} />
          <SwitchRow label="Tampilkan mata uang" checked={rs.showCurrency} onChange={(v) => setRs({ showCurrency: v })} />
          <SwitchRow label="Mata uang di sebelah kanan" checked={rs.currencyRight} onChange={(v) => setRs({ currencyRight: v })} />
          <SwitchRow label="Spasi di mata uang" checked={rs.currencySpace} onChange={(v) => setRs({ currencySpace: v })} />
          <SwitchRow label="Footer diset tengah" checked={rs.centerFooter} onChange={(v) => setRs({ centerFooter: v })} />
          <SwitchRow label="Teks Nama Usaha diperbesar" checked={rs.largeStoreName} onChange={(v) => setRs({ largeStoreName: v })} />
          <SwitchRow label="Teks Pelanggan diperbesar" checked={rs.largeCustomer} onChange={(v) => setRs({ largeCustomer: v })} />
          <SwitchRow label="Teks Nama item diperbesar" checked={rs.largeItemName} onChange={(v) => setRs({ largeItemName: v })} />
          <SwitchRow label="Teks Total diperbesar" checked={rs.largeTotal} onChange={(v) => setRs({ largeTotal: v })} />
          <SwitchRow label="Gunakan cetak tanpa total" checked={rs.noTotalMode} onChange={(v) => setRs({ noTotalMode: v })} />
        </div>
      </div>
    );
  }

  // =========================================================
  // 5. PENGATURAN PRINTER BLUETOOTH
  // =========================================================
  if (screen === 'settings_printer') {
    const pr = data.printerSettings;
    const setPr = (patch: Partial<typeof pr>) =>
      onUpdateData((prev) => ({
        ...prev,
        printerSettings: { ...prev.printerSettings, ...patch },
      }));

    const handleScanPrinters = async () => {
      setScanningPrinter(true);
      notify('Mencari printer Bluetooth sekitar... (pastikan printer menyala)');
      try {
        const list = await scanPairedBluetoothPrinters();
        setPairedDevices(list);
        if (list.length === 0) {
          notify('Tidak ada printer Bluetooth ditemukan. Pastikan printer menyala & Bluetooth HP aktif.');
        } else {
          notify(`Ditemukan ${list.length} perangkat Bluetooth`);
        }
      } catch (err) {
        notify((err as Error).message || 'Gagal mencari printer Bluetooth');
      } finally {
        setScanningPrinter(false);
      }
    };

    const handleSelectAndTestDevice = async (dev: PairedDevice) => {
      setPr({ selectedPrinterName: dev.name, selectedPrinterAddress: dev.address });
      setConnectingAddr(dev.address);
      try {
        await testBluetoothPrinterConnection(dev.address);
        notify(`Printer ${dev.name} tersambung & siap cetak!`);
      } catch (err) {
        notify((err as Error).message || `Printer ${dev.name} disimpan, namun belum bisa tersambung`);
      } finally {
        setConnectingAddr(null);
      }
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-24">
        <TopBar title="Printer" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#151E24]">
          {/* Connection Type */}
          <div className="px-4 pt-4 pb-3 border-b border-[#EAECE8] dark:border-[#223039]">
            <p className="text-sm font-semibold">Printer POS Thermal</p>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              {(
                [
                  { id: 'bluetooth', l: 'Bluetooth' },
                  { id: 'usb', l: 'USB' },
                ] as const
              ).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPr({ connectionType: c.id })}
                  className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-sm font-medium transition ${
                    pr.connectionType === c.id
                      ? 'border-[#165B49] bg-[#165B49]/8 dark:border-[#4BB89A]'
                      : 'border-[#D4DBD5] dark:border-[#2A3944]'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      pr.connectionType === c.id ? 'border-[#165B49]' : 'border-slate-400'
                    }`}
                  >
                    {pr.connectionType === c.id && <span className="h-2.5 w-2.5 rounded-full bg-[#165B49]" />}
                  </span>
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          {/* Paper Width */}
          <div className="px-4 py-3.5 border-b border-[#EAECE8] dark:border-[#223039]">
            <p className="text-sm font-semibold">Kertas Printer/WhatsApp</p>
            <div className="mt-2.5 flex gap-10">
              {(['58', '80'] as const).map((w) => (
                <label key={w} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    checked={pr.paperWidth === w}
                    onChange={() => setPr({ paperWidth: w })}
                    className="h-4 w-4 accent-[#165B49]"
                  />
                  <span>{w} mm</span>
                </label>
              ))}
            </div>
          </div>

          <SwitchRow
            label="Cetak dalam mode grafis"
            sublabel="(sesuai preview dan teks lebih kecil)"
            checked={pr.graphicMode}
            onChange={(v) => setPr({ graphicMode: v })}
          />
          <SwitchRow
            label="Cetak setelah transaksi"
            checked={pr.autoPrintAfterTx}
            onChange={(v) => setPr({ autoPrintAfterTx: v })}
          />
          <SwitchRow label="Cetak struk dua kali" checked={pr.printTwice} onChange={(v) => setPr({ printTwice: v })} />
          <SwitchRow
            label="Laci Uang tersambung ke Printer"
            checked={pr.cashDrawer}
            onChange={(v) => setPr({ cashDrawer: v })}
          />
          <SwitchRow
            label="Tambahan jarak potong bawah (+10 mm)"
            checked={pr.cutFeedExtra}
            onChange={(v) => setPr({ cutFeedExtra: v })}
          />

          {/* Jarak Sisa Kertas Bawah (kelipatan 5mm) */}
          <div className="px-4 py-3.5 border-b border-[#EAECE8] dark:border-[#223039]">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Jarak Sisa Kertas Bawah</p>
              <span className="font-mono-tabular text-xs font-bold text-[#165B49] dark:text-[#4BB89A]">
                {pr.bottomFeedMm ?? 5} mm
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">
              Atur panjang kertas kosong di bawah struk (tiap 5 mm).
            </p>
            <div className="mt-2.5 grid grid-cols-7 gap-1.5">
              {[0, 5, 10, 15, 20, 25, 30].map((mm) => {
                const active = (pr.bottomFeedMm ?? 5) === mm;
                return (
                  <button
                    key={mm}
                    type="button"
                    onClick={() => setPr({ bottomFeedMm: mm })}
                    className={`rounded-xl border py-2 text-xs font-bold tabular-nums transition ${
                      active
                        ? 'border-[#165B49] bg-[#165B49] text-white dark:border-[#4BB89A] dark:bg-[#165B49]'
                        : 'border-[#D4DBD5] dark:border-[#2A3944] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {mm}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Jarak Antar Baris Teks */}
          <div className="px-4 py-3.5 border-b border-[#EAECE8] dark:border-[#223039]">
            <p className="text-sm font-semibold">Jarak Antar Baris Teks</p>
            <p className="mt-0.5 text-xs text-slate-500">
              Pilihan Rapat menghemat pemakaian kertas struk.
            </p>
            <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(
                [
                  { id: 'tight', label: 'Sangat Rapat' },
                  { id: 'compact', label: 'Rapat' },
                  { id: 'normal', label: 'Sedang' },
                  { id: 'wide', label: 'Lega' },
                ] as const
              ).map((opt) => {
                const active = (pr.lineSpacing ?? 'compact') === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setPr({ lineSpacing: opt.id })}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      active
                        ? 'border-[#165B49] bg-[#165B49] text-white dark:border-[#4BB89A] dark:bg-[#165B49]'
                        : 'border-[#D4DBD5] dark:border-[#2A3944] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Paired & Discovered Bluetooth List + Refresh */}
          <div className="px-4 py-3 border-b border-[#EAECE8] dark:border-[#223039]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-500">Printer Terpilih</p>
                <p className="font-display text-sm font-bold text-[#165B49] dark:text-[#4BB89A] truncate">
                  {pr.selectedPrinterName || 'Belum dipilih (ketuk Scan)'}
                </p>
                {pr.selectedPrinterAddress && (
                  <p className="text-[11px] font-mono-tabular text-slate-400">{pr.selectedPrinterAddress}</p>
                )}
                <p className="mt-1 text-[11px] text-slate-500 leading-snug">
                  Mode Multi-HP: printer otomatis dilepas tuntas usai cetak agar banyak HP bisa bergantian tanpa bentrok.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {pr.selectedPrinterAddress && (
                  <button
                    type="button"
                    disabled={connectingAddr === pr.selectedPrinterAddress}
                    onClick={async () => {
                      setConnectingAddr(pr.selectedPrinterAddress);
                      try {
                        await testBluetoothPrinterConnection(pr.selectedPrinterAddress);
                        notify(`Tersambung ke ${pr.selectedPrinterName}`);
                      } catch (err) {
                        notify((err as Error).message || 'Gagal menyambung ke printer');
                      } finally {
                        setConnectingAddr(null);
                      }
                    }}
                    className="btn-lux-gold rounded-xl px-3 py-2.5 text-xs font-bold"
                  >
                    {connectingAddr === pr.selectedPrinterAddress ? 'Menyambung...' : 'Sambung'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleScanPrinters}
                  disabled={scanningPrinter}
                  className="btn-lux-primary flex h-10 w-14 items-center justify-center rounded-xl"
                  aria-label="Scan printer Bluetooth"
                >
                  <RefreshCw className={`h-5 w-5 ${scanningPrinter ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {scanningPrinter && (
              <p className="mt-2.5 text-xs font-medium text-[#165B49] dark:text-[#4BB89A]">
                Sedang memindai perangkat Bluetooth di sekitar (±4 detik)...
              </p>
            )}

            {pairedDevices.length > 0 && (
              <div className="mt-3 divide-y divide-[#EAECE8] dark:divide-[#223039] rounded-2xl border border-[#DCE1DC] dark:border-[#2A3944]">
                {pairedDevices.map((dev) => {
                  const selected = pr.selectedPrinterAddress === dev.address;
                  const connecting = connectingAddr === dev.address;
                  return (
                    <button
                      key={dev.address}
                      type="button"
                      disabled={connecting}
                      onClick={() => handleSelectAndTestDevice(dev)}
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-[#F7F9F7] dark:hover:bg-[#1B262E]"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="font-semibold truncate">{dev.name}</p>
                          {dev.isPrinter && (
                            <span className="rounded bg-[#165B49]/12 px-1.5 py-0.5 text-[10px] font-bold text-[#165B49] dark:text-[#4BB89A]">
                              Printer
                            </span>
                          )}
                          {dev.bonded !== undefined && (
                            <span className="rounded bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              {dev.bonded ? 'Terpasang' : 'Baru'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono-tabular text-slate-400">
                          {connecting ? 'Menghubungkan...' : dev.address}
                        </p>
                      </div>
                      {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Language */}
          <div className="px-4 py-4">
            <p className="text-sm font-semibold">Pengaturan bahasa printer</p>
            <label className="mt-2.5 flex items-center gap-2.5 text-sm">
              <input type="radio" checked readOnly className="h-4 w-4 accent-[#165B49]" />
              <span>Alfabet Standar</span>
            </label>
          </div>
        </div>

        {/* Sticky Bottom TEST PRINT */}
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#151E24]/95 p-3 border-t border-[#E5E8E4] dark:border-[#223039] backdrop-blur-md">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              disabled={testingPrint}
              onClick={async () => {
                if (testingPrint) return;
                setTestingPrint(true);
                try {
                  const res = await runTestPrint(pr, data.store.name);
                  notify(res === 'native' ? 'Test Print tercetak tuntas!' : 'Dialog Test Print dibuka');
                } catch (e) {
                  notify((e as Error).message || 'Test Print gagal');
                } finally {
                  setTestingPrint(false);
                }
              }}
              className="btn-lux-primary font-display h-12 w-full rounded-2xl text-sm font-bold tracking-wider disabled:opacity-60"
            >
              {testingPrint ? 'MENCETAK...' : 'TEST PRINT'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 6. AKUN PEMILIK & NAMA KASIR
  // =========================================================
  if (screen === 'settings_users') {
    const hasOwnerPass = Boolean(data.ownerAuth?.passHash);
    return (
      <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
        <TopBar title="Login Pemilik & Kasir" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl p-4 space-y-4">
          {/* Card Login Pemilik */}
          <div className="surface-card rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                  isOwnerLoggedIn
                    ? 'bg-[#165B49]/15 text-[#165B49] dark:text-[#4BB89A]'
                    : 'bg-slate-200/80 dark:bg-[#1B262E] text-slate-600 dark:text-slate-300'
                }`}
              >
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-sm font-bold text-[#17252B] dark:text-white">
                  Akun Pemilik (Khusus Pemilik Toko)
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                  {isOwnerLoggedIn
                    ? 'Status: Sedang Login. Laba di Produk, Arus Kas, dan Laporan ditampilkan.'
                    : 'Status: Terkunci / Logout. Laba disembunyikan di seluruh aplikasi. Semua data toko tetap tersimpan aman.'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onOpenOwnerAuth}
              className={`w-full rounded-xl py-3 text-xs font-bold flex items-center justify-center gap-2 ${
                isOwnerLoggedIn ? 'btn-lux-garnet' : 'btn-lux-primary'
              }`}
            >
              {isOwnerLoggedIn ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              <span>
                {isOwnerLoggedIn
                  ? 'Kelola PIN / Logout Akun Pemilik'
                  : hasOwnerPass
                  ? 'Login Akun Pemilik'
                  : 'Buat PIN / Sandi Pemilik Pertama Kali'}
              </span>
            </button>
          </div>

          {/* Nama Kasir di Struk */}
          <div className="space-y-2">
            <p className="px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
              Nama Petugas di Struk
            </p>
            <div className="surface-card rounded-2xl divide-y divide-[#EAECE8] dark:divide-[#223039]">
              {data.users.map((u) => {
                const active = u.id === data.activeUserId;
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => {
                      onUpdateData((p) => ({ ...p, activeUserId: u.id }));
                      notify(`Nama kasir aktif: ${u.name}`);
                    }}
                    className="flex w-full items-center justify-between px-4 py-3.5 text-left"
                  >
                    <div>
                      <p className="text-sm font-bold">{u.name}</p>
                      <p className="text-xs text-slate-500">{u.role}</p>
                    </div>
                    {active && (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-[#165B49] dark:text-[#4BB89A]">
                        <CheckCircle2 className="h-4 w-4" /> Aktif
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="surface-card rounded-2xl p-4">
            <h3 className="font-display text-sm font-bold flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-[#165B49] dark:text-[#4BB89A]" /> Tambah Nama Kasir
            </h3>
            <div className="mt-3 flex gap-2">
              <input
                type="text"
                value={newUserName}
                onChange={(e) => setNewUserName(e.target.value)}
                placeholder="Nama kasir"
                className="flex-1 rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-sm outline-none focus:border-[#165B49]"
              />
              <select
                value={newUserRole}
                onChange={(e) => setNewUserRole(e.target.value as 'Admin' | 'Kasir')}
                className="rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#0E1418] px-3 py-2 text-sm"
              >
                <option value="Kasir">Kasir</option>
                <option value="Admin">Pemilik</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!newUserName.trim()) return;
                onUpdateData((p) => ({
                  ...p,
                  users: [...p.users, { id: `usr-${Date.now()}`, name: newUserName.trim(), role: newUserRole, pin: '' }],
                }));
                setNewUserName('');
                notify('Nama petugas ditambahkan');
              }}
              className="btn-lux-primary mt-3 w-full rounded-xl py-2.5 text-sm font-bold"
            >
              Simpan Nama
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // 7. PROFIL TOKO (Toko Cahaya)
  // =========================================================
  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418]">
      <TopBar title="Profil Toko" mode="back" onLeftClick={onBack} />
      <div className="mx-auto w-full max-w-4xl p-4">
        <div className="surface-card rounded-3xl p-5 space-y-3">
          <div className="font-display flex items-center gap-2 text-[#165B49] dark:text-[#4BB89A] font-bold text-sm">
            <Store className="h-4 w-4" /> Identitas Toko (Tampil di Struk)
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Nama Toko</label>
            <input
              type="text"
              value={storeForm.name}
              onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#165B49]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Alamat</label>
            <input
              type="text"
              value={storeForm.address}
              onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Kota</label>
            <input
              type="text"
              value={storeForm.city}
              onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">No. Telepon / WhatsApp</label>
            <input
              type="text"
              value={storeForm.phone}
              onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Catatan Kaki Struk (Footer)</label>
            <input
              type="text"
              value={storeForm.footer}
              onChange={(e) => setStoreForm({ ...storeForm, footer: e.target.value })}
              className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              onUpdateData((p) => ({ ...p, store: storeForm }));
              notify('Profil toko disimpan');
              onBack();
            }}
            className="btn-lux-primary font-display mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-sm font-bold"
          >
            <Save className="h-4 w-4" /> SIMPAN PROFIL TOKO
          </button>
        </div>
      </div>
    </div>
  );
};
