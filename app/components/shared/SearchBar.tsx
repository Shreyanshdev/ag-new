// src/components/SearchBar.tsx

import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { SearchBarProps } from '../../../types/types';

const SearchBar: React.FC<SearchBarProps> = ({ searchQuery, setSearchQuery }) => {
  const router = useRouter();

  const handleSearchPress = () => {
    // Navigate to ProductSearchScreen
    router.push('/screens/customer/products/ProductSearchScreen');
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.inputWrapper} onPress={handleSearchPress}>
        <Feather name="search" size={20} color="#999" />
        <TextInput
          style={styles.input}
          placeholder="Search 'milk, ghee, curd...'"
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          editable={false}
          pointerEvents="none"
        />
        <TouchableOpacity>
          <Feather name="mic" size={20} color="#999" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    minHeight: 48,
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#1f2937',
  },
});

export default SearchBar;