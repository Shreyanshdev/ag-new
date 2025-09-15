import { useEffect, useCallback, useRef } from 'react';
import { useAddressStore } from '../store/addressStore';
import type { Address } from '../../types/types';

interface AddressChangeEvent {
    type: 'ADDED' | 'UPDATED' | 'DELETED' | 'REFRESHED' | 'SELECTED';
    address?: Address;
    addresses?: Address[];
    timestamp: number;
}

interface UseAddressSyncOptions {
    componentId: string;
    onAddressAdded?: (address: Address) => void;
    onAddressUpdated?: (address: Address) => void;
    onAddressDeleted?: (addresses: Address[]) => void;
    onAddressesRefreshed?: (addresses: Address[]) => void;
    onAddressSelected?: (address: Address | null) => void;
    autoSelectNewAddress?: boolean;
    autoRefreshOnFocus?: boolean;
}

/**
 * Custom hook for synchronizing with address store changes
 * Provides real-time updates and proper cleanup for address-related components
 */
export const useAddressSync = (options: UseAddressSyncOptions) => {
    const {
        componentId,
        onAddressAdded,
        onAddressUpdated,
        onAddressDeleted,
        onAddressesRefreshed,
        onAddressSelected,
        autoSelectNewAddress = false,
        autoRefreshOnFocus = true,
    } = options;

    const addressStore = useAddressStore();
    const {
        addresses,
        selectedAddress,
        refreshAddresses,
        subscribeComponent,
        setSelectedAddress,
    } = addressStore;

    const isInitialized = useRef(false);

    // Handle address change events - use useRef to avoid re-subscription
    const handlersRef = useRef({
        onAddressAdded,
        onAddressUpdated,
        onAddressDeleted,
        onAddressesRefreshed,
        onAddressSelected,
        autoSelectNewAddress,
    });

    // Update handlers ref when they change
    useEffect(() => {
        handlersRef.current = {
            onAddressAdded,
            onAddressUpdated,
            onAddressDeleted,
            onAddressesRefreshed,
            onAddressSelected,
            autoSelectNewAddress,
        };
    }, [onAddressAdded, onAddressUpdated, onAddressDeleted, onAddressesRefreshed, onAddressSelected, autoSelectNewAddress]);

    const handleAddressEvent = useCallback((event: AddressChangeEvent) => {
        console.log(`🔄 ${componentId}: Received address event:`, event.type);
        const handlers = handlersRef.current;

        switch (event.type) {
            case 'ADDED':
                if (event.address) {
                    console.log(`🔄 ${componentId}: Address added:`, event.address.addressLine1);
                    handlers.onAddressAdded?.(event.address);

                    // Auto-select newly added address if enabled and no address is selected
                    if (handlers.autoSelectNewAddress && !selectedAddress) {
                        console.log(`🔄 ${componentId}: Auto-selecting newly added address`);
                        setSelectedAddress(event.address);
                    }
                }
                break;

            case 'UPDATED':
                if (event.address) {
                    console.log(`🔄 ${componentId}: Address updated:`, event.address.addressLine1);
                    handlers.onAddressUpdated?.(event.address);
                }
                break;

            case 'DELETED':
                if (event.addresses) {
                    console.log(`🔄 ${componentId}: Address deleted, remaining:`, event.addresses.length);
                    handlers.onAddressDeleted?.(event.addresses);
                }
                break;

            case 'REFRESHED':
                if (event.addresses) {
                    console.log(`🔄 ${componentId}: Addresses refreshed, count:`, event.addresses.length);
                    handlers.onAddressesRefreshed?.(event.addresses);
                }
                break;

            case 'SELECTED':
                console.log(`🔄 ${componentId}: Address selected:`, event.address?.addressLine1 || 'none');
                handlers.onAddressSelected?.(event.address || null);
                break;
        }
    }, [componentId, selectedAddress, setSelectedAddress]);

    // Subscribe to address changes - only re-subscribe if componentId changes
    useEffect(() => {
        console.log(`🔄 ${componentId}: Setting up address synchronization...`);

        const unsubscribe = subscribeComponent(componentId, handleAddressEvent);

        return () => {
            console.log(`🔄 ${componentId}: Cleaning up address synchronization...`);
            unsubscribe();
        };
    }, [componentId, subscribeComponent]); // Removed handleAddressEvent from dependencies

    // Auto-refresh addresses on component mount
    useEffect(() => {
        if (autoRefreshOnFocus && !isInitialized.current) {
            console.log(`🔄 ${componentId}: Auto-refreshing addresses on mount...`);
            refreshAddresses();
            isInitialized.current = true;
        }
    }, [componentId, autoRefreshOnFocus, refreshAddresses]);

    // Utility functions for common address operations
    const syncUtils = {
        // Force refresh addresses
        forceRefresh: useCallback(() => {
            console.log(`🔄 ${componentId}: Force refreshing addresses...`);
            return refreshAddresses();
        }, [componentId, refreshAddresses]),

        // Get fresh addresses from store
        getFreshAddresses: useCallback(() => {
            return addressStore.getFreshAddresses();
        }, [addressStore]),

        // Check if an address exists in current store
        addressExists: useCallback((addressId: string) => {
            return addresses.some(addr => addr._id === addressId);
        }, [addresses]),

        // Get address by ID from current store
        getAddressById: useCallback((addressId: string) => {
            return addresses.find(addr => addr._id === addressId) || null;
        }, [addresses]),

        // Get default address from current store
        getDefaultAddress: useCallback(() => {
            return addresses.find(addr => addr.isDefault) || null;
        }, [addresses]),
    };

    return {
        // Store state
        addresses,
        selectedAddress,
        loading: addressStore.loading,
        error: addressStore.error,

        // Utility functions
        ...syncUtils,

        // Store actions (for convenience)
        setSelectedAddress,
        refreshAddresses,
    };
};

/**
 * Simplified hook for components that only need to listen to address changes
 */
export const useAddressListener = (
    componentId: string,
    callback: (event: AddressChangeEvent) => void
) => {
    const addressStore = useAddressStore();

    useEffect(() => {
        console.log(`👂 ${componentId}: Setting up address listener...`);

        const unsubscribe = addressStore.subscribeComponent(componentId, callback);

        return () => {
            console.log(`👂 ${componentId}: Cleaning up address listener...`);
            unsubscribe();
        };
    }, [componentId, callback, addressStore]);
};

/**
 * Hook for components that need to ensure they have the latest address data
 */
export const useAddressRefresh = (componentId: string, refreshOnMount = true) => {
    const addressStore = useAddressStore();
    const hasRefreshed = useRef(false);

    const refresh = useCallback(() => {
        console.log(`🔄 ${componentId}: Refreshing addresses...`);
        return addressStore.refreshAddresses();
    }, [componentId, addressStore]);

    useEffect(() => {
        if (refreshOnMount && !hasRefreshed.current) {
            refresh();
            hasRefreshed.current = true;
        }
    }, [refreshOnMount, refresh]);

    return { refresh, addresses: addressStore.addresses };
};