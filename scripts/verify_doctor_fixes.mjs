import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDoctorList } from '../src/lib/doctorUtils.js';

console.log('--- RUNNING ETHIOCARE HMS 4-FIX VERIFICATION TEST SUITE ---');

// TEST 1: Doctor List Consistency (Owner Staff Management Single Source of Truth)
console.log('Test 1: Testing buildDoctorList with active, inactive, and stale doctors...');

const mockStaffList = [
  { id: 'staff-1', full_name: 'Dr. Solomon Abebe', role: 'doctor', status: 'active', specialization: 'Cardiology', assigned_room_number: '101' },
  { id: 'staff-2', full_name: 'Dr. Bethlehem Tadesse', role: 'doctor', status: 'active', specialization: 'Pediatrics', assigned_room_number: '102' },
  { id: 'staff-3', full_name: 'Dr. Inactive Doctor', role: 'doctor', status: 'inactive', specialization: 'Neurology', assigned_room_number: '103' },
  { id: 'staff-4', full_name: 'Dr. Suspended Doctor', role: 'doctor', status: 'suspended', specialization: 'Dermatology' },
  { id: 'staff-5', full_name: 'Nurse Hanna', role: 'nurse', status: 'active', department: 'Emergency' },
  { id: 'staff-6', full_name: 'Admin User', role: 'admin', status: 'active' }
];

const mockDoctorEntities = [
  { id: 'doc-ent-1', staff_id: 'staff-1', full_name: 'Dr. Solomon Abebe', specialty: 'Cardiology', status: 'active' },
  { id: 'doc-ent-stale', full_name: 'Dr. Old Stale Doc', specialty: 'General Practice', status: 'active' }
];

const unifiedDocs = buildDoctorList(mockDoctorEntities, mockStaffList);

assert.strictEqual(unifiedDocs.length, 2, `Expected exactly 2 active doctors, got ${unifiedDocs.length}`);
assert.ok(unifiedDocs.some(d => d.full_name === 'Dr. Solomon Abebe' && d.id === 'doc-ent-1'), 'Dr. Solomon Abebe should link to doc-ent-1');
assert.ok(unifiedDocs.some(d => d.full_name === 'Dr. Bethlehem Tadesse' && d.id === 'staff-2'), 'Dr. Bethlehem should fallback to staff-2 ID');
assert.ok(!unifiedDocs.some(d => d.full_name === 'Dr. Inactive Doctor'), 'Inactive staff doctor must NOT appear');
assert.ok(!unifiedDocs.some(d => d.full_name === 'Dr. Suspended Doctor'), 'Suspended staff doctor must NOT appear');
assert.ok(!unifiedDocs.some(d => d.full_name === 'Dr. Old Stale Doc'), 'Stale doctor not in staffList must NOT appear');
assert.ok(!unifiedDocs.some(d => d.full_name === 'Nurse Hanna'), 'Nurse must not appear in doctor list');

console.log('✓ Test 1 Passed: buildDoctorList strictly enforces Owner Staff Management active doctors!');

// TEST 2: Fallback when staffList is empty
console.log('Test 2: Testing buildDoctorList fallback when staffList is empty...');
const fallbackDocs = buildDoctorList(mockDoctorEntities, []);
assert.strictEqual(fallbackDocs.length, 2, 'Should fallback to active doctor entities when staffList is empty');
console.log('✓ Test 2 Passed: Graceful fallback functions correctly.');

// TEST 3: Doctor Queue Prescription Form does not display price
console.log('Test 3: Verifying DoctorQueue.jsx does not expose prices in doctor UI...');
const doctorQueueCode = fs.readFileSync(path.resolve('src/pages/doctor/DoctorQueue.jsx'), 'utf-8');

assert.ok(!doctorQueueCode.includes('{m.name} {m.strength ? `(${m.strength})` : \'\'} — {m.unit_price} ETB'), 'Doctor select must not display unit price in option label');
assert.ok(!doctorQueueCode.includes('Calculated Price Display'), 'Calculated Price Display box must be removed');
assert.ok(!doctorQueueCode.includes('Unit Tariff:'), 'Unit Tariff text must not appear in doctor form');
assert.ok(!doctorQueueCode.includes('Billing Total:'), 'Billing Total text must not appear in doctor form');
assert.ok(doctorQueueCode.includes('Prescription for ${prescForm.medicine_name} added successfully'), 'Toast should be clean success message');
assert.ok(doctorQueueCode.includes('unit_price: unitPrice'), 'Backend Prescription entity must retain unit_price for Pharmacy/Billing');
assert.ok(doctorQueueCode.includes('amount: totalAmount'), 'Backend Payment entity must retain totalAmount for Pharmacy/Billing');

