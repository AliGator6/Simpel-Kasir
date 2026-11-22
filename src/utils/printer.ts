import { PrinterSettings, ReceiptSettings, StoreInfo, Transaction } from '../types';
import { formatDateShort, formatMoney, formatNumber } from './storage';
import { renderReceiptToCanvas } from './receiptImage';

export interface PairedDevice { name: string; address: string; }

interface NativePrinterPlugin {
  listPaired(): Promise<{ devices: PairedDevice[] }>;
  printBytes(options: { address: string; base64: string }): Promise<{ ok: boolean }>;
  testPrint(options: { address: string; paperWidth: string }): Promise<{ ok: boolean }>;
}

function getNativePrinter(): NativePrinterPlugin | null {
  const cap = (window as unknown as { Capacitor?: { Plugins?: { BluetoothPrinter?: NativePrinterPlugin } } }).Capacitor;
  return cap?.Plugins?.BluetoothPrinter || null;
}

export async function scanPairedBluetoothPrinters(): Promise<PairedDevice[]> {
  const native = getNativePrinter();
  if (native) {
    const res = await native.listPaired();
    return res.devices || [];
  }
  const nav = navigator as unknown as { bluetooth?: { requestDevice: (opts: unknown) => Promise<{ name?: string; id: string }> } };
  if (nav.bluetooth) {
    const dev = await nav.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb', '49535343-fe7d-4ae5-8fa9-9fafd205e455'],
    });
    return [{ name: dev.name || 'Printer Thermal BLE', address: dev.id }];
  }
  throw new Error('Bluetooth native aktif setelah dibungkus menjadi APK Android.');
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
  return l + ' '.repeat(Math.max(1, cols - l.length - right.length)) + right;
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

  b.push(ESC, 0x40, ESC, 0x61, 0x01, ESC, 0x45, 0x01);
  if (receiptCfg.largeStoreName) b.push(GS, 0x21, 0x11);
  pushText(store.name);
  b.push(GS, 0x21, 0x00, ESC, 0x45, 0x00);
  if (store.address) pushText(store.address);
  if (store.city) pushText(store.city);
  if (store.phone) pushText(store.phone);
  pushText('');

  b.push(ESC, 0x61, 0x00);
  pushText(padRow(formatDateShort(tx.createdAt), receiptCfg.showTxIdMode === 'none' ? '' : `#${tx.receiptNo}`, cols));
  if (tx.customerName && tx.customerName !== 'Umum') pushText(`Pelanggan: ${tx.customerName}`);
  if (receiptCfg.showCashier) pushText(`Kasir: ${tx.cashierName}`);
  pushText(line);

  const money = (v: number) => formatMoney(v, receiptCfg.showCurrency ? currencySymbol : '', receiptCfg.currencySpace, receiptCfg.currencyRight);

  tx.items.forEach((item, idx) => {
    const prefix = receiptCfg.showItemIndex ? `${idx + 1}. ` : '';
    const qtyStr = `${item.qty}${receiptCfg.showUnit === 'all' ? (receiptCfg.unitSpace ? ` ${item.unit}` : item.unit) : ''}x`;
    const sub = item.unitPrice * item.qty - item.discount;
    b.push(ESC, 0x45, 0x01);
    pushText(`${prefix}${item.name}`);
    b.push(ESC, 0x45, 0x00);
    pushText(padRow(`  ${qtyStr} ${formatNumber(item.unitPrice)}`, formatNumber(sub), cols));
    if (item.discount > 0) pushText(padRow('  Diskon item', `-${formatNumber(item.discount)}`, cols));
    if (item.note) pushText(`  Cat: ${item.note}`);
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
      pushText(padRow(tx.changeAmount >= 0 ? 'Kembali' : 'Kurang', money(Math.abs(tx.changeAmount)), cols));
    } else {
      pushText(padRow('Status', 'Belum Dibayar', cols));
    }
  }

  if (tx.note) { pushText(line); pushText(`Catatan: ${tx.note}`); }
  pushText('');
  if (receiptCfg.centerFooter) b.push(ESC, 0x61, 0x01);
  if (store.footer) pushText(store.footer);
  pushText('\n');
  if (printerCfg.cutFeedExtra) pushText('\n');
  if (printerCfg.cashDrawer) b.push(ESC, 0x70, 0x00, 0x19, 0xfa);
  b.push(GS, 0x56, 0x42, 0x00);
  return new Uint8Array(b);
}

function buildRasterGraphicEscPos(canvas: HTMLCanvasElement, printerCfg: PrinterSettings): Uint8Array {
  const targetWidth = printerCfg.paperWidth === '80' ? 576 : 384;
  const targetHeight = Math.round(canvas.height * (targetWidth / canvas.width));
  const off = document.createElement('canvas');
  off.width = targetWidth;
  off.height = targetHeight;
  const ctx = off.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, targetWidth, targetHeight);
  ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

  const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight).data;
  const widthBytes = Math.ceil(targetWidth / 8);
  const raster: number[] = [0x1b, 0x40, 0x1d, 0x76, 0x30, 0x00, widthBytes & 0xff, (widthBytes >> 8) & 0xff, targetHeight & 0xff, (targetHeight >> 8) & 0xff];

  for (let y = 0; y < targetHeight; y++) {
    for (let xByte = 0; xByte < widthBytes; xByte++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = xByte * 8 + bit;
        if (x < targetWidth) {
          const idx = (y * targetWidth + x) * 4;
          if (0.299 * imgData[idx] + 0.587 * imgData[idx + 1] + 0.114 * imgData[idx + 2] < 150) byte |= 1 << (7 - bit);
        }
      }
      raster.push(byte);
    }
  }
  raster.push(0x0a, 0x0a, 0x0a);
  if (printerCfg.cutFeedExtra) raster.push(0x0a, 0x0a);
  if (printerCfg.cashDrawer) raster.push(0x1b, 0x70, 0x00, 0x19, 0xfa);
  raster.push(0x1d, 0x56, 0x42, 0x00);
  return new Uint8Array(raster);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export async function printThermalTransaction(
  tx: Transaction, store: StoreInfo, receiptCfg: ReceiptSettings, printerCfg: PrinterSettings, currencySymbol: string
): Promise<'native' | 'browser'> {
  const native = getNativePrinter();
  if (native && printerCfg.selectedPrinterAddress) {
    const bytes = printerCfg.graphicMode
      ? buildRasterGraphicEscPos(renderReceiptToCanvas(tx, store, receiptCfg, currencySymbol), printerCfg)
      : buildEscPosReceiptBytes(tx, store, receiptCfg, printerCfg, currencySymbol);
    const base64 = uint8ToBase64(bytes);
    await native.printBytes({ address: printerCfg.selectedPrinterAddress, base64 });
    if (printerCfg.printTwice) await native.printBytes({ address: printerCfg.selectedPrinterAddress, base64 });
    return 'native';
  }
  window.print();
  return 'browser';
}

export async function runTestPrint(printerCfg: PrinterSettings): Promise<'native' | 'browser'> {
  const native = getNativePrinter();
  if (native && printerCfg.selectedPrinterAddress) {
    await native.testPrint({ address: printerCfg.selectedPrinterAddress, paperWidth: printerCfg.paperWidth });
    return 'native';
  }
  window.print();
  return 'browser';
}
