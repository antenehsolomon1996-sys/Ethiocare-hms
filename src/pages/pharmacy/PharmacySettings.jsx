import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { pharmacySettingsService, DEFAULT_PHARMACY_SETTINGS } from '@/services/pharmacySettings.service';
import { usePharmacyBranding } from '@/hooks/usePharmacyBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Settings,
  Pill,
  Phone,
  Mail,
  MapPin,
  Clock,
  Shield,
  Save,
  RotateCcw,
  Printer,
  FileText,
  UserCheck,
  Lock,
  Unlock,
  Eye,
  CheckCircle2,
  Receipt
} from 'lucide-react';
import { toast } from 'sonner';
import ImageUploadField from '@/components/common/ImageUploadField';

export default function PharmacySettingsPage() {
  const { user } = useAuth();
  const [activeMainTab, setActiveMainTab] = useState('branding'); // 'branding' | 'governance'

  // Governance settings state
  const [governanceSettings, setGovernanceSettings] = useState(DEFAULT_PHARMACY_SETTINGS);
  const [isLoadingGov, setIsLoadingGov] = useState(true);

  // Pharmacy branding state
  const { pharmacy, updatePharmacy, isLoading: isLoadingBranding } = usePharmacyBranding();
  const [brandingForm, setBrandingForm] = useState({
    pharmacy_name: '',
    pharmacy_logo: '',
    phone: '',
    alt_phone: '',
    email: '',
    address: '',
    city: '',
    region: '',
    country: '',
    license_number: '',
    tin_number: '',
    website: '',
    working_hours: '',
    receipt_footer: '',
    default_receipt_format: '80mm'
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load governance settings
  useEffect(() => {
    pharmacySettingsService.getSettings().then(data => {
      setGovernanceSettings(data);
      setIsLoadingGov(false);
    });
  }, []);

  // Synchronize branding form
  useEffect(() => {
    if (pharmacy) {
      setBrandingForm({
        pharmacy_name: pharmacy.pharmacy_name || 'EthioCare Central Pharmacy',
        pharmacy_logo: pharmacy.pharmacy_logo || '',
        phone: pharmacy.phone || '+251 11 612 3457',
        alt_phone: pharmacy.alt_phone || '+251 91 133 4455',
        email: pharmacy.email || 'pharmacy@ethiocarehospital.com',
        address: pharmacy.address || 'Ground Floor, Medical Block A',
        city: pharmacy.city || 'Addis Ababa',
        region: pharmacy.region || 'Addis Ababa',
        country: pharmacy.country || 'Ethiopia',
        license_number: pharmacy.license_number || 'EFDA-PH-2024-8841',
        tin_number: pharmacy.tin_number || '0045892147',
        website: pharmacy.website || 'https://ethiocarehospital.com/pharmacy',
        working_hours: pharmacy.working_hours || 'Open 24 Hours · Inpatient & Walk-In',
        receipt_footer: pharmacy.receipt_footer || 'Thank you for choosing EthioCare Central Pharmacy. Keep medicines in a cool, dry place.',
        default_receipt_format: pharmacy.default_receipt_format || '80mm'
      });
    }
  }, [pharmacy]);

  // Handle Governance Toggles
  const handleGovToggle = (key) => {
    setGovernanceSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Handle Governance Save
  const handleSaveGovernance = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    try {
      const updated = await pharmacySettingsService.updateSettings(
        governanceSettings,
        user?.full_name || 'Pharmacist'
      );
      setGovernanceSettings(updated);
      toast.success('Clinical governance settings saved successfully!');
    } catch (err) {
      console.error('[PharmacySettings] Error saving governance:', err);
      toast.error('Failed to save governance settings');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Branding Save
  const handleSaveBranding = async (e) => {
    if (e) e.preventDefault();
    if (!brandingForm.pharmacy_name.trim()) {
      toast.error('Pharmacy name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updatePharmacy(brandingForm, user?.full_name || 'Pharmacist');
      toast.success('Pharmacy profile and receipt branding updated!', {
        description: 'Navbar, retail POS receipts, and dispensary vouchers updated immediately.'
      });
    } catch (err) {
      console.error('[PharmacySettings] Error saving branding:', err);
      toast.error('Failed to save pharmacy branding');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Pill className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            Pharmacy Profile & POS Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure independent dispensary branding, thermal receipt layouts, and POS clinical validation rules.
          </p>
        </div>

        {/* Action Button depending on active tab */}
        <div className="flex items-center gap-2">
          {activeMainTab === 'branding' ? (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveBranding}
              disabled={isSaving || isLoadingBranding}
              className="gradient-primary shadow-soft"
            >
              {isSaving ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </span>
              ) : (
                <span className="flex items-center gap-1.5">
                  <Save className="w-4 h-4" />
                  Save Branding
                </span>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={handleSaveGovernance}
              disabled={isSaving || isLoadingGov}
              className="gradient-primary shadow-soft"
            >
              {isSaving ? 'Saving...' : 'Save Rules'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Tab Switcher */}
      <div className="flex border-b border-border/60 gap-4">
        <button
          type="button"
          onClick={() => setActiveMainTab('branding')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeMainTab === 'branding'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Pharmacy Profile & Receipt Branding
        </button>
        <button
          type="button"
          onClick={() => setActiveMainTab('governance')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-all ${
            activeMainTab === 'governance'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Shield className="w-4 h-4" />
          POS Clinical Governance & Validation
        </button>
      </div>

      {/* TAB 1: PHARMACY BRANDING & RECEIPT CONFIG */}
      {activeMainTab === 'branding' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Form Columns (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Pill className="w-4 h-4 text-emerald-600" />
                  Dispensary Identification
                </CardTitle>
                <CardDescription>
                  This official pharmacy name, license number, and tax ID appear on retail cash receipts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pharmacy_name" className="text-xs font-semibold">
                    Pharmacy / Dispensary Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="pharmacy_name"
                    value={brandingForm.pharmacy_name}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, pharmacy_name: e.target.value }))}
                    placeholder="e.g. EthioCare Central Pharmacy"
                    className="font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="license_number" className="text-xs font-semibold">
                      EFDA Pharmacy License #
                    </Label>
                    <Input
                      id="license_number"
                      value={brandingForm.license_number}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, license_number: e.target.value }))}
                      placeholder="EFDA-PH-2024-8841"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="tin_number" className="text-xs font-semibold">
                      Pharmacy TIN Number
                    </Label>
                    <Input
                      id="tin_number"
                      value={brandingForm.tin_number}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, tin_number: e.target.value }))}
                      placeholder="0045892147"
                    />
                  </div>
                </div>

                <ImageUploadField
                  id="pharmacy_logo"
                  label="Pharmacy Logo"
                  value={brandingForm.pharmacy_logo}
                  onChange={(val) => setBrandingForm(prev => ({ ...prev, pharmacy_logo: val }))}
                  placeholder="https://example.com/pharmacy-logo.png"
                  description="Upload file or enter URL. Client-side canvas auto-optimizes to max 512px WebP/PNG for rapid POS and navbar loading."
                  maxDimension={512}
                />
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Phone className="w-4 h-4 text-sky-500" />
                  Pharmacy Contact & Counter Location
                </CardTitle>
                <CardDescription>
                  Direct lines for prescription queries, medication counselling, and physical counter address.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">
                      Counter Phone / Extension
                    </Label>
                    <Input
                      id="phone"
                      value={brandingForm.phone}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="+251 11 612 3457"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="alt_phone" className="text-xs font-semibold">
                      Alternative / Pharmacist On-Duty
                    </Label>
                    <Input
                      id="alt_phone"
                      value={brandingForm.alt_phone}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, alt_phone: e.target.value }))}
                      placeholder="+251 91 133 4455"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">
                      Pharmacy Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={brandingForm.email}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="pharmacy@ethiocarehospital.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="working_hours" className="text-xs font-semibold">
                      Service Hours
                    </Label>
                    <Input
                      id="working_hours"
                      value={brandingForm.working_hours}
                      onChange={(e) => setBrandingForm(prev => ({ ...prev, working_hours: e.target.value }))}
                      placeholder="Open 24 Hours · Inpatient & Walk-In"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold">
                    Physical Dispensary Location / Wing
                  </Label>
                  <Input
                    id="address"
                    value={brandingForm.address}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="Ground Floor, Medical Block A"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" />
                  Thermal Printer & Receipt Notes
                </CardTitle>
                <CardDescription>
                  Configure thermal paper width and customer instructions printed on receipts.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Default Receipt Format</Label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: '58mm', label: '58mm Thermal', sub: 'Compact POS / 2-inch' },
                      { id: '80mm', label: '80mm Thermal', sub: 'Standard POS / 3-inch' },
                      { id: 'a4', label: 'A4 / Full Sheet', sub: 'Laser / Inkjet' }
                    ].map(fmt => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setBrandingForm(prev => ({ ...prev, default_receipt_format: fmt.id }))}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          brandingForm.default_receipt_format === fmt.id
                            ? 'border-primary bg-primary/10 text-foreground font-semibold shadow-xs'
                            : 'border-border/60 bg-card hover:bg-muted/30 text-muted-foreground'
                        }`}
                      >
                        <p className="text-xs font-bold leading-tight">{fmt.label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{fmt.sub}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="receipt_footer" className="text-xs font-semibold">
                    Receipt Footer Disclaimer & Storage Instructions
                  </Label>
                  <Textarea
                    id="receipt_footer"
                    rows={3}
                    value={brandingForm.receipt_footer}
                    onChange={(e) => setBrandingForm(prev => ({ ...prev, receipt_footer: e.target.value }))}
                    placeholder="Thank you for choosing EthioCare Central Pharmacy. Keep medicines in a cool, dry place."
                    className="text-xs leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Live Receipt Preview (5 cols sticky) */}
          <div className="lg:col-span-5 sticky top-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Eye className="w-3.5 h-3.5 text-primary" />
                Live Thermal Receipt Mockup
              </span>
              <span className="text-[10px] bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
                {brandingForm.default_receipt_format.toUpperCase()}
              </span>
            </div>

            {/* Thermal Slip Card */}
            <div
              className={`mx-auto bg-white text-black p-4 rounded-xl shadow-premium border border-neutral-300 font-mono text-[11px] leading-tight transition-all duration-300 ${
                brandingForm.default_receipt_format === '58mm'
                  ? 'max-w-[260px]'
                  : brandingForm.default_receipt_format === '80mm'
                  ? 'max-w-[320px]'
                  : 'max-w-[380px]'
              }`}
            >
              {/* Receipt Header */}
              <div className="text-center pb-2 border-b border-dashed border-neutral-400 space-y-1">
                {brandingForm.pharmacy_logo ? (
                  <img
                    src={brandingForm.pharmacy_logo}
                    alt="Logo"
                    className="w-10 h-10 object-contain mx-auto mb-1"
                  />
                ) : (
                  <div className="font-bold text-xs uppercase tracking-wider">
                    *** OFFICIAL PHARMACY RECEIPT ***
                  </div>
                )}
                <div className="font-extrabold text-xs uppercase tracking-tight">
                  {brandingForm.pharmacy_name || 'ETHIOCARE CENTRAL PHARMACY'}
                </div>
                <div className="text-[10px] text-neutral-600">
                  {brandingForm.address || 'Medical Block A'} · {brandingForm.city || 'Addis Ababa'}
                </div>
                <div className="text-[10px] text-neutral-600">
                  Tel: {brandingForm.phone || '+251 11 612 3457'}
                </div>
                <div className="text-[9px] text-neutral-500">
                  License: {brandingForm.license_number || 'EFDA-PH-2024'} | TIN: {brandingForm.tin_number || '0045892147'}
                </div>
              </div>

              {/* Transaction details */}
              <div className="py-2 border-b border-dashed border-neutral-300 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>RECEIPT #:</span>
                  <span className="font-bold">RCP-POS-2026-9810</span>
                </div>
                <div className="flex justify-between">
                  <span>DATE:</span>
                  <span>{new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div className="flex justify-between">
                  <span>CUSTOMER:</span>
                  <span className="font-bold">Walk-In Retail</span>
                </div>
              </div>

              {/* Sample Items Table */}
              <div className="py-2 border-b border-dashed border-neutral-400 space-y-1.5">
                <div className="flex justify-between font-bold text-[10px] border-b border-neutral-300 pb-0.5">
                  <span className="w-1/2">ITEM / DOSE</span>
                  <span className="text-center w-1/4">QTY</span>
                  <span className="text-right w-1/4">TOTAL</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <div className="w-1/2 pr-1">
                    <div className="font-bold">Amoxicillin 500mg</div>
                    <div className="text-[9px] text-neutral-500">1 cap TDS x 5d</div>
                  </div>
                  <div className="text-center w-1/4">10</div>
                  <div className="text-right w-1/4">150.00</div>
                </div>
                <div className="flex justify-between text-[10px]">
                  <div className="w-1/2 pr-1">
                    <div className="font-bold">Paracetamol 500mg</div>
                    <div className="text-[9px] text-neutral-500">2 tab PRN</div>
                  </div>
                  <div className="text-center w-1/4">20</div>
                  <div className="text-right w-1/4">70.00</div>
                </div>
              </div>

              {/* Totals */}
              <div className="py-2 border-b border-dashed border-neutral-400 space-y-0.5 text-[10px]">
                <div className="flex justify-between">
                  <span>SUBTOTAL:</span>
                  <span>ETB 220.00</span>
                </div>
                <div className="flex justify-between font-extrabold text-xs pt-1 border-t border-neutral-300">
                  <span>GRAND TOTAL:</span>
                  <span>ETB 220.00</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>PAID (CASH):</span>
                  <span>ETB 250.00</span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>CHANGE:</span>
                  <span>ETB 30.00</span>
                </div>
              </div>

              {/* Receipt Footer */}
              <div className="pt-3 text-center text-[9px] text-neutral-600 space-y-1">
                <p className="font-medium italic leading-tight">
                  {brandingForm.receipt_footer || 'Thank you for choosing EthioCare Central Pharmacy.'}
                </p>
                <p className="text-[8px] uppercase tracking-widest text-neutral-400 pt-1">
                  -- CUSTOMER COPY --
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CLINICAL GOVERNANCE & POS PERMISSIONS */}
      {activeMainTab === 'governance' && (
        <form onSubmit={handleSaveGovernance} className="space-y-6">
          {/* Section 1: Retail POS Operational Lock */}
          <Card className={governanceSettings.enable_retail_sales ? 'border-primary/20' : 'border-destructive/40 bg-destructive/5'}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-lg ${
                      governanceSettings.enable_retail_sales ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                    }`}
                  >
                    {governanceSettings.enable_retail_sales ? <Unlock className="w-5 h-5" /> : <Lock className="w-5 h-5" />}
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">Walk-In Retail Sales Permission</CardTitle>
                    <CardDescription>
                      Enable or temporarily lock walk-in over-the-counter customer sales
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={governanceSettings.enable_retail_sales}
                  onCheckedChange={() => handleGovToggle('enable_retail_sales')}
                />
              </div>
            </CardHeader>
            <CardContent className="text-xs text-muted-foreground">
              {governanceSettings.enable_retail_sales ? (
                <p className="text-emerald-600 font-medium">
                  Active: Pharmacists can conduct walk-in counter sales and issue cash receipts.
                </p>
              ) : (
                <p className="text-destructive font-medium">
                  Locked: Walk-in retail checkout is blocked. Only hospital prescription dispensing is permitted.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Section 2: Mandatory Customer Demographics */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-primary" />
                Customer Demographics Requirements
              </CardTitle>
              <CardDescription>
                Toggle which customer fields must be filled before completing a walk-in sale
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y pt-1">
              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold text-foreground">Require Customer Full Name</Label>
                  <p className="text-xs text-muted-foreground">
                    Enforces entering customer legal name on retail cash receipts.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_customer_name}
                  onCheckedChange={() => handleGovToggle('require_customer_name')}
                />
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold text-foreground">Require Customer Phone Number</Label>
                  <p className="text-xs text-muted-foreground">
                    Enforces entering a phone number for customer follow-up or recall notifications.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_customer_phone}
                  onCheckedChange={() => handleGovToggle('require_customer_phone')}
                />
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold text-foreground">Require Classification (Adult / Child)</Label>
                  <p className="text-xs text-muted-foreground">
                    Ensures pharmacist classifies whether the medicine is for pediatric or adult treatment.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_customer_type}
                  onCheckedChange={() => handleGovToggle('require_customer_type')}
                />
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold text-foreground">Require Patient Age</Label>
                  <p className="text-xs text-muted-foreground">
                    Requires inputting patient age to verify pediatric and geriatric safety limits.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_customer_age}
                  onCheckedChange={() => handleGovToggle('require_customer_age')}
                />
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold text-foreground">Require Patient Weight (kg)</Label>
                  <p className="text-xs text-muted-foreground">
                    Mandatory weight verification for pediatric dosing and antibiotic precision.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_customer_weight}
                  onCheckedChange={() => handleGovToggle('require_customer_weight')}
                />
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Clinical & Prescription Rules */}
          <Card>
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                Clinical & Prescription Rules
              </CardTitle>
              <CardDescription>
                Enforce Ethiopian Food & Drug Authority (EFDA) dispensing regulations
              </CardDescription>
            </CardHeader>
            <CardContent className="divide-y pt-1">
              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <div className="flex items-center gap-2">
                    <Label className="text-sm font-semibold text-foreground">
                      Enforce Prescription Number for Rx-Required Medicines
                    </Label>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    When enabled, any cart containing an Rx-only medicine mandates entering a valid prescription reference.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_prescription_number}
                  onCheckedChange={() => handleGovToggle('require_prescription_number')}
                />
              </div>

              <div className="flex items-center justify-between py-3.5">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-semibold text-foreground">
                    Require Dosage Instructions on Cart Items
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Mandates that pharmacists enter administration instructions on every medicine dispensed.
                  </p>
                </div>
                <Switch
                  checked={governanceSettings.require_dosage_instructions}
                  onCheckedChange={() => handleGovToggle('require_dosage_instructions')}
                />
              </div>

              <div className="py-3.5 space-y-2">
                <Label htmlFor="default-wh" className="text-sm font-semibold text-foreground">
                  Default Receiving Warehouse / Storage Location
                </Label>
                <Input
                  id="default-wh"
                  value={governanceSettings.default_storage_location || ''}
                  onChange={e =>
                    setGovernanceSettings(prev => ({ ...prev, default_storage_location: e.target.value }))
                  }
                  placeholder="e.g. Main Pharmacy Store"
                  className="max-w-md h-8 text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Prefilled location for new stock inbound purchase shipments.
                </p>
              </div>
            </CardContent>
          </Card>
        </form>
      )}
    </div>
  );
}
