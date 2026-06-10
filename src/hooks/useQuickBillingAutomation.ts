/**
 * useQuickBillingAutomation
 * Centralises all "Start New Billing" automation:
 *   - FEFO auto-batch selection (skip modal when only one valid batch)
 *   - Barcode / keyboard-wedge scanner listener
 *   - Mobile → customer auto-lookup
 *   - Auto-draft save to localStorage every 30 s
 *   - Recent products tracker (last 10, persisted in localStorage)
 *   - Inline low-stock guard
 *   - Smart cash-change calculator
 *   - Row focus advancement after qty entry
 */
import { useEffect, useRef, useCallback, useState } from 'react';
import { apiClient } from '../services/apiClient';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BillingItem {
  name: string;
  quantity: string;
  rate: string;
  amount: number;
  product_id?: string;
  batch_id?: string;
  batchNumber?: string;
  expiryDate?: string;
  mrp?: number;
  gstPercent?: number;
  discPercent?: string;
  stockAvailable?: number;
  purchaseRate?: number;
  hsn?: string;
}

export interface AutomationConfig {
  autoFefo: boolean;           // auto-pick first valid batch (skip modal)
  autoAdvanceFocus: boolean;   // jump to next row after qty confirmed
  autoDraftSave: boolean;      // persist draft every 30 s
  autoBarcodeListener: boolean;
  mobileCustomerLookup: boolean;
}

const DEFAULTS: AutomationConfig = {
  autoFefo: true,
  autoAdvanceFocus: true,
  autoDraftSave: true,
  autoBarcodeListener: true,
  mobileCustomerLookup: true,
};

const DRAFT_KEY = 'pos_draft_bill';
const RECENT_KEY = 'pos_recent_products';
const MAX_RECENT = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bestBatch(batches: any[]): any | null {
  if (!batches || batches.length === 0) return null;
  const now = new Date();
  const valid = batches
    .filter(b => {
      if (!b.expiry_date) return true;
      const exp = new Date(b.expiry_date);
      return exp >= new Date(now.getFullYear(), now.getMonth(), 1);
    })
    .filter(b => Number(b.stock ?? b.available_qty ?? b.quantity ?? 0) > 0)
    .sort((a, b) => new Date(a.expiry_date || '9999').getTime() - new Date(b.expiry_date || '9999').getTime());
  return valid[0] ?? null;
}

function loadDraft(): Partial<{ items: BillingItem[]; partyName: string; invoiceNo: string }> {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY) ?? '{}'); } catch { return {}; }
}

function saveDraft(data: object) {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...data, _ts: Date.now() })); } catch {}
}

function clearDraft() {
  try { localStorage.removeItem(DRAFT_KEY); } catch {}
}

