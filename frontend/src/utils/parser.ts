export interface UPIInfo {
  payeeAddress: string;
  payeeName: string;
  amount?: string;
  currency?: string;
  note?: string;
  merchantCode?: string;
}

export interface WiFiInfo {
  ssid: string;
  security: string;
  password?: string;
  hidden: boolean;
}

export interface InventoryInfo {
  productNo: string;
  sku: string;
  items: string;
  quantity: string;
}

export interface TransactionInfo {
  productName: string;
  sku: string;
  barcode: string;
  warehouseId: number;
  quantity: number; // Final stock quantity after adjustment
  action: 'IN' | 'OUT';
  message: string;
  scannedQuantity: number;
  warehouseName?: string;
  error?: string;
  isError?: boolean;
}

export type ScanType = 'upi' | 'barcode' | 'wifi' | 'url' | 'text' | 'inventory' | 'transaction';

export interface ParsedScanResult {
  type: ScanType;
  rawValue: string;
  upi?: UPIInfo;
  wifi?: WiFiInfo;
  inventory?: InventoryInfo;
  productBarcode?: string;
  transaction?: TransactionInfo;
}

// Synthesize a sharp, satisfying electronic scanning "beep" sound using Web Audio API
export function playSuccessBeep() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gainNode = context.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(context.destination);
    
    // Satisfying beep frequency profile
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(1200, context.currentTime); // High pitch beep
    
    // Quick gain ramp down to make it a sharp clean sound
    gainNode.gain.setValueAtTime(0.08, context.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.08);
    
    oscillator.start(context.currentTime);
    oscillator.stop(context.currentTime + 0.08);
  } catch (e) {
    console.warn('Web Audio API not supported or user gesture required.', e);
  }
}

// Trigger browser vibration if supported
export function triggerHapticFeedback() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(60); // 60ms quick tactile vibration
  }
}

// Parse UPI URLs: upi://pay?pa=merchant@okaxis&pn=Merchant%20Name&am=10.00&cu=INR
export function parseUPILink(url: string): UPIInfo | null {
  if (!url.toLowerCase().startsWith('upi://pay')) return null;
  
  try {
    const paramsString = url.split('?')[1];
    if (!paramsString) return null;
    
    const searchParams = new URLSearchParams(paramsString);
    const payeeAddress = searchParams.get('pa') || '';
    const payeeName = decodeURIComponent(searchParams.get('pn') || '');
    const amount = searchParams.get('am') || undefined;
    const currency = searchParams.get('cu') || 'INR';
    const note = decodeURIComponent(searchParams.get('tn') || '');
    const merchantCode = searchParams.get('mc') || undefined;
    
    if (!payeeAddress) return null;
    
    return {
      payeeAddress,
      payeeName,
      amount,
      currency,
      note,
      merchantCode
    };
  } catch (e) {
    console.error('Failed to parse UPI link', e);
    return null;
  }
}

// Parse Wi-Fi QRs: WIFI:S:SSID;T:WPA;P:PASSWORD;;
export function parseWiFiQR(text: string): WiFiInfo | null {
  if (!text.toUpperCase().startsWith('WIFI:')) return null;
  
  try {
    const ssidMatch = text.match(/S:([^;]+)/i);
    const securityMatch = text.match(/T:([^;]+)/i);
    const passwordMatch = text.match(/P:([^;]+)/i);
    const hiddenMatch = text.match(/H:(true|false|1|0)/i);
    
    if (!ssidMatch) return null;
    
    return {
      ssid: ssidMatch[1],
      security: securityMatch ? securityMatch[1] : 'nopass',
      password: passwordMatch ? passwordMatch[1] : undefined,
      hidden: hiddenMatch ? (hiddenMatch[1] === 'true' || hiddenMatch[1] === '1') : false
    };
  } catch (e) {
    console.error('Failed to parse WiFi QR', e);
    return null;
  }
}

// Parse Inventory structured QR codes: INVENTORY:num=P102;sku=SKU-309;items=200;qty=15;
export function parseInventoryQR(text: string): InventoryInfo | null {
  if (!text.toUpperCase().startsWith('INVENTORY:')) return null;
  
  try {
    const numMatch = text.match(/num=([^;]*)/i);
    const skuMatch = text.match(/sku=([^;]*)/i);
    const itemsMatch = text.match(/items=([^;]*)/i);
    const qtyMatch = text.match(/qty=([^;]*)/i);
    
    return {
      productNo: numMatch ? decodeURIComponent(numMatch[1]) : '',
      sku: skuMatch ? decodeURIComponent(skuMatch[1]) : '',
      items: itemsMatch ? decodeURIComponent(itemsMatch[1]) : '',
      quantity: qtyMatch ? decodeURIComponent(qtyMatch[1]) : ''
    };
  } catch (e) {
    console.error('Failed to parse inventory QR', e);
    return null;
  }
}

// Parse general content and categorize it
export function parseScanResult(value: string): ParsedScanResult {
  const trimmed = value.trim();
  
  // 1. Inventory tag check
  const inventory = parseInventoryQR(trimmed);
  if (inventory) {
    return { type: 'inventory', rawValue: trimmed, inventory };
  }
  
  // 2. UPI Payment Link
  const upi = parseUPILink(trimmed);
  if (upi) {
    return { type: 'upi', rawValue: trimmed, upi };
  }
  
  // 3. Wi-Fi QR
  const wifi = parseWiFiQR(trimmed);
  if (wifi) {
    return { type: 'wifi', rawValue: trimmed, wifi };
  }
  
  // 4. URLs
  const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
  // Or check if starts with http:// or https://
  if (trimmed.toLowerCase().startsWith('http://') || trimmed.toLowerCase().startsWith('https://') || urlPattern.test(trimmed)) {
    return { type: 'url', rawValue: trimmed };
  }
  
  // 5. Numeric Barcodes (EAN-13, EAN-8, UPC, Code-128, etc. - typically purely numeric digit strings of length 8 to 14)
  const isNumericOnly = /^\d+$/.test(trimmed);
  if (isNumericOnly && (trimmed.length >= 8 && trimmed.length <= 16)) {
    return { type: 'barcode', rawValue: trimmed, productBarcode: trimmed };
  }
  
  // 6. Default to plain text
  return { type: 'text', rawValue: trimmed };
}
