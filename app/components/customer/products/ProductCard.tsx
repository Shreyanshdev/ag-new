import React, { memo, useMemo, useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Dimensions,
} from 'react-native';
import OptimizedImage from '../../../../src/components/OptimizedImage';
import { useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCart } from '../../../../src/context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../../../../types/types';

const { width } = Dimensions.get('window');
const cardWidth = (width - 48) / 2; // 24px margin on each side

interface ProductCardProps {
  product: Product;
  variant?: 'default' | 'featured';
}

const ProductCard: React.FC<ProductCardProps> = memo(({
  product,
  variant = 'default'
}) => {
  const navigation = useNavigation();
  const { addToCart, incrementQuantity, decrementQuantity, cart, totalCost } = useCart();
  const [userIsSubscribed, setUserIsSubscribed] = useState(false);

  // Get subscription status from AsyncStorage
  useEffect(() => {
    const getSubscriptionStatus = async () => {
      try {
        const flag = await AsyncStorage.getItem('isSubscription');
        setUserIsSubscribed(flag === 'true');
      } catch (error) {
        console.error('Error loading subscription status:', error);
        setUserIsSubscribed(false);
      }
    };
    getSubscriptionStatus();
  }, []);

  // Memoized price calculations
  const priceInfo = useMemo(() => {
    const basePrice = product.basePrice ?? 0;
    const discountPrice = product.discountPrice;

    const effectivePrice = (discountPrice !== undefined && discountPrice < basePrice)
      ? discountPrice
      : basePrice;

    const hasDiscount = discountPrice !== undefined && discountPrice < basePrice;
    const discountPercentage = hasDiscount
      ? Math.round(((basePrice - discountPrice!) / basePrice) * 100)
      : 0;

    return {
      basePrice,
      discountPrice,
      effectivePrice,
      hasDiscount,
      discountPercentage
    };
  }, [product.basePrice, product.discountPrice]);

  // Memoized cart and stock info
  const cartAndStockInfo = useMemo(() => {
    const cartItem = cart.find(item => item.productId === product._id);
    const quantityInCart = cartItem?.quantity ?? 0;
    const stock = product.stock ?? 0;
    const isOutOfStock = stock <= 0;
    const isLowStock = stock > 0 && stock <= 5;

    return {
      cartItem,
      quantityInCart,
      stock,
      isOutOfStock,
      isLowStock
    };
  }, [cart, product._id, product.stock]);

  // Memoized navigation handler
  const handlePress = useCallback(() => {
    (navigation as any).navigate('screens/customer/products/ProductDetailScreen', {
      productId: product._id
    });
  }, [navigation, product._id]);

  // Memoized add to cart handler
  const handleAddToCart = useCallback(() => {
    console.log('🛒 Add to cart clicked for product:', product.name);
    console.log('🛒 Product data:', {
      _id: product._id,
      name: product.name,
      basePrice: product.basePrice,
      stock: product.stock
    });
    console.log('🛒 Stock info:', cartAndStockInfo);
    console.log('🛒 User subscribed:', userIsSubscribed);
    console.log('🛒 Total cost:', totalCost);

    if (cartAndStockInfo.isOutOfStock) {
      console.log('🛒 Product is out of stock');
      Alert.alert('Out of Stock', 'This product is currently out of stock.');
      return;
    }

    if (cartAndStockInfo.quantityInCart === 0) {
      console.log('🛒 Adding new item to cart');
      try {
        addToCart(product, 'retail', 1, userIsSubscribed, totalCost);
        console.log('🛒 addToCart function called successfully');
      } catch (error) {
        console.error('🛒 Error calling addToCart:', error);
      }
    } else if (cartAndStockInfo.quantityInCart < cartAndStockInfo.stock) {
      console.log('🛒 Incrementing existing item');
      incrementQuantity(product._id);
    } else {
      Alert.alert('Stock Limit', 'You have reached the maximum available stock.');
    }
  }, [cartAndStockInfo, product, userIsSubscribed, totalCost, addToCart, incrementQuantity]);

  // Memoized remove from cart handler
  const handleRemoveFromCart = useCallback(() => {
    decrementQuantity(product._id);
  }, [decrementQuantity, product._id]);

  const cardStyle = variant === 'featured' ? styles.featuredCard : styles.defaultCard;

  return (
    <TouchableOpacity
      style={[styles.card, cardStyle]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <View style={styles.imageContainer}>
        <OptimizedImage
          uri={product.images?.[0] || 'https://via.placeholder.com/150x150/f0f0f0/cccccc?text=No+Image'}
          style={styles.image}
          placeholder="https://via.placeholder.com/150x150/f0f0f0/cccccc?text=Loading"
          showLoader={true}
          loaderColor="#22c55e"
        />

        {/* Badges */}
        <View style={styles.badgesContainer}>
          {product.featured && (
            <View style={styles.featuredBadge}>
              <Text style={styles.featuredText}>FEATURED</Text>
            </View>
          )}
          {priceInfo.hasDiscount && (
            <View style={styles.discountBadge}>
              <Text style={styles.discountText}>{priceInfo.discountPercentage}% OFF</Text>
            </View>
          )}
        </View>

        {/* Out of stock overlay */}
        {cartAndStockInfo.isOutOfStock && (
          <View style={styles.outOfStockOverlay}>
            <Text style={styles.outOfStockText}>Out of Stock</Text>
          </View>
        )}
      </View>

      <View style={styles.contentContainer}>
        {/* Brand */}
        {product.brand && (
          <Text style={styles.brandText}>{product.brand}</Text>
        )}

        {/* Product name */}
        <Text style={styles.productName} numberOfLines={2}>
          {product.name}
        </Text>

        {/* Quantity */}
        <Text style={styles.quantityText}>
          {product.quantityValue} {product.quantityUnit}
        </Text>

        {/* Stock status */}
        {cartAndStockInfo.isLowStock && !cartAndStockInfo.isOutOfStock && (
          <Text style={styles.lowStockText}>Only {cartAndStockInfo.stock} left!</Text>
        )}

        {/* Price section */}
        <View style={styles.priceContainer}>
          <Text style={styles.currentPrice}>₹{priceInfo.effectivePrice.toFixed(2)}</Text>
          {priceInfo.hasDiscount && (
            <Text style={styles.originalPrice}>₹{priceInfo.basePrice.toFixed(2)}</Text>
          )}
        </View>

        {/* Wholesale hint for subscribed users */}
        {userIsSubscribed && product.subscriptionPrice && product.unitPerSubscription && (
          <Text style={styles.wholesaleHint}>
            Wholesale: ₹{(product.subscriptionPrice / product.unitPerSubscription).toFixed(2)}/unit
          </Text>
        )}

        {/* Cart controls */}
        <View style={styles.cartSection}>
          {cartAndStockInfo.quantityInCart > 0 ? (
            <View style={styles.quantityControls}>
              <TouchableOpacity
                style={styles.quantityButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleRemoveFromCart();
                }}
              >
                <MaterialCommunityIcons name="minus" size={16} color="#22c55e" />
              </TouchableOpacity>

              <Text style={styles.quantityText}>{cartAndStockInfo.quantityInCart}</Text>

              <TouchableOpacity
                style={styles.quantityButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleAddToCart();
                }}
                disabled={cartAndStockInfo.quantityInCart >= cartAndStockInfo.stock}
              >
                <MaterialCommunityIcons name="plus" size={16} color="#22c55e" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.addButton, cartAndStockInfo.isOutOfStock && styles.disabledButton]}
              onPress={(e) => {
                e.stopPropagation();
                handleAddToCart();
              }}
              disabled={cartAndStockInfo.isOutOfStock}
            >
              <MaterialCommunityIcons name="cart-plus" size={16} color="#fff" />
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    margin: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  defaultCard: {
    width: cardWidth,
  },
  featuredCard: {
    width: cardWidth,
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  imageContainer: {
    width: '100%',
    height: 140,
    position: 'relative',
    backgroundColor: '#f9fafb',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  badgesContainer: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'column',
    gap: 4,
  },
  featuredBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  featuredText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  discountBadge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  discountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  outOfStockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  contentContainer: {
    padding: 12,
  },
  brandText: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  quantityText: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  lowStockText: {
    fontSize: 11,
    color: '#f59e0b',
    fontWeight: '600',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  originalPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginLeft: 8,
  },
  wholesaleHint: {
    fontSize: 10,
    color: '#059669',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  cartSection: {
    marginTop: 8,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 4,
  },
  addButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    backgroundColor: '#9ca3af',
  },
});

export default ProductCard;
