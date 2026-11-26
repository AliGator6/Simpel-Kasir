import {
  ActiveOrderDraft,
  AppData,
  BusinessFlags,
  CashflowEntry,
  Customer,
  MasterData,
  Product,
  ProductSettings,
  ReceiptSettings,
  SavedQuickCart,
  StoreInfo,
  Transaction,
  UserAccount,
} from '../types';

const STORAGE_KEY = 'simpelkasir_db_v1';
const DRAFT_STORAGE_KEY = 'simpelkasir_active_draft_v1';
const IDB_NAME = 'simpelkasir_idb';
const IDB_STORE = 'state';

export const EMPTY_DRAFT: ActiveOrderDraft = {
  items: [],
  customerId: null,
  customerName: 'Umum',
  discount: 0,
  shipping: 0,
  note: '',
  progressStatus: 'antri',
};

export const DEFAULT_APP_DATA: AppData = {
  version: '1.0.0',
  darkMode: false,
  currencySymbol: 'Rp',
  store: {
    name: 'Toko Cahaya',
    address: 'Jl. Raya Sehat',
    city: 'Kota Bersih',
    phone: '031-012345',
    footer: 'Terima kasih',
  },
  businessFlags: {
    useStock: true,
    useIngredients: false,
    useBarcode: false,
    useTax: false,
    taxPercent: 11,
    useProgress: false,
    useShipping: false,
    showQuickAddProductInPos: true,
  },
  productSettings: {
    useSku: true,
    useBarcode: true,
    useFrontCamera: false,
    useUnit: false,
    useCategory: false,
    useStock: true,
    useIngredients: false,
    useFixedProfit: false,
    strictSearch: false,
    autoNoteAltPrice: false,
    posRowDensity: 'normal',
    posFontScale: 'normal',
  },
  receiptSettings: {
    paperWidth: '58',
    showUnit: 'decimal',
    showLatePaymentTime: 'yes',
    showTxIdMode: 'id',
    simpleMode: false,
    showProductCount: false,
    showTotalItems: false,
    showItemIndex: false,
    singleLineOneItem: false,
    singleLineWithQty: false,
    shortDate: false,
    showCashier: false,
    showCustomerAddress: false,
    showCustomerPhone: false,
    showCustomerDebt: false,
    showPaidStatus: false,
    showUnpaidStatus: true,
    showCompletedDate: false,
    showPrintDate: false,
    showProgress: false,
    signatureCount: 0,
    qrBarcodeMode: 'none',
    showCurrency: true,
    currencyRight: false,
    currencySpace: false,
    unitSpace: false,
    centerFooter: true,
    largeStoreName: false,
    largeCustomer: false,
    largeItemName: false,
    largeItemPrice: false,
    largeTotal: false,
    largePayment: false,
    largeChange: false,
    largeStatus: false,
    labelMode: false,
    noTotalMode: false,
  },
  printerSettings: {
    connectionType: 'bluetooth',
    paperWidth: '58',
    graphicMode: false,
    autoPrintAfterTx: true,
    printTwice: false,
    cashDrawer: false,
    cutFeedExtra: false,
    bottomFeedMm: 5,
    lineSpacing: 'compact',
    language: 'standard',
    selectedPrinterName: '',
    selectedPrinterAddress: '',
  },
  master: {
    units: ['pcs', 'box', 'renceng', 'dus', 'kg', 'liter'],
    categories: ['Minuman', 'Makanan Ringan', 'Sembako', 'Lainnya'],
    suppliers: [
      { id: 'sup-1', name: 'Distributor Sumber Makmur', phone: '08123456789', debt: 0 },
    ],
  },
  users: [
    { id: 'usr-admin', name: 'Admin', role: 'Admin', pin: '' },
    { id: 'usr-kasir', name: 'Kasir 1', role: 'Kasir', pin: '' },
  ],
  activeUserId: 'usr-admin',
  products: [
    {
      id: 'p-1',
      name: 'Aqua',
      sku: 'AQ-01',
      costPrice: 3500,
      sellPrice: 5000,
      priceEditable: false,
      barcode: '8998899111001',
      stock: 48,
      unit: 'pcs',
      category: 'Minuman',
      composition: '',
      image: '',
      catalogNote: 'Air mineral 600ml',
      createdAt: 1700000001000,
    },
    {
      id: 'p-2',
      name: 'Bengbeng box 2rb',
      sku: 'BB-02',
      costPrice: 32500,
      sellPrice: 37500,
      priceEditable: false,
      barcode: '8996001300121',
      stock: 15,
      unit: 'box',
      category: 'Makanan Ringan',
      composition: '',
      image: '',
      catalogNote: '1 box isi 20 pcs',
      createdAt: 1700000002000,
    },
    {
      id: 'p-3',
      name: 'Chitop B',
      sku: 'CT-03',
      costPrice: 15500,
      sellPrice: 18000,
      priceEditable: false,
      barcode: '8996001300222',
      stock: 20,
      unit: 'pcs',
      category: 'Makanan Ringan',
      composition: '',
      image: '',
      catalogNote: '',
      createdAt: 1700000003000,
    },
    {
      id: 'p-4',
      name: 'Le mineral Tanggung',
      sku: 'LM-04',
      costPrice: 2200,
      sellPrice: 2500,
      priceEditable: false,
      barcode: '8996001600111',
      stock: 60,
      unit: 'pcs',
      category: 'Minuman',
      composition: '',
      image: '',
      catalogNote: 'Botol sedang 600ml',
      createdAt: 1700000004000,
    },
    {
      id: 'p-5',
      name: 'Nextar box',
      sku: 'NX-05',
      costPrice: 15500,
      sellPrice: 18000,
      priceEditable: false,
      barcode: '8996001400333',
      stock: 18,
      unit: 'box',
      category: 'Makanan Ringan',
      composition: '',
      image: '',
      catalogNote: '',
      createdAt: 1700000005000,
    },
    {
      id: 'p-6',
      name: 'Qtela',
      sku: 'QT-06',
      costPrice: 15000,
      sellPrice: 18000,
      priceEditable: false,
      barcode: '8996001500444',
      stock: 24,
      unit: 'pcs',
      category: 'Makanan Ringan',
      composition: '',
      image: '',
      catalogNote: '',
      createdAt: 1700000006000,
    },
  ],
  customers: [
    { id: 'cust-1', name: 'Bu Sari', phone: '081344556677', address: 'Jl. Melati No. 12', note: 'Langganan warung' },
    { id: 'cust-2', name: 'Pak Budi', phone: '085611223344', address: 'Perum Asri Blok B4', note: '' },
  ],
  quickCarts: [],
  transactions: [],
  cashflows: [],
  nextReceiptNo: 1,
};

