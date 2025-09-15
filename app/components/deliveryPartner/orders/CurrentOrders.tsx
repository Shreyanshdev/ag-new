import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Order } from '../../../../types/types';

interface CurrentOrdersProps {
  currentOrders: Order[];
  loading: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onPickupOrder: (order: Order) => void;
  onMarkDelivered: (order: Order) => void;
}

const CurrentOrders: React.FC<CurrentOrdersProps> = ({
  currentOrders,
  loading,
  refreshing,
  onRefresh,
  onPickupOrder,
  onMarkDelivered,
}) => {
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

  const renderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={styles.orderItem}
      onPress={() => router.push(`/screens/deliveryPartner/OrderDetailsScreen?orderId=${item._id}`)}
    >
      <View style={styles.orderHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.customerName}>{item.customer?.name || 'Customer'}</Text>
          <Text style={styles.orderDate}>
            {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Date not available'}
          </Text>
          <Text style={styles.orderDetails}>
            {item.items?.map((itm: any) => `${itm.item} x${itm.count}`).join(', ') || 'No items'}
          </Text>
          <Text style={styles.orderAddress}>
            {item.deliveryLocation?.address || 'Address not available'}
          </Text>
        </View>
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtonsContainer}>
        {item.status === 'accepted' && (
          <TouchableOpacity 
            style={styles.pickupButton} 
            onPress={() => onPickupOrder(item)}
          >
            <MaterialCommunityIcons name="package-variant" size={16} color="#fff" />
            <Text style={styles.buttonText}>Pickup Order</Text>
          </TouchableOpacity>
        )}
        
        {item.status === 'in-progress' && (
          <TouchableOpacity 
            style={styles.deliveredButton} 
            onPress={() => onMarkDelivered(item)}
          >
            <MaterialCommunityIcons name="check-circle" size={16} color="#fff" />
            <Text style={styles.buttonText}>Mark Delivered</Text>
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
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading current orders...</Text>
      </View>
    );
  }

  if (currentOrders.length === 0) {
    return (
      <View style={styles.noDataContainer}>
        <MaterialCommunityIcons name="truck-delivery-outline" size={64} color="#9ca3af" />
        <Text style={styles.noDataTitle}>No Current Orders</Text>
        <Text style={styles.noDataSubtitle}>
          You don&apos;t have any active orders at the moment.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={currentOrders}
      renderItem={renderItem}
      keyExtractor={(item) => item._id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    />
  );
};

const styles = StyleSheet.create({
  orderItem: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
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
    marginBottom: 12,
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
    marginBottom: 4,
  },
  orderDetails: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  orderAddress: {
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
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  pickupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#06b6d4',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  deliveredButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
  awaitingConfirmationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  awaitingConfirmationText: {
    color: '#92400e',
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
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  noDataSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },
});

export default CurrentOrders; 