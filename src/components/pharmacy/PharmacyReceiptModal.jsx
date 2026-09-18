import React, { useRef, useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, X, Pill, ShieldCheck, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';

export default function PharmacyReceiptModal({ isOpen, onClose, sale }) {
  const printRef = useRef(null);
  const { pharmacy } = usePharmacyBranding();

  // Paper format state: '58mm' | '80mm' | 'a4'
  const [paperFormat, setPaperFormat] = useState('80mm');

  // Initialize paper format preference
  useEffect(() => {
    const saved = localStorage.getItem('ethiocare_receipt_format_pref');
    if (saved && ['58mm', '80mm', 'a4'].includes(saved)) {
      setPaperFormat(saved);
    } else if (pharmacy?.default_receipt_format) {
      setPaperFormat(pharmacy.default_receipt_format);
    }
  }, [pharmacy]);

  const handleFormatChange = (fmt) => {
    setPaperFormat(fmt);
    try {
      localStorage.setItem('ethiocare_receipt_format_pref', fmt);
    } catch {}
  };

  if (!sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const formattedDate = sale.createdAt
    ? format(new Date(sale.createdAt), 'dd/MM/yyyy hh:mm a')
    : format(new Date(), 'dd/MM/yyyy hh:mm a');

  // Container width styling for modal display based on format
  const modalWidthClass =
    paperFormat === '58mm'
      ? 'max-w-[320px]'
      : paperFormat === '80mm'
      ? 'max-w-[420px]'
      : 'max-w-2xl';

  // Printable CSS class
  const printableClass =
    paperFormat === '58mm'
      ? 'receipt-printable-58mm'
      : paperFormat === '80mm'
      ? 'receipt-printable-80mm'
      : 'receipt-printable-a4';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className={`${modalWidthClass} p-0 overflow-hidden bg-background border-border/80 shadow-2xl transition-all duration-200`}>
        {/* Top Paper Format Selector Bar (Hidden on Print) */}
        <div className="bg-muted/40 border-b border-border/60 px-4 py-2.5 flex items-center justify-between print:hidden">
          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Printer className="w-3.5 h-3.5 text-primary" /> Format:
          </span>
          <div className="flex items-center gap-1 bg-background/80 p-0.5 rounded-lg border border-border/60">
            {[
              { id: '58mm', label: '58mm' },
              { id: '80mm', label: '80mm' },
              { id: 'a4', label: 'A4' }
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => handleFormatChange(f.id)}
                className={`px-2.5 py-1 text-xs font-semibold rounded transition-all ${
                  paperFormat === f.id
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Printable Area */}
        <div className="max-h-[75vh] overflow-y-auto p-4 sm:p-6 print:p-0 print:m-0 print:max-h-none print:overflow-visible">
          <div
            ref={printRef}
            className={`${printableClass} mx-auto text-foreground font-mono text-xs leading-normal bg-card p-4 rounded-xl border border-border/60 print:border-none print:p-0 print:bg-transparent print:text-black shadow-xs`}
          >
            {/* Header: Pharmacy Branding */}
            <div className="text-center border-b border-dashed border-border pb-3 mb-3 print:border-black">
              {pharmacy?.pharmacy_logo ? (
                <img
                  src={pharmacy.pharmacy_logo}
                  alt={pharmacy.pharmacy_name}
                  className="w-10 h-10 object-contain mx-auto mb-1.5 print:invert-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-md bg-emerald-600/10 border border-emerald-500/20 text-emerald-600 flex items-center justify-center mx-auto mb-1.5 print:hidden">
                  <Pill className="w-4 h-4" />
                </div>
              )}
              <h2 className="font-extrabold text-sm sm:text-base tracking-tight uppercase leading-tight text-foreground print:text-black">
                {pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy'}
              </h2>
              <p className="text-[11px] text-muted-foreground print:text-black mt-0.5">
                {pharmacy?.address ? `${pharmacy.address}, ` : ''}{pharmacy?.city || 'Addis Ababa'}
              </p>
              <p className="text-[10px] text-muted-foreground print:text-black">
                Tel: {pharmacy?.phone || '+251 11 612 3457'}
                {pharmacy?.alt_phone ? ` · ${pharmacy.alt_phone}` : ''}
              </p>
              {(pharmacy?.license_number || pharmacy?.tin_number) && (
                <p className="text-[9px] text-muted-foreground print:text-black mt-0.5">
                  {pharmacy?.license_number ? `Lic: ${pharmacy.license_number}` : ''}
                  {pharmacy?.license_number && pharmacy?.tin_number ? ' | ' : ''}
                  {pharmacy?.tin_number ? `TIN: ${pharmacy.tin_number}` : ''}
                </p>
              )}
              <div className="mt-2 inline-block px-2 py-0.5 rounded bg-muted/60 text-[10px] font-bold tracking-wider uppercase border border-border/60 print:border-black print:text-black">
                Official Retail Cash Receipt
              </div>
            </div>

            {/* Transaction Metadata */}
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] pb-3 mb-3 border-b border-dashed border-border print:border-black print:text-black">
              <div>
                <span className="text-muted-foreground print:text-black">RCPT NO: </span>
                <span className="font-bold text-foreground print:text-black">
                  {sale.receiptNumber || `RCP-${sale.id?.slice(0, 8).toUpperCase()}`}
                </span>
              </div>
              <div className="text-right">
                <span className="text-muted-foreground print:text-black">DATE: </span>
                <span className="font-medium">{formattedDate}</span>
              </div>
              <div>
                <span className="text-muted-foreground print:text-black">CUSTOMER: </span>
                <span className="font-semibold text-foreground print:text-black">
                  {sale.customerName || 'Walk-In Customer'}
                </span>
                {sale.customerPhone && (
                  <span className="text-[10px] text-muted-foreground print:text-black block">
                    {sale.customerPhone}
                  </span>
                )}
              </div>
              <div className="text-right">
                <span className="text-muted-foreground print:text-black">CASHIER: </span>
                <span className="font-medium">{sale.cashierName || 'Staff'}</span>
              </div>
              {sale.prescriptionNumber && (
                <div className="col-span-2 pt-0.5">
                  <span className="text-muted-foreground print:text-black">RX REF: </span>
                  <span className="font-bold text-primary print:text-black">{sale.prescriptionNumber}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="mb-3">
              <table className="w-full text-[11px] border-collapse">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-left print:border-black print:text-black font-bold">
                    <th className="pb-1 text-left">ITEM</th>
                    <th className="pb-1 text-center w-10">QTY</th>
                    <th className="pb-1 text-right w-14">PRICE</th>
                    <th className="pb-1 text-right w-16">TOTAL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 print:divide-black/30">
                  {sale.items?.map((item, idx) => (
                    <tr key={idx} className="py-1">
                      <td className="py-1 pr-1 break-words">
                        <p className="font-bold text-foreground print:text-black leading-tight">
                          {item.name}
                        </p>
                        {item.dosageInstructions && (
                          <p className="text-[9px] text-primary/90 print:text-black font-sans italic">
                            Dir: {item.dosageInstructions}
                          </p>
                        )}
                        {(item.batchNumber || item.expiryDate) && (
                          <p className="text-[9px] text-muted-foreground print:text-black font-sans">
                            {item.batchNumber ? `B: ${item.batchNumber}` : ''}
                            {item.batchNumber && item.expiryDate ? ' · ' : ''}
                            {item.expiryDate ? `Exp: ${item.expiryDate}` : ''}
                          </p>
                        )}
                      </td>
                      <td className="py-1 text-center font-semibold align-top">{item.quantity}</td>
                      <td className="py-1 text-right font-medium align-top">
                        {Number(item.unitPrice || 0).toFixed(2)}
                      </td>
                      <td className="py-1 text-right font-bold align-top">
                        {Number(item.subtotal || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="border-t border-dashed border-border pt-2 space-y-1 text-[11px] mb-3 print:border-black print:text-black">
              <div className="flex justify-between text-muted-foreground print:text-black">
                <span>SUBTOTAL:</span>
                <span className="font-medium text-foreground print:text-black">
                  {Number(sale.subtotal || 0).toFixed(2)} ETB
                </span>
              </div>
              {Number(sale.discount || 0) > 0 && (
                <div className="flex justify-between text-emerald-600 print:text-black">
                  <span>DISCOUNT:</span>
                  <span>-{Number(sale.discount).toFixed(2)} ETB</span>
                </div>
              )}
              {Number(sale.tax || 0) > 0 && (
                <div className="flex justify-between text-muted-foreground print:text-black">
                  <span>TAX / VAT:</span>
                  <span>+{Number(sale.tax).toFixed(2)} ETB</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-border text-foreground print:border-black print:text-black">
                <span>GRAND TOTAL:</span>
                <span className="text-primary print:text-black">
                  {Number(sale.total || 0).toFixed(2)} ETB
                </span>
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground print:text-black pt-1">
                <span>METHOD:</span>
                <span className="capitalize font-bold text-foreground print:text-black">
                  {sale.paymentMethod ? sale.paymentMethod.replace(/_/g, ' ') : 'Cash'}
                </span>
              </div>
              {sale.paymentMethod === 'cash' && Number(sale.amountPaid || 0) > 0 && (
                <>
                  <div className="flex justify-between text-[11px] text-muted-foreground print:text-black">
                    <span>TENDERED:</span>
                    <span className="font-medium text-foreground print:text-black">
                      {Number(sale.amountPaid).toFixed(2)} ETB
                    </span>
                  </div>
                  <div className="flex justify-between text-[11px] font-bold text-emerald-600 print:text-black">
                    <span>CHANGE:</span>
                    <span>{Number(sale.change || 0).toFixed(2)} ETB</span>
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-2 border-t border-dashed border-border space-y-1 print:border-black print:text-black">
              <p className="text-[10px] font-medium text-foreground print:text-black italic leading-tight">
                {pharmacy?.receipt_footer || 'Thank you for choosing EthioCare Central Pharmacy. Keep medicines in a cool, dry place.'}
              </p>
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground print:text-black pt-1">
                -- CUSTOMER RECEIPT --
              </p>
            </div>
          </div>
        </div>

        {/* Modal Action Controls (Hidden on Print) */}
        <div className="flex items-center justify-between px-4 py-3 bg-muted/40 border-t border-border/60 print:hidden">
          <Button variant="outline" size="sm" onClick={onClose}>
            <X className="w-4 h-4 mr-1.5" /> Close
          </Button>
          <Button size="sm" onClick={handlePrint} className="gradient-primary text-primary-foreground shadow-soft">
            <Printer className="w-4 h-4 mr-1.5" /> Print {paperFormat.toUpperCase()} Receipt
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
