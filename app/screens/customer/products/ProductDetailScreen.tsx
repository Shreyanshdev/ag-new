import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCart } from '../../../../src/context/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getProductById, getProductVariants, getRelatedProducts } from '../../../../src/config/api';
import FloatingCart from '../../../components/shared/FloatingCart';

const { width, height } = Dimensions.get('window');

// Product Type Definition
interface Product {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  category: {
    _id: string;
    name: string;
  } | string;
  brand?: string;
  images: string[];
  quantityValue: string;
  quantityUnit: string;
  basePrice: number;
  discountPrice?: number;
  subscriptionPrice?: number;
  unitPerSubscription?: number;
  stock: number;
  lowStockThreshold?: number;
  tags?: string[];
  variants?: string[];
  relatedProducts?: string[];
  featured?: boolean;
  status: 'active' | 'inactive';
  price?: number; // Legacy compatibility
  retail?: {
    unitPrice: number;
  };
  wholesale?: {
    bundlePrice: number;
    unitsPerBundle: number;
    unitPrice: number;
  };
}

interface PricingInfo {
  retailPrice: number;
  subscriptionUnitPrice?: number;
  subscriptionBundlePrice?: number;
  unitsPerBundle?: number;
  canUseSubscription: boolean;
  subscriptionSavings?: number;
  subscriptionSavingsPercentage?: number;
}

