import { PrinterSettings, ReceiptSettings, StoreInfo, Transaction } from '../types';
import { formatDateShort, formatMoney, formatNumber } from './storage';
import { renderReceiptToCanvas } from './receiptImage';

export interface PairedDevice {
  name: string;
  address: string;
  bonded?: boolean;
  isPrinter?: boolean;
}

interface NativePrinterPlugin {
  listPaired(): Promise<{ devices: PairedDevice[] }>;
  scanDevices?(): Promise<{ devices: PairedDevice[] }>;
  autoConnect?(options: { address: string }): Promise<{ ok: boolean; reason?: string }>;
  disconnect?(): Promise<{ ok: boolean }>;
  testConnection?(options: { address: string }): Promise<{ ok: boolean }>;
  printBytes(options: { address: string; base64: string }): Promise<{ ok: boolean }>;
  testPrint(options: { address: string; paperWidth: string; bottomFeedMm?: number }): Promise<{ ok: boolean }>;
  saveFileToDownloads?(options: { fileName: string; content: string; mimeType: string }): Promise<{ ok: boolean; path?: string }>;
}

interface CapacitorBridgeWindow {
  Capacitor?: {
    isNativePlatform?: () => boolean;
    getPlatform?: () => string;
    Plugins?: Record<string, NativePrinterPlugin>;
    registerPlugin?: <T>(pluginName: string) => T;
    nativePromise?: <T>(pluginName: string, methodName: string, options?: Record<string, unknown>) => Promise<T>;
  };
}

let cachedNativePrinter: NativePrinterPlugin | null = null;

function getNativePrinter(): NativePrinterPlugin | null {
  if (cachedNativePrinter) return cachedNativePrinter;
  const cap = (window as unknown as CapacitorBridgeWindow).Capacitor;
  if (!cap) return null;

  if (cap.Plugins?.BluetoothPrinter) {
    cachedNativePrinter = cap.Plugins.BluetoothPrinter;
    return cachedNativePrinter;
  }

  const isNative =
    Boolean(cap.isNativePlatform?.()) ||
    cap.getPlatform?.() === 'android' ||
    typeof cap.nativePromise === 'function';

  if (!isNative) return null;

  if (typeof cap.registerPlugin === 'function') {
    try {
      const registered = cap.registerPlugin<NativePrinterPlugin>('BluetoothPrinter');
      if (registered) {
        cachedNativePrinter = registered;
        return cachedNativePrinter;
      }
    } catch {
      // fallback ke nativePromise
    }
  }

  if (typeof cap.nativePromise === 'function') {
    const np = cap.nativePromise.bind(cap);
    cachedNativePrinter = {
      listPaired: () => np<{ devices: PairedDevice[] }>('BluetoothPrinter', 'listPaired', {}),
      scanDevices: () => np<{ devices: PairedDevice[] }>('BluetoothPrinter', 'scanDevices', {}),
      autoConnect: (options) => np<{ ok: boolean; reason?: string }>('BluetoothPrinter', 'autoConnect', options),
      disconnect: () => np<{ ok: boolean }>('BluetoothPrinter', 'disconnect', {}),
      testConnection: (options) => np<{ ok: boolean }>('BluetoothPrinter', 'testConnection', options),
      printBytes: (options) => np<{ ok: boolean }>('BluetoothPrinter', 'printBytes', options),
      testPrint: (options) => np<{ ok: boolean }>('BluetoothPrinter', 'testPrint', options),
      saveFileToDownloads: (options) =>
        np<{ ok: boolean; path?: string }>('BluetoothPrinter', 'saveFileToDownloads', options),
    };
    return cachedNativePrinter;
  }

  return null;
}

export function isNativeAndroidPrinterAvailable(): boolean {
  return !!getNativePrinter();
}

export async function autoConnectBluetoothPrinter(address: string): Promise<boolean> {
  if (!address) return false;
  const native = getNativePrinter();
  if (!native || typeof native.autoConnect !== 'function') return false;
  try {
    const res = await native.autoConnect({ address });
    return Boolean(res?.ok);
  } catch {
    return false;
  }
}

export async function saveExportFile(
  fileName: string,
  content: string,
  mimeType: string
): Promise<{ savedPath: string; isNative: boolean }> {
  const native = getNativePrinter();
  if (native && typeof native.saveFileToDownloads === 'function') {
    const res = await native.saveFileToDownloads({ fileName, content, mimeType });
    if (res?.ok) {
      return { savedPath: res.path || `Download/${fileName}`, isNative: true };
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
  return { savedPath: fileName, isNative: false };
}

export async function scanPairedBluetoothPrinters(): Promise<PairedDevice[]> {
  const native = getNativePrinter();
  if (native) {
    if (typeof native.scanDevices === 'function') {
      const res = await native.scanDevices();
      return res.devices || [];
    }
    const res = await native.listPaired();
    return res.devices || [];
  }
  const nav = navigator as unknown as {
    bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string; id: string }> };
  };
  if (nav.bluetooth) {
    const dev = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
    });
    return [{ name: dev.name || 'Printer Thermal BLE', address: dev.id, isPrinter: true }];
  }
  throw new Error('Bluetooth native aktif di aplikasi APK Android. Di browser biasa silakan gunakan tombol Cetak.');
}