export function normalizeAppData(parsed: Partial<AppData> | null | undefined): AppData {
  const safe = parsed && typeof parsed === 'object' ? parsed : {};
  const rawMaster: Partial<MasterData> = safe.master && typeof safe.master === 'object' ? safe.master : {};
  return {
    ...DEFAULT_APP_DATA,
    ...safe,
    version: typeof safe.version === 'string' && safe.version ? safe.version : DEFAULT_APP_DATA.version,
    darkMode: typeof safe.darkMode === 'boolean' ? safe.darkMode : DEFAULT_APP_DATA.darkMode,
    currencySymbol:
      typeof safe.currencySymbol === 'string' && safe.currencySymbol.trim()
        ? safe.currencySymbol
        : DEFAULT_APP_DATA.currencySymbol,
    store: {
      ...DEFAULT_APP_DATA.store,
      ...(safe.store && typeof safe.store === 'object' ? safe.store : {}),
    },
    businessFlags: {
      ...DEFAULT_APP_DATA.businessFlags,
      ...(safe.businessFlags && typeof safe.businessFlags === 'object' ? safe.businessFlags : {}),
    },
    productSettings: {
      ...DEFAULT_APP_DATA.productSettings,
      ...(safe.productSettings && typeof safe.productSettings === 'object' ? safe.productSettings : {}),
    },
    receiptSettings: {
      ...DEFAULT_APP_DATA.receiptSettings,
      ...(safe.receiptSettings && typeof safe.receiptSettings === 'object' ? safe.receiptSettings : {}),
    },
    printerSettings: {
      ...DEFAULT_APP_DATA.printerSettings,
      ...(safe.printerSettings && typeof safe.printerSettings === 'object' ? safe.printerSettings : {}),
    },
    master: {
      units:
        Array.isArray(rawMaster.units) && rawMaster.units.length > 0
          ? rawMaster.units
          : DEFAULT_APP_DATA.master.units,
      categories:
        Array.isArray(rawMaster.categories) && rawMaster.categories.length > 0
          ? rawMaster.categories
          : DEFAULT_APP_DATA.master.categories,
      suppliers: Array.isArray(rawMaster.suppliers)
        ? rawMaster.suppliers
        : DEFAULT_APP_DATA.master.suppliers,
    },
    users:
      Array.isArray(safe.users) && safe.users.filter((u) => u && typeof u === 'object').length > 0
        ? safe.users.filter((u) => u && typeof u === 'object')
        : DEFAULT_APP_DATA.users,
    activeUserId:
      typeof safe.activeUserId === 'string' && safe.activeUserId
        ? safe.activeUserId
        : DEFAULT_APP_DATA.activeUserId,
    products: Array.isArray(safe.products)
      ? safe.products.filter((p) => p && typeof p === 'object' && typeof p.name === 'string')
      : DEFAULT_APP_DATA.products,
    customers: Array.isArray(safe.customers)
      ? safe.customers.filter((c) => c && typeof c === 'object' && typeof c.name === 'string')
      : DEFAULT_APP_DATA.customers,
    quickCarts: Array.isArray(safe.quickCarts)
      ? safe.quickCarts.filter((q) => q && typeof q === 'object' && Array.isArray(q.items))
      : [],
    transactions: Array.isArray(safe.transactions)
      ? safe.transactions.filter((t) => t && typeof t === 'object' && Array.isArray(t.items))
      : [],
    cashflows: Array.isArray(safe.cashflows)
      ? safe.cashflows.filter((c) => c && typeof c === 'object')
      : [],
    nextReceiptNo:
      typeof safe.nextReceiptNo === 'number' && Number.isFinite(safe.nextReceiptNo) && safe.nextReceiptNo >= 1
        ? safe.nextReceiptNo
        : DEFAULT_APP_DATA.nextReceiptNo,
    ownerAuth:
      safe.ownerAuth &&
      typeof safe.ownerAuth === 'object' &&
      typeof safe.ownerAuth.passHash === 'string' &&
      safe.ownerAuth.passHash.length > 0
        ? {
            passHash: safe.ownerAuth.passHash,
            updatedAt:
              typeof safe.ownerAuth.updatedAt === 'number' ? safe.ownerAuth.updatedAt : Date.now(),
          }
        : undefined,
  };
}