function loadRecentProducts(): any[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function pushRecentProduct(product: any) {
  try {
    const list = loadRecentProducts().filter(p => p.id !== product.id);
    list.unshift({ id: product.id, name: product.name, mrp: product.mrp, gst: product.gst });
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {}
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuickBillingAutomation(
  options: Partial<AutomationConfig> = {}
) {
  const cfg = { ...DEFAULTS, ...options };

  // ── Recent products ─────────────────────────────────────────────────────────
  const [recentProducts, setRecentProducts] = useState<any[]>(() => loadRecentProducts());

  const trackProduct = useCallback((product: any) => {
    pushRecentProduct(product);
    setRecentProducts(loadRecentProducts());
  }, []);

  // ── FEFO auto-batch ──────────────────────────────────────────────────────────
  /**
   * Given a product with `.batches[]`, returns the best batch if autoFefo is on,
   * null when the caller should show the batch-selection modal.
   */
  const pickBatch = useCallback((product: any): any | null => {
    if (!cfg.autoFefo) return null;
    const batch = bestBatch(product.batches ?? []);
    if (!batch) return null;
    trackProduct(product);
    return batch;
  }, [cfg.autoFefo, trackProduct]);

  // ── Low-stock guard ──────────────────────────────────────────────────────────
  const checkStock = useCallback((item: BillingItem): string | null => {
    const qty = parseFloat(item.quantity) || 0;
    const stock = Number(item.stockAvailable ?? 0);
    if (qty > stock) return `Only ${stock} units available`;
    if (stock <= 5) return `Low stock: ${stock} left`;
    return null;
  }, []);

  // ── Row-focus advancement ────────────────────────────────────────────────────
  const rowRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const registerQtyRef = useCallback((index: number, el: HTMLInputElement | null) => {
    if (el) rowRefs.current.set(index, el);
    else rowRefs.current.delete(index);
  }, []);

  const advanceToNextRow = useCallback((currentIndex: number) => {
    if (!cfg.autoAdvanceFocus) return;
    // Focus the name field of the next (empty) row
    const nextRef = rowRefs.current.get(currentIndex + 1);
    if (nextRef) setTimeout(() => nextRef.focus(), 50);
  }, [cfg.autoAdvanceFocus]);

  // ── Auto-draft save ──────────────────────────────────────────────────────────
  const draftTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const draftDataRef = useRef<object>({});

  const updateDraftData = useCallback((data: object) => {
    draftDataRef.current = data;
  }, []);

  useEffect(() => {
    if (!cfg.autoDraftSave) return;
    draftTimerRef.current = setInterval(() => {
      saveDraft(draftDataRef.current);
    }, 30_000);
    return () => {
      if (draftTimerRef.current) clearInterval(draftTimerRef.current);
    };
  }, [cfg.autoDraftSave]);

  // ── Mobile → customer auto-lookup ───────────────────────────────────────────
  const [customerLookupLoading, setCustomerLookupLoading] = useState(false);
  const [customerSuggestion, setCustomerSuggestion] = useState<any>(null);
  const mobileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onMobileChange = useCallback((mobile: string, onFound: (party: any) => void) => {
    if (!cfg.mobileCustomerLookup) return;
    if (mobileTimerRef.current) clearTimeout(mobileTimerRef.current);
    if (mobile.length < 10) { setCustomerSuggestion(null); return; }
    mobileTimerRef.current = setTimeout(async () => {
      try {
        setCustomerLookupLoading(true);
        const res = await apiClient.get(`/api/pos/parties?search=${mobile}&limit=1`);
        const list: any[] = Array.isArray(res) ? res : (res?.data ?? res?.parties ?? []);
        if (list.length > 0 && list[0].mobile === mobile) {
          setCustomerSuggestion(list[0]);
          onFound(list[0]);
        } else {
          setCustomerSuggestion(null);
        }
      } catch { setCustomerSuggestion(null); }
      finally { setCustomerLookupLoading(false); }
    }, 600);
  }, [cfg.mobileCustomerLookup]);

  // ── Barcode / keyboard-wedge scanner ────────────────────────────────────────
  /**
   * Scanners inject characters rapidly followed by Enter/Tab.
   * We collect characters outside focusable inputs and trigger onScan.
   */
  const barcodeBufferRef = useRef('');
  const barcodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onScanCallback = useRef<((code: string) => void) | null>(null);
  const registerScanHandler = useCallback((fn: (code: string) => void) => {
    onScanCallback.current = fn;
  }, []);

  useEffect(() => {
    if (!cfg.autoBarcodeListener) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      // Only intercept when the user isn't typing in a normal input
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Enter' || e.key === 'Tab') {
        const code = barcodeBufferRef.current.trim();
        if (code.length >= 4 && onScanCallback.current) {
          onScanCallback.current(code);
        }
        barcodeBufferRef.current = '';
        return;
      }
      if (e.key.length === 1) {
        barcodeBufferRef.current += e.key;
        if (barcodeTimerRef.current) clearTimeout(barcodeTimerRef.current);
        barcodeTimerRef.current = setTimeout(() => { barcodeBufferRef.current = ''; }, 300);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cfg.autoBarcodeListener]);

  // ── Smart change calculator ──────────────────────────────────────────────────
  const calcChange = useCallback((netAmount: number, tendered: number): number => {
    return Math.max(0, tendered - netAmount);
  }, []);

  // ── Expose ───────────────────────────────────────────────────────────────────
  return {
    // FEFO
    pickBatch,
    // Stock
    checkStock,
    // Focus management
    registerQtyRef,
    advanceToNextRow,
    // Draft
    updateDraftData,
    loadDraft,
    clearDraft: clearDraft,
    saveDraftNow: () => saveDraft(draftDataRef.current),
    // Recent products
    recentProducts,
    trackProduct,
    // Mobile lookup
    onMobileChange,
    customerLookupLoading,
    customerSuggestion,
    // Barcode
    registerScanHandler,
    // Payment
    calcChange,
  };
}

export { loadDraft, clearDraft, loadRecentProducts };