export async function testBluetoothPrinterConnection(address: string): Promise<boolean> {
  const native = getNativePrinter();
  if (!native) {
    throw new Error('Koneksi Bluetooth native hanya tersedia di APK Android.');
  }
  if (!address) {
    throw new Error('Pilih printer terlebih dahulu.');
  }
  if (typeof native.testConnection === 'function') {
    const res = await native.testConnection({ address });
    return Boolean(res?.ok);
  }
  return true;
}

function encodeAscii(str: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    out.push(code < 128 ? code : 63);
  }
  return out;
}

function padRow(left: string, right: string, cols: number): string {
  const maxLeft = Math.max(4, cols - right.length - 1);
  const l = left.length > maxLeft ? left.slice(0, maxLeft) : left;
  const spaces = Math.max(1, cols - l.length - right.length);
  return l + ' '.repeat(spaces) + right;
}

function appendBottomFeedMm(bytes: number[], mm: number) {
  let dots = Math.max(0, Math.round(mm)) * 8;
  while (dots > 0) {
    const step = Math.min(240, dots);
    bytes.push(0x1b, 0x4a, step);
    dots -= step;
  }
}

export function buildEscPosReceiptBytes(
  tx: Transaction,
  store: StoreInfo,
  receiptCfg: ReceiptSettings,
  printerCfg: PrinterSettings,
  currencySymbol: string
): Uint8Array {
  const cols = printerCfg.paperWidth === '80' ? 48 : 32;
  const line = '-'.repeat(cols);
  const b: number[] = [];

  const pushText = (t: string) => b.push(...encodeAscii(t + '\n'));
  const ESC = 0x1b;
  const GS = 0x1d;

  // Initialize printer
  b.push(ESC, 0x40);

  // Line spacing (ESC 3 n or ESC 2)
  const spacing = printerCfg.lineSpacing ?? 'compact';
  if (spacing === 'tight') {
    b.push(ESC, 0x33, 24);
  } else if (spacing === 'compact') {
    b.push(ESC, 0x33, 27);
  } else if (spacing === 'wide') {
    b.push(ESC, 0x33, 36);
  } else {
    b.push(ESC, 0x32);
  }

  // Align center header
  b.push(ESC, 0x61, 0x01);
  b.push(ESC, 0x45, 0x01);
  if (receiptCfg.largeStoreName) b.push(GS, 0x21, 0x11);
  pushText(store.name);
  b.push(GS, 0x21, 0x00);
  b.push(ESC, 0x45, 0x00);
  if (store.address) pushText(store.address);
  if (store.city) pushText(store.city);
  if (store.phone) pushText(store.phone);

  // Align left
  b.push(ESC, 0x61, 0x00);
  const idPart = receiptCfg.showTxIdMode === 'none' ? '' : `#${tx.receiptNo}`;
  pushText(padRow(formatDateShort(tx.createdAt), idPart, cols));
  if (tx.customerName && tx.customerName !== 'Umum') {
    pushText(`Pelanggan: ${tx.customerName}`);
  }
  if (receiptCfg.showCashier) {
    pushText(`Kasir: ${tx.cashierName}`);
  }
  pushText(line);

  const money = (v: number) =>
    formatMoney(v, receiptCfg.showCurrency ? currencySymbol : '', receiptCfg.currencySpace, receiptCfg.currencyRight);

  tx.items.forEach((item, idx) => {
    const prefix = receiptCfg.showItemIndex ? `${idx + 1}. ` : '';
    const qtyStr = `${item.qty}${receiptCfg.showUnit === 'all' ? (receiptCfg.unitSpace ? ` ${item.unit}` : item.unit) : ''}x`;
    const sub = item.unitPrice * item.qty - item.discount;

    b.push(ESC, 0x45, 0x01);
    pushText(`${prefix}${item.name}`);
    b.push(ESC, 0x45, 0x00);
    pushText(padRow(`  ${qtyStr} ${formatNumber(item.unitPrice)}`, formatNumber(sub), cols));
    if (item.discount > 0) {
      pushText(padRow('  Diskon item', `-${formatNumber(item.discount)}`, cols));
    }
    if (item.note) {
      pushText(`  Cat: ${item.note}`);
    }
  });

  pushText(line);
  if (!receiptCfg.noTotalMode) {
    if (tx.discount > 0) pushText(padRow('Diskon', `-${money(tx.discount)}`, cols));
    if (tx.tax > 0) pushText(padRow('Pajak', money(tx.tax), cols));
    if (tx.shipping > 0) pushText(padRow('Ongkir', money(tx.shipping), cols));

    b.push(ESC, 0x45, 0x01);
    pushText(padRow('Total', money(tx.total), cols));
    b.push(ESC, 0x45, 0x00);
    if (tx.paidAmount > 0) {
      pushText(padRow(tx.paymentMethod === 'non_tunai' ? 'Non Tunai' : 'Tunai', money(tx.paidAmount), cols));
      if (tx.changeAmount >= 0) {
        pushText(padRow('Kembali', money(tx.changeAmount), cols));
      } else {
        pushText(padRow('Kurang', money(Math.abs(tx.changeAmount)), cols));
      }
    } else {
      pushText(padRow('Status', 'Belum Dibayar', cols));
    }
  }

  if (tx.note) {
    pushText(line);
    pushText(`Catatan: ${tx.note}`);
  }

  if (store.footer) {
    if (receiptCfg.centerFooter) b.push(ESC, 0x61, 0x01);
    pushText(store.footer);
  }

  // Exact bottom margin in mm (every 5mm = 40 dots on 203 DPI thermal printers)
  const bottomMm = (printerCfg.bottomFeedMm ?? 5) + (printerCfg.cutFeedExtra ? 10 : 0);
  appendBottomFeedMm(b, bottomMm);

  if (printerCfg.cashDrawer) {
    b.push(ESC, 0x70, 0x00, 0x19, 0xfa);
  }
  // Only issue GS V cutter feed on 80mm desktop printers; 58mm portable printers feed extra unwanted paper on GS V
  if (printerCfg.paperWidth === '80') {
    b.push(GS, 0x56, 0x42, 0x00);
  }

  return new Uint8Array(b);
}

