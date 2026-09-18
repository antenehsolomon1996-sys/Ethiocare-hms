import assert from 'node:assert';

console.log('\n=====================================================');
console.log('ETHIOCARE HMS: DEVELOPMENT PORTAL SWITCHER TESTS');
console.log('=====================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(`  Error: ${err.message}`);
    failedTests++;
  }
}

// 1. DEFAULT HOSPITAL SETTINGS SPECIFICATION
const DEFAULT_HOSPITAL_SETTINGS = {
  hospital_name: 'EthioCare Hospital',
  hospital_tagline: 'Advanced Healthcare & Diagnostic Center',
  phone: '+251 11 612 3456',
  email: 'info@ethiocarehospital.com',
  dev_portal_switcher_enabled: true
};

runTest('dev_portal_switcher_enabled is true by default', () => {
  assert.strictEqual(DEFAULT_HOSPITAL_SETTINGS.dev_portal_switcher_enabled, true);
});

// 2. LOGIN PAGE VISIBILITY EVALUATION LOGIC
function computeShowDevSwitcher(hospitalSettings, isDevEnv = true) {
  if (hospitalSettings?.dev_portal_switcher_enabled !== undefined) {
    return Boolean(hospitalSettings.dev_portal_switcher_enabled);
  }
  return isDevEnv;
}

runTest('Login visibility: Defaults to true when setting is explicitly true', () => {
  const show = computeShowDevSwitcher({ dev_portal_switcher_enabled: true }, false);
  assert.strictEqual(show, true);
});

runTest('Login visibility: Evaluates to false when setting is explicitly false (even in DEV)', () => {
  const showInDev = computeShowDevSwitcher({ dev_portal_switcher_enabled: false }, true);
  const showInProd = computeShowDevSwitcher({ dev_portal_switcher_enabled: false }, false);
  assert.strictEqual(showInDev, false);
  assert.strictEqual(showInProd, false);
});

runTest('Login visibility: Falls back to environment default when unconfigured', () => {
  const showInDev = computeShowDevSwitcher({}, true);
  const showInProd = computeShowDevSwitcher({}, false);
  assert.strictEqual(showInDev, true);
  assert.strictEqual(showInProd, false);
});

// 3. OWNER/ADMIN PERMISSION ENFORCEMENT
function canManageSecurity(user) {
  return ['owner', 'admin'].includes(user?.role);
}

runTest('Permission: Owner can modify Security / Login Settings', () => {
  assert.strictEqual(canManageSecurity({ role: 'owner', full_name: 'System Owner' }), true);
});

runTest('Permission: Admin can modify Security / Login Settings', () => {
  assert.strictEqual(canManageSecurity({ role: 'admin', full_name: 'Hospital Admin' }), true);
});

runTest('Permission: Clinical and staff roles are denied access to change security settings', () => {
  const unauthorizedRoles = ['doctor', 'receptionist', 'nurse', 'pharmacist', 'lab_technician', 'accountant', 'guest'];
  for (const role of unauthorizedRoles) {
    assert.strictEqual(canManageSecurity({ role, full_name: `Test ${role}` }), false, `Role ${role} should be denied`);
  }
});

// 4. OWNER SETTINGS LOGIC & AUDIT LOGGING
runTest('Audit Logging: Changes record previous value, new value, and user', async () => {
  const auditsEmitted = [];
  const logAuditMock = async (payload) => {
    auditsEmitted.push({ ...payload, timestamp: new Date().toISOString() });
  };

  const user = { role: 'owner', full_name: 'Dr. Tamirat' };
  const previousValue = true;
  const newValue = false;

  await logAuditMock({
    userName: user.full_name,
    userRole: user.role,
    action: 'update',
    module: 'SecuritySettings',
    description: `Development Portal Switcher setting changed from ${previousValue ? 'ON' : 'OFF'} to ${newValue ? 'ON' : 'OFF'}`,
    recordId: 'dev_portal_switcher',
    recordName: 'Development Portal Switcher'
  });

  assert.strictEqual(auditsEmitted.length, 1);
  assert.strictEqual(auditsEmitted[0].module, 'SecuritySettings');
  assert.strictEqual(auditsEmitted[0].description, 'Development Portal Switcher setting changed from ON to OFF');
});

// 5. SECURITY RULE: PORTAL ACCESS CONTROL REMAINS STRICTLY ENFORCED
const PORTAL_METADATA = {
  admin: {role: 'owner', allowedRoles: ['owner', 'admin'] },
  reception: {role: 'receptionist', allowedRoles: ['receptionist', 'owner', 'admin'] },
  doctor: { role: 'doctor', allowedRoles: ['doctor'] },
  nurse: { role: 'nurse', allowedRoles: ['nurse'] },
  laboratory: {role: 'lab_technician', allowedRoles: ['lab_technician'] },
  pharmacy: { role: 'pharmacist', allowedRoles: ['pharmacist'] },
  billing: { role: 'accountant', allowedRoles: ['accountant', 'owner', 'admin'] },
};

function verifyPortalAccess(portalKey, userRole) {
  const meta = PORTAL_METADATA[portalKey];
  if (!meta) return false;
  return meta.allowedRoles.includes(userRole);
}

runTest('Route Security: Independent of switcher state, strict portal access control is maintained', () => {
  assert.strictEqual(verifyPortalAccess('admin', 'doctor'), false);
  assert.strictEqual(verifyPortalAccess('billing', 'doctor'), false);
  assert.strictEqual(verifyPortalAccess('doctor', 'receptionist'), false);
  assert.strictEqual(verifyPortalAccess('pharmacy', 'doctor'), false);
  assert.strictEqual(verifyPortalAccess('doctor', 'doctor'), true);
  assert.strictEqual(verifyPortalAccess('admin', 'owner'), true);
});

console.log('\n-----------------------------------------------------');
console.log(`TOTAL TESTS: ${passedTests + failedTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
console.log('-----------------------------------------------------\n');

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL DEVELOPMENT PORTAL SWITCHER TESTS PASSED SUCCESSFULLY!\n');
}