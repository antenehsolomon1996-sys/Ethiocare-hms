import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

console.log('=== Comprehensive Mobile Scroll Architecture & Clearance Verification ===\n');

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

// 1. Check index.css for dynamic viewport height and CSS variables
const indexCss = readFileSync(resolve('src/index.css'), 'utf8');
assert(indexCss.includes('--mobile-bottom-nav-height: 3.75rem;'), 'index.css defines --mobile-bottom-nav-height (60px)');
assert(indexCss.includes('--mobile-bottom-spacer-extra: 2rem;'), 'index.css defines --mobile-bottom-spacer-extra (32px breathing room)');
assert(indexCss.includes('--mobile-bottom-safe-space: calc('), 'index.css computes --mobile-bottom-safe-space from nav height, safe-area, and extra breathing room');
assert(indexCss.includes('100dvh'), 'index.css uses 100dvh for modern dynamic viewport height support on mobile Safari');
assert(indexCss.includes('.mobile-bottom-nav-spacer'), 'index.css defines .mobile-bottom-nav-spacer class');
assert(indexCss.includes('height: var(--mobile-bottom-safe-space);'), '.mobile-bottom-nav-spacer uses computed safe space variable');
assert(indexCss.includes('display: none !important;'), '.mobile-bottom-nav-spacer collapses to 0 height on desktop viewports');

// 2. Check PortalLayout for the architectural fix
const portalLayout = readFileSync(resolve('src/components/layout/PortalLayout.jsx'), 'utf8');
assert(portalLayout.includes('h-screen h-dvh'), 'PortalLayout outer shell uses h-screen with h-dvh fallback');
assert(portalLayout.includes('min-h-0 overflow-hidden'), 'PortalLayout content column uses min-h-0 to uncap flex scroll sizing');
assert(portalLayout.includes('shrink-0'), 'PortalLayout mobile subheader has shrink-0 to prevent compression');
assert(portalLayout.includes('<main className="flex-1 min-h-0 overflow-y-auto'), 'PortalLayout <main> uses min-h-0 overflow-y-auto');
assert(portalLayout.includes('className="mobile-bottom-nav-spacer md:hidden"'), 'PortalLayout mounts REAL DOM layout spacer element (<div className="mobile-bottom-nav-spacer md:hidden" />)');

// 3. Check PullToRefresh container
const pullToRefresh = readFileSync(resolve('src/components/common/PullToRefresh.jsx'), 'utf8');
assert(pullToRefresh.includes('min-h-full'), 'PullToRefresh container has min-h-full to ensure scroll boundary expansion');

// 4. Check BottomTabBar
const bottomTabBar = readFileSync(resolve('src/components/layout/BottomTabBar.jsx'), 'utf8');
assert(bottomTabBar.includes('var(--mobile-bottom-nav-height'), 'BottomTabBar uses --mobile-bottom-nav-height CSS variable');
assert(bottomTabBar.includes('max-h-[85dvh]'), 'BottomTabBar More sheet uses max-h-[85dvh] to prevent mobile Safari clipping');
assert(bottomTabBar.includes('var(--mobile-bottom-spacer-extra'), 'BottomTabBar More sheet padding respects safe space variable');

// 5. Check Table scroll optimization
const tableUi = readFileSync(resolve('src/components/ui/table.jsx'), 'utf8');
assert(tableUi.includes('overflow-x-auto overflow-y-visible'), 'Table wrapper uses overflow-x-auto overflow-y-visible to prevent vertical scroll gesture hijacking');

// 6. Check that ALL 8 portals use PortalLayout in App.jsx
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
  console.log('🎉 ALL MOBILE SCROLL ARCHITECTURE CHECKS PASSED!');
}
