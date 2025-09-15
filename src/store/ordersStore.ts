import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Order } from '../../types/types';

// Type for order status
type OrderStatus = Order['status'];
import {
  getAvailableOrders,
  getCurrentOrders,
  getHistoryOrders,
  acceptOrder
} from '../config/api';

interface OrdersState {
  // Available Orders
  availableOrders: Order[];
  availableOrdersLoading: boolean;
  availableOrdersError: string | null;
  lastAvailableOrdersFetch: number | null;

  // Current Orders
  currentOrders: Order[];
  currentOrdersLoading: boolean;
  currentOrdersError: string | null;
  lastCurrentOrdersFetch: number | null;

  // Order History
  orderHistory: Order[];
  orderHistoryLoading: boolean;
  orderHistoryError: string | null;
  lastOrderHistoryFetch: number | null;

  // Branch & Partner IDs
  deliveryPartnerId: string | null;
  branchId: string | null;

  // Auto-refresh settings
  autoRefreshEnabled: boolean;
  refreshInterval: number; // milliseconds
  refreshTimer: ReturnType<typeof setInterval> | null;

  // Actions
  setDeliveryPartner: (id: string) => void;
  setBranch: (id: string) => void;

  // Available Orders Actions
  fetchAvailableOrders: () => Promise<void>;
  startAvailableOrdersAutoRefresh: () => void;
  stopAvailableOrdersAutoRefresh: () => void;

  // Current Orders Actions
  fetchCurrentOrders: () => Promise<void>;

  // Order History Actions
  fetchOrderHistory: () => Promise<void>;

  // Order Actions
  acceptOrderOptimistic: (orderId: string) => Promise<boolean>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;

  // Utility Actions
  clearAllOrders: () => void;
  refreshAllOrders: () => Promise<void>;
}

