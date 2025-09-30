// src/types.ts
// Quantity Schema for better admin management
export interface Quantity {
  value: number;
  unit: 'ml' | 'g' | 'kg' | 'l' | 'pieces' | 'pack';
}

// Delivery Quantity Schema - matches backend schema
export interface DeliveryQuantity {
  quantityValue: number;
  quantityUnit: string;
}


// Main Product Interface - Updated to match backend schema
export interface Product {
  _id: string;
  id?: string;
  name: string;
  description?: string;
  category?: {
    _id: string;
    name: string;
  } | string;
  brand?: string;
  images: string[];
  quantityValue: string;
  quantityUnit: string;
  basePrice: number;
  discountPrice?: number;
  subscriptionPrice?: number;
  unitPerSubscription?: number;
  stock: number;
  lowStockThreshold?: number;
  tags?: string[];
  variants?: string[];
  relatedProducts?: string[];
  featured?: boolean;
  status?: 'active' | 'inactive';
  price?: number; // Legacy compatibility
  retail?: {
    unitPrice: number;
  };
  wholesale?: {
    bundlePrice: number;
    unitsPerBundle: number;
    unitPrice: number;
  };
}

// Search and Filter Types
export interface ProductSearchParams {
  q?: string;
  tags?: string;
  category?: string;
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  featured?: boolean;
  trending?: boolean;
  bestseller?: boolean;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface ProductPagination {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface ProductSearchResponse {
  products: Product[];
  pagination: ProductPagination;
}

// Product Collection Types
export interface ProductCollection {
  featured: Product[];
  trending: Product[];
  bestsellers: Product[];
}

// Product Filter Types
export interface ProductFilters {
  categories?: string[];
  brands?: string[];
  priceRange?: {
    min: number;
    max: number;
  };
  tags?: string[];
  status?: ('active' | 'inactive' | 'discontinued' | 'out_of_stock')[];
  featured?: boolean;
  trending?: boolean;
  bestseller?: boolean;
}

// Product Sort Options
export type ProductSortOption = 
  | 'name'
  | 'price'
  | 'discountPrice'
  | 'createdAt'
  | 'updatedAt'
  | 'ratings.average'
  | 'ratings.count'
  | 'stock';

// Product API Response Types
export interface ProductListResponse {
  products: Product[];
  pagination: ProductPagination;
  filters?: {
    categories: { _id: string; name: string; count: number }[];
    brands: { name: string; count: number }[];
    tags: { name: string; count: number }[];
    priceRange: { min: number; max: number };
  };
}


// Product Variant Selection
export interface SelectedVariant {
  variantId: string;
  price: number;
  discountPrice?: number;
  quantity: {
    value: number;
    unit: string;
  };
  stock: number;
  sku?: string;
  images: string[];
}

// Pricing Modes
export type PricingMode = 'retail' | 'wholesale';

// Cart Item with pricing mode
export interface ProductCartItem {
  productId: string;
  quantity: number;
  pricingMode: PricingMode;
  product: Product;
  unitPrice: number;
  totalPrice?: number;
  unitsPerBundle?: number;
  bundleCount?: number;
  extraUnits?: number;
  // Add these new fields for proper pricing calculation
  retailUnitPrice?: number;
  bundlePrice?: number;
}


// Product Wishlist Item
export interface ProductWishlistItem {
  productId: string;
  addedAt: string;
  product: Product;
}

// Product Review Types
export interface ProductReview {
  _id: string;
  productId: string;
  userId: string;
  userName: string;
  rating: number;
  title: string;
  comment: string;
  images?: string[];
  verified: boolean;
  helpful: number;
  createdAt: string;
  updatedAt: string;
}

// Product Comparison Types
export interface ProductComparison {
  products: Product[];
  comparedFields: (keyof Product)[];
}

// Product Search Suggestions
export interface ProductSearchSuggestion {
  type: 'product' | 'category' | 'brand' | 'tag';
  value: string;
  count?: number;
  icon?: string;
}

// Product Image Types
export interface ProductImage {
  url: string;
  alt?: string;
  isPrimary?: boolean;
  thumbnail?: string;
}

// Product Nutrition Display
export interface NutritionDisplay {
  label: string;
  value: number;
  unit: string;
  dailyValue?: number;
  color?: string;
}

// Product Badge Types
export interface ProductBadge {
  type: 'featured' | 'trending' | 'bestseller' | 'new' | 'sale' | 'limited';
  text: string;
  color: string;
  backgroundColor: string;
}

// Product Quick Actions
export interface ProductQuickAction {
  id: string;
  label: string;
  icon: string;
  action: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
}

// Product Filter State
export interface ProductFilterState {
  searchQuery: string;
  selectedCategories: string[];
  selectedBrands: string[];
  priceRange: [number, number];
  selectedTags: string[];
  sortBy: ProductSortOption;
  sortOrder: 'asc' | 'desc';
  showOnlyFeatured: boolean;
  showOnlyTrending: boolean;
  showOnlyBestsellers: boolean;
  inStockOnly: boolean;
}

// Product List View Types
export type ProductListView = 'grid' | 'list' | 'compact';

// Product Loading States
export interface ProductLoadingState {
  isLoading: boolean;
  isSearching: boolean;
  isFiltering: boolean;
  isSorting: boolean;
  error?: string;
}

// Product API Error Types
export interface ProductApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, any>;
}

// Pricing Calculation Types
export interface PricingCalculation {
  mode: PricingMode;
  unitPrice: number;
  totalPrice: number;
  unitsPerBundle?: number;
  unitsPerBox?: number;
  bundleCount?: number;
  extraUnits?: number;
  isAvailable: boolean;
  reason?: string; // Why this mode is not available
}

// Product Pricing Display
export interface ProductPricingDisplay {
  retail: {
    unitPrice: number;
    originalPrice?: number;
    discountPercentage?: number;
    isAvailable: boolean;
  };
  subscription?: {
    unitPrice: number;
    bundlePrice: number;
    unitsPerBundle: number;
    isAvailable: boolean;
    reason?: string;
  };
  box?: {
    unitPrice: number;
    boxPrice: number;
    unitsPerBox: number;
    isAvailable: boolean;
    reason?: string;
  };
}





export interface DeliveryPartnerDetails {
  partner?: string;
  phone?: string;
  name?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
    address: string;
  };
  assignedDate?: Date;
}



