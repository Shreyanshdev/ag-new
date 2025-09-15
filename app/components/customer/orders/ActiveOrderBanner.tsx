import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Order } from '../../../../types/types';

interface ActiveOrderBannerProps {
  order: Order;
}

const ActiveOrderBanner: React.FC<ActiveOrderBannerProps> = ({ order }) => {
  const router = useRouter();

  if (!order || (!order._id && !order.id)) {
    console.warn('⚠️ ActiveOrderBanner: Order or order ID is missing:', order);
    return null;
  }

  const handlePress = () => {
    const orderId = order._id || order.id;
    if (!orderId) {
      console.error('❌ Order ID is missing:', order);
      return;
    }
    console.log('🔄 Navigating to OrderTrackingScreen with orderId:', orderId);
    router.push({ pathname: '/screens/customer/orders/OrderTrackingScreen', params: { orderId : orderId } });
  };

  // Get banner content based on status
  const getBannerContent = () => {
    switch (order.status) {
      case 'awaitconfirmation':
        return {
          title: 'Order delivered - Please confirm',
          status: 'Please confirm this order to be delivered',
          icon: 'check-circle',
          iconColor: '#f59e0b',
          backgroundColor: '#fffbeb',
          borderColor: '#fde68a',
          titleColor: '#d97706',
          statusColor: '#f59e0b'
        };
      case 'in-progress':
        return {
          title: 'Order is on the way',
          status: `Status: ${order.status} (${order.deliveryStatus || 'On The Way'})`,
          icon: 'truck-delivery',
          iconColor: '#06b6d4',
          backgroundColor: '#f0f9ff',
          borderColor: '#7dd3fc',
          titleColor: '#0369a1',
          statusColor: '#0891b2'
        };
      case 'accepted':
        return {
          title: 'Order accepted',
          status: `Status: ${order.status} (${order.deliveryStatus || 'Partner Assigned'})`,
          icon: 'check-circle',
          iconColor: '#22c55e',
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          titleColor: '#166534',
          statusColor: '#15803d'
        };
      default:
        return {
          title: 'You have an active order',
          status: `Status: ${order.status} (${order.deliveryStatus || 'Processing'})`,
          icon: 'truck-delivery',
          iconColor: '#22c55e',
          backgroundColor: '#f0fdf4',
          borderColor: '#bbf7d0',
          titleColor: '#166534',
          statusColor: '#15803d'
        };
    }
  };

  const bannerContent = getBannerContent();

  return (
    <TouchableOpacity
      style={[
        styles.banner,
        {
          backgroundColor: bannerContent.backgroundColor,
          borderColor: bannerContent.borderColor
        }
      ]}
      onPress={handlePress}
    >
      <View style={styles.iconContainer}>
        <MaterialCommunityIcons
          name={bannerContent.icon as any}
          size={24}
          color={bannerContent.iconColor}
        />
      </View>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: bannerContent.titleColor }]}>
          {bannerContent.title}
        </Text>
        <Text style={[styles.status, { color: bannerContent.statusColor }]}>
          {bannerContent.status}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={24} color="#9ca3af" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 16,
    borderRadius: 12,
    margin: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  iconContainer: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#166534',
  },
  status: {
    fontSize: 14,
    color: '#15803d',
    marginTop: 2,
  },
});

export default ActiveOrderBanner;
