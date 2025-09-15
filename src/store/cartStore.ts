import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../../types/types';

interface CartItem extends Omit<Product, 'quantity'> {
  quantity: number;
}

interface CartStore {
  // State
  cart: CartItem[];
  isLoading: boolean;

  // Computed properties
  totalItems: number;
  totalCost: number;

  // Actions
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  clearCart: () => void;

  // Async actions
  loadCart: () => Promise<void>;
  saveCart: () => Promise<void>;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      // Initial state
      cart: [],
      isLoading: false,

      // Computed properties
      get totalItems() {
        return get().cart.reduce((total, item) => total + item.quantity, 0);
      },

      get totalCost() {
        return get().cart.reduce((total, item) => total + ((item.price || item.basePrice || 0) * item.quantity), 0);
      },

      // Actions
      addToCart: (product: Product) => {
        set((state) => {
          const existingItem = state.cart.find((item) => item.id === product.id);
          if (existingItem) {
            return {
              cart: state.cart.map((item) =>
                item.id === product.id
                  ? { ...item, quantity: item.quantity + 1 }
                  : item
              ),
            };
          } else {
            return {
              cart: [...state.cart, { ...product, quantity: 1 }],
            };
          }
        });
      },

      removeFromCart: (productId: string) => {
        set((state) => ({
          cart: state.cart.filter((item) => item.id !== productId),
        }));
      },

      incrementQuantity: (productId: string) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === productId
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        }));
      },

      decrementQuantity: (productId: string) => {
        set((state) => ({
          cart: state.cart.map((item) =>
            item.id === productId
              ? { ...item, quantity: Math.max(0, item.quantity - 1) }
              : item
          ).filter((item) => item.quantity > 0), // Remove items with 0 quantity
        }));
      },

      clearCart: () => {
        set({ cart: [] });
      },

      // Async actions
      loadCart: async () => {
        set({ isLoading: true });
        try {
          // Load from AsyncStorage if needed
          const savedCart = await AsyncStorage.getItem('cart');
          if (savedCart) {
            set({ cart: JSON.parse(savedCart) });
          }
        } catch (error) {
          console.error('Failed to load cart:', error);
        } finally {
          set({ isLoading: false });
        }
      },

      saveCart: async () => {
        try {
          await AsyncStorage.setItem('cart', JSON.stringify(get().cart));
        } catch (error) {
          console.error('Failed to save cart:', error);
        }
      },
    }),
    {
      name: 'cart-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ cart: state.cart }),
    }
  )
);
