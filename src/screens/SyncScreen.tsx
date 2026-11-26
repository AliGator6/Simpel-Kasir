import React, { useEffect, useRef, useState } from 'react';
import {
  Wifi,
  Upload,
  Download,
  RefreshCw,
  FolderCheck,
  Radio,
  StopCircle,
  CheckCircle2,
  FileSpreadsheet,
  Smartphone,
  AlertCircle,
  X,
  Database,
  Share2,
  Users,
  ReceiptText,
  Zap,
  Layers,
  ShieldAlert,
  Package,
} from 'lucide-react';
import { AppData } from '../types';
import { TopBar, useBackClose } from '../components/TopBar';
import {
  BackupSummary,
  PersonalSyncKind,
  SyncPayloadEnvelope,
  createFullBackupJson,
  createPersonalSyncJson,
  exportCustomersToCsv,
  exportProductsToCsv,
  formatDateShort,
  formatNumber,
  getBackupSummary,
  mergeCustomersList,
  parseFullBackupJson,
  parseIncomingSyncPayload,
  parseProductsFromCsv,
} from '../utils/storage';
import {
  WifiDiscoveredPeer,
  WifiSyncServerInfo,
  discoverWifiCsvServers,
  downloadWifiCsvFromPeer,
  saveExportFile,
  startWifiCsvServer,
  stopWifiCsvServer,
} from '../utils/printer';

interface SyncScreenProps {
  data: AppData;
  onOpenDrawer: () => void;
  onUpdateData: (updater: (prev: AppData) => AppData) => void;
  onFullRestore?: (restored: AppData) => void;
  notify: (msg: string) => void;
}

type PendingReceiveState = {
  envelope: SyncPayloadEnvelope;
  fromStore: string;
  savedPath: string;
  sourceLabel: string;
};

function getDataTypeBadge(dataType?: string, fileName?: string): string {
  const lower = (fileName || '').toLowerCase();
  if (dataType === 'full_backup' || lower.includes('backup')) return 'Backup Penuh (.json)';
  if (dataType === 'customers_json' || dataType === 'customers_csv' || lower.includes('pelanggan')) {
    return 'Daftar Pelanggan';
  }
  if (dataType === 'transactions_cashflow' || lower.includes('transaksi')) {
    return 'Transaksi & Arus Kas';
  }
  if (dataType === 'quick_carts' || lower.includes('cepat')) return 'Transaksi Cepat';
  if (dataType === 'master_settings' || lower.includes('master')) return 'Master & Pengaturan';
  if (lower.endsWith('.json')) return 'Data SimpelKasir (.json)';
  return 'Produk (.csv)';
}

function getPeerCountLabel(peer: WifiDiscoveredPeer): string {
  const n = formatNumber(peer.productCount || 0);
  switch (peer.dataType) {
    case 'full_backup':
      return `${n} total item`;
    case 'customers_json':
    case 'customers_csv':
      return `${n} pelanggan`;
    case 'transactions_cashflow':
      return `${n} transaksi`;
    case 'quick_carts':
      return `${n} paket cepat`;
    case 'master_settings':
      return `${n} item master`;
    default:
      return `${n} produk`;
  }
}

