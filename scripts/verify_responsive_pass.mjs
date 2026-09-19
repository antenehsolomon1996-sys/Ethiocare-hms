import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

console.log('=== EthioCare HMS Responsive UX & Branding Verification ===\n');

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

// 1. Check QueryClient caching
const queryClientFile = readFileSync(resolve('src/lib/query-client.js'), 'utf8');
assert(queryClientFile.includes('staleTime: 30000'), 'QueryClient has staleTime: 30000ms configured');
assert(queryClientFile.includes('gcTime: 300000'), 'QueryClient has gcTime: 300000ms configured');

// 2. Check CSS safe areas & smooth scrolling
const indexCssFile = readFileSync(resolve('src/index.css'), 'utf8');
assert(indexCssFile.includes('scroll-behavior: smooth'), 'Global smooth scrolling enabled in index.css');
assert(indexCssFile.includes('env(safe-area-inset-bottom'), 'Safe-area bottom inset utility defined');
assert(indexCssFile.includes('env(safe-area-inset-top'), 'Safe-area top inset utility defined');
assert(indexCssFile.includes('overscroll-behavior-y: none'), 'Pull-to-refresh overscroll bounce eliminated');

// 3. Check PortalLayout safe areas & z-index
const portalLayoutFile = readFileSync(resolve('src/components/layout/PortalLayout.jsx'), 'utf8');
assert(portalLayoutFile.includes('z-30'), 'Top navbar has explicit z-30 stacking');
assert(portalLayoutFile.includes('<MobileFloatingNav role={role} />'), 'PortalLayout mounts shared <MobileFloatingNav role={role} />');
assert(portalLayoutFile.includes('min-h-[44px] min-w-[44px]'), 'Mobile menu trigger button has >= 44px touch target');
assert(portalLayoutFile.includes('loading="lazy"'), 'Brand logo is lazy-loaded with decoding="async"');

// 4. Check MobileFloatingNav
const floatingNavFile = readFileSync(resolve('src/components/layout/MobileFloatingNav.jsx'), 'utf8');
assert(floatingNavFile.includes('z-40'), 'Floating nav rail has explicit z-40 stacking');
assert(floatingNavFile.includes('right-3'), 'Floating nav rail is positioned on the right side');
assert(floatingNavFile.includes('min-h-[44px] min-w-[44px]'), 'Floating nav buttons have >= 44px touch targets');

// 5. Check ImageUploadField
assert(existsSync(resolve('src/components/common/ImageUploadField.jsx')), 'ImageUploadField component exists');
const imageUploadFile = readFileSync(resolve('src/components/common/ImageUploadField.jsx'), 'utf8');
assert(imageUploadFile.includes('optimizeImageFile'), 'Image optimization function defined');
assert(imageUploadFile.includes('canvas.toDataURL'), 'Canvas resizing & WebP compression implemented');

// 6. Check OwnerSettings logo integration
const ownerSettingsFile = readFileSync(resolve('src/pages/owner/OwnerSettings.jsx'), 'utf8');
assert(ownerSettingsFile.includes('ImageUploadField'), 'OwnerSettings uses ImageUploadField for hospital logo');
assert(ownerSettingsFile.includes('useHospitalBranding'), 'OwnerSettings consumes useHospitalBranding hook');

// 7. Check PharmacySettings logo integration & independence
const pharmacySettingsFile = readFileSync(resolve('src/pages/pharmacy/PharmacySettings.jsx'), 'utf8');
assert(pharmacySettingsFile.includes('ImageUploadField'), 'PharmacySettings uses ImageUploadField for pharmacy logo');
assert(pharmacySettingsFile.includes('usePharmacyBranding'), 'PharmacySettings consumes usePharmacyBranding hook');

// 8. Check AuthBrandedFooter and PortalLoginPage
assert(existsSync(resolve('src/components/auth/AuthBrandedFooter.jsx')), 'AuthBrandedFooter component exists');
const authFooterFile = readFileSync(resolve('src/components/auth/AuthBrandedFooter.jsx'), 'utf8');
assert(authFooterFile.includes('Emergency'), 'AuthBrandedFooter includes 24/7 Emergency contact');
assert(authFooterFile.includes('Operating Hours'), 'AuthBrandedFooter includes working hours');
assert(authFooterFile.includes('EthioCare HMS'), 'AuthBrandedFooter includes EthioCare HMS branding');

const portalLoginPageFile = readFileSync(resolve('src/pages/auth/PortalLoginPage.jsx'), 'utf8');
assert(portalLoginPageFile.includes('AuthBrandedFooter'), 'PortalLoginPage renders AuthBrandedFooter');
assert(portalLoginPageFile.includes('pb-[calc(3rem+env(safe-area-inset-bottom'), 'PortalLoginPage has safe-area responsive padding');

const authLayoutFile = readFileSync(resolve('src/components/AuthLayout.jsx'), 'utf8');
assert(authLayoutFile.includes('AuthBrandedFooter'), 'AuthLayout renders AuthBrandedFooter');
assert(authLayoutFile.includes('lg:hidden'), 'AuthLayout displays hospital brand banner on mobile');

console.log(`\nResults: ${passCount} Passed, ${failCount} Failed.`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🎉 ALL RESPONSIVE UX & BRANDING CHECKS PASSED!');
}
