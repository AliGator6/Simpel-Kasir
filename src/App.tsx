import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Lock, LockOpen, LogOut, ShieldCheck, X } from 'lucide-react';
import { ActiveOrderDraft, AppData, Product, SavedQuickCart, ScreenId, Transaction } from './types';
import {
  EMPTY_DRAFT,
  clearActiveDraft,
  formatDateShort,
  hasStoredLocalAppData,
  hashOwnerPasscode,
  loadActiveDraft,
  loadAppData,
  recoverAppDataFromIndexedDB,
  saveActiveDraft,
  saveAppData,
} from './utils/storage';
import { Drawer } from './components/Drawer';
import { useBackClose } from './components/TopBar';
import { HomeScreen } from './screens/HomeScreen';
import { PosFlowScreens } from './screens/PosScreens';
import { InventoryScreens } from './screens/InventoryScreens';
import { FinanceScreens } from './screens/FinanceScreens';
import { SettingsScreens } from './screens/SettingsScreens';
import { SyncScreen } from './screens/SyncScreen';
import { ActivationGateScreen, VendorLicenseGeneratorModal } from './components/LicenseScreens';
import {
  LocalLicenseState,
  evaluateLicense,
  loadLocalLicenseState,
  markDailyExpiryReminderShown,
  saveLocalLicenseState,
  shouldShowDailyExpiryReminder,
  touchLicenseClock,
  verifyActivationCode,
} from './utils/license';
import { fetchNativeLicenseInfo, persistNativeLicenseCode, pingNativeLicenseClock } from './utils/printer';

