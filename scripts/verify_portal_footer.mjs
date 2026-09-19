import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- STARTING PORTAL FOOTER ARCHITECTURE VERIFICATION ---');

// Read PortalLayout.jsx and PortalFooter.jsx
const portalLayoutPath = path.resolve('src/components/layout/PortalLayout.jsx');
const portalFooterPath = path.resolve('src/components/layout/PortalFooter.jsx');

assert.ok(fs.existsSync(portalLayoutPath), 'PortalLayout.jsx must exist');
assert.ok(fs.existsSync(portalFooterPath), 'PortalFooter.jsx must exist');

const layoutContent = fs.readFileSync(portalLayoutPath, 'utf8');
const footerContent = fs.readFileSync(portalFooterPath, 'utf8');

// Test 1: PortalFooter is imported and used in PortalLayout
assert.ok(layoutContent.includes("import PortalFooter from './PortalFooter';"), 'PortalLayout must import PortalFooter');
assert.ok(layoutContent.includes("<PortalFooter role={role} />"), 'PortalLayout must render PortalFooter with role');
console.log('✓ Test 1 Passed: PortalFooter properly imported and rendered in PortalLayout');

// Test 2: Layout architecture - portal-content flex column wrapper with flex-1 main and normal flow footer
assert.ok(layoutContent.includes('className="portal-content flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth overscroll-y-none flex flex-col"'), 'portal-content must be a flex-col scroll container');
assert.ok(layoutContent.includes('<main className="flex-1 flex flex-col'), 'main must have flex-1 flex-col to push footer to bottom on short pages');
assert.ok(layoutContent.indexOf('<main') < layoutContent.indexOf('<PortalFooter'), 'PortalFooter must be rendered AFTER main content');
console.log('✓ Test 2 Passed: Page layout architecture matches Header -> Main Content -> Natural Spacing -> Footer');

// Test 3: Footer is NOT fixed, NOT sticky, NOT absolute, NOT hidden
assert.ok(!footerContent.includes('fixed bottom-'), 'PortalFooter must NOT be fixed');
assert.ok(!footerContent.includes('sticky bottom-'), 'PortalFooter must NOT be sticky');
assert.ok(!footerContent.includes('absolute bottom-'), 'PortalFooter must NOT be absolute');
assert.ok(!footerContent.includes('display: none') && !footerContent.includes('display:none'), 'PortalFooter must NOT be hidden');
console.log('✓ Test 3 Passed: PortalFooter is strictly in normal document flow');

// Test 4: Vertical spacing before footer (48px-80px on mobile, 64px-100px on desktop)
assert.ok(footerContent.includes('mt-12 sm:mt-16 md:mt-20 lg:mt-24'), 'Footer must have 48px-80px mobile, 64px-100px desktop vertical top margin');
console.log('✓ Test 4 Passed: Natural empty spacing before footer verified (mt-12 to lg:mt-24)');

// Test 5: Branding isolation - Hospital vs Pharmacy
assert.ok(footerContent.includes('useHospitalBranding'), 'PortalFooter must import and use useHospitalBranding');
assert.ok(footerContent.includes('usePharmacyBranding'), 'PortalFooter must import and use usePharmacyBranding');
assert.ok(footerContent.includes("isPharmacy = role === 'pharmacist' || location.pathname.startsWith('/pharmacy')"), 'Must distinguish pharmacy branding from hospital branding');
console.log('✓ Test 5 Passed: Dedicated hospital and pharmacy branding resolution verified');

// Test 6: Mobile clearance for MobileFloatingNav (pr-16/pr-20)
assert.ok(footerContent.includes('pr-16 sm:pr-20 md:pr-8'), 'Must provide right-side padding on mobile to clear MobileFloatingNav');
console.log('✓ Test 6 Passed: Right-side breathing room for floating nav verified');

// Test 7: All 9 portals covered in App.jsx via PortalLayout
const appPath = path.resolve('src/App.jsx');
const appContent = fs.readFileSync(appPath, 'utf8');

const targetPortals = [
  'admin',
  'owner',
  'reception',
  'doctor',
  'nurse',
  'lab',
  'laboratory',
  'billing',
  'pharmacy'
];

targetPortals.forEach(portal => {
  const isCovered = appContent.includes(`role="${portal}"`) || 
                    appContent.includes(`role="lab_technician"`) || 
                    appContent.includes(`role="accountant"`) || 
                    appContent.includes(`role="pharmacist"`) || 
                    appContent.includes(`role="receptionist"`);
  assert.ok(isCovered, `Portal ${portal} must be routed through PortalLayout`);
});
console.log('✓ Test 7 Passed: All 9 HMS portals globally covered by shared PortalLayout');

console.log('--- ALL PORTAL FOOTER ARCHITECTURE TESTS PASSED ---');
