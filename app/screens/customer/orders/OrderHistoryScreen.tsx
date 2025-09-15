import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getMyOrderHistory } from '../../../../src/config/api';
import { Order } from '../../../../types/types';
import { useRouter } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Footer from '../../../components/shared/Footer';
import FloatingCart from '../../../components/shared/FloatingCart';

const OrderHistoryScreen = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const fetchOrderHistory = async () => {
    try {
      const response = await getMyOrderHistory();
      // Sort orders by most recent first (already sorted by backend, but good practice)
      const sortedOrders = response.data.orders.sort((a: Order, b: Order) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      setOrders(sortedOrders);
    } catch (error) {
      console.error("Failed to fetch order history:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrderHistory();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchOrderHistory();
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Delivered':
        return { 
          container: { backgroundColor: '#dcfce7' }, 
          text: { color: '#1f2937' } 
        };
      case 'Cancelled':
        return { 
          container: { backgroundColor: '#fee2e2' }, 
          text: { color: '#1f2937' } 
        };
      default:
        return { 
          container: { backgroundColor: '#fef3c7' }, 
          text: { color: '#1f2937' } 
        };
    }
  };

  const renderOrderItem = ({ item }: { item: Order }) => {
    const statusStyle = getStatusStyle(item.status);
    return (
      <View style={styles.orderCard}>
        {/* Card Header */}
        <View style={styles.cardHeader}>
          <View style={styles.orderIdContainer}>
            <MaterialCommunityIcons name="receipt" size={20} color="#28a745" />
            <Text style={styles.orderIdText}>#{item.orderId}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.container.backgroundColor }]}>
            <Text style={[styles.statusText, { color: statusStyle.text.color }]}>
              {item.status}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        <View style={styles.cardBody}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="calendar" size={18} color="#6b7280" />
            <Text style={styles.infoLabel}>Order Date:</Text>
            <Text style={styles.infoValue}>{new Date(item.createdAt || 0).toLocaleDateString()}</Text>
          </View>

          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="currency-inr" size={18} color="#6b7280" />
            <Text style={styles.infoLabel}>Total Amount:</Text>
            <Text style={styles.totalAmount}>₹{item.totalPrice.toFixed(2)}</Text>
          </View>
        </View>

        {/* Card Footer */}
        <View style={styles.cardFooter}>
          <TouchableOpacity 
            style={styles.viewDetailsButton} 
            onPress={() => router.push({ pathname: '/screens/customer/orders/OrderTrackingScreen', params: { orderId: item._id } })}
          >
            <MaterialCommunityIcons name="eye" size={18} color="#28a745" />
            <Text style={styles.viewDetailsText}>View Details</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={26} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Order History</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#28a745" />
          <Text style={styles.loadingText}>Loading your order history...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order History</Text>
      </View>
      
      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={(item) => item._id}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant-closed" size={64} color="#9ca3af" />
            <Text style={styles.emptyTitle}>No Order History</Text>
            <Text style={styles.emptySubtitle}>You haven&apos;t placed any orders yet.</Text>
          </View>
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Footer and Floating Cart */}
      <Footer />
      <FloatingCart marginBottom={Platform.OS === 'ios' ? 60 : 60} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  // Header
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
  },
  backButton: { 
    marginRight: 16 
  },
  headerTitle: { 
    fontSize: 20, 
    fontWeight: '700', 
    color: '#1d1d1d',
    flex: 1,
  },
  
  scrollView: { 
    backgroundColor: '#f7f7f7' 
  },
  scrollContentContainer: { 
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 120 : 100, // Adjusted padding to account for footer
  },
  
  // Card styles
  orderCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  
  // Card Header
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  orderIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  orderIdText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 8,
  },
  
  // Status badge
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },

  // Card Body
  cardBody: {
    padding: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    marginRight: 8,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#28a745',
  },

  // Card Footer
  cardFooter: {
    padding: 16,
    paddingTop: 0,
    alignItems: 'flex-end',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#28a745',
  },
  viewDetailsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#28a745',
    marginLeft: 6,
  },
  
  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  
  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
});

export default OrderHistoryScreen;