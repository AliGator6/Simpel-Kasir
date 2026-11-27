import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  KeyRound,
  Lock,
  MessageCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Smartphone,
  Trash2,
  Unlock,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { SimpelKasirLogo } from './Logo';
import {
  GeneratedLicenseRecord,
  LicenseEvaluation,
  LicensePlanOption,
  VendorPaymentStatus,
  formatActivationInput,
  formatDeviceId,
  generateActivationCode,
  getVendorCustomerExpiryBadge,
  loadVendorHistory,
  mergeVendorBackupRecords,
  normalizeWhatsAppPhone,
  saveVendorHistory,
  upsertVendorCustomerRecord,
  verifyActivationCode,
  verifyVendorPin,
} from '../utils/license';
import { formatDateShort, toDateKey } from '../utils/storage';
import { saveExportFile } from '../utils/printer';

interface ActivationGateScreenProps {
  mode: 'locked' | 'modal';
  deviceId: string;
  maxSeenMs: number;
  evaluation: LicenseEvaluation;
  onActivateSuccess: (normalizedCode: string) => void;
  onRecheckClock?: () => void;
  onClose?: () => void;
  onOpenVendorGenerator: () => void;
  notify: (msg: string) => void;
}

export const ActivationGateScreen: React.FC<ActivationGateScreenProps> = ({
  mode,
  deviceId,
  maxSeenMs,
  evaluation,
  onActivateSuccess,
  onRecheckClock,
  onClose,
  onOpenVendorGenerator,
  notify,
}) => {
  const [codeInput, setCodeInput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [copiedId, setCopiedId] = useState(false);
  const tapCountRef = useRef(0);
  const tapTimerRef = useRef<number | null>(null);

  const handleCopyDeviceId = async () => {
    try {
      await navigator.clipboard.writeText(deviceId);
      setCopiedId(true);
      notify(`ID Perangkat ${deviceId} disalin`);
      window.setTimeout(() => setCopiedId(false), 1800);
    } catch {
      notify(`ID Perangkat Anda: ${deviceId}`);
    }
  };

  const handleSecretTap = () => {
    tapCountRef.current += 1;
    if (tapTimerRef.current) window.clearTimeout(tapTimerRef.current);
    tapTimerRef.current = window.setTimeout(() => {
      tapCountRef.current = 0;
    }, 2200);
    if (tapCountRef.current >= 7) {
      tapCountRef.current = 0;
      onOpenVendorGenerator();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    const effectiveNowMs = Math.max(Date.now(), maxSeenMs || 0);
    const result = verifyActivationCode(codeInput, deviceId, effectiveNowMs);
    if (!result.valid || !result.normalizedCode) {
      setErrorMsg(result.reason || 'Kode aktivasi tidak valid.');
      return;
    }
    onActivateSuccess(result.normalizedCode);
  };

  const waRequestText = `Halo Admin SimpelKasir, saya mau aktivasi / coba aplikasi kasir.\nID Perangkat: ${deviceId}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(waRequestText)}`;

  const cardBody = (
    <div className="surface-card animate-modal-in w-full max-w-md rounded-3xl p-5 sm:p-6 shadow-2xl space-y-5">
      <div className="flex items-start justify-between gap-3">
        <button
          type="button"
          onClick={handleSecretTap}
          className="flex items-center gap-3 text-left"
        >
          <SimpelKasirLogo size={42} />
          <div>
            <h2 className="font-display text-lg font-bold text-[#17252B] dark:text-white leading-tight">
              Aktivasi SimpelKasir
            </h2>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {evaluation.headline}
            </p>
          </div>
        </button>
        {mode === 'modal' && onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {evaluation.status === 'clock_tampered' && (
        <div className="rounded-2xl border border-[#B54B54]/35 bg-[#B54B54]/10 p-3.5 space-y-2.5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#B54B54] dark:text-[#E07A82] mt-0.5" />
            <p className="text-xs leading-relaxed text-[#7F2D34] dark:text-[#F0A3AA]">
              Jam / tanggal HP terdeteksi dimundurkan. Buka Pengaturan HP &gt; Tanggal &amp; Waktu, aktifkan{' '}
              <b>Waktu Otomatis</b>, lalu ketuk tombol di bawah.
            </p>
          </div>
          {onRecheckClock && (
            <button
              type="button"
              onClick={onRecheckClock}
              className="btn-lux-soft flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#17252B] dark:text-white"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Periksa Ulang Jam HP</span>
            </button>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
        {evaluation.detail} Semua data produk, pelanggan, dan transaksi Anda tetap aman tersimpan di HP ini.
      </p>

      {/* Device ID Box */}
      <div className="rounded-2xl bg-[#F0F4F1] dark:bg-[#18232A] p-4 space-y-3 border border-[#DCE3DD] dark:border-[#283842]">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Smartphone className="h-4 w-4 text-[#165B49] dark:text-[#4BB89A]" />
            ID Perangkat HP Ini
          </span>
        </div>
        <p className="font-mono text-2xl font-bold tracking-wider tabular-nums text-[#165B49] dark:text-[#4BB89A] select-all">
          {deviceId}
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={handleCopyDeviceId}
            className="btn-lux-soft flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"
          >
            {copiedId ? <Check className="h-4 w-4 text-[#165B49]" /> : <Copy className="h-4 w-4" />}
            <span>{copiedId ? 'Tersalin' : 'Salin ID'}</span>
          </button>
          <a
            href={waHref}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-lux-gold flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"
          >
            <MessageCircle className="h-4 w-4" />
            <span>Kirim ID ke WA</span>
          </a>
        </div>
      </div>

      {/* Activation Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            Masukkan Kode Aktivasi dari Penjual
          </label>
          <input
            type="text"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(formatActivationInput(e.target.value));
              setErrorMsg('');
            }}
            placeholder="Contoh: D23B-XXXX-XXXX atau P222-XXXX-XXXX"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="mt-1.5 w-full rounded-xl border border-[#CED6CF] dark:border-[#2E3F4A] bg-white dark:bg-[#0E1418] px-3.5 py-3 font-mono text-base font-bold tracking-widest uppercase tabular-nums outline-none focus:border-[#165B49]"
          />
          {errorMsg && (
            <p className="mt-1.5 text-xs font-semibold text-[#B54B54] dark:text-[#E07A82]">
              {errorMsg}
            </p>
          )}
        </div>

        <button
          type="submit"
          className="btn-lux-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold"
        >
          <Unlock className="h-4 w-4" />
          <span>Aktifkan Sekarang</span>
        </button>
      </form>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/60 backdrop-blur-xs p-4 overflow-y-auto">
        {cardBody}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F6F4] dark:bg-[#0E1418] p-4">
      {cardBody}
    </div>
  );
};

// =========================================================================
// Hidden Seller / Vendor License Code Generator (Protected by Vendor PIN)
// =========================================================================

interface VendorLicenseGeneratorModalProps {
  open: boolean;
  currentDeviceId: string;
  onClose: () => void;
  onApplyToCurrentDevice?: (code: string) => void;
  notify: (msg: string) => void;
}

export const VendorLicenseGeneratorModal: React.FC<VendorLicenseGeneratorModalProps> = ({
  open,
  currentDeviceId,
  onClose,
  onApplyToCurrentDevice,
  notify,
}) => {
  const [unlocked, setUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [activeTab, setActiveTab] = useState<'generate' | 'customers'>('generate');

  const [buyerDeviceId, setBuyerDeviceId] = useState('');
  const [plan, setPlan] = useState<LicensePlanOption>('permanen');
  const [buyerNote, setBuyerNote] = useState('');
  const [buyerPhone, setBuyerPhone] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<VendorPaymentStatus>('lunas');
  const [genError, setGenError] = useState('');
  const [lastResult, setLastResult] = useState<{
    code: string;
    deviceId: string;
    planLabel: string;
    expiresAtMs: number | null;
    note: string;
    phone: string;
    paymentStatus: VendorPaymentStatus;
  } | null>(null);

  const [history, setHistory] = useState<GeneratedLicenseRecord[]>(() => loadVendorHistory());
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'unpaid' | 'alert' | 'paid'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const nowMs = Date.now();

  const stats = useMemo(() => {
    let unpaid = 0;
    let alertCount = 0;
    for (const item of history) {
      if (item.paymentStatus === 'belum_bayar') unpaid += 1;
      const badge = getVendorCustomerExpiryBadge(item, nowMs);
      if (badge.kind === 'expired' || badge.kind === 'expiring_soon') alertCount += 1;
    }
    return { total: history.length, unpaid, alertCount };
  }, [history, nowMs]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    return history.filter((item) => {
      const badge = getVendorCustomerExpiryBadge(item, nowMs);
      if (customerFilter === 'unpaid' && item.paymentStatus !== 'belum_bayar') return false;
      if (customerFilter === 'paid' && item.paymentStatus === 'belum_bayar') return false;
      if (customerFilter === 'alert' && badge.kind !== 'expired' && badge.kind !== 'expiring_soon') {
        return false;
      }
      if (!q) return true;
      return (
        item.note.toLowerCase().includes(q) ||
        item.deviceId.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (item.phone || '').toLowerCase().includes(q)
      );
    });
  }, [history, customerSearch, customerFilter, nowMs]);

  if (!open) return null;

  const handleClose = () => {
    setUnlocked(false);
    setPinInput('');
    setPinError('');
    setGenError('');
    setConfirmDeleteId(null);
    onClose();
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!verifyVendorPin(pinInput)) {
      setPinError('Sandi Penjual salah.');
      return;
    }
    setPinError('');
    setPinInput('');
    setHistory(loadVendorHistory());
    setUnlocked(true);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setGenError('');
    try {
      const generated = generateActivationCode(buyerDeviceId, plan);
      const cleanNote = buyerNote.trim() || 'Pembeli';
      const cleanPhone = buyerPhone.trim();
      setLastResult({
        ...generated,
        note: cleanNote,
        phone: cleanPhone,
        paymentStatus,
      });
      const record: GeneratedLicenseRecord = {
        id: `lic-${Date.now()}`,
        deviceId: generated.deviceId,
        code: generated.code,
        plan,
        planLabel: generated.planLabel,
        expiresAtMs: generated.expiresAtMs,
        note: cleanNote,
        phone: cleanPhone,
        paymentStatus,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      const nextHist = upsertVendorCustomerRecord(history, record);
      setHistory(nextHist);
      saveVendorHistory(nextHist);
      notify('Kode aktivasi dibuat & dicatat di Kontrol Pelanggan');
    } catch (err) {
      setGenError((err as Error).message || 'Periksa kembali ID Perangkat.');
    }
  };

  const handleTogglePayment = (id: string) => {
    const nextHist = history.map((item) => {
      if (item.id !== id) return item;
      const nextStatus: VendorPaymentStatus =
        item.paymentStatus === 'belum_bayar' ? 'lunas' : 'belum_bayar';
      return { ...item, paymentStatus: nextStatus, updatedAt: Date.now() };
    });
    setHistory(nextHist);
    saveVendorHistory(nextHist);
    notify('Status pembayaran diperbarui');
  };

  const handleRenewFromCustomer = (item: GeneratedLicenseRecord) => {
    setBuyerDeviceId(item.deviceId);
    setBuyerNote(item.note === 'Pembeli' ? '' : item.note);
    setBuyerPhone(item.phone || '');
    setPaymentStatus('lunas');
    if (item.plan === '7d') setPlan('30d');
    else setPlan(item.plan);
    setGenError('');
    setActiveTab('generate');
    notify(`Siap perpanjang lisensi ${item.note}`);
  };

  const handleDeleteCustomer = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      window.setTimeout(() => {
        setConfirmDeleteId((cur) => (cur === id ? null : cur));
      }, 3000);
      return;
    }
    const nextHist = history.filter((item) => item.id !== id);
    setHistory(nextHist);
    saveVendorHistory(nextHist);
    setConfirmDeleteId(null);
    notify('Data pelanggan dihapus');
  };

  const handleExportCustomers = async () => {
    try {
      const payload = JSON.stringify(
        {
          app: 'SimpelKasir_Vendor_Control',
          exportedAt: Date.now(),
          customers: history,
        },
        null,
        2
      );
      const fileName = `SimpelKasir_Pelanggan_${toDateKey(Date.now())}.json`;
      const res = await saveExportFile(fileName, payload, 'application/json', 'SimpelKasir');
      notify(`Backup tersimpan: ${res.savedPath}`);
    } catch {
      notify('Gagal mengekspor data pelanggan');
    }
  };

  const handleImportCustomers = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const { merged, importedCount } = mergeVendorBackupRecords(history, parsed);
      if (importedCount === 0) {
        notify('File backup tidak berisi data pelanggan yang valid');
        return;
      }
      setHistory(merged);
      saveVendorHistory(merged);
      notify(`${importedCount} data pelanggan berhasil dipulihkan`);
    } catch {
      notify('Format file backup tidak valid');
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify(`Kode ${code} disalin`);
    } catch {
      notify(`Kode: ${code}`);
    }
  };

  const buildCustomerWaHref = (item: GeneratedLicenseRecord) => {
    const waPhone = normalizeWhatsAppPhone(item.phone || '');
    const badge = getVendorCustomerExpiryBadge(item, nowMs);
    let msg = '';
    if (item.paymentStatus === 'belum_bayar') {
      msg = `Halo ${item.note}, sekadar mengingatkan pembayaran aplikasi SimpelKasir (${item.planLabel}) untuk ID Perangkat ${item.deviceId}${
        item.expiresAtMs ? ` (berlaku s/d ${formatDateShort(item.expiresAtMs)})` : ''
      }. Terima kasih.`;
    } else if (badge.kind === 'expired' || badge.kind === 'expiring_soon') {
      msg = `Halo ${item.note}, masa aktif SimpelKasir Anda (${item.deviceId}) ${
        badge.kind === 'expired' ? 'sudah berakhir' : `tinggal ${badge.daysLeft} hari lagi`
      }. Balas pesan ini jika ingin perpanjang kode aktivasi baru.`;
    } else {
      msg = `Kode Aktivasi SimpelKasir (${item.note}):\nID Perangkat: ${item.deviceId}\nPaket: ${item.planLabel}${
        item.expiresAtMs ? `\nBerlaku s/d: ${formatDateShort(item.expiresAtMs)}` : ''
      }\nKode: *${item.code}*`;
    }
    return `https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`;
  };

  const replyWaMessage = lastResult
    ? `Kode Aktivasi SimpelKasir Anda:\n\nID Perangkat: ${lastResult.deviceId}\nPaket: ${lastResult.planLabel}${
        lastResult.expiresAtMs ? `\nBerlaku s/d: ${formatDateShort(lastResult.expiresAtMs)}` : ''
      }\nKode Aktivasi: *${lastResult.code}*${
        lastResult.paymentStatus === 'belum_bayar' ? '\nStatus Bayar: Belum Lunas' : ''
      }\n\nMasukkan kode di layar Aktivasi aplikasi SimpelKasir.`
    : '';
  const replyWaPhone = lastResult ? normalizeWhatsAppPhone(lastResult.phone) : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/65 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="surface-card animate-modal-in w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl p-4 sm:p-5 shadow-2xl space-y-4 my-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/15 text-[#165B49] dark:text-[#4BB89A]">
              {unlocked ? <KeyRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#17252B] dark:text-white">
                Panel Penjual SimpelKasir
              </h3>
              <p className="text-[11px] text-slate-500">
                Tersembunyi — tidak muncul di layar kasir pelanggan
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
            aria-label="Tutup"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {!unlocked ? (
          <form onSubmit={handleUnlock} className="space-y-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Masukkan Sandi Penjual
              </label>
              <input
                type="password"
                autoFocus
                value={pinInput}
                onChange={(e) => {
                  setPinInput(e.target.value);
                  setPinError('');
                }}
                placeholder="Ketik sandi penjual..."
                className="mt-1.5 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3.5 py-2.5 text-sm font-bold outline-none focus:border-[#165B49]"
              />
              {pinError && (
                <p className="mt-1 text-xs font-semibold text-[#B54B54]">{pinError}</p>
              )}
            </div>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={handleClose}
                className="btn-lux-soft min-h-[44px] flex-1 rounded-xl py-2.5 text-xs font-bold"
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-lux-primary min-h-[44px] flex-1 rounded-xl py-2.5 text-xs font-bold"
              >
                Buka Panel Penjual
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3.5">
            {/* 2-Tab Switcher */}
            <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-[#EEF2EE] dark:bg-[#131C22] p-1">
              <button
                type="button"
                onClick={() => setActiveTab('generate')}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold transition ${
                  activeTab === 'generate'
                    ? 'bg-white dark:bg-[#1D2B34] text-[#165B49] dark:text-[#4BB89A] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <KeyRound className="h-3.5 w-3.5" />
                <span>Buat Kode</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('customers')}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2 py-1.5 text-xs font-bold transition ${
                  activeTab === 'customers'
                    ? 'bg-white dark:bg-[#1D2B34] text-[#165B49] dark:text-[#4BB89A] shadow-xs'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>Pelanggan ({stats.total})</span>
                {stats.unpaid + stats.alertCount > 0 && (
                  <span className="rounded-md bg-[#B54B54] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                    {stats.unpaid + stats.alertCount}
                  </span>
                )}
              </button>
            </div>

            {activeTab === 'generate' ? (
              <div className="space-y-3.5">
                <form onSubmit={handleGenerate} className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        ID Perangkat Pembeli
                      </label>
                      <button
                        type="button"
                        onClick={() => setBuyerDeviceId(currentDeviceId)}
                        className="text-[11px] font-bold text-[#165B49] dark:text-[#4BB89A] underline"
                      >
                        Pakai ID HP Ini
                      </button>
                    </div>
                    <input
                      type="text"
                      value={buyerDeviceId}
                      onChange={(e) => {
                        setBuyerDeviceId(e.target.value.toUpperCase());
                        setGenError('');
                      }}
                      onBlur={() => {
                        if (buyerDeviceId.trim()) {
                          setBuyerDeviceId(formatDeviceId(buyerDeviceId));
                        }
                      }}
                      placeholder="Contoh: SK-7F2A-91C4"
                      autoCapitalize="characters"
                      className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-white dark:bg-[#0E1418] px-3 py-2.5 font-mono text-sm font-bold tracking-wider uppercase tabular-nums outline-none focus:border-[#165B49]"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        Nama Warung / Pembeli
                      </label>
                      <input
                        type="text"
                        value={buyerNote}
                        onChange={(e) => setBuyerNote(e.target.value)}
                        placeholder="Contoh: Es Teh Mas Budi"
                        className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-xs outline-none focus:border-[#165B49]"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                        No. WA Pelanggan (Opsional)
                      </label>
                      <input
                        type="tel"
                        value={buyerPhone}
                        onChange={(e) => setBuyerPhone(e.target.value)}
                        placeholder="0812..."
                        className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-xs tabular-nums outline-none focus:border-[#165B49]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Pilih Masa Aktif Lisensi
                    </label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: '7d', label: 'Trial 7 Hari', full: false },
                          { id: '30d', label: '30 Hari', full: false },
                          { id: '90d', label: '90 Hari', full: false },
                          { id: '365d', label: '1 Tahun', full: false },
                          { id: 'permanen', label: 'Permanen (Selamanya)', full: true },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setPlan(opt.id)}
                          className={`min-h-[42px] rounded-xl px-3 py-2 text-xs font-bold transition ${
                            opt.full ? 'col-span-2' : ''
                          } ${
                            plan === opt.id
                              ? 'btn-lux-primary'
                              : 'btn-lux-soft text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                      Status Pembayaran
                    </label>
                    <div className="mt-1.5 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentStatus('lunas')}
                        className={`min-h-[40px] rounded-xl px-3 py-2 text-xs font-bold border transition ${
                          paymentStatus === 'lunas'
                            ? 'border-[#165B49] bg-[#165B49]/15 text-[#165B49] dark:text-[#4BB89A]'
                            : 'border-[#D4DBD5] dark:border-[#2A3944] text-slate-500'
                        }`}
                      >
                        Lunas
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentStatus('belum_bayar')}
                        className={`min-h-[40px] rounded-xl px-3 py-2 text-xs font-bold border transition ${
                          paymentStatus === 'belum_bayar'
                            ? 'border-[#B54B54] bg-[#B54B54]/15 text-[#B54B54] dark:text-[#E07A82]'
                            : 'border-[#D4DBD5] dark:border-[#2A3944] text-slate-500'
                        }`}
                      >
                        Belum Bayar / Tempo
                      </button>
                    </div>
                  </div>

                  {genError && (
                    <p className="text-xs font-semibold text-[#B54B54]">{genError}</p>
                  )}

                  <button
                    type="submit"
                    className="btn-lux-primary flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold"
                  >
                    <ShieldCheck className="h-4 w-4" />
                    <span>Buat Kode &amp; Simpan Pelanggan</span>
                  </button>
                </form>

                {lastResult && (
                  <div className="rounded-2xl bg-[#EBF3F0] dark:bg-[#142722] border border-[#165B49]/25 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">
                        {lastResult.note} · {lastResult.planLabel}
                      </span>
                      <span className="font-mono">{lastResult.deviceId}</span>
                    </div>
                    <p className="font-mono text-2xl font-bold tracking-widest text-center tabular-nums text-[#165B49] dark:text-[#4BB89A] select-all">
                      {lastResult.code}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => copyCode(lastResult.code)}
                        className="btn-lux-soft flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <Copy className="h-4 w-4" />
                        <span>Salin Kode</span>
                      </button>
                      <a
                        href={`https://wa.me/${replyWaPhone}?text=${encodeURIComponent(replyWaMessage)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-lux-gold flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span>Kirim via WA</span>
                      </a>
                    </div>
                    {onApplyToCurrentDevice && lastResult.deviceId === currentDeviceId && (
                      <button
                        type="button"
                        onClick={() => {
                          onApplyToCurrentDevice(lastResult.code);
                          handleClose();
                        }}
                        className="btn-lux-primary flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold"
                      >
                        <Unlock className="h-4 w-4" />
                        <span>Langsung Aktifkan di HP Ini</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-[#F3F5F2] dark:bg-[#172128] p-2">
                    <p className="text-[10px] font-semibold text-slate-500">Total Toko</p>
                    <p className="text-base font-bold tabular-nums text-[#17252B] dark:text-white">
                      {stats.total}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#B54B54]/10 p-2">
                    <p className="text-[10px] font-semibold text-[#B54B54] dark:text-[#E07A82]">
                      Belum Bayar
                    </p>
                    <p className="text-base font-bold tabular-nums text-[#B54B54] dark:text-[#E07A82]">
                      {stats.unpaid}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#C69B4B]/15 p-2">
                    <p className="text-[10px] font-semibold text-[#9A6F21] dark:text-[#DFAA56]">
                      H-3 / Expired
                    </p>
                    <p className="text-base font-bold tabular-nums text-[#9A6F21] dark:text-[#DFAA56]">
                      {stats.alertCount}
                    </p>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Cari nama warung, WA, ID perangkat, kode..."
                    className="w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent pl-9 pr-3 py-2 text-xs outline-none focus:border-[#165B49]"
                  />
                </div>

                {/* Filter Buttons (Zero Pills — Clean Rounded-XL Tabs) */}
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      { id: 'all', label: 'Semua' },
                      { id: 'unpaid', label: 'Blm Bayar' },
                      { id: 'alert', label: 'H-3/Habis' },
                      { id: 'paid', label: 'Lunas' },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setCustomerFilter(f.id)}
                      className={`min-h-[34px] rounded-xl px-1.5 py-1 text-[11px] font-bold transition ${
                        customerFilter === f.id
                          ? 'bg-[#165B49] text-white'
                          : 'bg-[#EEF2EE] dark:bg-[#19232A] text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Customer Cards */}
                <div className="max-h-[38vh] overflow-y-auto space-y-2.5 pr-0.5">
                  {filteredCustomers.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-[#D4DBD5] dark:border-[#2A3944] p-5 text-center text-xs text-slate-500">
                      {history.length === 0
                        ? 'Belum ada data pelanggan. Buat kode aktivasi pertama Anda di tab Buat Kode.'
                        : 'Tidak ada pelanggan yang cocok dengan filter / pencarian.'}
                    </div>
                  ) : (
                    filteredCustomers.map((item) => {
                      const badge = getVendorCustomerExpiryBadge(item, nowMs);
                      const isUnpaid = item.paymentStatus === 'belum_bayar';
                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-[#DCE3DD] dark:border-[#25333D] bg-[#F8FAF8] dark:bg-[#141D24] p-3 space-y-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-display text-xs font-bold text-[#17252B] dark:text-white truncate">
                                {item.note}
                              </p>
                              <p className="mt-0.5 font-mono text-[11px] text-slate-500 tabular-nums">
                                {item.deviceId}
                                {item.phone ? ` · ${item.phone}` : ''}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <span
                                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                  isUnpaid
                                    ? 'bg-[#B54B54]/15 text-[#B54B54] dark:text-[#E07A82]'
                                    : 'bg-[#165B49]/15 text-[#165B49] dark:text-[#4BB89A]'
                                }`}
                              >
                                {isUnpaid ? 'Belum Bayar' : 'Lunas'}
                              </span>
                              <span
                                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                                  badge.kind === 'expired'
                                    ? 'bg-[#B54B54] text-white'
                                    : badge.kind === 'expiring_soon'
                                    ? 'bg-[#C69B4B]/20 text-[#9A6F21] dark:text-[#DFAA56]'
                                    : 'bg-slate-200/80 dark:bg-[#22303A] text-slate-700 dark:text-slate-200'
                                }`}
                              >
                                {badge.label}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center justify-between gap-2 rounded-xl bg-white dark:bg-[#0E1418] px-2.5 py-1.5 border border-[#E6ECE7] dark:border-[#202D36]">
                            <div className="min-w-0">
                              <p className="font-mono text-xs font-bold text-[#165B49] dark:text-[#4BB89A] tabular-nums">
                                {item.code}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {item.planLabel}
                                {item.expiresAtMs ? ` · s/d ${formatDateShort(item.expiresAtMs)}` : ''}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => copyCode(item.code)}
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-black/5 dark:hover:bg-white/10"
                              aria-label="Salin kode"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </button>
                          </div>

                          <div className="grid grid-cols-4 gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleTogglePayment(item.id)}
                              className={`min-h-[36px] rounded-xl px-1.5 py-1 text-[10px] font-bold border transition ${
                                isUnpaid
                                  ? 'border-[#165B49]/40 text-[#165B49] dark:text-[#4BB89A] bg-[#165B49]/10'
                                  : 'border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                              }`}
                            >
                              {isUnpaid ? 'Tandai Lunas' : 'Blm Bayar'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRenewFromCustomer(item)}
                              className="btn-lux-primary flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-bold"
                            >
                              <RefreshCw className="h-3 w-3" />
                              <span>Perpanjang</span>
                            </button>
                            <a
                              href={buildCustomerWaHref(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-lux-gold flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-bold"
                            >
                              <MessageCircle className="h-3 w-3" />
                              <span>{isUnpaid ? 'Tagih WA' : 'WA'}</span>
                            </a>
                            <button
                              type="button"
                              onClick={() => handleDeleteCustomer(item.id)}
                              className={`flex min-h-[36px] items-center justify-center gap-1 rounded-xl px-1.5 py-1 text-[10px] font-bold transition ${
                                confirmDeleteId === item.id
                                  ? 'bg-[#B54B54] text-white'
                                  : 'bg-[#B54B54]/10 text-[#B54B54] dark:text-[#E07A82]'
                              }`}
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>{confirmDeleteId === item.id ? 'Yakin?' : 'Hapus'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Backup & Restore */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExportCustomers}
                    className="btn-lux-soft flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>Backup Daftar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => importInputRef.current?.click()}
                    className="btn-lux-soft flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[11px] font-bold"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    <span>Pulihkan Backup</span>
                  </button>
                  <input
                    ref={importInputRef}
                    type="file"
                    accept=".json,application/json"
                    onChange={handleImportCustomers}
                    className="hidden"
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