export function hasStoredLocalAppData(): boolean {
  try {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return normalizeAppData(parsed);
  } catch {
    return DEFAULT_APP_DATA;
  }
}

export function recoverAppDataFromIndexedDB(): Promise<AppData | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(IDB_STORE, 'readonly');
          const getReq = tx.objectStore(IDB_STORE).get('latest');
          getReq.onsuccess = () => {
            try { db.close(); } catch { /* ignore */ }
            if (getReq.result && typeof getReq.result === 'object') {
              resolve(normalizeAppData(getReq.result as Partial<AppData>));
            } else {
              resolve(null);
            }
          };
          getReq.onerror = () => {
            try { db.close(); } catch { /* ignore */ }
            resolve(null);
          };
        } catch {
          try { db.close(); } catch { /* ignore */ }
          resolve(null);
        }
      };
    } catch {
      resolve(null);
    }
  });
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Mirror asynchronously to IndexedDB for resilience on mobile WebView
    if (typeof indexedDB !== 'undefined') {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        try {
          const tx = db.transaction(IDB_STORE, 'readwrite');
          tx.oncomplete = () => {
            try { db.close(); } catch { /* ignore */ }
          };
          tx.onerror = () => {
            try { db.close(); } catch { /* ignore */ }
          };
          tx.onabort = () => {
            try { db.close(); } catch { /* ignore */ }
          };
          tx.objectStore(IDB_STORE).put(data, 'latest');
        } catch {
          try { db.close(); } catch { /* ignore */ }
        }
      };
    }
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function loadActiveDraft(): ActiveOrderDraft {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    const parsed = JSON.parse(raw) as Partial<ActiveOrderDraft>;
    return {
      ...EMPTY_DRAFT,
      ...parsed,
      items: Array.isArray(parsed.items) ? parsed.items : [],
      customerId: parsed.customerId ?? null,
      customerName: parsed.customerName || 'Umum',
      discount: Number(parsed.discount) || 0,
      shipping: Number(parsed.shipping) || 0,
      note: parsed.note || '',
      progressStatus: parsed.progressStatus || 'antri',
    };
  } catch {
    return EMPTY_DRAFT;
  }
}

