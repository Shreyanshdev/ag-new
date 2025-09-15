// TopBar.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useAddressStore } from '../../../src/store/addressStore';
import { useBranch } from '../../../src/context/BranchContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { height: screenHeight } = Dimensions.get('window');

const TopBar = () => {
  const navigation = useNavigation<any>();
  const {
    addresses,
    selectedAddress,
    setSelectedAddress,
    loading: addressLoading
  } = useAddressStore();
  const { 
    nearestBranch, 
    isBranchAvailable, 
    branchDistance, 
    loading: branchLoading,
    checkBranchAvailability
  } = useBranch();
  
  const [isAddressModalVisible, setAddressModalVisible] = useState(false);
  const [currentAddressDisplay, setCurrentAddressDisplay] = useState('Select Address...');


  // Update display when selected address changes
  useEffect(() => {
    if (selectedAddress) {
      setCurrentAddressDisplay(
        `${selectedAddress.addressLine1}, ${selectedAddress.city}`
      );
      
      // Check branch availability when address changes
      if (selectedAddress.latitude && selectedAddress.longitude) {
        checkBranchAvailability(selectedAddress.latitude, selectedAddress.longitude);
      }
    } else if (addresses.length > 0) {
      // Auto-select first address if none selected
      const defaultAddr = addresses.find(addr => addr.isDefault);
      if (defaultAddr) {
        setSelectedAddress(defaultAddr);
      } else {
        setSelectedAddress(addresses[0]);
      }
    }
  }, [selectedAddress, addresses, checkBranchAvailability, setSelectedAddress]);

  const toggleAddressModal = () => setAddressModalVisible(!isAddressModalVisible);

  const handleUseCurrentLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required to use this feature');
        return;
      }
      
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = location.coords;

      // Get reverse geocoding to get address details
      const reverseGeocode = await Location.reverseGeocodeAsync({
        latitude,
        longitude,
      });

      if (reverseGeocode.length > 0) {
        const addressInfo = reverseGeocode[0];
        
        // Get userId for the address
        const userId = await AsyncStorage.getItem('userId') || '';
        
        // Create a temporary address object for current location
        const currentLocationAddress = {
          _id: `current_${Date.now()}`,
          userId: userId,
          addressLine1: addressInfo.street || addressInfo.name || 'Current Location',
          addressLine2: addressInfo.district || '',
          city: addressInfo.city || addressInfo.subregion || 'Unknown City',
          state: addressInfo.region || 'Unknown State',
          zipCode: addressInfo.postalCode || '',
          latitude: latitude,
          longitude: longitude,
          isDefault: false,
          isCurrentLocation: true, // Flag to identify this as current location
        };

        // Check if we already have a current location address
        const existingCurrentLocation = addresses.find(addr => addr.isCurrentLocation);
        
        if (existingCurrentLocation) {
          // Update existing current location address
          setSelectedAddress(currentLocationAddress);
        } else {
          // Add new current location address
          setSelectedAddress(currentLocationAddress);
        }

        setCurrentAddressDisplay(
          `${currentLocationAddress.addressLine1}, ${currentLocationAddress.city}`
        );

        // Check branch availability for current location
        checkBranchAvailability(latitude, longitude);
        
        Alert.alert(
          'Location Set',
          `Using current location: ${currentLocationAddress.addressLine1}, ${currentLocationAddress.city}`,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Could not get address details for current location');
      }
    } catch (error) {
      console.error('Error getting current location:', error);
      Alert.alert('Error', 'Failed to get current location. Please try again.');
    }
    
    setAddressModalVisible(false);
  };

  const handleSelectAddress = (address: any) => {
    setSelectedAddress(address);
    setCurrentAddressDisplay(
      `${address.addressLine1}, ${address.city}`
    );
    setAddressModalVisible(false);
  };

  const handleAddAddress = () => {
    navigation.navigate('screens/customer/profile/AddressScreen');
    setAddressModalVisible(false);
  };

  const handleManageAddresses = () => {
    navigation.navigate('screens/customer/profile/AddressScreen');
    setAddressModalVisible(false);
  };

  const renderBranchInfo = () => {
    if (branchLoading) {
      return (
        <View style={styles.branchInfo}>
          <ActivityIndicator size="small" color="#22c55e" />
          <Text style={styles.branchLoadingText}>Finding nearest branch...</Text>
        </View>
      );
    }

    if (!isBranchAvailable) {
      return (
        <View style={styles.branchInfo}>
          <MaterialCommunityIcons name="map-marker-off" size={16} color="#ef4444" />
          <Text style={styles.branchUnavailableText}>No branch within 30km</Text>
        </View>
      );
    }

    if (nearestBranch && branchDistance !== null) {
      return (
        <View style={styles.branchInfo}>
          <MaterialCommunityIcons name="store" size={16} color="#22c55e" />
          <Text style={styles.branchAvailableText}>
            {nearestBranch.name} • {branchDistance.toFixed(1)}km away
          </Text>
        </View>
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      <View style={styles.topContent}>
        <TouchableOpacity style={styles.locationContainer} onPress={toggleAddressModal}>
          <View style={styles.locationInfo}>
            <View style={styles.addressRow}>
              <Feather name="map-pin" size={19} color="#333" />
              <Text style={styles.locationText} numberOfLines={1} ellipsizeMode="tail">
                {currentAddressDisplay}
              </Text>
            </View>
            {renderBranchInfo()}
          </View>
        </TouchableOpacity>
        <View style={styles.rightContainer}>
          <TouchableOpacity
            style={styles.profileIconContainer}
            onPress={() => navigation.navigate('screens/customer/profile/ProfileScreen')}
          >
            <Feather name="user" size={22} color="#333" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Address Management Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={isAddressModalVisible}
        onRequestClose={toggleAddressModal}
      >
        <BlurView intensity={20} tint="dark" style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackground} onPress={toggleAddressModal} />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Delivery Address</Text>
            
            <TouchableOpacity style={styles.modalOptionButton} onPress={handleUseCurrentLocation}>
              <Feather name="crosshair" size={19} color="#22c55e" />
              <Text style={styles.modalOptionText}>Use Current Location</Text>
            </TouchableOpacity>

            {addressLoading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Loading addresses...</Text>
              </View>
            ) : addresses.length === 0 ? (
              <View style={styles.noAddressContainer}>
                <Text style={styles.noAddressText}>No addresses saved</Text>
                <TouchableOpacity style={styles.addAddressButton} onPress={handleAddAddress}>
                  <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                  <Text style={styles.addAddressButtonText}>Add New Address</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <FlatList
                  data={addresses}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.addressOption,
                        selectedAddress?._id === item._id && styles.selectedAddressOption
                      ]}
                      onPress={() => handleSelectAddress(item)}
                    >
                      <View style={styles.addressContent}>
                        <Text style={styles.addressText}>
                          {item.addressLine1}
                          {item.addressLine2 ? `, ${item.addressLine2}` : ''}
                        </Text>
                        <Text style={styles.addressSubText}>
                          {item.city}, {item.state} {item.zipCode}
                        </Text>
                        {item.isDefault && (
                          <View style={styles.defaultBadge}>
                            <Text style={styles.defaultBadgeText}>Default</Text>
                          </View>
                        )}
                      </View>
                      {selectedAddress?._id === item._id && (
                        <MaterialCommunityIcons name="check-circle" size={20} color="#22c55e" />
                      )}
                    </TouchableOpacity>
                  )}
                  style={styles.addressList}
                />
                <TouchableOpacity style={styles.manageAddressButton} onPress={handleManageAddresses}>
                  <MaterialCommunityIcons name="cog" size={20} color="#22c55e" />
                  <Text style={styles.manageAddressButtonText}>Manage Addresses</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </BlurView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 13,
    justifyContent: 'space-between',
    backgroundColor: '#fff',
  },
  topContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  locationContainer: {
    flex: 1,
  },
  locationInfo: {
    flex: 1,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    marginLeft: 7,
    color: '#333',
    fontWeight: '600',
    fontSize: 15,
    maxWidth: 250,
  },
  branchInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 26,
  },
  branchLoadingText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  branchUnavailableText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  branchAvailableText: {
    marginLeft: 6,
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
  },
  rightContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileIconContainer: {
    width: 35,
    height: 35,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    width: '100%',
    maxHeight: screenHeight * 0.7,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 18,
    color: '#333',
  },
  modalOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    borderRadius: 9,
    padding: 12,
    width: '100%',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  modalOptionText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#10b981',
    fontWeight: 'bold',
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
  },
  noAddressContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noAddressText: {
    color: '#666',
    fontSize: 16,
    marginBottom: 16,
  },
  addressList: {
    width: '100%',
    maxHeight: 300,
  },
  addressOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    width: '100%',
  },
  selectedAddressOption: {
    backgroundColor: '#f0fdf4',
    borderColor: '#22c55e',
    borderWidth: 1,
    borderRadius: 8,
  },
  addressContent: {
    flex: 1,
  },
  addressText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addressSubText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#dcfce7',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultBadgeText: {
    color: '#15803d',
    fontWeight: '600',
    fontSize: 11,
  },
  addAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 9,
    padding: 12,
    width: '100%',
    marginTop: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    justifyContent: 'center',
  },
  addAddressButtonText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#fff',
    fontWeight: 'bold',
  },
  manageAddressButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 9,
    padding: 12,
    width: '100%',
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    justifyContent: 'center',
  },
  manageAddressButtonText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#22c55e',
    fontWeight: '600',
  },
});

export default TopBar;
