import { ActiveOrderDraft, AppData, Product } from '../types';

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

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_APP_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      ...DEFAULT_APP_DATA,
      ...parsed,
      store: { ...DEFAULT_APP_DATA.store, ...(parsed.store || {}) },
      businessFlags: { ...DEFAULT_APP_DATA.businessFlags, ...(parsed.businessFlags || {}) },
      productSettings: { ...DEFAULT_APP_DATA.productSettings, ...(parsed.productSettings || {}) },
      receiptSettings: { ...DEFAULT_APP_DATA.receiptSettings, ...(parsed.receiptSettings || {}) },
      printerSettings: { ...DEFAULT_APP_DATA.printerSettings, ...(parsed.printerSettings || {}) },
      master: { ...DEFAULT_APP_DATA.master, ...(parsed.master || {}) },
      users: parsed.users && parsed.users.length > 0 ? parsed.users : DEFAULT_APP_DATA.users,
      products: parsed.products ?? DEFAULT_APP_DATA.products,
      customers: parsed.customers ?? DEFAULT_APP_DATA.customers,
      quickCarts: parsed.quickCarts ?? [],
      transactions: parsed.transactions ?? [],
      cashflows: parsed.cashflows ?? [],
    };
  } catch {
    return DEFAULT_APP_DATA;
  }
}

export function saveAppData(data: AppData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    if (typeof indexedDB !== 'undefined') {
      const req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(IDB_STORE)) {
          req.result.createObjectStore(IDB_STORE);
        }
      };
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(IDB_STORE, 'readwrite');
          tx.objectStore(IDB_STORE).put(data, 'latest');
        } catch {
          // ignore
        }
      };
    }
  } catch {
    // ignore
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
    // ignore
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

export function parseProductsFromCsv(csvText: string): Product[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const out: Product[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].match(/(".*?"|[^",]+)(?=\s*,|\s*$)/g)?.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"')) || lines[i].split(',');
    const name = (cols[0] || '').trim();
    if (!name) continue;
    out.push({
      id: `p-csv-${Date.now()}-${i}`,
      name,
      sku: (cols[1] || '').trim(),
      costPrice: Number(cols[2]) || 0,
      sellPrice: Number(cols[3]) || 0,
      priceEditable: false,
      stock: Number(cols[4]) || 0,
      unit: (cols[5] || 'pcs').trim(),
      category: (cols[6] || 'Lainnya').trim(),
      barcode: (cols[7] || '').trim(),
      composition: '',
      image: '',
      catalogNote: (cols[8] || '').trim(),
      createdAt: Date.now() + i,
    });
  }
  return out;
}
