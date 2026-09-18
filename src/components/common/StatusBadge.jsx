import { cn } from '@/lib/utils';

const statusConfig = {
  // Visit statuses
  waiting: { dot: 'bg-amber-500 animate-pulse', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-300', label: 'Waiting' },
  with_doctor: { dot: 'bg-blue-500 animate-pulse', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/40', text: 'text-blue-700 dark:text-blue-300', label: 'With Doctor' },
  lab_pending: { dot: 'bg-violet-500 animate-pulse', bg: 'bg-violet-50 dark:bg-violet-950/30 border-violet-200/50 dark:border-violet-800/40', text: 'text-violet-700 dark:text-violet-300', label: 'Lab Pending' },
  lab_paid: { dot: 'bg-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200/50 dark:border-indigo-800/40', text: 'text-indigo-700 dark:text-indigo-300', label: 'Lab Paid' },
  lab_processing: { dot: 'bg-cyan-500 animate-pulse', bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200/50 dark:border-cyan-800/40', text: 'text-cyan-700 dark:text-cyan-300', label: 'Processing' },
  lab_complete: { dot: 'bg-teal-500', bg: 'bg-teal-50 dark:bg-teal-950/30 border-teal-200/50 dark:border-teal-800/40', text: 'text-teal-700 dark:text-teal-300', label: 'Lab Complete' },
  pharmacy: { dot: 'bg-green-500 animate-pulse', bg: 'bg-green-50 dark:bg-green-950/30 border-green-200/50 dark:border-green-800/40', text: 'text-green-700 dark:text-green-300', label: 'At Pharmacy' },
  completed: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Completed' },
  cancelled: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/40', text: 'text-red-700 dark:text-red-300', label: 'Cancelled' },
  // Payment / order statuses
  pending: { dot: 'bg-amber-500 animate-pulse', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-300', label: 'Pending' },
  pending_payment: { dot: 'bg-amber-500 animate-pulse', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-300', label: 'Pending Payment' },
  paid: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Paid' },
  waived: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/40', text: 'text-blue-700 dark:text-blue-300', label: 'Waived' },
  dispensed: { dot: 'bg-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/40', text: 'text-blue-700 dark:text-blue-300', label: 'Dispensed' },
  in_progress: { dot: 'bg-blue-500 animate-pulse', bg: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200/50 dark:border-blue-800/40', text: 'text-blue-700 dark:text-blue-300', label: 'In Progress' },
  awaiting_payment: { dot: 'bg-orange-500 animate-pulse', bg: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200/50 dark:border-orange-800/40', text: 'text-orange-700 dark:text-orange-300', label: 'Awaiting Payment' },
  administered: { dot: 'bg-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200/50 dark:border-cyan-800/40', text: 'text-cyan-700 dark:text-cyan-300', label: 'Administered' },
  // Staff / item statuses
  active: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'Active' },
  inactive: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-zinc-800/40 border-gray-200/50 dark:border-zinc-700/40', text: 'text-gray-600 dark:text-zinc-400', label: 'Inactive' },
  suspended: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/40', text: 'text-red-700 dark:text-red-300', label: 'Suspended' },
  retired: { dot: 'bg-gray-400', bg: 'bg-gray-50 dark:bg-zinc-800/40 border-gray-200/50 dark:border-zinc-700/40', text: 'text-gray-500 dark:text-zinc-400', label: 'Retired' },
  in_stock: { dot: 'bg-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200/50 dark:border-emerald-800/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'In Stock' },
  low_stock: { dot: 'bg-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200/50 dark:border-amber-800/40', text: 'text-amber-700 dark:text-amber-300', label: 'Low Stock' },
  out_of_stock: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/40', text: 'text-red-700 dark:text-red-300', label: 'Out of Stock' },
  expired: { dot: 'bg-red-500', bg: 'bg-red-50 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/40', text: 'text-red-700 dark:text-red-300', label: 'Expired' },
};

export default function StatusBadge({ status }) {
  const config = statusConfig[status];
  if (!config) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground shadow-2xs">
        {status?.replace(/_/g, ' ')}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shadow-2xs transition-colors", config.bg, config.text)}>
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.dot)} />
      <span className="truncate">{config.label}</span>
    </span>
  );
}