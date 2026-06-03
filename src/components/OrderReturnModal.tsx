/**
 * OrderReturnModal.tsx
 * Modal for initiating a sales return on an Invoiced order.
 * Allows per-item quantity selection, condition, reason, and restock flag.
 */
import React, { useState, useCallback } from 'react';
import { RotateCcw, Package, AlertTriangle, CheckCircle, RefreshCcw } from 'lucide-react';
import { Modal } from './UniversalLayout';
import { useAppStore } from '../store/useAppStore';
import { omsService } from '../services/omsService';
import type { OrderDetail, OrderItemDetail } from '../types';

interface ReturnItemState {
  orderItemId: string;
  productId: string;
  productName: string;
  maxQuantity: number;
  rate: number;
  batchId?: string;
  returnQuantity: number;
  condition: 'Good' | 'Damaged' | 'Expired';
  reason: string;
  restock: boolean;
}

interface OrderReturnModalProps {
  order: OrderDetail;
  onClose: () => void;
  onSuccess: () => void;
}

const OrderReturnModal: React.FC<OrderReturnModalProps> = ({ order, onClose, onSuccess }) => {
  const addNotification = useAppStore((s) => s.addNotification);

  const [returnItems, setReturnItems] = useState<ReturnItemState[]>(
    order.items.map((item: OrderItemDetail) => ({
      orderItemId: item.id,
      productId: item.product_id,
      productName: item.product_name,
      maxQuantity: item.shipped_quantity ?? item.quantity,
      rate: item.rate,
      batchId: item.batch_id ?? undefined,
      returnQuantity: 0,
      condition: 'Good' as const,
      reason: '',
      restock: true,
    }))
  );

  const [overallReason, setOverallReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const updateItem = useCallback(
    (idx: number, patch: Partial<ReturnItemState>) => {
      setReturnItems((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, ...patch } : item))
      );
    },
    []
  );

  const hasAnyItem = returnItems.some((i) => i.returnQuantity > 0);

  const handleSubmit = async () => {
    if (!hasAnyItem) {
      addNotification({ type: 'warning', message: 'Select at least one item with quantity > 0 to return' });
      return;
    }

    const itemsToReturn = returnItems
      .filter((i) => i.returnQuantity > 0)
      .map((i) => ({
        orderItemId: i.orderItemId,
        productId: i.productId,
        productName: i.productName,
        quantity: i.returnQuantity,
        rate: i.rate,
        reason: i.reason || undefined,
        condition: i.condition,
        restock: i.restock,
        batchId: i.batchId,
      }));

    setSubmitting(true);
    try {
      const res = await omsService.createReturn(order.id, {
        items: itemsToReturn,
        reason: overallReason || undefined,
      });
      addNotification({
        type: 'success',
        message: res.message || `Return ${res.data?.returnNumber ?? ''} initiated successfully`,
      });
      onSuccess();
      onClose();
    } catch (e: any) {
      addNotification({
        type: 'error',
        message: e?.data?.error || e?.message || 'Failed to initiate return',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const conditionBadgeColor = (condition: string) => {
    if (condition === 'Good') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (condition === 'Damaged') return 'text-red-600 bg-red-50 border-red-200';
    return 'text-amber-600 bg-amber-50 border-amber-200';
  };

  return (
    <Modal isOpen title="Initiate Sales Return" size="lg" onClose={onClose}>
      <div className="space-y-5">
        {/* Order info header */}
        <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-xl p-3">
          <RotateCcw size={18} className="text-indigo-500 shrink-0" />
          <div>
            <p className="text-[13px] font-bold text-slate-800">
              Return for Order{' '}
              <span className="font-mono text-indigo-600">{order.order_number}</span>
            </p>
            <p className="text-[12px] text-slate-500">
              {order.distributor_name} · {new Date(order.order_date).toLocaleDateString()}
            </p>
          </div>
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
          <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
          <p className="text-[12px] text-amber-700">
            Enter the quantity to return for each item. Only shipped quantities can be returned.
            Checking "Restock" will add items back to inventory after approval.
          </p>
        </div>

        {/* Items table */}
        <div className="overflow-hidden border border-slate-200 rounded-xl">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] font-bold border-b border-slate-200">
              <tr>
                <th className="p-3">Product</th>
                <th className="p-3 text-center">Max Qty</th>
                <th className="p-3 text-center w-24">Return Qty</th>
                <th className="p-3 text-center w-32">Condition</th>
                <th className="p-3">Reason</th>
                <th className="p-3 text-center w-20">Restock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returnItems.map((item, idx) => (
                <tr
                  key={item.orderItemId}
                  className={item.returnQuantity > 0 ? 'bg-indigo-50/30' : ''}
                >
                  {/* Product name */}
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <Package size={14} className="text-slate-400 shrink-0" />
                      <span className="text-[13px] font-medium text-slate-800 truncate max-w-[180px]">
                        {item.productName}
                      </span>
                    </div>
                    {item.batchId && (
                      <span className="text-[10px] text-slate-400 font-mono ml-5">
                        Batch: {item.batchId}
                      </span>
                    )}
                  </td>

                  {/* Max qty */}
                  <td className="p-3 text-center">
                    <span className="text-[13px] font-semibold text-slate-600">
                      {item.maxQuantity}
                    </span>
                  </td>

                  {/* Return qty input */}
                  <td className="p-3 text-center">
                    <input
                      type="number"
                      min={0}
                      max={item.maxQuantity}
                      value={item.returnQuantity}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(item.maxQuantity, parseInt(e.target.value) || 0));
                        updateItem(idx, { returnQuantity: v });
                      }}
                      className="w-20 p-1.5 border border-slate-200 rounded-lg text-[13px] text-center outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
                    />
                  </td>

                  {/* Condition */}
                  <td className="p-3 text-center">
                    <select
                      value={item.condition}
                      onChange={(e) =>
                        updateItem(idx, { condition: e.target.value as ReturnItemState['condition'] })
                      }
                      disabled={item.returnQuantity === 0}
                      className={`text-[11px] font-semibold border rounded-md px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-40 ${conditionBadgeColor(item.condition)}`}
                    >
                      <option value="Good">Good</option>
                      <option value="Damaged">Damaged</option>
                      <option value="Expired">Expired</option>
                    </select>
                  </td>

                  {/* Reason */}
                  <td className="p-3">
                    <input
                      type="text"
                      placeholder="Item reason…"
                      value={item.reason}
                      disabled={item.returnQuantity === 0}
                      onChange={(e) => updateItem(idx, { reason: e.target.value })}
                      className="w-full p-1.5 border border-slate-200 rounded-lg text-[12px] outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-40 disabled:bg-slate-50"
                    />
                  </td>

                  {/* Restock checkbox */}
                  <td className="p-3 text-center">
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={item.restock}
                        disabled={item.returnQuantity === 0 || item.condition === 'Expired'}
                        onChange={(e) => updateItem(idx, { restock: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500/30 disabled:opacity-40"
                      />
                    </div>
                    {item.condition === 'Expired' && item.returnQuantity > 0 && (
                      <p className="text-[9px] text-red-500 mt-0.5">No restock</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Overall return reason */}
        <div>
          <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
            Overall Return Reason
          </label>
          <textarea
            rows={3}
            placeholder="Describe the reason for this return (e.g., damaged goods, wrong shipment, expiry)…"
            value={overallReason}
            onChange={(e) => setOverallReason(e.target.value)}
            className="w-full p-2.5 border border-slate-200 rounded-xl text-[13px] text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
          />
        </div>

        {/* Summary */}
        {hasAnyItem && (
          <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2">
            <CheckCircle size={15} className="text-indigo-500 shrink-0" />
            <p className="text-[12px] text-indigo-700">
              <span className="font-bold">
                {returnItems.filter((i) => i.returnQuantity > 0).length} item(s)
              </span>{' '}
              selected for return ·{' '}
              <span className="font-bold">
                {returnItems
                  .filter((i) => i.returnQuantity > 0 && i.restock)
                  .length}{' '}
                item(s)
              </span>{' '}
              will be restocked
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !hasAnyItem}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? (
              <RefreshCcw size={14} className="animate-spin" />
            ) : (
              <RotateCcw size={14} />
            )}
            Submit Return
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default OrderReturnModal;
