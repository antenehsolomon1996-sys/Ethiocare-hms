import { cn } from '@/lib/utils';

const colorConfig = {
  primary: { iconBg: 'bg-primary/10 dark:bg-primary/20', iconText: 'text-primary dark:text-primary-foreground', accent: 'from-primary/10' },
  blue: { iconBg: 'bg-blue-50 dark:bg-blue-950/40', iconText: 'text-blue-600 dark:text-blue-400', accent: 'from-blue-500/10' },
  teal: { iconBg: 'bg-teal-50 dark:bg-teal-950/40', iconText: 'text-teal-600 dark:text-teal-400', accent: 'from-teal-500/10' },
  green: { iconBg: 'bg-emerald-50 dark:bg-emerald-950/40', iconText: 'text-emerald-600 dark:text-emerald-400', accent: 'from-emerald-500/10' },
  amber: { iconBg: 'bg-amber-50 dark:bg-amber-950/40', iconText: 'text-amber-600 dark:text-amber-400', accent: 'from-amber-500/10' },
  red: { iconBg: 'bg-red-50 dark:bg-red-950/40', iconText: 'text-red-600 dark:text-red-400', accent: 'from-red-500/10' },
  purple: { iconBg: 'bg-violet-50 dark:bg-violet-950/40', iconText: 'text-violet-600 dark:text-violet-400', accent: 'from-violet-500/10' },
  pink: { iconBg: 'bg-pink-50 dark:bg-pink-950/40', iconText: 'text-pink-600 dark:text-pink-400', accent: 'from-pink-500/10' },
};

export default function StatCard({ title, value, icon: Icon, color = 'primary', trend, subtitle }) {
  const config = colorConfig[color] || colorConfig.primary;
  return (
    <div className={cn(
      "relative overflow-hidden rounded-2xl border border-border/60 bg-card p-4 md:p-5 shadow-soft transition-all duration-300 hover:shadow-card hover:-translate-y-0.5 backdrop-blur-xs",
    )}>
      <div className={cn("absolute inset-0 bg-gradient-to-br to-transparent opacity-60 pointer-events-none", config.accent)} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">{title}</p>
          <p className="text-xl sm:text-2xl font-bold font-heading mt-1.5 tracking-tight text-foreground truncate">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
          {trend !== undefined && (
            <p className={cn("text-xs font-semibold mt-1 inline-flex items-center gap-0.5", trend >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </p>
          )}
        </div>
        {Icon && (
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/30 shadow-2xs", config.iconBg)}>
            <Icon className={cn("w-5 h-5", config.iconText)} />
          </div>
        )}
      </div>
    </div>
  );
}