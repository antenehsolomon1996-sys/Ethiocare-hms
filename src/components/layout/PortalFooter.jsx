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
  Award
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
    ? (pharmacy?.license_number ? `Licensed Dispensary · Reg #${pharmacy.license_number}` : 'Hospital Dispensary & Retail Pharmacy')
    : (hospital?.hospital_tagline || 'Advanced Healthcare & Diagnostic Center');

  const brandLogo = isPharmacy ? pharmacy?.pharmacy_logo : hospital?.hospital_logo;

  const address = isPharmacy
    ? (pharmacy?.address || 'Ground Floor, Medical Block A, Addis Ababa, Ethiopia')
    : ([hospital?.address, hospital?.city, hospital?.country].filter(Boolean).join(', ') || 'Bole Sub-City, Addis Ababa, Ethiopia');

  const phone = isPharmacy
    ? (pharmacy?.phone || '+251 11 612 3457')
    : (hospital?.phone || '+251 11 612 3456');

  const altPhone = isPharmacy ? pharmacy?.alt_phone : hospital?.alt_phone;

  const emergencyPhone = isPharmacy ? null : (hospital?.emergency_phone || '+251 11 612 9999');

  const email = isPharmacy
    ? (pharmacy?.email || 'pharmacy@ethiocarehospital.com')
    : (hospital?.email || 'info@ethiocarehospital.com');

  const workingHours = isPharmacy
    ? (pharmacy?.working_hours || 'Open 24 Hours')
    : (hospital?.working_hours || '24/7 Emergency · OPD Mon-Sat 8AM-8PM');

  return (
    <footer 
      role="contentinfo"
      aria-label="Portal Footer"
      className="w-full mt-12 md:mt-16 border-t border-border/60 bg-card/80 dark:bg-card/50 backdrop-blur-md relative z-10 transition-colors"
    >
      {/* Subtle top accent line */}
      <div className="h-0.5 w-full bg-gradient-to-r from-primary/20 via-primary to-primary/20" />

      {/* Main Footer Body: pr-16 on mobile reserves breathing room so MobileFloatingNav never covers content */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 md:px-8 py-5 sm:py-6 md:py-6 pr-16 sm:pr-20 md:pr-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] md:pb-4">
        
        {/* Desktop: Horizontal/Multi-cluster Row | Mobile: Compact Vertical Stack */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 lg:gap-6 text-xs text-muted-foreground">
          
          {/* Identity & Portal Badge */}
          <div className="flex items-center gap-3 min-w-0 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 shadow-2xs">
              {brandLogo ? (
                <img 
                  src={brandLogo} 
                  alt={brandName} 
                  className="w-full h-full object-contain p-0.5 rounded-md" 
                  loading="lazy" 
                  decoding="async" 
                />
              ) : isPharmacy ? (
                <Pill className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Building2 className="w-4 h-4 text-primary" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-sm text-foreground leading-tight truncate">
                  {brandName}
                </span>
                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 font-semibold h-4">
                  {portalTitle}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                {brandTagline}
              </p>
            </div>
          </div>

          {/* Contact, Location & Hours Strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            <div className="flex items-center gap-1.5 text-foreground/90">
              <MapPin className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[220px] sm:max-w-none">{address}</span>
            </div>

            <div className="flex items-center gap-1.5 text-foreground/90">
              <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
              <a href={`tel:${phone.replace(/\s+/g, '')}`} className="hover:text-primary font-medium transition-colors">
                {phone}
              </a>
            </div>

            {emergencyPhone && (
              <div className="flex items-center gap-1.5 text-rose-700 dark:text-rose-400 font-semibold bg-rose-500/10 px-2 py-0.5 rounded-md">
                <PhoneCall className="w-3 h-3 shrink-0" />
                <span>24/7 Hotline:</span>
                <a href={`tel:${emergencyPhone.replace(/\s+/g, '')}`} className="hover:underline font-mono">
                  {emergencyPhone}
                </a>
              </div>
            )}

            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
              <span>{workingHours}</span>
            </div>
          </div>
        </div>

        {/* Compact Sub-Bar with Copyright & Security */}
        <div className="mt-3.5 pt-3 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
            <span className="font-semibold text-foreground">EthioCare HMS</span>
            <span>·</span>
            <span>{brandName}</span>
            <span>·</span>
            <span>© {new Date().getFullYear()} All rights reserved.</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              Secure RLS · Encrypted Care
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