export const SyncScreen: React.FC<SyncScreenProps> = ({
  data,
  onOpenDrawer,
  onUpdateData,
  onFullRestore,
  notify,
}) => {
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [startingSend, setStartingSend] = useState(false);
  const [serverInfo, setServerInfo] = useState<WifiSyncServerInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [peers, setPeers] = useState<WifiDiscoveredPeer[]>([]);
  const [manualAddress, setManualAddress] = useState('');
  const [receivingAddr, setReceivingAddr] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [lastReceivedSummary, setLastReceivedSummary] = useState<{
    headline: string;
    savedPath: string;
    fromStore: string;
  } | null>(null);

  const [pendingBackupRestore, setPendingBackupRestore] = useState<{
    appData: AppData;
    summary: BackupSummary;
    sourceLabel: string;
    savedPath?: string;
  } | null>(null);

  const [pendingReceive, setPendingReceive] = useState<PendingReceiveState | null>(null);

  const customCsvInputRef = useRef<HTMLInputElement | null>(null);
  const fullBackupInputRef = useRef<HTMLInputElement | null>(null);
  const receiveFileInputRef = useRef<HTMLInputElement | null>(null);

  useBackClose(Boolean(pendingBackupRestore), () => setPendingBackupRestore(null));
  useBackClose(Boolean(pendingReceive), () => setPendingReceive(null));

  useEffect(() => {
    return () => {
      stopWifiCsvServer().catch(() => {});
    };
  }, []);

  const currentSummary = getBackupSummary(data);

  // =========================================================
  // BAGIAN 1: BACKUP & RESTORE PENUH (.JSON)
  // =========================================================
  const buildBackupFilename = () => {
    const safeStore = (data.store.name || 'SimpelKasir').replace(/[^a-zA-Z0-9_-]+/g, '_');
    const stamp = new Date().toISOString().slice(0, 10);
    return `SimpelKasir_Backup_${safeStore}_${stamp}.json`;
  };

  const handleSaveFullBackup = async () => {
    setErrorBanner(null);
    try {
      const json = createFullBackupJson(data);
      const fileName = buildBackupFilename();
      const res = await saveExportFile(fileName, json, 'application/json', 'SimpelKasir');
      notify(res.isNative ? `Backup penuh tersimpan di ${res.savedPath}` : `Backup penuh diunduh: ${fileName}`);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal menyimpan file backup penuh';
      setErrorBanner(msg);
      notify(msg);
    }
  };

  const handleShareFullBackup = async () => {
    setErrorBanner(null);
    const json = createFullBackupJson(data);
    const fileName = buildBackupFilename();
    try {
      const file = new File([json], fileName, { type: 'application/json' });
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (typeof navigator.share === 'function' && (!nav.canShare || nav.canShare({ files: [file] }))) {
        await navigator.share({
          title: 'Backup Penuh SimpelKasir',
          text: `Backup semua data toko ${data.store.name}`,
          files: [file],
        });
        return;
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
    }
    await handleSaveFullBackup();
  };

  const handleFullBackupFilePicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseFullBackupJson(text);
      if (!parsed) {
        const msg =
          'File tidak dikenali sebagai Backup Penuh SimpelKasir (.json). Pastikan memilih file hasil backup SimpelKasir.';
        setErrorBanner(msg);
        notify('Format file backup tidak valid');
        return;
      }
      setPendingBackupRestore({
        appData: parsed.appData,
        summary: parsed.summary,
        sourceLabel: file.name || 'File Backup',
      });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const confirmFullBackupRestore = () => {
    if (!pendingBackupRestore) return;
    const { appData, summary, sourceLabel, savedPath } = pendingBackupRestore;
    if (onFullRestore) {
      onFullRestore(appData);
    } else {
      onUpdateData(() => appData);
    }
    setPendingBackupRestore(null);
    setLastReceivedSummary({
      headline: `Semua data (${formatNumber(summary.productsCount)} produk, ${formatNumber(summary.transactionsCount)} transaksi, ${formatNumber(summary.customersCount)} pelanggan) berhasil dipulihkan!`,
      savedPath: savedPath || sourceLabel,
      fromStore: summary.storeName,
    });
    notify(`Data toko "${summary.storeName}" berhasil dipulihkan!`);
  };

  // =========================================================
  // BAGIAN 2A: KIRIM DATA VIA WIFI / HOTSPOT
  // =========================================================
  const safeStoreSlug = (data.store.name || 'SimpelKasir').replace(/[^a-zA-Z0-9_-]+/g, '_');
  const todayStamp = new Date().toISOString().slice(0, 10);

  const handleStartWifiSend = async (params: {
    content: string;
    fileName: string;
    count: number;
    dataType: string;
    successNotice: string;
  }) => {
    setErrorBanner(null);
    setStartingSend(true);
    try {
      const info = await startWifiCsvServer({
        content: params.content,
        fileName: params.fileName,
        storeName: data.store.name || 'SimpelKasir',
        productCount: params.count,
        dataType: params.dataType,
      });
      setServerInfo(info);
      notify(params.successNotice);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal mengaktifkan pengiriman WiFi';
      setErrorBanner(msg);
      notify(msg);
    } finally {
      setStartingSend(false);
    }
  };

  const handleSendAppProducts = async () => {
    if (data.products.length === 0) {
      const msg = 'Daftar produk kosong. Pilih file CSV lain atau tambahkan produk dulu.';
      setErrorBanner(msg);
      notify(msg);
      return;
    }
    await handleStartWifiSend({
      content: exportProductsToCsv(data.products),
      fileName: `Products_${safeStoreSlug}_${todayStamp}.csv`,
      count: data.products.length,
      dataType: 'products_csv',
      successNotice: 'Mode kirim Produk (.csv) via WiFi aktif!',
    });
  };

  const handleSendCustomersWifi = async () => {
    if (data.customers.length === 0) {
      const msg = 'Daftar pelanggan masih kosong.';
      setErrorBanner(msg);
      notify(msg);
      return;
    }
    await handleStartWifiSend({
      content: createPersonalSyncJson('customers', data),
      fileName: `SimpelKasir_Pelanggan_${safeStoreSlug}_${todayStamp}.json`,
      count: data.customers.length,
      dataType: 'customers_json',
      successNotice: `Siap kirim ${formatNumber(data.customers.length)} pelanggan via WiFi!`,
    });
  };

  const handleSendFullBackupWifi = async () => {
    const totalItems =
      data.products.length + data.transactions.length + data.customers.length + data.cashflows.length;
    await handleStartWifiSend({
      content: createFullBackupJson(data),
      fileName: `SimpelKasir_Backup_${safeStoreSlug}_${todayStamp}.json`,
      count: totalItems,
      dataType: 'full_backup',
      successNotice: 'Siap kirim Backup Penuh Semua Data via WiFi!',
    });
  };

  const handleSendPersonalKindWifi = async (kind: PersonalSyncKind) => {
    if (kind === 'transactions_cashflow') {
      if (data.transactions.length === 0 && data.cashflows.length === 0) {
        const msg = 'Belum ada riwayat transaksi atau arus kas untuk dikirim.';
        setErrorBanner(msg);
        notify(msg);
        return;
      }
      await handleStartWifiSend({
        content: createPersonalSyncJson('transactions_cashflow', data),
        fileName: `SimpelKasir_Transaksi_${safeStoreSlug}_${todayStamp}.json`,
        count: data.transactions.length,
        dataType: 'transactions_cashflow',
        successNotice: `Siap kirim ${formatNumber(data.transactions.length)} transaksi & ${formatNumber(data.cashflows.length)} arus kas via WiFi!`,
      });
      return;
    }

    if (kind === 'quick_carts') {
      if (data.quickCarts.length === 0) {
        const msg = 'Daftar Transaksi Cepat masih kosong.';
        setErrorBanner(msg);
        notify(msg);
        return;
      }
      await handleStartWifiSend({
        content: createPersonalSyncJson('quick_carts', data),
        fileName: `SimpelKasir_TransaksiCepat_${safeStoreSlug}_${todayStamp}.json`,
        count: data.quickCarts.length,
        dataType: 'quick_carts',
        successNotice: `Siap kirim ${formatNumber(data.quickCarts.length)} Transaksi Cepat via WiFi!`,
      });
      return;
    }

    if (kind === 'master_settings') {
      const masterCount =
        data.master.suppliers.length + data.master.units.length + data.master.categories.length;
      await handleStartWifiSend({
        content: createPersonalSyncJson('master_settings', data),
        fileName: `SimpelKasir_Master_${safeStoreSlug}_${todayStamp}.json`,
        count: masterCount,
        dataType: 'master_settings',
        successNotice: 'Siap kirim Master Data & Pengaturan Toko via WiFi!',
      });
    }
  };

  const handleStartSendPickedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const parsed = parseProductsFromCsv(text);
      if (parsed.length === 0) {
        const msg = 'File CSV kosong atau format produk tidak sesuai';
        setErrorBanner(msg);
        notify(msg);
        return;
      }
      await handleStartWifiSend({
        content: text,
        fileName: file.name || 'Products.csv',
        count: parsed.length,
        dataType: 'products_csv',
        successNotice: `Siap mengirim ${file.name} (${formatNumber(parsed.length)} produk)`,
      });
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleStopSending = async () => {
    setErrorBanner(null);
    await stopWifiCsvServer();
    setServerInfo(null);
    notify('Pengiriman WiFi dihentikan');
  };

  const handleSaveSnapshotToSimpelKasirFolder = async () => {
    setErrorBanner(null);
    try {
      const csv = exportProductsToCsv(data.products);
      const res = await saveExportFile(
        `Products_SimpelKasir_${todayStamp}.csv`,
        csv,
        'text/csv;charset=utf-8;',
        'SimpelKasir'
      );
      notify(`Produk CSV tersimpan di ${res.savedPath}`);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal menyimpan file CSV produk';
      setErrorBanner(msg);
      notify(msg);
    }
  };

  const handleSaveCustomersCsv = async () => {
    setErrorBanner(null);
    if (data.customers.length === 0) {
      notify('Daftar pelanggan masih kosong');
      return;
    }
    try {
      const csv = exportCustomersToCsv(data.customers);
      const res = await saveExportFile(
        `Pelanggan_SimpelKasir_${todayStamp}.csv`,
        csv,
        'text/csv;charset=utf-8;',
        'SimpelKasir'
      );
      notify(`Daftar pelanggan tersimpan di ${res.savedPath}`);
    } catch (err) {
      const msg = (err as Error).message || 'Gagal menyimpan CSV pelanggan';
      setErrorBanner(msg);
      notify(msg);
    }
  };

  // =========================================================
  // BAGIAN 2B: TERIMA DATA VIA WIFI / FILE
  // =========================================================
  const handleDiscoverPeers = async () => {
    setErrorBanner(null);
    setScanning(true);
    try {
      const list = await discoverWifiCsvServers();
      setPeers(list);
      if (list.length === 0) {
        const msg =
          'Pengirim belum ditemukan. Pastikan: (1) HP Pengirim tetap di layar "Siap Dikirim via WiFi", (2) Ke-2 HP berada di WiFi atau Hotspot yang sama, atau ketik IP pengirim secara manual.';
        setErrorBanner(msg);
        notify('Belum ada HP pengirim ditemukan');
      } else {
        notify(`Ditemukan ${list.length} perangkat pengirim`);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Gagal mencari perangkat di WiFi / Hotspot';
      setErrorBanner(msg);
      notify(msg);
    } finally {
      setScanning(false);
    }
  };

  const routeIncomingEnvelope = (
    envelope: SyncPayloadEnvelope,
    fromStore: string,
    savedPath: string,
    sourceLabel: string
  ) => {
    if (envelope.kind === 'products_csv') {
      const imported = envelope.products;
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
      setLastReceivedSummary({
        headline: `${formatNumber(imported.length)} produk berhasil disinkron!`,
        savedPath,
        fromStore,
      });
      notify(`${formatNumber(imported.length)} produk diterima & disimpan di ${savedPath}`);
      return;
    }

    if (envelope.kind === 'full_backup') {
      setPendingBackupRestore({
        appData: envelope.appData,
        summary: envelope.summary,
        sourceLabel,
        savedPath,
      });
      return;
    }

    setPendingReceive({
      envelope,
      fromStore,
      savedPath,
      sourceLabel,
    });
  };

  const handleReceiveFromAddress = async (addr: string) => {
    setErrorBanner(null);
    const cleanAddr = addr.trim().replace(/\s+/g, '');
    if (!cleanAddr) {
      const msg = 'Masukkan alamat IP pengirim terlebih dahulu';
      setErrorBanner(msg);
      notify(msg);
      return;
    }
    setReceivingAddr(cleanAddr);
    try {
      const res = await downloadWifiCsvFromPeer(cleanAddr, true);
      const envelope = parseIncomingSyncPayload(res.content, res.dataType);
      if (!envelope) {
        const msg = 'File berhasil diunduh, tetapi format datanya kosong atau tidak dikenali SimpelKasir.';
        setErrorBanner(msg);
        notify(msg);
        return;
      }
      routeIncomingEnvelope(
        envelope,
        res.storeName || 'Perangkat Pengirim',
        res.savedPath || `Download/SimpelKasir/${res.fileName}`,
        res.fileName
      );
      if (res.saveWarning) {
        setErrorBanner(`Data berhasil diterima! Catatan penyimpanan file: ${res.saveWarning}`);
      }
    } catch (err) {
      const msg = (err as Error).message || 'Gagal menerima data dari pengirim';
      setErrorBanner(msg);
      notify(msg);
    } finally {
      setReceivingAddr(null);
    }
  };

  const handlePickIncomingFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorBanner(null);
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const isCustCsv =
        file.name.toLowerCase().includes('pelanggan') && file.name.toLowerCase().endsWith('.csv');
      const envelope = parseIncomingSyncPayload(text, isCustCsv ? 'customers_csv' : undefined);
      if (!envelope) {
        const msg = 'Isi file tidak dikenali. Pilih file .json atau .csv ekspor dari SimpelKasir.';
        setErrorBanner(msg);
        notify(msg);
        return;
      }
      routeIncomingEnvelope(envelope, 'File Lokal', file.name, file.name);
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const applyPendingReceive = (mode: 'merge' | 'replace') => {
    if (!pendingReceive) return;
    const { envelope, fromStore, savedPath } = pendingReceive;

    if (envelope.kind === 'customers') {
      if (mode === 'replace') {
        onUpdateData((prev) => ({
          ...prev,
          customers: envelope.customers,
        }));
        setLastReceivedSummary({
          headline: `${formatNumber(envelope.customers.length)} pelanggan diterima (mengganti daftar lama)!`,
          savedPath,
          fromStore,
        });
        notify(`${formatNumber(envelope.customers.length)} pelanggan menggantikan daftar lama`);
      } else {
        const result = mergeCustomersList(data.customers, envelope.customers);
        onUpdateData((prev) => ({
          ...prev,
          customers: result.merged,
        }));
        setLastReceivedSummary({
          headline: `Pelanggan digabung: ${formatNumber(result.added)} baru ditambahkan, ${formatNumber(result.updated)} diperbarui (total ${formatNumber(result.merged.length)}).`,
          savedPath,
          fromStore,
        });
        notify(`+${formatNumber(result.added)} pelanggan baru, ${formatNumber(result.updated)} diperbarui`);
      }
    } else if (envelope.kind === 'quick_carts') {
      if (mode === 'replace') {
        onUpdateData((prev) => ({
          ...prev,
          quickCarts: envelope.quickCarts,
        }));
        setLastReceivedSummary({
          headline: `${formatNumber(envelope.quickCarts.length)} Transaksi Cepat diterima (mengganti daftar lama)!`,
          savedPath,
          fromStore,
        });
        notify(`${formatNumber(envelope.quickCarts.length)} Transaksi Cepat diterapkan`);
      } else {
        onUpdateData((prev) => {
          const existingIds = new Set(prev.quickCarts.map((q) => q.id));
          const fresh = envelope.quickCarts.filter((q) => !existingIds.has(q.id));
          return {
            ...prev,
            quickCarts: [...fresh, ...prev.quickCarts],
          };
        });
        setLastReceivedSummary({
          headline: `Transaksi Cepat dari ${fromStore} digabungkan!`,
          savedPath,
          fromStore,
        });
        notify('Transaksi Cepat digabungkan');
      }
    } else if (envelope.kind === 'transactions_cashflow') {
      if (mode === 'replace') {
        onUpdateData((prev) => ({
          ...prev,
          transactions: envelope.transactions,
          cashflows: envelope.cashflows,
          nextReceiptNo: Math.max(1, envelope.nextReceiptNo || prev.nextReceiptNo),
        }));
        setLastReceivedSummary({
          headline: `${formatNumber(envelope.transactions.length)} transaksi & ${formatNumber(envelope.cashflows.length)} arus kas mengganti riwayat lama!`,
          savedPath,
          fromStore,
        });
        notify('Riwayat Transaksi & Arus Kas diganti');
      } else {
        let addedTx = 0;
        let addedCf = 0;
        onUpdateData((prev) => {
          const txIds = new Set(prev.transactions.map((t) => t.id));
          const cfIds = new Set(prev.cashflows.map((c) => c.id));
          const newTx = envelope.transactions.filter((t) => !txIds.has(t.id));
          const newCf = envelope.cashflows.filter((c) => !cfIds.has(c.id));
          addedTx = newTx.length;
          addedCf = newCf.length;
          return {
            ...prev,
            transactions: [...newTx, ...prev.transactions].sort((a, b) => b.createdAt - a.createdAt),
            cashflows: [...newCf, ...prev.cashflows].sort((a, b) => b.createdAt - a.createdAt),
            nextReceiptNo: Math.max(prev.nextReceiptNo, envelope.nextReceiptNo || 1),
          };
        });
        setLastReceivedSummary({
          headline: `Riwayat digabung: +${formatNumber(addedTx)} transaksi & +${formatNumber(addedCf)} arus kas baru!`,
          savedPath,
          fromStore,
        });
        notify('Riwayat Transaksi & Arus Kas digabung');
      }
    } else if (envelope.kind === 'master_settings') {
      if (mode === 'replace') {
        onUpdateData((prev) => ({
          ...prev,
          master: envelope.master,
          store: envelope.store,
          users: envelope.users && envelope.users.length > 0 ? envelope.users : prev.users,
          businessFlags: envelope.businessFlags,
          productSettings: envelope.productSettings,
          receiptSettings: envelope.receiptSettings,
          currencySymbol: envelope.currencySymbol || prev.currencySymbol,
        }));
        setLastReceivedSummary({
          headline: 'Master Data, Profil Toko & Pengaturan berhasil diganti!',
          savedPath,
          fromStore,
        });
        notify('Master & Pengaturan Toko diperbarui');
      } else {
        onUpdateData((prev) => {
          const units = Array.from(new Set([...prev.master.units, ...envelope.master.units]));
          const categories = Array.from(
            new Set([...prev.master.categories, ...envelope.master.categories])
          );
          const supMap = new Map(prev.master.suppliers.map((s) => [s.id, s]));
          envelope.master.suppliers.forEach((s) => {
            if (!supMap.has(s.id)) supMap.set(s.id, s);
          });
          return {
            ...prev,
            master: {
              units,
              categories,
              suppliers: Array.from(supMap.values()),
            },
          };
        });
        setLastReceivedSummary({
          headline: 'Master Data (Satuan, Kategori, Supplier) digabungkan tanpa menghapus profil toko ini!',
          savedPath,
          fromStore,
        });
        notify('Master Data berhasil digabungkan');
      }
    }

    setPendingReceive(null);
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-12">
      <TopBar title="Sinkron & Backup" mode="menu" onLeftClick={onOpenDrawer} />

      <div className="mx-auto w-full max-w-4xl p-4 space-y-4">
        {errorBanner && (
          <div className="rounded-2xl border border-[#B54B54]/40 bg-[#B54B54]/10 p-3.5 flex items-start gap-2.5 text-xs text-[#8D2E37] dark:text-[#F4A5AC]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <p className="flex-1 leading-relaxed break-words">{errorBanner}</p>
            <button
              type="button"
              onClick={() => setErrorBanner(null)}
              className="shrink-0 p-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Tutup pesan"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* =======================================================
            BAGIAN 1: BACKUP & RESTORE PENUH SEMUA DATA (.JSON)
           ======================================================= */}
        <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3.5">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/12 text-[#165B49] dark:text-[#4BB89A]">
              <Database className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <h2 className="font-display text-base font-bold text-[#17252B] dark:text-white">
                Backup & Restore Penuh (.json)
              </h2>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                Simpan cadangan lengkap aplikasi SimpelKasir ke file <code className="font-mono">.json</code> atau pulihkan seluruh data toko dari file backup luar.
              </p>
            </div>
          </div>

          {/* Keterangan rinci apa saja yang ikut di-backup */}
          <div className="rounded-xl border border-[#DCE1DC] dark:border-[#2A3944] bg-[#F6F8F5] dark:bg-[#1B262E] p-3 space-y-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#165B49] dark:text-[#4BB89A]">
              Backup mencakup semua data toko saat ini:
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-slate-700 dark:text-slate-200 sm:grid-cols-3">
              <div>• Produk &amp; Stok: <b>{formatNumber(currentSummary.productsCount)}</b></div>
              <div>• Riwayat Transaksi: <b>{formatNumber(currentSummary.transactionsCount)}</b></div>
              <div>• Arus Kas &amp; Biaya: <b>{formatNumber(currentSummary.cashflowsCount)}</b></div>
              <div>• Daftar Pelanggan: <b>{formatNumber(currentSummary.customersCount)}</b></div>
              <div>• Supplier: <b>{formatNumber(currentSummary.suppliersCount)}</b></div>
              <div>• Transaksi Cepat: <b>{formatNumber(currentSummary.quickCartsCount)}</b></div>
              <div>• Satuan &amp; Kategori: <b>{currentSummary.unitsCount}/{currentSummary.categoriesCount}</b></div>
              <div>• User / Kasir: <b>{formatNumber(currentSummary.usersCount)}</b></div>
              <div>• No. Struk &amp; Pengaturan Toko</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={handleSaveFullBackup}
              className="btn-lux-primary flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs font-bold"
            >
              <Download className="h-4 w-4 shrink-0" />
              <span>Simpan Backup Penuh</span>
            </button>
            <button
              type="button"
              onClick={handleShareFullBackup}
              className="btn-lux-gold flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs font-bold"
            >
              <Share2 className="h-4 w-4 shrink-0" />
              <span>Bagikan File Backup</span>
            </button>
            <button
              type="button"
              onClick={() => fullBackupInputRef.current?.click()}
              className="btn-lux-obsidian flex items-center justify-center gap-2 rounded-xl py-3 px-3 text-xs font-bold"
            >
              <Upload className="h-4 w-4 shrink-0" />
              <span>Restore File Backup (.json)</span>
            </button>
          </div>

          <input
            ref={fullBackupInputRef}
            type="file"
            accept=".json,application/json,text/plain,application/octet-stream,*/*"
            className="hidden"
            onChange={handleFullBackupFilePicked}
          />
        </div>

        {/* =======================================================
            BAGIAN 2: KIRIM & TERIMA ANTAR HP VIA WIFI / HOTSPOT
           ======================================================= */}
        <div className="surface-card rounded-2xl p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/12 text-[#165B49] dark:text-[#4BB89A]">
            <Wifi className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p className="font-display text-sm font-bold text-[#17252B] dark:text-white">
              Kirim &amp; Terima Data Personal via WiFi / Hotspot
            </p>
            <p className="mt-0.5">
              Hubungkan HP ke <b>WiFi atau Hotspot yang sama</b> (tanpa kuota internet). Bisa kirim <b>Daftar Pelanggan</b>, <b>Produk (.csv)</b>, <b>Backup Penuh</b>, maupun data penting lain secara langsung.
            </p>
          </div>
        </div>

        {/* Mode Switcher: KIRIM vs TERIMA */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#E6EAE5] dark:bg-[#1A242B] p-1.5">
          <button
            type="button"
            onClick={() => {
              setErrorBanner(null);
              setTab('send');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
              tab === 'send' ? 'btn-lux-primary' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Kirim Data</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setErrorBanner(null);
              setTab('receive');
            }}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
              tab === 'receive' ? 'btn-lux-primary' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Terima Data</span>
          </button>
        </div>

        {/* TAB 1: KIRIM */}
        {tab === 'send' && (
          <div className="space-y-4">
            {serverInfo ? (
              <div className="surface-card rounded-2xl p-5 border-2 border-[#165B49]/40 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <Radio className="h-6 w-6 text-[#165B49] dark:text-[#4BB89A] animate-pulse" />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-base font-bold text-[#165B49] dark:text-[#4BB89A]">
                          Siap Dikirim via WiFi
                        </p>
                        <span className="rounded-lg bg-[#165B49]/12 px-2 py-0.5 text-[11px] font-bold text-[#165B49] dark:text-[#4BB89A]">
                          {getDataTypeBadge(serverInfo.dataType, serverInfo.fileName)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {serverInfo.deviceName} · {formatNumber(serverInfo.productCount)} item
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-[#F3F5F2] dark:bg-[#1B262E] p-3.5 space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Alamat Pengirim (jika ketik manual di HP lain)
                  </p>
                  {serverInfo.ips.map((ip) => (
                    <p
                      key={ip}
                      className="font-mono-tabular text-lg font-extrabold text-[#17252B] dark:text-white"
                    >
                      {ip}:{serverInfo.port}
                    </p>
                  ))}
                  <p className="text-xs text-slate-500 pt-1">
                    File: <span className="font-medium break-all">{serverInfo.fileName}</span>
                  </p>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Di HP penerima: buka menu <b>Sinkron &amp; Backup → Terima Data → Cari Pengirim</b>, lalu ketuk perangkat ini.
                </p>

                <button
                  type="button"
                  onClick={handleStopSending}
                  className="btn-lux-garnet flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold"
                >
                  <StopCircle className="h-5 w-5" />
                  Hentikan Pengiriman WiFi
                </button>
              </div>
            ) : (
              <>
                {/* Card A: Kirim Daftar Pelanggan */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Users className="h-5 w-5 text-[#165B49] dark:text-[#4BB89A]" />
                    <div>
                      <h3 className="font-display text-sm font-bold">Kirim Daftar Pelanggan</h3>
                      <p className="text-xs text-slate-500">
                        Kirim {formatNumber(data.customers.length)} data pelanggan (nama, no HP, alamat, catatan) antar HP via WiFi atau simpan CSV.
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={startingSend}
                      onClick={handleSendCustomersWifi}
                      className="btn-lux-primary flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold disabled:opacity-60"
                    >
                      <Upload className="h-4 w-4" />
                      <span>Kirim Pelanggan via WiFi ({formatNumber(data.customers.length)})</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveCustomersCsv}
                      className="btn-lux-soft flex items-center justify-center gap-2 rounded-xl py-3 text-xs font-semibold text-[#165B49] dark:text-[#4BB89A]"
                    >
                      <FolderCheck className="h-4 w-4" />
                      <span>Simpan CSV Pelanggan</span>
                    </button>
                  </div>
                </div>

                {/* Card B: Kirim Produk CSV */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="h-5 w-5 text-[#165B49] dark:text-[#4BB89A]" />
                    <div>
                      <h3 className="font-display text-sm font-bold">Kirim Data Produk (.csv) via WiFi</h3>
                      <p className="text-xs text-slate-500">
                        Bagikan {formatNumber(data.products.length)} produk saat ini atau pilih file .csv lain dari HP.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={startingSend}
                    onClick={handleSendAppProducts}
                    className="btn-lux-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-60"
                  >
                    <Upload className="h-4 w-4" />
                    {startingSend
                      ? 'Menyiapkan Server WiFi...'
                      : `Kirim Produk Aplikasi (${formatNumber(data.products.length)})`}
                  </button>

                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={startingSend}
                      onClick={() => customCsvInputRef.current?.click()}
                      className="btn-lux-gold flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-bold disabled:opacity-60"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Pilih File .CSV dari HP</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveSnapshotToSimpelKasirFolder}
                      className="btn-lux-soft flex items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-[#165B49] dark:text-[#4BB89A]"
                    >
                      <FolderCheck className="h-4 w-4" />
                      <span>Simpan Produk CSV</span>
                    </button>
                  </div>

                  <input
                    ref={customCsvInputRef}
                    type="file"
                    accept=".csv,.txt,text/csv,text/comma-separated-values,text/plain,application/vnd.ms-excel,application/csv,application/octet-stream,*/*"
                    className="hidden"
                    onChange={handleStartSendPickedFile}
                  />
                </div>

                {/* Card C: Kirim Data Penting Lain Secara Personal */}
                <div className="surface-card rounded-2xl p-4 sm:p-5 space-y-3">
                  <div>
                    <h3 className="font-display text-sm font-bold">Kirim Data Penting Lain (Personal via WiFi)</h3>
                    <p className="text-xs text-slate-500">
                      Pilih data tertentu saja yang ingin Anda kirim langsung ke HP lain tanpa memindahkan seluruh isi toko, atau kirim semua sekaligus.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <button
                      type="button"
                      disabled={startingSend}
                      onClick={() => handleSendPersonalKindWifi('transactions_cashflow')}
                      className="btn-lux-soft flex items-center gap-3 rounded-xl p-3 text-left disabled:opacity-60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/12 text-[#165B49] dark:text-[#4BB89A]">
                        <ReceiptText className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xs font-bold text-[#17252B] dark:text-white">
                          Riwayat Transaksi &amp; Arus Kas
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {formatNumber(data.transactions.length)} transaksi · {formatNumber(data.cashflows.length)} arus kas
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={startingSend}
                      onClick={() => handleSendPersonalKindWifi('quick_carts')}
                      className="btn-lux-soft flex items-center gap-3 rounded-xl p-3 text-left disabled:opacity-60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#916E2F]/12 text-[#916E2F] dark:text-[#D5B26E]">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xs font-bold text-[#17252B] dark:text-white">
                          Transaksi Cepat
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {formatNumber(data.quickCarts.length)} pesanan tersimpan
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={startingSend}
                      onClick={() => handleSendPersonalKindWifi('master_settings')}
                      className="btn-lux-soft flex items-center gap-3 rounded-xl p-3 text-left disabled:opacity-60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#24343F]/12 text-[#24343F] dark:text-slate-300">
                        <Layers className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xs font-bold text-[#17252B] dark:text-white">
                          Master &amp; Pengaturan Toko
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {data.master.suppliers.length} supplier, satuan, kategori, profil
                        </p>
                      </div>
                    </button>

                    <button
                      type="button"
                      disabled={startingSend}
                      onClick={handleSendFullBackupWifi}
                      className="btn-lux-obsidian flex items-center gap-3 rounded-xl p-3 text-left disabled:opacity-60"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/12 text-white">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-xs font-bold text-white">
                          Kirim Backup Penuh Semua Data
                        </p>
                        <p className="text-[11px] text-white/75 truncate">
                          Pindah seluruh toko ke HP lain via WiFi
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 2: TERIMA */}
        {tab === 'receive' && (
          <div className="space-y-4">
            <div className="surface-card rounded-2xl p-5 space-y-3">
              <div>
                <h3 className="font-display text-sm font-bold">1. Cari Pengirim Otomatis</h3>
                <p className="text-xs text-slate-500">
                  Berfungsi untuk menerima <b>Daftar Pelanggan</b>, <b>Produk CSV</b>, <b>Backup Penuh</b>, maupun data personal lainnya di WiFi / Hotspot yang sama.
                </p>
              </div>

              <button
                type="button"
                disabled={scanning || Boolean(receivingAddr)}
                onClick={handleDiscoverPeers}
                className="btn-lux-primary flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
                {scanning ? 'Mencari HP Pengirim (±2 detik)...' : 'Cari Pengirim di WiFi / Hotspot'}
              </button>

              {peers.length > 0 && (
                <div className="divide-y divide-[#EAECE8] dark:divide-[#223039] rounded-2xl border border-[#DCE1DC] dark:border-[#2A3944]">
                  {peers.map((peer) => {
                    const addr = `${peer.ip}:${peer.port}`;
                    const busy = receivingAddr === addr;
                    return (
                      <div key={addr} className="flex items-center justify-between gap-3 p-3.5">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-display text-sm font-bold flex items-center gap-1.5 truncate">
                              <Smartphone className="h-4 w-4 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
                              <span className="truncate">{peer.storeName} · {peer.deviceName}</span>
                            </p>
                            <span className="rounded-lg bg-[#165B49]/12 px-2 py-0.5 text-[10px] font-bold text-[#165B49] dark:text-[#4BB89A]">
                              {getDataTypeBadge(peer.dataType, peer.fileName)}
                            </span>
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 font-mono-tabular">
                            {addr} · {getPeerCountLabel(peer)}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={Boolean(receivingAddr)}
                          onClick={() => handleReceiveFromAddress(addr)}
                          className="btn-lux-gold shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold disabled:opacity-60"
                        >
                          {busy ? 'Mengunduh...' : 'Terima'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="surface-card rounded-2xl p-5 space-y-3">
              <div>
                <h3 className="font-display text-sm font-bold">2. Atau Masukkan Alamat IP Manual</h3>
                <p className="text-xs text-slate-500">
                  Isi angka IP yang tampil di layar HP pengirim (contoh: <span className="font-mono">192.168.43.1:8765</span>).
                </p>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualAddress}
                  onChange={(e) => setManualAddress(e.target.value)}
                  placeholder="192.168.43.1:8765"
                  className="font-mono-tabular flex-1 rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#165B49]"
                />
                <button
                  type="button"
                  disabled={Boolean(receivingAddr)}
                  onClick={() => handleReceiveFromAddress(manualAddress)}
                  className="btn-lux-obsidian shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold disabled:opacity-60"
                >
                  {receivingAddr && receivingAddr === manualAddress.trim() ? 'Proses...' : 'Terima'}
                </button>
              </div>
            </div>

            <div className="surface-card rounded-2xl p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xs font-bold">3. Terima dari File HP (.json / .csv)</p>
                <p className="text-[11px] text-slate-500">
                  Impor file Daftar Pelanggan (.csv/.json), Produk (.csv), atau data SimpelKasir kiriman WhatsApp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => receiveFileInputRef.current?.click()}
                className="btn-lux-soft shrink-0 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#165B49] dark:text-[#4BB89A]"
              >
                Pilih File
              </button>
              <input
                ref={receiveFileInputRef}
                type="file"
                accept=".json,.csv,.txt,application/json,text/csv,text/plain,application/octet-stream,*/*"
                className="hidden"
                onChange={handlePickIncomingFile}
              />
            </div>

            {lastReceivedSummary && (
              <div className="surface-card rounded-2xl p-4 border border-[#165B49]/40 bg-[#165B49]/6 space-y-1">
                <p className="font-display flex items-center gap-2 text-sm font-bold text-[#165B49] dark:text-[#4BB89A]">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>{lastReceivedSummary.headline}</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Sumber: <b>{lastReceivedSummary.fromStore}</b>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  File tersimpan di: <b className="font-mono break-all">{lastReceivedSummary.savedPath}</b>
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL PRATINJAU & KONFIRMASI RESTORE BACKUP PENUH (GANTI SEMUA) */}
      {pendingBackupRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/60 backdrop-blur-xs p-4">
          <div className="surface-card animate-modal-in w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#B54B54]/12 text-[#B54B54]">
                <ShieldAlert className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-base font-bold text-[#17252B] dark:text-white">
                  Pratinjau Restore Backup Penuh
                </h3>
                <p className="text-xs text-slate-500 truncate">{pendingBackupRestore.sourceLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingBackupRestore(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-[#DCE1DC] dark:border-[#2A3944] bg-[#F7F8F5] dark:bg-[#1B262E] p-3.5 space-y-2 text-xs">
              <div className="flex items-center justify-between border-b border-[#E3E7E2] dark:border-[#293742] pb-2">
                <span className="text-slate-500">Nama Toko</span>
                <span className="font-bold text-[#17252B] dark:text-white">
                  {pendingBackupRestore.summary.storeName}
                </span>
              </div>
              {pendingBackupRestore.summary.exportedAt && (
                <div className="flex items-center justify-between border-b border-[#E3E7E2] dark:border-[#293742] pb-2">
                  <span className="text-slate-500">Tanggal Backup</span>
                  <span className="font-semibold">
                    {formatDateShort(pendingBackupRestore.summary.exportedAt)}
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>Produk: <b>{formatNumber(pendingBackupRestore.summary.productsCount)}</b></div>
                <div>Transaksi: <b>{formatNumber(pendingBackupRestore.summary.transactionsCount)}</b></div>
                <div>Arus Kas: <b>{formatNumber(pendingBackupRestore.summary.cashflowsCount)}</b></div>
                <div>Pelanggan: <b>{formatNumber(pendingBackupRestore.summary.customersCount)}</b></div>
                <div>Supplier: <b>{formatNumber(pendingBackupRestore.summary.suppliersCount)}</b></div>
                <div>Transaksi Cepat: <b>{formatNumber(pendingBackupRestore.summary.quickCartsCount)}</b></div>
                <div>User/Kasir: <b>{formatNumber(pendingBackupRestore.summary.usersCount)}</b></div>
                <div>No. Struk Terakhir: <b>#{pendingBackupRestore.summary.nextReceiptNo}</b></div>
              </div>
            </div>

            <p className="rounded-xl bg-[#B54B54]/10 border border-[#B54B54]/25 p-3 text-xs leading-relaxed text-[#8D2E37] dark:text-[#F4A5AC]">
              <b>Perhatian:</b> Mode Restore akan <b>mengganti seluruh data aplikasi saat ini</b> (produk, transaksi, arus kas, pelanggan, profil toko, dan pengaturan) dengan isi file backup ini.
            </p>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setPendingBackupRestore(null)}
                className="btn-lux-soft flex-1 rounded-xl py-3 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={confirmFullBackupRestore}
                className="btn-lux-primary flex-1 rounded-xl py-3 text-xs font-bold"
              >
                Pulihkan &amp; Ganti Data
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL KONFIRMASI PENERIMAAN DATA PERSONAL (PELANGGAN / TRANSAKSI / MASTER / CEPAT) */}
      {pendingReceive && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/60 backdrop-blur-xs p-4">
          <div className="surface-card animate-modal-in w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-base font-bold text-[#17252B] dark:text-white">
                  Data Diterima dari {pendingReceive.fromStore}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">{pendingReceive.sourceLabel}</p>
              </div>
              <button
                type="button"
                onClick={() => setPendingReceive(null)}
                className="rounded-xl p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-2xl border border-[#DCE1DC] dark:border-[#2A3944] bg-[#F7F8F5] dark:bg-[#1B262E] p-3.5 text-xs space-y-1.5">
              {pendingReceive.envelope.kind === 'customers' && (
                <>
                  <p className="font-bold text-[#165B49] dark:text-[#4BB89A]">
                    Daftar Pelanggan ({formatNumber(pendingReceive.envelope.customers.length)} orang)
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Pilih <b>Gabung</b> untuk menambah pelanggan baru tanpa menghapus daftar saat ini, atau <b>Ganti Semua</b>.
                  </p>
                </>
              )}
              {pendingReceive.envelope.kind === 'quick_carts' && (
                <>
                  <p className="font-bold text-[#916E2F] dark:text-[#D5B26E]">
                    Transaksi Cepat ({formatNumber(pendingReceive.envelope.quickCarts.length)} paket)
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Pilih <b>Gabung</b> untuk menambahkan ke daftar saat ini, atau <b>Ganti Semua</b>.
                  </p>
                </>
              )}
              {pendingReceive.envelope.kind === 'transactions_cashflow' && (
                <>
                  <p className="font-bold text-[#165B49] dark:text-[#4BB89A]">
                    Riwayat Transaksi ({formatNumber(pendingReceive.envelope.transactions.length)}) &amp; Arus Kas ({formatNumber(pendingReceive.envelope.cashflows.length)})
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Pilih <b>Gabung</b> untuk menambah catatan yang belum ada, atau <b>Ganti Semua</b>.
                  </p>
                </>
              )}
              {pendingReceive.envelope.kind === 'master_settings' && (
                <>
                  <p className="font-bold text-[#17252B] dark:text-white">
                    Master Data &amp; Pengaturan Toko ({pendingReceive.envelope.master.suppliers.length} supplier, {pendingReceive.envelope.master.units.length} satuan, {pendingReceive.envelope.master.categories.length} kategori)
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Pilih <b>Gabung Master</b> agar hanya menambah satuan/kategori/supplier tanpa mengubah nama toko ini, atau <b>Ganti Semua</b>.
                  </p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => applyPendingReceive('merge')}
                className="btn-lux-primary w-full rounded-xl py-3 text-xs font-bold"
              >
                {pendingReceive.envelope.kind === 'master_settings'
                  ? 'Gabung Master Data Saja (Aman)'
                  : 'Gabung Tanpa Hapus Data Lama (Disarankan)'}
              </button>
              <button
                type="button"
                onClick={() => applyPendingReceive('replace')}
                className="btn-lux-garnet w-full rounded-xl py-2.5 text-xs font-bold"
              >
                Ganti Semua Data Bagian Ini
              </button>
              <button
                type="button"
                onClick={() => setPendingReceive(null)}
                className="btn-lux-soft w-full rounded-xl py-2.5 text-xs font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
