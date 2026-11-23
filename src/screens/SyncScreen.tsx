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
} from 'lucide-react';
import { AppData } from '../types';
import { TopBar } from '../components/TopBar';
import { exportProductsToCsv, formatNumber, parseProductsFromCsv } from '../utils/storage';
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
  notify: (msg: string) => void;
}

export const SyncScreen: React.FC<SyncScreenProps> = ({
  data,
  onOpenDrawer,
  onUpdateData,
  notify,
}) => {
  const [tab, setTab] = useState<'send' | 'receive'>('send');
  const [startingSend, setStartingSend] = useState(false);
  const [serverInfo, setServerInfo] = useState<WifiSyncServerInfo | null>(null);
  const [scanning, setScanning] = useState(false);
  const [peers, setPeers] = useState<WifiDiscoveredPeer[]>([]);
  const [manualAddress, setManualAddress] = useState('');
  const [receivingAddr, setReceivingAddr] = useState<string | null>(null);
  const [lastReceivedSummary, setLastReceivedSummary] = useState<{
    count: number;
    savedPath: string;
    fromStore: string;
  } | null>(null);

  const customCsvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      stopWifiCsvServer().catch(() => {});
    };
  }, []);

  const applyCsvAndSaveSummary = (
    csvText: string,
    savedPath: string,
    fromStore: string
  ) => {
    const imported = parseProductsFromCsv(csvText);
    if (imported.length === 0) {
      notify('File CSV diterima, tetapi kosong atau format produk tidak terbaca');
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
    setLastReceivedSummary({
      count: imported.length,
      savedPath,
      fromStore,
    });
    notify(`${formatNumber(imported.length)} produk diterima & disimpan di ${savedPath}`);
  };

  const handleStartSendAppProducts = async () => {
    if (data.products.length === 0) {
      notify('Daftar produk kosong. Pilih file CSV lain atau tambahkan produk dulu.');
      return;
    }
    setStartingSend(true);
    try {
      const csv = exportProductsToCsv(data.products);
      const stamp = new Date().toISOString().slice(0, 10);
      const safeStore = (data.store.name || 'SimpelKasir').replace(/[^a-zA-Z0-9_-]+/g, '_');
      const info = await startWifiCsvServer({
        content: csv,
        fileName: `Products_${safeStore}_${stamp}.csv`,
        storeName: data.store.name || 'SimpelKasir',
        productCount: data.products.length,
      });
      setServerInfo(info);
      notify('Mode kirim WiFi aktif! Silakan terima dari HP lain.');
    } catch (err) {
      notify((err as Error).message || 'Gagal mengaktifkan pengiriman WiFi');
    } finally {
      setStartingSend(false);
    }
  };

  const handleStartSendPickedFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const text = String(reader.result || '');
      const parsed = parseProductsFromCsv(text);
      if (parsed.length === 0) {
        notify('File CSV kosong atau format produk tidak sesuai');
        return;
      }
      setStartingSend(true);
      try {
        const info = await startWifiCsvServer({
          content: text,
          fileName: file.name || 'Products.csv',
          storeName: data.store.name || 'SimpelKasir',
          productCount: parsed.length,
        });
        setServerInfo(info);
        notify(`Siap mengirim ${file.name} (${formatNumber(parsed.length)} produk)`);
      } catch (err) {
        notify((err as Error).message || 'Gagal mengaktifkan pengiriman WiFi');
      } finally {
        setStartingSend(false);
      }
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  };

  const handleStopSending = async () => {
    await stopWifiCsvServer();
    setServerInfo(null);
    notify('Pengiriman WiFi dihentikan');
  };

  const handleDiscoverPeers = async () => {
    setScanning(true);
    try {
      const list = await discoverWifiCsvServers();
      setPeers(list);
      if (list.length === 0) {
        notify('Belum ada HP pengirim ditemukan. Pastikan tombol Kirim di HP pengirim sudah aktif.');
      } else {
        notify(`Ditemukan ${list.length} perangkat pengirim`);
      }
    } catch (err) {
      notify((err as Error).message || 'Gagal mencari perangkat di WiFi / Hotspot');
    } finally {
      setScanning(false);
    }
  };

  const handleReceiveFromAddress = async (addr: string) => {
    const cleanAddr = addr.trim();
    if (!cleanAddr) {
      notify('Masukkan alamat IP pengirim terlebih dahulu');
      return;
    }
    setReceivingAddr(cleanAddr);
    try {
      const res = await downloadWifiCsvFromPeer(cleanAddr, true);
      applyCsvAndSaveSummary(
        res.content,
        res.savedPath || `Download/SimpelKasir/${res.fileName}`,
        res.storeName || 'Perangkat Pengirim'
      );
    } catch (err) {
      notify((err as Error).message || 'Gagal menerima file CSV dari pengirim');
    } finally {
      setReceivingAddr(null);
    }
  };

  const handleSaveSnapshotToSimpelKasirFolder = async () => {
    try {
      const csv = exportProductsToCsv(data.products);
      const stamp = new Date().toISOString().slice(0, 10);
      const res = await saveExportFile(
        `Products_SimpelKasir_${stamp}.csv`,
        csv,
        'text/csv;charset=utf-8;',
        'SimpelKasir'
      );
      notify(`Tersimpan di ${res.savedPath}`);
    } catch (err) {
      notify((err as Error).message || 'Gagal menyimpan file CSV');
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F6F4] dark:bg-[#0E1418] pb-10">
      <TopBar title="Sinkron" mode="menu" onLeftClick={onOpenDrawer} />

      <div className="mx-auto w-full max-w-4xl p-4 space-y-4">
        {/* Info Hotspot Banner */}
        <div className="surface-card rounded-2xl p-4 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/12 text-[#165B49] dark:text-[#4BB89A]">
            <Wifi className="h-5 w-5" />
          </div>
          <div className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
            <p className="font-display text-sm font-bold text-[#17252B] dark:text-white">
              Kirim & Terima Produk CSV via WiFi / Hotspot
            </p>
            <p className="mt-0.5">
              Hubungkan ke-3 HP ke <b>WiFi atau Hotspot yang sama</b> (tanpa kuota internet). File yang diterima otomatis memperbarui produk aplikasi sekaligus tersimpan di folder <b>Download/SimpelKasir</b>.
            </p>
          </div>
        </div>

        {/* Mode Switcher: KIRIM vs TERIMA */}
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-[#E6EAE5] dark:bg-[#1A242B] p-1.5">
          <button
            type="button"
            onClick={() => setTab('send')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
              tab === 'send' ? 'btn-lux-primary' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Upload className="h-4 w-4" />
            <span>Kirim CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('receive')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition ${
              tab === 'receive' ? 'btn-lux-primary' : 'text-slate-600 dark:text-slate-300'
            }`}
          >
            <Download className="h-4 w-4" />
            <span>Terima CSV</span>
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
                      <p className="font-display text-base font-bold text-[#165B49] dark:text-[#4BB89A]">
                        Siap Dikirim via WiFi
                      </p>
                      <p className="text-xs text-slate-500">
                        {serverInfo.deviceName} · {formatNumber(serverInfo.productCount)} produk
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
                    File: <span className="font-medium">{serverInfo.fileName}</span>
                  </p>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Di HP penerima: buka menu <b>Sinkron → Terima CSV → Cari Pengirim</b>, lalu ketuk perangkat ini.
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
              <div className="surface-card rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="h-5 w-5 text-[#165B49] dark:text-[#4BB89A]" />
                  <div>
                    <h3 className="font-display text-sm font-bold">Kirim Data Produk via WiFi / Hotspot</h3>
                    <p className="text-xs text-slate-500">
                      Bagikan {formatNumber(data.products.length)} produk saat ini atau pilih file .csv lain dari HP.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={startingSend}
                  onClick={handleStartSendAppProducts}
                  className="btn-lux-primary flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold disabled:opacity-60"
                >
                  <Upload className="h-5 w-5" />
                  {startingSend
                    ? 'Menyiapkan Server WiFi...'
                    : `Kirim Produk Aplikasi (${formatNumber(data.products.length)})`}
                </button>

                <button
                  type="button"
                  disabled={startingSend}
                  onClick={() => customCsvInputRef.current?.click()}
                  className="btn-lux-gold flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold disabled:opacity-60"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Atau Pilih File .CSV dari Penyimpanan HP
                </button>

                <button
                  type="button"
                  onClick={handleSaveSnapshotToSimpelKasirFolder}
                  className="btn-lux-soft flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold text-[#165B49] dark:text-[#4BB89A]"
                >
                  <FolderCheck className="h-4 w-4" />
                  Simpan Salinan CSV ke Folder Download/SimpelKasir
                </button>

                <input
                  ref={customCsvInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/comma-separated-values,text/plain,application/vnd.ms-excel,application/csv,application/octet-stream,*/*"
                  className="hidden"
                  onChange={handleStartSendPickedFile}
                />
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TERIMA */}
        {tab === 'receive' && (
          <div className="space-y-4">
            <div className="surface-card rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-display text-sm font-bold">1. Cari Pengirim Otomatis</h3>
                  <p className="text-xs text-slate-500">
                    Pastikan HP pengirim sudah menekan tombol <b>Kirim CSV</b> di WiFi / Hotspot yang sama.
                  </p>
                </div>
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
                          <p className="font-display text-sm font-bold flex items-center gap-1.5 truncate">
                            <Smartphone className="h-4 w-4 shrink-0 text-[#165B49] dark:text-[#4BB89A]" />
                            <span className="truncate">{peer.storeName} · {peer.deviceName}</span>
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 font-mono-tabular">
                            {addr} · {formatNumber(peer.productCount)} produk
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

            {lastReceivedSummary && (
              <div className="surface-card rounded-2xl p-4 border border-[#165B49]/40 bg-[#165B49]/6 space-y-1">
                <p className="font-display flex items-center gap-2 text-sm font-bold text-[#165B49] dark:text-[#4BB89A]">
                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                  <span>{formatNumber(lastReceivedSummary.count)} produk berhasil disinkron!</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Sumber: <b>{lastReceivedSummary.fromStore}</b>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  File tersimpan di: <b className="font-mono">{lastReceivedSummary.savedPath}</b>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
