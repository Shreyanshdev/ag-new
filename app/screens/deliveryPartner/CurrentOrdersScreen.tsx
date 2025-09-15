import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,

} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Order } from '../../../types/types';
import { useOrdersStore } from '../../../src/store/ordersStore';
import {
  pickupOrder,
  markOrderAsDelivered,
} from '../../../src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CurrentOrdersScreen = () => {
  // Use Zustand store for state management
  const {
    currentOrders,
    currentOrdersLoading,
    deliveryPartnerId,
    setDeliveryPartner,
    fetchCurrentOrders,
  } = useOrdersStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Initialize delivery partner and fetch orders
  useEffect(() => {
    const initializeData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (id) {
          setDeliveryPartner(id);
          // Fetch orders immediately after setting the ID
          await fetchCurrentOrders();
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        Alert.alert('Error', 'Failed to initialize delivery partner data');
      }
    };

    initializeData();
  }, [setDeliveryPartner, fetchCurrentOrders]); // Include dependencies

  // Local fetch function for manual refresh (different from Zustand store function)
  const localFetchCurrentOrders = useCallback(async () => {
    if (!deliveryPartnerId) return;

    try {
      // This will update the Zustand store
      await fetchCurrentOrders();
    } catch (error) {
      console.error('Error fetching current orders:', error);
      Alert.alert('Error', 'Failed to refresh orders');
    }
  }, [deliveryPartnerId, fetchCurrentOrders]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    await localFetchCurrentOrders();
  }, [localFetchCurrentOrders]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return '#22c55e'; // Green
      case 'in-progress':
        return '#06b6d4'; // Teal
      case 'awaitconfirmation':
        return '#f59e0b'; // Orange
      default:
        return '#6b7280'; // Gray
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'ACCEPTED';
      case 'in-progress':
        return 'IN PROGRESS';
      case 'awaitconfirmation':
        return 'AWAITING CONFIRMATION';
      default:
        return status.toUpperCase();
    }
  };

  // Handle pickup order
  const handlePickupOrder = async (order: Order) => {
    if (!deliveryPartnerId) {
      Alert.alert('Error', 'Delivery partner ID not found');
      return;
    }

    setActionLoading(order._id);
    try {
      // Get current location for the delivery partner
      // TODO: Implement proper GPS location fetching
      // For now, use a placeholder that won't break the API
      const currentLocation = {
        latitude: 37.7749, // San Francisco coordinates as fallback
        longitude: -122.4194,
        address: 'Pickup location'
      };

      const response = await pickupOrder(order._id, deliveryPartnerId, currentLocation);
      
      if (response.status === 200) {
        Alert.alert('Success', 'Order picked up successfully');
        // Refresh orders to update status
        await fetchCurrentOrders();
      }
    } catch (error: any) {
      console.error('Error picking up order:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to pickup order');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle mark as delivered
  const handleMarkDelivered = async (order: Order) => {
    if (!deliveryPartnerId) {
      Alert.alert('Error', 'Delivery partner ID not found');
      return;
    }

    setActionLoading(order._id);
    try {
      // Get current location for the delivery partner
      // TODO: Implement proper GPS location fetching
      const currentLocation = {
        latitude: 37.7749, // San Francisco coordinates as fallback
        longitude: -122.4194,
        address: 'Delivery location'
      };

      const response = await markOrderAsDelivered(order._id, deliveryPartnerId, currentLocation);
      
      if (response.status === 200) {
        Alert.alert('Success', 'Order marked as delivered successfully');
        // Refresh orders to update the list
        await fetchCurrentOrders();
      }
    } catch (error: any) {
      console.error('Error marking order as delivered:', error);
      Alert.alert('Error', error.response?.data?.message || 'Failed to mark order as delivered');
    } finally {
      setActionLoading(null);
    }
  };

  // Render order item
  const renderOrderItem = ({ item }: { item: Order }) => (
    <View style={styles.orderCard}>
      {/* Order Header */}
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.customerName}>{item.customer?.name || 'Customer'}</Text>
          <Text style={styles.orderDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            }) : 'Date not available'}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{getStatusText(item.status)}</Text>
          </View>
        </View>
      </View>

      {/* Order Details Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Order Details</Text>
        
        {/* Order Items */}
        {item.items && item.items.length > 0 && (
          <View style={styles.itemsContainer}>
            {item.items.map((orderItem: any, index: number) => {
            return (
              <View key={index} style={styles.itemContainer}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{orderItem.name}</Text>
                  <Text style={styles.itemQuantity}>x{orderItem.unitsBought}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{orderItem.totalPrice.toFixed(2)}</Text>
              </View>
            );
          })}

          </View>
        )}

        {/* Order Total */}
        <View style={styles.billRow}>
          <Text style={styles.billText}>Total Amount</Text>
          <Text style={styles.billText}>₹{item.totalPrice?.toFixed(2) || '0.00'}</Text>
        </View>
      </View>

      {/* Customer Information Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Customer Information</Text>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="account" size={20} color="#5e45d6" />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Customer Name</Text>
            <Text style={styles.detailValue}>{item.customer?.name || 'Unknown'}</Text>
          </View>
        </View>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="phone" size={20} color="#5e45d6" />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Phone Number</Text>
            <Text style={styles.detailValue}>{item.customer?.phone || 'Not provided'}</Text>
          </View>
        </View>
      </View>

      {/* Delivery Address Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Delivery Address</Text>
        <View style={styles.detailRow}>
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#5e45d6" />
          <View style={styles.detailTextContainer}>
            <Text style={styles.detailLabel}>Address</Text>
            <Text style={styles.detailValue}>{item.deliveryLocation?.address || 'Address not available'}</Text>
          </View>
        </View>
        {item.deliveryLocation?.city && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="city" size={20} color="#6b7280" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>City</Text>
              <Text style={styles.detailValue}>{item.deliveryLocation.city}</Text>
            </View>
          </View>
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => router.push(`/screens/deliveryPartner/OrderDetailsScreen?orderId=${item._id}`)}
        >
          <MaterialCommunityIcons name="eye" size={16} color="#5e45d6" />
          <Text style={styles.viewDetailsButtonText}>View Details</Text>
        </TouchableOpacity>
        
        {/* Conditional Action Buttons based on status */}
        {item.status === 'accepted' && (
          <TouchableOpacity 
            style={[styles.pickupButton, actionLoading === item._id && styles.buttonDisabled]} 
            onPress={() => handlePickupOrder(item)}
            disabled={actionLoading === item._id}
          >
            {actionLoading === item._id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="package-variant" size={16} color="#fff" />
            )}
            <Text style={styles.pickupButtonText}>
              {actionLoading === item._id ? 'Picking up...' : 'Pickup Order'}
            </Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'in-progress' && (
          <TouchableOpacity 
            style={[styles.deliveredButton, actionLoading === item._id && styles.buttonDisabled]} 
            onPress={() => handleMarkDelivered(item)}
            disabled={actionLoading === item._id}
          >
            {actionLoading === item._id ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
            )}
            <Text style={styles.deliveredButtonText}>
              {actionLoading === item._id ? 'Marking...' : 'Mark Delivered'}
            </Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'awaitconfirmation' && (
          <View style={styles.awaitingConfirmationNotice}>
            <MaterialCommunityIcons name="clock-outline" size={16} color="#f59e0b" />
            <Text style={styles.awaitingConfirmationText}>
              Awaiting Customer Confirmation
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  // Loading state
  if (currentOrdersLoading && currentOrders.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Current Orders</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5e45d6" />
          <Text style={styles.loadingText}>Loading current orders...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (currentOrders.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Current Orders</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="truck-delivery-outline" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No Current Orders</Text>
          <Text style={styles.emptyStateText}>
            You don&apos;t have any active orders at the moment.
          </Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <MaterialCommunityIcons name="refresh" size={20} color="#5e45d6" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Current Orders</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Feather name="refresh-cw" size={20} color="#1d1d1d" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={currentOrders}
        keyExtractor={(item) => item._id}
        renderItem={renderOrderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={
          <RefreshControl refreshing={currentOrdersLoading} onRefresh={onRefresh} />
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#ffffff',
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1d1d',
    flex: 1,
  },
  headerRight: {
    width: 40,
  },
  refreshButton: {
    padding: 8,
  },
  scrollContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  orderInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  orderDate: {
    fontSize: 14,
    color: '#6b7280',
  },
  statusContainer: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  itemsContainer: {
    marginBottom: 12,
  },
  itemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  itemPrice: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '600',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  billText: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
  },
  actionSection: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  viewDetailsButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5e45d6',
    backgroundColor: '#ffffff',
  },
  viewDetailsButtonText: {
    color: '#5e45d6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  pickupButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#06b6d4',
  },
  pickupButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  deliveredButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
  },
  deliveredButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  awaitingConfirmationNotice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  awaitingConfirmationText: {
    color: '#92400e',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  emptyStateContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  refreshButtonText: {
    color: '#5e45d6',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
});

export default CurrentOrdersScreen;
