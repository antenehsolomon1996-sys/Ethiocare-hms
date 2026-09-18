import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function runRootCauseInvestigation() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - LIVE SUPABASE ROOT CAUSE INVESTIGATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // STEP 2 - Test unauthenticated state first
  console.log('\n--- STEP 2: VERIFY AUTH SESSION BEFORE LOGIN ---');
  let { data: { user: unauthUser } } = await supabase.auth.getUser();
  let { data: { session: unauthSession } } = await supabase.auth.getSession();
  console.log('Unauthenticated state:');
  console.log('  user:', unauthUser?.id || null);
  console.log('  session:', !!unauthSession);

  // Authenticate as Receptionist (Almaz)
  console.log('\nAuthenticating as Receptionist (almaz.t@grandhorizonhospital.com)...');
  const { data: authData, error: loginErr } = await supabase.auth.signInWithPassword({
    email: 'almaz.t@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });

  if (loginErr) {
    console.error('❌ Login failed:', loginErr);
    return;
  }

  // STEP 2 - Log exactly as requested
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log("PATIENT CREATE AUTH:", {
    userId: user?.id,
    email: user?.email,
    authError
  });

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  console.log("PATIENT CREATE SESSION:", {
    hasSession: !!session,
    userId: session?.user?.id,
    email: session?.user?.email,
    sessionError
  });

  // STEP 3 - Verify Database Profile
  console.log('\n--- STEP 3: VERIFY DATABASE PROFILE ---');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('id, email, role, status, full_name')
    .eq('id', user.id)
    .maybeSingle();

  console.log('Profile query result:', {
    profile,
    profileErr
  });

  // STEP 5 - Test Minimal Patient Insert with Real Authenticated User
  console.log('\n--- STEP 5: TEST DATABASE DIRECTLY WITH REAL AUTHENTICATED USER ---');
  const testPatientPayload = {
    patient_id: 'PT-LIVE-' + Date.now().toString().slice(-6),
    full_name: 'Abebe Bikila Live Test',
    gender: 'Male',
    age: 32,
    phone: '+251911002233',
    address: 'Addis Ababa, Kirkos Woreda 02',
    emergency_contact_name: 'Almaz Relative',
    emergency_contact_phone: '+251911998877',
    registration_date: new Date().toISOString().split('T')[0],
    status: 'active'
  };

  console.log('Attempting INSERT with payload:', testPatientPayload);
  const { data, error } = await supabase
    .from("patients")
    .insert(testPatientPayload)
    .select()
    .single();

  console.log("PATIENT INSERT RESULT:", {
    success: !error,
    dataId: data?.id,
    patient_id: data?.patient_id,
    error: error ? {
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint
    } : null
  });

  if (data) {
    console.log('\n--- STEP 13: VERIFY IN SUPABASE (SELECT LATEST PATIENTS) ---');
    const { data: latestPatients } = await supabase
      .from('patients')
      .select('id, patient_id, full_name, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    console.log('Latest 5 patients in public.patients:');
    console.log(JSON.stringify(latestPatients, null, 2));
  }

  // Also test Owner login and patient creation
  console.log('\n--- STEP 12A: TEST OWNER LOGIN & PATIENT CREATION ---');
  await supabase.auth.signOut();
  const { data: ownerAuth, error: ownerLoginErr } = await supabase.auth.signInWithPassword({
    email: 'admin@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });

  if (ownerLoginErr) {
    console.log('Owner login result:', ownerLoginErr.message);
  } else {
    console.log('✅ Owner logged in successfully! auth.uid():', ownerAuth.user?.id);
    const { data: ownerProfile } = await supabase
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', ownerAuth.user.id)
      .single();
    console.log('Owner Profile:', ownerProfile);

    const ownerPatientPayload = {
      patient_id: 'PT-OWNER-' + Date.now().toString().slice(-6),
      full_name: 'Owner Registered Patient',
      gender: 'Female',
      age: 45,
      phone: '+251911554433',
      registration_date: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    const { data: ownerPatient, error: ownerInsertErr } = await supabase
      .from('patients')
      .insert(ownerPatientPayload)
      .select()
      .single();

    console.log('Owner Patient Insert Result:', {
      success: !ownerInsertErr,
      id: ownerPatient?.id,
      patient_id: ownerPatient?.patient_id,
      error: ownerInsertErr
    });
  }

  // Also test Doctor login and patient creation
  console.log('\n--- STEP 12C: TEST DOCTOR LOGIN & PATIENT CREATION ---');
  await supabase.auth.signOut();
  const { data: docAuth, error: docLoginErr } = await supabase.auth.signInWithPassword({
    email: 'dr.selamawit@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });

  if (docLoginErr) {
    console.log('Doctor login result:', docLoginErr.message);
  } else {
    console.log('✅ Doctor logged in successfully! auth.uid():', docAuth.user?.id);
    const { data: docProfile } = await supabase
      .from('profiles')
      .select('id, email, role, status')
      .eq('id', docAuth.user.id)
      .single();
    console.log('Doctor Profile:', docProfile);

    const docPatientPayload = {
      patient_id: 'PT-DOC-' + Date.now().toString().slice(-6),
      full_name: 'Doctor Registered Patient',
      gender: 'Male',
      age: 50,
      phone: '+251911887766',
      registration_date: new Date().toISOString().split('T')[0],
      status: 'active'
    };

    const { data: docPatient, error: docInsertErr } = await supabase
      .from('patients')
      .insert(docPatientPayload)
      .select()
      .single();

    console.log('Doctor Patient Insert Result:', {
      success: !docInsertErr,
      id: docPatient?.id,
      patient_id: docPatient?.patient_id,
      error: docInsertErr
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('INVESTIGATION RUN COMPLETE');
  console.log('='.repeat(80));
}

runRootCauseInvestigation();