function buildRasterGraphicEscPos(canvas: HTMLCanvasElement, printerCfg: PrinterSettings): Uint8Array {
  const targetWidth = printerCfg.paperWidth === '80' ? 576 : 384;
  const scale = targetWidth / canvas.width;
  const targetHeight = Math.round(canvas.height * scale);

  const off = document.createElement('canvas');
  off.width = targetWidth;
  off.height = targetHeight;
  const ctx = off.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
  const widthBytes = Math.ceil(targetWidth / 8);
  const header = [0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, targetHeight & 0xff, (targetHeight >> 8) & 0xff];
  const raster: number[] = [...header];

  for (let y = 0; y < targetHeight; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < targetWidth) {
          const idx = (y * targetWidth + x) * 4;
          const lum = 0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2];
          if (lum < 150) {
            byte |= 1 << (7 - bit);
          }
        }
      }
      raster.push(byte);
    }
  }

  const bottomMm = (printerCfg.bottomFeedMm ?? 5) + (printerCfg.cutFeedExtra ? 10 : 0);
  appendBottomFeedMm(raster, bottomMm);
  if (printerCfg.cashDrawer) raster.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  if (printerCfg.paperWidth === '80') raster.push(0x1d, 0x56, 0x42, 0x00);
  return new Uint8Array(raster);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export async function printThermalTransaction(
  tx: Transaction,
  store: StoreInfo,
  receiptCfg: ReceiptSettings,
  printerCfg: PrinterSettings,
  currencySymbol: string
): Promise<'native' | 'browser'> {
  const native = getNativePrinter();
  if (native) {
    if (!printerCfg.selectedPrinterAddress) {
      throw new Error('Pilih printer Bluetooth terlebih dahulu di Pengaturan > Printer.');
    }
    let bytes: Uint8Array;
    if (printerCfg.graphicMode) {
      const canvas = renderReceiptToCanvas(tx, store, receiptCfg, currencySymbol);
      bytes = buildRasterGraphicEscPos(canvas, printerCfg);
    } else {
      bytes = buildEscPosReceiptBytes(tx, store, receiptCfg, printerCfg, currencySymbol);
    }
    let payload = bytes;
    if (printerCfg.printTwice) {
      const doubled = new Uint8Array(bytes.length * 2);
      doubled.set(bytes, 0);
      doubled.set(bytes, bytes.length);
      payload = doubled;
    }
    const base64 = uint8ToBase64(payload);
    await native.printBytes({ address: printerCfg.selectedPrinterAddress, base64 });
    return 'native';
  }
  window.print();
  return 'browser';
}

export async function runTestPrint(printerCfg: PrinterSettings, storeName: string): Promise<'native' | 'browser'> {
  const native = getNativePrinter();
  if (native) {
    if (!printerCfg.selectedPrinterAddress) {
      throw new Error('Pilih printer Bluetooth terlebih dahulu dengan mengetuk tombol Scan / Refresh.');
    }
    await native.testPrint({
      address: printerCfg.selectedPrinterAddress,
      paperWidth: printerCfg.paperWidth,
      bottomFeedMm: printerCfg.bottomFeedMm ?? 5,
    });
    return 'native';
  }
  const cols = printerCfg.paperWidth === '80' ? 48 : 32;
  const msg = `${storeName}\nTEST PRINT BERHASIL\n${'-'.repeat(cols)}\nSimpelKasir (${printerCfg.paperWidth}mm)\n`;
  if (typeof window !== 'undefined') {
    console.info(msg);
    window.print();
  }
  return 'browser';
}
