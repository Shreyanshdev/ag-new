import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  BackHandler,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import  io  from 'socket.io-client';
import {
  getAvailableOrders,
  getCurrentOrders,
  getHistoryOrders,
  getDeliveryPartnerById,
  logout as logoutApi,
  API_BASE_URL
} from '../../../src/config/api';
import { Order } from '../../../types/types';

const DeliveryOrderScreen = () => {
  // Remove the useRouter hook since we're importing router directly
  const [availableOrders, setAvailableOrders] = useState<any[]>([]);
  const [currentOrders, setCurrentOrders] = useState<any[]>([]);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);
  const [subscriptionDeliveries, setSubscriptionDeliveries] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [socket, setSocket] = useState<any>(null);

  // Socket.IO setup
  useEffect(() => {
    const setupSocket = async () => {
      const id = await AsyncStorage.getItem('userId');
      console.log('Retrieved userId from AsyncStorage:', id); // ADDED LOG
      if (id) {
        setDeliveryPartnerId(id);
        try {
          // Get delivery partner details to get the branch ID
          console.log('Fetching delivery partner details for ID:', id);
          const partnerResponse = await getDeliveryPartnerById(id);
          console.log('Delivery partner details:', partnerResponse.data);
          
          if (partnerResponse.data && partnerResponse.data.branch) {
            setBranchId(partnerResponse.data.branch);
            console.log('Set branch ID to:', partnerResponse.data.branch);
          } else {
            console.error('No branch assigned to delivery partner');
            Alert.alert('Error', 'No branch assigned to delivery partner');
            return;
          }



          // Create socket connection
          const newSocket = io(API_BASE_URL);
          newSocket.on('connect', () => {
            console.log('Connected to Socket.IO');
          });

          // Set socket in state
          setSocket(newSocket);

          // Don't call fetchOrders here - it will be called by useEffect when dependencies are ready

          newSocket.on('newOrderAvailable', (newOrder: any) => {
            console.log('New order available:', newOrder);
            setAvailableOrders((prevOrders) => {
              // Only add if not already present and not accepted by current partner
              if (!prevOrders.some(order => order._id === newOrder._id) && newOrder.deliveryPartner !== id) {
                return [newOrder, ...prevOrders];
              }
              return prevOrders;
            });
          });

          newSocket.on('orderAcceptedByOther', (acceptedOrderId: string) => {
            console.log('Order accepted by other:', acceptedOrderId);
            setAvailableOrders((prevOrders) =>
              prevOrders.filter((order) => order._id !== acceptedOrderId)
            );
          });

          newSocket.on('orderStatusUpdated', (updatedOrder: Order) => {
            console.log('Order status updated:', updatedOrder);
            
            // Skip if no order ID
            if (!updatedOrder._id) return;
            
            // Update order in the appropriate list based on status
            if (updatedOrder.status === 'pending') {
              // Move to available orders
              setAvailableOrders((prev) => {
                if (!prev.some(o => o._id === updatedOrder._id)) return [updatedOrder, ...prev];
                return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
              });
              // Remove from other lists
              setCurrentOrders((prev) => prev.filter(o => o._id !== updatedOrder._id));
              setOrderHistory((prev) => prev.filter(o => o._id !== updatedOrder._id));
            } else if (['accepted', 'in-progress', 'awaitconfirmation'].includes(updatedOrder.status)) {
              // Move to current orders
              setCurrentOrders((prev) => {
                if (!prev.some(o => o._id === updatedOrder._id)) return [updatedOrder, ...prev];
                return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
              });
              // Remove from other lists
              setAvailableOrders((prev) => prev.filter(o => o._id !== updatedOrder._id));
              setOrderHistory((prev) => prev.filter(o => o._id !== updatedOrder._id));
            } else if (['delivered', 'cancelled'].includes(updatedOrder.status)) {
              // Move to history
              setOrderHistory((prev) => {
                if (!prev.some(o => o._id === updatedOrder._id)) return [updatedOrder, ...prev];
                return prev.map(o => o._id === updatedOrder._id ? updatedOrder : o);
              });
              // Remove from other lists
              setAvailableOrders((prev) => prev.filter(o => o._id !== updatedOrder._id));
              setCurrentOrders((prev) => prev.filter(o => o._id !== updatedOrder._id));
            }
          });

          // Handle real-time location updates
          newSocket.on('deliveryPartnerLocationUpdate', (data: { orderId: string, location: any }) => {
            console.log('Delivery partner location update:', data);
            // Update the order's delivery person location in real-time
            setCurrentOrders((prev) => 
              prev.map(order => 
                order._id === data.orderId 
                  ? { ...order, deliveryPersonLocation: data.location }
                  : order
              )
            );
          });

          // Handle order pickup notifications
          newSocket.on('orderPickedUp', (data: { orderId: string, deliveryPartnerId: string, location: any }) => {
            console.log('Order picked up:', data);
            // Update order status to 'in-progress' and add location
            setCurrentOrders((prev) => 
              prev.map(order => 
                order._id === data.orderId 
                  ? { 
                      ...order, 
                      status: 'in-progress',
                      deliveryPersonLocation: data.location,
                      deliveryPartner: data.deliveryPartnerId
                    }
                  : order
              )
            );
          });

          // Handle delivery completion
          newSocket.on('orderDelivered', (data: { orderId: string, deliveryPartnerId: string }) => {
            console.log('Order delivered:', data);
            // Move order to history with 'delivered' status
            setCurrentOrders((prev) => {
              const deliveredOrder = prev.find(o => o._id === data.orderId);
              if (deliveredOrder) {
                const updatedOrder = { ...deliveredOrder, status: 'delivered' };
                setOrderHistory(history => [updatedOrder, ...history]);
                return prev.filter(o => o._id !== data.orderId);
              }
              return prev;
            });
          });

          // Handle subscription delivery events
          newSocket.on('subscriptionAssigned', (data: { subscriptionId: string, deliveryPartnerId: string, customerName: string, totalDeliveries: number }) => {
            console.log('New subscription assigned:', data);
            // Refresh subscription deliveries to show new assignment
            if (deliveryPartnerId && branchId) {
              fetchOrders();
            }
          });

          newSocket.on('deliveryConfirmed', (data: { subscriptionId: string, deliveryDate: string, status: string }) => {
            console.log('Delivery confirmed by customer:', data);
            // Update subscription delivery status to delivered
            setSubscriptionDeliveries((prev) => 
              prev.map(delivery => 
                delivery.subscriptionId === data.subscriptionId && 
                delivery.date === data.deliveryDate
                  ? { ...delivery, status: 'delivered' }
                  : delivery
              )
            );
          });

          newSocket.on('deliveryNoResponse', (data: { subscriptionId: string, deliveryDate: string, status: string }) => {
            console.log('Delivery marked as no response:', data);
            // Update subscription delivery status to noResponse
            setSubscriptionDeliveries((prev) => 
              prev.map(delivery => 
                delivery.subscriptionId === data.subscriptionId && 
                delivery.date === data.deliveryDate
                  ? { ...delivery, status: 'noResponse' }
                  : delivery
              )
            );
          });

          newSocket.on('disconnect', () => {
            console.log('Disconnected from Socket.IO');
          });

        } catch (error) {
          console.error('Error setting up socket:', error);
        }
      }
    };

    setupSocket();

    return () => {
      if (socket) {
        socket.disconnect();
      }
      // Cleanup completed
    };
  }, []);

  // Join branch room when branchId is available
  useEffect(() => {
    if (branchId && socket) {
      console.log('Joining branch room:', branchId);
      socket.emit('joinBranchRoom', branchId);
    }
  }, [branchId]);

  // Prevent hardware back button from navigating back; close app instead
  useEffect(() => {
    const backAction = () => {
      Alert.alert('Hold on!', 'Are you sure you want to exit the app?', [
        {
          text: 'Cancel',
          onPress: () => null,
          style: 'cancel',
        },
        { text: 'YES', onPress: () => BackHandler.exitApp() },
      ]);
      return true; // Prevent default back navigation
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove(); // Clean up on component unmount
  }, []);

  const fetchOrders = useCallback(async () => {
    try {
      console.log('fetchOrders called with:', { deliveryPartnerId, branchId });
      
      // Fetch all order types in parallel
      const promises = [];
      
      // Fetch available orders
        if (branchId) {
        promises.push(
          getAvailableOrders(branchId).then(response => {
          if (response.data) {
            setAvailableOrders(response.data.orders || []);
          }
          }).catch(error => console.error('Error fetching available orders:', error))
        );
        }
      
      // Fetch current orders
        if (deliveryPartnerId) {
        promises.push(
          getCurrentOrders(deliveryPartnerId).then(response => {
          if (response.data) {
            setCurrentOrders(response.data.orders || []);
            }
          }).catch(error => console.error('Error fetching current orders:', error))
        );
        
        // Fetch history orders
        promises.push(
          getHistoryOrders(deliveryPartnerId).then(response => {
          if (response.data) {
            setOrderHistory(response.data.orders || []);
            }
          }).catch(error => console.error('Error fetching history orders:', error))
        );
        
        // Fetch subscription deliveries
        
      }
      
      await Promise.all(promises);
    } catch (error) {
      console.error('Error fetching orders:', error);
      Alert.alert('Error', 'Failed to fetch orders');
    }
  }, [deliveryPartnerId, branchId]);

  useEffect(() => {
    if (deliveryPartnerId && branchId) { // Ensure both deliveryPartnerId and branchId are available before fetching
      fetchOrders();
    }
  }, [fetchOrders, deliveryPartnerId, branchId]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (deliveryPartnerId && branchId) {
      fetchOrders();
    }
  }, [fetchOrders, deliveryPartnerId, branchId]);

  // Debug function to check all orders
  const debugCheckAllOrders = async () => {
    console.log('=== DEBUG: Current order counts ===');
    console.log('Available orders:', availableOrders.length);
    console.log('Current orders:', currentOrders.length);
    console.log('History orders:', orderHistory.length);
    console.log('Subscription deliveries:', subscriptionDeliveries.length);
    console.log('=== DEBUG COMPLETE ===');
  };

  const handleLogout = async () => {
    try {
      console.log('🚪 Starting delivery partner logout...');
      await logoutApi();
      console.log('✅ Delivery partner logout successful');

      // Navigate to login screen using expo-router
      console.log('🔄 Redirecting to login screen...');
      router.replace('/screens/auth/LoginScreen');
    } catch (error) {
      console.error('❌ Error during logout:', error);
      // Even if logout fails, clear local storage and redirect
      try {
        await AsyncStorage.clear();
        router.replace('/screens/auth/LoginScreen');
      } catch (fallbackError) {
        console.error('❌ Fallback logout failed:', fallbackError);
      }
    }
  };



  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>Delivery Dashboard</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Feather name="log-out" size={24} color="#22c55e" />
          </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Main Cards Section */}
        <View style={styles.cardsContainer}>
          {/* Available Orders Card */}
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/screens/deliveryPartner/AvailableOrdersScreen')}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#fef3c7' }]}>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#f59e0b" />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Available Orders</Text>
                <Text style={styles.cardSubtitle}>New orders waiting for pickup</Text>
              </View>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{availableOrders.length}</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardActionText}>View Orders</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
            </View>
        </TouchableOpacity>

          {/* Current Orders Card */}
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/screens/deliveryPartner/CurrentOrdersScreen')}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#dbeafe' }]}>
                <MaterialCommunityIcons name="truck-delivery" size={24} color="#3b82f6" />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Current Orders</Text>
                <Text style={styles.cardSubtitle}>Orders in progress</Text>
              </View>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{currentOrders.length}</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardActionText}>Manage Orders</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
            </View>
        </TouchableOpacity>

          {/* History Card */}
        <TouchableOpacity
            style={styles.card}
            onPress={() => router.push('/screens/deliveryPartner/OrderHistoryScreen')}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.cardIcon, { backgroundColor: '#f3f4f6' }]}>
                <MaterialCommunityIcons name="history" size={24} color="#6b7280" />
              </View>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>Order History</Text>
                <Text style={styles.cardSubtitle}>Completed deliveries</Text>
              </View>
              <View style={styles.cardBadge}>
                <Text style={styles.cardBadgeText}>{orderHistory.length}</Text>
              </View>
            </View>
            <View style={styles.cardFooter}>
              <Text style={styles.cardActionText}>View History</Text>
              <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
            </View>
        </TouchableOpacity>

      </View>

        {/* Statistics Section */}
        <View style={styles.statsSection}>
          <Text style={styles.statsTitle}>Delivery Statistics</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="truck-delivery" size={32} color="#22c55e" />
              <Text style={styles.statNumber}>{orderHistory.length}</Text>
              <Text style={styles.statLabel}>Orders Delivered</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="star" size={32} color="#f59e0b" />
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Rating</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="clock" size={32} color="#8b5cf6" />
              <Text style={styles.statNumber}>0</Text>
              <Text style={styles.statLabel}>Avg. Delivery Time</Text>
            </View>
          </View>
        </View>

        {/* Debug Button */}
        <TouchableOpacity 
          style={styles.debugButton} 
          onPress={debugCheckAllOrders}
        >
          <Text style={styles.debugButtonText}>Debug Orders</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
  },
  logoutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
  },
  cardsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  cardBadge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  cardBadgeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardActionText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  statsSection: {
    marginBottom: 24,
  },
  statsTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    minWidth: '45%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1f2937',
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontWeight: '500',
  },
  debugButton: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 16,
  },
  debugButtonText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default DeliveryOrderScreen;