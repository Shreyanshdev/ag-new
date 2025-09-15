import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  ActivityIndicator, 
  Image, 
  ScrollView,
  Dimensions,
  SafeAreaView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { Product, Category, CategoryProductCardProps } from '../../../../types/types';
import FloatingCart from '../../../components/shared/FloatingCart';
import Footer from '../../../components/shared/Footer';
import { getAllCategories, getProductByCategoryId } from '../../../../src/config/api';
import { useCart } from '../../../../src/context/CartContext';
import EnhancedProductCard from '../../../components/customer/products/EnhancedProductCardV2';

const { width } = Dimensions.get('window');

// --- Type Definitions ---
type RootStackParamList = {
  'screens/customer/products/ProductDetailScreen': { productId: string };
  'screens/customer/products/ProductSearchScreen': undefined;
};
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

// --- Enhanced Product Card with new pricing logic ---
const CategoryProductCard: React.FC<CategoryProductCardProps> = ({ product }) => {
  const navigation = useNavigation<NavigationProps>();
  const { totalCost } = useCart();
  
  // Get user subscription status (you'll need to implement this)
  const userIsSubscribed = false; // TODO: Get from user context
  const cartTotal = totalCost;

  const handlePressCard = () => {
    navigation.navigate('screens/customer/products/ProductDetailScreen', { productId: product._id });
  };

  return (
    <EnhancedProductCard
      product={product}
      onPress={handlePressCard}
      userIsSubscribed={userIsSubscribed}
      cartTotal={cartTotal}
    />
  );
};

