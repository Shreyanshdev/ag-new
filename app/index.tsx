import React, { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import HomeScreen from './screens/customer/main/HomeScreen';

const AppIndex = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuthentication = async () => {
      try {
        // Check if user has valid authentication tokens
        const userToken = await AsyncStorage.getItem('userToken');
        const userRole = await AsyncStorage.getItem('userRole');

        // If no token, redirect to login
        if (!userToken) {
          console.log('❌ No authentication token found, redirecting to login');
          router.replace('/screens/auth/LoginScreen');
          return;
        }

        // If user is a delivery partner, redirect to delivery screen
        if (userRole === 'DeliveryPartner') {
          console.log('🚗 Redirecting delivery partner to DeliveryOrderScreen');
          router.replace('/screens/deliveryPartner/DeliveryOrderScreen');
          return;
        }

        // For authenticated customers, stay on HomeScreen
        console.log('✅ User authenticated, showing HomeScreen');
        setIsLoading(false);
      } catch (error) {
        console.error('❌ Error checking authentication:', error);
        // On error, redirect to login to be safe
        router.replace('/screens/auth/LoginScreen');
      }
    };

    checkAuthentication();
  }, [router]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  return <HomeScreen />;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
});

export default AppIndex;
