import React, { useState, useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { initializeAuthState } from '../src/config/api';

import { CartProvider } from '../src/context/CartContext';
import { BranchProvider } from '../src/context/BranchContext';
import { useAddressStore } from '../src/store/addressStore';
import { useUserStore } from '../src/store/userStore';


// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [initialRoute, setInitialRoute] = useState('screens/auth/LoginScreen');
  const { initializeAddresses } = useAddressStore();
  const { checkSubscription } = useUserStore();

  useEffect(() => {
    async function prepareApp() {
      try {
        console.log('🚀 Preparing app initialization...');

        const authState = await initializeAuthState();
        console.log('🔍 Auth state result:', {
          isAuthenticated: authState.isAuthenticated,
          userRole: authState.userRole,
          redirectRoute: authState.redirectRoute
        });

        if (authState.isAuthenticated) {
          console.log('✅ User authenticated, proceeding to app');
          console.log('🎯 Setting initial route to:', authState.redirectRoute);
          setInitialRoute(authState.redirectRoute);

          // Initialize addresses for authenticated user
          console.log('🏠 Initializing addresses...');
          await initializeAddresses();
          await checkSubscription();
        } else {
          console.log('ℹ️ User not authenticated, redirecting to login');
          setInitialRoute(authState.redirectRoute);
        }
      } catch (e) {
        console.error('❌ Error during app initialization:', e);
        setInitialRoute('screens/auth/LoginScreen');
      } finally {
        setAppIsReady(true);
        SplashScreen.hideAsync();
        console.log('✅ App initialization complete, initialRoute:', initialRoute);
      }
    }

    prepareApp();
  }, []);

  if (!appIsReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return (
    <CartProvider>
      <BranchProvider>
        
            <Stack
            screenOptions={{
              headerShown: false,
            }}
            initialRouteName={initialRoute}
          >
            <Stack.Screen name="screens/auth/LoginScreen" options={{ headerShown: false }} />
            <Stack.Screen name="index" />
            <Stack.Screen name="screens/customer/products/CategoryScreen" options={{ headerShown: false, title: 'Category' }} />
            <Stack.Screen name="screens/customer/products/ProductSearchScreen" options={{ headerShown: false, title: 'Search Products' }} />
            <Stack.Screen name="screens/customer/orders/CheckoutScreen" options={{ headerShown: false, title: 'Checkout' }} />
            <Stack.Screen name="screens/customer/orders/OrderTrackingScreen" options={{ headerShown: false, title: 'Track Order' }} />
            <Stack.Screen name="screens/customer/products/ProductDetailScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/customer/profile/ProfileScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/customer/profile/AddressScreen" options={{ headerShown: false }} />
            <Stack.Screen name="screens/deliveryPartner/DeliveryOrderScreen" options={{ headerShown: false}} />
            <Stack.Screen name="screens/deliveryPartner/OrderDetailsScreen" options={{ headerShown: false, title: 'Order Details' }} />
            <Stack.Screen name="screens/deliveryPartner/AvailableOrdersScreen" options={{ headerShown: false, title: 'Available Orders' }} />
            <Stack.Screen name="screens/deliveryPartner/CurrentOrdersScreen" options={{ headerShown: false, title: 'Current Orders' }} />
            <Stack.Screen name="screens/deliveryPartner/OrderHistoryScreen" options={{ headerShown: false, title: 'Order History' }} />
            <Stack.Screen name="screens/customer/orders/ReviewOrderScreen" options={{ headerShown: false, title: 'Review Order' }} />
            <Stack.Screen name="screens/customer/orders/InvoiceScreen" options={{ headerShown: false, title: 'Invoice' }} />
          </Stack>
          
      </BranchProvider>
    </CartProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});
