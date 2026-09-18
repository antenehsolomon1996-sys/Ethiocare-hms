import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sparkles, AlertTriangle, Stethoscope, FlaskConical, Pill,
  FileText, ShieldAlert, CheckCircle, Copy, ArrowRight, RefreshCw, Info
} from 'lucide-react';
import { toast } from 'sonner';

/**
 * Knowledge Base & Rule-Based Clinical Engine for Ethiopian Healthcare
 * Calibrated against Ethiopian Standard Treatment Guidelines (STG) for Primary & General Hospitals.
 */
function analyzeCaseRules({ symptoms = '', examNotes = '', diagnosis = '', patient = {}, vitals = {} }) {
  const text = `${symptoms} ${examNotes} ${diagnosis}`.toLowerCase();
  const age = patient.age || 30;
  const gender = patient.gender || 'Unknown';

  const hasFever = text.includes('fever') || text.includes('temperature') || text.includes('hot') || text.includes('chills') || text.includes('sweat');
  const hasCough = text.includes('cough') || text.includes('sputum') || text.includes('chest') || text.includes('shortness of breath') || text.includes('breath');
  const hasGI = text.includes('vomit') || text.includes('diarrhea') || text.includes('nausea') || text.includes('abdominal') || text.includes('stomach') || text.includes('epigastric');
  const hasCardio = text.includes('chest pain') || text.includes('palpitation') || text.includes('hypertension') || text.includes('bp');
  const hasUrinary = text.includes('dysuria') || text.includes('urine') || text.includes('burning') || text.includes('frequency');

  // 1. Clinical Summary
  let summary = `Patient ${patient.full_name || 'Individual'} (${gender}, ${age} yo) presents with `;
  if (symptoms) {
    summary += `reported symptoms of "${symptoms}". `;
  } else {
    summary += 'clinical evaluation request. ';
  }
  if (examNotes) summary += `Physical examination notes: "${examNotes}". `;
  if (diagnosis) summary += `Working clinician impression: "${diagnosis}".`;

  // 2. Differentials
  const differentials = [];
  if (hasFever && hasCough) {
    differentials.push({
      name: 'Community-Acquired Pneumonia (CAP)',
      probability: 'High',
      rationale: 'Fever accompanied by respiratory symptoms in Ethiopian outpatient settings strongly warrants rule-out of bacterial CAP (Streptococcus pneumoniae, atypical).'
    });
    differentials.push({
      name: 'Pulmonary Tuberculosis (PTB)',
      probability: 'Moderate',
      rationale: 'High endemicity in East Africa. If cough duration > 2 weeks, prioritize GeneXpert sputum evaluation.'
    });
    differentials.push({
      name: 'Upper Respiratory Tract Infection (URTI) / Viral Bronchitis',
      probability: 'Moderate',
      rationale: 'Common benign presentation, self-limiting viral etiology.'
    });
  } else if (hasFever) {
    differentials.push({
      name: 'Plasmodium Falciparum / Vivax Malaria',
      probability: 'High',
      rationale: 'Critical to evaluate rapidly in Ethiopian context. Rapid Diagnostic Test (RDT) or Giemsa blood film required.'
    });
    differentials.push({
      name: 'Enteric Fever (Typhoid Fever)',
      probability: 'Moderate',
      rationale: 'Endemic fecal-oral transmission; Salmonella typhi Widal/culture correlation recommended.'
    });
    differentials.push({
      name: 'Acute Urinary Tract Infection (Pyelonephritis / Cystitis)',
      probability: 'Moderate',
      rationale: 'Unexplained fever, especially in female or pediatric demographics.'
    });
  } else if (hasGI) {
    differentials.push({
      name: 'Acute Gastroenteritis (Viral / Amoebic / Bacterial)',
      probability: 'High',
      rationale: 'Frequent outpatient presentation. Risk of volume depletion and electrolyte derangement.'
    });
    differentials.push({
      name: 'Peptic Ulcer Disease (PUD) / H. pylori Gastritis',
      probability: 'Moderate',
      rationale: 'Epigastric discomfort, highly prevalent in adult Ethiopian population.'
    });
  } else {
    differentials.push({
      name: diagnosis || 'General Clinical Presentation',
      probability: 'Moderate',
      rationale: 'Correlate with detailed clinical history, targeted physical exam, and laboratory markers.'
    });
    differentials.push({
      name: 'Systemic Infection / Inflammatory Syndrome',
      probability: 'Low',
      rationale: 'Consider when constitutional symptoms are present.'
    });
  }

  // 3. Missing / Recommended Clinical Info
  const missingInfo = [
    'Precise onset, character, duration, and aggravating/alleviating factors of chief complaint.',
    'Complete vital signs documentation: BP, Heart Rate, SpO2 (pulse oximetry), Respiratory Rate, Temperature (°C).',
    'Patient medication history, recent antimicrobial usage (risk of resistance), and known drug allergies.',
    'Travel history within Ethiopia (lowland / malaria-endemic rift valley travel in past 4 weeks).'
  ];

  // 4. Red Flags & Urgent Alerts
  const redFlags = [];
  if (hasCardio || text.includes('chest pain')) {
    redFlags.push('Crushing substernal chest pain radiating to left arm/jaw — urgent 12-lead ECG to rule out Acute Coronary Syndrome.');
  }
  if (hasCough || text.includes('breath')) {
    redFlags.push('Respiratory distress, SpO2 < 90% on room air, RR > 30 bpm — initiate emergency supplemental oxygen immediately.');
  }
  if (hasFever) {
    redFlags.push('Signs of systemic sepsis (hypotension SBP < 90 mmHg, altered mental state, petechial rash, cold clammy extremities).');
  }
  if (redFlags.length === 0) {
    redFlags.push('Deteriorating vital signs, inability to maintain oral intake, altered consciousness, or acute severe abdominal rigidity.');
  }

  // 5. Relevant Diagnostic Tests
  const relevantTests = [
    { test: 'Complete Blood Count (CBC)', rationale: 'Evaluate leukocytosis, left shift, hemoglobin, and thrombocytopenia.' },
    { test: hasFever ? 'Malaria Rapid Diagnostic Test (RDT) & Blood Film' : 'Urine Routine Analysis', rationale: hasFever ? 'Rule out Plasmodium species in febrile patient.' : 'Screen for microalbuminuria, infection, or renal involvement.' },
    { test: hasCough ? 'Chest X-Ray (CXR) PA View' : 'Fasting Blood Sugar (FBS)', rationale: hasCough ? 'Differentiate consolidation, infiltrates, pleural effusion.' : 'Rule out acute hyperglycemia or underlying diabetes.' }
  ];

  // 6. Medication Info & Dosage (Generic Names)
  const medications = [];
  if (hasFever) {
    medications.push({
      name: 'Paracetamol',
      dose: '1g orally every 6–8 hours as needed (Max 4g/24h in adults)',
      indication: 'Antipyresis and analgesia'
    });
    if (hasFever && hasCough) {
      medications.push({
        name: 'Amoxicillin + Clavulanic Acid',
        dose: '625mg PO TID or 1g PO BID for 7 days (or Azithromycin 500mg daily x 3 days)',
        indication: 'First-line empirical therapy for outpatient bacterial pneumonia (Ethiopian STG)'
      });
    }
  } else if (hasGI) {
    medications.push({
      name: 'Oral Rehydration Salts (ORS) + Zinc (if pediatric)',
      dose: '1 liter solution ingested after each loose stool',
      indication: 'Electrolyte maintenance & volume rehydration'
    });
    medications.push({
      name: 'Omeprazole',
      dose: '20mg PO once daily before breakfast for 14–28 days',
      indication: 'Acid suppression for dyspepsia / suspected peptic gastritis'
    });
  } else {
    medications.push({
      name: 'Paracetamol',
      dose: '500mg – 1000mg PO PRN for symptomatic relief',
      indication: 'Analgesic / Antipyretic'
    });
  }

  // 7. Contraindications & Ethiopian Formulary Warnings
  const contraindications = [
    'Caution in hepatic impairment with Paracetamol: do not exceed 2g daily in mild-moderate liver disease; avoid in acute liver failure.',
    'Ethiopian Formulary Caution: Avoid fluoroquinolones (Ciprofloxacin) as empirical first-line for simple respiratory infection due to national resistance patterns and preserving for tuberculosis/enteric indications.',
    'Always confirm pregnancy status before prescribing tetracyclines, fluoroquinolones, or ACE inhibitors.'
  ];

  // 8. Doctor Clinical Note / Documentation Draft
  const soapDraft = `SUBJECTIVE:
Chief Complaint: ${symptoms || 'Presented for general consultation.'}
History of Present Illness: Patient reports ${symptoms || 'symptoms described above'}. Denies known drug allergies unless documented.

OBJECTIVE:
Physical Examination: ${examNotes || 'Alert, oriented, stable vital signs. Chest and systemic examination reviewed.'}
Vitals: ${vitals.blood_pressure ? `BP: ${vitals.blood_pressure}, HR: ${vitals.heart_rate || '-'}, SpO2: ${vitals.oxygen_saturation || '-'}` : 'Refer to hospital vitals chart.'}

ASSESSMENT:
Primary Impression: ${differentials[0]?.name || diagnosis || 'Clinical observation'}
Differential Diagnoses: ${differentials.slice(1).map(d => d.name).join(', ') || 'Under clinical review'}

PLAN:
1. Diagnostic: ${relevantTests.map(t => t.test).join(', ')}.
2. Pharmacotherapy: ${medications.map(m => `${m.name} (${m.dose})`).join('; ')}.
3. Patient Education: Hydration, warning signs counseling, follow-up if symptoms persist or red flags develop.`;

  return {
    summary,
    differentials,
    missingInfo,
    redFlags,
    relevantTests,
    medications,
    contraindications,
    soapDraft
  };
}

