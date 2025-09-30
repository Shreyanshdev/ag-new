import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addAddress, getAddresses, updateAddress, deleteAddress } from '../config/api';
import type { Address } from '../../types/types';

interface AddressStore {
  // State
  addresses: Address[];
  loading: boolean;
  error: string | null;
  operationLoading: boolean;
  selectedAddress: Address | null;
  lastUpdated: number; // Force re-render trigger

  // Actions
  initializeAddresses: () => Promise<void>;
  refreshAddresses: () => Promise<void>;
  addNewAddress: (address: Partial<Address>) => Promise<Address | null>;
  updateExistingAddress: (addressId: string, updates: Partial<Address>) => Promise<boolean>;
  deleteExistingAddress: (addressId: string) => Promise<boolean>;
  setDefaultAddress: (addressId: string) => Promise<boolean>;
  setSelectedAddress: (address: Address | null) => void;
  getDefaultAddress: () => Address | null;
  getFreshAddresses: () => Address[];
  clearError: () => void;
  forceUpdate: () => void; // Force component re-renders
  subscribeToChanges: (callback: AddressChangeCallback) => () => void; // Enhanced subscription system
  subscribeComponent: (componentId: string, callback: AddressChangeCallback) => () => void; // Component-specific subscriptions
  notifySubscribers: (event: AddressChangeEvent) => void; // Notify all subscribers of changes
}

// Enhanced subscription system for real-time updates
interface AddressChangeEvent {
  type: 'ADDED' | 'UPDATED' | 'DELETED' | 'REFRESHED' | 'SELECTED';
  address?: Address;
  addresses?: Address[];
  timestamp: number;
}

type AddressChangeCallback = (event: AddressChangeEvent) => void;

const subscribers = new Set<AddressChangeCallback>();
const componentSubscribers = new Map<string, AddressChangeCallback>();

