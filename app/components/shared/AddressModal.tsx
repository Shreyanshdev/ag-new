import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Modal,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import type { Address } from '../../../types/types';
import { useAddressStore } from '../../../src/store/addressStore';
import { useAddressSync } from '../../../src/hooks/useAddressSync';
import { geocodeAddress, reverseGeocode } from '../../../src/utils/geocode';


interface AddressModalProps {
  visible: boolean;
  onClose: () => void;
  onAddressSelect?: (address: Address) => void;
  onAddressAdded?: (address: Address) => void;
}

const AddressModal: React.FC<AddressModalProps> = ({
  visible,
  onClose,
  onAddressSelect,
  onAddressAdded,
}) => {
  const addressStore = useAddressStore();
  const {
    addresses,
    loading,
    error,
    operationLoading,
    addNewAddress,
    setSelectedAddress,
    refreshAddresses,
    getFreshAddresses,
    clearError,
  } = addressStore;

  const [newAddress, setNewAddress] = useState<Partial<Address>>({
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    isDefault: false,
    latitude: 0,
    longitude: 0,
  });
  const [selectedLocation, setSelectedLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [initialRegion, setInitialRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showConfirmLocation, setShowConfirmLocation] = useState(false);
  const [currentRegion, setCurrentRegion] = useState(initialRegion);
  const [activeTab, setActiveTab] = useState<'map' | 'list'>('map');
  const [isSaving, setIsSaving] = useState(false); // ✅ Local saving state for immediate UI feedback
  const [forceRenderKey, setForceRenderKey] = useState(0); // ✅ Force re-render when store updates
  const mapRef = useRef<MapView>(null);

  // ✅ Use enhanced address synchronization hook
  const {
    addresses: syncedAddresses,
    loading: syncedLoading,
    error: syncedError,
    forceRefresh,
  } = useAddressSync({
    componentId: 'AddressModal',
    onAddressAdded: (address) => {
      console.log('🏠 AddressModal: Address added via sync:', address.addressLine1);
      setForceRenderKey(prev => prev + 1);
    },
    onAddressUpdated: (address) => {
      console.log('🏠 AddressModal: Address updated via sync:', address.addressLine1);
      setForceRenderKey(prev => prev + 1);
    },
    onAddressDeleted: (addresses) => {
      console.log('🏠 AddressModal: Address deleted via sync, remaining:', addresses.length);
      setForceRenderKey(prev => prev + 1);
    },
    onAddressesRefreshed: (addresses) => {
      console.log('🏠 AddressModal: Addresses refreshed via sync, count:', addresses.length);
      setForceRenderKey(prev => prev + 1);
    },
    autoRefreshOnFocus: true,
  });

  // Initialize addresses when modal opens
  useEffect(() => {
    if (visible) {
      console.log('🏠 AddressModal: Modal opened, initializing...');
      addressStore.initializeAddresses();
      getInitialLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // ✅ Reset states when modal closes
  useEffect(() => {
    if (!visible) {
      setIsSaving(false);
      setIsGeocoding(false);
      setShowConfirmLocation(false);
    }
  }, [visible]);

  // Clear error when component mounts
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  const getInitialLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Permission to access location was denied');
        return;
      }
      let location = await Location.getCurrentPositionAsync({});
      setInitialRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    } catch (error) {
      console.error('Error getting initial location:', error);
    }
  };

  // Enhanced geocoding function that updates map when address fields change
  const geocodeAddressFromFields = useCallback(async () => {
    if (!newAddress.addressLine1 || !newAddress.city || !newAddress.state) {
      return;
    }

    setIsGeocoding(true);
    try {
      const addressString = [
        newAddress.addressLine1,
        newAddress.addressLine2,
        newAddress.city,
        newAddress.state,
        newAddress.zipCode
      ].filter(Boolean).join(', ');

      const result = await geocodeAddress(addressString);
      
      setSelectedLocation({
        latitude: result.latitude,
        longitude: result.longitude,
      });

      setNewAddress(prev => ({
        ...prev,
        latitude: result.latitude,
        longitude: result.longitude,
      }));

      // Animate map to the new location
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    } catch (error) {
      console.error('Geocoding error:', error);
      Alert.alert('Error', 'Could not find location for this address');
    } finally {
      setIsGeocoding(false);
    }
  }, [newAddress.addressLine1, newAddress.addressLine2, newAddress.city, newAddress.state, newAddress.zipCode]);

  // Debounced geocoding when address fields change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (newAddress.addressLine1 && newAddress.city && newAddress.state) {
        geocodeAddressFromFields();
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timeoutId);
  }, [newAddress.addressLine1, newAddress.city, newAddress.state, geocodeAddressFromFields]);

  const handleAddAddress = async () => {
    // ✅ Prevent multiple simultaneous save operations
    if (isSaving || operationLoading) {
      console.log('🏠 AddressModal: Save operation already in progress, ignoring duplicate request');
      return;
    }

    try {
      console.log('🏠 AddressModal: Starting add address with newAddress:', newAddress);
      
      // ✅ Set local saving state for immediate UI feedback
      setIsSaving(true);
      
      // Validate required fields
      if (!newAddress.addressLine1?.trim() || !newAddress.city?.trim() || !newAddress.state?.trim()) {
        Alert.alert('Validation Error', 'Please fill in all required fields (Address Line 1, City, and State).');
        return;
      }

      // Initialize coordinates
      let finalLatitude = newAddress.latitude || 0;
      let finalLongitude = newAddress.longitude || 0;
      let geocodingAttempted = false;

      // Build address string for geocoding
      const addressString = [
        newAddress.addressLine1, 
        newAddress.addressLine2, 
        newAddress.city, 
        newAddress.state, 
        newAddress.zipCode
      ].filter(Boolean).join(', ');

      console.log('🏠 AddressModal: Address string for geocoding:', addressString);

      // Attempt geocoding with fallback options
      if (finalLatitude === 0 || finalLongitude === 0) {
        geocodingAttempted = true;
        
        try {
          const geocodeResult = await geocodeAddress(addressString);
          finalLatitude = geocodeResult.latitude;
          finalLongitude = geocodeResult.longitude;
          console.log('🏠 AddressModal: Primary geocoding successful:', { addressString, finalLatitude, finalLongitude });
        } catch (primaryGeocodingError) {
          console.warn('🏠 AddressModal: Primary geocoding failed, trying fallback:', primaryGeocodingError);
          
          // Fallback: Try with just city and state
          try {
            const fallbackAddressString = `${newAddress.city}, ${newAddress.state}`;
            const fallbackResult = await geocodeAddress(fallbackAddressString);
            finalLatitude = fallbackResult.latitude;
            finalLongitude = fallbackResult.longitude;
            console.log('🏠 AddressModal: Fallback geocoding successful:', { fallbackAddressString, finalLatitude, finalLongitude });
          } catch (fallbackGeocodingError) {
            console.error('🏠 AddressModal: All geocoding attempts failed:', fallbackGeocodingError);
            
            // Final fallback: Allow user to proceed without coordinates or manually enter
            const shouldProceed = await new Promise<boolean>((resolve) => {
              Alert.alert(
                'Location Not Found',
                'We could not find the exact location for this address. You can:\n\n1. Proceed without precise location (delivery may be affected)\n2. Try selecting the location on the map\n3. Cancel and try a different address',
                [
                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                  { text: 'Select on Map', onPress: () => {
                    // Switch to map tab and let user select location
                    setActiveTab('map');
                    resolve(false);
                  }},
                  { text: 'Proceed Anyway', onPress: () => resolve(true) }
                ]
              );
            });
            
            if (!shouldProceed) {
              return;
            }
            
            // Use default coordinates (will be updated when user selects on map)
            finalLatitude = 0;
            finalLongitude = 0;
          }
        }
      }

      // Validate coordinates (allow 0,0 as fallback)
      if (geocodingAttempted && finalLatitude === 0 && finalLongitude === 0) {
        console.warn('🏠 AddressModal: Proceeding with zero coordinates as fallback');
      }

      // ✅ Use direct store state access instead of stale closure
      const currentAddresses = addressStore.addresses; // Direct access to current store state
      const addressToAdd = {
        ...newAddress,
        latitude: finalLatitude,
        longitude: finalLongitude,
        isDefault: currentAddresses.length === 0 ? true : newAddress.isDefault
      };

      console.log('🏠 AddressModal: Adding address with final coordinates:', { 
        latitude: finalLatitude, 
        longitude: finalLongitude,
        hasValidCoordinates: finalLatitude !== 0 || finalLongitude !== 0
      });

      // ✅ Call addNewAddress and get the created address with _id
      const createdAddress = await addNewAddress(addressToAdd);
      
      if (createdAddress) {
        console.log('🏠 AddressModal: Address created successfully with _id:', createdAddress._id);
        
        // ✅ Immediate state update - force store to update and notify components
        addressStore.forceUpdate();
        
        // ✅ Reset form immediately after successful creation
        resetForm();
        
        // ✅ Show success feedback with location warning if needed
        const successMessage = (finalLatitude === 0 && finalLongitude === 0) 
          ? 'Address added successfully! Please update the location on the map for better delivery accuracy.'
          : 'Address added successfully!';
        
        Alert.alert('Success', successMessage);
        
        // ✅ Execute callback with proper timing - use the returned address directly
        if (onAddressAdded && createdAddress) {
          console.log('🏠 AddressModal: Calling onAddressAdded callback with fresh address data:', createdAddress.addressLine1);
          // Use setTimeout to ensure callback is executed after state updates
          setTimeout(() => {
            onAddressAdded(createdAddress);
          }, 100);
        }
        
        // ✅ Auto-close modal after successful addition (optional - can be controlled by parent)
        setTimeout(() => {
          onClose();
        }, 500);
        
      } else {
        throw new Error('Failed to create address - no address returned from server');
      }
    } catch (error: any) {
      console.error('🏠 AddressModal: Error adding address:', error);
      
      // ✅ Enhanced error handling with specific error messages
      let errorMessage = 'Failed to add address. Please try again.';
      
      if (error?.isNetworkError) {
        errorMessage = 'Network connection failed. Please check your internet connection and try again.';
      } else if (error?.isServerError) {
        errorMessage = 'Server is temporarily unavailable. Please try again later.';
      } else if (error?.message) {
        errorMessage = error.message;
      }
      
      Alert.alert(
        'Error', 
        errorMessage,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => handleAddAddress() }
        ]
      );
    } finally {
      // ✅ Always clear saving state
      setIsSaving(false);
    }
  };

  const handleSelectAddress = (address: Address) => {
    setSelectedAddress(address);
    if (onAddressSelect) {
      onAddressSelect(address);
    }
    onClose();
  };

  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setShowConfirmLocation(true);
    await autofillAddress(latitude, longitude);
  };

  const autofillAddress = async (latitude: number, longitude: number) => {
    try {
      console.log('🏠 AddressModal: Starting reverse geocoding for coordinates:', { latitude, longitude });
      const result = await reverseGeocode(latitude, longitude);
      const components = result.address_components;
      
      let addressLine1 = '';
      let addressLine2 = '';
      let city = '';
      let state = '';
      let zipCode = '';

      components.forEach((component: any) => {
        const types = component.types;
        if (types.includes('street_number') || types.includes('route')) {
          addressLine1 += component.long_name + ' ';
        }
        if (types.includes('sublocality') || types.includes('neighborhood')) {
          addressLine2 = component.long_name;
        }
        if (types.includes('locality')) {
          city = component.long_name;
        }
        if (types.includes('administrative_area_level_1')) {
          state = component.long_name;
        }
        if (types.includes('postal_code')) {
          zipCode = component.long_name;
        }
      });

      setNewAddress({
        ...newAddress,
        addressLine1: addressLine1.trim(),
        addressLine2,
        city,
        state,
        zipCode,
        latitude,
        longitude,
      });
      
      console.log('🏠 AddressModal: Reverse geocoding successful, address filled:', {
        addressLine1: addressLine1.trim(),
        city,
        state
      });
    } catch (error) {
      console.error('🏠 AddressModal: Reverse geocoding error, trying fallback:', error);
      
      try {
        // ✅ Enhanced fallback with better error handling
        let reverseGeocodeResult = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (reverseGeocodeResult.length > 0) {
          const geo = reverseGeocodeResult[0];
          setNewAddress({
            ...newAddress,
            addressLine1: `${geo.street ?? ''} ${geo.streetNumber ?? ''}`.trim(),
            addressLine2: geo.name ?? '',
            city: geo.city ?? '',
            state: geo.region ?? '',
            zipCode: geo.postalCode ?? '',
            latitude,
            longitude,
          });
          console.log('🏠 AddressModal: Fallback reverse geocoding successful');
        } else {
          // ✅ If both methods fail, just set coordinates and let user fill address manually
          setNewAddress({
            ...newAddress,
            latitude,
            longitude,
          });
          Alert.alert(
            'Location Selected', 
            'Could not automatically fill address details. Please enter the address manually.',
            [{ text: 'OK' }]
          );
          console.log('🏠 AddressModal: Both reverse geocoding methods failed, coordinates set only');
        }
      } catch (fallbackError) {
        console.error('🏠 AddressModal: Fallback reverse geocoding also failed:', fallbackError);
        // ✅ Still set coordinates even if reverse geocoding completely fails
        setNewAddress({
          ...newAddress,
          latitude,
          longitude,
        });
        Alert.alert(
          'Location Selected', 
          'Could not automatically fill address details. Please enter the address manually.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  const handleUseCurrentLocation = async () => {
    let { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission denied', 'Permission to access location was denied');
      return;
    }
    let location = await Location.getCurrentPositionAsync({});
    setSelectedLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
    setShowConfirmLocation(true);
    await autofillAddress(location.coords.latitude, location.coords.longitude);
  };

  const handleConfirmLocation = async () => {
    setShowConfirmLocation(false);
    // Auto-save the address when location is confirmed
    if (newAddress.addressLine1 && newAddress.city && newAddress.state) {
      // ✅ Use the improved handleAddAddress with better error handling
      await handleAddAddress();
    } else {
      Alert.alert('Incomplete Address', 'Please fill in the address details before saving.');
    }
  };

  const resetForm = () => {
    setNewAddress({
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      zipCode: '',
      isDefault: false,
      latitude: 0,
      longitude: 0,
    });
    setSelectedLocation(null);
    setShowConfirmLocation(false);
    setIsSaving(false); // ✅ Clear saving state when resetting form
  };

  // Memoized address formatting for better performance
  const formatAddress = useCallback((a: Address) =>
    a
      ? [a.addressLine1, a.addressLine2, a.city, a.state, a.zipCode].filter(Boolean).join(', ')
      : '', []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#1d1d1d" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select Address</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'map' && styles.activeTab]}
            onPress={() => setActiveTab('map')}
          >
            <MaterialCommunityIcons name="map" size={20} color={activeTab === 'map' ? '#28a745' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'map' && styles.activeTabText]}>Map</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'list' && styles.activeTab]}
            onPress={() => setActiveTab('list')}
          >
            <MaterialCommunityIcons name="format-list-bulleted" size={20} color={activeTab === 'list' ? '#28a745' : '#666'} />
            <Text style={[styles.tabText, activeTab === 'list' && styles.activeTabText]}>Addresses</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {activeTab === 'map' ? (
            <>
              {/* Map Section */}
              <View style={styles.mapSection}>
                <View style={styles.mapContainer}>
                  <MapView
                    ref={mapRef}
                    style={styles.map}
                    initialRegion={initialRegion}
                    onPress={handleMapPress}
                    onRegionChangeComplete={setCurrentRegion}
                    zoomEnabled={true}
                    scrollEnabled={true}
                    pitchEnabled={true}
                    rotateEnabled={true}
                    showsUserLocation={true}
                    showsMyLocationButton={false}
                    showsCompass={true}
                    showsScale={true}
                    zoomControlEnabled={true}
                    mapType="standard"
                    loadingEnabled={true}
                    moveOnMarkerPress={false}
                    followsUserLocation={false}
                  >
                    {selectedLocation && (
                      <Marker 
                        coordinate={selectedLocation} 
                        title="Selected Location"
                      >
                        <View style={styles.markerContainer}>
                          <MaterialCommunityIcons name="map-marker" size={20} color="#FFFFFF" />
                        </View>
                      </Marker>
                    )}
                  </MapView>
                  
                  {/* Current Location Button */}
                  <TouchableOpacity 
                    style={styles.currentLocationButton} 
                    onPress={handleUseCurrentLocation}
                  >
                    <MaterialCommunityIcons name="crosshairs-gps" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                  
                  {/* Zoom Controls */}
                  <View style={styles.zoomControls}>
                    <TouchableOpacity 
                      style={styles.zoomButton} 
                      onPress={() => {
                        if (mapRef.current) {
                          mapRef.current.animateToRegion({
                            ...currentRegion,
                            latitudeDelta: currentRegion.latitudeDelta * 0.5,
                            longitudeDelta: currentRegion.longitudeDelta * 0.5,
                          }, 1000);
                        }
                      }}
                    >
                      <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.zoomButton} 
                      onPress={() => {
                        if (mapRef.current) {
                          mapRef.current.animateToRegion({
                            ...currentRegion,
                            latitudeDelta: currentRegion.latitudeDelta * 2,
                            longitudeDelta: currentRegion.longitudeDelta * 2,
                          }, 1000);
                        }
                      }}
                    >
                      <MaterialCommunityIcons name="minus" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  
                  {isGeocoding && (
                    <View style={styles.geocodingOverlay}>
                      <ActivityIndicator size="large" color="#28a745" />
                      <Text style={styles.geocodingText}>Finding location...</Text>
                    </View>
                  )}
                </View>
                
                {showConfirmLocation && (
                  <View style={styles.confirmLocationContainer}>
                    <MaterialCommunityIcons name="check-circle" size={22} color="#28a745" />
                    <Text style={styles.confirmLocationText}>Location selected! Confirm to save address</Text>
                    <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmLocation}>
                      <Text style={styles.confirmButtonText}>Save Address</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              {/* Address Form Section */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Address Details</Text>
                
                <View style={styles.formContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Address Line 1 *"
                    value={newAddress.addressLine1}
                    onChangeText={text => setNewAddress({ ...newAddress, addressLine1: text })}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Address Line 2 (Optional)"
                    value={newAddress.addressLine2}
                    onChangeText={text => setNewAddress({ ...newAddress, addressLine2: text })}
                  />
                  <View style={styles.rowInputs}>
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      placeholder="City *"
                      value={newAddress.city}
                      onChangeText={text => setNewAddress({ ...newAddress, city: text })}
                    />
                    <TextInput
                      style={[styles.input, styles.halfInput]}
                      placeholder="State *"
                      value={newAddress.state}
                      onChangeText={text => setNewAddress({ ...newAddress, state: text })}
                    />
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="Zip Code"
                    value={newAddress.zipCode}
                    onChangeText={text => setNewAddress({ ...newAddress, zipCode: text })}
                  />
                  
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setNewAddress({ ...newAddress, isDefault: !newAddress.isDefault })}
                  >
                    <MaterialCommunityIcons
                      name={newAddress.isDefault ? "checkbox-marked" : "checkbox-blank-outline"}
                      size={24}
                      color="#28a745"
                    />
                    <Text style={styles.checkboxLabel}>Set as Default Address</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity
                    style={[styles.submitButton, (operationLoading || isSaving) && styles.submitButtonDisabled]}
                    onPress={handleAddAddress}
                    disabled={!newAddress.addressLine1 || !newAddress.city || !newAddress.state || operationLoading || isSaving}
                  >
                    {(operationLoading || isSaving) ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="small" color="#fff" />
                        <Text style={[styles.submitButtonText, { marginLeft: 8 }]}>
                          {isSaving ? 'Saving...' : 'Loading...'}
                        </Text>
                      </View>
                    ) : (
                      <Text style={styles.submitButtonText}>Save Address</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </>
          ) : (
            /* Address List Section */
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Your Saved Addresses</Text>
              
              {syncedLoading ? (
                <ActivityIndicator color="#28a745" size="small" style={{ marginVertical: 20 }} />
              ) : syncedAddresses.length === 0 ? (
                <View style={styles.emptyStateContainer}>
                  <MaterialCommunityIcons name="map-marker-off" size={48} color="#9ca3af" />
                  <Text style={styles.emptyStateText}>No addresses saved yet</Text>
                  <Text style={styles.emptyStateSubtext}>Switch to Map tab to add your first address</Text>
                </View>
              ) : (
                syncedAddresses.map((address: Address) => (
                  <TouchableOpacity
                    key={address._id}
                    style={styles.addressItem}
                    onPress={() => handleSelectAddress(address)}
                  >
                    <View style={styles.addressInfo}>
                      <Text style={styles.addressText}>{formatAddress(address)}</Text>
                      {address.isDefault && (
                        <View style={styles.defaultBadge}>
                          <Text style={styles.defaultBadgeText}>Default</Text>
                        </View>
                      )}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={24} color="#666" />
                  </TouchableOpacity>
                ))
              )}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  closeButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1d1d',
  },
  placeholder: {
    width: 40,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f7f7f7',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  activeTab: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  activeTabText: {
    color: '#28a745',
  },
  scrollView: {
    flex: 1,
  },
  
  // Map Section Styles
  mapSection: {
    backgroundColor: '#ffffff',
    marginBottom: 16,
  },
  mapContainer: {
    height: 250,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  geocodingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  geocodingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#6b7280',
  },
  currentLocationButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: '#28a745',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  zoomControls: {
    position: 'absolute',
    top: 16,
    left: 16,
    flexDirection: 'column',
  },
  zoomButton: {
    backgroundColor: '#28a745',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  confirmLocationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    marginHorizontal: 16,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  confirmLocationText: {
    marginLeft: 10,
    fontSize: 15,
    color: '#4A4A4A',
    flex: 1,
  },
  confirmButton: {
    backgroundColor: '#28a745',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  confirmButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  
  // Section Styles
  section: {
    backgroundColor: '#ffffff',
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  
  // Form Styles
  formContainer: {
    marginTop: 8,
  },
  rowInputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    flex: 0.48,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    fontSize: 15,
    color: '#333333',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkboxLabel: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '500',
    color: '#28a745',
  },
  submitButton: {
    backgroundColor: '#28a745',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Address List Styles
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#f9fafb',
    borderRadius: 10,
    marginTop: 12,
  },
  emptyStateText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666666',
    marginTop: 12,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#888888',
    marginTop: 4,
    textAlign: 'center',
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressInfo: {
    flex: 1,
    marginRight: 10,
  },
  addressText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
  },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e9f7ec',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  defaultBadgeText: {
    color: '#28a745',
    fontWeight: '700',
    fontSize: 11,
  },
});

export default AddressModal;