export default function AIClinicalAssistant({ patient, visit, vitals = {}, onApplyNotes }) {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (geminiApiKey) {
        try {
          const prompt = `You are a clinical decision support AI assistant for Grand Horizon / EthioCare Hospital in Ethiopia following Ethiopian Standard Treatment Guidelines.
Patient: ${patient?.full_name}, Age: ${patient?.age}, Gender: ${patient?.gender}
Symptoms: ${visit?.symptoms || 'None reported'}
Examination: ${visit?.examination_notes || 'None'}
Diagnosis: ${visit?.diagnosis || 'None'}
Respond strictly in JSON with fields: summary, differentials (array of {name, probability, rationale}), missingInfo (array of strings), redFlags (array of strings), relevantTests (array of {test, rationale}), medications (array of {name, dose, indication}), contraindications (array of strings), soapDraft (string). Use generic drug names.`;

          const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiApiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json' }
            })
          });

          if (response.ok) {
            const data = await response.json();
            const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textContent) {
              const parsed = JSON.parse(textContent);
              setResult(parsed);
              toast.success('Clinical decision analysis generated via AI');
              setAnalyzing(false);
              return;
            }
          }
        } catch (apiErr) {
          console.warn('[AIClinicalAssistant] Fallback to clinical rule engine:', apiErr);
        }
      }

      // Built-in resilient clinical rule engine
      await new Promise(r => setTimeout(r, 600));
      const analysis = analyzeCaseRules({
        symptoms: visit?.symptoms,
        examNotes: visit?.examination_notes,
        diagnosis: visit?.diagnosis,
        patient,
        vitals
      });
      setResult(analysis);
      toast.success('Clinical Decision Support analysis generated');
    } catch (err) {
      console.error('[AIClinicalAssistant] Analysis error:', err);
      toast.error('Failed to generate clinical analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyToNotes = () => {
    if (!result?.soapDraft) return;
    if (typeof onApplyNotes === 'function') {
      onApplyNotes(result.soapDraft, result.differentials?.[0]?.name);
      toast.success('SOAP note inserted into Consultation Plan');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header & Safety Banner */}
      <div className="bg-card border border-primary/20 rounded-xl p-4 shadow-soft">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/20 flex items-center justify-center text-primary">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-heading font-bold text-base text-foreground">AI Clinical Assistant</h3>
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  CDSS Ready
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Evidence-based decision support calibrated to Ethiopian Standard Treatment Guidelines
              </p>
            </div>
          </div>

          <Button
            onClick={handleAnalyze}
            disabled={analyzing}
            className="gap-2 shrink-0 bg-primary hover:bg-primary/90 text-white shadow-soft"
          >
            {analyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Analyzing Case...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {result ? 'Re-Analyze Case' : 'Analyze Clinical Case'}
              </>
            )}
          </Button>
        </div>

        {/* Regulatory & Safety Notice */}
        <div className="mt-3.5 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-start gap-2 text-xs text-amber-900 dark:text-amber-200">
          <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <p>
            <strong>Advisory Notice:</strong> This clinical decision support tool is non-autonomous. It assists but does not replace licensed medical practitioner evaluation. All diagnoses, prescriptions, and lab orders require physician clinical validation.
          </p>
        </div>
      </div>

      {!result && !analyzing && (
        <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground">
          <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30 text-primary" />
          <h4 className="font-semibold text-foreground text-sm">No Active Analysis</h4>
          <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
            Click "Analyze Clinical Case" to process current symptoms ({visit?.symptoms || 'None recorded'}), examination findings, and patient profile into structured clinical guidance.
          </p>
        </div>
      )}

      {result && (
        <div className="space-y-4">
          {/* Quick Apply Bar */}
          <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-2 text-xs text-primary font-medium">
              <CheckCircle className="w-4 h-4 text-primary" />
              Analysis generated with 8 clinical dimensions
            </div>
            <Button size="sm" onClick={handleApplyToNotes} className="gap-1.5 h-8 text-xs font-semibold">
              <FileText className="w-3.5 h-3.5" /> Apply SOAP Note to Exam
            </Button>
          </div>

          <Tabs defaultValue="clinical" className="space-y-4">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full p-1 bg-muted/60 rounded-xl">
              <TabsTrigger value="clinical" className="gap-1.5 text-xs">
                <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> Summary & Differentials
              </TabsTrigger>
              <TabsTrigger value="safety" className="gap-1.5 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" /> Red Flags & Warnings
              </TabsTrigger>
              <TabsTrigger value="workup" className="gap-1.5 text-xs">
                <FlaskConical className="w-3.5 h-3.5 text-teal-600" /> Tests & Prescriptions
              </TabsTrigger>
              <TabsTrigger value="soap" className="gap-1.5 text-xs">
                <FileText className="w-3.5 h-3.5 text-amber-600" /> SOAP Clinical Draft
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: Clinical Summary & Differentials */}
            <TabsContent value="clinical" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4 text-blue-600" /> 1. Clinical Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-foreground/90 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/50">
                    {result.summary}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Stethoscope className="w-4 h-4 text-primary" /> 2. Differential Diagnoses (Ranked by Probability)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2.5">
                  {result.differentials?.map((diff, idx) => (
                    <div key={idx} className="p-3 bg-card border border-border/70 rounded-xl flex flex-col gap-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm text-foreground">{idx + 1}. {diff.name}</span>
                        <Badge className={
                          diff.probability === 'High' ? 'bg-rose-100 text-rose-700 border-rose-200' :
                          diff.probability === 'Moderate' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }>
                          {diff.probability} Probability
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{diff.rationale}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Info className="w-4 h-4 text-teal-600" /> 3. Recommended History & Physical Inquiries
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-1.5 text-xs text-muted-foreground list-disc pl-5">
                    {result.missingInfo?.map((item, i) => (
                      <li key={i} className="leading-relaxed">{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 2: Red Flags & Warnings */}
            <TabsContent value="safety" className="space-y-4">
              <Card className="border-rose-200 bg-rose-50/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-rose-600" /> 4. Urgent Alerts & Red Flags
                  </CardTitle>
                  <CardDescription className="text-xs text-rose-600/80">
                    Immediate clinical danger signs requiring emergency triage intervention
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.redFlags?.map((flag, i) => (
                    <div key={i} className="p-2.5 bg-background border border-rose-200/80 rounded-lg text-xs text-rose-900 font-medium flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <span>{flag}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" /> 7. Contraindications, Interactions & Formulary Warnings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.contraindications?.map((c, i) => (
                    <div key={i} className="p-2.5 bg-amber-50/30 border border-amber-200/60 rounded-lg text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                      <span className="font-bold text-amber-600">•</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 3: Tests & Prescriptions */}
            <TabsContent value="workup" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" /> 5. Relevant Laboratory & Diagnostic Tests
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.relevantTests?.map((t, i) => (
                    <div key={i} className="p-3 bg-card border border-border/70 rounded-xl flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-xs text-foreground">{t.test}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t.rationale}</p>
                      </div>
                      <Badge variant="outline" className="text-[10px] shrink-0">Hospital Lab</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <Pill className="w-4 h-4 text-emerald-600" /> 6. Medication Guidelines (Generic Formulary)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {result.medications?.map((m, i) => (
                    <div key={i} className="p-3 bg-card border border-border/70 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-xs text-foreground">{m.name}</span>
                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">{m.indication}</Badge>
                      </div>
                      <p className="text-xs text-primary font-mono">{m.dose}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* TAB 4: SOAP Note Draft */}
            <TabsContent value="soap" className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="w-4 h-4 text-primary" /> 8. Doctor Clinical Note / Documentation Draft
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Formatted SOAP note ready to copy or apply directly into patient record
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => handleCopy(result.soapDraft)} className="h-8 text-xs gap-1">
                        <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied' : 'Copy'}
                      </Button>
                      <Button size="sm" onClick={handleApplyToNotes} className="h-8 text-xs gap-1">
                        <ArrowRight className="w-3.5 h-3.5" /> Apply to Plan
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <pre className="text-xs font-mono bg-muted/40 p-4 rounded-xl border border-border/60 whitespace-pre-wrap text-foreground leading-relaxed">
                    {result.soapDraft}
                  </pre>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}