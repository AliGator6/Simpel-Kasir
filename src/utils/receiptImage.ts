import { ReceiptSettings, StoreInfo, Transaction } from '../types';
import { formatDateShort, formatMoney, formatNumber } from './storage';

export function renderReceiptToCanvas(
  tx: Transaction,
  store: StoreInfo,
  cfg: ReceiptSettings,
  currencySymbol: string
): HTMLCanvasElement {
  const width = cfg.paperWidth === '80' ? 680 : 520;
  const pad = 34;
  const money = (v: number) =>
    formatMoney(v, cfg.showCurrency ? currencySymbol : '', cfg.currencySpace, cfg.currencyRight);

  const lines: { type: 'gap' | 'dash' | 'item' | 'sub' | 'kv' | 'center' | 'note'; left?: string; right?: string; bold?: boolean; size?: number }[] = [];

  lines.push({ type: 'center', left: store.name, bold: true, size: cfg.largeStoreName ? 32 : 26 });
  if (store.address) lines.push({ type: 'center', left: store.address, size: 19 });
  if (store.city) lines.push({ type: 'center', left: store.city, size: 19 });
  if (store.phone) lines.push({ type: 'center', left: store.phone, size: 19 });
  lines.push({ type: 'gap' });

  const idStr = cfg.showTxIdMode === 'none' ? '' : `#${tx.receiptNo}`;
  lines.push({ type: 'kv', left: formatDateShort(tx.createdAt), right: idStr, size: 19 });
  if (tx.customerName && tx.customerName !== 'Umum') {
    lines.push({ type: 'kv', left: 'Pelanggan', right: tx.customerName, bold: cfg.largeCustomer, size: cfg.largeCustomer ? 23 : 19 });
  }
  if (cfg.showCashier) lines.push({ type: 'kv', left: 'Kasir', right: tx.cashierName, size: 18 });
  lines.push({ type: 'dash' });

  tx.items.forEach((item, idx) => {
    const prefix = cfg.showItemIndex ? `${idx + 1}. ` : '';
    lines.push({ type: 'item', left: `${prefix}${item.name}`, bold: true, size: cfg.largeItemName ? 24 : 20 });
    const qtyLabel = `${item.qty}${cfg.showUnit === 'all' ? (cfg.unitSpace ? ` ${item.unit}` : item.unit) : ''}x ${formatNumber(item.unitPrice)}`;
    const sub = item.unitPrice * item.qty - item.discount;
    lines.push({ type: 'sub', left: qtyLabel, right: formatNumber(sub), size: cfg.largeItemPrice ? 23 : 19 });
    if (item.discount > 0) lines.push({ type: 'sub', left: 'Diskon', right: `-${formatNumber(item.discount)}`, size: 17 });
    if (item.note) lines.push({ type: 'note', left: `  Catatan: ${item.note}`, size: 17 });
  });

  lines.push({ type: 'dash' });

  if (!cfg.noTotalMode) {
    if (tx.discount > 0) lines.push({ type: 'kv', left: 'Diskon Nota', right: `-${money(tx.discount)}`, size: 19 });
    if (tx.tax > 0) lines.push({ type: 'kv', left: 'Pajak', right: money(tx.tax), size: 19 });
    if (tx.shipping > 0) lines.push({ type: 'kv', left: 'Ongkir', right: money(tx.shipping), size: 19 });
    lines.push({ type: 'kv', left: 'Total', right: money(tx.total), bold: true, size: cfg.largeTotal ? 28 : 22 });
    if (tx.paidAmount > 0) {
      lines.push({ type: 'kv', left: tx.paymentMethod === 'non_tunai' ? 'Non Tunai' : 'Tunai', right: money(tx.paidAmount), size: cfg.largePayment ? 24 : 20 });
      lines.push({ type: 'kv', left: tx.changeAmount >= 0 ? 'Kembali' : 'Kurang', right: money(Math.abs(tx.changeAmount)), size: cfg.largeChange ? 24 : 20 });
    } else if (cfg.showUnpaidStatus) {
      lines.push({ type: 'kv', left: 'Status', right: 'Belum Dibayar', bold: true, size: cfg.largeStatus ? 24 : 20 });
    }
    if (cfg.showPaidStatus && tx.paymentStatus === 'lunas') {
      lines.push({ type: 'kv', left: 'Status', right: 'Lunas', bold: true, size: 19 });
    }
  }

  if (tx.note) {
    lines.push({ type: 'dash' });
    lines.push({ type: 'note', left: `Catatan: ${tx.note}`, size: 18 });
  }

  lines.push({ type: 'gap' });
  if (store.footer) lines.push({ type: cfg.centerFooter ? 'center' : 'note', left: store.footer, size: 20 });

  let totalHeight = pad * 2;
  lines.forEach((l) => {
    if (l.type === 'gap') totalHeight += 18;
    else if (l.type === 'dash') totalHeight += 20;
    else totalHeight += (l.size || 20) + 12;
  });

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, totalHeight);

  let y = pad + 18;
  ctx.fillStyle = '#1A202C';

  lines.forEach((l) => {
    const size = l.size || 20;
    ctx.font = `${l.bold ? '700' : '400'} ${size}px "Plus Jakarta Sans", Arial, sans-serif`;
    if (l.type === 'gap') y += 18;
    else if (l.type === 'dash') {
      ctx.strokeStyle = '#374151';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pad, y - 4);
      ctx.lineTo(width - pad, y - 4);
      ctx.stroke();
      ctx.setLineDash([]);
      y += 20;
    } else if (l.type === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(l.left || '', width / 2, y);
      y += size + 12;
    } else if (l.type === 'item' || l.type === 'note') {
      ctx.textAlign = 'left';
      ctx.fillText(l.left || '', pad, y);
      y += size + 10;
    } else if (l.type === 'sub') {
      ctx.textAlign = 'left';
      ctx.fillText(l.left || '', pad + 18, y);
      ctx.textAlign = 'right';
      ctx.fillText(l.right || '', width - pad, y);
      y += size + 12;
    } else if (l.type === 'kv') {
      ctx.textAlign = 'left';
      ctx.fillText(l.left || '', pad, y);
      ctx.textAlign = 'right';
      ctx.fillText(l.right || '', width - pad, y);
      y += size + 12;
    }
  });

  return canvas;
}

