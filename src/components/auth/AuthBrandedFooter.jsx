import React from 'react';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';
import {
  Phone,
  MapPin,
  Clock,
  ShieldCheck,
  Building2,
  Pill,
  PhoneCall,
  Lock,
} from 'lucide-react';

export default function AuthBrandedFooter({ isPharmacy = false, className = '' }) {
  const { hospital } = useHospitalBranding();
  const { pharmacy } = usePharmacyBranding();

  const brand = isPharmacy ? pharmacy : hospital;
  const brandName = isPharmacy
    ? (pharmacy?.pharmacy_name || 'EthioCare Central Pharmacy')
    : (hospital?.hospital_name || 'EthioCare Hospital');

  const phone = isPharmacy ? (pharmacy?.phone || '+251 11 612 3457') : (hospital?.phone || '+251 11 612 3456');
  const emergencyPhone = isPharmacy ? (pharmacy?.alt_phone || '+251 91 133 4455') : (hospital?.emergency_phone || '+251 11 612 9999');
  const address = isPharmacy
    ? `${pharmacy?.address || 'Ground Floor, Medical Block A'}, ${pharmacy?.city || 'Addis Ababa'}`
    : `${hospital?.address || 'Bole Sub-City, Kebele 03'}, ${hospital?.city || 'Addis Ababa'}, ${hospital?.country || 'Ethiopia'}`;
  const workingHours = isPharmacy
    ? (pharmacy?.working_hours || 'Open 24 Hours · Inpatient & Walk-In')
    : (hospital?.working_hours || '24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM');
  const licenseOrAccreditation = isPharmacy
    ? (pharmacy?.license_number ? `EFDA Lic: ${pharmacy.license_number}` : 'EFDA-PH-2024-8841')
    : (hospital?.accreditation_number ? `Accreditation: ${hospital.accreditation_number}` : 'EFDA-HOSP-2024-0012');

  return (
    <footer className={`w-full mt-6 pt-5 border-t border-border/60 text-xs text-muted-foreground ${className}`}>
      {/* 2-column or 3-column contact grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-4">
        {/* Physical Address & Location */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-card/60 border border-border/40">
          <MapPin className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="block font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Hospital Location
            </span>
            <span className="block text-xs truncate" title={address}>
              {address}
            </span>
          </div>
        </div>

        {/* Hotlines: Main & Emergency */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-card/60 border border-border/40">
          <Phone className="w-4 h-4 text-sky-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="block font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Direct Phone & Emergency
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
              <a
                href={`tel:${phone.replace(/\s+/g, '')}`}
                className="hover:text-primary transition-colors font-medium min-h-[24px] inline-flex items-center"
              >
                Tel: {phone}
              </a>
              <span className="text-muted-foreground/40">•</span>
              <a
                href={`tel:${emergencyPhone.replace(/\s+/g, '')}`}
                className="text-rose-600 dark:text-rose-400 font-semibold hover:underline min-h-[24px] inline-flex items-center"
              >
                24/7: {emergencyPhone}
              </a>
            </div>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="flex items-start gap-2.5 p-2.5 rounded-xl bg-card/60 border border-border/40 sm:col-span-2">
          <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <span className="block font-semibold text-foreground text-[11px] uppercase tracking-wider">
              Operating Hours
            </span>
            <span className="block text-xs">
              {workingHours}
            </span>
          </div>
        </div>
      </div>

      {/* Security, Compliance, & Accreditation Note */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-2 p-3 rounded-xl bg-muted/40 border border-border/40 text-[11px]">
        <div className="flex items-center gap-1.5 text-foreground/80 font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-primary shrink-0" />
          <span>EthioCare HMS v2.4 • Role-Based Healthcare Security</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span>{licenseOrAccreditation}</span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-emerald-500" />
            256-Bit Encrypted
          </span>
        </div>
      </div>
    </footer>
  );
}
