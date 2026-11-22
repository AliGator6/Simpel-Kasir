import React, { useRef, useState } from 'react';
import { Lamp, Banknote, ReceiptText, CircleDollarSign, CalendarClock, Percent, HelpCircle, FileText, Printer, Database, LockOpen, Trash2, Moon, Save, RefreshCw, CheckCircle2, UserPlus, Store } from 'lucide-react';
import { AppData, ScreenId } from '../types';
import { TopBar, SwitchRow } from '../components/TopBar';
import { DEFAULT_APP_DATA } from '../utils/storage';
import { PairedDevice, runTestPrint, scanPairedBluetoothPrinters } from '../utils/printer';

interface SettingsProps {
  screen: 'settings' | 'settings_business' | 'settings_product' | 'settings_receipt' | 'settings_printer' | 'settings_users' | 'settings_store';
  data: AppData;
  onOpenDrawer: () => void;
  onBack: () => void;
  onNavigate: (s: ScreenId) => void;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  notify: (msg: string) => void;
}

export const SettingsScreens: React.FC<SettingsProps> = ({
  screen, data, onOpenDrawer, onBack, onNavigate, onUpdateData, notify,
}) => {
  const backupInputRef = useRef<HTMLInputElement | null>(null);
  const [pairedDevices, setPairedDevices] = useState<PairedDevice[]>([]);
  const [scanningPrinter, setScanningPrinter] = useState(false);
  const [storeForm, setStoreForm] = useState(data.store);
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState<'Admin' | 'Kasir'>('Kasir');
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [currencyInput, setCurrencyInput] = useState(data.currencySymbol);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [taxInput, setTaxInput] = useState(String(data.businessFlags.taxPercent));
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  if (screen === 'settings') {
    const handleBackupExport = () => {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SimpelKasir_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      notify('File backup berhasil diunduh');
    };

    const handleBackupImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result || '')) as Partial<AppData>;
          if (!parsed.products || !parsed.store) {
            notify('Format file backup tidak valid');
            return;
          }
          onUpdateData((prev) => ({ ...DEFAULT_APP_DATA, ...prev, ...parsed }));
          notify('Data backup berhasil dipulihkan');
        } catch {
          notify('Gagal membaca file backup');
        }
      };
      reader.readAsText(file);
      e.target.value = '';
    };

    const gridButtons: { label: string; icon: React.ReactNode; tone: 'charcoal' | 'navy' | 'terracotta' | 'flag'; onClick: () => void }[] = [
      { label: 'Produk', icon: <Lamp className="h-7 w-7" />, tone: 'charcoal', onClick: () => onNavigate('settings_product') },
      { label: 'Transaksi', icon: <Banknote className="h-7 w-7" />, tone: 'charcoal', onClick: () => onNavigate('settings_business') },
      { label: 'Pembayaran', icon: <ReceiptText className="h-7 w-7" />, tone: 'charcoal', onClick: () => onNavigate('settings_receipt') },
      { label: 'Mata Uang', icon: <CircleDollarSign className="h-7 w-7" />, tone: 'charcoal', onClick: () => { setCurrencyInput(data.currencySymbol); setShowCurrencyModal(true); } },
      { label: 'Bahasa', icon: <div className="h-7 w-9 overflow-hidden rounded-sm border border-slate-300 shadow-xs"><div className="h-1/2 bg-[#B55340]" /><div className="h-1/2 bg-white" /></div>, tone: 'flag', onClick: () => notify('Bahasa aktif: Indonesia') },
      { label: 'Toko', icon: <CalendarClock className="h-7 w-7" />, tone: 'charcoal', onClick: () => { setStoreForm(data.store); onNavigate('settings_store'); } },
      { label: 'Pajak', icon: <Percent className="h-7 w-7" />, tone: 'charcoal', onClick: () => { setTaxInput(String(data.businessFlags.taxPercent)); setShowTaxModal(true); } },
      { label: 'Jenis Usaha', icon: <HelpCircle className="h-7 w-7" />, tone: 'terracotta', onClick: () => onNavigate('settings_business') },
      { label: 'Struk', icon: <FileText className="h-7 w-7" />, tone: 'charcoal', onClick: () => onNavigate('settings_receipt') },
      { label: 'Printer', icon: <Printer className="h-7 w-7" />, tone: 'navy', onClick: () => onNavigate('settings_printer') },
      { label: 'Backup Restore', icon: <Database className="h-7 w-7" />, tone: 'navy', onClick: handleBackupExport },
      { label: 'Login User', icon: <LockOpen className="h-7 w-7" />, tone: 'navy', onClick: () => onNavigate('settings_users') },
      { label: 'Pulihkan File', icon: <Save className="h-7 w-7" />, tone: 'navy', onClick: () => backupInputRef.current?.click() },
      { label: 'Hapus Data', icon: <Trash2 className="h-7 w-7" />, tone: 'terracotta', onClick: () => setShowResetConfirm(true) },
      { label: data.darkMode ? 'Mode Terang' : 'Mode Gelap', icon: <Moon className="h-7 w-7" />, tone: 'charcoal', onClick: () => onUpdateData((prev) => ({ ...prev, darkMode: !prev.darkMode })) },
    ];

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
        <TopBar title="Pengaturan" mode="menu" onLeftClick={onOpenDrawer} />
        <div className="mx-auto w-full max-w-4xl px-4 py-4">
          <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">SimpelKasir · v{data.version}</p>
          <div className="mt-5 grid grid-cols-3 gap-y-6 gap-x-3">
            {gridButtons.map((btn) => {
              const circleBg = btn.tone === 'navy' ? 'bg-[#1E2F42] text-white' : btn.tone === 'terracotta' ? 'bg-[#B55340] text-white' : btn.tone === 'flag' ? 'bg-slate-200 dark:bg-slate-700' : 'bg-[#464D57] text-white';
              const labelColor = btn.tone === 'navy' ? 'text-[#1E2F42] dark:text-sky-300' : btn.tone === 'terracotta' ? 'text-[#B55340] dark:text-[#E08A79]' : 'text-slate-700 dark:text-slate-200';
              return (
                <button key={btn.label} type="button" onClick={btn.onClick} className="flex flex-col items-center gap-2 group">
                  <span className={`flex h-16 w-16 items-center justify-center rounded-full shadow-md group-active:scale-95 transition ${circleBg}`}>{btn.icon}</span>
                  <span className={`text-center text-xs font-semibold leading-tight ${labelColor}`}>{btn.label}</span>
                </button>
              );
            })}
          </div>
          <input ref={backupInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleBackupImport} />
        </div>

        {showCurrencyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Simbol Mata Uang</h3>
              <input type="text" value={currencyInput} onChange={(e) => setCurrencyInput(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm font-bold" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowCurrencyModal(false)} className="flex-1 rounded-xl border py-2 text-sm">Batal</button>
                <button type="button" onClick={() => { onUpdateData((p) => ({ ...p, currencySymbol: currencyInput.trim() || 'Rp' })); setShowCurrencyModal(false); notify('Mata uang diperbarui'); }} className="flex-1 rounded-xl bg-[#1E2F42] py-2 text-sm font-bold text-white">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {showTaxModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold">Persentase Pajak (%)</h3>
              <input type="number" value={taxInput} onChange={(e) => setTaxInput(e.target.value)} className="mt-3 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-base font-bold tabular-nums" />
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowTaxModal(false)} className="flex-1 rounded-xl border py-2 text-sm">Batal</button>
                <button type="button" onClick={() => { onUpdateData((p) => ({ ...p, businessFlags: { ...p.businessFlags, taxPercent: Math.max(0, Number(taxInput) || 0) } })); setShowTaxModal(false); notify('Pajak diperbarui'); }} className="flex-1 rounded-xl bg-[#1E2F42] py-2 text-sm font-bold text-white">Simpan</button>
              </div>
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-[#1A222C] p-5 shadow-xl">
              <h3 className="text-base font-bold text-[#A93F4B]">Hapus Semua Data?</h3>
              <p className="mt-1.5 text-xs text-slate-500">Semua transaksi, arus kas, dan pengaturan akan dikembalikan ke setelan awal Toko Cahaya.</p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setShowResetConfirm(false)} className="flex-1 rounded-xl border py-2 text-sm">Batal</button>
                <button type="button" onClick={() => { onUpdateData(() => DEFAULT_APP_DATA); setShowResetConfirm(false); notify('Data direset ke setelan awal'); }} className="flex-1 rounded-xl bg-[#A93F4B] py-2 text-sm font-bold text-white">Reset</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (screen === 'settings_business') {
    const bf = data.businessFlags;
    const setBf = (patch: Partial<typeof bf>) =>
      onUpdateData((prev) => ({
        ...prev,
        businessFlags: { ...prev.businessFlags, ...patch },
        productSettings: { ...prev.productSettings, useStock: patch.useStock ?? prev.productSettings.useStock, useIngredients: patch.useIngredients ?? prev.productSettings.useIngredients, useBarcode: patch.useBarcode ?? prev.productSettings.useBarcode },
      }));

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
        <TopBar title="Jenis Usaha Anda" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl flex-1 bg-white dark:bg-[#1A222C]">
          <h2 className="border-b border-slate-200 dark:border-slate-800 py-5 text-center text-xl font-bold">Jenis Usaha Anda</h2>
          <SwitchRow label="Gunakan stok" checked={bf.useStock} onChange={(v) => setBf({ useStock: v })} />
          <SwitchRow label="Gunakan bahan baku/komposisi" checked={bf.useIngredients} onChange={(v) => setBf({ useIngredients: v })} />
          <SwitchRow label="Gunakan barcode" checked={bf.useBarcode} onChange={(v) => setBf({ useBarcode: v })} />
          <SwitchRow label="Aktifkan pajak" checked={bf.useTax} onChange={(v) => setBf({ useTax: v })} />
          <SwitchRow label="Gunakan alur progres" checked={bf.useProgress} onChange={(v) => setBf({ useProgress: v })} />
          <SwitchRow label="Gunakan ongkos kirim" checked={bf.useShipping} onChange={(v) => setBf({ useShipping: v })} />
          <p className="px-4 py-4 text-xs text-slate-500">Anda masih bisa mengubah opsi di atas kapan saja melalui menu Pengaturan.</p>
          <div className="flex justify-center pb-8 pt-2">
            <button type="button" onClick={() => { notify('Konfigurasi jenis usaha disimpan'); onBack(); }} className="inline-flex items-center gap-2 rounded-xl bg-[#1E2F42] px-8 py-3 text-sm font-bold text-white shadow-sm">
              <Save className="h-4 w-4" /> SIMPAN
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'settings_product') {
    const ps = data.productSettings;
    const setPs = (patch: Partial<typeof ps>) => onUpdateData((prev) => ({ ...prev, productSettings: { ...prev.productSettings, ...patch } }));

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
        <TopBar title="Produk" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#1A222C]">
          <SwitchRow label="Gunakan kode produk (SKU)" checked={ps.useSku} onChange={(v) => setPs({ useSku: v })} />
          <SwitchRow label="Gunakan barcode" checked={ps.useBarcode} onChange={(v) => setPs({ useBarcode: v })} />
          {ps.useBarcode && (
            <SwitchRow indented label="Gunakan kamera depan" sublabel="Tips: tekan lama tombol scan untuk mengaktifkan/nonaktifkan flash" checked={ps.useFrontCamera} onChange={(v) => setPs({ useFrontCamera: v })} />
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

  if (screen === 'settings_receipt') {
    const rs = data.receiptSettings;
    const setRs = (patch: Partial<typeof rs>) => onUpdateData((prev) => ({ ...prev, receiptSettings: { ...prev.receiptSettings, ...patch } }));

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-10">
        <TopBar title="Pengaturan Struk" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#1A222C]">
          <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
            <p className="text-sm font-semibold">Kertas Printer/WhatsApp</p>
            <div className="mt-2.5 flex gap-6">
              {(['58', '80'] as const).map((w) => (
                <label key={w} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={rs.paperWidth === w} onChange={() => setRs({ paperWidth: w })} className="accent-[#B55340] h-4 w-4" />
                  <span>{w} mm</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
            <p className="text-sm font-semibold">Tampilkan satuan (kg, pcs)</p>
            <div className="mt-2.5 flex gap-5">
              {([{ id: 'none', l: 'Tidak' }, { id: 'decimal', l: 'Desimal' }, { id: 'all', l: 'Semua' }] as const).map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={rs.showUnit === u.id} onChange={() => setRs({ showUnit: u.id })} className="accent-[#B55340] h-4 w-4" />
                  <span>{u.l}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3.5">
            <p className="text-sm font-semibold">Tampilkan id/kode transaksi</p>
            <div className="mt-2.5 flex flex-wrap gap-4">
              {([{ id: 'id', l: 'ID' }, { id: 'code', l: 'Kode' }, { id: 'both', l: 'Keduanya' }, { id: 'none', l: 'Tidak ada' }] as const).map((m) => (
                <label key={m.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="radio" checked={rs.showTxIdMode === m.id} onChange={() => setRs({ showTxIdMode: m.id })} className="accent-[#B55340] h-4 w-4" />
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

  if (screen === 'settings_printer') {
    const pr = data.printerSettings;
    const setPr = (patch: Partial<typeof pr>) => onUpdateData((prev) => ({ ...prev, printerSettings: { ...prev.printerSettings, ...patch } }));

    const handleScanPrinters = async () => {
      setScanningPrinter(true);
      try {
        const list = await scanPairedBluetoothPrinters();
        setPairedDevices(list);
        if (list.length === 0) notify('Tidak ada printer Bluetooth terpasang (pair dulu di Pengaturan HP)');
        else notify(`Ditemukan ${list.length} perangkat Bluetooth`);
      } catch (err) {
        notify((err as Error).message);
      } finally {
        setScanningPrinter(false);
      }
    };

    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D] pb-20">
        <TopBar title="Printer" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl bg-white dark:bg-[#1A222C]">
          <div className="px-4 pt-4 pb-3 border-b border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold">Printer POS Thermal</p>
            <div className="mt-2.5 grid grid-cols-2 gap-3">
              {([{ id: 'bluetooth', l: 'Bluetooth' }, { id: 'usb', l: 'USB' }] as const).map((c) => (
                <button key={c.id} type="button" onClick={() => setPr({ connectionType: c.id })} className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 text-sm font-medium transition ${pr.connectionType === c.id ? 'border-[#1E2F42] bg-[#1E2F42]/5 dark:border-sky-400' : 'border-slate-300 dark:border-slate-700'}`}>
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${pr.connectionType === c.id ? 'border-[#B55340]' : 'border-slate-400'}`}>
                    {pr.connectionType === c.id && <span className="h-2.5 w-2.5 rounded-full bg-[#B55340]" />}
                  </span>
                  {c.l}
                </button>
              ))}
            </div>
          </div>

          <div className="px-4 py-3.5 border-b border-slate-200 dark:border-slate-800">
            <p className="text-sm font-semibold">Kertas Printer/WhatsApp</p>
            <div className="mt-2.5 flex gap-10">
              {(['58', '80'] as const).map((w) => (
                <label key={w} className="flex items-center gap-2.5 text-sm cursor-pointer">
                  <input type="radio" checked={pr.paperWidth === w} onChange={() => setPr({ paperWidth: w })} className="h-4 w-4 accent-[#B55340]" />
                  <span>{w} mm</span>
                </label>
              ))}
            </div>
          </div>

          <SwitchRow label="Cetak dalam mode grafis" sublabel="(sesuai preview dan teks lebih kecil)" checked={pr.graphicMode} onChange={(v) => setPr({ graphicMode: v })} />
          <SwitchRow label="Cetak setelah transaksi" checked={pr.autoPrintAfterTx} onChange={(v) => setPr({ autoPrintAfterTx: v })} />
          <SwitchRow label="Cetak struk dua kali" checked={pr.printTwice} onChange={(v) => setPr({ printTwice: v })} />
          <SwitchRow label="Laci Uang tersambung ke Printer" checked={pr.cashDrawer} onChange={(v) => setPr({ cashDrawer: v })} />
          <SwitchRow label="Jika hasil cetak terlalu panjang di bagian bawah, hidupkan opsi ini" checked={pr.cutFeedExtra} onChange={(v) => setPr({ cutFeedExtra: v })} />

          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500">Printer Terpilih</p>
                <p className="text-sm font-bold text-[#1E2F42] dark:text-sky-300">{pr.selectedPrinterName || 'Belum dipilih (ketuk Refresh)'}</p>
              </div>
              <button type="button" onClick={handleScanPrinters} disabled={scanningPrinter} className="flex h-10 w-14 items-center justify-center rounded-lg bg-[#1E2F42] text-white active:scale-95 transition" aria-label="Scan printer Bluetooth">
                <RefreshCw className={`h-5 w-5 ${scanningPrinter ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {pairedDevices.length > 0 && (
              <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                {pairedDevices.map((dev) => {
                  const selected = pr.selectedPrinterAddress === dev.address;
                  return (
                    <button key={dev.address} type="button" onClick={() => { setPr({ selectedPrinterName: dev.name, selectedPrinterAddress: dev.address }); notify(`Printer ${dev.name} dipilih`); }} className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm">
                      <div>
                        <p className="font-semibold">{dev.name}</p>
                        <p className="text-xs font-mono-tabular text-slate-400">{dev.address}</p>
                      </div>
                      {selected && <CheckCircle2 className="h-5 w-5 text-[#2C6E58]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="px-4 py-4">
            <p className="text-sm font-semibold">Pengaturan bahasa printer</p>
            <label className="mt-2.5 flex items-center gap-2.5 text-sm">
              <input type="radio" checked readOnly className="h-4 w-4 accent-[#B55340]" />
              <span>Alfabet Standar</span>
            </label>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-40 bg-white dark:bg-[#1A222C] p-3 border-t border-slate-200 dark:border-slate-800">
          <div className="mx-auto max-w-4xl">
            <button
              type="button"
              onClick={async () => {
                try {
                  const res = await runTestPrint(pr, data.store.name);
                  notify(res === 'native' ? 'Test Print dikirim ke printer!' : 'Dialog Test Print dibuka');
                } catch (e) {
                  notify((e as Error).message || 'Test Print gagal');
                }
              }}
              className="h-12 w-full rounded-xl bg-[#1E2F42] text-sm font-bold tracking-wider text-white hover:bg-[#273E56] active:scale-[0.99] transition"
            >
              TEST PRINT
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'settings_users') {
    return (
      <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
        <TopBar title="Login User" mode="back" onLeftClick={onBack} />
        <div className="mx-auto w-full max-w-4xl p-4 space-y-4">
          <div className="rounded-2xl bg-white dark:bg-[#1A222C] border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
            {data.users.map((u) => {
              const active = u.id === data.activeUserId;
              return (
                <button key={u.id} type="button" onClick={() => { onUpdateData((p) => ({ ...p, activeUserId: u.id })); notify(`Aktif sebagai ${u.name} (${u.role})`); }} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
                  <div>
                    <p className="text-sm font-bold">{u.name}</p>
                    <p className="text-xs text-slate-500">{u.role}</p>
                  </div>
                  {active && <span className="inline-flex items-center gap-1 text-xs font-bold text-[#2C6E58]"><CheckCircle2 className="h-4 w-4" /> Aktif</span>}
                </button>
              );
            })}
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#1A222C] border border-slate-200 dark:border-slate-800 p-4">
            <h3 className="text-sm font-bold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Tambah Pengguna Baru</h3>
            <div className="mt-3 flex gap-2">
              <input type="text" value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="Nama kasir / admin" className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2 text-sm" />
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value as 'Admin' | 'Kasir')} className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11161D] px-3 py-2 text-sm">
                <option value="Kasir">Kasir</option>
                <option value="Admin">Admin</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!newUserName.trim()) return;
                onUpdateData((p) => ({ ...p, users: [...p.users, { id: `usr-${Date.now()}`, name: newUserName.trim(), role: newUserRole, pin: '' }] }));
                setNewUserName('');
                notify('User ditambahkan');
              }}
              className="mt-3 w-full rounded-xl bg-[#1E2F42] py-2.5 text-sm font-bold text-white"
            >
              Tambah User
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F4F5F7] dark:bg-[#11161D]">
      <TopBar title="Profil Toko" mode="back" onLeftClick={onBack} />
      <div className="mx-auto w-full max-w-4xl p-4">
        <div className="rounded-2xl bg-white dark:bg-[#1A222C] border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-center gap-2 text-[#1E2F42] dark:text-sky-300 font-bold text-sm">
            <Store className="h-4 w-4" /> Identitas Toko (Tampil di Struk)
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Nama Toko</label>
            <input type="text" value={storeForm.name} onChange={(e) => setStoreForm({ ...storeForm, name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm font-semibold" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Alamat</label>
            <input type="text" value={storeForm.address} onChange={(e) => setStoreForm({ ...storeForm, address: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Kota</label>
            <input type="text" value={storeForm.city} onChange={(e) => setStoreForm({ ...storeForm, city: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">No. Telepon / WhatsApp</label>
            <input type="text" value={storeForm.phone} onChange={(e) => setStoreForm({ ...storeForm, phone: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-500">Catatan Kaki Struk (Footer)</label>
            <input type="text" value={storeForm.footer} onChange={(e) => setStoreForm({ ...storeForm, footer: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-transparent px-3 py-2.5 text-sm" />
          </div>
          <button type="button" onClick={() => { onUpdateData((p) => ({ ...p, store: storeForm })); notify('Profil toko disimpan'); onBack(); }} className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E2F42] text-sm font-bold text-white">
            <Save className="h-4 w-4" /> SIMPAN PROFIL TOKO
          </button>
        </div>
      </div>
    </div>
  );
};
