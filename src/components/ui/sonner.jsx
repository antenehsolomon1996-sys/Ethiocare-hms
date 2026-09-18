"use client";
import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

// Premium success notification helper — animated checkmark, auto-close, progress bar
export function showSuccess(message, description) {
  return toast.success(message, {
    description,
    duration: 3000,
    style: {
      borderRadius: '14px',
      boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15), 0 2px 10px -2px rgba(0,0,0,0.08)',
    },
  });
}

export function showError(message, description) {
  return toast.error(message, {
    description,
    duration: 4000,
    style: {
      borderRadius: '14px',
      boxShadow: '0 10px 40px -10px rgba(239,68,68,0.25), 0 2px 10px -2px rgba(0,0,0,0.08)',
    },
  });
}

export function showWarning(message, description) {
  return toast.warning(message, {
    description,
    duration: 3500,
  });
}

export function showInfo(message, description) {
  return toast.info(message, {
    description,
    duration: 3000,
  });
}

const Toaster = ({ ...props }) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="top-right"
      richColors
      closeButton
      duration={3000}
      expand={false}
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:rounded-xl group-[.toaster]:border",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast }