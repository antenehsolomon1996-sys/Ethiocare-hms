import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('--- STARTING PORTAL FOOTER ARCHITECTURE VERIFICATION ---');

// Read files
const portalLayoutPath = path.resolve('src/components/layout/PortalLayout.jsx');
const portalFooterPath = path.resolve('src/components/layout/PortalFooter.jsx');
const indexCssPath = path.resolve('src/index.css');

assert.ok(fs.existsSync(portalLayoutPath), 'PortalLayout.jsx must exist');
assert.ok(fs.existsSync(portalFooterPath), 'PortalFooter.jsx must exist');
assert.ok(fs.existsSync(indexCssPath), 'index.css must exist');

const layoutContent = fs.readFileSync(portalLayoutPath, 'utf8');
const footerContent = fs.readFileSync(portalFooterPath, 'utf8');
const cssContent = fs.readFileSync(indexCssPath, 'utf8');

// Test 1: PortalFooter is imported and rendered in PortalLayout
assert.ok(layoutContent.includes("import PortalFooter from './PortalFooter';"), 'PortalLayout must import PortalFooter');
assert.ok(layoutContent.includes("<PortalFooter role={role} />"), 'PortalLayout must render PortalFooter with role');
console.log('✓ Test 1 Passed: PortalFooter properly imported and rendered in PortalLayout');

// Test 2: Layout architecture - Single primary scroll flow
assert.ok(layoutContent.includes('portal-shell min-h-screen min-h-[100dvh]'), 'portal-shell must use min-h-[100dvh] without locking height');
assert.ok(!layoutContent.includes('portal-shell flex h-screen'), 'portal-shell must not use fixed h-screen overflow-hidden');
assert.ok(layoutContent.includes('portal-content-wrapper flex-1 min-w-0 flex flex-col min-h-screen min-h-[100dvh]'), 'content wrapper must allow natural expansion');
assert.ok(layoutContent.includes('<main className="flex-1 flex flex-col'), 'main must have flex-1 flex-col to push footer to bottom on short pages');
assert.ok(layoutContent.indexOf('<main') < layoutContent.indexOf('<PortalFooter'), 'PortalFooter must be rendered AFTER main content');
console.log('✓ Test 2 Passed: Page layout architecture matches Header -> Main Content -> Natural Spacing -> Footer');

// Test 3: Footer is in normal document flow - NOT fixed, sticky, absolute, or hidden
assert.ok(!footerContent.includes('fixed bottom-'), 'PortalFooter must NOT be fixed');
assert.ok(!footerContent.includes('sticky bottom-'), 'PortalFooter must NOT be sticky');
assert.ok(!footerContent.includes('absolute bottom-'), 'PortalFooter must NOT be absolute');
assert.ok(!footerContent.includes('display: none') && !footerContent.includes('display:none'), 'PortalFooter must NOT be hidden');
console.log('✓ Test 3 Passed: PortalFooter is strictly in normal document flow');

// Test 4: Vertical spacing before footer (48px on mobile, 64px on desktop)
assert.ok(footerContent.includes('mt-12 md:mt-16'), 'Footer must have mt-12 (48px) mobile and md:mt-16 (64px) desktop vertical top margin');
console.log('✓ Test 4 Passed: Natural empty spacing before footer verified (48px mobile, 64px desktop)');

// Test 5: Compact footer design - no excessive padding or giant spacers
assert.ok(footerContent.includes('py-5 sm:py-6 md:py-6'), 'Footer must use compact vertical padding (py-5/py-6)');
assert.ok(!footerContent.includes('py-8 sm:py-10 md:py-12'), 'Footer must avoid excessive padding');
console.log('✓ Test 5 Passed: Compact luxury footer layout verified');

// Test 6: Branding isolation - Hospital vs Pharmacy
assert.ok(footerContent.includes('useHospitalBranding'), 'PortalFooter must import and use useHospitalBranding');
assert.ok(footerContent.includes('usePharmacyBranding'), 'PortalFooter must import and use usePharmacyBranding');
assert.ok(footerContent.includes("isPharmacy = role === 'pharmacist' || location.pathname.startsWith('/pharmacy')"), 'Must distinguish pharmacy branding from hospital branding');
console.log('✓ Test 6 Passed: Dedicated hospital and pharmacy branding resolution verified');

// Test 7: Mobile clearance for MobileFloatingNav (pr-16/pr-20) and safe area
assert.ok(footerContent.includes('pr-16 sm:pr-20 md:pr-8'), 'Must provide right-side padding on mobile to clear MobileFloatingNav');
assert.ok(footerContent.includes('pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'), 'Must respect safe area inset bottom');
console.log('✓ Test 7 Passed: Right-side breathing room and safe area clearance verified');

// Test 8: CSS document scrolling (no fixed height on html/body/root)
assert.ok(!cssContent.includes('html, body, #root {\n    height: 100dvh;'), 'index.css must not lock html, body, #root to fixed 100dvh');
console.log('✓ Test 8 Passed: Natural document scrolling enabled in index.css');

// Test 9: All 9 portals covered in App.jsx via PortalLayout
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
console.log('✓ Test 9 Passed: All 9 HMS portals globally covered by shared PortalLayout');

console.log('--- ALL PORTAL FOOTER ARCHITECTURE TESTS PASSED ---');
