import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import type { Address } from '../../../../types/types';
import { useAddressStore } from '../../../../src/store/addressStore';
import { geocodeAddress, reverseGeocode } from '../../../../src/utils/geocode';

type NavigationProps = any;

const AddressScreen = () => {
  const navigation = useNavigation<NavigationProps>();
  const addressStore = useAddressStore();
  const {
    addresses,
    loading,
    error,
    operationLoading,
    addNewAddress,
    updateExistingAddress,
    deleteExistingAddress,
    setDefaultAddress,
    clearError
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
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
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
  const mapRef = useRef<MapView>(null);

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

  useEffect(() => {
    getInitialLocation();
  }, []);

  // Debounced geocoding when address fields change
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (newAddress.addressLine1 && newAddress.city && newAddress.state) {
        geocodeAddressFromFields();
      }
    }, 1000); // 1 second delay

    return () => clearTimeout(timeoutId);
  }, [newAddress.addressLine1, newAddress.city, newAddress.state, geocodeAddressFromFields]);

  // Initialize addresses on component mount
  useEffect(() => {
    addressStore.initializeAddresses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear error when component mounts
  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  const getInitialLocation = async () => {
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
  };

  const makeDefaultAddress = async (addressId: string) => {
    try {
      await setDefaultAddress(addressId);
      Alert.alert('Success', 'Address set as default successfully!');
    } catch {
      Alert.alert('Error', 'Unable to set address as default.');
    }
  };

  const handleAddAddress = async () => {
    try {
      console.log('🏠 AddressScreen: Starting add address with newAddress:', newAddress);
      
      // Always geocode the address to get valid coordinates
      let finalLatitude = newAddress.latitude || 0;
      let finalLongitude = newAddress.longitude || 0;
      
      // Build address string for geocoding
      const addressString = [newAddress.addressLine1, newAddress.addressLine2, newAddress.city, newAddress.state, newAddress.zipCode].filter(Boolean).join(', ');
      console.log('🏠 AddressScreen: Address string for geocoding:', addressString);
      
      // Always attempt geocoding for new addresses
      try {
        const geocodeResult = await geocodeAddress(addressString);
        finalLatitude = geocodeResult.latitude;
        finalLongitude = geocodeResult.longitude;
        console.log('🏠 AddressScreen: Geocoding successful:', { addressString, finalLatitude, finalLongitude });
      } catch (geocodeError) {
        console.error('🏠 AddressScreen: Geocoding failed:', geocodeError);
        Alert.alert('Geocoding Error', 'Could not get coordinates for this address. Please try again.');
        return; // Don't proceed if geocoding fails
      }
      
      // Validate coordinates
      if (finalLatitude === 0 || finalLongitude === 0) {
        console.error('🏠 AddressScreen: Invalid coordinates after geocoding:', { finalLatitude, finalLongitude });
        Alert.alert('Error', 'Could not get valid coordinates for this address. Please check the address and try again.');
        return;
      }
      
      // Auto-set as default if this is the first address
      const addressToAdd = {
        ...newAddress,
        latitude: finalLatitude,
        longitude: finalLongitude,
        isDefault: addresses.length === 0 ? true : newAddress.isDefault
      };
      
      console.log('🏠 AddressScreen: Adding address with final coordinates:', { latitude: finalLatitude, longitude: finalLongitude });
      
      const success = await addNewAddress(addressToAdd);
      if (success) {
        Alert.alert('Success', 'Address added successfully!');
        resetForm();
      }
    } catch (error) {
      console.error('🏠 AddressScreen: Error adding address:', error);
      Alert.alert('Error', 'Failed to add address.');
    }
  };

  const handleUpdateAddress = async (addressId: string) => {
    try {
      console.log('🏠 AddressScreen: Starting update address with newAddress:', newAddress);
      
      // Always geocode the address to get valid coordinates
      let finalLatitude = newAddress.latitude || 0;
      let finalLongitude = newAddress.longitude || 0;
      
      // Build address string for geocoding
      const addressString = [newAddress.addressLine1, newAddress.addressLine2, newAddress.city, newAddress.state, newAddress.zipCode].filter(Boolean).join(', ');
      console.log('🏠 AddressScreen: Address string for geocoding update:', addressString);
      
      // Always attempt geocoding for address updates
      try {
        const geocodeResult = await geocodeAddress(addressString);
        finalLatitude = geocodeResult.latitude;
        finalLongitude = geocodeResult.longitude;
        console.log('🏠 AddressScreen: Geocoding successful for update:', { addressString, finalLatitude, finalLongitude });
      } catch (geocodeError) {
        console.error('🏠 AddressScreen: Geocoding failed for update:', geocodeError);
        Alert.alert('Geocoding Error', 'Could not get coordinates for this address. Please try again.');
        return; // Don't proceed if geocoding fails
      }
      
      // Validate coordinates
      if (finalLatitude === 0 || finalLongitude === 0) {
        console.error('🏠 AddressScreen: Invalid coordinates after geocoding update:', { finalLatitude, finalLongitude });
        Alert.alert('Error', 'Could not get valid coordinates for this address. Please check the address and try again.');
        return;
      }
      
      const addressToUpdate = {
        ...newAddress,
        latitude: finalLatitude,
        longitude: finalLongitude
      };
      
      console.log('🏠 AddressScreen: Updating address with final coordinates:', { latitude: finalLatitude, longitude: finalLongitude });
      
      const success = await updateExistingAddress(addressId, addressToUpdate);
      if (success) {
        Alert.alert('Success', 'Address updated successfully!');
        setEditingAddressId(null);
        resetForm();
      }
    } catch (error) {
      console.error('🏠 AddressScreen: Error updating address:', error);
      Alert.alert('Error', 'Failed to update address.');
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    try {
      const success = await deleteExistingAddress(addressId);
      if (success) {
        Alert.alert('Success', 'Address deleted successfully!');
      }
    } catch {
      Alert.alert('Error', 'Failed to delete address.');
    }
  };

  const handleEditPress = (address: Address) => {
    setNewAddress(address);
    setEditingAddressId(address._id);
    setSelectedLocation({
      latitude: address.latitude || 0,
      longitude: address.longitude || 0,
    });
  };



  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setSelectedLocation({ latitude, longitude });
    setShowConfirmLocation(true);
    await autofillAddress(latitude, longitude);
  };

  const autofillAddress = async (latitude: number, longitude: number) => {
    try {
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
    } catch (error) {
      console.error('Reverse geocoding error:', error);
      // Fallback to expo location
      let reverseGeocode = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (reverseGeocode.length > 0) {
        const geo = reverseGeocode[0];
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
      } else {
        setNewAddress({
          ...newAddress,
          latitude,
          longitude,
        });
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
      await handleAddAddress();
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
  };



  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Address Management</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
      >
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
                style={[styles.submitButton, operationLoading && styles.submitButtonDisabled]}
                onPress={editingAddressId ? () => handleUpdateAddress(editingAddressId) : handleAddAddress}
                disabled={!newAddress.addressLine1 || !newAddress.city || !newAddress.state || operationLoading}
              >
                {operationLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {editingAddressId ? 'Update Address' : 'Save Address'}
                  </Text>
                )}
              </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Saved Addresses Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Saved Addresses</Text>
            {operationLoading && (
              <ActivityIndicator size="small" color="#28a745" style={styles.loadingIndicator} />
            )}
          </View>
          
          {addresses.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons name="map-marker-off" size={48} color="#9ca3af" />
              <Text style={styles.emptyStateText}>No addresses saved yet</Text>
              <Text style={styles.emptyStateSubtext}>Add your first address using the map above</Text>
            </View>
                      ) : (
              addresses.map((item: Address) => (
              <View key={item._id} style={styles.addressItem}>
                <View style={styles.addressInfo}>
                  <Text style={styles.addressText}>
                    {item.addressLine1}{item.addressLine2 ? `, ${item.addressLine2}` : ''}, {item.city}, {item.state} - {item.zipCode}
                  </Text>
                  {item.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default</Text>
                    </View>
                  )}
                </View>
                                  <View style={styles.addressActions}>
                    {!item.isDefault && (
                      <TouchableOpacity 
                        style={styles.actionButton} 
                        onPress={() => makeDefaultAddress(item._id)}
                        disabled={operationLoading}
                      >
                        <MaterialCommunityIcons name="circle-outline" size={20} color="#28a745" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity 
                      onPress={() => handleEditPress(item)} 
                      style={styles.actionButton}
                      disabled={operationLoading}
                    >
                      <MaterialCommunityIcons name="pencil" size={20} color="#28a745" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={() => handleDeleteAddress(item._id)} 
                      style={styles.actionButton}
                      disabled={operationLoading}
                    >
                      <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Platform.OS === 'android' ? 'transparent' : '#ffffff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1d' },
  scrollView: { backgroundColor: '#f7f7f7' },
  scrollContentContainer: { paddingBottom: 100 },
  
  // Map Section Styles
  mapSection: { backgroundColor: '#ffffff' },
  mapContainer: { height: 300 },
  map: { ...StyleSheet.absoluteFillObject },
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
  geocodingText: { marginTop: 8, fontSize: 16, color: '#6b7280' },
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
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
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
  section: { backgroundColor: '#ffffff', padding: 16 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333333', 
  },
  loadingIndicator: { marginLeft: 10 },
  divider: { height: 8, backgroundColor: '#f7f7f7' },
  
  // Form Styles
  formContainer: { marginTop: 8 },
  rowInputs: { flexDirection: 'row', justifyContent: 'space-between' },
  halfInput: { flex: 0.48 },
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
    marginBottom: 20 
  },
  checkboxLabel: { 
    marginLeft: 10, 
    fontSize: 15, 
    fontWeight: '500', 
    color: '#28a745' 
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
    fontWeight: '600' 
  },
  submitButtonDisabled: {
    backgroundColor: '#9ca3af',
    opacity: 0.6,
  },
  
  // Address List Styles
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    marginTop: 12,
  },
  emptyStateText: { 
    fontSize: 16, 
    fontWeight: '600', 
    color: '#666666', 
    marginTop: 12 
  },
  emptyStateSubtext: { 
    fontSize: 14, 
    color: '#888888', 
    marginTop: 4, 
    textAlign: 'center' 
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addressInfo: { flex: 1, marginRight: 10 },
  addressText: { fontSize: 15, color: '#333', fontWeight: '600' },
  defaultBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#e9f7ec',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 4,
  },
  defaultBadgeText: { color: '#28a745', fontWeight: '700', fontSize: 11 },
  addressActions: { flexDirection: 'row', alignItems: 'center' },
  actionButton: { 
    padding: 8, 
    marginLeft: 8,
  },
});

export default AddressScreen;
