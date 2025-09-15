import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import { useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Product } from '../../../../types/types';
import { searchProducts } from '../../../../src/config/api';
import EnhancedProductCardV2 from '../../../components/customer/products/EnhancedProductCardV2';
import FloatingCart from '../../../components/shared/FloatingCart';
import { useCart } from '../../../../src/context/CartContext';

// --- Type Definitions ---
type RootStackParamList = {
  'screens/customer/products/ProductDetailScreen': { productId: string };
};
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

// --- Predefined Filter Options ---
const PREDEFINED_FILTERS = [
  { id: 'milk', label: 'Milk', icon: 'cup', color: '#22c55e' },
  { id: 'ghee', label: 'Ghee', icon: 'food', color: '#f59e0b' },
  { id: 'doodh', label: 'Doodh', icon: 'cup-outline', color: '#3b82f6' },
  { id: 'curd', label: 'Curd', icon: 'bowl-mix', color: '#8b5cf6' },
  { id: 'paneer', label: 'Paneer', icon: 'cheese', color: '#ef4444' },
  { id: 'butter', label: 'Butter', icon: 'food-variant', color: '#f97316' },
];

// --- Product Search Screen ---
const ProductSearchScreen = () => {
  const navigation = useNavigation<NavigationProps>();
  const { totalCost } = useCart();

  // State management
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedFilters, setSelectedFilters] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Get user subscription status (you'll need to implement this)
  const userIsSubscribed = false; // TODO: Get from user context
  const cartTotal = totalCost;

  const searchProductsData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: any = {
        q: searchQuery.trim(),
        limit: 50,
        sort: 'createdAt',
        order: 'desc'
      };

      // Add tag filters if any are selected
      if (selectedFilters.length > 0) {
        params.tags = selectedFilters.join(',');
      }

      const response = await searchProducts(params);
      const data = response.data;

      // Handle the correct response structure from backend
      const searchResults = data.products || data;
      const dataWithId = searchResults.map((item: { _id: any }) => ({ ...item, id: item._id }));
      setProducts(dataWithId);
      setHasSearched(true);
    } catch (error) {
      console.error('Error searching products:', error);
      setError('Failed to search products. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedFilters]);

  // Search products when query or filters change
  useEffect(() => {
    if (searchQuery.trim() || selectedFilters.length > 0) {
      searchProductsData();
    } else {
      setProducts([]);
      setHasSearched(false);
    }
  }, [searchQuery, selectedFilters, searchProductsData]);

  const handleFilterToggle = (filterId: string) => {
    setSelectedFilters(prev =>
      prev.includes(filterId)
        ? prev.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  const clearAllFilters = () => {
    setSelectedFilters([]);
    setSearchQuery('');
  };

  const renderFilterChip = (filter: typeof PREDEFINED_FILTERS[0]) => {
    const isSelected = selectedFilters.includes(filter.id);
    return (
      <TouchableOpacity
        key={filter.id}
        style={[
          styles.filterChip,
          isSelected && styles.selectedFilterChip,
          { borderColor: filter.color }
        ]}
        onPress={() => handleFilterToggle(filter.id)}
      >
        <MaterialCommunityIcons
          name={filter.icon as any}
          size={16}
          color={isSelected ? '#fff' : filter.color}
        />
        <Text style={[
          styles.filterChipText,
          isSelected && styles.selectedFilterChipText,
          { color: isSelected ? '#fff' : filter.color }
        ]}>
          {filter.label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => {
    if (loading) return null;

    if (!hasSearched) {
      return (
        <View style={styles.emptyState}>
          <MaterialCommunityIcons name="magnify" size={64} color="#d1d5db" />
          <Text style={styles.emptyStateTitle}>Search Products</Text>
          <Text style={styles.emptyStateSubtitle}>
            Search by product name or use filters to find what you&apos;re looking for
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <MaterialCommunityIcons name="package-variant" size={64} color="#d1d5db" />
        <Text style={styles.emptyStateTitle}>No Products Found</Text>
        <Text style={styles.emptyStateSubtitle}>
          Try adjusting your search or filters
        </Text>
        <TouchableOpacity style={styles.clearButton} onPress={clearAllFilters}>
          <Text style={styles.clearButtonText}>Clear All Filters</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Search Products</Text>
        <View style={styles.headerRight} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <MaterialCommunityIcons name="magnify" size={20} color="#6b7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            placeholderTextColor="#9ca3af"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
            onSubmitEditing={searchProductsData}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Predefined Filters */}
      <View style={styles.filtersSection}>
        <Text style={styles.filtersTitle}>Quick Filters</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContainer}
        >
          {PREDEFINED_FILTERS.map(renderFilterChip)}
        </ScrollView>
      </View>

      {/* Active Filters */}
      {selectedFilters.length > 0 && (
        <View style={styles.activeFiltersSection}>
          <View style={styles.activeFiltersHeader}>
            <Text style={styles.activeFiltersTitle}>
              Active Filters ({selectedFilters.length})
            </Text>
            <TouchableOpacity onPress={clearAllFilters}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeFiltersContainer}
          >
            {selectedFilters.map(filter => (
              <View key={filter} style={styles.activeFilterChip}>
                <Text style={styles.activeFilterText}>{filter}</Text>
                <TouchableOpacity onPress={() => handleFilterToggle(filter)}>
                  <MaterialCommunityIcons name="close" size={16} color="#6b7280" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Results Section */}
      <View style={styles.resultsSection}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text style={styles.loadingText}>Searching products...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={searchProductsData}>
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : products.length > 0 ? (
          <>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsCount}>
                {products.length} product{products.length !== 1 ? 's' : ''} found
              </Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.productsHorizontalScroll}
              style={styles.horizontalScrollContainer}
            >
              {products.map((product, index) => (
                <View key={product._id || index} style={styles.productWrapper}>
                  <EnhancedProductCardV2
                    product={product}
                    userIsSubscribed={userIsSubscribed}
                    cartTotal={cartTotal}
                  />
                </View>
              ))}
            </ScrollView>
          </>
        ) : (
          renderEmptyState()
        )}
      </View>
      <FloatingCart marginBottom={0} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    // Conditionally add paddingTop for Android devices to account for the status bar
    ...Platform.select({
      android: {
        paddingTop: 25, // A typical height for the status bar
      },
    }),
  },

  // Header Styles
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1d1d',
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 32,
  },

  // Search Bar Styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1f2937',
    marginLeft: 12,
    marginRight: 8,
  },

  // Filters Section
  filtersSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filtersTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  filtersContainer: {
    paddingHorizontal: 16,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
  },
  selectedFilterChip: {
    backgroundColor: '#22c55e',
  },
  filterChipText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 6,
  },
  selectedFilterChipText: {
    color: '#ffffff',
  },

  // Tags Section
  tagsSection: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  tagsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  tagsContainer: {
    paddingHorizontal: 16,
  },
  tagChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  selectedTagChip: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  tagChipText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  selectedTagChipText: {
    color: '#ffffff',
  },

  // Active Filters Section
  activeFiltersSection: {
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  activeFiltersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  activeFiltersTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#15803d',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#22c55e',
  },
  activeFiltersContainer: {
    paddingHorizontal: 16,
  },
  activeFilterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  activeFilterText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#15803d',
    marginRight: 4,
  },

  // Results Section
  resultsSection: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  horizontalScrollContainer: {
    marginTop: 5,
  },
  productsHorizontalScroll: {
    paddingVertical: 8,
    gap: 2,
  },
  productWrapper: {
    marginRight: 1,
  },
  resultsHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultsCount: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },

  // Loading and Error States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  clearButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  clearButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ProductSearchScreen;