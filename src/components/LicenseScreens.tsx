import React, { useRef, useState } from 'react';
import {
  Check,
  Copy,
  KeyRound,
  Lock,
  MessageCircle,
  ShieldCheck,
  Smartphone,
  Unlock,
  X,
} from 'lucide-react';
import { SimpelKasirLogo } from './Logo';
import {
  GeneratedLicenseRecord,
  LicenseEvaluation,
  LicensePlanOption,
  formatActivationInput,
  formatDeviceId,
  generateActivationCode,
  loadVendorHistory,
  saveVendorHistory,
  verifyActivationCode,
  verifyVendorPin,
} from '../utils/license';
import { formatDateShort } from '../utils/storage';

interface ActivationGateScreenProps {
  mode: 'locked' | 'modal';
  deviceId: string;
  evaluation: LicenseEvaluation;
  onActivateSuccess: (normalizedCode: string) => void;
  onClose?: () => void;
  onOpenVendorGenerator: () => void;
  notify: (msg: string) => void;
}

export const ActivationGateScreen: React.FC<ActivationGateScreenProps> = ({
  mode,
  deviceId,
  evaluation,
  onActivateSuccess,
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
    const result = verifyActivationCode(codeInput, deviceId);
    if (!result.valid || !result.normalizedCode) {
      setErrorMsg(result.reason || 'Kode aktivasi tidak valid.');
      return;
    }
    onActivateSuccess(result.normalizedCode);
  };

  const waRequestText = `Halo Admin SimpelKasir, saya mau aktivasi aplikasi kasir.\nID Perangkat: ${deviceId}`;
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
            placeholder="Contoh: P222-XXXX-XXXX"
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

  const [buyerDeviceId, setBuyerDeviceId] = useState('');
  const [plan, setPlan] = useState<LicensePlanOption>('permanen');
  const [buyerNote, setBuyerNote] = useState('');
  const [genError, setGenError] = useState('');
  const [lastResult, setLastResult] = useState<{
    code: string;
    deviceId: string;
    planLabel: string;
    expiresAtMs: number | null;
  } | null>(null);
  const [history, setHistory] = useState<GeneratedLicenseRecord[]>(() => loadVendorHistory());

  if (!open) return null;

  const handleClose = () => {
    setUnlocked(false);
    setPinInput('');
    setPinError('');
    setGenError('');
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
    setUnlocked(true);
  };

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    setGenError('');
    try {
      const generated = generateActivationCode(buyerDeviceId, plan);
      setLastResult(generated);
      const record: GeneratedLicenseRecord = {
        id: `lic-${Date.now()}`,
        deviceId: generated.deviceId,
        code: generated.code,
        plan,
        planLabel: generated.planLabel,
        expiresAtMs: generated.expiresAtMs,
        note: buyerNote.trim() || 'Pembeli',
        createdAt: Date.now(),
      };
      const nextHist = [record, ...history].slice(0, 30);
      setHistory(nextHist);
      saveVendorHistory(nextHist);
      notify('Kode aktivasi berhasil dibuat');
    } catch (err) {
      setGenError((err as Error).message || 'Periksa kembali ID Perangkat.');
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

  const replyWaMessage = lastResult
    ? `Kode Aktivasi SimpelKasir Anda:\n\nID Perangkat: ${lastResult.deviceId}\nPaket: ${lastResult.planLabel}${
        lastResult.expiresAtMs ? `\nBerlaku s/d: ${formatDateShort(lastResult.expiresAtMs)}` : ''
      }\nKode Aktivasi: *${lastResult.code}*\n\nMasukkan kode di layar Aktivasi aplikasi SimpelKasir.`
    : '';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/65 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="surface-card animate-modal-in w-full max-w-md rounded-3xl p-5 shadow-2xl space-y-4 my-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#165B49]/15 text-[#165B49] dark:text-[#4BB89A]">
              {unlocked ? <KeyRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-[#17252B] dark:text-white">
                Generator Lisensi Penjual
              </h3>
              <p className="text-[11px] text-slate-500">
                Alat khusus penyedia layanan untuk aktivasi HP pembeli
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
                Buka Generator
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
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
                    const clean = e.target.value.toUpperCase();
                    setBuyerDeviceId(clean);
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

              <div>
                <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  Pilih Masa Aktif Lisensi
                </label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'permanen', label: 'Permanen' },
                      { id: '30d', label: '30 Hari' },
                      { id: '90d', label: '90 Hari' },
                      { id: '365d', label: '1 Tahun' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPlan(opt.id)}
                      className={`min-h-[44px] rounded-xl px-3 py-2 text-xs font-bold transition ${
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
                  Nama Warung / Pembeli (Catatan Anda)
                </label>
                <input
                  type="text"
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  placeholder="Contoh: Es Teh Mas Budi"
                  className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2 text-xs outline-none focus:border-[#165B49]"
                />
              </div>

              {genError && (
                <p className="text-xs font-semibold text-[#B54B54]">{genError}</p>
              )}

              <button
                type="submit"
                className="btn-lux-primary flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl py-2.5 text-xs font-bold"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>Buat Kode Aktivasi</span>
              </button>
            </form>

            {lastResult && (
              <div className="rounded-2xl bg-[#EBF3F0] dark:bg-[#142722] border border-[#165B49]/25 p-4 space-y-3">
                <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                  <span className="font-semibold">{lastResult.planLabel}</span>
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
                    href={`https://wa.me/?text=${encodeURIComponent(replyWaMessage)}`}
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

            {history.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-slate-500">
                  Riwayat Kode Terakhir ({history.length})
                </p>
                <div className="max-h-36 overflow-y-auto divide-y divide-[#EAECE8] dark:divide-[#223039] text-xs">
                  {history.slice(0, 10).map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{item.note}</p>
                        <p className="text-[11px] text-slate-500 font-mono">
                          {item.deviceId} · {item.planLabel}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyCode(item.code)}
                        className="shrink-0 font-mono font-bold text-[#165B49] dark:text-[#4BB89A] px-2 py-1 rounded-lg hover:bg-black/5 dark:hover:bg-white/5"
                      >
                        {item.code}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
