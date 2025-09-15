import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert, 
  ScrollView, 
  ActivityIndicator,
  Linking 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useCart } from '../../../../src/context/CartContext';
import { PaymentOptions, handlePayment } from '../../../../src/utils/paymentUtils';
import { createOrder } from '../../../../src/config/api';

interface OrderPreview {
  totalPrice: number;
  deliveryFee: number;
  items: {
    name: string;
    mode: 'retail' | 'wholesale';
    unitsBought: number;
    unitPrice: number;
    totalPrice: number;
    bundlesBought?: number;
    basePrice: number;
    discountPrice?: number;
    subscriptionPrice?: number;
    unitPerSubscription?: number;
  }[];
  wholesaleEligible: boolean;
  finalAmount: number;
}

const ReviewOrderScreen = () => {
  const navigation = useNavigation<any>();
  const { cart, clearCart } = useCart();
  const params = useLocalSearchParams();
  
  const branchId = params.branchId as string | undefined;
  const addressId = params.addressId as string | undefined;
  const deliveryFee = Number(params.deliveryFee) || 0;
  
  // State for backend-verified order data
  const [orderPreview, setOrderPreview] = useState<OrderPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  // Fetch subscription status and create order preview
  useEffect(() => {
    const initializeOrder = async () => {
      try {
        setLoading(true);
        
        // Get subscription status
        const subscription = await AsyncStorage.getItem('isSubscription');
        setIsSubscriber(subscription === 'true');
        
        // Get user ID
        const userId = await AsyncStorage.getItem('userId');
        if (!userId || !branchId || !addressId) {
          Alert.alert('Missing Information', 'Required order information is missing.');
          navigation.goBack();
          return;
        }

        // Create order preview by calling backend
        const items = cart.map(item => ({
          id: item.productId,
          count: item.quantity
        }));

        const orderPayload = {
          userId,
          items,
          branch: branchId,
          addressId,
          deliveryFee,
          preview: true // Add this flag to indicate preview mode
        };

        // Call backend to get verified pricing
        const response = await createOrder(orderPayload);
        
        // In the useEffect where you set orderPreview:
        if (response?.data?.order) {
          const order = response.data.order;
          
          setOrderPreview({
            totalPrice: order.totalPrice,
            deliveryFee: order.deliveryFee,
            items: order.items,
            wholesaleEligible: order.wholesaleEligible, // ✅ Use backend calculation
            finalAmount: order.totalPrice + order.deliveryFee
          });
        }

      } catch (error) {
        console.error('Error creating order preview:', error);
        Alert.alert('Error', 'Failed to load order details. Please try again.');
        navigation.goBack();
      } finally {
        setLoading(false);
      }
    };

    initializeOrder();
  }, [branchId, addressId, cart, isSubscriber]);

  const handlePayNow = async () => {
    if (!orderPreview) return;
    
    try {
      setProcessingPayment(true);
      const userId = await AsyncStorage.getItem('userId');
      
      const items = cart.map(item => ({ 
        id: item.productId, 
        count: item.quantity 
      }));
      
      const orderPayload = { 
        userId, 
        items, 
        branch: branchId, 
        addressId, 
        deliveryFee: orderPreview.deliveryFee
      };

      const paymentOptions: PaymentOptions = {
        orderPayload,
        onSuccess: (orderId) => {
          clearCart();
          navigation.navigate('screens/customer/orders/OrderTrackingScreen', { orderId });
        },
        onError: (error) => {
          console.error('Payment error:', error);
          Alert.alert('Payment Error', 'Payment failed. Please try again.');
        },
        onClearCart: clearCart,
        navigation
      };

      await handlePayment(paymentOptions);
    } catch (error) {
      console.error('Payment processing error:', error);
      Alert.alert('Error', 'Failed to process payment.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCOD = async () => {
    if (!orderPreview) return;
    
    try {
      setProcessingPayment(true);
      const userId = await AsyncStorage.getItem('userId');
      
      const items = cart.map(item => ({ 
        id: item.productId, 
        count: item.quantity 
      }));
      
      const orderPayload = { 
        userId, 
        items, 
        branch: branchId, 
        addressId, 
        paymentMode: 'COD',
        deliveryFee: orderPreview.deliveryFee
      };

      const response = await createOrder(orderPayload);
      const orderId = response?.data?.order?._id;
      
      if (orderId) {
        clearCart();
        navigation.navigate('screens/customer/orders/OrderTrackingScreen', { orderId });
      } else {
        Alert.alert('Order Error', 'Failed to create COD order.');
      }
    } catch (error) {
      console.error('COD order error:', error);
      Alert.alert('COD Error', 'Failed to create COD order.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleContactUs = () => {
    const phoneNumber = '7884388452';
    Linking.openURL(`tel:${phoneNumber}`);
  };

  // Render wholesale benefit message
  const renderWholesaleBenefitMessage = () => {
    if (!orderPreview) return null;

    if (isSubscriber) {
      if (orderPreview.wholesaleEligible) {
        return (
          <View style={styles.benefitContainer}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#059669" />
            <Text style={styles.benefitText}>
              🎉 Congrats! Wholesale price benefits have been applied to your order!
            </Text>
          </View>
        );
      } else {
        const remaining = 2500 - orderPreview.totalPrice;
        return (
          <View style={styles.warningContainer}>
            <MaterialCommunityIcons name="information" size={20} color="#f59e0b" />
            <Text style={styles.warningText}>
              Shop at least ₹{remaining.toFixed(0)} more to get the best wholesale rates!
            </Text>
          </View>
        );
      }
    } else {
      return (
        <View style={styles.contactContainer}>
          <MaterialCommunityIcons name="store" size={20} color="#6366f1" />
          <View style={styles.contactContent}>
            <Text style={styles.contactTitle}>We also deal in wholesale!</Text>
            <Text style={styles.contactSubtitle}>
              To get started with wholesale pricing, contact us:
            </Text>
            <TouchableOpacity onPress={handleContactUs} style={styles.contactButton}>
              <MaterialCommunityIcons name="phone" size={16} color="#fff" />
              <Text style={styles.contactButtonText}>📞 7884388452</Text>
            </TouchableOpacity>
            <Text style={styles.contactHours}>Available: 10 AM to 8 PM</Text>
          </View>
        </View>
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Calculating final prices...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!orderPreview) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Failed to load order details</Text>
          <TouchableOpacity 
            onPress={() => navigation.goBack()} 
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()} 
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Review & Checkout</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Wholesale Benefit Message */}
        {renderWholesaleBenefitMessage()}

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          {orderPreview.items.map((item, index) => (
            <View key={index} style={styles.itemRow}>
              <View style={styles.itemInfo}>
                <Text style={styles.itemName}>{item.name}</Text>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>x{item.unitsBought}</Text>
                  {item.mode === 'wholesale' && item.bundlesBought! > 0 && (
                    <View style={styles.wholesaleTag}>
                      <MaterialCommunityIcons name="package-variant" size={12} color="#059669" />
                      <Text style={styles.wholesaleTagText}>
                        {item.bundlesBought} bundle{item.bundlesBought! > 1 ? 's' : ''}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.itemPricing}>
                <Text style={styles.itemPrice}>₹{item.totalPrice.toFixed(2)}</Text>
                {item.mode === 'wholesale' && (
                  <Text style={styles.originalPrice}>
                    ₹{((item.discountPrice || item.basePrice) * item.unitsBought).toFixed(2)}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Price Breakdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Price Details</Text>
          
          {/* Subtotal */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Subtotal</Text>
            <Text style={styles.priceValue}>₹{orderPreview.totalPrice.toFixed(2)}</Text>
          </View>

          {/* Delivery Fee */}
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>Delivery Fee</Text>
            <Text style={styles.priceValue}>₹{orderPreview.deliveryFee.toFixed(2)}</Text>
          </View>

          {orderPreview.deliveryFee === 0 && (
            <Text style={styles.freeDeliveryText}>🎉 Free delivery applied!</Text>
          )}

          <View style={styles.divider} />

          {/* Grand Total */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Grand Total</Text>
            <Text style={styles.totalValue}>₹{orderPreview.finalAmount.toFixed(2)}</Text>
          </View>

          <Text style={styles.verifiedText}>
            ✅ Prices verified by backend calculation
          </Text>
        </View>

        {/* Payment Methods */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Choose Payment Method</Text>
          
          {/* COD Button - Only for eligible users */}
          {isSubscriber && orderPreview.wholesaleEligible && (
            <TouchableOpacity
              style={[styles.paymentButton, styles.codButton]}
              onPress={handleCOD}
              disabled={processingPayment}
            >
              {processingPayment ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="cash" size={20} color="#fff" />
                  <Text style={styles.paymentButtonText}>Cash on Delivery</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Online Payment Button */}
          <TouchableOpacity
            style={[styles.paymentButton, styles.onlineButton]}
            onPress={handlePayNow}
            disabled={processingPayment}
          >
            {processingPayment ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <MaterialCommunityIcons name="credit-card" size={20} color="#fff" />
                <Text style={styles.paymentButtonText}>Pay Online</Text>
              </>
            )}
          </TouchableOpacity>

          {/* COD Eligibility Notice */}
          {!isSubscriber || !orderPreview.wholesaleEligible ? (
            <Text style={styles.codNotice}>
              💡 COD available for subscribed users with cart value ≥ ₹2500
            </Text>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { 
    flex: 1, 
    backgroundColor: '#fff' 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#eee',
    backgroundColor: '#fff',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700',
    color: '#1d1d1d',
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollContent: {
    paddingBottom: 20,
  },

  // Benefit Messages
  benefitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#059669',
  },
  benefitText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#059669',
    fontWeight: '600',
    lineHeight: 20,
  },
  warningContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  warningText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#92400e',
    fontWeight: '600',
    lineHeight: 20,
  },
  contactContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f9ff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  contactContent: {
    flex: 1,
    marginLeft: 12,
  },
  contactTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 4,
  },
  contactSubtitle: {
    fontSize: 13,
    color: '#1e40af',
    marginBottom: 12,
    lineHeight: 18,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  contactHours: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },

  // Sections
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1d1d',
    marginBottom: 16,
  },

  // Order Items
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemInfo: {
    flex: 1,
    marginRight: 16,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1d1d1d',
    marginBottom: 4,
  },
  itemDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  itemQuantity: {
    fontSize: 13,
    color: '#6b7280',
    marginRight: 8,
  },
  wholesaleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  wholesaleTagText: {
    fontSize: 10,
    color: '#059669',
    marginLeft: 2,
    fontWeight: '500',
  },
  itemPricing: {
    alignItems: 'flex-end',
  },
  itemPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d1d1d',
  },
  originalPrice: {
    fontSize: 12,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginTop: 2,
  },

  // Price Details
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  priceLabel: {
    fontSize: 15,
    color: '#6b7280',
  },
  priceValue: {
    fontSize: 15,
    color: '#1d1d1d',
    fontWeight: '500',
  },
  freeDeliveryText: {
    fontSize: 12,
    color: '#059669',
    textAlign: 'right',
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1d1d1d',
  },
  totalValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1d1d1d',
  },
  verifiedText: {
    fontSize: 11,
    color: '#059669',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  // Payment Methods
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  codButton: {
    backgroundColor: '#f59e0b',
  },
  onlineButton: {
    backgroundColor: '#22c55e',
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 8,
  },
  codNotice: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 16,
  },
});

export default ReviewOrderScreen;
