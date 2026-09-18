import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';

export default function MobileSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  side = "right"
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={side}
        className="w-full sm:max-w-lg overflow-y-auto p-5 sm:p-6 bg-background/95 backdrop-blur-xl border-l border-border/60 shadow-2xl"
      >
        {(title || description) && (
          <SheetHeader className="text-left pb-4 border-b border-border/50">
            {title && (
              <SheetTitle className="text-lg font-bold font-heading text-foreground">
                {title}
              </SheetTitle>
            )}
            {description && (
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                {description}
              </SheetDescription>
            )}
          </SheetHeader>
        )}
        <div className="py-2">
          {children}
        </div>
      </SheetContent>
    </Sheet>
  );
}