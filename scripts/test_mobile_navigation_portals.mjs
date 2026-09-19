import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

console.log('=== Verifying Mobile Floating Navigation Rail Across All Portals ===\n');

let passes = 0;
let failures = 0;

function check(desc, cond) {
  if (cond) {
    console.log(`✅ PASS: ${desc}`);
    passes++;
  } else {
    console.error(`❌ FAIL: ${desc}`);
    failures++;
  }
}

// 1. Verify PortalLayout renders MobileFloatingNav and does not render obsolete horizontal bottom bar or spacers
const portalLayout = readFileSync(resolve('src/components/layout/PortalLayout.jsx'), 'utf8');
check('PortalLayout imports MobileFloatingNav', portalLayout.includes("import MobileFloatingNav from './MobileFloatingNav'"));
check('PortalLayout renders <MobileFloatingNav role={role} />', portalLayout.includes('<MobileFloatingNav role={role} />'));
check('PortalLayout does NOT render BottomTabBar directly', !portalLayout.includes('<BottomTabBar'));
check('PortalLayout does NOT contain mobile-bottom-nav-spacer', !portalLayout.includes('mobile-bottom-nav-spacer'));

// 2. Verify MobileFloatingNav implementation
const mobileNav = readFileSync(resolve('src/components/layout/MobileFloatingNav.jsx'), 'utf8');
check('MobileFloatingNav exists on disk', existsSync(resolve('src/components/layout/MobileFloatingNav.jsx')));
check('MobileFloatingNav is md:hidden (mobile only)', mobileNav.includes('md:hidden'));
check('MobileFloatingNav is fixed position on right side', mobileNav.includes('fixed z-40 right-3'));
check('MobileFloatingNav is located toward lower right with safe-area spacing', mobileNav.includes('bottom-[calc(16px+env(safe-area-inset-bottom,0px))]'));
check('MobileFloatingNav has ~56px width (w-14)', mobileNav.includes('w-14'));
check('MobileFloatingNav has rounded-2xl luxury floating aesthetic', mobileNav.includes('rounded-2xl'));
check('MobileFloatingNav buttons have min 44px x 44px touch targets (w-11 h-11 min-h-[44px] min-w-[44px])', mobileNav.includes('w-11 h-11 min-h-[44px] min-w-[44px]'));
check('MobileFloatingNav active state has primary background, glow, and elevation', mobileNav.includes('bg-primary text-primary-foreground shadow-md shadow-primary/30 scale-105'));
check('MobileFloatingNav 5th item is More button with MoreHorizontal', mobileNav.includes('<MoreHorizontal'));
check('MobileFloatingNav includes More Sheet drawer with max-h-[85dvh]', mobileNav.includes('max-h-[85dvh]'));

// 3. Verify All 8 Portal roles are mapped with dedicated icons in MobileFloatingNav
const portalRoles = ['admin', 'owner', 'receptionist', 'doctor', 'nurse', 'lab_technician', 'pharmacist', 'accountant'];
for (const role of portalRoles) {
  check(`MobileFloatingNav configures dedicated primary items for role: ${role}`, mobileNav.includes(`${role}: [`));
}

// 4. Verify all routes and portals are defined in App.jsx and use PortalLayout
const appJsx = readFileSync(resolve('src/App.jsx'), 'utf8');
const portals = [
  { path: '/admin', role: 'owner' },
  { path: '/owner', role: 'owner' },
  { path: '/reception', role: 'receptionist' },
  { path: '/doctor', role: 'doctor' },
  { path: '/nurse', role: 'nurse' },
  { path: '/lab', role: 'lab_technician' },
  { path: '/billing', role: 'accountant' },
  { path: '/pharmacy', role: 'pharmacist' },
];

for (const portal of portals) {
  check(`App.jsx registers portal route ${portal.path}`, appJsx.includes(`path="${portal.path}"`));
}

// 5. Verify index.css has removed obsolete horizontal bottom nav spacers
const indexCss = readFileSync(resolve('src/index.css'), 'utf8');
check('index.css has no .mobile-bottom-nav-spacer class', !indexCss.includes('.mobile-bottom-nav-spacer'));
check('index.css has no --mobile-bottom-safe-space variable', !indexCss.includes('--mobile-bottom-safe-space'));
check('index.css has no .pb-safe-nav class', !indexCss.includes('.pb-safe-nav'));

// 6. Verify built output bundle
const distPortalLayout = readFileSync(resolve('dist/assets/PortalLayout-BvnCX0rF.js'), 'utf8');
check('dist production PortalLayout bundle contains Mobile Navigation Rail', distPortalLayout.includes('Mobile Navigation Rail'));
check('dist production PortalLayout bundle does NOT contain mobile-bottom-nav-spacer', !distPortalLayout.includes('mobile-bottom-nav-spacer'));

console.log(`\nPortal Verification Results: ${passes} Passed, ${failures} Failed.`);
if (failures > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL PORTAL FLOATING NAVIGATION CHECKS COMPLETED SUCCESSFULLY!');
}
