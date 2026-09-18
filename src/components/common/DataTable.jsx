import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';

export default function DataTable({ columns, data, isLoading, onRowClick, emptyMessage = "No data found" }) {
  if (isLoading) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-soft">
        {/* Desktop Skeleton */}
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                {columns.map((col, i) => (
                  <TableHead key={i} className="text-xs font-semibold uppercase tracking-wider">{col.header}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Mobile Skeleton */}
        <div className="md:hidden space-y-3 p-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-border/60 rounded-xl p-3.5 space-y-2 bg-card">
              {columns.slice(0, 3).map((col, j) => (
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
              onClick={() => onRowClick?.(row)}
            >
              {columns.map((col, j) => (
                <div key={j} className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-muted-foreground font-semibold uppercase tracking-wider text-[11px] shrink-0 pt-0.5">
                    {col.header}:
                  </span>
                  <span className="font-medium text-right text-foreground break-words max-w-[70%]">
                    {col.cell ? col.cell(row) : row[col.accessor] ?? '-'}
                  </span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (>= md) */}
      <div className="hidden md:block bg-card rounded-2xl border border-border/60 overflow-hidden shadow-soft">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 border-b border-border/60">
                {columns.map((col, i) => (
                  <TableHead key={i} className="text-xs font-semibold uppercase tracking-wider whitespace-nowrap text-muted-foreground">
                    {col.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="text-center py-12 text-muted-foreground">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              ) : (
                data?.map((row, i) => (
                  <TableRow
                    key={row.id || i}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/40 transition-colors" : ""}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((col, j) => (
                      <TableCell key={j} className="text-sm whitespace-nowrap">
                        {col.cell ? col.cell(row) : row[col.accessor]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}