const CategoryScreen = () => {
  const navigation = useNavigation();
  const { categoryId: initialCategoryId, categoryName: initialCategoryName } = useLocalSearchParams<{ categoryId: string, categoryName: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(initialCategoryId || null);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(initialCategoryName || null);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoadingCategories(true);
      setError(null);
      try {
        const response = await getAllCategories();
        const data = response.data;
        const dataWithId = data.map((item: { _id: any }) => ({ ...item, id: item._id }));
        setCategories(dataWithId);
        if (!initialCategoryId && dataWithId.length > 0) {
          setSelectedCategoryId(dataWithId[0].id);
          setSelectedCategoryName(dataWithId[0].name);
        }
      } catch (error) {
        console.error('Error fetching categories:', error);
        setError('Failed to load categories. Please try again.');
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, [initialCategoryId]);

  useEffect(() => {
    const fetchProductsByCategory = async () => {
      if (selectedCategoryId) {
        setLoadingProducts(true);
        setError(null);
        try {
          const response = await getProductByCategoryId(selectedCategoryId);
          const data = response.data;
          // Handle the correct response structure from backend
          const products = data.products || data;
          const dataWithId = products.map((item: { _id: any }) => ({ ...item, id: item._id }));
          setProducts(dataWithId);
        } catch (error) {
          console.error('Error fetching products by category:', error);
          setError('Failed to load products. Please try again.');
        } finally {
          setLoadingProducts(false);
        }
      }
    };
    fetchProductsByCategory();
  }, [selectedCategoryId]);

  const handleCategoryPress = (category: Category) => {
    setSelectedCategoryId(category.id);
    setSelectedCategoryName(category.name);
  };


  // Helper function to get category images
  const getCategoryImage = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    if (name.includes('vegetable') || name.includes('fresh')) return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=200&fit=crop';
    if (name.includes('leafy') || name.includes('seasoning')) return 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=200&h=200&fit=crop';
    if (name.includes('exotic')) return 'https://images.unsplash.com/photo-1566385101042-1a0aa0c1268c?w=200&h=200&fit=crop';
    if (name.includes('fruit')) return 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200&h=200&fit=crop';
    if (name.includes('pooja') || name.includes('festive')) return 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=200&h=200&fit=crop';
    if (name.includes('cut') || name.includes('sprout')) return 'https://images.unsplash.com/photo-1586201375761-83865001e31c?w=200&h=200&fit=crop';
    return 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=200&h=200&fit=crop';
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{selectedCategoryName || 'Fresh Products'}</Text>
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => (navigation as any).navigate('screens/customer/products/ProductSearchScreen')}
          >
            <MaterialCommunityIcons name="magnify" size={24} color="#1d1d1d" />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* Left Sidebar - Categories */}
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {loadingCategories ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#22c55e" />
                </View>
              ) : (
                categories.map((category) => (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.categoryItem,
                      selectedCategoryId === category.id && styles.selectedCategoryItem
                    ]}
                    onPress={() => handleCategoryPress(category)}
                  >
                    <View style={styles.categoryImageContainer}>
                      <Image 
                        source={{ uri: category.image || getCategoryImage(category.name) }} 
                        style={styles.categoryImage}
                        resizeMode="cover"
                      />
                    </View>
                    <Text style={[
                      styles.categoryText,
                      selectedCategoryId === category.id && styles.selectedCategoryText
                    ]}>
                      {category.name}
                    </Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>

          {/* Right Content - Products */}
          <View style={styles.productsContainer}>
            {loadingProducts ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#22c55e" />
                <Text style={styles.loadingText}>Loading products...</Text>
              </View>
            ) : error ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : (
              <FlatList
                data={products}
                keyExtractor={(item) => item.id || item._id}
                numColumns={2}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.productsGrid}
                renderItem={({ item }) => <CategoryProductCard product={item} />}
              />
            )}
          </View>
        </View>

        {/* Bottom Banner */}
        {/* <View style={styles.bottomBanner}>
          <MaterialCommunityIcons name="scooter" size={20} color="#22c55e" />
          <Text style={styles.bannerText}>FREE DELIVERY on orders above ₹499</Text>
        </View> */}
      </View>
      
      <Footer />
      <FloatingCart marginBottom={Platform.OS === 'ios' ? 60 : 60} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    ...Platform.select({
      android: {
        paddingTop: 25, // For Android status bar
      },
    }),
  },
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
  searchButton: {
    padding: 4,
  },
  filterBar: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  filterContainer: {
    paddingHorizontal: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  activeFilter: {
    backgroundColor: '#e3f2fd',
    borderColor: '#2196f3',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
    marginRight: 4,
  },
  activeFilterText: {
    color: '#2196f3',
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 100,
    backgroundColor: '#f8f9fa',
    borderRightWidth: 1,
    borderRightColor: '#e9ecef',
  },
  categoryItem: {
    flexDirection: 'column',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
    minHeight: 80,
  },
  selectedCategoryItem: {
    backgroundColor: '#fef2f2',
    borderRightWidth: 3,
    borderRightColor: '#ef4444',
  },
  categoryImageContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 6,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryText: {
    fontSize: 10,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 12,
  },
  selectedCategoryText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  productsContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  productsGrid: {
    padding: 8,
    // Adjust padding to remove white space at the bottom
    ...Platform.select({
      ios: {
        paddingBottom: 110, // Adjust for iOS home indicator and footer
      },
      android: {
        paddingBottom: 90, // Adjust for Android footer
      },
    }),
  },
  
  imageContainer: {
    position: 'relative',
    height: 120,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  productImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  organicBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#22c55e',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  organicText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  soldOutOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  discountBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: '#ef4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  discountText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  productInfo: {
    padding: 12,
  },
  productWeight: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  deliveryTime: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
    marginTop: 2,
  },
  productName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1d1d1d',
    marginTop: 4,
    lineHeight: 18,
  },
  productDescription: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
    lineHeight: 16,
  },
  priceSection: {
    marginTop: 8,
  },
  discountPercentage: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '600',
    marginBottom: 4,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currentPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d1d1d',
  },
  originalPrice: {
    fontSize: 14,
    color: '#9ca3af',
    textDecorationLine: 'line-through',
    marginLeft: 6,
  },
  cartSection: {
    padding: 12,
    paddingTop: 0,
  },
  addButton: {
    backgroundColor: '#22c55e',
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-end',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 16,
    paddingHorizontal: 4,
    alignSelf: 'flex-end',
  },
  quantityButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
    paddingHorizontal: 8,
  },
  bottomBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0fdf4',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 84 : 70, // Adjust position to be above the footer
    left: 0,
    right: 0,
  },
  bannerText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
    marginLeft: 8,
  },
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
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default CategoryScreen;