export function saveActiveDraft(draft: ActiveOrderDraft): void {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // ignore storage quota errors gracefully
  }
}

export function clearActiveDraft(): void {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('id-ID');
}

export function formatMoney(n: number, symbol = 'Rp', space = false, right = false): string {
  const num = formatNumber(Math.abs(n));
  const prefix = n < 0 ? '-' : '';
  if (!symbol) return `${prefix}${num}`;
  const sp = space ? ' ' : '';
  return right ? `${prefix}${num}${sp}${symbol}` : `${prefix}${symbol}${sp}${num}`;
}

export function formatDateShort(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} ${hh}:${mm}`;
}

export function formatTimeOnly(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDayHeader(ts: number): string {
  const d = new Date(ts);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MEI', 'JUN', 'JUL', 'AGU', 'SEP', 'OKT', 'NOV', 'DES'];
  return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDayReadable(ts: number): string {
  const d = new Date(ts);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function toDateKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function exportProductsToCsv(products: Product[]): string {
  const header = ['Nama', 'Kode Produk', 'Harga Pokok', 'Harga Jual', 'Stok', 'Satuan', 'Kategori', 'Barcode', 'Keterangan'].join(',');
  const rows = products.map((p) =>
    [p.name, p.sku, p.costPrice, p.sellPrice, p.stock, p.unit, p.category, p.barcode, p.catalogNote]
      .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '""';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      cur += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      if (cur.trim().length > 0) records.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.trim().length > 0) records.push(cur);
  return records;
}

function detectCsvDelimiter(headerLine: string): string {
  let comma = 0;
  let semi = 0;
  let tab = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes) {
      if (ch === ',') comma++;
      else if (ch === ';') semi++;
      else if (ch === '\t') tab++;
    }
  }
  if (tab > comma && tab > semi) return '\t';
  if (semi > comma) return ';';
  return ',';
}

function splitCsvRow(row: string, delimiter: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      out.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function parseFlexibleNumber(raw: string | undefined): number {
  if (!raw) return 0;
  let cleaned = raw.replace(/rp|idr|\s+/gi, '').trim();
  if (!cleaned) return 0;
  // Indonesian thousands separator pattern: e.g. 15.000 or 1.250.000
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d+(,\d{1,2})$/.test(cleaned)) {
    cleaned = cleaned.replace(',', '.');
  } else {
    cleaned = cleaned.replace(/,/g, '');
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseProductsFromCsv(csvText: string): Product[] {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = splitCsvRecords(cleanText);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = detectCsvDelimiter(firstLine);
  const firstCols = splitCsvRow(firstLine, delimiter).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, ' ')
  );

  const usedCols = new Set<number>();
  const findCol = (aliases: string[], excludes: string[] = []): number => {
    // Pass 1: exact header match (priority by alias order)
    for (const a of aliases) {
      const idx = firstCols.findIndex((h, i) => !usedCols.has(i) && h === a);
      if (idx !== -1) {
        usedCols.add(idx);
        return idx;
      }
    }
    // Pass 2: partial header match (excluding ambiguous headers like "Non Stok" or "Harga Pokok")
    for (const a of aliases) {
      const idx = firstCols.findIndex(
        (h, i) =>
          !usedCols.has(i) &&
          !excludes.some((ex) => h.includes(ex)) &&
          h.includes(a)
      );
      if (idx !== -1) {
        usedCols.add(idx);
        return idx;
      }
    }
    return -1;
  };

  const idxName = findCol(
    ['nama produk', 'nama barang', 'produk', 'nama', 'barang', 'item', 'name'],
    ['kode', 'grup', 'group', 'kategori', 'id']
  );
  const idxCost = findCol([
    'harga pokok',
    'harga beli',
    'harga modal',
    'hpp',
    'modal',
    'pokok',
    'beli',
    'cost',
  ]);
  const idxSell = findCol(
    ['harga jual', 'harga1', 'harga', 'jual', 'price', 'sell'],
    ['pokok', 'beli', 'modal', 'hpp']
  );
  const idxStock = findCol(
    ['stok', 'stock', 'qty', 'jumlah', 'sisa'],
    ['non stok', 'non-stok', 'nonstok']
  );
  const idxCat = findCol(['kategori', 'grup produk', 'grup', 'group', 'category']);
  const idxUnit = findCol(['satuan', 'unit', 'uom']);
  const idxBarcode = findCol(['barcode', 'ean', 'upc']);
  const idxSku = findCol(['kode produk', 'kode barang', 'sku', 'kode', 'code']);
  const idxNote = findCol(['keterangan', 'catatan', 'deskripsi', 'note', 'desc']);

  const hasHeader = idxName !== -1 || idxSell !== -1 || idxCost !== -1 || idxStock !== -1;
  const startRow = hasHeader ? 1 : 0;

  const getVal = (cols: string[], headerIdx: number, fallbackIdx: number): string => {
    const colIndex = hasHeader ? headerIdx : fallbackIdx;
    return colIndex >= 0 && colIndex < cols.length ? (cols[colIndex] || '').trim() : '';
  };

  const out: Product[] = [];
  const baseTs = Date.now();
  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i], delimiter);
    const name = getVal(cols, idxName, 0);
    if (!name) continue;
    const sku = getVal(cols, idxSku, 1);
    const costPrice = parseFlexibleNumber(getVal(cols, idxCost, 2));
    const sellPrice = parseFlexibleNumber(getVal(cols, idxSell, 3));
    const stock = parseFlexibleNumber(getVal(cols, idxStock, 4));
    const unit = getVal(cols, idxUnit, 5) || 'pcs';
    const category = getVal(cols, idxCat, 6) || 'Lainnya';
    const barcode = getVal(cols, idxBarcode, 7);
    const catalogNote = getVal(cols, idxNote, 8);

    out.push({
      id: `p-csv-${baseTs}-${i}`,
      name,
      sku,
      costPrice,
      sellPrice,
      priceEditable: false,
      stock,
      unit,
      category,
      barcode,
      composition: '',
      image: '',
      catalogNote,
      createdAt: baseTs + i,
    });
  }
  return out;
}

export interface BackupSummary {
  storeName: string;
  exportedAt: number | null;
  isWrapped: boolean;
  productsCount: number;
  transactionsCount: number;
  cashflowsCount: number;
  expensesCount: number;
  customersCount: number;
  suppliersCount: number;
  quickCartsCount: number;
  usersCount: number;
  unitsCount: number;
  categoriesCount: number;
  nextReceiptNo: number;
}

export function getBackupSummary(
  appData: AppData,
  exportedAt: number | null = null,
  isWrapped = false
): BackupSummary {
  const expensesCount = appData.cashflows.filter((c) => c.kind !== 'in').length;
  return {
    storeName: appData.store.name || 'SimpelKasir',
    exportedAt,
    isWrapped,
    productsCount: appData.products.length,
    transactionsCount: appData.transactions.length,
    cashflowsCount: appData.cashflows.length,
    expensesCount,
    customersCount: appData.customers.length,
    suppliersCount: appData.master.suppliers.length,
    quickCartsCount: appData.quickCarts.length,
    usersCount: appData.users.length,
    unitsCount: appData.master.units.length,
    categoriesCount: appData.master.categories.length,
    nextReceiptNo: appData.nextReceiptNo,
  };
}

export function createFullBackupJson(data: AppData): string {
  return JSON.stringify(
    {
      app: 'SimpelKasir',
      format: 'simpelkasir-full-backup',
      version: 2,
      exportedAt: Date.now(),
      data,
    },
    null,
    2
  );
}

export function parseFullBackupJson(rawText: string): {
  appData: AppData;
  summary: BackupSummary;
} | null {
  try {
    const clean = rawText.replace(/^\uFEFF/, '').trim();
    if (!clean.startsWith('{')) return null;
    const raw = JSON.parse(clean) as Record<string, unknown>;
    if (!raw || typeof raw !== 'object') return null;

    if (
      raw.format === 'simpelkasir-full-backup' &&
      raw.data &&
      typeof raw.data === 'object'
    ) {
      const candidate = raw.data as Partial<AppData>;
      if (!candidate.store || (!Array.isArray(candidate.products) && !Array.isArray(candidate.transactions))) {
        return null;
      }
      const appData = normalizeAppData(candidate);
      const exportedAt = typeof raw.exportedAt === 'number' ? raw.exportedAt : null;
      return {
        appData,
        summary: getBackupSummary(appData, exportedAt, true),
      };
    }

    // Legacy raw AppData JSON support
    if (
      !raw.format &&
      raw.store &&
      typeof raw.store === 'object' &&
      (Array.isArray(raw.products) || Array.isArray(raw.transactions))
    ) {
      const appData = normalizeAppData(raw as Partial<AppData>);
      return {
        appData,
        summary: getBackupSummary(appData, null, false),
      };
    }

    return null;
  } catch {
    return null;
  }
}

export function exportCustomersToCsv(customers: Customer[]): string {
  const header = ['Nama', 'No HP', 'Alamat', 'Catatan'].join(',');
  const rows = customers.map((c) =>
    [c.name, c.phone, c.address, c.note]
      .map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`)
      .join(',')
  );
  return [header, ...rows].join('\n');
}

