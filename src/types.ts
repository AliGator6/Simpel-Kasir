export type ScreenId =
  | 'home'
  | 'pos'
  | 'cart'
  | 'payment'
  | 'receipt'
  | 'transactions'
  | 'quick_tx'
  | 'products'
  | 'product_form'
  | 'customers'
  | 'master'
  | 'cashflow'
  | 'expenses'
  | 'catalog'
  | 'reports'
  | 'settings'
  | 'settings_business'
  | 'settings_product'
  | 'settings_receipt'
  | 'settings_printer'
  | 'settings_users'
  | 'settings_store'
  | 'settings_backup';

export type PaymentStatus = 'lunas' | 'kurang' | 'belum_dibayar';
export type ProgressStatus = 'antri' | 'proses' | 'selesai' | 'diambil';

export interface StoreInfo {
  name: string;
  address: string;
  city: string;
  phone: string;
  footer: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  priceEditable: boolean;
  barcode: string;
  stock: number;
  unit: string;
  category: string;
  composition: string;
  image: string;
  catalogNote: string;
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
}

export interface CartItem {
  productId: string;
  name: string;
  costPrice: number;
  unitPrice: number;
  qty: number;
  discount: number;
  note: string;
  unit: string;
}

export interface ActiveOrderDraft {
  items: CartItem[];
  customerId: string | null;
  customerName: string;
  discount: number;
  shipping: number;
  note: string;
  progressStatus: ProgressStatus;
}

export interface SavedQuickCart {
  id: string;
  name: string;
  customerId: string | null;
  customerName: string;
  items: CartItem[];
  discount: number;
  note: string;
  shipping: number;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  receiptNo: number;
  createdAt: number;
  paidAt: number | null;
  customerId: string | null;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  shipping: number;
  total: number;
  totalCost: number;
  totalProfit: number;
  paidAmount: number;
  changeAmount: number;
  paymentMethod: 'tunai' | 'non_tunai';
  paymentStatus: PaymentStatus;
  progressStatus: ProgressStatus;
  note: string;
  cashierName: string;
}

export type CashflowKind = 'in' | 'out_non_profit' | 'expense_profit';

export interface CashflowEntry {
  id: string;
  createdAt: number;
  kind: CashflowKind;
  method: 'tunai' | 'non_tunai';
  amount: number;
  title: string;
  note: string;
  transactionId?: string;
}

export interface UserAccount {
  id: string;
  name: string;
  role: 'Admin' | 'Kasir';
  pin: string;
}

export interface BusinessFlags {
  useStock: boolean;
  useIngredients: boolean;
  useBarcode: boolean;
  useTax: boolean;
  taxPercent: number;
  useProgress: boolean;
  useShipping: boolean;
}

export interface ProductSettings {
  useSku: boolean;
  useBarcode: boolean;
  useFrontCamera: boolean;
  useUnit: boolean;
  useCategory: boolean;
  useStock: boolean;
  useIngredients: boolean;
  useFixedProfit: boolean;
  strictSearch: boolean;
  autoNoteAltPrice: boolean;
}

export interface ReceiptSettings {
  paperWidth: '58' | '80';
  showUnit: 'none' | 'decimal' | 'all';
  showLatePaymentTime: 'no' | 'yes';
  showTxIdMode: 'id' | 'code' | 'both' | 'none';
  simpleMode: boolean;
  showProductCount: boolean;
  showTotalItems: boolean;
  showItemIndex: boolean;
  singleLineOneItem: boolean;
  singleLineWithQty: boolean;
  shortDate: boolean;
  showCashier: boolean;
  showCustomerAddress: boolean;
  showCustomerPhone: boolean;
  showCustomerDebt: boolean;
  showPaidStatus: boolean;
  showUnpaidStatus: boolean;
  showCompletedDate: boolean;
  showPrintDate: boolean;
  showProgress: boolean;
  signatureCount: 0 | 1 | 2;
  qrBarcodeMode: 'none' | 'qr' | 'barcode';
  showCurrency: boolean;
  currencyRight: boolean;
  currencySpace: boolean;
  unitSpace: boolean;
  centerFooter: boolean;
  largeStoreName: boolean;
  largeCustomer: boolean;
  largeItemName: boolean;
  largeItemPrice: boolean;
  largeTotal: boolean;
  largePayment: boolean;
  largeChange: boolean;
  largeStatus: boolean;
  labelMode: boolean;
  noTotalMode: boolean;
}

export interface PrinterSettings {
  connectionType: 'bluetooth' | 'usb';
  paperWidth: '58' | '80';
  graphicMode: boolean;
  autoPrintAfterTx: boolean;
  printTwice: boolean;
  cashDrawer: boolean;
  cutFeedExtra: boolean;
  bottomFeedMm: number;
  lineSpacing: 'tight' | 'compact' | 'normal' | 'wide';
  language: 'standard';
  selectedPrinterName: string;
  selectedPrinterAddress: string;
}

export interface MasterData {
  units: string[];
  categories: string[];
  suppliers: { id: string; name: string; phone: string; debt: number }[];
}

export interface AppData {
  version: string;
  darkMode: boolean;
  currencySymbol: string;
  store: StoreInfo;
  businessFlags: BusinessFlags;
  productSettings: ProductSettings;
  receiptSettings: ReceiptSettings;
  printerSettings: PrinterSettings;
  master: MasterData;
  users: UserAccount[];
  activeUserId: string;
  products: Product[];
  customers: Customer[];
  quickCarts: SavedQuickCart[];
  transactions: Transaction[];
  cashflows: CashflowEntry[];
  nextReceiptNo: number;
}
