/**
 * Verification script for enhanced address store functionality
 * This script tests the force update mechanism and subscription system
 */

import { useAddressStore } from './addressStore';

export const verifyAddressStoreEnhancements = () => {
  console.log('🧪 Starting Address Store Enhancement Verification...');
  
  // Test 1: Verify lastUpdated timestamp exists
  console.log('\n📋 Test 1: Checking lastUpdated timestamp...');
  const store = useAddressStore.getState();
  const hasLastUpdated = typeof store.lastUpdated === 'number';
  console.log(`✅ lastUpdated exists: ${hasLastUpdated}`);
  console.log(`📅 Current timestamp: ${store.lastUpdated}`);
  
  // Test 2: Verify forceUpdate method exists and works
  console.log('\n📋 Test 2: Testing forceUpdate method...');
  const initialTimestamp = store.lastUpdated;
  const hasForceUpdate = typeof store.forceUpdate === 'function';
  console.log(`✅ forceUpdate method exists: ${hasForceUpdate}`);
  
  if (hasForceUpdate) {
    setTimeout(() => {
      store.forceUpdate();
      const newTimestamp = useAddressStore.getState().lastUpdated;
      const timestampUpdated = newTimestamp > initialTimestamp;
      console.log(`✅ forceUpdate increments timestamp: ${timestampUpdated}`);
      console.log(`📅 New timestamp: ${newTimestamp}`);
    }, 100);
  }
  
  // Test 3: Verify subscription system
  console.log('\n📋 Test 3: Testing subscription system...');
  const hasSubscribeMethod = typeof store.subscribeToChanges === 'function';
  console.log(`✅ subscribeToChanges method exists: ${hasSubscribeMethod}`);
  
  if (hasSubscribeMethod) {
    let callbackTriggered = false;
    const testCallback = () => {
      callbackTriggered = true;
      console.log('📞 Subscription callback triggered!');
    };
    
    // Subscribe to changes
    const unsubscribe = store.subscribeToChanges(testCallback);
    console.log('📝 Subscribed to changes');
    
    // Test callback trigger
    setTimeout(() => {
      store.forceUpdate();
      setTimeout(() => {
        console.log(`✅ Callback triggered on forceUpdate: ${callbackTriggered}`);
        
        // Test unsubscribe
        unsubscribe();
        console.log('🔌 Unsubscribed from changes');
        
        callbackTriggered = false;
        store.forceUpdate();
        setTimeout(() => {
          console.log(`✅ Callback not triggered after unsubscribe: ${!callbackTriggered}`);
        }, 50);
      }, 50);
    }, 200);
  }
  
  // Test 4: Verify getFreshAddresses method
  console.log('\n📋 Test 4: Testing getFreshAddresses method...');
  const hasFreshAddresses = typeof store.getFreshAddresses === 'function';
  console.log(`✅ getFreshAddresses method exists: ${hasFreshAddresses}`);
  
  if (hasFreshAddresses) {
    const addresses = store.getFreshAddresses();
    console.log(`✅ getFreshAddresses returns array: ${Array.isArray(addresses)}`);
    console.log(`📊 Current addresses count: ${addresses.length}`);
  }
  
  console.log('\n🎉 Address Store Enhancement Verification Complete!');
  
  return {
    hasLastUpdated,
    hasForceUpdate,
    hasSubscribeMethod,
    hasFreshAddresses,
  };
};

// Export for use in components
export default verifyAddressStoreEnhancements;