import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product, Address } from '../../types/types';

// Simple Branch interface for the store
interface Branch {
  id: string;
  name: string;
  location?: {
    latitude: number;
    longitude: number;
  };
}

// Types
interface CartItem extends Omit<Product, 'id'> {
  id: string;
  quantity: number;
}

// App Store Interface
interface AppStore {
  // Cart State
  cart: CartItem[];
  isCartLoading: boolean;
  
  // Address State
  addresses: Address[];
  isAddressLoading: boolean;
  defaultAddressId: string | null;
  
  // Branch State
  branches: Branch[];
  isBranchLoading: boolean;
  selectedBranch: Branch | null;
  
  // User State
  userId: string | null;
  userRole: 'Customer' | 'DeliveryPartner' | null;
  
  // Computed Properties
  cartTotalItems: number;
  cartTotalCost: number;
  
  // Cart Actions
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  incrementCartQuantity: (productId: string) => void;
  decrementCartQuantity: (productId: string) => void;
  clearCart: () => void;
  
  // Address Actions
  setAddresses: (addresses: Address[]) => void;
  addAddress: (address: Address) => void;
  updateAddress: (addressId: string, address: Partial<Address>) => void;
  removeAddress: (addressId: string) => void;
  setDefaultAddress: (addressId: string) => void;
  
  // Branch Actions
  setBranches: (branches: Branch[]) => void;
  setSelectedBranch: (branch: Branch | null) => void;
  
  // User Actions
  setUser: (userId: string, userRole: 'Customer' | 'DeliveryPartner') => void;
  clearUser: () => void;
  
  // Utility Actions
  clearAllData: () => void;
  hydrateStore: () => Promise<void>;
}

// Create the store with persistence
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      // Initial State
      cart: [],
      isCartLoading: false,
      addresses: [],
      isAddressLoading: false,
      defaultAddressId: null,
      branches: [],
      isBranchLoading: false,
      selectedBranch: null,
      userId: null,
      userRole: null,
      
      // Computed Properties
      get cartTotalItems() {
        return get().cart.reduce((total, item) => total + item.quantity, 0);
      },
      
      get cartTotalCost() {
        return get().cart.reduce((total, item) => {
          const price = item.discountPrice || item.basePrice || item.price || 0;
          return total + (price * item.quantity);
        }, 0);
      },
      
      // Cart Actions
      addToCart: (product: Product) => {
        set((state) => {
          const existingItem = state.cart.find((item) => item.id === product._id);
          if (existingItem) {
            return {
              cart: state.cart.map((item) =>
                item.id === product._id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          } else {
            const cartItem: CartItem = {
              ...product,
              id: product._id,
              quantity: 1,
            };
            return {
              cart: [...state.cart, cartItem],
            };
          }
        });
      },
      
      removeFromCart: (productId: string) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== productId),
        }));
      },
      
      incrementCartQuantity: (productId: string) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === productId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        }));
      },
      
      decrementCartQuantity: (productId: string) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === productId
              ? { ...item, quantity: Math.max(0, item.quantity - 1) }
              : item
          ).filter((item) => item.quantity > 0),
        }));
      },
      
      clearCart: () => {
        set({ cart: [] });
      },
      
      // Address Actions
      setAddresses: (addresses: Address[]) => {
        set({ addresses });
      },
      
      addAddress: (address: Address) => {
        set((state) => ({
          addresses: [...state.addresses, address],
        }));
      },
      
      updateAddress: (addressId: string, updates: Partial<Address>) => {
        set((state) => ({
          addresses: state.addresses.map((addr) =>
            addr._id === addressId ? { ...addr, ...updates } : addr
          ),
        }));
      },
      
      removeAddress: (addressId: string) => {
        set((state) => ({
          addresses: state.addresses.filter((addr) => addr._id !== addressId),
          defaultAddressId: state.defaultAddressId === addressId ? null : state.defaultAddressId,
        }));
      },
      
      setDefaultAddress: (addressId: string) => {
        set({ defaultAddressId: addressId });
      },
      
      // Branch Actions
      setBranches: (branches: Branch[]) => {
        set({ branches });
      },
      
      setSelectedBranch: (branch: Branch | null) => {
        set({ selectedBranch: branch });
      },
      
      // User Actions
      setUser: (userId: string, userRole: 'Customer' | 'DeliveryPartner') => {
        set({ userId, userRole });
      },
      
      clearUser: () => {
        set({
          userId: null,
          userRole: null,
          cart: [],
          addresses: [],
          defaultAddressId: null,
          selectedBranch: null,
        });
      },
      
      // Utility Actions
      clearAllData: () => {
        set({
          cart: [],
          addresses: [],
          branches: [],
          userId: null,
          userRole: null,
          defaultAddressId: null,
          selectedBranch: null,
        });
      },
      
      hydrateStore: async () => {
        try {
          // Load persisted data
          const keys = ['cart', 'addresses', 'userId', 'userRole', 'defaultAddressId', 'selectedBranch'];
          const data = await AsyncStorage.multiGet(keys);
          const state: Partial<AppStore> = {};
          
          data.forEach(([key, value]) => {
            if (value) {
              state[key as keyof AppStore] = JSON.parse(value);
            }
          });
          
          set(state);
        } catch (error) {
          console.error('Failed to hydrate store:', error);
        }
      },
    }),
    {
      name: 'food-delivery-app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      
      // Persist only essential data
      partialize: (state) => ({
        cart: state.cart,
        addresses: state.addresses,
        userId: state.userId,
        userRole: state.userRole,
        defaultAddressId: state.defaultAddressId,
        selectedBranch: state.selectedBranch,
      }),
    }
  )
);
