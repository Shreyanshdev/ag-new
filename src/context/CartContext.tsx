import React, { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { Product, ProductCartItem, PricingMode, PricingCalculation } from '../../types/types';

interface CartContextType {
  cart: ProductCartItem[];
  addToCart: (product: Product, pricingMode?: PricingMode, quantity?: number, userIsSubscribed?: boolean, cartTotal?: number) => void;
  removeFromCart: (productId: string) => void;
  incrementQuantity: (productId: string) => void;
  decrementQuantity: (productId: string) => void;
  updatePricingMode: (productId: string, pricingMode: PricingMode) => void;
  clearCart: () => void;
  totalItems: number;
  totalCost: number;
  // Pricing utilities
  calculatePricing: (product: Product, pricingMode: PricingMode, userIsSubscribed?: boolean, cartTotal?: number) => PricingCalculation;
  getAvailablePricingModes: (product: Product, userIsSubscribed?: boolean, cartTotal?: number) => PricingMode[];
  // New utility aligned with backend
  calculateOptimalPricing: (product: Product, quantity: number, userIsSubscribed?: boolean, cartTotal?: number) => PricingCalculation;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<ProductCartItem[]>([]);

  // Clean up cart on initialization to remove any invalid items
  useEffect(() => {
    setCart(prevCart => {
      const validCart = prevCart.filter(item => {
        if (!item.product || !item.productId) {
          console.warn('🧹 Removing invalid cart item:', item);
          return false;
        }
        return true;
      });
      
      if (validCart.length !== prevCart.length) {
        console.log('🧹 Cleaned up cart, removed invalid items');
      }
      
      return validCart;
    });
  }, []);

  // Helper function to get retail unit price (matches backend logic)
  const getRetailUnitPrice = (product: Product): number => {
    if (!product) {
      console.error('❌ getRetailUnitPrice: Product is null');
      return 0;
    }
    return product.discountPrice || product.basePrice || product.retail?.unitPrice || product.price || 0;
  };

  // Calculate optimal pricing matching backend createOrder logic
  const calculateOptimalPricing = (
    product: Product,
    quantity: number,
    userIsSubscribed: boolean = false,
    cartTotal: number = 0
  ): PricingCalculation => {
    // Safety check for null product
    if (!product) {
      console.error('❌ calculateOptimalPricing: Product is null');
      return {
        mode: 'retail',
        unitPrice: 0,
        totalPrice: 0,
        isAvailable: false,
        reason: 'Product is null'
      };
    }

    const retailUnit = getRetailUnitPrice(product);
    const THRESHOLD = 2500;

    // Non-subscribers can only use retail
    if (!userIsSubscribed) {
      return {
        mode: 'retail',
        unitPrice: retailUnit,
        totalPrice: retailUnit * quantity,
        isAvailable: product.stock >= quantity,
        reason: product.stock < quantity ? 'Insufficient stock' : undefined
      };
    }

    // For subscribers, calculate both retail and wholesale options
    const retailTotal = retailUnit * quantity;

    // Check if wholesale bundle is available and cart meets threshold
    if (product.subscriptionPrice && product.unitPerSubscription && cartTotal >= THRESHOLD) {
      const bundleCount = Math.floor(quantity / product.unitPerSubscription);
      const remaining = quantity % product.unitPerSubscription;
      
      if (bundleCount > 0) {
        const wholesaleTotal = (bundleCount * product.subscriptionPrice) + (remaining * retailUnit);
        
        // Use wholesale if it's cheaper
        if (wholesaleTotal < retailTotal) {
          return {
            mode: 'wholesale',
            unitPrice: wholesaleTotal / quantity,
            totalPrice: wholesaleTotal,
            unitsPerBundle: product.unitPerSubscription,
            bundleCount: bundleCount,
            extraUnits: remaining,
            isAvailable: product.stock >= quantity,
            reason: product.stock < quantity ? 'Insufficient stock' : undefined
          };
        }
      }
    }

    // Default to retail
    return {
      mode: 'retail',
      unitPrice: retailUnit,
      totalPrice: retailTotal,
      isAvailable: product.stock >= quantity,
      reason: product.stock < quantity ? 'Insufficient stock' : undefined
    };
  };

  // Original pricing calculation logic (preserved for backward compatibility)
  const calculatePricing = (product: Product, pricingMode: PricingMode, userIsSubscribed: boolean = false, cartTotal: number = 0): PricingCalculation => {
    // Safety check for null product
    if (!product) {
      console.error('❌ calculatePricing: Product is null');
      return {
        mode: 'retail',
        unitPrice: 0,
        totalPrice: 0,
        isAvailable: false,
        reason: 'Product is null'
      };
    }

    const basePrice = product.retail?.unitPrice || product.price || product.basePrice || 0;
    const discountPrice = product.discountPrice;
    const subscriptionPrice = product.subscriptionPrice;
    const unitPerSubscription = product.unitPerSubscription || 1;

    switch (pricingMode) {
      case 'retail':
        const retailPrice = discountPrice && discountPrice < basePrice ? discountPrice : basePrice;
        return {
          mode: 'retail',
          unitPrice: retailPrice,
          totalPrice: retailPrice,
          isAvailable: product.stock > 0,
          reason: product.stock === 0 ? 'Out of stock' : undefined
        };

      case 'wholesale':
        if (!userIsSubscribed) {
          return {
            mode: 'wholesale',
            unitPrice: 0,
            totalPrice: 0,
            isAvailable: false,
            reason: 'Subscription required'
          };
        }

        // Remove cart total check - allow adding bundles regardless of current cart total
        if (!subscriptionPrice || !unitPerSubscription) {
          return {
            mode: 'wholesale',
            unitPrice: 0,
            totalPrice: 0,
            isAvailable: false,
            reason: 'Subscription pricing not available'
          };
        }

        const subscriptionUnitPrice = subscriptionPrice / unitPerSubscription;
        return {
          mode: 'wholesale',
          unitPrice: subscriptionUnitPrice,
          totalPrice: subscriptionPrice,
          unitsPerBundle: unitPerSubscription,
          isAvailable: product.stock >= unitPerSubscription,
          reason: product.stock < unitPerSubscription ? 'Insufficient stock for subscription bundle' : undefined
        };

      default:
        return {
          mode: 'retail',
          unitPrice: basePrice,
          totalPrice: basePrice,
          isAvailable: false,
          reason: 'Invalid pricing mode'
        };
    }
  };

  // Get available pricing modes for product
  const getAvailablePricingModes = (product: Product, userIsSubscribed: boolean = false, cartTotal: number = 0): PricingMode[] => {
    const modes: PricingMode[] = ['retail'];
    
    if (userIsSubscribed) {
      if (product.subscriptionPrice && product.unitPerSubscription) {
        modes.push('wholesale');
      }
    }
    
    return modes;
  };

  // FIXED: Add product to cart with single item per product logic
  const addToCart = useCallback((
    product: Product,
    pricingMode: PricingMode = 'retail',
    quantity: number = 1,
    userIsSubscribed: boolean = false,
    cartTotal: number = 0
  ) => {
    console.log('🛒 CartContext: addToCart called with:', {
      productName: product?.name,
      productId: product?._id,
      pricingMode,
      quantity,
      userIsSubscribed,
      cartTotal
    });

    // Safety check for null product
    if (!product || !product._id) {
      console.error('❌ addToCart: Product is null or missing _id:', product);
      return;
    }

    setCart((prevCart) => {
      try {
        // Find existing item by productId only (ignore pricing mode)
        const existingItem = prevCart.find(item => item.productId === product._id);
        
        if (existingItem) {
          // Update quantity and let optimal pricing calculation happen
          const newQuantity = existingItem.quantity + quantity;
          const currentCartTotal = prevCart.reduce((sum, item) => sum + (item.totalPrice || (item.unitPrice * item.quantity)), 0);
          const optimalPricing = calculateOptimalPricing(product, newQuantity, userIsSubscribed, currentCartTotal);
          
          if (!optimalPricing.isAvailable) {
            console.warn(`Cannot add product to cart: ${optimalPricing.reason}`);
            return prevCart;
          }
          
          return prevCart.map(item =>
            item.productId === product._id
              ? {
                  ...item,
                  quantity: newQuantity,
                  pricingMode: optimalPricing.mode,
                  unitPrice: optimalPricing.unitPrice,
                  totalPrice: optimalPricing.totalPrice,
                  unitsPerBundle: optimalPricing.unitsPerBundle,
                  bundleCount: optimalPricing.bundleCount,
                  extraUnits: optimalPricing.extraUnits
                }
              : item
          );
        } else {
          // Add new item
          const currentCartTotal = prevCart.reduce((sum, item) => sum + (item.totalPrice || (item.unitPrice * item.quantity)), 0);
          const optimalPricing = calculateOptimalPricing(product, quantity, userIsSubscribed, currentCartTotal);
          
          if (!optimalPricing.isAvailable) {
            console.warn(`Cannot add product to cart: ${optimalPricing.reason}`);
            return prevCart;
          }
          
          const newCartItem: ProductCartItem = {
            productId: product._id,
            quantity,
            pricingMode: optimalPricing.mode,
            product,
            unitPrice: optimalPricing.unitPrice,
            totalPrice: optimalPricing.totalPrice,
            unitsPerBundle: optimalPricing.unitsPerBundle,
            bundleCount: optimalPricing.bundleCount,
            extraUnits: optimalPricing.extraUnits
          };
          
          console.log('🛒 CartContext: Adding new cart item:', newCartItem);
          const newCart = [...prevCart, newCartItem];
          console.log('🛒 CartContext: New cart state:', newCart);
          return newCart;
        }
      } catch (error) {
        console.error('❌ Error in addToCart:', error);
        return prevCart; // Return previous state on error
      }
    });
  }, [calculateOptimalPricing]);

  // Remove product from cart (preserved)
  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.productId !== productId));
  };

  // FIXED: Increment quantity with optimal pricing recalculation
  const incrementQuantity = useCallback((productId: string) => {
    setCart((prevCart) => {
      try {
        return prevCart.map((item) => {
          if (item.productId === productId) {
            const newQuantity = item.quantity + 1;
            
            // Safety check for null product in cart item
            if (!item.product) {
              console.error('❌ incrementQuantity: Cart item has null product:', item);
              return item; // Return unchanged item
            }
            
            // Calculate current cart total excluding this item
            const currentCartTotal = prevCart
              .filter(cartItem => cartItem.productId !== productId)
              .reduce((sum, cartItem) => sum + (cartItem.totalPrice || (cartItem.unitPrice * cartItem.quantity)), 0);
            
            const optimalPricing = calculateOptimalPricing(item.product, newQuantity, true, currentCartTotal);
            
            return {
              ...item,
              quantity: newQuantity,
              pricingMode: optimalPricing.mode,
              unitPrice: optimalPricing.unitPrice,
              totalPrice: optimalPricing.totalPrice,
              unitsPerBundle: optimalPricing.unitsPerBundle,
              bundleCount: optimalPricing.bundleCount,
              extraUnits: optimalPricing.extraUnits
            };
          }
          return item;
        });
      } catch (error) {
        console.error('❌ Error in incrementQuantity:', error);
        return prevCart; // Return previous state on error
      }
    });
  }, [calculateOptimalPricing]);

  // FIXED: Decrement quantity with optimal pricing recalculation
  const decrementQuantity = useCallback((productId: string) => {
    setCart((prevCart) => {
      try {
        return prevCart
          .map((item) => {
            if (item.productId === productId) {
              const newQuantity = item.quantity - 1;
              
              if (newQuantity <= 0) {
                return null; // Will be filtered out
              }
              
              // Safety check for null product in cart item
              if (!item.product) {
                console.error('❌ decrementQuantity: Cart item has null product:', item);
                return item; // Return unchanged item
              }
              
              // Calculate current cart total excluding this item
              const currentCartTotal = prevCart
                .filter(cartItem => cartItem.productId !== productId)
                .reduce((sum, cartItem) => sum + (cartItem.totalPrice || (cartItem.unitPrice * cartItem.quantity)), 0);
              
              const optimalPricing = calculateOptimalPricing(item.product, newQuantity, true, currentCartTotal);
              
              return {
                ...item,
                quantity: newQuantity,
                pricingMode: optimalPricing.mode,
                unitPrice: optimalPricing.unitPrice,
                totalPrice: optimalPricing.totalPrice,
                unitsPerBundle: optimalPricing.unitsPerBundle,
                bundleCount: optimalPricing.bundleCount,
                extraUnits: optimalPricing.extraUnits
              };
            }
            return item;
          })
          .filter((item): item is ProductCartItem => item !== null); // Remove items with 0 quantity and fix TypeScript
      } catch (error) {
        console.error('❌ Error in decrementQuantity:', error);
        return prevCart; // Return previous state on error
      }
    });
  }, [calculateOptimalPricing]);

  // Update pricing mode (preserved and enhanced)
  const updatePricingMode = (productId: string, pricingMode: PricingMode) => {
    setCart((prevCart) => {
      return prevCart.map((item) => {
        if (item.productId === productId) {
          // Safety check for null product in cart item
          if (!item.product) {
            console.error('❌ updatePricingMode: Cart item has null product:', item);
            return item; // Return unchanged item
          }
          
          const pricing = calculatePricing(item.product, pricingMode);
          return {
            ...item,
            pricingMode: pricing.mode,
            unitPrice: pricing.unitPrice,
            totalPrice: pricing.totalPrice,
            unitsPerBundle: pricing.unitsPerBundle,
            bundleCount: pricing.bundleCount,
            extraUnits: pricing.extraUnits
          };
        }
        return item;
      });
    });
  };

  // Clear cart (preserved)
  const clearCart = () => {
    setCart([]);
  };

  // Calculate total items (memoized for performance)
  const totalItems = useMemo(() => 
    cart.reduce((sum, item) => sum + item.quantity, 0), 
    [cart]
  );

  // Calculate total cost (memoized for performance)
  const totalCost = useMemo(() => 
    cart.reduce((sum, item) => sum + (item.totalPrice || (item.unitPrice * item.quantity)), 0), 
    [cart]
  );


  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        incrementQuantity,
        decrementQuantity,
        updatePricingMode,
        clearCart,
        totalItems,
        totalCost,
        calculatePricing,
        getAvailablePricingModes,
        calculateOptimalPricing
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export default CartProvider;
