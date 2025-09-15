import RazorpayCheckout from 'react-native-razorpay';
import { Alert } from 'react-native';
import { 
  createOrder, 
  createPaymentOrder, 
  verifyPayment, 
  deleteAppOrder
} from '../config/api';

const RAZORPAY_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID || 'rzp_test_emJjA3F79kvnXw';

export interface PaymentOptions {
  orderPayload: any;
  onSuccess?: (orderId?: string) => void;
  onError?: (error: any) => void;
  onClearCart?: () => void;
  navigation?: any;
}

export const handlePayment = async (options: PaymentOptions) => {
  const {
    orderPayload,
    onSuccess,
    onError,
    onClearCart,
    navigation
  } = options;

  let appOrderId = '';
  let appOrderAmount = 0; // in rupees
  
  try {
    // Step 1: Create pending app order using your createOrder endpoint
    const appOrderResponse = await createOrder(orderPayload);
    console.log("App Order Response:", appOrderResponse);
    const appOrder = appOrderResponse.data.order;
    appOrderId = appOrder._id; // Your response has order._id
    // Use backend computed totals: totalPrice (items) + deliveryFee
    appOrderAmount = Number((appOrder.totalPrice || 0)) + Number((appOrder.deliveryFee || 0));
    console.log("App Order ID:", appOrderId, "Amount (₹):", appOrderAmount);

    // Step 2: Create Razorpay order on backend
    const razorpayOrderData = {
      amount: appOrderAmount, // in rupees (backend will convert to paise)
      currency: 'INR',
      receipt: appOrderId // Tie to app order ID
    };
    console.log("Razorpay Order Data:", razorpayOrderData);
    const razorpayResponse = await createPaymentOrder(razorpayOrderData);
    console.log("Razorpay Response:", razorpayResponse);
    const razorpayOrderId = razorpayResponse.data.id;

    // Step 3: Open Razorpay
    const razorpayOptions = {
      description: `Payment for order #${appOrderId}`,
      currency: 'INR',
      key: RAZORPAY_KEY_ID,
      amount: Math.round(appOrderAmount * 100), // in paise
      name: 'AgStore',
      order_id: razorpayOrderId, // This is the Razorpay order ID
      prefill: {
        contact: orderPayload?.customer?.phone || '',
        name: orderPayload?.customer?.name || '',
      },
      theme: { color: '#22c55e' },
      method: {
        upi: true,
        card: true,
        netbanking: false,
        wallet: false
      },
    } as any;
    
    console.log("Razorpay options:", razorpayOptions);
    const paymentData = await RazorpayCheckout.open(razorpayOptions);
    console.log("Razorpay success data:", paymentData);

    // Step 4: Verify payment on backend
    const verificationData = {
      order_id: paymentData.razorpay_order_id,
      payment_id: paymentData.razorpay_payment_id,
      signature: paymentData.razorpay_signature,
      appOrderId: appOrderId, // Pass our internal order ID for status update
    };
    console.log("Verification Data:", verificationData);
    const verificationResponse = await verifyPayment(verificationData);
    console.log("Verification Response:", verificationResponse);

    if (verificationResponse.data.success) {
      // Handle regular order success
      Alert.alert('Success', 'Payment successful! Order placed successfully.');
      if (onClearCart) {
        onClearCart();
      }
      if (onSuccess) {
        onSuccess(appOrderId);
      }
      if (navigation) {
        navigation.navigate('screens/customer/orders/OrderTrackingScreen' as any, { orderId: appOrderId });
      }
      return { success: true, orderId: appOrderId };
    } else {
      throw new Error('Payment verification failed');
    }
  } catch (error: any) {
    console.error("Payment process error:", error);
    Alert.alert('Payment Failed', error?.description || error?.message || 'Payment was not completed.');

    // Step 6: Handle failure - remove pending order
    console.log('Handling failed payment cleanup');
    if (appOrderId) {
      try {
        await deleteAppOrder(appOrderId);
        console.log('Orphaned order deleted');
      } catch (handleError) {
        console.error('Failed to delete orphaned order:', handleError);
      }
    }
    
    if (onError) {
      onError(error);
    }
    
    return { success: false, error };
  }
};


