import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCart } from '../../../src/context/CartContext';

type RootStackParamList = {
  'screens/customer/orders/CheckoutScreen': undefined;
};
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

interface FloatingCartProps {
  marginBottom?: number;
}

const FloatingCart: React.FC<FloatingCartProps> = ({ marginBottom = 0 }) => {
  const navigation = useNavigation<NavigationProps>();
  const { totalItems, totalCost } = useCart();

  if (totalItems === 0) return null;

  return (
    <View style={[styles.container, { bottom: Platform.OS === 'ios' ? 20 + marginBottom : 0 + marginBottom }]}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => navigation.navigate('screens/customer/orders/CheckoutScreen')}
        style={styles.cartButton}
      >
        <Feather name="shopping-cart" size={20} color="#fff" />
        
        <View style={styles.textContainer}>
          <Text style={styles.viewCartText}>View Cart</Text>
          <Text style={styles.itemsText}>{totalItems} items</Text>
        </View>
        
        <Feather name="chevron-right" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 70 : 50,
    alignSelf: 'center', // Centers the cart horizontally
    backgroundColor: 'transparent',
    zIndex: 1000,
  },
  cartButton: {
    backgroundColor: '#22c55e', // Exact Zepto pink color
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    height: 60,
    // Shadow
    shadowColor: '#FF1493',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  textContainer: {
    marginLeft: 12,
    marginRight: 16,
  },
  viewCartText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  itemsText: {
    color: '#fff',
    fontWeight: '400',
    fontSize: 14,
    marginTop: 2,
  },
});

export default FloatingCart;