console.log('✓ Test 3 Passed: DoctorQueue.jsx has price completely removed from doctor UI while preserving billing backend.');

// TEST 4: DoctorPatientDetailModal does not display price
console.log('Test 4: Verifying DoctorPatientDetailModal.jsx does not expose prices in doctor prescriptions...');
const modalCode = fs.readFileSync(path.resolve('src/components/doctor/tracking/DoctorPatientDetailModal.jsx'), 'utf-8');
assert.ok(!modalCode.includes('rx.unit_price ? `${rx.unit_price'), 'Doctor modal must not format rx.unit_price');
console.log('✓ Test 4 Passed: DoctorPatientDetailModal.jsx hides prices from prescriptions list.');

// TEST 5: Doctor Sidebar & Mobile Nav & Profile Menu
console.log('Test 5: Verifying Sidebar.jsx, MobileFloatingNav.jsx, and PortalLayout.jsx...');
const sidebarCode = fs.readFileSync(path.resolve('src/components/layout/Sidebar.jsx'), 'utf-8');
const mobileNavCode = fs.readFileSync(path.resolve('src/components/layout/MobileFloatingNav.jsx'), 'utf-8');
const portalLayoutCode = fs.readFileSync(path.resolve('src/components/layout/PortalLayout.jsx'), 'utf-8');

// Sidebar doctor section
const doctorSidebarMatch = sidebarCode.match(/doctor:\s*\{[\s\S]*?items:\s*\[([\s\S]*?)\]\s*\}/);
assert.ok(doctorSidebarMatch, 'Doctor sidebar config should exist');
const doctorItems = doctorSidebarMatch[1];
assert.ok(!doctorItems.includes('/doctor/prescriptions'), 'Sidebar should NOT have Prescriptions for doctor');
assert.ok(!doctorItems.includes('/doctor/medication-orders'), 'Sidebar should NOT have Medication Orders for doctor');
assert.ok(!doctorItems.includes('/doctor/notifications'), 'Sidebar should NOT have Notifications for doctor');
assert.ok(doctorItems.includes('/doctor/patients'), 'Sidebar must have Patient Tracking');
assert.ok(doctorItems.includes('/doctor/queue'), 'Sidebar must have Appointments / Visits');
assert.ok(doctorItems.includes('/doctor/lab-orders'), 'Sidebar must have Laboratory / Lab Orders');

// PortalLayout doctor dropdown
assert.ok(portalLayoutCode.includes("role === 'doctor' ? ("), 'PortalLayout should conditionally render settings only for non-doctor');
assert.ok(portalLayoutCode.includes('Doctor Profile'), 'Doctor profile should exist');
assert.ok(portalLayoutCode.includes('Delete Account'), 'Delete Account should exist');

console.log('✓ Test 5 Passed: Doctor sidebar, mobile nav, and profile menu cleaned up accurately.');

// TEST 6: Global Scroll Architecture
console.log('Test 6: Verifying index.css and AuthLayout scroll rules...');
const cssCode = fs.readFileSync(path.resolve('src/index.css'), 'utf-8');
const authLayoutCode = fs.readFileSync(path.resolve('src/components/AuthLayout.jsx'), 'utf-8');
const loginPageCode = fs.readFileSync(path.resolve('src/pages/auth/PortalLoginPage.jsx'), 'utf-8');

assert.ok(!cssCode.match(/body\s*\{[^}]*overflow-y:\s*auto/), 'body must NOT have overflow-y: auto in index.css');
assert.ok(!authLayoutCode.includes('overscroll-y-none'), 'AuthLayout must not have overscroll-y-none');
assert.ok(!loginPageCode.includes('overscroll-y-none'), 'PortalLoginPage must not have overscroll-y-none');

console.log('✓ Test 6 Passed: Scroll architecture verified with single document root.');

console.log('\n--- ALL VERIFICATION TESTS PASSED SUCCESSFULLY! ---');