export function parseCustomersFromCsv(csvText: string): Customer[] {
  const cleanText = csvText.replace(/^\uFEFF/, '');
  const lines = splitCsvRecords(cleanText);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const delimiter = detectCsvDelimiter(firstLine);
  const firstCols = splitCsvRow(firstLine, delimiter).map((h) =>
    h.toLowerCase().trim().replace(/\s+/g, ' ')
  );

  const usedCols = new Set<number>();
  const findCol = (aliases: string[]): number => {
    for (const a of aliases) {
      const idx = firstCols.findIndex((h, i) => !usedCols.has(i) && h === a);
      if (idx !== -1) {
        usedCols.add(idx);
        return idx;
      }
    }
    for (const a of aliases) {
      const idx = firstCols.findIndex((h, i) => !usedCols.has(i) && h.includes(a));
      if (idx !== -1) {
        usedCols.add(idx);
        return idx;
      }
    }
    return -1;
  };

  const idxName = findCol(['nama pelanggan', 'pelanggan', 'nama', 'customer', 'name']);
  const idxPhone = findCol(['no hp', 'no. hp', 'hp', 'telepon', 'telp', 'whatsapp', 'wa', 'phone']);
  const idxAddress = findCol(['alamat', 'address', 'lokasi']);
  const idxNote = findCol(['catatan', 'keterangan', 'note', 'desc']);

  const hasHeader = idxName !== -1 || idxPhone !== -1 || idxAddress !== -1 || idxNote !== -1;
  const startRow = hasHeader ? 1 : 0;

  const getVal = (cols: string[], headerIdx: number, fallbackIdx: number): string => {
    const colIndex = hasHeader ? headerIdx : fallbackIdx;
    return colIndex >= 0 && colIndex < cols.length ? (cols[colIndex] || '').trim() : '';
  };

  const out: Customer[] = [];
  const baseTs = Date.now();
  for (let i = startRow; i < lines.length; i++) {
    const cols = splitCsvRow(lines[i], delimiter);
    const name = getVal(cols, idxName, 0);
    if (!name) continue;
    out.push({
      id: `cust-imp-${baseTs}-${i}`,
      name,
      phone: getVal(cols, idxPhone, 1),
      address: getVal(cols, idxAddress, 2),
      note: getVal(cols, idxNote, 3),
    });
  }
  return out;
}

