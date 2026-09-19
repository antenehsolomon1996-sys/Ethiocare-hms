import React from 'react';
import { useLocation } from 'react-router-dom';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';
import { roleConfig } from './Sidebar';
import {
  Building2,
  Pill,
  MapPin,
  Phone,
  PhoneCall,
  Mail,
  Clock,
  ShieldCheck,
  HeartPulse,
  Award,
  Globe
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PortalFooter({ role = 'doctor' }) {
  const location = useLocation();
  const { hospital } = useHospitalBranding();
  const { pharmacy } = usePharmacyBranding();

  // Check if current view is Pharmacy portal
  const isPharmacy = role === 'pharmacist' || location.pathname.startsWith('/pharmacy');

  const portalTitle = roleConfig[role]?.title || 'Hospital Portal';

  // Pharmacy vs Hospital brand attributes
  const brandName = isPharmacy
    ? (pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy')
    : (hospital?.hospital_name || 'EthioCare Hospital');

  const brandTagline = isPharmacy
    ? (pharmacy?.license_number ? `Licensed Dispensary & POS · Reg #${pharmacy.license_number}` : 'Licensed Hospital Dispensary & Retail Pharmacy')
    : (hospital?.hospital_tagline || 'Advanced Healthcare & Diagnostic Center');

  const brandLogo = isPharmacy ? pharmacy?.pharmacy_logo : hospital?.hospital_logo;

  const address = isPharmacy
    ? (pharmacy?.address || 'Ground Floor, Medical Block A, Addis Ababa, Ethiopia')
    : ([hospital?.address, hospital?.city, hospital?.country].filter(Boolean).join(', ') || 'Bole Sub-City, Kebele 03, Addis Ababa, Ethiopia');

  const phone = isPharmacy
    ? (pharmacy?.phone || '+251 11 612 3457')
    : (hospital?.phone || '+251 11 612 3456');

  const altPhone = isPharmacy
    ? pharmacy?.alt_phone
    : hospital?.alt_phone;

  const emergencyPhone = isPharmacy
    ? null
    : (hospital?.emergency_phone || '+251 11 612 9999');

  const email = isPharmacy
    ? (pharmacy?.email || 'pharmacy@ethiocarehospital.com')
    : (hospital?.email || 'info@ethiocarehospital.com');

  const workingHours = isPharmacy
    ? (pharmacy?.working_hours || 'Open 24 Hours · Inpatient & Walk-In Dispensation')
    : (hospital?.working_hours || '24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM');

  const accreditation = isPharmacy
    ? (pharmacy?.license_number ? `EFDA License: ${pharmacy.license_number}` : 'Licensed by EFDA')
    : (hospital?.accreditation_number ? `Accreditation: ${hospital.accreditation_number}` : 'Certified Tertiary Care Medical Center');

  return (
    <footer 
      role="contentinfo"
      aria-label="Portal Footer"
      className="w-full mt-12 sm:mt-16 md:mt-20 lg:mt-24 border-t border-border/60 bg-card/60 dark:bg-card/40 backdrop-blur-md relative z-10 transition-colors"
    >
      {/* Top accent gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 opacity-70" />

      {/* Main Footer Container */}
      {/* Note: pr-16 on mobile ensures breathing room from the right-side vertical MobileFloatingNav */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-8 sm:py-10 md:py-12 pr-16 sm:pr-20 md:pr-8">
        {/* Desktop & Tablet Multi-Column Layout / Mobile Stacked Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          {/* Column 1: Hospital / Pharmacy Branding & Core Identity */}
          <div className="space-y-3.5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-xs">
                {brandLogo ? (
                  <img 
                    src={brandLogo} 
                    alt={brandName} 
                    className="w-full h-full object-contain p-0.5 rounded-lg" 
                    loading="lazy" 
                    decoding="async" 
                  />
                ) : isPharmacy ? (
                  <Pill className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Building2 className="w-5 h-5 text-primary" />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-foreground leading-tight truncate">
                  {brandName}
                </h3>
                <p className="text-xs text-primary font-medium flex items-center gap-1 mt-0.5">
                  <HeartPulse className="w-3.5 h-3.5 shrink-0" />
                  <span>EthioCare HMS</span>
                </p>
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {brandTagline}
            </p>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <Badge variant="outline" className="text-[10px] bg-muted/40 font-medium py-0.5">
                <Award className="w-3 h-3 mr-1 text-primary shrink-0" />
                {accreditation}
              </Badge>
              <Badge variant="secondary" className="text-[10px] font-semibold py-0.5">
                {portalTitle}
              </Badge>
            </div>
          </div>

          {/* Column 2: Physical Location & Direct Contact */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Location & Inquiries</span>
            </h4>

            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0 mt-0.5" />
                <span className="leading-snug text-foreground/90">{address}</span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                <a 
                  href={`tel:${phone.replace(/\s+/g, '')}`} 
                  className="hover:text-primary transition-colors font-medium text-foreground/90"
                >
                  {phone}
                </a>
              </div>

              {altPhone && (
                <div className="flex items-center gap-2">
                  <PhoneCall className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                  <a 
                    href={`tel:${altPhone.replace(/\s+/g, '')}`} 
                    className="hover:text-primary transition-colors font-medium text-foreground/90"
                  >
                    {altPhone} (Alt)
                  </a>
                </div>
              )}

              {email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                  <a 
                    href={`mailto:${email}`} 
                    className="hover:text-primary transition-colors truncate"
                  >
                    {email}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Emergency & Operating Hours */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-primary" />
              <span>Hours & Emergency</span>
            </h4>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50">
                <span className="text-[11px] font-semibold text-foreground flex items-center gap-1 mb-1">
                  <Clock className="w-3 h-3 text-primary shrink-0" /> Operating Hours:
                </span>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {workingHours}
                </p>
              </div>

              {emergencyPhone && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-800 dark:text-rose-300">
                  <span className="text-[11px] font-bold flex items-center gap-1 mb-0.5">
                    <PhoneCall className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                    24/7 Emergency Hotline:
                  </span>
                  <a 
                    href={`tel:${emergencyPhone.replace(/\s+/g, '')}`} 
                    className="text-xs font-mono font-bold hover:underline block"
                  >
                    {emergencyPhone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Column 4: System Architecture & Security */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-primary" />
              <span>System & Security</span>
            </h4>

            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="leading-relaxed">
                EthioCare Hospital Management System (HMS) provides secure, HIPAA-compliant electronic clinical workflows and integrated patient care.
              </p>

              <div className="pt-1 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 text-[11px] text-foreground/80 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>Supabase Secure RLS & Encrypted Storage</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-foreground/80 font-medium">
                  <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <span>Real-time Inter-Department Sync</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Sub-Footer Bar */}
        <div className="mt-8 pt-6 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-semibold text-foreground">EthioCare HMS</span>
            <span>·</span>
            <span>{brandName}</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} EthioCare HMS. All rights reserved.</span>
          </div>

          <div className="flex items-center gap-3 text-[11px]">
            <span className="font-mono text-muted-foreground/70">v2.4.0-production</span>
            <span>·</span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Online
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
