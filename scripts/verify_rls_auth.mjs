import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

async function verifyAuthAndRLS() {
  console.log('='.repeat(80));
  console.log('ETHIOCARE HMS - LIVE SUPABASE AUTH & RLS VERIFICATION');
  console.log('Target: ' + SUPABASE_URL);
  console.log('='.repeat(80));

  // 1. Initialize client
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 2. Attempt login as Receptionist
  console.log('\n[STEP 1] Authenticating as Receptionist (almaz.t@grandhorizonhospital.com)...');
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'almaz.t@grandhorizonhospital.com',
    password: 'Hospital@2026'
  });

  if (authError) {
    console.log('❌ Login failed:', authError.message);
    console.log('\nNOTE: Run `supabase/migrations/20260916_fix_rls_policies.sql` in your Supabase SQL Editor to seed/confirm staff auth accounts.');
    return;
  }

  const user = authData.user;
  console.log('✅ Logged in successfully!');
  console.log('   auth.uid():', user.id);
  console.log('   email:', user.email);

  // 3. Inspect profiles.role for this authenticated user
  console.log('\n[STEP 2] Inspecting public.profiles record for auth.uid()...');
  const { data: profile, error: profileErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (profileErr) {
    console.log('⚠️ Error fetching profile:', profileErr.message);
  } else if (!profile) {
    console.log('⚠️ No profile row found with id = auth.uid()');
  } else {
    console.log('✅ Found profile record:');
    console.log('   id:', profile.id);
    console.log('   role:', profile.role);
    console.log('   full_name:', profile.full_name);
    console.log('   status:', profile.status);
  }

  // 4. Test INSERT on public.patients
  console.log('\n[STEP 3] Testing patient creation (INSERT into public.patients)...');
  const testPatientId = `PT-TEST-${Date.now().toString().slice(-6)}`;
  const { data: newPatient, error: insertErr } = await supabase
    .from('patients')
    .insert({
      patient_id: testPatientId,
      full_name: 'Test Reception Patient',
      gender: 'Female',
      age: 28,
      phone: '+251911998877',
      address: 'Bole Subcity, Woreda 04',
      emergency_contact_name: 'Contact Person',
      emergency_contact_phone: '+251922334455',
      registration_date: new Date().toISOString().split('T')[0],
      status: 'active'
    })
    .select()
    .single();

  if (insertErr) {
    console.log('❌ Patient INSERT failed with RLS error:', insertErr.code, insertErr.message);
    return;
  }

  console.log('✅ Patient INSERT succeeded!');
  console.log('   Created patient UUID:', newPatient.id);
  console.log('   Patient ID string:', newPatient.patient_id);
  console.log('   Full Name:', newPatient.full_name);

  // 5. Test SELECT on public.patients (Read back newly created patient)
  console.log('\n[STEP 4] Testing reading patient (SELECT from public.patients)...');
  const { data: fetchedPatient, error: selectErr } = await supabase
    .from('patients')
    .select('*')
    .eq('id', newPatient.id)
    .single();

  if (selectErr) {
    console.log('❌ Patient SELECT failed:', selectErr.message);
  } else {
    console.log('✅ Patient SELECT succeeded!');
    console.log('   Fetched Name:', fetchedPatient.full_name);
    console.log('   Created At:', fetchedPatient.created_at);
  }

  // 6. Test UPDATE on public.patients
  console.log('\n[STEP 5] Testing patient update (UPDATE on public.patients)...');
  const { data: updatedPatient, error: updateErr } = await supabase
    .from('patients')
    .update({ address: 'Updated Address Bole Woreda 05' })
    .eq('id', newPatient.id)
    .select()
    .single();

  if (updateErr) {
    console.log('❌ Patient UPDATE failed:', updateErr.message);
  } else {
    console.log('✅ Patient UPDATE succeeded!');
    console.log('   Updated Address:', updatedPatient.address);
  }

  // 7. Cleanup test patient
  console.log('\n[STEP 6] Cleaning up test patient...');
  const { error: delErr } = await supabase
    .from('patients')
    .delete()
    .eq('id', newPatient.id);

  if (delErr) {
    console.log('ℹ️ DELETE restricted for receptionist role (as intended by policy):', delErr.message);
  } else {
    console.log('✅ Test patient cleaned up.');
  }

  // 8. Sign out
  await supabase.auth.signOut();
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION COMPLETE');
  console.log('='.repeat(80));
}

verifyAuthAndRLS();