const ProductDetailScreen = () => {
  const params = useLocalSearchParams();
  const productId = params.productId as string;
  const navigation = useNavigation();
  
  const { 
    addToCart, 
    incrementQuantity, 
    decrementQuantity, 
    cart, 
    totalCost
  } = useCart();
  
  const [userIsSubscribed, setUserIsSubscribed] = useState(false);
  const cartTotal = totalCost;

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

  // State management
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [variants, setVariants] = useState<Product[]>([]);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const scrollViewRef = useRef<ScrollView>(null);

  const scrollToTop = () => {
    scrollViewRef.current?.scrollTo({ y: 0, animated: true });
  };

  console.log('Usersubscription', userIsSubscribed);

  // Cart calculations
  const cartItem = product ? cart.find(item => item.productId === product._id) : undefined;
  const quantityInCart = cartItem ? cartItem.quantity : 0;

  // Calculate bundle breakdown for current cart item
  const getBundleBreakdown = () => {
    if (!cartItem || !userIsSubscribed || !product || !product.subscriptionPrice || !product.unitPerSubscription) {
      return null;
    }

    const quantity = cartItem.quantity;
    const unitPerSubscription = product.unitPerSubscription;
    const bundleCount = Math.floor(quantity / unitPerSubscription);
    const extraUnits = quantity % unitPerSubscription;
    const retailUnitPrice = product.discountPrice || product.basePrice;

    if (bundleCount === 0) {
      return null; // No bundles, only individual units
    }

    return {
      bundleCount,
      extraUnits,
      unitPerSubscription,
      subscriptionPrice: product.subscriptionPrice,
      retailUnitPrice,
      bundleTotal: bundleCount * product.subscriptionPrice,
      extraTotal: extraUnits * retailUnitPrice,
      totalUnits: (bundleCount * unitPerSubscription) + extraUnits
    };
  };

  const bundleBreakdown = getBundleBreakdown();

  // Pricing calculations
 // In ProductDetailScreen.tsx, modify the pricingInfo calculation:

const pricingInfo: PricingInfo | null = product ? (() => {
  const retailPrice = product.discountPrice || product.basePrice;
  const hasSubscriptionPricing = product.subscriptionPrice && product.unitPerSubscription;
  
  if (!hasSubscriptionPricing || !userIsSubscribed) {
    return {
      retailPrice,
      canUseSubscription: false,
    };
  }

  const subscriptionUnitPrice = product.subscriptionPrice! / product.unitPerSubscription!;
  const subscriptionSavings = (retailPrice - subscriptionUnitPrice) * product.unitPerSubscription!;
  const subscriptionSavingsPercentage = Math.round((subscriptionSavings / (retailPrice * product.unitPerSubscription!)) * 100);

  return {
    retailPrice,
    subscriptionUnitPrice,
    subscriptionBundlePrice: product.subscriptionPrice,
    unitsPerBundle: product.unitPerSubscription,
    canUseSubscription: cartTotal >= 2500, // Remove userIsSubscribed check here
    subscriptionSavings,
    subscriptionSavingsPercentage,
  };
})() : null;


  // Fetch product data
  useEffect(() => {
    const fetchProduct = async () => {
      if (!productId) {
        setLoading(false);
        Alert.alert('Error', 'Product ID missing');
        return;
      }

      try {
        const response = await getProductById(productId);
        const productData = { ...response.data, id: response.data._id ?? response.data.id };
        setProduct(productData);

        // Fetch variants and related products
        try {
          const [variantsResponse, relatedResponse] = await Promise.all([
            getProductVariants(productId),
            getRelatedProducts(productId)
          ]);
          
          setVariants(variantsResponse.data || []);
          setRelatedProducts(relatedResponse.data || []);
        } catch (error) {
          console.warn('Failed to fetch variants/related products:', error);
        }
      } catch (error) {
        console.error('Failed to load product details:', error);
        Alert.alert('Error', 'Failed to load product details');
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Handle adding individual units
  const handleAddIndividualUnit = () => {
    if (!product || !pricingInfo) return;

    if (product.stock <= 0) {
      Alert.alert('Out of Stock', 'This item is currently out of stock');
      return;
    }

    addToCart(product, 'retail', 1, userIsSubscribed, cartTotal);
  };

  // Handle adding subscription bundle
  const handleAddSubscriptionBundle = () => {
    if (!product || !pricingInfo ) return;

    if (product.stock < pricingInfo.unitsPerBundle!) {
      Alert.alert('Insufficient Stock', `Only ${product.stock} units available, but bundle requires ${pricingInfo.unitsPerBundle}`);
      return;
    }

    addToCart(product, 'wholesale', pricingInfo.unitsPerBundle!, userIsSubscribed, cartTotal);
  };

  // Handle adding one bundle
  const handleAddBundle = () => {
    if (!product || !pricingInfo) return;

    if (product.stock < pricingInfo.unitsPerBundle!) {
      Alert.alert('Insufficient Stock', `Only ${product.stock} units available, but bundle requires ${pricingInfo.unitsPerBundle}`);
      return;
    }

    addToCart(product, 'wholesale', pricingInfo.unitsPerBundle!, userIsSubscribed, cartTotal);
  };

  // Handle subtracting one bundle
  const handleSubtractBundle = () => {
    if (!product || !pricingInfo || !cartItem) return;

    const currentQuantity = cartItem.quantity;
    const bundleSize = pricingInfo.unitsPerBundle!;
    
    if (currentQuantity < bundleSize) {
      // If current quantity is less than a bundle, remove all units
      for (let i = 0; i < currentQuantity; i++) {
        decrementQuantity(product._id);
      }
    } else {
      // Remove one bundle worth of units
      for (let i = 0; i < bundleSize; i++) {
        decrementQuantity(product._id);
      }
    }
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading product details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (!product) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Product Not Found</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.lowStockThreshold && product.stock <= product.lowStockThreshold;
  const hasDiscount = product.discountPrice && product.discountPrice < product.basePrice;
  const discountPercentage = hasDiscount 
    ? Math.round(((product.basePrice - product.discountPrice!) / product.basePrice) * 100) 
    : 0;

  // Render image carousel
  const renderImageCarousel = () => {
    const images = product.images && product.images.length > 0 ? product.images : ['https://via.placeholder.com/400x400'];

    return (
      <View style={styles.imageSection}>
        <FlatList
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(event) => {
            const index = Math.round(event.nativeEvent.contentOffset.x / width);
            setSelectedImageIndex(index);
          }}
          renderItem={({ item, index }) => (
            <View style={styles.imageContainer}>
              <Image source={{ uri: item }} style={styles.productImage} />
              {hasDiscount && index === 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>{discountPercentage}% OFF</Text>
                </View>
              )}
              {isOutOfStock && index === 0 && (
                <View style={styles.outOfStockOverlay}>
                  <Text style={styles.outOfStockText}>Out of Stock</Text>
                </View>
              )}
            </View>
          )}
          keyExtractor={(item, index) => index.toString()}
        />
        
        {images.length > 1 && (
          <View style={styles.imageIndicators}>
            {images.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.imageIndicator,
                  selectedImageIndex === index && styles.activeImageIndicator
                ]}
              />
            ))}
          </View>
        )}
      </View>
    );
  };

  // Render badges
  const renderBadges = () => {
    const badges = [];
    
    if (product.featured) badges.push({ text: 'Featured', color: '#3b82f6', bg: '#dbeafe' });
    if (hasDiscount) badges.push({ text: `${discountPercentage}% OFF`, color: '#ef4444', bg: '#fee2e2' });
    if (pricingInfo?.canUseSubscription) badges.push({ text: 'Wholesale Available', color: '#059669', bg: '#d1fae5' });
    if (isLowStock && !isOutOfStock) badges.push({ text: 'Limited Stock', color: '#f59e0b', bg: '#fef3c7' });

    return badges.length > 0 ? (
      <View style={styles.badgesContainer}>
        {badges.map((badge, index) => (
          <View key={index} style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Text style={[styles.badgeText, { color: badge.color }]}>{badge.text}</Text>
          </View>
        ))}
      </View>
    ) : null;
  };

  // Render stock information
  const renderStockInfo = () => {
    let stockColor = '#10b981';
    let stockText = `In Stock (${product.stock})`;
    let stockIcon = 'check-circle';

    if (isOutOfStock) {
      stockColor = '#ef4444';
      stockText = 'Out of Stock';
      stockIcon = 'close-circle';
    } else if (isLowStock) {
      stockColor = '#f59e0b';
      stockText = `Limited Stock (${product.stock} left)`;
      stockIcon = 'alert-circle';
    }

    return (
      <View style={styles.stockContainer}>
        <MaterialCommunityIcons name={stockIcon as any} size={20} color={stockColor} />
        <Text style={[styles.stockText, { color: stockColor }]}>{stockText}</Text>
      </View>
    );
  };

  // Render pricing section
  // In ProductDetailScreen.tsx, update renderPricingSection:
  const renderPricingSection = () => {
    if (!pricingInfo) return null;

    return (
      <View style={styles.pricingSection}>
        {/* Retail Pricing */}
        <View style={styles.priceRow}>
          <Text style={styles.sectionTitle}>Individual Unit Price</Text>
          <View style={styles.priceContainer}>
            <Text style={styles.currentPrice}>₹{pricingInfo.retailPrice.toFixed(2)}</Text>
            {hasDiscount && (
              <Text style={styles.originalPrice}>₹{product.basePrice.toFixed(2)}</Text>
            )}
          </View>
        </View>

        {/* Subscription Pricing for Subscribed Users */}
        {userIsSubscribed && pricingInfo.subscriptionBundlePrice && (
          <View style={styles.wholesalePricingCard}>
            <View style={styles.wholesaleHeader}>
              <MaterialCommunityIcons name="package-variant" size={20} color="#15803d" />
              <Text style={styles.wholesaleTitle}>Wholesale Bundle Price</Text>
            </View>
            <View style={styles.wholesaleDetails}>
              <Text style={styles.bundleText}>
                {pricingInfo.unitsPerBundle} units for ₹{pricingInfo.subscriptionBundlePrice.toFixed(2)}
              </Text>
              <Text style={styles.bundleUnitPrice}>
                ₹{pricingInfo.subscriptionUnitPrice!.toFixed(2)} per unit
              </Text>
              <Text style={styles.savingsText}>
                You save ₹{pricingInfo.subscriptionSavings!.toFixed(2)} ({pricingInfo.subscriptionSavingsPercentage}%)
              </Text>
            </View>
            
            <View style={styles.wholesaleNotice}>
              <MaterialCommunityIcons name="information" size={16} color="#15803d" />
              <Text style={styles.wholesaleNoticeText}>
                Wholesale pricing applies only when your final cart total is ≥ ₹2500. If your cart total is below ₹2500 at checkout, retail prices will be applied instead.
              </Text>
            </View>
          </View>
        )}

        {/* Subscription Benefits for Non-Subscribed Users */}
        {!userIsSubscribed && product.subscriptionPrice && (
          <View style={styles.subscriptionPrompt}>
            <MaterialCommunityIcons name="star" size={24} color="#f59e0b" />
            <View style={styles.subscriptionPromptContent}>
              <Text style={styles.subscriptionPromptTitle}>Get Wholesale Pricing!</Text>
              <Text style={styles.subscriptionPromptText}>
                Subscribe to get {pricingInfo.unitsPerBundle} units for just ₹{product.subscriptionPrice.toFixed(2)}
              </Text>
              <TouchableOpacity style={styles.contactAdminButton}>
                <Text style={styles.contactAdminButtonText}>Contact Admin</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    );
  };


  // Render add to cart section
  const renderAddToCartSection = () => {
    const canAddIndividual = !isOutOfStock;
    const canAddBundle = userIsSubscribed && 
      pricingInfo?.subscriptionBundlePrice &&
      product.stock >= (pricingInfo?.unitsPerBundle || 0);
      // Removed cartTotal >= 2500 check
  
    return (
      <View style={styles.addToCartSection}>
        {/* Individual Unit Button */}
        <View style={styles.addToCartOption}>
          <Text style={styles.addToCartOptionTitle}>Add Individual Units</Text>
          <Text style={styles.addToCartOptionSubtitle}>₹{pricingInfo?.retailPrice.toFixed(2)} each</Text>
          
          {quantityInCart === 0 ? (
            <TouchableOpacity 
              onPress={handleAddIndividualUnit} 
              style={[styles.addToCartButton, !canAddIndividual && styles.disabledButton]}
              disabled={!canAddIndividual}
            >
              <MaterialCommunityIcons name="cart-plus" size={20} color="#fff" />
              <Text style={styles.addToCartButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          ) : (
            <View>
              <View style={styles.counterContainer}>
                <TouchableOpacity 
                  onPress={() => decrementQuantity(product._id)} 
                  style={styles.counterButton}
                >
                  <MaterialCommunityIcons name="minus" size={20} color="#22c55e" />
                </TouchableOpacity>
                <Text style={styles.counterText}>{quantityInCart}</Text>
                <TouchableOpacity 
                  onPress={() => incrementQuantity(product._id)} 
                  style={styles.counterButton}
                >
                  <MaterialCommunityIcons name="plus" size={20} color="#22c55e" />
                </TouchableOpacity>
              </View>

              {/* Bundle/Unit Breakdown for Subscribed Users */}
              {bundleBreakdown && (
                <View style={styles.bundleBreakdownContainer}>
                  <Text style={styles.bundleBreakdownText}>
                    {bundleBreakdown.bundleCount} bundle{bundleBreakdown.bundleCount > 1 ? 's' : ''} 
                    ({bundleBreakdown.bundleCount * bundleBreakdown.unitPerSubscription} units)
                    {bundleBreakdown.extraUnits > 0 && ` + ${bundleBreakdown.extraUnits} extra unit${bundleBreakdown.extraUnits > 1 ? 's' : ''}`}
                  </Text>
                  <Text style={styles.bundlePriceText}>
                    Bundle: ₹{bundleBreakdown.bundleTotal.toFixed(2)}
                    {bundleBreakdown.extraUnits > 0 && ` + ₹${bundleBreakdown.extraTotal.toFixed(2)}`}
                  </Text>
                </View>
              )}

              {/* Bundle Control Buttons for Subscribed Users */}
              {userIsSubscribed && pricingInfo?.subscriptionBundlePrice && (
                <View style={styles.bundleControlsContainer}>
                  <TouchableOpacity 
                    onPress={handleSubtractBundle}
                    style={[styles.bundleControlButton, styles.bundleSubtractButton]}
                    disabled={quantityInCart === 0}
                  >
                    <MaterialCommunityIcons name="package-variant" size={16} color="#fff" />
                    <MaterialCommunityIcons name="minus" size={12} color="#fff" />
                    <Text style={styles.bundleControlButtonText}>Bundle</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    onPress={handleAddBundle}
                    style={[styles.bundleControlButton, styles.bundleAddButton]}
                    disabled={product.stock < (pricingInfo?.unitsPerBundle || 0)}
                  >
                    <MaterialCommunityIcons name="package-variant" size={16} color="#fff" />
                    <MaterialCommunityIcons name="plus" size={12} color="#fff" />
                    <Text style={styles.bundleControlButtonText}>Bundle</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
  
        {/* Bundle Button for Subscribed Users */}
        {userIsSubscribed && pricingInfo?.subscriptionBundlePrice && (
          <View style={styles.addToCartOption}>
            <Text style={styles.addToCartOptionTitle}>Add Wholesale Bundle</Text>
            <Text style={styles.addToCartOptionSubtitle}>
              {pricingInfo.unitsPerBundle} units for ₹{pricingInfo.subscriptionBundlePrice.toFixed(2)}
            </Text>
            
            {/* Show info message instead of blocking */}
            {cartTotal < 2500 && (
              <Text style={styles.bundleInfo}>
                💡 Wholesale pricing will apply only if your final cart total is ≥ ₹2500. Otherwise, retail prices will be used.
              </Text>
            )}
            
            <TouchableOpacity 
              onPress={handleAddSubscriptionBundle} 
              style={[styles.bundleButton, canAddBundle ? styles.activeBundleButton : styles.disabledButton]}
              disabled={!canAddBundle}
            >
              <MaterialCommunityIcons name="package-variant" size={20} color="#fff" />
              <Text style={styles.bundleButtonText}>Add Bundle of {pricingInfo.unitsPerBundle}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{product.name}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerButton}>
            <MaterialCommunityIcons name="share-variant" size={24} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView ref={scrollViewRef} style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        {/* Image Carousel */}
        {renderImageCarousel()}

        {/* Product Information */}
        <View style={styles.contentContainer}>
          {/* Badges */}
          {renderBadges()}

          {/* Brand and Name */}
          {product.brand && <Text style={styles.brandText}>{product.brand}</Text>}
          <Text style={styles.productName}>{product.name}</Text>

          {/* Stock Information */}
          {renderStockInfo()}

          {/* Pricing Section */}
          {renderPricingSection()}

          {/* Product Details */}
          <View style={styles.detailsSection}>
            <Text style={styles.sectionTitle}>Product Details</Text>
            <View style={styles.detailsGrid}>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Quantity</Text>
                <Text style={styles.detailValue}>{product.quantityValue} {product.quantityUnit}</Text>
              </View>
              <View style={styles.detailItem}>
                <Text style={styles.detailLabel}>Category</Text>
                <Text style={styles.detailValue}>
                  {typeof product.category === 'object' ? product.category.name : product.category || 'N/A'}
                </Text>
              </View>
            </View>
          </View>

          {/* Description */}
          {product.description && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Description</Text>
              <Text style={styles.sectionText}>{product.description}</Text>
            </View>
          )}

          {/* Tags */}
          {product.tags && product.tags.length > 0 && (
            <View style={styles.tagsContainer}>
              <Text style={styles.sectionTitle}>Tags</Text>
              <View style={styles.tagsList}>
                {product.tags.map((tag, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Variants */}
          {variants.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Variants</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.variantsScroll}>
                {variants.map((variant) => (
                  <TouchableOpacity
                    key={variant._id}
                    style={styles.variantCard}
                    onPress={() => {
                      (navigation as any).navigate('screens/customer/products/ProductDetailScreen', { 
                        productId: variant._id 
                      });
                      setTimeout(() => scrollToTop(), 100);
                    }}
                  >
                    <Image 
                      source={{ uri: variant.images?.[0] || 'https://via.placeholder.com/100x100' }} 
                      style={styles.variantImage} 
                    />
                    <Text style={styles.variantName}>{variant.name}</Text>
                    <Text style={styles.variantQuantity}>{variant.quantityValue} {variant.quantityUnit}</Text>
                    <Text style={styles.variantPrice}>₹{(variant.discountPrice || variant.basePrice).toFixed(2)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Related Products */}
          {relatedProducts.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Related Products</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relatedScroll}>
                {relatedProducts.map((relatedProduct) => (
                  <TouchableOpacity
                    key={relatedProduct._id}
                    style={styles.relatedProductCard}
                    onPress={() => {
                      (navigation as any).navigate('screens/customer/products/ProductDetailScreen', {
                        productId: relatedProduct._id
                      });
                      setTimeout(() => scrollToTop(), 100);
                    }}
                  >
                    <Image 
                      source={{ uri: relatedProduct.images?.[0] || 'https://via.placeholder.com/150x100' }} 
                      style={styles.relatedProductImage} 
                    />
                    <Text style={styles.relatedProductName}>{relatedProduct.name}</Text>
                    <Text style={styles.relatedProductPrice}>
                      ₹{(relatedProduct.discountPrice || relatedProduct.basePrice).toFixed(2)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Add to Cart Section */}
          {renderAddToCartSection()}
        </View>
      </ScrollView>

      {/* Floating Cart */}
      <FloatingCart />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fafafa'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginTop: 16,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    flex: 1,
    marginHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  scrollContainer: {
    flex: 1,
  },
  
  // Image Section
  imageSection: {
    backgroundColor: '#fff',
    paddingBottom: 16,
  },
  imageContainer: {
    width: width,
    height: height * 0.4,
    position: 'relative',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  discountBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  discountText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  // In ProductDetailScreen.tsx styles, add:
bundleInfo: {
  fontSize: 12,
  color: '#059669',
  backgroundColor: '#f0fdf4',
  padding: 8,
  borderRadius: 6,
  marginBottom: 8,
  fontStyle: 'italic',
  lineHeight: 16,
},

  outOfStockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  outOfStockText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageIndicators: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  imageIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#d1d5db',
  },
  activeImageIndicator: {
    backgroundColor: '#22c55e',
    width: 24,
  },

  // Content Container
  contentContainer: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 20,
  },
  
  // Badges
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Product Info
  brandText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  productName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
    lineHeight: 32,
  },
  
  // Stock
  stockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stockText: {
    fontSize: 14,
    fontWeight: '500',
  },

  // Pricing Section
  pricingSection: {
    marginBottom: 24,
  },
  priceRow: {
    marginBottom: 16,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  currentPrice: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  originalPrice: {
    fontSize: 20,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
  },
  
  // Wholesale Pricing
  wholesalePricingCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#22c55e',
    marginBottom: 16,
  },
  wholesaleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  wholesaleTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#15803d',
  },
  wholesaleDetails: {
    marginBottom: 12,
  },
  bundleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  bundleUnitPrice: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  savingsText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#059669',
  },
  wholesaleNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 8,
  },
  wholesaleNoticeText: {
    fontSize: 12,
    color: '#6b7280',
    flex: 1,
    lineHeight: 16,
  },

  // Subscription Prompt
  subscriptionPrompt: {
    flexDirection: 'row',
    backgroundColor: '#fef3c7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginTop: 16,
  },
  subscriptionPromptContent: {
    flex: 1,
    marginLeft: 12,
  },
  subscriptionPromptTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  subscriptionPromptText: {
    fontSize: 14,
    color: '#a16207',
    marginBottom: 12,
    lineHeight: 20,
  },
  contactAdminButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  contactAdminButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Add to Cart Section
  addToCartSection: {
    gap: 16,
    marginTop: 24,
  },
  addToCartOption: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  addToCartOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  addToCartOptionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  addToCartButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bundleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6b7280',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    gap: 8,
  },
  activeBundleButton: {
    backgroundColor: '#059669',
  },
  bundleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bundleWarning: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  disabledButton: {
    backgroundColor: '#d1d5db',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 4,
    gap: 16,
  },
  counterButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  counterText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#166534',
    minWidth: 30,
    textAlign: 'center',
  },

  // Bundle Breakdown Styles
  bundleBreakdownContainer: {
    backgroundColor: '#f0fdf4',
    padding: 8,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  bundleBreakdownText: {
    fontSize: 11,
    color: '#166534',
    fontWeight: '500',
    marginBottom: 2,
  },
  bundlePriceText: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '600',
  },

  // Bundle Control Buttons Styles
  bundleControlsContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  bundleControlButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  bundleAddButton: {
    backgroundColor: '#059669',
  },
  bundleSubtractButton: {
    backgroundColor: '#dc2626',
  },
  bundleControlButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  // Common Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 16,
    color: '#6b7280',
    lineHeight: 24,
  },

  // Details Section
  detailsSection: {
    marginBottom: 24,
  },
  detailsGrid: {
    gap: 8,
  },
  detailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  detailLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },

  // Tags
  tagsContainer: {
    marginBottom: 24,
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 12,
    color: '#374151',
  },

  // Variants and Related Products
  variantsScroll: {
    marginTop: 12,
  },
  relatedScroll: {
    marginTop: 12,
  },
  variantCard: {
    width: 120,
    marginRight: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  variantImage: {
    width: '100%',
    height: 80,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  variantName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 16,
  },
  variantQuantity: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 4,
  },
  variantPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  relatedProductCard: {
    width: 150,
    marginRight: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  relatedProductImage: {
    width: '100%',
    height: 100,
    borderRadius: 8,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  relatedProductName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 4,
    lineHeight: 18,
  },
  relatedProductPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
  },
});

export default ProductDetailScreen;
