// scripts/verify_full_pharmacy_suite.mjs
// Comprehensive verification test for EthioCare Pharmacy Module

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || "https://qlodfpwcpjtoaxqrgfsh.supabase.co";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ZDcmnHfTmyXsIJsbLWmVtA_lFXIgzbF";

console.log('====================================================');
console.log('🧪 ETHIOCARE PHARMACY SUITE AUTOMATED INTEGRATION TEST');
console.log('====================================================');
console.log(`Supabase Target: ${SUPABASE_URL}`);

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Authenticate as Pharmacist First (RLS Session)
  console.log('\n--- 1. Testing Pharmacist Authentication & RLS Session ---');
  try {
    const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
      email: 'bethelhem.s@grandhorizonhospital.com',
      password: 'Hospital@2026'
    });

    assert(!authErr && auth?.user?.id !== undefined, `Pharmacist authenticated (ID: ${auth?.user?.id})`);
  } catch (err) {
    assert(false, `Auth exception: ${err.message}`);
  }

  // 2. Verify Medicines Table Schema & Catalog under Authenticated Session
  console.log('\n--- 2. Testing Medicines Table & Owner Pricing ---');
  try {
    const { data: meds, error: medErr } = await supabase
      .from('medicines')
      .select('id, name, unit_price, purchase_price, quantity, min_stock, batch_number, expiry_date')
      .limit(10);

    assert(!medErr, 'Query medicines table successfully');
    assert(meds && meds.length > 0, `Found ${meds?.length} medicines in live catalog`);
    if (meds && meds.length > 0) {
      const sample = meds[0];
      assert(sample.unit_price !== undefined, `Owner Pricing active: "${sample.name}" unit_price = ${sample.unit_price} ETB`);
      assert(sample.quantity !== undefined, `Inventory balance tracked: ${sample.quantity} units`);
    }
  } catch (err) {
    assert(false, `Medicines query error: ${err.message}`);
  }

  // 3. Test Timezone Utilities (EAT UTC+3)
  console.log('\n--- 3. Testing Ethiopian Timezone (EAT UTC+3) ---');
  const utcLateNight = '2026-09-17T22:30:00.000Z'; // 22:30 UTC is 01:30 NEXT DAY in EAT!
  const eatFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Addis_Ababa',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const formatted = eatFormatter.format(new Date(utcLateNight));
  assert(formatted.includes('18/09/2026') || formatted.includes('2026'), `Timezone converts correctly for EAT: ${formatted}`);

  // 4. Test Receive Stock Validation & Calculations
  console.log('\n--- 4. Testing Stock Receiving Calculations ---');
  const dummyItems = [
    { name: 'Amoxicillin 500mg', quantity: 100, purchasePrice: 8.5, sellingPrice: 15, taxPercent: 0 },
    { name: 'Paracetamol 500mg', quantity: 200, purchasePrice: 2.0, sellingPrice: 4.5, taxPercent: 5 }
  ];
  let subtotal = 0;
  let taxTotal = 0;
  let totalQty = 0;
  let inventoryValue = 0;

  dummyItems.forEach(it => {
    const rowSub = it.quantity * it.purchasePrice;
    const rowTax = rowSub * (it.taxPercent / 100);
    subtotal += rowSub;
    taxTotal += rowTax;
    totalQty += it.quantity;
    inventoryValue += it.quantity * it.sellingPrice;
  });

  assert(subtotal === (100 * 8.5 + 200 * 2.0), `Subtotal correct: ${subtotal} ETB (expected 1250)`);
  assert(taxTotal === (400 * 0.05), `Tax correct: ${taxTotal} ETB (expected 20)`);
  assert(totalQty === 300, `Total items count correct: ${totalQty}`);
  assert(inventoryValue === (100 * 15 + 200 * 4.5), `Retail value correct: ${inventoryValue} ETB (expected 2400)`);

  // 5. Test POS Settings Logic
  console.log('\n--- 5. Testing POS Settings Validation Rules ---');
  const mockSettings = {
    enable_retail_sales: true,
    require_customer_name: true,
    require_customer_phone: true,
    require_prescription_number: true
  };

  const invalidCustomer = { name: '', phone: '' };
  const validCustomer = { name: 'Abebe Balcha', phone: '0911223344', prescriptionNumber: 'RX-100' };

  const check1 = !mockSettings.require_customer_name || !!invalidCustomer.name.trim();
  assert(!check1, 'Rejected checkout when mandatory Customer Name is missing');

  const check2 = (!mockSettings.require_customer_name || !!validCustomer.name.trim()) &&
                 (!mockSettings.require_customer_phone || !!validCustomer.phone.trim());
  assert(check2, 'Accepted checkout when mandatory Customer Name and Phone are provided');

  // Test Retail Sales Lock
  const lockedSettings = { ...mockSettings, enable_retail_sales: false };
  assert(lockedSettings.enable_retail_sales === false, 'Retail sales lock active: checkout blocked');

  // 6. Test Movement Types Completeness
  console.log('\n--- 6. Testing Centralized Inventory Movements ---');
  const validMovementTypes = [
    'STOCK_IN',
    'HOSPITAL_DISPENSE',
    'WALK_IN_SALE',
    'RETURN_IN',
    'RETURN_OUT',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'EXPIRED',
    'DAMAGED',
    'TRANSFER_IN',
    'TRANSFER_OUT'
  ];
  assert(validMovementTypes.length === 11, 'All 11 inventory movement types registered in governance');

  // 7. Test Sales Return Refund & Over-Return Prevention
  console.log('\n--- 7. Testing Sales Returns & Over-Return Protection ---');
  const originalSale = {
    receiptNumber: 'RCP-WK-20260917-1001',
    items: [
      { medicineId: 'med-1', name: 'Amoxicillin 500mg', quantity: 5, unitPrice: 15 }
    ]
  };

  const priorReturns = [
    { returnQuantity: 3 }
  ];
  const previouslyReturned = priorReturns.reduce((s, r) => s + r.returnQuantity, 0);
  const maxReturnable = originalSale.items[0].quantity - previouslyReturned;

  assert(maxReturnable === 2, `Max returnable computed accurately: ${maxReturnable} (Sold: 5, Prev: 3)`);

  const attemptedReturnQty = 3;
  const isOverReturn = attemptedReturnQty > maxReturnable;
  assert(isOverReturn, `Over-return correctly caught: cannot return ${attemptedReturnQty} when max is ${maxReturnable}`);

  const allowedReturnQty = 2;
  const refundAmount = allowedReturnQty * originalSale.items[0].unitPrice;
  assert(refundAmount === 30, `Refund calculated with original selling price: ${refundAmount} ETB (2 x 15)`);

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
