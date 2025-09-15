import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Product, PricingMode, ProductPricingDisplay } from '../../../../types/types';
import { useCart } from '../../../../src/context/CartContext';

interface EnhancedProductCardV2Props {
  product: Product;
  onPress?: () => void;
  userIsSubscribed?: boolean;
  cartTotal?: number;
}

type RootStackParamList = {
  'screens/customer/products/ProductDetailScreen': { productId: string };
};

type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

const { width } = Dimensions.get('window');
const cardWidth = (width - 100 - 32) / 2; // Sidebar width is 100, padding is 32

const EnhancedProductCardV2: React.FC<EnhancedProductCardV2Props> = ({
  product,
  onPress,
  userIsSubscribed = false,
  cartTotal = 0,
}) => {
  const navigation = useNavigation<NavigationProps>();
  const { addToCart, incrementQuantity, decrementQuantity, cart, calculatePricing } = useCart();
  const [selectedPricingMode, setSelectedPricingMode] = useState<PricingMode>('retail');

  if (!product) {
    return null;
  }

  const cartItem = cart.find((item) => item.productId === product._id);
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  const normalizedProduct = {
    ...product,
    price: product.basePrice || 0,
    discountPrice: product.discountPrice,
    stock: product.stock !== undefined ? product.stock : 0,
    subscriptionPrice: product.subscriptionPrice || 0,
    unitPerSubscription: product.unitPerSubscription || 1,
  };

  const pricing = calculatePricing(normalizedProduct, selectedPricingMode, userIsSubscribed, cartTotal);
  const isOutOfStock = !pricing.isAvailable;

  const handlePressCard = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.navigate('screens/customer/products/ProductDetailScreen', { productId: product._id });
    }
  };

  const handleAddToCart = () => {
    if (isOutOfStock) {
      Alert.alert('Out of Stock', pricing.reason || 'This product is currently out of stock.');
      return;
    }
    addToCart(normalizedProduct, selectedPricingMode, 1);
  };

  const handleQuantityChange = (type: 'increment' | 'decrement') => {
    if (type === 'increment') {
      if (quantityInCart + 1 <= normalizedProduct.stock) {
        incrementQuantity(product._id);
      } else {
        Alert.alert('Insufficient Stock', 'You have reached the maximum available stock for this product.');
      }
    } else if (type === 'decrement') {
      decrementQuantity(product._id);
    }
  };

  const pricingDisplay: ProductPricingDisplay = {
    retail: {
      unitPrice: calculatePricing(normalizedProduct, 'retail', userIsSubscribed, cartTotal).unitPrice,
      originalPrice: normalizedProduct.discountPrice ? normalizedProduct.price : undefined,
      discountPercentage: normalizedProduct.discountPrice ? Math.round(((normalizedProduct.price - normalizedProduct.discountPrice) / normalizedProduct.price) * 100) : undefined,
      isAvailable: calculatePricing(normalizedProduct, 'retail', userIsSubscribed, cartTotal).isAvailable,
    },
  };

  return (
    <TouchableOpacity
      style={styles.cardContainer}
      onPress={handlePressCard}
      activeOpacity={0.9}
    >
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: product.images?.[0] || 'https://via.placeholder.com/200x200' }}
          style={styles.image}
        />
        {pricingDisplay.retail.discountPercentage && (
          <View style={styles.discountBadge}>
            <Text style={styles.discountText}>
              {pricingDisplay.retail.discountPercentage}% OFF
            </Text>
          </View>
        )}
      </View>
      <View style={styles.contentContainer}>
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>
        <Text style={styles.productQuantity}>
          {product.quantityValue} {product.quantityUnit}
        </Text>
        <View style={styles.priceRow}>
            <Text style={styles.currentPrice}>
              ₹{pricingDisplay.retail.unitPrice.toFixed(2)}
            </Text>
            {pricingDisplay.retail.originalPrice && (
              <Text style={styles.originalPrice}>
                ₹{pricingDisplay.retail.originalPrice.toFixed(2)}
              </Text>
            )}
          </View>
      </View>
      <View style={styles.cartControls}>
        {quantityInCart > 0 ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange('decrement')}
            >
              <MaterialCommunityIcons name="minus" size={16} color="#22c55e" />
            </TouchableOpacity>
            <Text style={styles.quantityInCartText}>{quantityInCart}</Text>
            <TouchableOpacity
              style={styles.quantityButton}
              onPress={() => handleQuantityChange('increment')}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#22c55e" />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.addButton} onPress={handleAddToCart} disabled={isOutOfStock}>
            <MaterialCommunityIcons name="plus" size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
    cardContainer: {
      backgroundColor: '#ffffff',
      borderRadius: 12,
      margin: 6,
      width: cardWidth,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    imageContainer: {
      width: '100%',
      height: 120,
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12,
      overflow: 'hidden',
      position: 'relative',
    },
    image: {
      width: '100%',
      height: '100%',
    },
    discountBadge: {
      position: 'absolute',
      top: 8,
      left: 8,
      backgroundColor: '#ef4444',
      borderRadius: 4,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    discountText: {
      color: '#ffffff',
      fontSize: 10,
      fontWeight: '700',
    },
    contentContainer: {
      padding: 12,
    },
    productName: {
      fontSize: 14,
      fontWeight: '600',
      color: '#1f2937',
      marginBottom: 4,
    },
    productQuantity: {
      fontSize: 12,
      color: '#6b7280',
      marginBottom: 8,
    },
    priceRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    currentPrice: {
      fontSize: 16,
      fontWeight: '700',
      color: '#1f2937',
    },
    originalPrice: {
      fontSize: 12,
      color: '#9ca3af',
      textDecorationLine: 'line-through',
      marginLeft: 8,
    },
    cartControls: {
      paddingHorizontal: 12,
      paddingBottom: 12,
    },
    addButton: {
      backgroundColor: '#22c55e',
      borderRadius: 8,
      height: 36,
      justifyContent: 'center',
      alignItems: 'center',
    },
    quantityControls: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: '#f0fdf4',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: '#bbf7d0',
      height: 36,
    },
    quantityButton: {
      padding: 8,
    },
    quantityInCartText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#15803d',
      paddingHorizontal: 8,
    },
});

export default EnhancedProductCardV2;