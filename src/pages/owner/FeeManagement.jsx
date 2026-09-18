import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CreditCard, Activity, FlaskConical, Pill, ShieldCheck, DollarSign, Save, CheckCircle2, Clock } from 'lucide-react';
import ServiceFeesTab from '@/components/fees/ServiceFeesTab';
import MedicineFeesTab from '@/components/fees/MedicineFeesTab';
import LabTestFeesTab from '@/components/fees/LabTestFeesTab';
import StatCard from '@/components/common/StatCard';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { patientFeeService } from '@/services/patientFee.service';

export default function FeeManagement() {
  const queryClient = useQueryClient();
  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => base44.entities.Service.list()
  });

  const { data: labTests = [] } = useQuery({
    queryKey: ['labTests'],
    queryFn: () => base44.entities.LabTest.list()
  });

  const { data: medicines = [] } = useQuery({
    queryKey: ['medicines'],
    queryFn: () => base44.entities.Medicine.list()
  });

  const tariffs = patientFeeService.getRegistrationTariffs(services);
  const [newFee, setNewFee] = useState('');
  const [recentFee, setRecentFee] = useState('');
  const [savingTariffs, setSavingTariffs] = useState(false);

  useEffect(() => {
    setNewFee(String(tariffs.newPatientFee));
    setRecentFee(String(tariffs.recentPatientFee));
  }, [tariffs.newPatientFee, tariffs.recentPatientFee]);

  const handleSaveTariffs = async () => {
    const n = parseFloat(newFee);
    const r = parseFloat(recentFee);
    if (isNaN(n) || n < 0 || isNaN(r) || r < 0) {
      toast.error('Please enter valid positive fee amounts');
      return;
    }
    setSavingTariffs(true);
    try {
      await patientFeeService.updateTariffs(n, r);
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('Registration & 30-Day Revisit Tariffs successfully updated!');
    } catch (err) {
      toast.error(err.message || 'Failed to update registration tariffs');
    } finally {
      setSavingTariffs(false);
    }
  };

  const activeServices = services.filter(s => s.status === 'active').length;
  const activeLabTests = labTests.filter(t => t.status === 'active').length;
  const activeMeds = medicines.filter(m => m.status !== 'out_of_stock' && m.status !== 'expired').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-heading">Fee & Tariff Management</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> Owner Controlled
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Centralized hospital pricing authority. Configured tariffs automatically propagate to Reception, Doctor, Lab, Pharmacy, and Billing portals.
          </p>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Active Services"
          value={activeServices}
          subtitle={`${services.length} total services`}
          icon={CreditCard}
          color="blue"
        />
        <StatCard
          title="Active Lab Tests"
          value={activeLabTests}
          subtitle={`${labTests.length} configured tests`}
          icon={FlaskConical}
          color="teal"
        />
        <StatCard
          title="Medicine Catalog"
          value={activeMeds}
          subtitle={`${medicines.length} total medicines`}
          icon={Pill}
          color="green"
        />
        <StatCard
          title="Pricing Modules"
          value="4"
          subtitle="Reg, Nurse, Lab, Rx"
          icon={DollarSign}
          color="amber"
        />
      </div>

      <Tabs defaultValue="registration" className="space-y-6">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full md:w-auto p-1 bg-muted/60 rounded-xl">
          <TabsTrigger value="registration" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="w-4 h-4 text-blue-600" /> Registration & Consult
          </TabsTrigger>
          <TabsTrigger value="nursing" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Activity className="w-4 h-4 text-pink-600" /> Nursing & Procedures
          </TabsTrigger>
          <TabsTrigger value="lab" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <FlaskConical className="w-4 h-4 text-teal-600" /> Laboratory Tests
          </TabsTrigger>
          <TabsTrigger value="medicines" className="gap-2 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Pill className="w-4 h-4 text-emerald-600" /> Pharmacy Catalog
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registration" className="space-y-4">
          {/* Owner 30-Day Policy Card */}
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-primary" />
                    30-Day Treatment Registration Fee Policy
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    System automates patient tier classification based on treatment history. Patients treated within 30 days receive the Revisit rate; new or &gt;30-day patients receive the New Patient rate.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/10 text-[11px] gap-1 hidden sm:flex">
                  <CheckCircle2 className="w-3 h-3" /> Auto-Enforced at Reception
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                <div>
                  <Label className="text-xs font-medium text-foreground">
                    New Patient Registration Fee (ETB)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={newFee}
                      onChange={(e) => setNewFee(e.target.value)}
                      placeholder="150.00"
                      className="pr-12 font-semibold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">ETB</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">First-time patients &amp; visits after &gt;30 days</p>
                </div>

                <div>
                  <Label className="text-xs font-medium text-foreground">
                    Recent Patient Revisit Fee (≤30 Days) (ETB)
                  </Label>
                  <div className="relative mt-1">
                    <Input
                      type="number"
                      min="0"
                      step="5"
                      value={recentFee}
                      onChange={(e) => setRecentFee(e.target.value)}
                      placeholder="100.00"
                      className="pr-12 font-semibold"
                    />
                    <span className="absolute right-3 top-2.5 text-xs text-muted-foreground font-medium">ETB</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">Automated discount for revisits within 30 days</p>
                </div>

                <div>
                  <Button
                    onClick={handleSaveTariffs}
                    disabled={savingTariffs}
                    className="w-full sm:w-auto min-w-[140px]"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {savingTariffs ? 'Saving...' : 'Update Policy Tariffs'}
                  </Button>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/80 mt-3 pt-2 border-t border-border/40">
                * Note: Pricing updates apply strictly to future patient visits and registrations. Historical billing and ledger records are never altered.
              </p>
            </CardContent>
          </Card>

          <ServiceFeesTab category="registration" title="Registration & Consultation Fees" />
        </TabsContent>

        <TabsContent value="nursing" className="space-y-4">
          <ServiceFeesTab category="nursing" title="Nursing & Clinical Procedure Fees" />
        </TabsContent>

        <TabsContent value="lab" className="space-y-4">
          <LabTestFeesTab />
        </TabsContent>

        <TabsContent value="medicines" className="space-y-4">
          <MedicineFeesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}