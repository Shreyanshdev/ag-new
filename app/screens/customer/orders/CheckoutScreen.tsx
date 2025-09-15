import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, ScrollView
} from 'react-native';
import { useCart } from '../../../../src/context/CartContext';
import { useNavigation, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useBranch } from '../../../../src/context/BranchContext';
import { useAddressStore } from '../../../../src/store/addressStore';
import { useAddressSync } from '../../../../src/hooks/useAddressSync';
import { getDistanceInKm, calculateDeliveryFee } from '../../../../src/utils/geolocation';
import { geocodeAddress } from '../../../../src/utils/geocode';
import AddressModal from '../../../components/shared/AddressModal';

const CheckoutScreen = () => {
  const { cart, totalCost, incrementQuantity, decrementQuantity, removeFromCart } = useCart();
  const navigation = useNavigation<any>();
  const {
    selectedBranch,
    setSelectedBranch,
    isBranchAvailable,
    checkBranchAvailability,
    clearError
  } = useBranch();
  const addressStore = useAddressStore();
  const {
    selectedAddress,
    setSelectedAddress,
    getDefaultAddress,
    refreshAddresses,
    lastUpdated
  } = addressStore;

  // ✅ Use enhanced address synchronization hook
  const {
    addresses,
    loading: addressLoading,
    forceRefresh,
    addressExists,
    getAddressById,
  } = useAddressSync({
    componentId: 'CheckoutScreen',
    onAddressAdded: (address) => {
      console.log('🛒 CheckoutScreen: Address added via sync:', address.addressLine1);
      // Auto-select newly added address if no address is currently selected
      if (!selectedAddress) {
        console.log('🛒 CheckoutScreen: Auto-selecting newly added address');
        handleAddressSelection(address);
      }
    },
    onAddressUpdated: (address) => {
      console.log('🛒 CheckoutScreen: Address updated via sync:', address.addressLine1);
      // Update selected address if it was the one that changed
      if (selectedAddress && selectedAddress._id === address._id) {
        console.log('🛒 CheckoutScreen: Updating selected address with fresh data');
        setSelectedAddress(address);
      }
    },
    onAddressDeleted: (addresses) => {
      console.log('🛒 CheckoutScreen: Address deleted via sync, remaining:', addresses.length);
      // If selected address was deleted, select a new one
      if (selectedAddress && !addresses.find(addr => addr._id === selectedAddress._id)) {
        console.log('🛒 CheckoutScreen: Selected address was deleted, selecting new default');
        const defaultAddr = addresses.find(addr => addr.isDefault) || addresses[0];
        if (defaultAddr) {
          handleAddressSelection(defaultAddr);
        } else {
          setSelectedAddress(null);
        }
      }
    },
    onAddressesRefreshed: (addresses) => {
      console.log('🛒 CheckoutScreen: Addresses refreshed via sync, count:', addresses.length);
    },
    autoSelectNewAddress: true,
    autoRefreshOnFocus: true,
  });

  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);
  const hasInitializedAddress = useRef(false);
  const [isSubscriber, setIsSubscriber] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const flag = await AsyncStorage.getItem('isSubscription');
        setIsSubscriber(flag === 'true');
      } catch (error) {
        console.error('Error loading subscription status:', error);
      }
    })();
  }, []);

  // Memoized pricing breakdown calculation for better performance
  const pricingBreakdown = useMemo(() => {
    let totalMRP = 0;
    let totalDiscountAmount = 0;
    let totalWholesaleDiscount = 0;
    let grandTotalWithoutWholesale = 0;
    let grandTotalWithWholesale = 0;
    const itemBreakdowns: any[] = [];

    const isWholesaleEligible = isSubscriber && totalCost >= 2500;

    cart.forEach(item => {
      const product = item.product;
      const quantity = item.quantity;
      
      // Use basePrice for MRP calculation (as per product schema)
      const basePrice = product.basePrice || product.price || 0;
      const discountPrice = product.discountPrice;
      const retailUnitPrice = discountPrice && discountPrice < basePrice ? discountPrice : basePrice;
      const itemMRP = basePrice * quantity;
      
      totalMRP += itemMRP;

      // Calculate regular discount
      const regularDiscount = discountPrice && discountPrice < basePrice 
        ? (basePrice - discountPrice) * quantity 
        : 0;
      totalDiscountAmount += regularDiscount;

      // Calculate retail total (after regular discounts)
      const retailTotal = retailUnitPrice * quantity;
      
      let wholesaleTotal = retailTotal;
      let wholesaleSavings = 0;
      let bundleCount = 0;
      let extraUnits = 0;
      let pricingMode = 'retail';

      // Calculate wholesale pricing if eligible
      if (isSubscriber && product.subscriptionPrice && product.unitPerSubscription) {
        bundleCount = Math.floor(quantity / product.unitPerSubscription);
        extraUnits = quantity % product.unitPerSubscription;
        
        if (bundleCount > 0 && isWholesaleEligible) {
          const bundlePrice = bundleCount * product.subscriptionPrice;
          const extraUnitsPrice = extraUnits * retailUnitPrice;
          wholesaleTotal = bundlePrice + extraUnitsPrice;
          wholesaleSavings = retailTotal - wholesaleTotal;
          pricingMode = 'wholesale';
        }
      }

      totalWholesaleDiscount += wholesaleSavings;
      grandTotalWithoutWholesale += retailTotal;
      grandTotalWithWholesale += isWholesaleEligible ? wholesaleTotal : retailTotal;

      // Store individual item breakdown
      itemBreakdowns.push({
        productId: item.productId,
        productName: product.name,
        quantity,
        basePrice,
        retailUnitPrice,
        itemMRP,
        regularDiscount,
        retailTotal,
        wholesaleTotal: isWholesaleEligible ? wholesaleTotal : retailTotal,
        wholesaleSavings: isWholesaleEligible ? wholesaleSavings : 0,
        bundleCount: isWholesaleEligible ? bundleCount : 0,
        extraUnits: isWholesaleEligible ? extraUnits : quantity,
        pricingMode: isWholesaleEligible ? pricingMode : 'retail',
        subscriptionPrice: product.subscriptionPrice || 0,
        unitPerSubscription: product.unitPerSubscription || 1,
        hasWholesaleOption: !!(product.subscriptionPrice && product.unitPerSubscription)
      });
    });

    return {
      totalMRP,
      totalDiscountAmount,
      totalWholesaleDiscount,
      grandTotalWithoutWholesale,
      grandTotalWithWholesale,
      isWholesaleEligible,
      cartTotal: totalCost,
      itemBreakdowns
    };
  }, [cart, isSubscriber, totalCost]);

  // [Keep all the existing useEffect hooks and handler functions unchanged...]
  // Handle address selection with proper branch refresh
  const handleAddressSelection = useCallback(async (address: any) => {
    console.log('🛒 CheckoutScreen: Address selected:', address.addressLine1);
    clearError();

    const hasValidCoordinates = address.latitude && 
      address.longitude && 
      address.latitude !== 0 && 
      address.longitude !== 0;

    let addressWithCoords = { ...address };

    if (!hasValidCoordinates) {
      console.log('🛒 CheckoutScreen: Address has no valid coordinates, geocoding...');
      try {
        const addressString = [
          address.addressLine1,
          address.addressLine2,
          address.city,
          address.state,
          address.zipCode
        ].filter(Boolean).join(', ');

        const geocoded = await geocodeAddress(addressString);
        addressWithCoords = {
          ...address,
          latitude: geocoded.latitude,
          longitude: geocoded.longitude
        };

        await addressStore.updateExistingAddress(address._id, {
          latitude: geocoded.latitude,
          longitude: geocoded.longitude
        });
      } catch (error) {
        console.error('🛒 CheckoutScreen: Geocoding failed:', error);
        Alert.alert('Error', 'Could not find location for this address. Please try again.');
        return;
      }
    }

    setSelectedAddress(addressWithCoords);
    await checkBranchAvailability(addressWithCoords.latitude, addressWithCoords.longitude);
  }, [setSelectedAddress, clearError, checkBranchAvailability, addressStore]);

  // Refresh addresses on focus
  useFocusEffect(
    useCallback(() => {
      console.log('🛒 CheckoutScreen: Screen focused, force refreshing addresses...');
      forceRefresh();
    }, [forceRefresh])
  );

  // ✅ Listen to lastUpdated changes to refresh address picker
  useEffect(() => {
    console.log('🛒 CheckoutScreen: Address store lastUpdated changed, addresses count:', addresses.length);
    
    // If address picker is open, keep it open to show updated addresses
    if (showAddressPicker) {
      console.log('🛒 CheckoutScreen: Address picker is open, addresses will be refreshed automatically');
    }
  }, [lastUpdated, addresses.length, showAddressPicker]);

  useEffect(() => {
    if (selectedAddress?.latitude && selectedAddress?.longitude) {
      console.log('🛒 CheckoutScreen: Address changed, checking branch availability...');
      checkBranchAvailability(selectedAddress.latitude, selectedAddress.longitude);
    } else {
      console.log('🛒 CheckoutScreen: No valid address coordinates, clearing branch selection');
      setSelectedBranch(null);
    }
  }, [selectedAddress, checkBranchAvailability, setSelectedBranch]);

  useEffect(() => {
    console.log('🛒 CheckoutScreen: Address initialization check - addresses:', addresses.length, 'selected:', !!selectedAddress, 'initialized:', hasInitializedAddress.current);
    
    // Only initialize if we have addresses and haven't initialized yet
    if (addresses.length > 0 && !selectedAddress && !hasInitializedAddress.current) {
      hasInitializedAddress.current = true;
      const defaultAddr = getDefaultAddress();
      const addressToSelect = defaultAddr || addresses[0];

      console.log('🛒 CheckoutScreen: Initializing with address:', addressToSelect?.addressLine1);

      if (addressToSelect?.latitude && addressToSelect?.longitude &&
          addressToSelect.latitude !== 0 && addressToSelect.longitude !== 0) {
        console.log('🛒 CheckoutScreen: Address has valid coordinates, setting as selected');
        setSelectedAddress(addressToSelect);
      } else if (addressToSelect) {
        console.log('🛒 CheckoutScreen: Address needs geocoding');
        const geocodeAndSetAddress = async () => {
          try {
            const addressString = [
              addressToSelect.addressLine1,
              addressToSelect.addressLine2,
              addressToSelect.city,
              addressToSelect.state,
              addressToSelect.zipCode
            ].filter(Boolean).join(', ');

            const geocoded = await geocodeAddress(addressString);
            const addressWithCoords = {
              ...addressToSelect,
              latitude: geocoded.latitude,
              longitude: geocoded.longitude
            };

            console.log('🛒 CheckoutScreen: Geocoded address, setting as selected');
            setSelectedAddress(addressWithCoords);
            await addressStore.updateExistingAddress(addressToSelect._id, {
              latitude: geocoded.latitude,
              longitude: geocoded.longitude
            });
          } catch (error) {
            console.error('🛒 CheckoutScreen: Geocoding failed:', error);
            Alert.alert('Error', 'Could not find location for this address. Please try again.');
          }
        };
        geocodeAndSetAddress();
      }
    } else if (addresses.length === 0 && hasInitializedAddress.current) {
      // Only clear selection if we were previously initialized with addresses
      console.log('🛒 CheckoutScreen: No addresses available, clearing selection');
      setSelectedAddress(null);
      hasInitializedAddress.current = false;
    }
    
    // Handle case where addresses are updated but we need to refresh selected address
    if (addresses.length > 0 && selectedAddress) {
      const currentSelectedExists = addresses.find(addr => addr._id === selectedAddress._id);
      if (!currentSelectedExists) {
        console.log('🛒 CheckoutScreen: Selected address no longer exists, selecting new default');
        const defaultAddr = getDefaultAddress();
        const addressToSelect = defaultAddr || addresses[0];
        if (addressToSelect) {
          setSelectedAddress(addressToSelect);
        }
      } else {
        // Update selected address with fresh data from store
        const freshSelectedAddress = addresses.find(addr => addr._id === selectedAddress._id);
        if (freshSelectedAddress && JSON.stringify(freshSelectedAddress) !== JSON.stringify(selectedAddress)) {
          console.log('🛒 CheckoutScreen: Updating selected address with fresh data');
          setSelectedAddress(freshSelectedAddress);
        }
      }
    }
  }, [addresses.length, selectedAddress?._id, getDefaultAddress]); // Reduced dependencies to prevent infinite loops

  useEffect(() => {
    if (selectedBranch && selectedAddress?.latitude && selectedAddress?.longitude) {
      const distance = getDistanceInKm(
        selectedAddress.latitude,
        selectedAddress.longitude,
        selectedBranch.location.latitude,
        selectedBranch.location.longitude
      );

      if (totalCost >= 1000) {
        setDeliveryFee(0);
      } else {
        const fee = calculateDeliveryFee(distance);
        setDeliveryFee(fee);
      }

      setEstimatedTime(`${Math.ceil(distance * 3)} mins`);
    }
  }, [selectedAddress, selectedBranch, totalCost]);

  useEffect(() => {
    if (selectedBranch && selectedAddress?.latitude && selectedAddress?.longitude) {
      const branchLat = selectedBranch.location.latitude;
      const branchLon = selectedBranch.location.longitude;
      const addressLat = selectedAddress.latitude;
      const addressLon = selectedAddress.longitude;

      const minLat = Math.min(branchLat, addressLat);
      const maxLat = Math.max(branchLat, addressLat);
      const minLon = Math.min(branchLon, addressLon);
      const maxLon = Math.max(branchLon, addressLon);

      const latitudeDelta = (maxLat - minLat) * 1.5;
      const longitudeDelta = (maxLon - minLon) * 1.5;

      setMapRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLon + maxLon) / 2,
        latitudeDelta: latitudeDelta > 0.01 ? latitudeDelta : 0.01,
        longitudeDelta: longitudeDelta > 0.01 ? longitudeDelta : 0.01,
      });
    }
  }, [selectedBranch, selectedAddress]);

  const formatAddress = (a: any) => 
    a ? [a.addressLine1, a.addressLine2, a.city, a.state, a.zipCode].filter(Boolean).join(', ') : '';

  const handleAddressSelect = useCallback(async (address: any) => {
    console.log('🛒 CheckoutScreen: Address selected from modal:', address.addressLine1);
    await handleAddressSelection(address);
    setShowAddressModal(false);
  }, [handleAddressSelection]);

  const handleAddressAdded = useCallback(async (address: any) => {
    console.log('🛒 CheckoutScreen: New address added from modal:', address.addressLine1);
    
    // ✅ Address already has proper _id from refreshed store state
    console.log('🛒 CheckoutScreen: Address with ID:', address._id);
    
    // ✅ Auto-select the newly added address immediately
    await handleAddressSelection(address);
    
    // ✅ Close the modal and ensure address picker shows updated list
    setShowAddressModal(false);
    
    // ✅ Brief delay to ensure state is updated, then show success feedback
    setTimeout(() => {
      console.log('🛒 CheckoutScreen: New address auto-selected and ready for checkout');
    }, 100);
  }, [handleAddressSelection]);
  
  const goToReview = async () => {
    if (!selectedBranch || !selectedAddress || !cart.length || !isBranchAvailable) return;

    navigation.navigate('screens/customer/orders/ReviewOrderScreen', {
      branchId: selectedBranch._id,
      addressId: selectedAddress._id,
      deliveryFee,
      totalCost: pricingBreakdown.grandTotalWithWholesale,
    });
  };

  // Enhanced item rendering with detailed pricing
  const renderCartItem = ({ item }: { item: any }) => {
    const itemBreakdown = pricingBreakdown.itemBreakdowns.find(b => b.productId === item.productId);
    if (!itemBreakdown) return null;

    return (
      <View style={styles.itemContainer}>
        <View style={styles.itemInfo}>
          <Text style={styles.itemName}>{item.product.name}</Text>
          
          {/* Pricing Mode Indicator */}
          {isSubscriber && itemBreakdown.hasWholesaleOption && (
            <View style={styles.pricingModeContainer}>
              <MaterialCommunityIcons 
                name={itemBreakdown.pricingMode === 'wholesale' ? 'package-variant' : 'shopping'} 
                size={12} 
                color={itemBreakdown.pricingMode === 'wholesale' ? '#059669' : '#6b7280'} 
              />
              <Text style={[styles.pricingModeText, {
                color: itemBreakdown.pricingMode === 'wholesale' ? '#059669' : '#6b7280'
              }]}>
                {itemBreakdown.pricingMode === 'wholesale' ? 'Wholesale Applied' : 'Retail Price'}
              </Text>
            </View>
          )}

          {/* Bundle/Unit Breakdown for Wholesale */}
          {isSubscriber && itemBreakdown.pricingMode === 'wholesale' && itemBreakdown.bundleCount > 0 && (
            <View style={styles.bundleBreakdownContainer}>
              <Text style={styles.bundleBreakdownText}>
                {itemBreakdown.bundleCount} bundle{itemBreakdown.bundleCount > 1 ? 's' : ''} 
                ({itemBreakdown.bundleCount * itemBreakdown.unitPerSubscription} units)
                {itemBreakdown.extraUnits > 0 && ` + ${itemBreakdown.extraUnits} extra unit${itemBreakdown.extraUnits > 1 ? 's' : ''}`}
              </Text>
              <Text style={styles.bundlePriceText}>
                Bundle: ₹{(itemBreakdown.bundleCount * itemBreakdown.subscriptionPrice).toFixed(2)}
                {itemBreakdown.extraUnits > 0 && ` + ₹${(itemBreakdown.extraUnits * itemBreakdown.retailUnitPrice).toFixed(2)}`}
              </Text>
            </View>
          )}

          {/* Price Container */}
          <View style={styles.priceContainer}>
            <Text style={styles.itemPrice}>
              ₹{itemBreakdown.wholesaleTotal.toFixed(2)}
            </Text>
            {itemBreakdown.itemMRP > itemBreakdown.wholesaleTotal && (
              <Text style={styles.originalPrice}>
                ₹{itemBreakdown.itemMRP.toFixed(2)}
              </Text>
            )}
            {itemBreakdown.wholesaleSavings > 0 && (
              <Text style={styles.savingsText}>
                Save ₹{itemBreakdown.wholesaleSavings.toFixed(2)}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.controlsContainer}>
          <TouchableOpacity 
            onPress={() => removeFromCart(item.productId)} 
            style={styles.removeButton}
          >
            <MaterialCommunityIcons name="delete" size={20} color="#ef4444" />
          </TouchableOpacity>
          
          <View style={styles.itemQuantityControl}>
            <TouchableOpacity 
              onPress={() => decrementQuantity(item.productId)} 
              style={styles.quantityButton}
            >
              <MaterialCommunityIcons name="minus" size={16} color="#28a745" />
            </TouchableOpacity>
            <Text style={styles.itemQuantity}>{item.quantity}</Text>
            <TouchableOpacity 
              onPress={() => incrementQuantity(item.productId)} 
              style={styles.quantityButton}
            >
              <MaterialCommunityIcons name="plus" size={16} color="#28a745" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContentContainer}>
        {/* Map Section */}
        {selectedBranch && selectedAddress && isBranchAvailable && mapRegion ? (
          <View style={styles.mapSection}>
            <View style={styles.mapContainer}>
              <MapView style={styles.map} region={mapRegion}>
                {selectedAddress?.latitude && selectedAddress?.longitude ? (
                  <Marker
                    coordinate={{
                      latitude: selectedAddress.latitude,
                      longitude: selectedAddress.longitude,
                    }}
                  >
                    <View style={[styles.markerContainer, styles.homeMarker]}>
                      <MaterialCommunityIcons name="home" size={20} color="#fff" />
                    </View>
                  </Marker>
                ) : null}
                
                <Marker
                  coordinate={{
                    latitude: selectedBranch.location.latitude,
                    longitude: selectedBranch.location.longitude,
                  }}
                >
                  <View style={styles.markerContainer}>
                    <MaterialCommunityIcons name="store" size={20} color="#fff" />
                  </View>
                </Marker>
              </MapView>
            </View>
            <View style={styles.deliveryInfoContainer}>
              <MaterialCommunityIcons name="truck-delivery" size={20} color="#4A4A4A" />
              <Text style={styles.deliveryInfoText}>
                Estimated Delivery: {estimatedTime || '...'}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* Delivery Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Information</Text>

          {addressLoading ? (
            <View style={styles.emptyStateContainer}>
              <ActivityIndicator size="small" color="#28a745" />
              <Text style={styles.loadingText}>Loading addresses...</Text>
            </View>
          ) : addresses.length === 0 ? (
            <View style={styles.emptyStateContainer}>
              <Text style={styles.emptyStateText}>No delivery address found.</Text>
              <TouchableOpacity
                onPress={() => setShowAddressModal(true)}
                style={styles.actionButton}
              >
                <Text style={styles.actionButtonText}>Add New Address</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.detailRow}
                onPress={() => {
                  console.log('🛒 CheckoutScreen: Toggling address picker, current addresses:', addresses.length);
                  setShowAddressPicker(v => !v);
                }}
              >
                <MaterialCommunityIcons name="map-marker" size={20} color="#28a745" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>
                    Deliver to {addresses.length > 0 && `(${addresses.length} address${addresses.length !== 1 ? 'es' : ''})`}
                  </Text>
                  <Text style={styles.detailValue}>{formatAddress(selectedAddress)}</Text>
                </View>
                <Text style={styles.changeButtonText}>CHANGE</Text>
              </TouchableOpacity>

              {showAddressPicker && (
                <View style={styles.pickerContainer}>
                  {/* ✅ Real-time address list - automatically reflects latest addresses */}
                  {addresses.map(addr => (
                    <TouchableOpacity
                      key={`${addr._id}-${lastUpdated}`} // ✅ Force re-render with lastUpdated
                      style={[
                        styles.pickerOption,
                        selectedAddress?._id === addr._id && styles.selectedPickerOption
                      ]}
                      onPress={() => { 
                        console.log('🛒 CheckoutScreen: Address selected from picker:', addr.addressLine1);
                        handleAddressSelection(addr); 
                        setShowAddressPicker(false); 
                      }}
                    >
                      <Text style={styles.pickerOptionText}>{formatAddress(addr)}</Text>
                      {selectedAddress?._id === addr._id && <MaterialCommunityIcons name="check" size={20} color="#28a745" />}
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={styles.addAddressOption}
                    onPress={() => { 
                      console.log('🛒 CheckoutScreen: Opening address modal from picker');
                      setShowAddressPicker(false); 
                      setShowAddressModal(true); 
                    }}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color="#5e45d6" />
                    <Text style={styles.addAddressText}>Add New Address</Text>
                  </TouchableOpacity>
                </View>
              )}

              {!isBranchAvailable ? (
                <Text style={styles.noServiceText}>
                  Sorry, we are not available in your area yet.
                </Text>
              ) : selectedBranch ? (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="store" size={20} color="#28a745" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>From branch</Text>
                    <Text style={styles.detailValue}>{selectedBranch.name}</Text>
                  </View>
                </View>
              ) : (
                <Text style={styles.loadingText}>Finding nearest branch...</Text>
              )}
            </>
          )}
        </View>

        <View style={styles.divider} />

        {/* Order Summary Section with Enhanced Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          
          <FlatList
            data={cart}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.productId}
            scrollEnabled={false}
          />
        </View>

        <View style={styles.divider} />

        {/* Enhanced Bill Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Bill Details</Text>
          
          {/* MRP Total */}
          <View style={styles.billRow}>
            <Text style={styles.billText}>Total MRP</Text>
            <Text style={styles.billText}>₹{pricingBreakdown.totalMRP.toFixed(2)}</Text>
          </View>

          {/* Product Discount */}
          {pricingBreakdown.totalDiscountAmount > 0 && (
            <View style={styles.billRow}>
              <Text style={styles.savingsText}>Product Discount</Text>
              <Text style={styles.savingsText}>- ₹{pricingBreakdown.totalDiscountAmount.toFixed(2)}</Text>
            </View>
          )}

          {/* Wholesale Discount - Always Visible */}
          <View style={styles.billRow}>
            <View style={styles.wholesaleDiscountContainer}>
              <Text style={styles.wholesaleDiscountText}>Wholesale Discount</Text>
              {isSubscriber && (
                <Text style={styles.wholesaleStatusText}>
                  {pricingBreakdown.isWholesaleEligible 
                    ? '✓ Applied' 
                    : `₹${(2500 - totalCost).toFixed(0)} more needed`}
                </Text>
              )}
            </View>
            <Text style={[styles.savingsText, !pricingBreakdown.isWholesaleEligible && styles.potentialSavings]}>
              - ₹{pricingBreakdown.totalWholesaleDiscount.toFixed(2)}
            </Text>
          </View>

          {/* Grand Total Without Wholesale */}
          <View style={styles.billRow}>
            <Text style={styles.billText}>Grand Total (Without Wholesale)</Text>
            <Text style={styles.billText}>₹{pricingBreakdown.grandTotalWithoutWholesale.toFixed(2)}</Text>
          </View>

          {/* Grand Total With Wholesale */}
          <View style={styles.billRow}>
            <Text style={styles.grandTotalText}>
              Grand Total {pricingBreakdown.isWholesaleEligible ? '(With Wholesale)' : ''}
            </Text>
            <Text style={styles.grandTotalText}>₹{pricingBreakdown.grandTotalWithWholesale.toFixed(2)}</Text>
          </View>

          <View style={styles.billDivider} />

          {/* Delivery Fee */}
          <View style={styles.billRow}>
            <Text style={styles.billText}>Delivery Fee</Text>
            <Text style={styles.billText}>₹{deliveryFee.toFixed(2)}</Text>
          </View>

          {/* Final Total */}
          <View style={styles.billRow}>
            <Text style={styles.grandTotalText}>Final Amount</Text>
            <Text style={styles.grandTotalText}>₹{(pricingBreakdown.grandTotalWithWholesale + deliveryFee).toFixed(2)}</Text>
          </View>

          {/* Wholesale Eligibility Notice */}
          {isSubscriber && !pricingBreakdown.isWholesaleEligible && (
            <View style={styles.wholesaleNoticeContainer}>
              <MaterialCommunityIcons name="information" size={16} color="#f59e0b" />
              <Text style={styles.wholesaleNoticeText}>
                Add items worth ₹{(2500 - totalCost).toFixed(2)} more to unlock wholesale pricing and save ₹{pricingBreakdown.totalWholesaleDiscount.toFixed(2)}!
              </Text>
            </View>
          )}

          {/* Free Delivery Notice */}
          {totalCost > 0 && totalCost < 1000 && (
            <View style={styles.deliveryMessageContainer}>
              <MaterialCommunityIcons name="truck" size={16} color="#1e40af" />
              <Text style={styles.deliveryMessage}>
                Add items worth ₹{(1000 - totalCost).toFixed(2)} more to get free delivery!
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Footer */}
      <View style={styles.footer}>
        <View style={styles.priceBreakdown}>
          <Text style={styles.footerPrice}>₹{(pricingBreakdown.grandTotalWithWholesale + deliveryFee).toFixed(2)}</Text>
          <Text style={styles.footerLabel}>TOTAL AMOUNT</Text>
        </View>
        
        <TouchableOpacity
          style={[
            styles.placeOrderButton,
            (!selectedBranch || !selectedAddress || !cart.length || !isBranchAvailable) && styles.placeOrderButtonDisabled
          ]}
          onPress={goToReview}
          disabled={!selectedBranch || !selectedAddress || !cart.length || !isBranchAvailable}
        >
          <Text style={styles.placeOrderButtonText}>Review & Checkout</Text>
        </TouchableOpacity>
      </View>

      {/* Address Modal */}
      <AddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onAddressSelect={handleAddressSelect}
        onAddressAdded={handleAddressAdded}
      />
    </SafeAreaView>
  );
};

// Updated Styles
const styles = StyleSheet.create({
  // ... [Keep all existing styles and add these new ones] ...
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1d' },
  scrollView: { backgroundColor: '#f7f7f7' },
  scrollContentContainer: { paddingBottom: 30 },
  mapSection: { backgroundColor: '#ffffff' },
  mapContainer: { height: 180 },
  map: { ...StyleSheet.absoluteFillObject },
  markerContainer: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#1d1d1d',
    justifyContent: 'center', alignItems: 'center', elevation: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 2,
  },
  homeMarker: { backgroundColor: '#ffc107' },
  deliveryInfoContainer: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    backgroundColor: '#ffffff'
  },
  deliveryInfoText: { marginLeft: 10, fontSize: 15, color: '#4A4A4A' },
  section: { backgroundColor: '#ffffff', padding: 16 },
  sectionTitle: {
    fontSize: 18, fontWeight: 'bold', color: '#333333', marginBottom: 16,
  },
  divider: { height: 8, backgroundColor: '#f7f7f7' },
  emptyStateContainer: { alignItems: 'center', paddingVertical: 20 },
  emptyStateText: { fontSize: 14, color: '#777', marginBottom: 15 },
  actionButton: {
    backgroundColor: '#28a745', paddingVertical: 12,
    paddingHorizontal: 24, borderRadius: 8,
  },
  actionButtonText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  detailRow: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderRadius: 10, borderWidth: 1, borderColor: '#eaeaea'
  },
  detailTextContainer: { flex: 1, marginLeft: 12 },
  detailLabel: { fontSize: 12, color: '#888888', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#333333' },
  changeButtonText: { color: '#28a745', fontWeight: '700', fontSize: 13 },
  pickerContainer: {
    marginTop: 10, borderRadius: 10, borderWidth: 1,
    borderColor: '#f0f0f0', overflow: 'hidden'
  },
  pickerOption: {
    padding: 16, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#f0f0f0'
  },
  selectedPickerOption: { backgroundColor: '#e9f7ec' },
  pickerOptionText: { fontSize: 14, color: '#333', flex: 1 },
  addAddressOption: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
    paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
  },
  addAddressText: { fontSize: 15, color: '#5e45d6', fontWeight: '600', marginLeft: 8 },
  noServiceText: {
    color: '#d9534f', fontSize: 14, textAlign: 'center',
    paddingVertical: 10, fontWeight: '500',
  },
  loadingText: {
    fontSize: 14, color: '#777', textAlign: 'center', paddingVertical: 10,
  },

  // Enhanced Item Styles
  itemContainer: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  itemInfo: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 15, color: '#333', fontWeight: '600', marginBottom: 4 },
  
  pricingModeContainer: {
    flexDirection: 'row', alignItems: 'center', marginBottom: 4
  },
  pricingModeText: {
    fontSize: 12, fontWeight: '500', marginLeft: 4
  },
  
  bundleBreakdownContainer: {
    backgroundColor: '#f0fdf4', padding: 8, borderRadius: 6, marginBottom: 8
  },
  bundleBreakdownText: {
    fontSize: 11, color: '#166534', fontWeight: '500'
  },
  bundlePriceText: {
    fontSize: 11, color: '#059669', fontWeight: '600', marginTop: 2
  },

  priceContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 4, flexWrap: 'wrap' },
  itemPrice: { fontSize: 14, color: '#1d1d1d', fontWeight: '700' },
  originalPrice: {
    fontSize: 13, color: '#777', marginLeft: 8,
    textDecorationLine: 'line-through',
  },
  savingsText: { 
    fontSize: 12, color: '#28a745', fontWeight: '600', marginLeft: 8,
    backgroundColor: '#f0fdf4', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4
  },
  controlsContainer: { flexDirection: 'column', alignItems: 'center', gap: 8 },
  removeButton: { padding: 6 },
  itemQuantityControl: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#e9f7ec', borderRadius: 8,
  },
  quantityButton: { paddingHorizontal: 12, paddingVertical: 6 },
  itemQuantity: {
    fontSize: 16, fontWeight: 'bold', color: '#1d1d1d',
    paddingHorizontal: 8, minWidth: 30, textAlign: 'center',
  },

  // Enhanced Bill Styles
  billRow: {
    flexDirection: 'row', justifyContent: 'space-between', 
    alignItems: 'center', marginBottom: 12,
  },
  billText: { fontSize: 15, color: '#666666' },
  grandTotalText: { fontSize: 16, fontWeight: 'bold', color: '#1d1d1d' },
  billDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  
  wholesaleDiscountContainer: {
    flexDirection: 'column', alignItems: 'flex-start'
  },
  wholesaleDiscountText: {
    fontSize: 15, color: '#059669', fontWeight: '600'
  },
  wholesaleStatusText: {
    fontSize: 11, color: '#6b7280', marginTop: 2
  },
  potentialSavings: {
    opacity: 0.6, textDecorationLine: 'line-through'
  },
  
  wholesaleNoticeContainer: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    backgroundColor: '#fef3c7', padding: 12, borderRadius: 8, marginTop: 12
  },
  wholesaleNoticeText: {
    fontSize: 12, color: '#92400e', flex: 1, lineHeight: 16,
  },
  
  deliveryMessageContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#dbeafe',
    padding: 12, borderRadius: 8, marginTop: 12
  },
  deliveryMessage: {
    marginLeft: 8, fontSize: 12, color: '#1e40af',
  },

  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 12, backgroundColor: '#ffffff',
    borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingBottom: 24,
  },
  priceBreakdown: { flex: 1, marginRight: 16 },
  footerPrice: { fontSize: 22, fontWeight: '800', color: '#1d1d1d' },
  footerLabel: { fontSize: 12, color: '#888888', fontWeight: '500' },
  placeOrderButton: {
    backgroundColor: '#28a745', paddingVertical: 14, paddingHorizontal: 24,
    borderRadius: 12, elevation: 3, shadowColor: '#28a745',
    shadowOpacity: 0.3, shadowRadius: 5, shadowOffset: { width: 0, height: 3 },
  },
  placeOrderButtonDisabled: { backgroundColor: '#a3d9b1', elevation: 0 },
  placeOrderButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
});

export default CheckoutScreen;
