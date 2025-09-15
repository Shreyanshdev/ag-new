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
import { 
  getHistoryOrders
} from '../../../src/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const OrderHistoryScreen = () => {
  const [orderHistory, setOrderHistory] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState<string | null>(null);

  // Initialize delivery partner and fetch order history
  useEffect(() => {
    const initializeData = async () => {
      try {
        const id = await AsyncStorage.getItem('userId');
        if (id) {
          setDeliveryPartnerId(id);
          // Fetch order history immediately after setting the ID
          try {
            setLoading(true);
            const response = await getHistoryOrders(id);
            if (response.data) {
              setOrderHistory(response.data.orders || []);
            }
          } catch (fetchError) {
            console.error('Error fetching order history:', fetchError);
            Alert.alert('Error', 'Failed to fetch order history');
          } finally {
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error initializing data:', error);
        Alert.alert('Error', 'Failed to initialize delivery partner data');
        setLoading(false);
      }
    };

    initializeData();
  }, []); // Empty dependency array - only run once on mount

  // Fetch order history function for refresh
  const fetchOrderHistory = useCallback(async () => {
    if (!deliveryPartnerId) return;

    try {
      const response = await getHistoryOrders(deliveryPartnerId);
      if (response.data) {
        setOrderHistory(response.data.orders || []);
      }
    } catch (error) {
      console.error('Error fetching order history:', error);
      Alert.alert('Error', 'Failed to refresh order history');
    }
  }, [deliveryPartnerId]);

  // Handle refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchOrderHistory();
    setRefreshing(false);
  }, [fetchOrderHistory]);

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return '#22c55e'; // Green
      case 'cancelled':
        return '#dc3545'; // Red
      default:
        return '#6b7280'; // Gray
    }
  };

  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'DELIVERED';
      case 'cancelled':
        return 'CANCELLED';
      default:
        return status.toUpperCase();
    }
  };

  // Get completion icon
  const getCompletionIcon = (status: string) => {
    return status === 'delivered' ? 'check-circle' : 'close-circle';
  };

  // Get completion text
  const getCompletionText = (status: string) => {
    return status === 'delivered' ? 'Successfully Delivered' : 'Order Cancelled';
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
            {item.items.map((orderItem: any, index: number) => (
              <View key={index} style={styles.itemContainer}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{orderItem.name}</Text>
                  <Text style={styles.itemQuantity}>x{orderItem.unitsBought}</Text>
                </View>
                <Text style={styles.itemPrice}>₹{orderItem.totalPrice.toFixed(2)}</Text>
              </View>
            ))}
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

      {/* Completion Status Section */}
      <View style={styles.completionSection}>
        <View style={styles.completionInfo}>
          <MaterialCommunityIcons 
            name={getCompletionIcon(item.status)} 
            size={20} 
            color={getStatusColor(item.status)} 
          />
          <Text style={[
            styles.completionText, 
            { color: getStatusColor(item.status) }
          ]}>
            {getCompletionText(item.status)}
          </Text>
        </View>
        
        {/* Delivery Date for completed orders */}
        {item.status === 'delivered' && item.updatedAt && (
          <View style={styles.deliveryDateContainer}>
            <MaterialCommunityIcons name="truck-delivery" size={16} color="#6b7280" />
            <Text style={styles.deliveryDateText}>
              Delivered on {new Date(item.updatedAt).toLocaleDateString('en-US', { 
                weekday: 'short', 
                year: 'numeric', 
                month: 'short', 
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </Text>
          </View>
        )}
      </View>

      {/* Action Section */}
      <View style={styles.actionSection}>
        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => router.push(`/screens/deliveryPartner/OrderDetailsScreen?orderId=${item._id}`)}
        >
          <MaterialCommunityIcons name="eye" size={16} color="#5e45d6" />
          <Text style={styles.viewDetailsButtonText}>View Details</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order History</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#5e45d6" />
          <Text style={styles.loadingText}>Loading order history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (orderHistory.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order History</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyStateContainer}>
          <MaterialCommunityIcons name="history" size={64} color="#9ca3af" />
          <Text style={styles.emptyStateTitle}>No Order History</Text>
          <Text style={styles.emptyStateText}>
            You haven&apos;t completed any orders yet.
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
        <Text style={styles.headerTitle}>Order History</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <Feather name="refresh-cw" size={20} color="#1d1d1d" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={orderHistory}
        keyExtractor={(item) => item._id}
        renderItem={renderOrderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
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
  completionSection: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  completionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  completionText: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  deliveryDateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  deliveryDateText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 6,
  },
  actionSection: {
    flexDirection: 'row',
    padding: 16,
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

export default OrderHistoryScreen;