export async function shareReceiptWhatsApp(
  tx: Transaction,
  store: StoreInfo,
  cfg: ReceiptSettings,
  currencySymbol: string
): Promise<string> {
  const canvas = renderReceiptToCanvas(tx, store, cfg, currencySymbol);
  const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  const money = (v: number) => formatMoney(v, currencySymbol, cfg.currencySpace, cfg.currencyRight);

  const captionLines = [
    `*${store.name}*`,
    `Struk #${tx.receiptNo} (${formatDateShort(tx.createdAt)})`,
    ...tx.items.map((it) => `- ${it.name} (${it.qty}x ${formatNumber(it.unitPrice)}) = ${formatNumber(it.unitPrice * it.qty - it.discount)}`),
    `*Total: ${money(tx.total)}*`,
    tx.paidAmount > 0 ? `Bayar: ${money(tx.paidAmount)}` : 'Status: Belum Dibayar',
    tx.changeAmount > 0 ? `Kembali: ${money(tx.changeAmount)}` : '',
    store.footer || 'Terima kasih',
  ].filter(Boolean);

  if (blob) {
    const file = new File([blob], `Struk_${tx.receiptNo}_${store.name.replace(/\s+/g, '_')}.png`, { type: 'image/png' });
    const nav = navigator as unknown as {
      canShare?: (data: { files?: File[] }) => boolean;
      share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>;
    };
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      await nav.share({ files: [file], title: `Struk #${tx.receiptNo} - ${store.name}`, text: captionLines.join('\n') });
      return 'shared_image';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Struk_${tx.receiptNo}.png`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return captionLines.join('\n');
}
