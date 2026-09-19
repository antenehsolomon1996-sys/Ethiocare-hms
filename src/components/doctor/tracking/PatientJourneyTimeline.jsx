import React from 'react';
import { 
  UserCheck, 
  CreditCard, 
  Stethoscope, 
  FlaskConical, 
  Receipt, 
  Syringe, 
  Pill, 
  CheckCircle2, 
  Clock, 
  AlertCircle 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const STAGE_CONFIG = {
  registration: { icon: UserCheck, label: 'Registration', shortLabel: 'Reg' },
  payment: { icon: CreditCard, label: 'Payment', shortLabel: 'Pay' },
  doctor: { icon: Stethoscope, label: 'Doctor', shortLabel: 'Doc' },
  lab: { icon: FlaskConical, label: 'Laboratory', shortLabel: 'Lab' },
  billing: { icon: Receipt, label: 'Billing', shortLabel: 'Bill' },
  nurse: { icon: Syringe, label: 'Nurse', shortLabel: 'Nurse' },
  pharmacy: { icon: Pill, label: 'Pharmacy', shortLabel: 'Rx' },
  completed: { icon: CheckCircle2, label: 'Completed', shortLabel: 'Done' }
};

export default function PatientJourneyTimeline({ 
  timeline = [], 
  compact = false, 
  currentStageId = '',
  className = '' 
}) {
  if (!timeline || timeline.length === 0) return null;

  if (compact) {
    return (
      <TooltipProvider>
        <div className={`flex items-center gap-1 sm:gap-1.5 overflow-x-auto py-1.5 max-w-full ${className}`}>
          {timeline.map((step, idx) => {
            const config = STAGE_CONFIG[step.id] || STAGE_CONFIG.doctor;
            const Icon = config.icon;
            const isCompleted = step.status === 'completed';
            const isCurrent = step.status === 'current';
            const isUpcoming = step.status === 'upcoming';

            return (
              <React.Fragment key={step.id}>
                {idx > 0 && (
                  <div 
                    className={`h-0.5 w-2 sm:w-3.5 shrink-0 transition-colors ${
                      isCompleted ? 'bg-emerald-500' : isCurrent ? 'bg-primary/50' : 'bg-muted'
                    }`} 
                  />
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div 
                      className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 transition-all cursor-default ${
                        isCurrent 
                          ? 'bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30 scale-105' 
                          : isCompleted 
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300' 
                            : 'bg-muted text-muted-foreground opacity-60'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : isCurrent ? (
                        <span className="relative flex h-2 w-2 mr-0.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-foreground opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary-foreground"></span>
                        </span>
                      ) : (
                        <Icon className="w-2.5 h-2.5 shrink-0" />
                      )}
                      <span className="hidden xs:inline text-[11px] font-semibold">{config.shortLabel}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs max-w-xs">
                    <p className="font-semibold">{config.label} ({step.department})</p>
                    <p className="text-muted-foreground mt-0.5">{step.note || (isCompleted ? 'Stage completed' : isCurrent ? 'Currently active' : 'Upcoming')}</p>
                  </TooltipContent>
                </Tooltip>
              </React.Fragment>
            );
          })}
        </div>
      </TooltipProvider>
    );
  }

  // Detailed view
  return (
    <div className={`space-y-3 ${className}`}>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
        {timeline.map((step, idx) => {
          const config = STAGE_CONFIG[step.id] || STAGE_CONFIG.doctor;
          const Icon = config.icon;
          const isCompleted = step.status === 'completed';
          const isCurrent = step.status === 'current';
          const isUpcoming = step.status === 'upcoming';

          return (
            <div 
              key={step.id} 
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all ${
                isCurrent 
                  ? 'bg-primary/5 border-primary shadow-sm ring-1 ring-primary' 
                  : isCompleted 
                    ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40' 
                    : 'bg-card border-border/70 opacity-65'
              }`}
            >
              <div className="flex items-center justify-between gap-1 mb-2">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                  isCurrent 
                    ? 'bg-primary text-primary-foreground' 
                    : isCompleted 
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300' 
                      : 'bg-muted text-muted-foreground'
                }`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[10px] font-bold text-muted-foreground">Step {idx + 1}</span>
              </div>

              <div>
                <p className="text-xs font-bold truncate">{config.label}</p>
                <p className="text-[10px] text-muted-foreground truncate" title={step.department}>
                  {step.department}
                </p>
              </div>

              <div className="mt-2 pt-2 border-t border-border/50">
                {isCompleted && (
                  <Badge variant="outline" className="text-[10px] bg-emerald-100/70 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200 py-0 px-1.5">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-1" /> Completed
                  </Badge>
                )}
                {isCurrent && (
                  <Badge className="text-[10px] bg-primary text-primary-foreground py-0 px-1.5 animate-pulse">
                    <Clock className="w-2.5 h-2.5 mr-1" /> Active
                  </Badge>
                )}
                {isUpcoming && (
                  <span className="text-[10px] text-muted-foreground italic">
                    Upcoming
                  </span>
                )}
                {step.note && (
                  <p className="text-[10px] text-foreground/80 mt-1 line-clamp-1" title={step.note}>
                    {step.note}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