export function mergeCustomersList(
  existing: Customer[],
  incoming: Customer[]
): { merged: Customer[]; added: number; updated: number } {
  const result = existing.map((c) => ({ ...c }));
  let added = 0;
  let updated = 0;

  for (const inc of incoming) {
    const normName = (inc.name || '').trim().toLowerCase();
    if (!normName) continue;
    const normPhone = (inc.phone || '').replace(/\D+/g, '');
    const matchIdx = result.findIndex(
      (c) =>
        c.id === inc.id ||
        (c.name.trim().toLowerCase() === normName &&
          (!normPhone || !c.phone || c.phone.replace(/\D+/g, '') === normPhone))
    );
    if (matchIdx >= 0) {
      const cur = result[matchIdx];
      result[matchIdx] = {
        ...cur,
        name: inc.name.trim(),
        phone: inc.phone?.trim() || cur.phone,
        address: inc.address?.trim() || cur.address,
        note: inc.note?.trim() || cur.note,
      };
      updated++;
    } else {
      result.push({
        id: inc.id || `cust-${Date.now()}-${added}`,
        name: inc.name.trim(),
        phone: (inc.phone || '').trim(),
        address: (inc.address || '').trim(),
        note: (inc.note || '').trim(),
      });
      added++;
    }
  }
  return { merged: result, added, updated };
}

