import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getAllCategories } from '../../../../src/config/api';

import { Category } from '../../../../types/types';

type RootStackParamList = {
  'screens/customer/products/CategoryScreen': { categoryName: string; categoryId: string };
};
type NavigationProps = NativeStackNavigationProp<RootStackParamList>;

// --- Redesigned Component ---
const HomeCategorySection: React.FC = () => {
  const navigation = useNavigation<NavigationProps>();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await getAllCategories();
        const data = response.data;
        // The backend might return _id, so we map it to id for consistency
        const dataWithId = data.map((item: any) => ({ ...item, id: item._id }));
        setCategories(dataWithId);
      } catch (error)
      {
        console.error('Error fetching categories for home screen:', error);
      }
    };
    fetchCategories();
  }, []);

  const handleCategoryPress = (category: Category) => {
    navigation.navigate('screens/customer/products/CategoryScreen', { categoryName: category.name, categoryId: category.id });
  };

  const handleSeeAllPress = () => {
    navigation.navigate('screens/customer/products/CategoryScreen', { categoryName: 'All Categories', categoryId: '' });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.heading}>Shop by Category</Text>
        <TouchableOpacity onPress={handleSeeAllPress}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.gridContainer}>
        {categories.slice(0, 8).map((category) => (
          <TouchableOpacity
            key={category.id}
            onPress={() => handleCategoryPress(category)}
            style={styles.categoryItem}
          >
            <View style={styles.iconContainer}>
              {category.image ? (
                <Image
                  source={{ uri: category.image }}
                  style={styles.categoryImage}
                  resizeMode="cover"
                />
              ) : (
                <MaterialCommunityIcons name={(category.icon as any) || 'food-apple'} size={32} color="#22c55e" />
              )}
            </View>
            <Text style={styles.categoryName} numberOfLines={2}>{category.name}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// --- New Stylesheet ---
const styles = StyleSheet.create({
  container: {
    paddingVertical: 20,
    backgroundColor: '#ffffff', // A clean white background for the section
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  heading: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#22c55e',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  categoryItem: {
    alignItems: 'center',
    width: '23%', // 4 items per row with proper spacing
    marginBottom: 16,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#dcfce7',
    overflow: 'hidden',
  },
  categoryImage: {
    width: '100%',
    height: '100%',
  },
  categoryName: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default HomeCategorySection;