export const useOrdersStore = create<OrdersState>()(
  persist(
    (set, get) => ({
      // Initial State
      availableOrders: [],
      availableOrdersLoading: false,
      availableOrdersError: null,
      lastAvailableOrdersFetch: null,

      currentOrders: [],
      currentOrdersLoading: false,
      currentOrdersError: null,
      lastCurrentOrdersFetch: null,

      orderHistory: [],
      orderHistoryLoading: false,
      orderHistoryError: null,
      lastOrderHistoryFetch: null,

      deliveryPartnerId: null,
      branchId: null,

      autoRefreshEnabled: true,
      refreshInterval: 30000, // 30 seconds
      refreshTimer: null,

      // Basic setters
      setDeliveryPartner: (id: string) => {
        set({ deliveryPartnerId: id });
      },

      setBranch: (id: string) => {
        set({ branchId: id });
      },

      // Available Orders Actions
      fetchAvailableOrders: async () => {
        const { branchId } = get();
        if (!branchId) return;

        set({ availableOrdersLoading: true, availableOrdersError: null });

        try {
          const response = await getAvailableOrders(branchId);
          if (response.data) {
            set({
              availableOrders: response.data.orders || [],
              lastAvailableOrdersFetch: Date.now(),
              availableOrdersError: null
            });
          }
        } catch (error: any) {
          console.error('Error fetching available orders:', error);
          set({
            availableOrdersError: error.message || 'Failed to fetch available orders'
          });
        } finally {
          set({ availableOrdersLoading: false });
        }
      },

      startAvailableOrdersAutoRefresh: () => {
        const { refreshInterval, fetchAvailableOrders, refreshTimer } = get();

        // Clear existing timer
        if (refreshTimer) {
          clearInterval(refreshTimer);
        }

        // Start new timer
        const timer = setInterval(() => {
          fetchAvailableOrders();
        }, refreshInterval);

        set({ refreshTimer: timer });
        console.log('🚀 Started available orders auto-refresh');
      },

      stopAvailableOrdersAutoRefresh: () => {
        const { refreshTimer } = get();
        if (refreshTimer) {
          clearInterval(refreshTimer);
          set({ refreshTimer: null });
          console.log('⏹️ Stopped available orders auto-refresh');
        }
      },

      // Current Orders Actions
      fetchCurrentOrders: async () => {
        const { deliveryPartnerId } = get();
        if (!deliveryPartnerId) return;

        set({ currentOrdersLoading: true, currentOrdersError: null });

        try {
          const response = await getCurrentOrders(deliveryPartnerId);
          if (response.data) {
            set({
              currentOrders: response.data.orders || [],
              lastCurrentOrdersFetch: Date.now(),
              currentOrdersError: null
            });
          }
        } catch (error: any) {
          console.error('Error fetching current orders:', error);
          set({
            currentOrdersError: error.message || 'Failed to fetch current orders'
          });
        } finally {
          set({ currentOrdersLoading: false });
        }
      },

      // Order History Actions
      fetchOrderHistory: async () => {
        const { deliveryPartnerId } = get();
        if (!deliveryPartnerId) return;

        set({ orderHistoryLoading: true, orderHistoryError: null });

        try {
          const response = await getHistoryOrders(deliveryPartnerId);
          if (response.data) {
            set({
              orderHistory: response.data.orders || [],
              lastOrderHistoryFetch: Date.now(),
              orderHistoryError: null
            });
          }
        } catch (error: any) {
          console.error('Error fetching order history:', error);
          set({
            orderHistoryError: error.message || 'Failed to fetch order history'
          });
        } finally {
          set({ orderHistoryLoading: false });
        }
      },

      // Optimistic Order Acceptance
      acceptOrderOptimistic: async (orderId: string): Promise<boolean> => {
        const { deliveryPartnerId, availableOrders } = get();

        if (!deliveryPartnerId) return false;

        try {
          // Find the order to accept
          const orderToAccept = availableOrders.find(order => order._id === orderId);
          if (!orderToAccept) return false;

          // Optimistic update: Remove from available orders
          set({
            availableOrders: availableOrders.filter(order => order._id !== orderId)
          });

          // Make the API call
          const response = await acceptOrder(orderId, deliveryPartnerId);

          if (response.status === 200) {
            // Success: Update current orders and refresh both lists
            await get().fetchCurrentOrders();
            await get().fetchAvailableOrders();
            return true;
          } else {
            // Revert optimistic update on failure
            set({ availableOrders });
            return false;
          }
        } catch (error) {
          console.error('Error accepting order:', error);
          // Revert optimistic update
          set({ availableOrders });
          return false;
        }
      },

      // Update order status across all lists
      updateOrderStatus: (orderId: string, status: OrderStatus) => {
        set((state) => ({
          availableOrders: state.availableOrders.map(order =>
            order._id === orderId ? { ...order, status } : order
          ),
          currentOrders: state.currentOrders.map(order =>
            order._id === orderId ? { ...order, status } : order
          ),
          orderHistory: state.orderHistory.map(order =>
            order._id === orderId ? { ...order, status } : order
          ),
        }));
      },

      // Utility Actions
      clearAllOrders: () => {
        const { refreshTimer } = get();
        if (refreshTimer) {
          clearInterval(refreshTimer);
        }

        set({
          availableOrders: [],
          currentOrders: [],
          orderHistory: [],
          availableOrdersLoading: false,
          currentOrdersLoading: false,
          orderHistoryLoading: false,
          availableOrdersError: null,
          currentOrdersError: null,
          orderHistoryError: null,
          lastAvailableOrdersFetch: null,
          lastCurrentOrdersFetch: null,
          lastOrderHistoryFetch: null,
          deliveryPartnerId: null,
          branchId: null,
          refreshTimer: null,
        });
      },

      refreshAllOrders: async () => {
        await Promise.all([
          get().fetchAvailableOrders(),
          get().fetchCurrentOrders(),
          get().fetchOrderHistory(),
        ]);
      },
    }),
    {
      name: 'orders-storage',
      storage: createJSONStorage(() => AsyncStorage),
      // Persist essential data but not loading states or timers
      partialize: (state) => ({
        deliveryPartnerId: state.deliveryPartnerId,
        branchId: state.branchId,
        autoRefreshEnabled: state.autoRefreshEnabled,
        refreshInterval: state.refreshInterval,
      }),
    }
  )
);
