import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

console.log('=== Comprehensive Mobile Vertical Floating Navigation Architecture Verification ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passCount++;
  } else {
    console.error(`❌ FAIL: ${message}`);
    failCount++;
  }
}

// 1. Check index.css for dynamic viewport height and safe area insets
const indexCss = readFileSync(resolve('src/index.css'), 'utf8');
assert(indexCss.includes('100dvh'), 'index.css uses 100dvh for modern dynamic viewport height support on mobile Safari');
assert(indexCss.includes('env(safe-area-inset-bottom, 0px)'), 'index.css defines safe area bottom inset variable');
assert(!indexCss.includes('.mobile-bottom-nav-spacer'), 'index.css has removed obsolete .mobile-bottom-nav-spacer');

// 2. Check PortalLayout for the architectural fix
const portalLayout = readFileSync(resolve('src/components/layout/PortalLayout.jsx'), 'utf8');
assert(portalLayout.includes('h-screen h-dvh'), 'PortalLayout outer shell uses h-screen with h-dvh fallback');
assert(portalLayout.includes('min-h-0 overflow-hidden'), 'PortalLayout content column uses min-h-0 to uncap flex scroll sizing');
assert(portalLayout.includes('shrink-0'), 'PortalLayout mobile subheader has shrink-0 to prevent compression');
assert(portalLayout.includes('<main className="flex-1 min-h-0 overflow-y-auto'), 'PortalLayout <main> uses min-h-0 overflow-y-auto');
assert(!portalLayout.includes('className="mobile-bottom-nav-spacer md:hidden"'), 'PortalLayout removed obsolete mobile-bottom-nav-spacer element');
assert(portalLayout.includes('<MobileFloatingNav role={role} />'), 'PortalLayout mounts shared <MobileFloatingNav role={role} />');

// 3. Check MobileFloatingNav component specifications
assert(existsSync(resolve('src/components/layout/MobileFloatingNav.jsx')), 'MobileFloatingNav component exists');
const mobileFloatingNav = readFileSync(resolve('src/components/layout/MobileFloatingNav.jsx'), 'utf8');
assert(mobileFloatingNav.includes('fixed z-40 right-3'), 'MobileFloatingNav is fixed to the right side');
assert(mobileFloatingNav.includes('bottom-[calc(16px+env(safe-area-inset-bottom,0px))]'), 'MobileFloatingNav is positioned toward the lower right respecting safe areas');
assert(mobileFloatingNav.includes('w-14'), 'MobileFloatingNav has compact width (~56px)');
assert(mobileFloatingNav.includes('min-h-[44px] min-w-[44px]'), 'MobileFloatingNav buttons have >= 44px touch targets');
assert(mobileFloatingNav.includes('max-h-[85dvh]'), 'MobileFloatingNav More sheet uses max-h-[85dvh] to prevent mobile Safari clipping');
assert(mobileFloatingNav.includes('rounded-2xl'), 'MobileFloatingNav has rounded luxury pill appearance');

// 4. Check Table scroll optimization
const tableUi = readFileSync(resolve('src/components/ui/table.jsx'), 'utf8');
assert(tableUi.includes('overflow-x-auto overflow-y-visible'), 'Table wrapper uses overflow-x-auto overflow-y-visible to prevent vertical scroll gesture hijacking');

// 5. Check that ALL 8 portals use PortalLayout in App.jsx
const appJsx = readFileSync(resolve('src/App.jsx'), 'utf8');
const requiredRoles = ['owner', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'];
for (const role of requiredRoles) {
  assert(appJsx.includes(`<Route element={<PortalLayout role="${role}" />}>`), `App.jsx wraps ${role} portal routes in shared PortalLayout`);
}

const requiredPortals = ['/admin', '/owner', '/reception', '/doctor', '/nurse', '/lab', '/billing', '/pharmacy'];
for (const path of requiredPortals) {
  assert(appJsx.includes(`path="${path}"`), `App.jsx defines entry route for ${path}`);
}

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL MOBILE VERTICAL FLOATING NAVIGATION CHECKS PASSED!');
}
