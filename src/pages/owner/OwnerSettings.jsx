import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useHospitalBranding } from '@/hooks/useHospitalBranding';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Building2,
  Phone,
  Mail,
  MapPin,
  Clock,
  Globe,
  Shield,
  Save,
  RotateCcw,
  Sparkles,
  Eye,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Lock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { logAudit } from '@/lib/auditLogger';
import { toast } from 'sonner';
import ImageUploadField from '@/components/common/ImageUploadField';

export default function OwnerSettings() {
  const { user } = useAuth();
  const { hospital, updateHospital, isLoading } = useHospitalBranding();
  
  const [form, setForm] = useState({
    hospital_name: '',
    hospital_tagline: '',
    hospital_logo: '',
    phone: '',
    alt_phone: '',
    emergency_phone: '',
    email: '',
    address: '',
    city: '',
    region: '',
    country: '',
    postal_code: '',
    website: '',
    working_hours: '',
    description: '',
    accreditation_number: '',
    dev_portal_switcher_enabled: false,
    login_role_selector_enabled: false,
    login_doctor_selector_enabled: false,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isSavingSecurity, setIsSavingSecurity] = useState(false);
  const [activeTab, setActiveTab] = useState('identity');

  const canManageSecurity = ['owner', 'admin'].includes(user?.role);

  // Synchronize form when hospital data loads or updates
  useEffect(() => {
    if (hospital) {
      setForm({
        hospital_name: hospital.hospital_name || 'EthioCare Hospital',
        hospital_tagline: hospital.hospital_tagline || 'Advanced Healthcare & Diagnostic Center',
        hospital_logo: hospital.hospital_logo || '',
        phone: hospital.phone || '+251 11 612 3456',
        alt_phone: hospital.alt_phone || '+251 91 122 3344',
        emergency_phone: hospital.emergency_phone || '+251 11 612 9999',
        email: hospital.email || 'info@ethiocarehospital.com',
        address: hospital.address || 'Bole Sub-City, Kebele 03',
        city: hospital.city || 'Addis Ababa',
        region: hospital.region || 'Addis Ababa',
        country: hospital.country || 'Ethiopia',
        postal_code: hospital.postal_code || 'P.O. Box 1042',
        website: hospital.website || 'https://ethiocarehospital.com',
        working_hours: hospital.working_hours || '24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM',
        description: hospital.description || 'EthioCare Hospital is a premier medical institution providing compassionate, world-class healthcare in Addis Ababa, Ethiopia.',
        accreditation_number: hospital.accreditation_number || 'EFDA-HOSP-2024-0012',
        dev_portal_switcher_enabled: hospital.dev_portal_switcher_enabled !== undefined ? Boolean(hospital.dev_portal_switcher_enabled) : false,
        login_role_selector_enabled: hospital.login_role_selector_enabled !== undefined ? Boolean(hospital.login_role_selector_enabled) : false,
        login_doctor_selector_enabled: hospital.login_doctor_selector_enabled !== undefined ? Boolean(hospital.login_doctor_selector_enabled) : false,
      });
    }
  }, [hospital]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    if (!form.hospital_name.trim()) {
      toast.error('Hospital name cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      await updateHospital(form, user?.full_name || 'Hospital Owner');
      await logAudit({
        userName: user?.full_name || 'Owner',
        userRole: user?.role || 'owner',
        action: 'update',
        module: 'HospitalSettings',
        description: `Updated hospital settings (Switcher: ${form.dev_portal_switcher_enabled ? 'ON' : 'OFF'})`,
        recordId: 'hospital_settings',
        recordName: form.hospital_name
      });
      toast.success('Hospital branding and profile updated globally!', {
        description: 'All doctor, reception, nurse, and admin views have been synchronized.'
      });
    } catch (err) {
      console.error('[OwnerSettings] Save failed:', err);
      toast.error('Failed to save hospital settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveSecurity = async () => {
    if (!canManageSecurity) {
      toast.error('Only Owner or Administrator can modify login page settings');
      return;
    }

    setIsSavingSecurity(true);
    try {
      await updateHospital({
        ...form,
        login_role_selector_enabled: Boolean(form.login_role_selector_enabled),
        login_doctor_selector_enabled: Boolean(form.login_doctor_selector_enabled),
        dev_portal_switcher_enabled: Boolean(form.dev_portal_switcher_enabled),
      }, user?.full_name || 'Owner');

      await logAudit({
        userName: user?.full_name || 'Owner',
        userRole: user?.role || 'owner',
        action: 'update',
        module: 'LoginPageSettings',
        description: `Updated login page controls: Role Selector=${form.login_role_selector_enabled ? 'ON' : 'OFF'}, Doctor Selector=${form.login_doctor_selector_enabled ? 'ON' : 'OFF'}, Quick Switcher=${form.dev_portal_switcher_enabled ? 'ON' : 'OFF'}`,
        recordId: 'login_page_settings',
        recordName: 'Login Page Settings'
      });

      toast.success('Login Page Settings saved successfully!', {
        description: `Role selector: ${form.login_role_selector_enabled ? 'ON' : 'OFF'} | Doctor selector: ${form.login_doctor_selector_enabled ? 'ON' : 'OFF'}`
      });
    } catch (err) {
      console.error('[OwnerSettings] Login settings save failed:', err);
      toast.error('Failed to update login page settings');
    } finally {
      setIsSavingSecurity(false);
    }
  };

  const handleReset = () => {
    if (hospital) {
      setForm({
        hospital_name: hospital.hospital_name || '',
        hospital_tagline: hospital.hospital_tagline || '',
        hospital_logo: hospital.hospital_logo || '',
        phone: hospital.phone || '',
        alt_phone: hospital.alt_phone || '',
        emergency_phone: hospital.emergency_phone || '',
        email: hospital.email || '',
        address: hospital.address || '',
        city: hospital.city || '',
        region: hospital.region || '',
        country: hospital.country || '',
        postal_code: hospital.postal_code || '',
        website: hospital.website || '',
        working_hours: hospital.working_hours || '',
        description: hospital.description || '',
        accreditation_number: hospital.accreditation_number || ''
      });
      toast.info('Form reverted to last saved configuration');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <Building2 className="w-6 h-6 text-primary" />
            Hospital Profile & Organization Settings
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage the official hospital name, contact lines, address, and accreditation across all portals and documents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving || isLoading}
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Discard Changes
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || isLoading}
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
                Save Changes
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Main Grid: Form Sections (Left) + Sticky Live Preview (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Form Tabs & Controls (7 Cols on desktop) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Navigation sub-tabs */}
          <div className="flex overflow-x-auto no-scrollbar sm:flex-wrap gap-1.5 p-1.5 bg-muted/50 rounded-2xl border border-border/50">
            <button
              type="button"
              onClick={() => setActiveTab('identity')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 min-h-[40px] ${
                activeTab === 'identity'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Building2 className="w-3.5 h-3.5 text-primary" />
              Identity & Logo
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 min-h-[40px] ${
                activeTab === 'contact'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Phone className="w-3.5 h-3.5 text-sky-500" />
              Contact & Hotline
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('location')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 min-h-[40px] ${
                activeTab === 'location'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MapPin className="w-3.5 h-3.5 text-emerald-500" />
              Location & Hours
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('accreditation')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 min-h-[40px] ${
                activeTab === 'accreditation'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Shield className="w-3.5 h-3.5 text-indigo-500" />
              Accreditation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-xl transition-all shrink-0 min-h-[40px] ${
                activeTab === 'security'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-amber-500" />
              Login Page Settings
            </button>
          </div>

          {/* TAB 1: IDENTITY & LOGO */}
          {activeTab === 'identity' && (
            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Hospital Name & Brand Identity
                </CardTitle>
                <CardDescription>
                  This name and slogan will appear in portal headers, doctor orders, patient records, and invoices.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hospital_name" className="text-xs font-semibold">
                    Hospital Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="hospital_name"
                    value={form.hospital_name}
                    onChange={(e) => handleChange('hospital_name', e.target.value)}
                    placeholder="e.g. EthioCare Hospital"
                    className="font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="hospital_tagline" className="text-xs font-semibold">
                    Tagline / Clinical Focus
                  </Label>
                  <Input
                    id="hospital_tagline"
                    value={form.hospital_tagline}
                    onChange={(e) => handleChange('hospital_tagline', e.target.value)}
                    placeholder="e.g. Advanced Healthcare & Diagnostic Center"
                  />
                </div>

                <ImageUploadField
                  id="hospital_logo"
                  label="Hospital Logo"
                  value={form.hospital_logo}
                  onChange={(val) => handleChange('hospital_logo', val)}
                  placeholder="https://example.com/hospital-logo.png"
                  description="Upload file or enter URL. Client-side canvas auto-optimizes to max 512px WebP/PNG for instant sync across all portals."
                  maxDimension={512}
                />

                <div className="space-y-1.5">
                  <Label htmlFor="description" className="text-xs font-semibold">
                    Hospital Overview & Mission Statement
                  </Label>
                  <Textarea
                    id="description"
                    rows={4}
                    value={form.description}
                    onChange={(e) => handleChange('description', e.target.value)}
                    placeholder="Brief description for patient registration cards, portal info, and official documentation..."
                    className="text-xs leading-relaxed"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 2: CONTACT & HOTLINE */}
          {activeTab === 'contact' && (
            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Phone className="w-4 h-4 text-sky-500" />
                  Telephone, Hotline & Digital Channels
                </CardTitle>
                <CardDescription>
                  Emergency lines and official communication endpoints.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="phone" className="text-xs font-semibold">
                      Primary Telephone
                    </Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => handleChange('phone', e.target.value)}
                      placeholder="+251 11 612 3456"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="alt_phone" className="text-xs font-semibold">
                      Alternative Phone / Mobile
                    </Label>
                    <Input
                      id="alt_phone"
                      value={form.alt_phone}
                      onChange={(e) => handleChange('alt_phone', e.target.value)}
                      placeholder="+251 91 122 3344"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-destructive/5 border border-destructive/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-destructive shrink-0" />
                    <Label htmlFor="emergency_phone" className="text-xs font-bold text-destructive">
                      24/7 Ambulance & Emergency Hotline
                    </Label>
                  </div>
                  <Input
                    id="emergency_phone"
                    value={form.emergency_phone}
                    onChange={(e) => handleChange('emergency_phone', e.target.value)}
                    placeholder="+251 11 612 9999 or 907"
                    className="border-destructive/30 focus-visible:ring-destructive"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Prominently printed on discharge summaries, lab cards, and prescription headers.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-semibold">
                      Official Contact Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => handleChange('email', e.target.value)}
                      placeholder="info@ethiocarehospital.com"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="website" className="text-xs font-semibold">
                      Official Website URL
                    </Label>
                    <Input
                      id="website"
                      value={form.website}
                      onChange={(e) => handleChange('website', e.target.value)}
                      placeholder="https://ethiocarehospital.com"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 3: LOCATION & WORKING HOURS */}
          {activeTab === 'location' && (
            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-500" />
                  Physical Campus & Operating Schedule
                </CardTitle>
                <CardDescription>
                  Accurate physical address and department operation schedules.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="address" className="text-xs font-semibold">
                    Physical Address / Street / Kebele
                  </Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => handleChange('address', e.target.value)}
                    placeholder="e.g. Bole Sub-City, Kebele 03, House #145"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="city" className="text-xs font-semibold">
                      City
                    </Label>
                    <Input
                      id="city"
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      placeholder="Addis Ababa"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="region" className="text-xs font-semibold">
                      Region / State
                    </Label>
                    <Input
                      id="region"
                      value={form.region}
                      onChange={(e) => handleChange('region', e.target.value)}
                      placeholder="Addis Ababa"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="country" className="text-xs font-semibold">
                      Country
                    </Label>
                    <Input
                      id="country"
                      value={form.country}
                      onChange={(e) => handleChange('country', e.target.value)}
                      placeholder="Ethiopia"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="postal_code" className="text-xs font-semibold">
                    Postal Box / ZIP Code
                  </Label>
                  <Input
                    id="postal_code"
                    value={form.postal_code}
                    onChange={(e) => handleChange('postal_code', e.target.value)}
                    placeholder="P.O. Box 1042"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="working_hours" className="text-xs font-semibold">
                    Operating Schedule & Shift Hours
                  </Label>
                  <Input
                    id="working_hours"
                    value={form.working_hours}
                    onChange={(e) => handleChange('working_hours', e.target.value)}
                    placeholder="24/7 Emergency & Inpatient · OPD Mon-Sat 8:00 AM - 8:00 PM"
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 4: ACCREDITATION */}
          {activeTab === 'accreditation' && (
            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-4">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-indigo-500" />
                  Regulatory Accreditation & Tax Identification
                </CardTitle>
                <CardDescription>
                  EFDA health facility accreditation and legal identification credentials.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="accreditation_number" className="text-xs font-semibold">
                    Healthcare Facility License / Accreditation #
                  </Label>
                  <Input
                    id="accreditation_number"
                    value={form.accreditation_number}
                    onChange={(e) => handleChange('accreditation_number', e.target.value)}
                    placeholder="e.g. EFDA-HOSP-2024-0012"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required for statutory compliance and official receipt validation.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* TAB 5: LOGIN PAGE SETTINGS */}
          {activeTab === 'security' && (
            <Card className="shadow-card border-border/60">
              <CardHeader className="pb-4 border-b border-border/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold flex items-center gap-2">
                      <Lock className="w-4 h-4 text-primary" />
                      Login Page Settings
                    </CardTitle>
                    <CardDescription>
                      Configure public login page components. Customize whether staff role and provisioned doctor selectors are visible or hidden.
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <Badge variant={form.login_role_selector_enabled ? "default" : "outline"} className="text-[10px]">
                      Role Selector: {form.login_role_selector_enabled ? 'ON' : 'OFF'}
                    </Badge>
                    <Badge variant={form.login_doctor_selector_enabled ? "default" : "outline"} className="text-[10px]">
                      Doctor Selector: {form.login_doctor_selector_enabled ? 'ON' : 'OFF'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-6 space-y-6">
                {/* 1. Staff Role Selector Setting */}
                <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Staff Role Selector
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Controls whether the staff role tabs (Doctor, Nurse, Lab, Reception, Pharmacy, Billing, Owner) appear on the public login page.
                      </p>
                    </div>
                    <Badge className={form.login_role_selector_enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 shrink-0" : "bg-muted text-muted-foreground border-border shrink-0"}>
                      {form.login_role_selector_enabled ? "● ON (Visible)" : "○ OFF (Hidden - Recommended)"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* OFF Option (Default) */}
                    <div
                      onClick={() => canManageSecurity && handleChange('login_role_selector_enabled', false)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        !form.login_role_selector_enabled
                          ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">OFF (Default / Clean)</span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold text-muted-foreground">
                              Recommended
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Hides the role selector completely. Hospital staff enter email & password, and the system automatically identifies their role from the database.
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          !form.login_role_selector_enabled ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}>
                          {!form.login_role_selector_enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>

                    {/* ON Option */}
                    <div
                      onClick={() => canManageSecurity && handleChange('login_role_selector_enabled', true)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        form.login_role_selector_enabled
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">ON</span>
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[9px] py-0 px-1 font-bold">
                              Visible
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Displays the 7-role selector buttons on the public login page for manual department filtering.
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          form.login_role_selector_enabled ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground'
                        }`}>
                          {form.login_role_selector_enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Provisioned Doctor Selector Setting */}
                <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Provisioned Doctor Selector
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Controls whether the doctor/staff selection dropdown and staff preview cards (including Dr. Selamawit Tadesse) appear on the login page.
                      </p>
                    </div>
                    <Badge className={form.login_doctor_selector_enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 shrink-0" : "bg-muted text-muted-foreground border-border shrink-0"}>
                      {form.login_doctor_selector_enabled ? "● ON (Visible)" : "○ OFF (Hidden - Recommended)"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    {/* OFF Option (Default) */}
                    <div
                      onClick={() => canManageSecurity && handleChange('login_doctor_selector_enabled', false)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        !form.login_doctor_selector_enabled
                          ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">OFF (Default / Clean)</span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1 font-bold text-muted-foreground">
                              Recommended
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Hides the doctor selector, provisioned cards, and room preview banner. Doctors sign in directly using their personal credentials.
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          !form.login_doctor_selector_enabled ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}>
                          {!form.login_doctor_selector_enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>

                    {/* ON Option */}
                    <div
                      onClick={() => canManageSecurity && handleChange('login_doctor_selector_enabled', true)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        form.login_doctor_selector_enabled
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-xs text-foreground">ON</span>
                            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[9px] py-0 px-1 font-bold">
                              Visible
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Displays the provisioned doctor dropdown and workspace preview card on the public login page.
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          form.login_doctor_selector_enabled ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground'
                        }`}>
                          {form.login_doctor_selector_enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Development / Quick Switcher Setting */}
                <div className="space-y-3 p-4 rounded-xl border border-border/70 bg-card/60">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-foreground">
                        Staff Demo Credentials & Quick Switcher
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Controls whether 1-click test credentials and demo buttons are displayed.
                      </p>
                    </div>
                    <Badge className={form.dev_portal_switcher_enabled ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 shrink-0" : "bg-muted text-muted-foreground border-border shrink-0"}>
                      {form.dev_portal_switcher_enabled ? "● ON" : "○ OFF (Recommended)"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div
                      onClick={() => canManageSecurity && handleChange('dev_portal_switcher_enabled', false)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        !form.dev_portal_switcher_enabled
                          ? 'border-primary bg-primary/5 shadow-xs ring-1 ring-primary/30'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className="font-bold text-xs text-foreground">OFF (Production)</span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Hides demo test credential buttons on all portals. Staff authenticate using actual credentials.
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          !form.dev_portal_switcher_enabled ? 'border-primary bg-primary' : 'border-muted-foreground'
                        }`}>
                          {!form.dev_portal_switcher_enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>

                    <div
                      onClick={() => canManageSecurity && handleChange('dev_portal_switcher_enabled', true)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition-all ${
                        form.dev_portal_switcher_enabled
                          ? 'border-emerald-500 bg-emerald-500/5 shadow-xs ring-1 ring-emerald-500/30'
                          : 'border-border bg-card hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <span className="font-bold text-xs text-foreground">ON (Testing)</span>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            Enables 1-click test fill shortcuts for rapid system testing.
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                          form.dev_portal_switcher_enabled ? 'border-emerald-500 bg-emerald-500' : 'border-muted-foreground'
                        }`}>
                          {form.dev_portal_switcher_enabled && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Security Note */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 text-xs text-amber-700 dark:text-amber-300 flex items-start gap-2.5">
                  <Shield className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                  <div>
                    <span className="font-semibold block">Security & Role Isolation:</span>
                    These settings control visual login form components. System security is strictly enforced at the database level: staff accounts cannot access any portal unauthorized regardless of UI selector configuration.
                  </div>
                </div>

                {/* Save Changes Button */}
                <div className="pt-2 flex justify-end">
                  <Button
                    type="button"
                    onClick={handleSaveSecurity}
                    disabled={isSavingSecurity || !canManageSecurity}
                    className="gradient-primary shadow-soft gap-2"
                  >
                    {isSavingSecurity ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving Settings...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        Save Login Page Settings
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Live Interactive Letterhead & Portal Header Preview (5 Cols on desktop) */}
        <div className="lg:col-span-5 sticky top-6 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-primary" />
              Real-Time Dynamic Preview
            </span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Live
            </span>
          </div>

          {/* 1. Official Letterhead Mockup */}
          <div className="glass rounded-2xl p-5 border border-border/70 shadow-premium relative overflow-hidden bg-card/80">
            <div className="border-b-2 border-primary/20 pb-4 mb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center shrink-0 shadow-soft overflow-hidden">
                  {form.hospital_logo ? (
                    <img src={form.hospital_logo} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Building2 className="w-6 h-6 text-white" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-heading font-extrabold text-base text-foreground leading-tight truncate">
                    {form.hospital_name || 'Hospital Name'}
                  </h3>
                  <p className="text-[11px] text-primary font-medium truncate">
                    {form.hospital_tagline || 'Advanced Healthcare Center'}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    Licence: {form.accreditation_number || 'N/A'}
                  </p>
                </div>
              </div>
            </div>

            {/* Letterhead contact strip */}
            <div className="space-y-1.5 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2 truncate">
                <MapPin className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate">{form.address || 'Address'}, {form.city || 'City'}, {form.country || 'Country'}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <Phone className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                <span>{form.phone || 'Phone'} · Alt: {form.alt_phone || 'Alt Phone'}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <Mail className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">{form.email || 'Email'} · {form.website || 'Website'}</span>
              </div>
              <div className="flex items-center gap-2 truncate">
                <Clock className="w-3.5 h-3.5 text-purple-500 shrink-0" />
                <span className="truncate">{form.working_hours || '24/7 Hours'}</span>
              </div>
            </div>

            {/* Emergency badge */}
            <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[11px]">
              <span className="font-bold text-destructive flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> Emergency 24/7:
              </span>
              <span className="font-mono font-bold text-foreground">
                {form.emergency_phone || '+251 11 612 9999'}
              </span>
            </div>
          </div>

          {/* 2. Top Portal Header Representation */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/20 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
              Top Bar Appearance:
            </span>
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-card border border-border/50 shadow-xs">
              <div className="w-7 h-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 overflow-hidden">
                {form.hospital_logo ? (
                  <img src={form.hospital_logo} alt="Logo" className="w-full h-full object-contain p-0.5" />
                ) : (
                  <Building2 className="w-3.5 h-3.5 text-primary" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold leading-tight text-foreground truncate">
                  {form.hospital_name || 'Hospital Name'}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-primary/10 text-primary uppercase">
                    Admin Portal
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Help box */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Centralized Architecture
            </p>
            When you click &quot;Save Changes&quot;, all active portals (Doctor, Reception, Nurse, Laboratory, and Billing) update immediately in real-time. Pharmacy remains independent under its own branding.
          </div>
        </div>
      </div>
    </div>
  );
}
