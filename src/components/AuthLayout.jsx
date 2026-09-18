import React from "react";
import { useHospitalBranding } from "@/hooks/useHospitalBranding";

export default function AuthLayout({ icon: Icon, title, subtitle, footer, children }) {
  const { hospital } = useHospitalBranding();
  return (
    <div className="min-h-screen flex">
      {/* Left panel — branding / hero */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden gradient-primary">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M30 30c0-11 9-20 20-20v40c-11 0-20-9-20-20zm-20 0c0-11 9-20 20-20v40c-11 0-20-9-20-20z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center overflow-hidden">
              {hospital?.hospital_logo ? (
                <img src={hospital.hospital_logo} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
              )}
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold tracking-tight">{hospital?.hospital_name || 'EthioCare HMS'}</h2>
              <p className="text-xs text-white/70">{hospital?.hospital_tagline || 'Hospital Management System'}</p>
            </div>
          </div>
          <div>
            <h1 className="font-heading text-4xl font-bold leading-tight tracking-tight">
              Delivering excellence in healthcare management
            </h1>
            <p className="text-white/80 mt-4 text-lg leading-relaxed max-w-md">
              A unified platform connecting doctors, nurses, laboratories, pharmacy, and billing for seamless patient care.
            </p>
          </div>
          <div className="flex items-center gap-6 text-white/70 text-sm">
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Secure & Compliant</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-cyan-400" /> Real-time Sync</div>
            <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-white/60" /> Role-based Access</div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center bg-background px-4 py-8 sm:px-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-primary shadow-premium mb-4">
              <Icon className="w-7 h-7 text-white" aria-hidden="true" />
            </div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground">{title}</h1>
            {subtitle && <p className="text-muted-foreground mt-1.5 text-sm">{subtitle}</p>}
          </div>
          <div className="bg-card rounded-2xl shadow-premium border border-border/60 p-6 sm:p-8">
            {children}
          </div>
          {footer && (
            <p className="text-center text-sm text-muted-foreground mt-6">{footer}</p>
          )}
        </div>
      </div>
    </div>
  );
}