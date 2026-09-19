import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Eye } from 'lucide-react';

export default function DataTable({ 
  columns = [], 
  data = [], 
  isLoading = false, 
  onRowClick, 
  emptyMessage = "No data found",
  renderDetails,
  detailsTitle = "Record Details"
}) {
  const [selectedRecord, setSelectedRecord] = useState(null);

  // Strictly enforce max 4 visible table columns
  const hasOverflowColumns = columns.length > 4;
  const visibleColumns = hasOverflowColumns ? columns.slice(0, 3) : columns;

  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-soft">
        {/* Desktop Skeleton */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {visibleColumns.map((col, i) => (
                  <TableHead key={i} className="text-xs font-semibold uppercase tracking-wider">{col.header}</TableHead>
                ))}
                {hasOverflowColumns && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-right w-20">Details</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {visibleColumns.map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                  {hasOverflowColumns && (
                    <TableCell><Skeleton className="h-4 w-12 ml-auto" /></TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Mobile Skeleton */}
        <div className="md:hidden space-y-3 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border/60 rounded-xl p-3.5 space-y-2 bg-card">
              {visibleColumns.slice(0, 3).map((col, j) => (
                <Skeleton key={j} className="h-4 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Mobile Card View (< md) */}
      <div className="md:hidden space-y-2.5">
        {data?.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/60 p-8 text-center text-muted-foreground text-sm shadow-soft">
            {emptyMessage}
          </div>
        ) : (
          data?.map((row, i) => (
            <div
              key={row.id || i}
              className={`bg-card rounded-2xl border border-border/60 p-4 space-y-2.5 shadow-soft transition-all ${
                onRowClick ? "cursor-pointer active:scale-[0.99] active:bg-muted/40" : ""
              }`}
              onClick={() => onRowClick ? onRowClick(row) : (hasOverflowColumns ? setSelectedRecord(row) : null)}
            >
              {/* Visible primary rows (at most 4) */}
              {visibleColumns.map((col, j) => (
                <div key={j} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[11px] shrink-0 pt-0.5">
                    {col.header}:
                  </span>
                  <span className="font-medium text-right text-foreground break-words max-w-[70%]">
                    {col.cell ? col.cell(row) : row[col.accessor] ?? '-'}
                  </span>
                </div>
              ))}

              {/* Mobile View Details Trigger if overflow columns exist */}
              {hasOverflowColumns && (
                <div className="pt-2 border-t border-border/40 flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 px-3"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedRecord(row);
                    }}
                  >
                    <Eye className="w-3.5 h-3.5" />
                    View Details
                  </Button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (>= md) - Strictly <= 4 Columns */}
      <div className="hidden md:block bg-card rounded-2xl border border-border/60 overflow-hidden shadow-soft">
        <div className="w-full">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 border-b border-border/60">
                {visibleColumns.map((col, i) => (
                  <TableHead 
                    key={i} 
                    className={`text-xs font-semibold uppercase tracking-wider text-muted-foreground ${
                      col.headerClassName || (i === visibleColumns.length - 1 && !hasOverflowColumns && col.header.toLowerCase().includes('action') ? 'text-right' : '')
                    }`}
                  >
                    {col.header}
                  </TableHead>
                ))}
                {hasOverflowColumns && (
                  <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground text-right w-24">
                    Details
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length + (hasOverflowColumns ? 1 : 0)} className="text-center py-12 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data?.map((row, i) => (
                  <TableRow
                    key={row.id || i}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : "hover:bg-muted/20 transition-colors"}
                    onClick={() => onRowClick?.(row)}
                  >
                    {visibleColumns.map((col, j) => (
                      <TableCell 
                        key={j} 
                        className={`text-sm py-3.5 ${
                          col.className || (j === visibleColumns.length - 1 && !hasOverflowColumns && col.header.toLowerCase().includes('action') ? 'text-right' : '')
                        }`}
                      >
                        {col.cell ? col.cell(row) : (row[col.accessor] ?? '-')}
                      </TableCell>
                    ))}
                    {hasOverflowColumns && (
                      <TableCell className="text-right py-3.5" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10"
                          onClick={() => setSelectedRecord(row)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Detail Dialog for Overflow Columns */}
      <Dialog open={!!selectedRecord} onOpenChange={(open) => !open && setSelectedRecord(null)}>
        <DialogContent className="max-w-lg bg-card border-border/60">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Eye className="w-4 h-4 text-primary" />
              {detailsTitle}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Complete details and all attributes for this record.
            </DialogDescription>
          </DialogHeader>

          {selectedRecord && (
            <div className="space-y-4 pt-2">
              {renderDetails ? (
                renderDetails(selectedRecord)
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/60">
                  {columns.map((col, idx) => (
                    <div key={idx} className="space-y-1">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                        {col.header}
                      </p>
                      <div className="text-sm font-medium text-foreground break-words">
                        {col.cell ? col.cell(selectedRecord) : (selectedRecord[col.accessor] ?? '-')}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedRecord(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}