export type PersonalSyncKind =
  | 'customers'
  | 'quick_carts'
  | 'transactions_cashflow'
  | 'master_settings';

export type SyncPayloadEnvelope =
  | {
      kind: 'full_backup';
      appData: AppData;
      summary: BackupSummary;
    }
  | {
      kind: 'customers';
      storeName: string;
      exportedAt: number | null;
      customers: Customer[];
    }
  | {
      kind: 'quick_carts';
      storeName: string;
      exportedAt: number | null;
      quickCarts: SavedQuickCart[];
    }
  | {
      kind: 'transactions_cashflow';
      storeName: string;
      exportedAt: number | null;
      transactions: Transaction[];
      cashflows: CashflowEntry[];
      nextReceiptNo: number;
    }
  | {
      kind: 'master_settings';
      storeName: string;
      exportedAt: number | null;
      master: MasterData;
      store: StoreInfo;
      users: UserAccount[];
      businessFlags: BusinessFlags;
      productSettings: ProductSettings;
      receiptSettings: ReceiptSettings;
      currencySymbol: string;
    }
  | {
      kind: 'products_csv';
      products: Product[];
    };

export function createPersonalSyncJson(kind: PersonalSyncKind, data: AppData): string {
  const exportedAt = Date.now();
  const storeName = data.store.name || 'SimpelKasir';
  if (kind === 'customers') {
    return JSON.stringify(
      {
        app: 'SimpelKasir',
        format: 'simpelkasir-sync',
        kind: 'customers',
        exportedAt,
        storeName,
        customers: data.customers,
      },
      null,
      2
    );
  }
  if (kind === 'quick_carts') {
    return JSON.stringify(
      {
        app: 'SimpelKasir',
        format: 'simpelkasir-sync',
        kind: 'quick_carts',
        exportedAt,
        storeName,
        quickCarts: data.quickCarts,
      },
      null,
      2
    );
  }
  if (kind === 'transactions_cashflow') {
    return JSON.stringify(
      {
        app: 'SimpelKasir',
        format: 'simpelkasir-sync',
        kind: 'transactions_cashflow',
        exportedAt,
        storeName,
        transactions: data.transactions,
        cashflows: data.cashflows,
        nextReceiptNo: data.nextReceiptNo,
      },
      null,
      2
    );
  }
  return JSON.stringify(
    {
      app: 'SimpelKasir',
      format: 'simpelkasir-sync',
      kind: 'master_settings',
      exportedAt,
      storeName,
      master: data.master,
      store: data.store,
      users: data.users,
      businessFlags: data.businessFlags,
      productSettings: data.productSettings,
      receiptSettings: data.receiptSettings,
      currencySymbol: data.currencySymbol,
    },
    null,
    2
  );
}

