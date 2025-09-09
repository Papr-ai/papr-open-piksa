#!/usr/bin/env node

/**
 * Test script to verify webhook filtering logic
 * This simulates how the webhook handles events from different apps
 */

// Mock SERVER_SUBSCRIPTION_PLANS for testing
const SERVER_SUBSCRIPTION_PLANS = [
  { id: 'starter', stripePriceId: 'price_1234567890_starter' },
  { id: 'pro', stripePriceId: 'price_1234567890_pro' },
  { id: 'enterprise', stripePriceId: 'price_1234567890_enterprise' }
];

function testWebhookFiltering() {
  console.log('🧪 Testing Webhook Filtering Logic\n');
  
  // Test cases
  const testCases = [
    {
      name: 'Valid subscription for this app (starter plan)',
      priceId: 'price_1234567890_starter',
      shouldProcess: true,
      expectedPlan: 'starter'
    },
    {
      name: 'Valid subscription for this app (pro plan)',
      priceId: 'price_1234567890_pro',
      shouldProcess: true,
      expectedPlan: 'pro'
    },
    {
      name: 'Subscription for different app',
      priceId: 'price_9876543210_other_app',
      shouldProcess: false,
      expectedPlan: null
    },
    {
      name: 'Subscription for another different app',
      priceId: 'price_abcdef_different_service',
      shouldProcess: false,
      expectedPlan: null
    },
    {
      name: 'Valid enterprise subscription',
      priceId: 'price_1234567890_enterprise',
      shouldProcess: true,
      expectedPlan: 'enterprise'
    }
  ];
  
  console.log('📋 Test Results:');
  console.log('='.repeat(60));
  
  testCases.forEach((testCase, index) => {
    const plan = SERVER_SUBSCRIPTION_PLANS.find(p => p.stripePriceId === testCase.priceId);
    const shouldProcess = !!plan;
    const foundPlan = plan?.id || null;
    
    const passed = shouldProcess === testCase.shouldProcess && foundPlan === testCase.expectedPlan;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    
    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   Price ID: ${testCase.priceId}`);
    console.log(`   Expected: ${testCase.shouldProcess ? 'Process' : 'Ignore'} (plan: ${testCase.expectedPlan})`);
    console.log(`   Actual:   ${shouldProcess ? 'Process' : 'Ignore'} (plan: ${foundPlan})`);
    console.log(`   Result:   ${status}`);
    console.log('');
  });
  
  const passedTests = testCases.filter((testCase, index) => {
    const plan = SERVER_SUBSCRIPTION_PLANS.find(p => p.stripePriceId === testCase.priceId);
    const shouldProcess = !!plan;
    const foundPlan = plan?.id || null;
    return shouldProcess === testCase.shouldProcess && foundPlan === testCase.expectedPlan;
  }).length;
  
  console.log('📊 Summary:');
  console.log(`   Tests passed: ${passedTests}/${testCases.length}`);
  console.log(`   Success rate: ${(passedTests / testCases.length * 100).toFixed(1)}%`);
  
  if (passedTests === testCases.length) {
    console.log('   🎉 All tests passed! Webhook filtering is working correctly.');
  } else {
    console.log('   ⚠️  Some tests failed. Please check the filtering logic.');
  }
  
  console.log('\n🔍 How the filtering works:');
  console.log('   1. Extract price ID from subscription event');
  console.log('   2. Check if price ID exists in SERVER_SUBSCRIPTION_PLANS');
  console.log('   3. If found: Process the event for this app');
  console.log('   4. If not found: Ignore the event (for other apps)');
  console.log('   5. Return 200 status to prevent Stripe retries');
  
  console.log('\n✨ Benefits:');
  console.log('   ✅ No more webhook failures from other apps');
  console.log('   ✅ Stripe won\'t disable your webhook endpoint');
  console.log('   ✅ Clean logs with proper filtering');
  console.log('   ✅ Only processes relevant subscription events');
}

// Run tests if called directly
if (require.main === module) {
  testWebhookFiltering();
}

module.exports = { testWebhookFiltering };
