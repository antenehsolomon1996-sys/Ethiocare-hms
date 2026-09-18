import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useDoctorContext } from '@/lib/DoctorContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Stethoscope, User, Mail, Award, Clock, ShieldCheck, CheckCircle2, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function DoctorProfile() {
  const { user } = useAuth();
  const { selectedDoctor, updateDoctorAvailability } = useDoctorContext();

  const [availability, setAvailability] = useState(selectedDoctor?.availability || 'available');

  React.useEffect(() => {
    if (selectedDoctor?.availability) {
      setAvailability(selectedDoctor.availability);
    }
  }, [selectedDoctor?.availability]);

  const handleAvailabilityChange = async (newStatus) => {
    setAvailability(newStatus);
    if (updateDoctorAvailability) {
      await updateDoctorAvailability(newStatus);
    }
    toast.success(`Availability status updated to ${newStatus.toUpperCase()}`);
  };

  const doctorName = selectedDoctor?.full_name || user?.full_name || 'Dr. Selamawit Tadesse';
  const specialty = selectedDoctor?.specialty || 'Internal Medicine';
  const department = selectedDoctor?.department || 'Internal Medicine';
  const doctorType = selectedDoctor?.doctor_type || 'Consultant Physician';
  const licenseNumber = selectedDoctor?.license_number || 'EFDA-MED-2024-0492';
  const email = selectedDoctor?.email || user?.email || 'dr.selamawit@grandhorizonhospital.com';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
            <User className="w-6 h-6 text-primary" />
            Physician Profile & Credentials
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your clinical identification, department assignments, and live consultation availability.
          </p>
        </div>
      </div>

      {/* Main Profile Card */}
      <Card className="border-border/60 shadow-card">
        <CardHeader className="pb-4 border-b border-border/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-white shadow-soft">
                <Stethoscope className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold">{doctorName}</CardTitle>
                <p className="text-sm text-primary font-medium">{doctorType} · {specialty}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{department} Department</p>
              </div>
            </div>

            {/* Availability Toggle */}
            <div className="space-y-1.5 sm:text-right">
              <p className="text-xs font-semibold text-muted-foreground">Current Duty Status:</p>
              <div className="flex gap-1.5">
                {[
                  { id: 'available', label: 'Available', color: 'bg-emerald-500 text-white' },
                  { id: 'busy', label: 'In Consultation', color: 'bg-amber-500 text-white' },
                  { id: 'off_duty', label: 'Off Duty', color: 'bg-neutral-500 text-white' }
                ].map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleAvailabilityChange(s.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      availability === s.id
                        ? `${s.color} shadow-xs`
                        : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Credentials Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="p-3.5 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-primary" /> License Number
              </span>
              <p className="text-sm font-bold font-mono text-foreground">{licenseNumber}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                <Award className="w-4 h-4 text-amber-500" /> Clinical Department
              </span>
              <p className="text-sm font-bold text-foreground">{department}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                <Mail className="w-4 h-4 text-sky-500" /> Hospital Email
              </span>
              <p className="text-sm font-bold text-foreground">{email}</p>
            </div>
            <div className="p-3.5 rounded-xl bg-muted/40 space-y-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-emerald-500" /> Shift Coverage
              </span>
              <p className="text-sm font-bold text-foreground">OPD & Inpatient Consultation</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 text-xs text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground flex items-center gap-1.5 mb-1">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Verified Medical Staff Account
            </p>
            Your physician account is authorized for clinical prescription signing, lab order generation, and diagnostic decision support.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
