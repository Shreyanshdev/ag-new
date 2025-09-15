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
import { getDeliveryPartnerById } from '../../../src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AvailableOrdersScreen = () => {
  // Use Zustand store for state management
  const {
    availableOrders,
    availableOrdersLoading,
    availableOrdersError,
    deliveryPartnerId,
    branchId,
    setDeliveryPartner,
    setBranch,
    fetchAvailableOrders,
    startAvailableOrdersAutoRefresh,
    stopAvailableOrdersAutoRefresh,
    acceptOrderOptimistic,
  } = useOrdersStore();

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Initialize delivery partner and branch, then fetch orders
  useEffect(() => {
    const initializeData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (id) {
          setDeliveryPartner(id);

          // Get delivery partner details to get branch ID
          const partnerResponse = await getDeliveryPartnerById(id);
          if (partnerResponse.data && partnerResponse.data.branch) {
            const branch = partnerResponse.data.branch;
            setBranch(branch);

            // Fetch orders immediately after getting branch ID
            await fetchAvailableOrders();

            // Start auto-refresh for real-time updates
            startAvailableOrdersAutoRefresh();
          }
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        Alert.alert('Error', 'Failed to initialize delivery partner data');
      }
    };

    initializeData();

    // Cleanup function to stop auto-refresh when component unmounts
    return () => {
      stopAvailableOrdersAutoRefresh();
    };
  }, [setDeliveryPartner, setBranch, fetchAvailableOrders, startAvailableOrdersAutoRefresh, stopAvailableOrdersAutoRefresh]);

  // Local fetch function for manual refresh (different from Zustand store function)
  const localFetchAvailableOrders = useCallback(async () => {
    if (!branchId) return;

    try {
      // This will update the Zustand store
      await fetchAvailableOrders();
    } catch (error) {
      console.error('Error fetching available orders:', error);
      Alert.alert('Error', 'Failed to refresh orders');
    }
  }, [branchId, fetchAvailableOrders]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    await localFetchAvailableOrders();
  }, [localFetchAvailableOrders]);

  // Handle accept order with optimistic updates
  const handleAcceptOrder = async (order: Order) => {
    if (!deliveryPartnerId) {
      Alert.alert('Error', 'Delivery partner ID not found');
      return;
    }

    setActionLoading(order._id);
    try {
      // Use optimistic update - order disappears immediately
      const success = await acceptOrderOptimistic(order._id);

      if (success) {
        Alert.alert('Success', 'Order accepted successfully');
        // Order is already removed from available orders via optimistic update
        // CurrentOrdersScreen will automatically refresh via Zustand store
      } else {
        Alert.alert('Error', 'Failed to accept order');
      }
    } catch (error) {
      console.error('Error accepting order:', error);
      Alert.alert('Error', 'Failed to accept order');
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
          <View style={[styles.statusBadge, { backgroundColor: '#f59e0b' }]}>
            <Text style={styles.statusText}>PENDING</Text>
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
        
        <TouchableOpacity 
          style={[styles.acceptButton, actionLoading === item._id && styles.buttonDisabled]} 
          onPress={() => handleAcceptOrder(item)}
          disabled={actionLoading === item._id}
        >
          {actionLoading === item._id ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
          )}
          <Text style={styles.acceptButtonText}>
            {actionLoading === item._id ? 'Accepting...' : 'Accept Order'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Available Orders</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Feather name="refresh-cw" size={20} color="#1d1d1d" />
        </TouchableOpacity>
      </View>

      {availableOrdersLoading && availableOrders.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5e45d6" />
          <Text style={styles.loadingText}>Loading available orders...</Text>
        </View>
      ) : availableOrders.length === 0 ? (
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No Available Orders</Text>
          <Text style={styles.emptyStateText}>
            There are no pending orders from your branch at the moment.
          </Text>
          <Text style={styles.autoRefreshText}>🔄 Auto-refreshing every 30 seconds</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <MaterialCommunityIcons name="refresh" size={20} color="#5e45d6" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={availableOrders}
          keyExtractor={(item) => item._id}
          renderItem={renderOrderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
          refreshControl={
            <RefreshControl refreshing={availableOrdersLoading} onRefresh={onRefresh} />
          }
          ListHeaderComponent={
            <View style={styles.autoRefreshIndicator}>
              <Text style={styles.autoRefreshText}>🔄 Auto-refreshing every 30s</Text>
            </View>
          }
        />
      )}

      {availableOrdersError && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{availableOrdersError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={localFetchAvailableOrders}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}
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
  acceptButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#22c55e',
  },
  acceptButtonText: {
    color: '#fff',
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
  autoRefreshIndicator: {
    padding: 12,
    backgroundColor: '#f0f9ff',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  autoRefreshText: {
    fontSize: 12,
    color: '#0369a1',
    fontWeight: '500',
  },
  errorContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: '#fef2f2',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    marginBottom: 8,
  },
  retryButton: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AvailableOrdersScreen;
