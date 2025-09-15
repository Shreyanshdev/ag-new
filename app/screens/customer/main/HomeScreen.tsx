import React, { useState, useEffect, useCallback, useMemo, memo } from 'react';
import {
  ScrollView,
  StyleSheet,
  Platform,
  RefreshControl,
  View,
  Text,
  FlatList
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import ErrorBoundary from '../../../../src/components/ErrorBoundary';

import TopBar from '../../../components/shared/TopBar';
import SearchBar from '../../../components/shared/SearchBar';
import FloatingCart from '../../../components/shared/FloatingCart';
import Footer from '../../../components/shared/Footer';
import ProductCard from '../../../components/customer/products/ProductCard';
import HomeCategorySection from '../../../components/customer/main/HomeCategorySection';
import HeroBanner from '../../../components/customer/main/HeroBanner';
import ActiveOrderBanner from '../../../components/customer/orders/ActiveOrderBanner';
import { getAllProducts, getFeaturedProducts, getActiveOrderForUser, isFirstTimeUserError } from '../../../../src/config/api';
import { ErrorHandler } from '../../../../src/utils/errorHandler';
import { perf, measureApiCall } from '../../../../src/utils/performance';
import { useBranch } from '../../../../src/context/BranchContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAddressStore } from '@/src/store/addressStore';
import { router } from 'expo-router';

interface Product {
  _id: string;
  name: string;
  images: string[];
  basePrice: number;
  discountPrice?: number;
  subscriptionPrice?: number;
  unitPerSubscription?: number;
  stock: number;
  featured?: boolean;
  quantityValue: string;
  quantityUnit: string;
  brand?: string;
}

interface Order {
  _id: string;
  orderId: string;
  status: string;
  deliveryStatus: string;
  totalPrice: number;
  deliveryFee: number;
  createdAt: string;
  updatedAt: string;
  items: {
    name: string;
    unitsBought: number;
    totalPrice: number;
  }[];
}


const HomeScreen: React.FC = () => {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasFetchedData, setHasFetchedData] = useState(false);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);

  useBranch();

  // Fetch products data with performance monitoring
  const { refreshAddresses } = useAddressStore();
  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      perf.startTimer('fetchProducts');

      // Fetch all products with performance monitoring
      const allProductsResponse = await measureApiCall(
        () => getAllProducts({ limit: 50 }),
        'getAllProducts'
      );
      const products = allProductsResponse.data.products || allProductsResponse.data || [];

      // Fetch featured products with performance monitoring
      const featuredResponse = await measureApiCall(
        () => getFeaturedProducts({ limit: 10 }),
        'getFeaturedProducts'
      );
      const featured = featuredResponse.data || [];

      setAllProducts(products);
      setFeaturedProducts(featured);

      perf.endTimer('fetchProducts');
      console.log(`📊 Loaded ${products.length} products and ${featured.length} featured products`);

    } catch (error) {
      console.error('Error fetching products:', error);
      perf.endTimer('fetchProducts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveOrder = async (id: string) => {
    try {
      console.log('📋 Fetching active order...');
      const response = await getActiveOrderForUser();
      if (response?.data?.order) {
        console.log('✅ Active order found:', response.data.order.orderId);
        console.log('🔍 Active order _id:', response.data.order._id);
        setActiveOrder(response.data.order);
      } else {
        console.log('ℹ️ No active order found');
        setActiveOrder(null);
      }
    } catch (error: any) {
      // Check if this is expected "no active order" scenario
      if (isFirstTimeUserError(error) || 
          error?.message?.includes('No active order found') ||
          error?.status === 404) {
        // This is expected - user has no active orders
        console.log('ℹ️ No active orders - this is expected behavior');
        setActiveOrder(null);
      } else {
        // This is an actual error that should be handled
        console.error('❌ Unexpected error fetching active order:', error);
        setActiveOrder(null);
        
        // Only show error if it's not a network/auth issue during logout
        if (!global.logoutInProgress && error?.type !== 'auth') {
          ErrorHandler.showUserFriendlyAlert(
            ErrorHandler.fromApiError(error),
            () => fetchActiveOrder(id)
          );
        }
      }
    }
  };

  // Focus effect to refresh data
  useFocusEffect(
    useCallback(() => {
      const fetchAllData = async () => {
        // Check if logout is in progress - if so, don't fetch data
        if (global.logoutInProgress) {
          console.log('🚫 Logout in progress, skipping data fetch');
          return;
        }

        const now = Date.now();
        const id = await AsyncStorage.getItem('userId');
        setUserId(id);

        // If no user ID, don't fetch user-specific data
        if (!id) {
          console.log('ℹ️ No user ID found, skipping user-specific data fetch');
          setActiveOrder(null);
          // Still fetch products for browsing
          if (allProducts.length === 0) {
            await fetchProducts();
          }
          return;
        }

        // Only fetch if we haven't fetched recently (within 30 seconds) or if it's the first time
        if (hasFetchedData && lastFetchTime && (now - lastFetchTime) < 30000) {
          console.log('⏭️ Skipping data fetch - recently fetched');
          return;
        }

        console.log('🔄 Fetching data...');
        setLastFetchTime(now);
        setHasFetchedData(true);
        setLoading(true);

        try {
          if (id && !global.logoutInProgress) {
            // Refresh addresses first
            await refreshAddresses();
            // Fetch active order
            await fetchActiveOrder(id);
          }

          // Fetch products and categories (only if not already loaded)
          if (allProducts.length === 0) {
            await fetchProducts();
          } else {
            console.log('⏭️ Using cached products data');
          }
        } catch (error) {
          console.error('❌ Error in fetchAllData:', error);
        } finally {
          setLoading(false);
        }
      };

      fetchAllData();
    }, [hasFetchedData, lastFetchTime, allProducts.length, refreshAddresses])
  );


  // Handle pull to refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    console.log('🔄 Manual refresh triggered');

    // Reset fetch tracking to force refresh
    setHasFetchedData(false);
    setLastFetchTime(null);

    const fetchAllData = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);

      if (id) {
        // Refresh active order on pull-to-refresh
        await fetchActiveOrder(id);
      }

      // Fetch products
      await fetchProducts();
    };

    fetchAllData().finally(() => setRefreshing(false));
  }, []);

  // Memoized product filtering for better performance
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return allProducts;
    }
    
    const query = searchQuery.toLowerCase();
    return allProducts.filter(product =>
      product.name.toLowerCase().includes(query) ||
      (product.brand && product.brand.toLowerCase().includes(query))
    );
  }, [searchQuery, allProducts]);



  // Memoized render functions for better performance
  const renderProductItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} />
  ), []);

  const renderFeaturedItem = useCallback(({ item }: { item: Product }) => (
    <ProductCard product={item} variant="featured" />
  ), []);

  // Memoized key extractors
  const keyExtractor = useCallback((item: Product) => item._id, []);
  const featuredKeyExtractor = useCallback((item: Product) => `featured-${item._id}`, []);

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.safeArea}>
        <TopBar />
        <SearchBar
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollViewContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Hero Banner */}
          <ErrorBoundary>
            <HeroBanner
              title="Welcome to AgSTORE"
              subtitle="You will get everything you need in your daily life whether you need soap, shampoo or you need order in bulk for your store, we are here to help you"
              onPress={() => console.log('Hero banner pressed')}
            />
          </ErrorBoundary>

          {/* Active Order Banner */}
          {activeOrder && (
            <ErrorBoundary>
              <ActiveOrderBanner
                order={activeOrder}
              />
            </ErrorBoundary>
          )}

          {/* Categories */}
          <ErrorBoundary>
            <HomeCategorySection />
          </ErrorBoundary>

          {/* Featured Products Section */}
          {featuredProducts.length > 0 && (
            <ErrorBoundary>
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Featured Products</Text>
                <FlatList
                  data={featuredProducts}
                  renderItem={renderFeaturedItem}
                  keyExtractor={featuredKeyExtractor}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                  removeClippedSubviews={true}
                  maxToRenderPerBatch={5}
                  initialNumToRender={3}
                  windowSize={5}
                  getItemLayout={(data, index) => ({
                    length: 180, // Approximate item width for horizontal list
                    offset: 180 * index,
                    index,
                  })}
                />
              </View>
            </ErrorBoundary>
          )}

          {/* All Products Section */}
          <ErrorBoundary>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {searchQuery ? `Search Results (${filteredProducts.length})` : 'All Products'}
              </Text>
              <FlatList
                data={filteredProducts}
                renderItem={renderProductItem}
                keyExtractor={keyExtractor}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.productGrid}
                removeClippedSubviews={true}
                maxToRenderPerBatch={10}
                updateCellsBatchingPeriod={50}
                initialNumToRender={8}
                windowSize={10}
                getItemLayout={(data, index) => ({
                  length: 200, // Approximate item height
                  offset: 200 * Math.floor(index / 2),
                  index,
                })}
              />
            </View>
          </ErrorBoundary>
        </ScrollView>

        {/* Footer */}
        <ErrorBoundary>
          <Footer />
        </ErrorBoundary>

        {/* Floating Cart */}
        <ErrorBoundary>
          <FloatingCart />
        </ErrorBoundary>
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 100,
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginHorizontal: 16,
    marginBottom: 12,
  },
  horizontalList: {
    paddingHorizontal: 10,
  },
  productGrid: {
    paddingHorizontal: 10,
  },
});

export default HomeScreen;