export function parseIncomingSyncPayload(
  rawText: string,
  hintDataType?: string
): SyncPayloadEnvelope | null {
  const trimmed = rawText.replace(/^\uFEFF/, '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{')) {
    const full = parseFullBackupJson(trimmed);
    if (full) {
      return {
        kind: 'full_backup',
        appData: full.appData,
        summary: full.summary,
      };
    }

    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (obj && obj.format === 'simpelkasir-sync') {
        const exportedAt = typeof obj.exportedAt === 'number' ? obj.exportedAt : null;
        const storeName = typeof obj.storeName === 'string' && obj.storeName ? obj.storeName : 'SimpelKasir';
        if (obj.kind === 'customers' && Array.isArray(obj.customers)) {
          return {
            kind: 'customers',
            storeName,
            exportedAt,
            customers: obj.customers as Customer[],
          };
        }
        if (obj.kind === 'quick_carts' && Array.isArray(obj.quickCarts)) {
          return {
            kind: 'quick_carts',
            storeName,
            exportedAt,
            quickCarts: obj.quickCarts as SavedQuickCart[],
          };
        }
        if (obj.kind === 'transactions_cashflow' && Array.isArray(obj.transactions)) {
          return {
            kind: 'transactions_cashflow',
            storeName,
            exportedAt,
            transactions: obj.transactions as Transaction[],
            cashflows: Array.isArray(obj.cashflows) ? (obj.cashflows as CashflowEntry[]) : [],
            nextReceiptNo: typeof obj.nextReceiptNo === 'number' ? obj.nextReceiptNo : 1,
          };
        }
        if (obj.kind === 'master_settings' && obj.master && typeof obj.master === 'object') {
          return {
            kind: 'master_settings',
            storeName,
            exportedAt,
            master: obj.master as MasterData,
            store: (obj.store as StoreInfo) || DEFAULT_APP_DATA.store,
            users: Array.isArray(obj.users) ? (obj.users as UserAccount[]) : DEFAULT_APP_DATA.users,
            businessFlags: (obj.businessFlags as BusinessFlags) || DEFAULT_APP_DATA.businessFlags,
            productSettings: (obj.productSettings as ProductSettings) || DEFAULT_APP_DATA.productSettings,
            receiptSettings: (obj.receiptSettings as ReceiptSettings) || DEFAULT_APP_DATA.receiptSettings,
            currencySymbol: typeof obj.currencySymbol === 'string' ? obj.currencySymbol : 'Rp',
          };
        }
      }
    } catch {
      return null;
    }
    return null;
  }

  // CSV payload (either customers CSV or products CSV)
  if (hintDataType === 'customers_csv') {
    const customers = parseCustomersFromCsv(trimmed);
    if (customers.length > 0) {
      return {
        kind: 'customers',
        storeName: 'File CSV',
        exportedAt: null,
        customers,
      };
    }
  }

  const firstLine = (splitCsvRecords(trimmed)[0] || '').toLowerCase();
  const looksLikeCustomerCsv =
    (firstLine.includes('pelanggan') || firstLine.includes('no hp') || firstLine.includes('alamat')) &&
    !firstLine.includes('harga jual') &&
    !firstLine.includes('harga pokok') &&
    !firstLine.includes('stok');
  if (looksLikeCustomerCsv) {
    const customers = parseCustomersFromCsv(trimmed);
    if (customers.length > 0) {
      return {
        kind: 'customers',
        storeName: 'File CSV',
        exportedAt: null,
        customers,
      };
    }
  }

  const products = parseProductsFromCsv(trimmed);
  if (products.length > 0) {
    return {
      kind: 'products_csv',
      products,
    };
  }

  return null;
}

export function hashOwnerPasscode(raw: string): string {
  const input = `SimpelKasir_Owner_v1::${raw.trim()}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193);
    h2 ^= ch + (i << 3);
    h2 = Math.imul(h2, 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}