declare global {
  interface Window {
    __handleAndroidBack?: () => 'handled' | 'exit';
  }
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode; onResetToHome?: () => void },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode; onResetToHome?: () => void }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Terjadi kesalahan tampilan yang tidak terduga.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#F5F6F4] dark:bg-[#0E1418] p-6 text-center text-[#17252B] dark:text-[#ECF1EF]">
          <div className="surface-card w-full max-w-sm rounded-3xl p-6 shadow-xl space-y-3">
            <h2 className="font-display text-lg font-bold text-[#B54B54] dark:text-[#E07A82]">
              Tampilan Sedang Dipulihkan
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              Data produk dan transaksi Anda tetap aman tersimpan. Ketuk tombol di bawah untuk melanjutkan.
            </p>
            {this.state.errorMessage && (
              <p className="rounded-xl bg-slate-100 dark:bg-[#1B262E] p-2.5 text-[11px] font-mono text-slate-500 break-words">
                {this.state.errorMessage}
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                this.props.onResetToHome?.();
                this.setState({ hasError: false, errorMessage: '' });
              }}
              className="btn-lux-primary w-full rounded-xl py-3 text-sm font-bold"
            >
              Pulihkan Aplikasi
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [screen, setScreen] = useState<ScreenId>('home');
  const [prevScreen, setPrevScreen] = useState<ScreenId>('home');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<ActiveOrderDraft>(() => loadActiveDraft());
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [lastTx, setLastTx] = useState<Transaction | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isOwnerLoggedIn, setIsOwnerLoggedIn] = useState(false);
  const [showOwnerAuthModal, setShowOwnerAuthModal] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinConfirmInput, setPinConfirmInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  const [licenseState, setLicenseState] = useState<LocalLicenseState>(() => loadLocalLicenseState());
  const [nativeLicenseChecked, setNativeLicenseChecked] = useState(false);
  const [nativeClockRollback, setNativeClockRollback] = useState(false);
  const [clockTickNow, setClockTickNow] = useState(() => Date.now());
  const [showExpiryReminder, setShowExpiryReminder] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showVendorGenerator, setShowVendorGenerator] = useState(false);

  const recoveryPendingRef = useRef(!hasStoredLocalAppData());
  const lastNavToHomeAtRef = useRef<number>(0);
  const homeExitTapAtRef = useRef<number>(0);

  useBackClose(showOwnerAuthModal, () => {
    setShowOwnerAuthModal(false);
    setPinInput('');
    setPinConfirmInput('');
    setAuthError('');
    setChangingPin(false);
  });
  useBackClose(showActivationModal, () => setShowActivationModal(false));
  useBackClose(showVendorGenerator, () => setShowVendorGenerator(false));
  useBackClose(showExpiryReminder, () => setShowExpiryReminder(false));

  useEffect(() => {
    if (!recoveryPendingRef.current) return;
    let cancelled = false;
    recoverAppDataFromIndexedDB().then((recovered) => {
      if (cancelled) return;
      recoveryPendingRef.current = false;
      if (recovered) {
        setData(recovered);
      } else {
        setData((cur) => {
          saveAppData(cur);
          return cur;
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (
      params.get('admin') === 'lisensi' ||
      params.get('vendor') === '1' ||
      window.location.hash === '#admin-lisensi'
    ) {
      setShowVendorGenerator(true);
    }

    let cancelled = false;
    fetchNativeLicenseInfo()
      .then((nativeInfo) => {
        if (cancelled) return;
        if (nativeInfo) {
          if (nativeInfo.clockRollbackDetected) {
            setNativeClockRollback(true);
          }
          setLicenseState((prev) => {
            const deviceId = nativeInfo.deviceId || prev.deviceId;
            const trialStartMs = Math.min(prev.trialStartMs, nativeInfo.trialStartMs);
            const maxSeenMs = Math.max(prev.maxSeenMs || 0, nativeInfo.maxSeenMs || 0, Date.now());
            let activationCode = prev.activationCode;
            if (nativeInfo.activationCode && verifyActivationCode(nativeInfo.activationCode, deviceId, maxSeenMs).valid) {
              activationCode = nativeInfo.activationCode;
            } else if (prev.activationCode && verifyActivationCode(prev.activationCode, deviceId, maxSeenMs).valid) {
              persistNativeLicenseCode(prev.activationCode);
            }
            const merged: LocalLicenseState = { deviceId, trialStartMs, maxSeenMs, activationCode };
            saveLocalLicenseState(merged);
            return merged;
          });
        }
      })
      .finally(() => {
        if (!cancelled) setNativeLicenseChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const syncClockHeartbeat = async () => {
    const now = Date.now();
    setClockTickNow(now);
    setLicenseState((prev) => {
      const { nextState } = touchLicenseClock(prev, now);
      return nextState;
    });
    const nativeClock = await pingNativeLicenseClock();
    if (nativeClock) {
      setNativeClockRollback(nativeClock.clockRollbackDetected);
      setLicenseState((prev) => {
        const nextMax = Math.max(prev.maxSeenMs || 0, nativeClock.maxSeenMs || 0, now);
        if (nextMax > prev.maxSeenMs) {
          const updated: LocalLicenseState = { ...prev, maxSeenMs: nextMax };
          saveLocalLicenseState(updated);
          return updated;
        }
        return prev;
      });
    }
    return nativeClock;
  };

  useEffect(() => {
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void syncClockHeartbeat();
      }
    };
    const interval = window.setInterval(() => {
      void syncClockHeartbeat();
    }, 30_000);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
    };
  }, []);

  useEffect(() => {
    if (!recoveryPendingRef.current) {
      saveAppData(data);
    }
    const root = document.documentElement;
    if (data.darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [data]);

  useEffect(() => {
    saveActiveDraft(draft);
  }, [draft]);

  const notify = (msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 2600);
  };

  const navigate = (next: ScreenId) => {
    if (next === 'home' && screen !== 'home') {
      lastNavToHomeAtRef.current = Date.now();
      homeExitTapAtRef.current = 0;
    }
    setPrevScreen(screen);
    setScreen(next);
  };

  const licenseEval = evaluateLicense(licenseState, clockTickNow, nativeClockRollback);

  // Android Taskbar / Hardware Back Button Guard & Hierarchical Navigation
  const stateRef = useRef({
    screen,
    prevScreen,
    drawerOpen,
    draft,
    isUnlocked: licenseEval.isUnlocked,
  });
  stateRef.current = { screen, prevScreen, drawerOpen, draft, isUnlocked: licenseEval.isUnlocked };

  useEffect(() => {
    window.__handleAndroidBack = (): 'handled' | 'exit' => {
      const { screen: cur, prevScreen: prev, drawerOpen: isDrawer, draft: curDraft, isUnlocked } = stateRef.current;

      // If app is locked (expired or clock tampered), close open modals (e.g. Vendor generator) or double-tap to exit
      if (!isUnlocked) {
        const backEvent = new CustomEvent('simpelkasir-back-request', { cancelable: true });
        window.dispatchEvent(backEvent);
        if (backEvent.defaultPrevented) {
          return 'handled';
        }
        const now = Date.now();
        const elapsed = now - homeExitTapAtRef.current;
        if (elapsed >= 250 && elapsed <= 2200) {
          return 'exit';
        }
        homeExitTapAtRef.current = now;
        notify('Tekan kembali sekali lagi untuk keluar');
        return 'handled';
      }

      // 1. Close Drawer if open
      if (isDrawer) {
        setDrawerOpen(false);
        return 'handled';
      }

      // 2. Close any open Modal / Dropdown / Sheet first
      const backEvent = new CustomEvent('simpelkasir-back-request', { cancelable: true });
      window.dispatchEvent(backEvent);
      if (backEvent.defaultPrevented) {
        return 'handled';
      }

      // 3. Hierarchical back navigation (preserving cart draft at all times!)
      if (cur !== 'home') {
        let nextTarget: ScreenId = 'home';
        if (cur === 'payment') nextTarget = 'cart';
        else if (cur === 'cart') nextTarget = 'pos';
        else if (cur === 'pos') nextTarget = 'home';
        else if (cur === 'receipt') nextTarget = 'home';
        else if (cur === 'product_form') nextTarget = prev === 'pos' ? 'pos' : 'products';
        else if (cur.startsWith('settings_')) {
          nextTarget = prev === 'receipt' || prev === 'pos' || prev === 'products' ? prev : 'settings';
        } else {
          nextTarget = 'home';
        }

        if (nextTarget === 'home') {
          lastNavToHomeAtRef.current = Date.now();
          homeExitTapAtRef.current = 0;
        }
        setPrevScreen(cur);
        setScreen(nextTarget);
        return 'handled';
      }

      // 4. Already at Home: debounce rapid accidental double-tap from sub-screen
      const now = Date.now();
      if (now - lastNavToHomeAtRef.current < 700) {
        return 'handled';
      }

      const elapsedSinceFirstHomeTap = now - homeExitTapAtRef.current;
      // Require deliberate 2nd tap between 250ms and 2200ms (prevents 1-finger accidental bounce)
      if (elapsedSinceFirstHomeTap >= 250 && elapsedSinceFirstHomeTap <= 2200) {
        return 'exit';
      }

      homeExitTapAtRef.current = now;
      const itemCount = curDraft.items.reduce((sum, it) => sum + it.qty, 0);
      if (itemCount > 0) {
        notify(`Keranjang (${itemCount} item) tersimpan aman. Tekan kembali lagi untuk keluar`);
      } else {
        notify('Tekan kembali sekali lagi untuk keluar');
      }
      return 'handled';
    };

    return () => {
      delete window.__handleAndroidBack;
    };
  }, []);

  const activeUser = data.users.find((u) => u.id === data.activeUserId) || data.users[0];

  const handleSaveQuickCart = (name: string) => {
    const entry: SavedQuickCart = {
      id: `qc-${Date.now()}`,
      name,
      customerId: draft.customerId,
      customerName: draft.customerName,
      items: draft.items,
      discount: draft.discount,
      note: draft.note,
      shipping: draft.shipping,
      updatedAt: Date.now(),
    };
    setData((prev) => ({
      ...prev,
      quickCarts: [entry, ...prev.quickCarts],
    }));
    notify(`"${name}" disimpan ke Transaksi Cepat`);
  };

  const handleLoadQuickCart = (qc: SavedQuickCart) => {
    setDraft({
      items: qc.items.map((i) => ({ ...i })),
      customerId: qc.customerId,
      customerName: qc.customerName,
      discount: qc.discount,
      shipping: qc.shipping,
      note: qc.note,
      progressStatus: 'antri',
    });
    navigate('cart');
    notify(`Memuat "${qc.name}"`);
  };

  const handleCompleteTransaction = (
    paidAmount: number,
    paymentMethod: 'tunai' | 'non_tunai',
    isPayLater: boolean
  ): Transaction => {
    const subtotal = draft.items.reduce(
      (acc, it) => acc + Math.max(0, it.unitPrice * it.qty - it.discount),
      0
    );
    const tax = data.businessFlags.useTax
      ? Math.round(((subtotal - draft.discount) * data.businessFlags.taxPercent) / 100)
      : 0;
    const shipping = data.businessFlags.useShipping ? draft.shipping : 0;
    const total = Math.max(0, subtotal - draft.discount + tax + shipping);
    const totalCost = draft.items.reduce((acc, it) => acc + it.costPrice * it.qty, 0);
    const totalProfit = total - tax - shipping - totalCost;
    const actualPaid = isPayLater ? 0 : paidAmount;
    const changeAmount = actualPaid - total;
    const paymentStatus =
      actualPaid >= total ? 'lunas' : actualPaid > 0 ? 'kurang' : 'belum_dibayar';

    const cust = draft.customerId
      ? data.customers.find((c) => c.id === draft.customerId)
      : undefined;

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      receiptNo: data.nextReceiptNo,
      createdAt: Date.now(),
      paidAt: actualPaid > 0 ? Date.now() : null,
      customerId: draft.customerId,
      customerName: draft.customerName,
      customerPhone: cust?.phone,
      customerAddress: cust?.address,
      items: draft.items.map((i) => ({ ...i })),
      subtotal,
      discount: draft.discount,
      tax,
      shipping,
      total,
      totalCost,
      totalProfit,
      paidAmount: actualPaid,
      changeAmount,
      paymentMethod,
      paymentStatus,
      progressStatus: draft.progressStatus,
      note: draft.note,
      cashierName: activeUser.name,
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
      cashflows:
        cashIn > 0
          ? [
              {
                id: `cf-tx-${Date.now()}`,
                createdAt: tx.createdAt,
                kind: 'in',
                method: paymentMethod,
                amount: cashIn,
                title: `Transaksi #${tx.receiptNo}`,
                note: tx.customerName,
                transactionId: tx.id,
              },
              ...prev.cashflows,
            ]
          : prev.cashflows,
    }));

    setLastTx(tx);
    setDraft(EMPTY_DRAFT);
    clearActiveDraft();
    setScreen('receipt');
    return tx;
  };

  const openOwnerAuthModal = () => {
    setPinInput('');
    setPinConfirmInput('');
    setAuthError('');
    setChangingPin(false);
    setShowOwnerAuthModal(true);
  };

  const closeOwnerAuthModal = () => {
    setShowOwnerAuthModal(false);
    setPinInput('');
    setPinConfirmInput('');
    setAuthError('');
    setChangingPin(false);
  };

  const hasOwnerPass = Boolean(data.ownerAuth?.passHash);

  const handleSubmitOwnerAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const trimmed = pinInput.trim();
    if (trimmed.length < 4) {
      setAuthError('PIN / kata sandi minimal 4 karakter atau angka');
      return;
    }

    if (!hasOwnerPass || changingPin) {
      if (trimmed !== pinConfirmInput.trim()) {
        setAuthError('Konfirmasi PIN / kata sandi tidak cocok');
        return;
      }
      const passHash = hashOwnerPasscode(trimmed);
      setData((prev) => ({
        ...prev,
        ownerAuth: { passHash, updatedAt: Date.now() },
      }));
      setIsOwnerLoggedIn(true);
      closeOwnerAuthModal();
      notify(hasOwnerPass ? 'PIN / kata sandi pemilik diperbarui' : 'Akun Pemilik aktif! Laba kini ditampilkan.');
      return;
    }

    const enteredHash = hashOwnerPasscode(trimmed);
    if (enteredHash !== data.ownerAuth?.passHash) {
      setAuthError('PIN / kata sandi pemilik salah');
      return;
    }
    setIsOwnerLoggedIn(true);
    closeOwnerAuthModal();
    notify('Berhasil login sebagai Pemilik. Laba ditampilkan.');
  };

  useEffect(() => {
    if (!nativeLicenseChecked) return;
    if (shouldShowDailyExpiryReminder(licenseEval, Math.max(clockTickNow, licenseState.maxSeenMs || 0))) {
      markDailyExpiryReminderShown(Math.max(clockTickNow, licenseState.maxSeenMs || 0));
      setShowExpiryReminder(true);
    } else if (!licenseEval.isUnlocked || licenseEval.status === 'licensed_permanent') {
      setShowExpiryReminder(false);
    }
  }, [
    nativeLicenseChecked,
    licenseEval.isUnlocked,
    licenseEval.status,
    licenseEval.daysLeft,
    clockTickNow,
    licenseState.maxSeenMs,
  ]);

  useEffect(() => {
    if (!showExpiryReminder) return;
    const timer = window.setTimeout(() => {
      setShowExpiryReminder(false);
    }, 7000);
    return () => window.clearTimeout(timer);
  }, [showExpiryReminder]);

  const handleRecheckClock = async () => {
    const now = Date.now();
    const nativeClock = await syncClockHeartbeat();
    const effectiveMax = Math.max(licenseState.maxSeenMs || 0, nativeClock?.maxSeenMs || 0);
    const stillTampered =
      Boolean(nativeClock?.clockRollbackDetected) ||
      (effectiveMax > 0 && now < effectiveMax - 300_000);
    if (stillTampered) {
      notify('Jam HP masih terdeteksi mundur. Aktifkan Waktu Otomatis di Pengaturan HP.');
    } else {
      notify('Jam HP normal kembali.');
    }
  };

  const handleActivateSuccess = (normalizedCode: string) => {
    const effectiveNowMs = Math.max(Date.now(), licenseState.maxSeenMs || 0);
    const check = verifyActivationCode(normalizedCode, licenseState.deviceId, effectiveNowMs);
    if (!check.valid) {
      notify(check.reason || 'Kode aktivasi tidak valid');
      return;
    }
    const next: LocalLicenseState = {
      ...licenseState,
      maxSeenMs: Math.max(licenseState.maxSeenMs || 0, Date.now()),
      activationCode: normalizedCode,
    };
    setLicenseState(next);
    saveLocalLicenseState(next);
    persistNativeLicenseCode(normalizedCode);
    setShowActivationModal(false);
    setShowExpiryReminder(false);
    notify(
      check.plan === 'permanen'
        ? 'Lisensi Permanen SimpelKasir aktif!'
        : 'Lisensi berjangka SimpelKasir berhasil diaktifkan!'
    );
  };

  const handleResetToHome = () => {
    setDrawerOpen(false);
    setScreen('home');
  };

  if (!licenseEval.isUnlocked) {
    return (
      <AppErrorBoundary onResetToHome={handleResetToHome}>
        <div className="min-h-screen bg-[#F5F6F4] dark:bg-[#0E1418] text-[#17252B] dark:text-[#ECF1EF]">
          <ActivationGateScreen
            mode="locked"
            deviceId={licenseState.deviceId}
            maxSeenMs={licenseState.maxSeenMs}
            evaluation={licenseEval}
            onActivateSuccess={handleActivateSuccess}
            onRecheckClock={handleRecheckClock}
            onOpenVendorGenerator={() => setShowVendorGenerator(true)}
            notify={notify}
          />
          <VendorLicenseGeneratorModal
            open={showVendorGenerator}
            currentDeviceId={licenseState.deviceId}
            onClose={() => setShowVendorGenerator(false)}
            onApplyToCurrentDevice={handleActivateSuccess}
            notify={notify}
          />
          {toastMsg && (
            <div className="fixed bottom-8 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-2xl bg-[#132622]/95 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-xl border border-white/15 backdrop-blur-md">
              {toastMsg}
            </div>
          )}
        </div>
      </AppErrorBoundary>
    );
  }

  return (
    <AppErrorBoundary onResetToHome={handleResetToHome}>
      <div className="min-h-screen bg-[#F5F6F4] dark:bg-[#0E1418] text-[#17252B] dark:text-[#ECF1EF]">
      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        currentScreen={screen}
        onNavigate={navigate}
        store={data.store}
        activeUser={activeUser}
        isOwnerLoggedIn={isOwnerLoggedIn}
        onOpenOwnerAuth={openOwnerAuthModal}
      />

      {screen === 'home' && (
        <HomeScreen
          data={data}
          draft={draft}
          isOwnerLoggedIn={isOwnerLoggedIn}
          onOpenOwnerAuth={openOwnerAuthModal}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
        />
      )}

      {(screen === 'pos' || screen === 'cart' || screen === 'payment' || screen === 'receipt') && (
        <PosFlowScreens
          screen={screen}
          data={data}
          draft={draft}
          setDraft={setDraft}
          lastTransaction={lastTx}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
          onEditProductFromPos={(product) => {
            setEditingProduct(product);
            navigate('product_form');
          }}
          onSaveQuickCart={handleSaveQuickCart}
          onCompleteTransaction={handleCompleteTransaction}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {(screen === 'products' ||
        screen === 'product_form' ||
        screen === 'quick_tx' ||
        screen === 'customers' ||
        screen === 'master' ||
        screen === 'catalog') && (
        <InventoryScreens
          screen={screen}
          data={data}
          isOwnerLoggedIn={isOwnerLoggedIn}
          editingProduct={editingProduct}
          onBackFromForm={() => setScreen(prevScreen === 'pos' ? 'pos' : 'products')}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
          onEditProduct={setEditingProduct}
          onUpdateData={setData}
          onLoadQuickCart={handleLoadQuickCart}
          onQuickAddProductToCart={(p) => {
            setDraft((prev) => {
              const ex = prev.items.find((i) => i.productId === p.id);
              if (ex) {
                return {
                  ...prev,
                  items: prev.items.map((i) =>
                    i.productId === p.id ? { ...i, qty: i.qty + 1 } : i
                  ),
                };
              }
              return {
                ...prev,
                items: [
                  ...prev.items,
                  {
                    productId: p.id,
                    name: p.name,
                    costPrice: p.costPrice,
                    unitPrice: p.sellPrice,
                    qty: 1,
                    discount: 0,
                    note: '',
                    unit: p.unit || 'pcs',
                  },
                ],
              };
            });
            notify(`${p.name} masuk keranjang`);
          }}
          notify={notify}
        />
      )}

      {(screen === 'transactions' ||
        screen === 'cashflow' ||
        screen === 'expenses' ||
        screen === 'reports') && (
        <FinanceScreens
          screen={screen}
          data={data}
          isOwnerLoggedIn={isOwnerLoggedIn}
          onOpenDrawer={() => setDrawerOpen(true)}
          onNavigate={navigate}
          onOpenReceipt={(tx) => {
            setLastTx(tx);
            navigate('receipt');
          }}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {(screen === 'settings' ||
        screen === 'settings_business' ||
        screen === 'settings_product' ||
        screen === 'settings_receipt' ||
        screen === 'settings_printer' ||
        screen === 'settings_users' ||
        screen === 'settings_store') && (
        <SettingsScreens
          screen={screen}
          data={data}
          isOwnerLoggedIn={isOwnerLoggedIn}
          deviceId={licenseState.deviceId}
          licenseEvaluation={licenseEval}
          onOpenActivation={() => setShowActivationModal(true)}
          onOpenVendorGenerator={() => setShowVendorGenerator(true)}
          onOpenOwnerAuth={openOwnerAuthModal}
          onOpenDrawer={() => setDrawerOpen(true)}
          onBack={() =>
            setScreen(
              prevScreen === 'receipt' || prevScreen === 'pos' || prevScreen === 'products'
                ? prevScreen
                : 'settings'
            )
          }
          onNavigate={navigate}
          onUpdateData={setData}
          notify={notify}
        />
      )}

      {(screen === 'sync' || screen === 'settings_backup') && (
        <SyncScreen
          data={data}
          onOpenDrawer={() => setDrawerOpen(true)}
          onUpdateData={setData}
          onFullRestore={(restored) => {
            setData(restored);
            setDraft(EMPTY_DRAFT);
            clearActiveDraft();
            setLastTx(null);
          }}
          notify={notify}
        />
      )}

      {/* Modal Login / Logout Pemilik (Semua data toko tetap utuh saat logout) */}
      {showOwnerAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1311]/60 backdrop-blur-xs p-4">
          <div className="surface-card animate-modal-in w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    isOwnerLoggedIn
                      ? 'bg-[#165B49]/15 text-[#165B49] dark:text-[#4BB89A]'
                      : 'bg-[#24343F]/12 text-[#24343F] dark:text-slate-200'
                  }`}
                >
                  {isOwnerLoggedIn ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-[#17252B] dark:text-white">
                    {isOwnerLoggedIn && !changingPin
                      ? 'Akun Pemilik Aktif'
                      : !hasOwnerPass
                      ? 'Buat PIN / Sandi Pemilik'
                      : changingPin
                      ? 'Ubah PIN / Sandi Pemilik'
                      : 'Login Pemilik'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {isOwnerLoggedIn && !changingPin
                      ? 'Laba ditampilkan di semua menu'
                      : 'Khusus pemilik untuk melihat data laba'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeOwnerAuthModal}
                className="rounded-xl p-1 text-slate-400 hover:bg-black/5 dark:hover:bg-white/10"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isOwnerLoggedIn && !changingPin ? (
              <div className="space-y-3">
                <div className="rounded-2xl bg-[#F5F7F4] dark:bg-[#1B262E] p-3.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  Saat Anda <b>Logout</b>, tampilan Laba di Produk, Arus Kas, dan Laporan langsung disembunyikan. <b>Semua data toko tetap aman dan tidak terhapus.</b>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOwnerLoggedIn(false);
                    closeOwnerAuthModal();
                    notify('Pemilik logout. Data tetap aman & laba disembunyikan.');
                  }}
                  className="btn-lux-garnet flex w-full items-center justify-center gap-2 rounded-xl py-3 text-xs font-bold"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Logout Akun Pemilik</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPinInput('');
                    setPinConfirmInput('');
                    setAuthError('');
                    setChangingPin(true);
                  }}
                  className="btn-lux-soft flex w-full items-center justify-center gap-2 rounded-xl py-2.5 text-xs font-semibold"
                >
                  <LockOpen className="h-4 w-4" />
                  <span>Ubah PIN / Kata Sandi Pemilik</span>
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitOwnerAuth} className="space-y-3">
                {!hasOwnerPass && (
                  <p className="rounded-xl bg-[#165B49]/10 p-3 text-xs text-[#165B49] dark:text-[#4BB89A] leading-relaxed">
                    Belum ada PIN/Sandi Pemilik. Buat sekarang (minimal 4 angka atau huruf) agar hanya Pemilik yang dapat membuka tampilan Laba.
                  </p>
                )}
                <div>
                  <label className="text-xs font-semibold text-slate-500">
                    {!hasOwnerPass || changingPin ? 'PIN / Kata Sandi Baru' : 'Masukkan PIN / Kata Sandi Pemilik'}
                  </label>
                  <input
                    type="password"
                    autoFocus
                    value={pinInput}
                    onChange={(e) => {
                      setPinInput(e.target.value);
                      setAuthError('');
                    }}
                    placeholder="Minimal 4 karakter..."
                    className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#165B49]"
                  />
                </div>
                {(!hasOwnerPass || changingPin) && (
                  <div>
                    <label className="text-xs font-semibold text-slate-500">Ulangi PIN / Kata Sandi</label>
                    <input
                      type="password"
                      value={pinConfirmInput}
                      onChange={(e) => {
                        setPinConfirmInput(e.target.value);
                        setAuthError('');
                      }}
                      placeholder="Ketik ulang PIN / sandi..."
                      className="mt-1 w-full rounded-xl border border-[#D4DBD5] dark:border-[#2A3944] bg-transparent px-3 py-2.5 text-sm font-semibold outline-none focus:border-[#165B49]"
                    />
                  </div>
                )}
                {authError && (
                  <p className="text-xs font-semibold text-[#B54B54]">{authError}</p>
                )}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={closeOwnerAuthModal}
                    className="btn-lux-soft flex-1 rounded-xl py-2.5 text-xs font-bold"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="btn-lux-primary flex-1 rounded-xl py-2.5 text-xs font-bold"
                  >
                    {!hasOwnerPass || changingPin ? 'Simpan & Aktifkan' : 'Login Pemilik'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {showActivationModal && (
        <ActivationGateScreen
          mode="modal"
          deviceId={licenseState.deviceId}
          maxSeenMs={licenseState.maxSeenMs}
          evaluation={licenseEval}
          onActivateSuccess={handleActivateSuccess}
          onRecheckClock={handleRecheckClock}
          onClose={() => setShowActivationModal(false)}
          onOpenVendorGenerator={() => {
            setShowActivationModal(false);
            setShowVendorGenerator(true);
          }}
          notify={notify}
        />
      )}

      <VendorLicenseGeneratorModal
        open={showVendorGenerator}
        currentDeviceId={licenseState.deviceId}
        onClose={() => setShowVendorGenerator(false)}
        onApplyToCurrentDevice={handleActivateSuccess}
        notify={notify}
      />

      {/* Pop-up Pengingat Masa Aktif (Sekali Sehari, Mulai H-3 Sebelum Expired) */}
      {showExpiryReminder && licenseEval.isUnlocked && (
        <div
          role="status"
          aria-live="polite"
          className="fixed top-16 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2"
        >
          <div className="surface-card animate-modal-in rounded-2xl border border-[#C69B4B]/45 bg-white/95 dark:bg-[#172128]/95 p-3.5 shadow-2xl backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C69B4B]/15 text-[#9A6F21] dark:text-[#DFAA56]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-xs font-bold text-[#17252B] dark:text-white">
                  {licenseEval.status === 'trial'
                    ? `Masa Uji Coba Tinggal ${licenseEval.daysLeft} Hari`
                    : `Masa Aktif Tinggal ${licenseEval.daysLeft} Hari`}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                  Berakhir {licenseEval.expiresAtMs ? formatDateShort(licenseEval.expiresAtMs) : 'segera'}. Masukkan kode aktivasi agar aplikasi tetap bisa dipakai.
                </p>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowExpiryReminder(false);
                      setShowActivationModal(true);
                    }}
                    className="btn-lux-primary inline-flex min-h-[36px] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-bold"
                  >
                    Aktivasi Sekarang
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExpiryReminder(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-black/5 dark:text-slate-300 dark:hover:bg-white/10"
                aria-label="Tutup pengingat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="fixed bottom-20 left-1/2 z-50 w-max max-w-[90vw] -translate-x-1/2 rounded-2xl bg-[#132622]/95 px-4 py-2.5 text-center text-xs font-semibold text-white shadow-xl border border-white/15 backdrop-blur-md">
          {toastMsg}
        </div>
      )}
      </div>
    </AppErrorBoundary>
  );
}