export const useAddressStore = create<AddressStore>()(
  persist(
    (set, get) => ({
      // Initial state
      addresses: [],
      loading: false,
      error: null,
      operationLoading: false,
      selectedAddress: null,
      lastUpdated: Date.now(),

      // Initialize addresses from API
      initializeAddresses: async () => {
        // Don't initialize addresses if logout is in progress
        if (global.logoutInProgress) {
          console.log('🚫 Logout in progress, skipping address initialization');
          return;
        }

        try {
          console.log('🏠 AddressStore: Initializing addresses...');
          set({ loading: true, error: null });
          const response = await getAddresses();
          
          if (response.data?.addresses) {
            const addresses = response.data.addresses;
            console.log('🏠 AddressStore: Initialized addresses with coordinates:', addresses.map((addr: { _id: any; addressLine1: any; latitude: any; longitude: any; }) => ({
              id: addr._id,
              address: addr.addressLine1,
              lat: addr.latitude,
              lng: addr.longitude
            })));

            // Check for multiple default addresses and fix them
            const defaultAddresses = addresses.filter((addr: Address) => addr.isDefault);
            if (defaultAddresses.length > 1) {
              console.log('🏠 AddressStore: Found multiple default addresses, fixing...');
              // Keep the first default address, set others to non-default
              const addressesToUpdate = defaultAddresses.slice(1);
              for (const addr of addressesToUpdate) {
                try {
                  await updateAddress(addr._id, { isDefault: false });
                  console.log('🏠 AddressStore: Set address as non-default:', addr._id);
                } catch (error) {
                  console.warn('🏠 AddressStore: Failed to update address as non-default:', addr._id, error);
                }
              }

              // Update local state to reflect the fix
              const updatedAddresses = addresses.map((addr: Address) => ({
                ...addr,
                isDefault: addr._id === defaultAddresses[0]._id
              }));

              set({
                addresses: updatedAddresses,
                loading: false,
                lastUpdated: Date.now() // ✅ Force re-render trigger
              });
            } else {
              set({
                addresses,
                loading: false,
                lastUpdated: Date.now() // ✅ Force re-render trigger
              });
            }

            // ✅ Force update to trigger component re-renders
            const { forceUpdate, notifySubscribers } = get();
            forceUpdate();

            // ✅ Notify subscribers of address refresh
            notifySubscribers({
              type: 'REFRESHED',
              addresses,
              timestamp: Date.now()
            });

            console.log('🏠 AddressStore: Addresses initialized successfully:', addresses.length);
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('🏠 AddressStore: Error initializing addresses:', error);
          set({
            error: error.message || 'Failed to load addresses',
            loading: false
          });
        }
      },

      // Refresh addresses from API
      refreshAddresses: async () => {
        try {
          console.log('🏠 AddressStore: Refreshing addresses...');
          set({ loading: true, error: null });
          const response = await getAddresses();
          
          if (response.data?.addresses) {
            const addresses = response.data.addresses;
            console.log('🏠 AddressStore: Fetched addresses with coordinates:', addresses.map((addr: { _id: any; addressLine1: any; latitude: any; longitude: any; }) => ({
              id: addr._id,
              address: addr.addressLine1,
              lat: addr.latitude,
              lng: addr.longitude
            })));

            // Update selectedAddress if it exists in the refreshed addresses
            const freshState = get(); // ✅ Use fresh state reference
            const currentSelectedAddress = freshState.selectedAddress;
            if (currentSelectedAddress) {
              const updatedSelectedAddress = addresses.find((addr: { _id: string; }) => addr._id === currentSelectedAddress._id);
              if (updatedSelectedAddress) {
                console.log('🏠 AddressStore: Updating selected address with fresh data:', updatedSelectedAddress._id);
                set({
                  addresses,
                  loading: false,
                  selectedAddress: updatedSelectedAddress,
                  lastUpdated: Date.now() // ✅ Force re-render trigger
                });
              } else {
                set({
                  addresses,
                  loading: false,
                  lastUpdated: Date.now() // ✅ Force re-render trigger
                });
              }
            } else {
              set({
                addresses,
                loading: false,
                lastUpdated: Date.now() // ✅ Force re-render trigger
              });
            }

            // ✅ Force update to trigger component re-renders
            const { forceUpdate, notifySubscribers } = get();
            forceUpdate();

            // ✅ Notify subscribers of address refresh
            notifySubscribers({
              type: 'REFRESHED',
              addresses,
              timestamp: Date.now()
            });

            console.log('🏠 AddressStore: Addresses refreshed successfully:', addresses.length);
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('🏠 AddressStore: Error refreshing addresses:', error);
          set({
            error: error.message || 'Failed to refresh addresses',
            loading: false
          });
        }
      },

      // ✅ ENHANCED: Add new address with force update mechanism and fresh state references
      addNewAddress: async (address: Partial<Address>): Promise<Address | null> => {
        try {
          console.log('🏠 AddressStore: Adding new address:', address);
          set({ operationLoading: true, error: null });
          const response = await addAddress(address);
          console.log('🏠 AddressStore: Full response from addAddress:', response.data);
          
          if (response.data?.address) {
            const newAddress = response.data.address;
            console.log('🏠 AddressStore: Address added successfully:', newAddress._id);
            console.log('🏠 AddressStore: New address coordinates:', { latitude: newAddress.latitude, longitude: newAddress.longitude });

            // If this address is set as default, update other addresses to be non-default
            if (newAddress.isDefault) {
              // ✅ Use fresh state reference to avoid closure issues
              const freshState = get();
              const otherAddresses = freshState.addresses.filter(addr => addr.isDefault);

              // Update other addresses to be non-default on the backend
              for (const addr of otherAddresses) {
                try {
                  await updateAddress(addr._id, { isDefault: false });
                  console.log('🏠 AddressStore: Set other address as non-default:', addr._id);
                } catch (error) {
                  console.warn('🏠 AddressStore: Failed to update other address as non-default:', addr._id, error);
                }
              }
            }

            // ✅ Atomic state update to prevent race conditions
            set((state) => {
              let updatedAddresses = [...state.addresses];
              
              // If this address is set as default, update other addresses to be non-default
              if (newAddress.isDefault) {
                updatedAddresses = updatedAddresses.map(addr => ({ 
                  ...addr, 
                  isDefault: false 
                }));
              }
              
              // Add the new address
              updatedAddresses.push(newAddress);
              
              return {
                addresses: updatedAddresses,
                operationLoading: false,
                lastUpdated: Date.now(),
                selectedAddress: newAddress.isDefault ? newAddress : state.selectedAddress,
              };
            });

            // ✅ Force update to trigger component re-renders
            const { forceUpdate, notifySubscribers } = get();
            forceUpdate();

            // ✅ Notify subscribers of new address addition
            notifySubscribers({
              type: 'ADDED',
              address: newAddress,
              addresses: get().addresses,
              timestamp: Date.now()
            });

            // ✅ Return the actual saved address with _id from backend
            console.log('🏠 AddressStore: Returning new address with _id:', newAddress._id);
            return newAddress;
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('🏠 AddressStore: Error adding address:', error);
          set({
            error: error.message || 'Failed to add address',
            operationLoading: false
          });
          return null;
        }
      },

      // Update existing address
      updateExistingAddress: async (addressId: string, updates: Partial<Address>): Promise<boolean> => {
        try {
          console.log('🏠 AddressStore: Updating address:', addressId, updates);
          set({ operationLoading: true, error: null });
          const response = await updateAddress(addressId, updates);
          
          if (response.data?.address) {
            const updatedAddress = response.data.address;
            console.log('🏠 AddressStore: Address updated successfully:', updatedAddress._id);

            // If this address is being set as default, update other addresses to be non-default
            if (updatedAddress.isDefault) {
              // ✅ Use fresh state reference to avoid closure issues
              const freshState = get();
              const otherAddresses = freshState.addresses.filter(addr => addr._id !== addressId && addr.isDefault);

              // Update other addresses to be non-default on the backend
              for (const addr of otherAddresses) {
                try {
                  await updateAddress(addr._id, { isDefault: false });
                  console.log('🏠 AddressStore: Set other address as non-default:', addr._id);
                } catch (error) {
                  console.warn('🏠 AddressStore: Failed to update other address as non-default:', addr._id, error);
                }
              }
            }

            // Update local state immediately - ensure only the updated address is default if it should be
            set((state) => ({
              addresses: state.addresses.map(addr =>
                addr._id === addressId ? updatedAddress : { ...addr, isDefault: updatedAddress.isDefault ? false : addr.isDefault }
              ),
              operationLoading: false,
              lastUpdated: Date.now() // ✅ Force re-render trigger
            }));

            // ✅ Force update to trigger component re-renders
            const { forceUpdate, notifySubscribers } = get();
            forceUpdate();

            // ✅ Notify subscribers of address update
            notifySubscribers({
              type: 'UPDATED',
              address: updatedAddress,
              addresses: get().addresses,
              timestamp: Date.now()
            });

            return true;
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('🏠 AddressStore: Error updating address:', error);
          set({
            error: error.message || 'Failed to update address',
            operationLoading: false
          });
          return false;
        }
      },

      // Delete existing address
      deleteExistingAddress: async (addressId: string): Promise<boolean> => {
        try {
          console.log('🏠 AddressStore: Deleting address:', addressId);
          set({ operationLoading: true, error: null });
          await deleteAddress(addressId);
          console.log('🏠 AddressStore: Address deleted successfully:', addressId);

          // Update local state immediately
          set((state) => ({
            addresses: state.addresses.filter(addr => addr._id !== addressId),
            operationLoading: false,
            lastUpdated: Date.now() // ✅ Force re-render trigger
          }));

          // ✅ Force update to trigger component re-renders
          const { forceUpdate, notifySubscribers } = get();
          forceUpdate();

          // ✅ Notify subscribers of address deletion
          notifySubscribers({
            type: 'DELETED',
            addresses: get().addresses,
            timestamp: Date.now()
          });

          return true;
        } catch (error: any) {
          console.error('🏠 AddressStore: Error deleting address:', error);
          set({
            error: error.message || 'Failed to delete address',
            operationLoading: false
          });
          return false;
        }
      },

      // Set default address
      setDefaultAddress: async (addressId: string): Promise<boolean> => {
        try {
          console.log('🏠 AddressStore: Setting default address:', addressId);
          set({ operationLoading: true, error: null });

          // ✅ Get fresh state reference before making changes
          const freshState = get();
          const otherAddresses = freshState.addresses.filter(addr => addr._id !== addressId && addr.isDefault);

          // First, update other addresses to be non-default on the backend
          for (const addr of otherAddresses) {
            try {
              await updateAddress(addr._id, { isDefault: false });
              console.log('🏠 AddressStore: Set address as non-default:', addr._id);
            } catch (error) {
              console.warn('🏠 AddressStore: Failed to update address as non-default:', addr._id, error);
              // Continue with other addresses even if one fails
            }
          }

          // Then, update the selected address to be default
          const response = await updateAddress(addressId, { isDefault: true });
          if (response.data?.address) {
            const updatedAddress = response.data.address;
            console.log('🏠 AddressStore: Default address set successfully:', updatedAddress._id);

            // Update local state - set all addresses to non-default except the selected one
            set((state) => ({
              addresses: state.addresses.map(addr => ({
                ...addr,
                isDefault: addr._id === addressId
              })),
              operationLoading: false,
              lastUpdated: Date.now() // ✅ Force re-render trigger
            }));

            // Set the new default address as selected address using fresh state
            const freshStateAfterUpdate = get();
            const newDefaultAddress = freshStateAfterUpdate.addresses.find(addr => addr._id === addressId);
            if (newDefaultAddress) {
              console.log('🏠 AddressStore: Setting new default address as selected:', newDefaultAddress._id);
              set({ selectedAddress: newDefaultAddress });
            }

            // ✅ Force update to trigger component re-renders
            const { forceUpdate, notifySubscribers } = get();
            forceUpdate();

            // ✅ Notify subscribers of default address change
            notifySubscribers({
              type: 'UPDATED',
              address: updatedAddress,
              addresses: get().addresses,
              timestamp: Date.now()
            });

            return true;
          } else {
            throw new Error('Invalid response from server');
          }
        } catch (error: any) {
          console.error('🏠 AddressStore: Error setting default address:', error);
          set({
            error: error.message || 'Failed to set default address',
            operationLoading: false
          });
          return false;
        }
      },

      // Set selected address
      setSelectedAddress: (address: Address | null) => {
        const currentSelected = get().selectedAddress;
        
        // Prevent unnecessary updates if the same address is being set
        if (currentSelected?._id === address?._id) {
          console.log('🏠 AddressStore: Same address already selected, skipping update');
          return;
        }
        
        console.log('🏠 AddressStore: Setting selected address:', address?._id);
        set({ selectedAddress: address });
        
        // ✅ Notify subscribers of address selection change
        const { notifySubscribers } = get();
        notifySubscribers({
          type: 'SELECTED',
          address: address || undefined,
          addresses: get().addresses,
          timestamp: Date.now()
        });
      },

      // Get default address
      getDefaultAddress: () => {
        const addresses = get().addresses;
        return addresses.find(addr => addr.isDefault) || null;
      },

      // ✅ NEW: Get fresh addresses (bypasses component closure)
      getFreshAddresses: () => {
        console.log('🏠 AddressStore: Getting fresh addresses, count:', get().addresses.length);
        return get().addresses;
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Force component re-renders by updating timestamp
      forceUpdate: () => {
        const timestamp = Date.now();
        console.log('🏠 AddressStore: Force updating components, timestamp:', timestamp);
        set({ lastUpdated: timestamp });
        
        // Notify all subscribers with a generic update event
        const { notifySubscribers } = get();
        notifySubscribers({
          type: 'REFRESHED',
          addresses: get().addresses,
          timestamp
        });
      },

      // Enhanced subscription system for real-time updates
      subscribeToChanges: (callback: AddressChangeCallback) => {
        console.log('🏠 AddressStore: Adding subscriber, total subscribers:', subscribers.size + 1);
        subscribers.add(callback);
        
        // Return unsubscribe function
        return () => {
          console.log('🏠 AddressStore: Removing subscriber, remaining subscribers:', subscribers.size - 1);
          subscribers.delete(callback);
        };
      },

      // Component-specific subscription system
      subscribeComponent: (componentId: string, callback: AddressChangeCallback) => {
        console.log('🏠 AddressStore: Adding component subscriber:', componentId);
        componentSubscribers.set(componentId, callback);
        
        // Also add to general subscribers
        subscribers.add(callback);
        
        // Return unsubscribe function
        return () => {
          console.log('🏠 AddressStore: Removing component subscriber:', componentId);
          componentSubscribers.delete(componentId);
          subscribers.delete(callback);
        };
      },

      // Notify all subscribers of address changes
      notifySubscribers: (event: AddressChangeEvent) => {
        console.log('🏠 AddressStore: Notifying subscribers of event:', event.type, 'subscribers:', subscribers.size);
        
        // Notify branch context when addresses are added, updated, or selected
        if ((event.type === 'ADDED' || event.type === 'UPDATED' || event.type === 'SELECTED') && event.address) {
          console.log('🌿 AddressStore: Notifying branch context of address change:', event.type, event.address.addressLine1);
          try {
            // Check if branch context handler is available
            if (typeof window !== 'undefined' && (window as any).__BRANCH_CONTEXT_HANDLER__) {
              (window as any).__BRANCH_CONTEXT_HANDLER__(event.address);
            }
          } catch (error) {
            console.warn('🌿 AddressStore: Error notifying branch context:', error);
          }
        }
        
        subscribers.forEach(callback => {
          try {
            callback(event);
          } catch (error) {
            console.warn('🏠 AddressStore: Error in subscriber callback:', error);
          }
        });
      },
    }),
    {
      name: 'address-store',
      storage: {
        getItem: async (name: string) => {
          try {
            const value = await AsyncStorage.getItem(name);
            return value ? JSON.parse(value) : null;
          } catch (error) {
            console.warn('Failed to get item from storage:', error);
            return null;
          }
        },
        setItem: async (name: string, value: any) => {
          try {
            await AsyncStorage.setItem(name, JSON.stringify(value));
          } catch (error) {
            console.warn('Failed to set item in storage:', error);
          }
        },
        removeItem: async (name: string) => {
          try {
            await AsyncStorage.removeItem(name);
          } catch (error) {
            console.warn('Failed to remove item from storage:', error);
          }
        },
      },
      partialize: (state) => ({
        addresses: state.addresses,
        selectedAddress: state.selectedAddress,
        // Exclude lastUpdated from persistence as it's only for triggering re-renders
      }),
    }
  )
);