export interface CategoryProductCardProps {
  product: Product;
}

export interface User {
  _id: string;
  phone?: string;
  email?: string;
  name?: string;
  role: 'Customer' | 'DeliveryPartner' | 'Admin';
  isSubscription?: boolean; // Subscription status for customers
  isActivated?: boolean;
  address?: string[];
  liveLocation?: {
    latitude: number;
    longitude: number;
  };
}

export interface Address {
  _id: string;
  userId: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  isDefault: boolean;
  latitude?: number;   
  longitude?: number;
  isCurrentLocation?: boolean; // Flag to identify current location addresses
}

// The product data structure for the bestsellers and other product lists
export interface ProductSectionProps {
  title: string;
  products: Product[];
  isOrderingDisabled?: boolean;
}


export interface Order {
  _id: string;
  id?: string; // Alternative ID field
  orderId?: string;
  customer?: {
    _id: string;
    name: string;
    phone?: string;
    address?: string;
  };
  deliveryLocation?: {
    address?: string;
    addressLine1?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    latitude?: number;
    longitude?: number;
  };
  pickupLocation?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  deliveryPersonLocation?: {
    address?: string;
    latitude?: number;
    longitude?: number;
  };
  totalPrice: number;
  deliveryFee: number;
  branch?: {
    _id: string;
    name: string;
    address: string;
    location?: {
      latitude: number;
      longitude: number;
    };
  };
  deliveryPartner?: {
    _id: string;
    name: string;
    phone: string;
  };
  items: Item[];
  status: 'pending' | 'accepted' | 'in-progress' | "awaitconfirmation" | 'delivered' | 'cancelled' | string;
  deliveryStatus?: 'Assigning Partner' | 'Partner Assigned' | 'On The Way' | 'Delivered' | 'Cancelled' | string;
  paymentStatus?: 'pending' | 'verified' | 'failed' | 'refunded' | 'completed';
  paymentDetails?: {
    razorpayOrderId?: string;
    razorpayPaymentId?: string;
    razorpaySignature?: string;
    verifiedAt?: Date | string;
    amount?: number;
    currency?: string;
    method?: string;
    refundId?: string;
    refundedAt?: Date | string;
    refundAmount?: number;
    refundReason?: string;
  };
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface Item {
  product?: Product | string;
  name: string;
  brand?: string;
  quantityValue?: string;
  quantityUnit?: string;
  mode?: string;
  unitsBought: number;
  unitPrice?: number;
  totalPrice: number;
  bundlesBought?: number;
  boxesBought?: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  image?: string;
}





export interface ProductCardProps {
  product: Product;
  featuredOnly?: boolean; 
}


export interface SearchBarProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export interface RadioButtonProps {
  label: string;
  value: string;
  selectedValue: string;
  onPress: (value: string) => void;
}
