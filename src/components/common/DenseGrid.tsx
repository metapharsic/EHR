import React, { useRef, useEffect } from 'react';

export interface ColumnDef<T> {
 key: keyof T | string;
 header: string;
 width?: string;
 type?: 'text' | 'number' | 'date' | 'select' | 'boolean' | 'readonly';
 options?: { label: string; value: string }[];
 align?: 'left' | 'center' | 'right';
 render?: (row: T, idx: number) => React.ReactNode;
}

interface DenseGridProps<T> {
 columns: ColumnDef<T>[];
 data: T[];
 onChange?: (rowIndex: number, columnKey: string, value: any) => void;
 onAddRow?: () => void;
 onRemoveRow?: (rowIndex: number) => void;
 autoFocusLastRow?: boolean;
}

export function DenseGrid<T extends Record<string, any>>({ 
 columns, 
 data, 
 onChange, 
 onAddRow, 
 onRemoveRow,
 autoFocusLastRow 
}: DenseGridProps<T>) {
 const tableRef = useRef<HTMLTableElement>(null);

 // Focus management across the grid using arrow keys (Excel-like navigation)
 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (!tableRef.current) return;
 const target = e.target as HTMLElement;
 if (target.tagName !== 'INPUT' && target.tagName !== 'SELECT') return;
 
 const currentTd = target.closest('td');
 const currentTr = target.closest('tr');
 if (!currentTd || !currentTr) return;

 const cellIndex = Array.from(currentTr.children).indexOf(currentTd);
 const rowIndex = Array.from(currentTr.parentElement!.children).indexOf(currentTr);

 if (e.key === 'ArrowDown' || e.key === 'Enter') {
 const nextRow = currentTr.nextElementSibling;
 if (nextRow) {
 e.preventDefault();
 (nextRow.children[cellIndex].querySelector('input, select') as HTMLElement)?.focus();
 } else if (e.key === 'Enter' && onAddRow) {
 // Add new row if we hit enter on the last row
 e.preventDefault();
 onAddRow();
 }
 } else if (e.key === 'ArrowUp') {
 const prevRow = currentTr.previousElementSibling;
 if (prevRow) {
 e.preventDefault();
 (prevRow.children[cellIndex].querySelector('input, select') as HTMLElement)?.focus();
 }
 } else if (e.key === 'ArrowRight' && (target as HTMLInputElement).selectionEnd === (target as HTMLInputElement).value?.length) {
 // only jump cell if carret is at end
 const nextCell = currentTd.nextElementSibling;
 if (nextCell) {
 (nextCell.querySelector('input, select') as HTMLElement)?.focus();
 }
 } else if (e.key === 'ArrowLeft' && (target as HTMLInputElement).selectionStart === 0) {
 // only jump cell if carret is at start
 const prevCell = currentTd.previousElementSibling;
 if (prevCell) {
 (prevCell.querySelector('input, select') as HTMLElement)?.focus();
 }
 }
 };
 
 const tableEl = tableRef.current;
 if (tableEl) {
 tableEl.addEventListener('keydown', handleKeyDown);
 return () => tableEl.removeEventListener('keydown', handleKeyDown);
 }
 }, [onAddRow]);

 const getInputClass = (align?: string) => 
 `w-full bg-transparent border-none outline-none focus:bg-yellow-50 focus:ring-1 focus:ring-blue-400 px-1 py-0.5 text-sm h-full ${align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'}`;

 return (
 <div className="border border-slate-400 overflow-auto bg-white shadow-sm flex flex-col h-full group">
 <table ref={tableRef} className="w-full border-collapse whitespace-nowrap table-fixed">
 <thead className="bg-[#E4ECEF] sticky top-0 z-10 border-b-2 border-slate-400 shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
 <tr>
 <th className="w-8 border-r border-slate-300 p-1 text-xs text-slate-600 bg-slate-200">#</th>
 {columns.map((col, i) => (
 <th key={col.key as string} style={{ width: col.width }} className={`border-r border-slate-300 p-1 text-xs font-bold text-slate-800 uppercase tracking-tighter ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
 {col.header}
 </th>
 ))}
 {onRemoveRow && <th className="w-6 border-slate-300 bg-slate-200"></th>}
 </tr>
 </thead>
 <tbody className="divide-y divide-slate-200">
 {data.map((row, rIdx) => (
 <tr key={rIdx} className="hover:bg-blue-50/30 transition-colors focus-within:bg-blue-50/50">
 <td className="border-r border-slate-300 text-center text-xs text-slate-400 bg-slate-50 w-8">{rIdx + 1}</td>
 {columns.map((col, cIdx) => (
 <td key={col.key as string} className="border-r border-slate-200 p-0 relative">
 {col.render ? (
 <div className="px-1 py-0.5 text-sm h-full flex items-center">{col.render(row, rIdx)}</div>
 ) : col.type === 'readonly' ? (
 <div className={`px-1 py-0.5 text-sm w-full bg-slate-50 text-slate-600 h-full overflow-hidden text-ellipsis ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}`}>
 {row[col.key as keyof T] as any}
 </div>
 ) : col.type === 'select' ? (
 <select 
 value={row[col.key as keyof T] as any || ''} 
 onChange={(e) => onChange?.(rIdx, col.key as string, e.target.value)}
 className={getInputClass(col.align)}
 >
 <option value=""></option>
 {col.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
 </select>
 ) : col.type === 'boolean' ? (
 <div className="flex items-center justify-center h-full w-full py-1">
 <input 
 type="checkbox" 
 checked={!!row[col.key as keyof T]} 
 onChange={(e) => onChange?.(rIdx, col.key as string, e.target.checked)}
 className="w-3.5 h-3.5 accent-slate-700"
 />
 </div>
 ) : (
 <input 
 type={col.type || 'text'}
 value={row[col.key as keyof T] as any || ''}
 onChange={(e) => {
 let val: any = e.target.value;
 if (col.type === 'number') val = val === '' ? 0 : Number(val);
 onChange?.(rIdx, col.key as string, val);
 }}
 className={getInputClass(col.align)}
 />
 )}
 </td>
 ))}
 {onRemoveRow && (
 <td className="w-6 text-center bg-slate-50 border-l border-slate-200">
 <button 
 onClick={() => onRemoveRow(rIdx)}
 tabIndex={-1}
 className="text-slate-400 hover:text-red-600 focus:outline-none w-full h-full text-xs font-bold leading-none p-1"
 >
 ×
 </button>
 </td>
 )}
 </tr>
 ))}
 {/* Dynamic Empty Auto-Add Row (Excel/Tally behavior) */}
 {onAddRow && data.length < 50 && (
 <tr className="bg-slate-50/50">
 <td className="border-r border-slate-300 text-center text-xs text-slate-400 bg-slate-100">*</td>
 <td colSpan={columns.length + (onRemoveRow ? 1 : 0)} className="p-0">
 <button 
 onClick={onAddRow}
 tabIndex={-1}
 className="w-full text-left text-xs text-slate-400 hover:text-accent hover:bg-blue-50 px-2 py-1 outline-none"
 >
 + Click here or press Enter on last row to add items...
 </button>
 </td>
 </tr>
 )}
 </tbody>
 </table>
 </div>
 );
}

