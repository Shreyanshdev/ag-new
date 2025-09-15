
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Alert, 
  ActivityIndicator, 
  TouchableOpacity, 
  ScrollView, 
  Linking,
  RefreshControl,
  Dimensions
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getOrderById,
  acceptOrder,
  pickupOrder,
  markOrderAsDelivered,
  updateDeliveryPartnerLocation,
  API_BASE_URL
} from '../../../src/config/api';

import { Order } from '../../../types/types';

// Get screen dimensions
const { height: screenHeight } = Dimensions.get('window');


// Create a more realistic path with intermediate waypoints
const createRealisticPath = (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
  const points = [];
  const steps = 20; // Number of intermediate points
  
  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    
    // Add some curve to make it look more realistic
    const curveOffset = Math.sin(ratio * Math.PI) * 0.001; // Small curve
    
    const lat = origin.latitude + (destination.latitude - origin.latitude) * ratio + curveOffset;
    const lng = origin.longitude + (destination.longitude - origin.longitude) * ratio + curveOffset * 0.5;
    
    points.push({
      latitude: lat,
      longitude: lng,
    });
  }
  
  return points;
};


const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return '#f59e0b'; // Orange
    case 'accepted':
      return '#22c55e'; // Green
    case 'in-progress':
      return '#06b6d4'; // Teal
    case 'awaitconfirmation':
      return '#f59e0b'; // Orange
    case 'delivered':
      return '#22c55e'; // Green
    case 'cancelled':
      return '#dc3545'; // Red
    case 'awaitingCustomer':
      return '#f59e0b'; // Orange
    case 'noResponse':
      return '#dc3545'; // Red
    case 'canceled':
      return '#dc3545'; // Red
    default:
      return '#6b7280'; // Gray
  }
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'pending':
      return 'clock-outline';
    case 'accepted':
      return 'check-circle-outline';
    case 'in-progress':
      return 'truck-delivery';
    case 'awaitconfirmation':
      return 'clock-outline';
    case 'delivered':
      return 'check-circle';
    case 'cancelled':
      return 'close-circle';
    case 'scheduled':
      return 'calendar-clock';
    case 'reaching':
      return 'map-marker-path';
    case 'awaitingCustomer':
      return 'account-clock';
    case 'noResponse':
      return 'account-remove';
    case 'paused':
      return 'pause-circle';
    case 'canceled':
      return 'close-circle';
    case 'expiring':
      return 'alert-circle';
    default:
      return 'help-circle';
  }
};

const OrderDetailsScreen = () => {
  const { orderId } = useLocalSearchParams();
  const router = useRouter();

  // Get route coordinates from backend Google Maps service
  const getRouteCoordinatesFromBackend = async (
    origin: { latitude: number; longitude: number; address?: string },
    destination: { latitude: number; longitude: number; address?: string },
    routeType: string
  ) => {
    if (!orderId) {
      console.log('❌ No orderId available, using fallback route');
      return createRealisticPath(origin, destination);
    }

    try {
      console.log('🗺️ Fetching route from backend Google Maps service...');
      console.log('📡 Request details:', {
        url: `${API_BASE_URL}/order/${orderId}/google-directions`,
        orderId,
        origin,
        destination,
        routeType
      });

      const response = await fetch(`${API_BASE_URL}/order/${orderId}/google-directions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await AsyncStorage.getItem('userToken')}`
        },
        body: JSON.stringify({
          origin,
          destination,
          routeType,
          updateOrder: false // Don't update order for real-time display
        })
      });

      const result = await response.json();

      if (response.ok && result.routeData && result.routeData.coordinates) {
        console.log(`✅ Route fetched from backend: ${result.routeData.coordinates.length} points`);
        return result.routeData.coordinates;
      } else {
        console.warn('⚠️ Backend route error:', result.message);
        // Fallback to realistic path
        return createRealisticPath(origin, destination);
      }
    } catch (error) {
      console.error('❌ Error fetching route from backend:', error);
      // Fallback to realistic path
      return createRealisticPath(origin, destination);
    }
  };

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deliveryPartnerId, setDeliveryPartnerId] = useState<string | null>(null);
  const [deliveryPartnerCurrentLocation, setDeliveryPartnerCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isSharingLocation, setIsSharingLocation] = useState(false);
  const [locationUpdateInterval, setLocationUpdateInterval] = useState<ReturnType<typeof setInterval> | null>(null);
  const [distanceToDestination, setDistanceToDestination] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<string | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const proximityAlertShown = useRef(false);

  // Route caching and smooth updates
  const routeCache = useRef<{
    origin: { latitude: number; longitude: number } | null;
    destination: { latitude: number; longitude: number } | null;
    routeType: string;
    coordinates: { latitude: number; longitude: number }[];
    timestamp: number;
  }>({
    origin: null,
    destination: null,
    routeType: '',
    coordinates: [],
    timestamp: 0
  });

  const lastLocationUpdate = useRef<number>(0);
  const routeCalculationTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);
  const [currentZoom, setCurrentZoom] = useState(0.01); // latitudeDelta for zoom level
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Helper function to check if route needs recalculation
  const shouldRecalculateRoute = (
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    routeType: string
  ): boolean => {
    const cache = routeCache.current;

    // Always recalculate if route type changed
    if (cache.routeType !== routeType) {
      return true;
    }

    // Check if destination changed significantly (more than 10 meters)
    if (cache.destination) {
      const destDistance = calculateDistance(
        cache.destination.latitude,
        cache.destination.longitude,
        destination.latitude,
        destination.longitude
      );
      if (destDistance > 0.01) { // 10 meters
        return true;
      }
    }

    // Check if origin changed significantly (more than 50 meters)
    if (cache.origin) {
      const originDistance = calculateDistance(
        cache.origin.latitude,
        cache.origin.longitude,
        origin.latitude,
        origin.longitude
      );
      if (originDistance > 0.05) { // 50 meters
        return true;
      }
    }

    // Check if route is older than 2 minutes
    const now = Date.now();
    if (now - cache.timestamp > 120000) { // 2 minutes
      return true;
    }

    return false;
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      // Fetch regular order details
      const orderResponse = await getOrderById(orderId as string);
      
      if (!orderResponse.data?.order) {
        throw new Error('Order not found');
      }
      
      setOrder(orderResponse.data.order);
    } catch (error: any) {
      console.error('Error fetching order details:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to fetch order details';
      setError(errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Get delivery partner ID on component mount
  useEffect(() => {
    const getDeliveryPartnerId = async () => {
      try {
        const userId = await AsyncStorage.getItem('userId');
        setDeliveryPartnerId(userId);
      } catch (error) {
        console.error('Error getting delivery partner ID:', error);
        setError('Failed to get delivery partner ID');
      }
    };
    getDeliveryPartnerId();
  }, []);

  // Fetch order data
  useEffect(() => {
    fetchData();
  }, [fetchData, orderId]);

  // Get delivery partner's current location
  useEffect(() => {
    const getPartnerLocation = async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access location was denied');
          return;
        }
        
        let location = await Location.getCurrentPositionAsync({});
        setDeliveryPartnerCurrentLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        console.error('Error getting location:', error);
        Alert.alert('Location Error', 'Failed to get current location');
      }
    };

    if (order && !deliveryPartnerCurrentLocation) {
      getPartnerLocation();
    }
  }, [order, deliveryPartnerCurrentLocation]);

  // Calculate distance between two points
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the Earth in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in kilometers
  };

  // Check proximity and suggest status changes
  const checkProximityAndSuggestAction = (currentLocation: { latitude: number; longitude: number }) => {
    if (!order || !currentLocation) return;

    let targetLocation = null;
    let actionType = '';
    let thresholdDistance = 0.1; // 100 meters

    if (order.status === 'accepted' && order.branch?.location) {
      // Check if delivery partner is near the branch
      targetLocation = {
        latitude: order.branch.location.latitude,
        longitude: order.branch.location.longitude
      };
      actionType = 'pickup';
      thresholdDistance = 0.05; // 50 meters for branch pickup
    } else if (order.status === 'in-progress' && order.deliveryLocation) {
      // Check if delivery partner is near the customer location
      targetLocation = {
        latitude: order.deliveryLocation.latitude,
        longitude: order.deliveryLocation.longitude
      };
      actionType = 'arrived';
      thresholdDistance = 0.05; // 50 meters for customer delivery
    }

    if (targetLocation) {
      const distance = calculateDistance(
        currentLocation.latitude!,
        currentLocation.longitude!,
        targetLocation.latitude!,
        targetLocation.longitude!
      );

      setDistanceToDestination(distance);

      // Auto-suggest action when within threshold
      if (distance <= thresholdDistance) {
        console.log(`🎯 Within ${thresholdDistance * 1000}m of destination (${distance * 1000}m), suggesting ${actionType} action`);

        if (actionType === 'pickup' && !proximityAlertShown.current) {
          Alert.alert(
            'Near Branch Location',
            'You appear to be near the branch. Would you like to mark the order as picked up?',
            [
              { text: 'Not yet', style: 'cancel' },
              {
                text: 'Pickup Order',
                onPress: () => {
                  proximityAlertShown.current = true;
                  handlePickupOrder();
                }
              }
            ]
          );
          proximityAlertShown.current = true;
        } else if (actionType === 'arrived' && !proximityAlertShown.current) {
          Alert.alert(
            'Near Customer Location',
            'You appear to be near the customer location. Would you like to mark the order as delivered?',
            [
              { text: 'Not yet', style: 'cancel' },
              {
                text: 'Mark Delivered',
                onPress: () => {
                  proximityAlertShown.current = true;
                  handleMarkOrderDelivered();
                }
              }
            ]
          );
          proximityAlertShown.current = true;
        }
      } else {
        // Reset proximity alert when moving away
        proximityAlertShown.current = false;
      }
    }
  };

  // Fetch route coordinates based on order status
  useEffect(() => {
    const fetchRoute = async () => {
      console.log('🚀 Route useEffect triggered:', {
        hasLocation: !!deliveryPartnerCurrentLocation,
        orderId,
        orderStatus: order?.status,
        hasOrder: !!order
      });

      if (!deliveryPartnerCurrentLocation) {
        console.log('❌ No delivery partner location - skipping route calculation');
        return;
      }

      let origin, destination, routeType;

      if (order?.status === 'accepted') {
        // Show route from current location to branch
        console.log('Branch data:', order.branch);
        console.log('Branch location:', order.branch?.location);
        console.log('Delivery partner location:', deliveryPartnerCurrentLocation);

        if (order.branch?.location && deliveryPartnerCurrentLocation) {
          origin = {
            ...deliveryPartnerCurrentLocation
          };
          destination = {
            latitude: order.branch.location.latitude,
            longitude: order.branch.location.longitude
          };
          routeType = 'partner-to-branch';
          console.log('✅ Route setup complete for accepted order:', {
        origin: { lat: origin?.latitude, lng: origin?.longitude },
        destination: { lat: destination?.latitude, lng: destination?.longitude },
        routeType
      });
        } else {
          console.log('❌ Missing data for route:', {
            hasBranchLocation: !!order.branch?.location,
            hasPartnerLocation: !!deliveryPartnerCurrentLocation
          });
        }
      } else if (order?.status === 'in-progress') {
        // Show route from current location to customer
        if (order.deliveryLocation && deliveryPartnerCurrentLocation) {
          origin = {
            ...deliveryPartnerCurrentLocation
          };
          destination = {
            latitude: order.deliveryLocation.latitude,
            longitude: order.deliveryLocation.longitude
          };
          routeType = 'partner-to-customer';
        }
      }

      if (origin && destination && routeType) {
        // Validate coordinates before proceeding
        if (!origin.latitude || !origin.longitude || !destination.latitude || !destination.longitude) {
          console.error('❌ Invalid coordinates:', {
            origin: { lat: origin.latitude, lng: origin.longitude },
            destination: { lat: destination.latitude, lng: destination.longitude }
          });
          setRouteCoordinates([]);
          setDistanceToDestination(null);
          setEstimatedTime(null);
          return;
        }

        // Check if we need to recalculate the route
        if (origin.latitude !== undefined && origin.longitude !== undefined &&
            destination.latitude !== undefined && destination.longitude !== undefined &&
            !shouldRecalculateRoute(origin as { latitude: number; longitude: number }, destination as { latitude: number; longitude: number }, routeType)) {
          console.log('🔄 Using cached route - no significant changes detected');
          // Use cached coordinates if available
          if (routeCache.current.coordinates.length > 0) {
            setRouteCoordinates(routeCache.current.coordinates);
            // Recalculate distance and ETA from current position
            const distance = calculateDistance(
              origin.latitude ?? 0,
              origin.longitude ?? 0,
              destination.latitude ?? 0,
              destination.longitude ?? 0
            );
            setDistanceToDestination(distance);
            const estimatedMinutes = Math.ceil((distance / 30) * 60);
            setEstimatedTime(`${estimatedMinutes} mins`);
          }
          return;
        }

        // Clear any existing timeout
        if (routeCalculationTimeout.current) {
          clearTimeout(routeCalculationTimeout.current);
        }

        // Debounce route calculation by 2 seconds to prevent frequent recalculations
        routeCalculationTimeout.current = setTimeout(async () => {
          setRouteLoading(true);
          try {
            console.log(`🗺️ Recalculating route for status ${order?.status} (${routeType}):`, origin, 'to:', destination);

            // First try to get route from backend
            const coords = await getRouteCoordinatesFromBackend(origin, destination, routeType);
            console.log(`📊 Route coordinates received: ${coords?.length || 0} points`, coords);

            // Smooth transition: only update coordinates if they changed significantly
            const shouldUpdateCoordinates = !routeCache.current.coordinates.length ||
              coords.length !== routeCache.current.coordinates.length ||
              calculateDistance(
                coords[0]?.latitude || 0,
                coords[0]?.longitude || 0,
                routeCache.current.coordinates[0]?.latitude || 0,
                routeCache.current.coordinates[0]?.longitude || 0
              ) > 0.001; // 1 meter threshold

            if (shouldUpdateCoordinates) {
              console.log(`📍 Route coordinates updated: ${coords.length} points`);
              setIsTransitioning(true);

              // Smooth transition: brief delay before updating coordinates
              setTimeout(() => {
                setRouteCoordinates(coords);
                setIsTransitioning(false);

                // Update cache
                routeCache.current = {
                  origin: { ...origin },
                  destination: { ...destination },
                  routeType,
                  coordinates: [...coords],
                  timestamp: Date.now()
                };
              }, 300); // 300ms transition
            } else {
              console.log('🔄 Route coordinates unchanged - keeping existing route');
            }

            // Always update distance and ETA as they depend on current location
            const distance = calculateDistance(
              origin.latitude || 0,
              origin.longitude || 0,
              destination.latitude || 0,
              destination.longitude || 0
            );
            setDistanceToDestination(distance);

            const estimatedMinutes = Math.ceil((distance / 30) * 60);
            setEstimatedTime(`${estimatedMinutes} mins`);

            console.log(`✅ Route processed: ${coords.length} points, ${distance.toFixed(2)} km, ${estimatedMinutes} mins`);
    } catch (error) {
      console.error('❌ Error fetching route:', error);
      // Always set fallback coordinates - at minimum show straight line
      console.log('🔄 Using fallback route: straight line between points');
      const fallbackCoords = [origin, destination];
      setRouteCoordinates(fallbackCoords);

      // Update cache with fallback
      routeCache.current = {
        origin: { ...origin },
        destination: { ...destination },
        routeType,
        coordinates: [...fallbackCoords],
        timestamp: Date.now()
      };
          } finally {
            setRouteLoading(false);
          }
        }, 2000); // 2 second debounce
      } else {
        // No route to show
        setRouteCoordinates([]);
        setDistanceToDestination(null);
        setEstimatedTime(null);
        // Clear cache when no route
        routeCache.current = {
          origin: null,
          destination: null,
          routeType: '',
          coordinates: [],
          timestamp: 0
        };
      }
    };

    fetchRoute();

    // Cleanup timeout on unmount or dependency change
    return () => {
      if (routeCalculationTimeout.current) {
        clearTimeout(routeCalculationTimeout.current);
      }
    };
  }, [deliveryPartnerCurrentLocation, order?.status, order?.deliveryLocation, order?.branch, orderId]);

  // Debug: Monitor route coordinates changes
  useEffect(() => {
    console.log('🔍 Route coordinates updated:', {
      length: routeCoordinates.length,
      hasCoordinates: routeCoordinates.length > 0,
      firstPoint: routeCoordinates[0],
      lastPoint: routeCoordinates[routeCoordinates.length - 1]
    });
  }, [routeCoordinates]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  // Start real-time location tracking
  const startLocationTracking = useCallback(async () => {
    // Prevent multiple tracking sessions
    if (isSharingLocation || locationUpdateInterval) {
      console.log('🔄 Location tracking already active, skipping...');
      return;
    }

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      setIsSharingLocation(true);
      let isTrackingActive = true;
      
      // Get initial location with high accuracy
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      
      if (!isTrackingActive) return; // Component might have unmounted
      
      setDeliveryPartnerCurrentLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Update location every 15 seconds (optimized interval)
      const interval = setInterval(async () => {
        if (!isTrackingActive) {
          clearInterval(interval);
          return;
        }

        try {
          let currentLocation = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          if (!isTrackingActive) return; // Check after async operation

          const newLocation = {
            latitude: currentLocation.coords.latitude,
            longitude: currentLocation.coords.longitude,
          };

          // Only update location if it changed significantly (>5 meters) to reduce unnecessary route recalculations
          const shouldUpdateLocation = !deliveryPartnerCurrentLocation ||
            calculateDistance(
              deliveryPartnerCurrentLocation.latitude,
              deliveryPartnerCurrentLocation.longitude,
              newLocation.latitude,
              newLocation.longitude
            ) > 0.005; // 5 meters threshold

          if (shouldUpdateLocation && isTrackingActive) {
            console.log('📍 Location updated significantly:', newLocation);
            setDeliveryPartnerCurrentLocation(newLocation);
            lastLocationUpdate.current = Date.now();
          } else {
            console.log('📍 Location unchanged (within 5m) - skipping update');
          }

          // Check proximity and suggest actions
          if (isTrackingActive) {
            checkProximityAndSuggestAction(newLocation);
          }

          // Update location on server only if location changed significantly
          if (deliveryPartnerId && shouldUpdateLocation && isTrackingActive) {
            await updateDeliveryPartnerLocation(orderId as string, deliveryPartnerId, {
              latitude: currentLocation.coords.latitude,
              longitude: currentLocation.coords.longitude,
              address: 'Current delivery location',
              accuracy: currentLocation.coords.accuracy || 0,
              speed: currentLocation.coords.speed || 0,
              heading: currentLocation.coords.heading || 0,
              timestamp: new Date()
            });
          }
        } catch (error) {
          console.error('Error updating location:', error);
          // Don't clear interval on single error, keep trying
        }
      }, 15000); // Update every 15 seconds (optimized for smooth experience)

      setLocationUpdateInterval(interval);
      console.log('📍 Location tracking started');

      // Return cleanup function
      return () => {
        isTrackingActive = false;
        clearInterval(interval);
        setLocationUpdateInterval(null);
        setIsSharingLocation(false);
      };
    } catch (error) {
      console.error('Error starting location tracking:', error);
      setIsSharingLocation(false);
      Alert.alert('Location Error', 'Failed to start location tracking');
    }
  }, [deliveryPartnerId, orderId, isSharingLocation, locationUpdateInterval, deliveryPartnerCurrentLocation, checkProximityAndSuggestAction]);

  // Stop real-time location tracking
  const stopLocationTracking = useCallback(() => {
    console.log('⏹️ Stopping location tracking');
    setIsSharingLocation(false);
    if (locationUpdateInterval) {
      clearInterval(locationUpdateInterval);
      setLocationUpdateInterval(null);
    }
  }, [locationUpdateInterval]);

  // Cleanup location tracking on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up OrderDetailsScreen location tracking');
      if (locationUpdateInterval) {
        clearInterval(locationUpdateInterval);
        setLocationUpdateInterval(null);
      }
      if (routeCalculationTimeout.current) {
        clearTimeout(routeCalculationTimeout.current);
        routeCalculationTimeout.current = null;
      }
      setIsSharingLocation(false);
    };
  }, [locationUpdateInterval]);

  // Auto-start location sharing when order status is accepted or in-progress
  useEffect(() => {
    if ((order?.status === 'accepted' || order?.status === 'in-progress') && !isSharingLocation && deliveryPartnerId) {
      console.log(`🔄 Auto-starting location sharing for ${order?.status} order`);
      startLocationTracking();
    }
  }, [order?.status, isSharingLocation, deliveryPartnerId, startLocationTracking]);

  // Auto-stop location sharing when order status is awaitconfirmation or delivered
  useEffect(() => {
    if ((order?.status === 'awaitconfirmation' || order?.status === 'delivered') && isSharingLocation) {
      console.log('⏹️ Auto-stopping location sharing for completed order');
      stopLocationTracking();
    }
  }, [order?.status, isSharingLocation, stopLocationTracking]);

  // Handle accept order
  const handleAcceptOrder = async () => {
    if (!deliveryPartnerId || !orderId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setActionLoading('accept');
    try {
      const response = await acceptOrder(orderId as string, deliveryPartnerId);
      
      if (response.status === 200) {
        Alert.alert('Success', 'Order accepted successfully');
        await fetchData(); // Refresh data
      }
    } catch (error: any) {
      console.error('Error accepting order:', error);
      const errorMessage = error.response?.data?.message || 'Failed to accept the order';
      Alert.alert('Error', errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle pickup order
  const handlePickupOrder = async () => {
    if (!deliveryPartnerId || !orderId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setActionLoading('pickup');
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const pickupLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: 'Pickup location',
      };

      const response = await pickupOrder(orderId as string, deliveryPartnerId, pickupLocation);
      
      if (response.status === 200) {
        Alert.alert('Success', 'Order picked up successfully');
        // Start location tracking when order is picked up
        await startLocationTracking();
        await fetchData(); // Refresh data
      }
    } catch (error: any) {
      console.error('Error picking up order:', error);
      const errorMessage = error.response?.data?.message || 'Failed to pickup the order';
      Alert.alert('Error', errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  // Handle mark order as delivered
  const handleMarkOrderDelivered = async () => {
    if (!deliveryPartnerId || !orderId) {
      Alert.alert('Error', 'Missing required information');
      return;
    }

    setActionLoading('deliver');
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Permission to access location was denied');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const deliveryLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        address: 'Delivery location',
      };

      const response = await markOrderAsDelivered(orderId as string, deliveryPartnerId, deliveryLocation);

      if (response.status === 200) {
        Alert.alert('Success', 'Order marked as delivered successfully');
        // Stop location tracking when order is delivered
        stopLocationTracking();
        await fetchData(); // Refresh data
      }
    } catch (error: any) {
      console.error('Error marking order as delivered:', error);
      const errorMessage = error.response?.data?.message || 'Failed to mark order as delivered';
      Alert.alert('Error', errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  // Map control functions
  const centerOnMyLocation = async () => {
    try {
      if (!deliveryPartnerCurrentLocation) {
        Alert.alert('Location Error', 'Current location not available');
        return;
      }

      mapRef.current?.animateToRegion({
        latitude: deliveryPartnerCurrentLocation.latitude,
        longitude: deliveryPartnerCurrentLocation.longitude,
        latitudeDelta: currentZoom,
        longitudeDelta: currentZoom,
      });
    } catch (error) {
      console.error('Error centering on location:', error);
    }
  };

  const zoomIn = () => {
    const newZoom = Math.max(currentZoom * 0.7, 0.001); // More gradual zoom
    setCurrentZoom(newZoom);

    if (deliveryPartnerCurrentLocation) {
      mapRef.current?.animateToRegion({
        latitude: deliveryPartnerCurrentLocation.latitude,
        longitude: deliveryPartnerCurrentLocation.longitude,
        latitudeDelta: newZoom,
        longitudeDelta: newZoom,
      }, 300); // Smooth animation
    }
  };

  const zoomOut = () => {
    const newZoom = Math.min(currentZoom * 1.5, 1); // More gradual zoom
    setCurrentZoom(newZoom);

    if (deliveryPartnerCurrentLocation) {
      mapRef.current?.animateToRegion({
        latitude: deliveryPartnerCurrentLocation.latitude,
        longitude: deliveryPartnerCurrentLocation.longitude,
        latitudeDelta: newZoom,
        longitudeDelta: newZoom,
      }, 300); // Smooth animation
    }
  };

  const resetZoom = () => {
    const defaultZoom = 0.01;
    setCurrentZoom(defaultZoom);

    if (deliveryPartnerCurrentLocation) {
      mapRef.current?.animateToRegion({
        latitude: deliveryPartnerCurrentLocation.latitude,
        longitude: deliveryPartnerCurrentLocation.longitude,
        latitudeDelta: defaultZoom,
        longitudeDelta: defaultZoom,
      }, 500); // Slower animation for reset
    }
  };


  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorMessage}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }


  // Regular order view
  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color="#6b7280" />
          <Text style={styles.errorTitle}>Order Not Found</Text>
          <Text style={styles.errorMessage}>The requested order could not be found.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchData}>
            <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
            <Text style={styles.retryButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order #{order.orderId || order._id}</Text>
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Feather name="refresh-cw" size={20} color="#1d1d1d" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        
        {/* Order Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Details</Text>
          
          {/* Order Status */}
          <View style={styles.orderStatusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <MaterialCommunityIcons 
                name={getStatusIcon(order.status) as any} 
                size={16} 
                color="#fff" 
              />
              <Text style={styles.statusText}>{order.status.toUpperCase()}</Text>
            </View>
          </View>

          {/* Order ID and Date */}
          <View style={styles.orderInfoContainer}>
            <View style={styles.orderInfoRow}>
              <MaterialCommunityIcons name="receipt" size={20} color="#5e45d6" />
              <View style={styles.orderInfoTextContainer}>
                <Text style={styles.orderInfoLabel}>Order ID</Text>
                <Text style={styles.orderInfoValue}>#{order.orderId || order._id}</Text>
              </View>
            </View>
            
            <View style={styles.orderInfoRow}>
              <MaterialCommunityIcons name="calendar" size={20} color="#5e45d6" />
              <View style={styles.orderInfoTextContainer}>
                <Text style={styles.orderInfoLabel}>Order Date</Text>
                <Text style={styles.orderInfoValue}>
                  {order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  }) : 'Date not available'}
                </Text>
              </View>
            </View>

            {(order as any).deliveryDate && (
              <View style={styles.orderInfoRow}>
                <MaterialCommunityIcons name="truck-delivery" size={20} color="#5e45d6" />
                <View style={styles.orderInfoTextContainer}>
                  <Text style={styles.orderInfoLabel}>Delivery Date</Text>
                  <Text style={styles.orderInfoValue}>
                    {new Date((order as any).deliveryDate).toLocaleDateString('en-US', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Customer Information Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <View style={styles.customerCard}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account" size={24} color="#5e45d6" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Customer Name</Text>
                <Text style={styles.detailValue}>{order.customer?.name || 'N/A'}</Text>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="phone" size={24} color="#5e45d6" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Phone Number</Text>
                <TouchableOpacity 
                  onPress={() => order.customer?.phone && Linking.openURL(`tel:${order.customer.phone}`)}
                >
                  <Text style={styles.phoneText}>{order.customer?.phone || 'N/A'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Delivery Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          <View style={styles.addressCard}>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={24} color="#5e45d6" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Address</Text>
                <Text style={styles.detailValue}>{order.deliveryLocation?.address || 'Address not available'}</Text>
              </View>
            </View>
            {order.deliveryLocation?.city && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="city" size={20} color="#6b7280" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>City</Text>
                  <Text style={styles.detailValue}>{order.deliveryLocation.city}</Text>
                </View>
              </View>
            )}
            {order.deliveryLocation?.state && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="map" size={20} color="#6b7280" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>State</Text>
                  <Text style={styles.detailValue}>{order.deliveryLocation.state}</Text>
                </View>
              </View>
            )}
            {order.deliveryLocation?.zipCode && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="map-marker" size={20} color="#6b7280" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>ZIP Code</Text>
                  <Text style={styles.detailValue}>{order.deliveryLocation.zipCode}</Text>
                </View>
              </View>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Order Details Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          {order.items && order.items.length > 0 && (
            <View style={styles.itemsContainer}>
            {order.items.map((item: any, index: number) => {
              return (
                <View key={index} style={styles.itemContainer}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQuantity}>x{item.unitsBought}</Text>
                  </View>
                  <Text style={styles.itemPrice}>₹{item.totalPrice.toFixed(2)}</Text>
                </View>
              );
            })}

            </View>
          )}
          <View style={styles.billRow}>
            <Text style={styles.billText}>Total Price</Text>
            <Text style={styles.billText}>₹₹{(order.totalPrice || 0).toFixed(2)}</Text>
          </View>
          {order.deliveryFee && (
            <View style={styles.billRow}>
              <Text style={styles.billText}>Delivery Fee</Text>
              <Text style={styles.billText}>₹{(order.deliveryFee || 0).toFixed(2)}</Text>
            </View>
          )}
          {order.branch && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="storefront-outline" size={24} color="#4A4A4A" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>From branch</Text>
                <Text style={styles.detailValue}>{order.branch.name}</Text>
              </View>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        {/* Live Location Status */}
        {isSharingLocation && (
          <View style={styles.locationSection}>
            <View style={styles.locationCard}>
              <MaterialCommunityIcons name="map-marker" size={20} color="#22c55e" />
              <Text style={styles.locationText}>Sharing live location with customer</Text>
              <View style={styles.locationIndicator}>
                <View style={styles.locationDot} />
              </View>
            </View>
          </View>
        )}

        {/* Map Section - Show for all orders with delivery location */}
        {(() => {
          return order?.deliveryLocation && (order?.status === 'accepted' || order?.status === 'in-progress' || order?.status === 'delivered' || order?.status === 'awaitconfirmation');
        })() && (
          <View style={styles.mapSection}>
            <View style={styles.mapHeader}>
              <View style={styles.mapHeaderLeft}>
                <MaterialCommunityIcons name="map-marker" size={22} color="#4A4A4A" />
                <Text style={styles.mapTitle}>
                  {order && order.status === 'in-progress' ? 'Live Delivery Tracking' : 'Delivery Location'}
                </Text>
              </View>
              {distanceToDestination && estimatedTime && (
                <View style={styles.mapHeaderRight}>
                  <View style={styles.distanceInfo}>
                    <MaterialCommunityIcons name="map-marker-distance" size={16} color="#5e45d6" />
                    <View>
                      <Text style={styles.distanceText}>{distanceToDestination.toFixed(2)} km</Text>
                      <Text style={styles.distanceSubText}>
                        {order && (order.status as any) === 'accepted' ? 'To Branch' : 'To Customer'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.etaInfo}>
                    <MaterialCommunityIcons name="clock-outline" size={16} color="#5e45d6" />
                    <View>
                      <Text style={styles.etaText}>{estimatedTime}</Text>
                      <Text style={styles.etaSubText}>ETA</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
            <View style={styles.mapContainer}>
              {routeLoading && (
                <View style={styles.routeLoadingOverlay}>
                  <ActivityIndicator size="large" color="#5e45d6" />
                  <Text style={styles.routeLoadingText}>Calculating route...</Text>
                </View>
              )}
              <MapView
                ref={mapRef}
                style={styles.map}
                initialRegion={{
                  latitude: deliveryPartnerCurrentLocation?.latitude ||
                           order.deliveryLocation?.latitude ||
                           order.branch?.location?.latitude || 12.9716,
                  longitude: deliveryPartnerCurrentLocation?.longitude ||
                           order.deliveryLocation?.longitude ||
                           order.branch?.location?.longitude || 77.5946,
                  latitudeDelta: currentZoom,
                  longitudeDelta: currentZoom,
                }}
                showsUserLocation={true}
                showsMyLocationButton={false} // Disable default button, we'll add custom one
                showsTraffic={true}
                showsBuildings={true}
                loadingEnabled={true}
                loadingIndicatorColor="#5e45d6"
              >
                <Marker
                  coordinate={{
                    latitude: order.deliveryLocation?.latitude || 12.9716,
                    longitude: order.deliveryLocation?.longitude || 77.5946,
                  }}
                  title="Delivery Location"
                  description="Customer's address"
                >
                  <View style={styles.markerContainer}>
                    <MaterialCommunityIcons name="home-variant" size={20} color="#FFFFFF" />
                  </View>
                </Marker>
                {deliveryPartnerCurrentLocation && (
                  <Marker 
                    coordinate={deliveryPartnerCurrentLocation}
                    title="Your Location"
                    description="Delivery Partner"
                  >
                    <View style={[styles.markerContainer, styles.deliveryMarker]}>
                      <MaterialCommunityIcons name="truck-delivery" size={20} color="#FFFFFF" />
                    </View>
                  </Marker>
                )}
                {routeCoordinates.length > 1 && (
                  (() => {
                    console.log(`Rendering polyline with ${routeCoordinates.length} coordinates for status ${order?.status}`);
                    return (
                      <Polyline
                        coordinates={routeCoordinates}
                        strokeColor={order && (order.status as any) === 'accepted' ? "#3b82f6" : "#5e45d6"}
                        strokeWidth={isTransitioning ? 3 : 5}
                        lineCap="round"
                        lineJoin="round"
                        tappable={false}
                        lineDashPattern={isTransitioning ? [2, 2] : (order && (order.status as any) === 'accepted' ? [5, 5] : [1])}
                        zIndex={1}
                      />
                    );
                  })()
                )}

                {/* Route loading indicator */}
                {routeLoading && (
                  <Marker
                    coordinate={deliveryPartnerCurrentLocation || { latitude: 0, longitude: 0 }}
                    anchor={{ x: 0.5, y: 0.5 }}
                  >
                    <View style={{
                      backgroundColor: 'rgba(59, 130, 246, 0.8)',
                      borderRadius: 20,
                      padding: 8,
                      borderWidth: 2,
                      borderColor: '#FFFFFF'
                    }}>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    </View>
                  </Marker>
                )}

                {/* Branch Marker (for accepted orders) */}
                {order && (order.status as any) === 'accepted' && order.branch?.location && order.branch.location.latitude && order.branch.location.longitude && (
                  <Marker
                    coordinate={{
                      latitude: order.branch.location.latitude!,
                      longitude: order.branch.location.longitude!,
                    }}
                    title="Store Location"
                    description="Pickup Point"
                  >
                    <View style={styles.markerContainer}>
                      <MaterialCommunityIcons name="storefront" size={20} color="#FFFFFF" />
                    </View>
                  </Marker>
                )}

                {/* Customer Marker (for in-progress orders) */}
                {order && order.status === 'in-progress' && order.deliveryLocation && order.deliveryLocation.latitude && order.deliveryLocation.longitude && (
                  <Marker
                    coordinate={{
                      latitude: order.deliveryLocation.latitude || 12.9716,
                      longitude: order.deliveryLocation.longitude || 77.5946,
                    }}
                    title="Delivery Location"
                    description="Customer Address"
                  >
                    <View style={styles.markerContainer}>
                      <MaterialCommunityIcons name="home-variant" size={20} color="#FFFFFF" />
                    </View>
                  </Marker>
                )}
              </MapView>

              {/* Map Control Buttons */}
              <View style={styles.mapControls}>
                <View style={styles.mapControlGroup}>
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={centerOnMyLocation}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="crosshairs-gps" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.mapControlLabel}>My Location</Text>
                </View>

                <View style={styles.mapControlGroup}>
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={zoomIn}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="plus" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.mapControlLabel}>Zoom In</Text>
                </View>

                <View style={styles.mapControlGroup}>
                  <TouchableOpacity
                    style={styles.mapControlButton}
                    onPress={zoomOut}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="minus" size={20} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.mapControlLabel}>Zoom Out</Text>
                </View>

                <View style={styles.mapControlGroup}>
                  <TouchableOpacity
                    style={[styles.mapControlButton, styles.resetZoomButton]}
                    onPress={resetZoom}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name="refresh" size={18} color="#fff" />
                  </TouchableOpacity>
                  <Text style={styles.mapControlLabel}>Reset Zoom</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {order.deliveryLocation && (order.status === 'in-progress' || order.status === 'delivered' || order.status === 'awaitconfirmation') && (
          <View style={styles.divider} />
        )}

        {/* Order Management Actions */}
        <View style={styles.section}>
          {order.status === 'pending' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionInstructions}>
                Tap Accept Order if you are ready to deliver. Once accepted, this order will no longer be available to other delivery partners.
              </Text>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleAcceptOrder}
                disabled={actionLoading === 'accept'}
              >
                {actionLoading === 'accept' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  {actionLoading === 'accept' ? 'Accepting...' : 'Accept Order'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'accepted' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionInstructions}>
                You have accepted this order. Please pickup from the branch and start delivery.
              </Text>
              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handlePickupOrder}
                disabled={actionLoading === 'pickup'}
              >
                {actionLoading === 'pickup' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="truck-delivery" size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  {actionLoading === 'pickup' ? 'Picking up...' : 'Pickup Order'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'in-progress' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionInstructions}>
                Order is in transit. Mark as delivered when you reach the customer.
              </Text>
              
              {/* Location Sharing Controls */}
              <View style={styles.locationControls}>
                {!isSharingLocation ? (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.locationButton]} 
                    onPress={startLocationTracking}
                  >
                    <MaterialCommunityIcons name="map-marker" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Start Live Location Sharing</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity 
                    style={[styles.actionButton, styles.stopLocationButton]} 
                    onPress={stopLocationTracking}
                  >
                    <MaterialCommunityIcons name="map-marker-off" size={20} color="#fff" />
                    <Text style={styles.actionButtonText}>Stop Location Sharing</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity 
                style={styles.actionButton} 
                onPress={handleMarkOrderDelivered}
                disabled={actionLoading === 'deliver'}
              >
                {actionLoading === 'deliver' ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
                )}
                <Text style={styles.actionButtonText}>
                  {actionLoading === 'deliver' ? 'Marking...' : 'Mark as Delivered'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {order.status === 'awaitconfirmation' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionInstructions}>
                Order has been delivered and is awaiting customer confirmation. The customer needs to confirm receipt.
              </Text>
              <View style={styles.awaitingConfirmationNotice}>
                <MaterialCommunityIcons name="clock-outline" size={20} color="#f59e0b" />
                <Text style={styles.awaitingConfirmationText}>
                  Awaiting Customer Confirmation
                </Text>
              </View>
            </View>
          )}

          {order.status === 'delivered' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionInstructions}>
                Order has been successfully delivered and confirmed by the customer.
              </Text>
              <View style={styles.deliveredNotice}>
                <MaterialCommunityIcons name="check-circle" size={20} color="#22c55e" />
                <Text style={styles.deliveredText}>
                  Order Delivered Successfully
                </Text>
              </View>
            </View>
          )}

          {order.status === 'cancelled' && (
            <View style={styles.actionSection}>
              <Text style={styles.actionInstructions}>
                This order has been cancelled and is no longer active.
              </Text>
              <View style={styles.cancelledNotice}>
                <MaterialCommunityIcons name="close-circle" size={20} color="#dc3545" />
                <Text style={styles.cancelledText}>
                  Order Cancelled
                </Text>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  safeArea: { flex: 1, backgroundColor: '#ffffff' },
  header: {
    backgroundColor: '#fff',
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 16,
    paddingVertical: 12, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e5e7eb',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1d1d1d', flex: 1 },
  refreshButton: { padding: 5 },
  scrollView: { flex: 1, backgroundColor: '#f8fafc' },
  scrollContentContainer: { paddingBottom: 20 },
  section: { backgroundColor: '#ffffff', padding: 16 },
  sectionTitle: {
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#333333', 
    marginBottom: 16,
  },
  divider: { height: 8, backgroundColor: '#f7f7f7' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#6b7280',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    paddingVertical: 1,
    paddingHorizontal: 12,
    borderRadius: 15,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 10,
  },
  orderStatusContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  orderInfoContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  orderInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfoTextContainer: {
    marginLeft: 12,
    flex: 1,
  },
  orderInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 2,
  },
  orderInfoValue: {
    fontSize: 16,
    color: '#1f2937',
    fontWeight: '600',
  },
  customerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  addressCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  detailRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12,
    borderRadius: 10, 
    borderWidth: 1, 
    borderColor: '#eaeaea',
    marginBottom: 10,
  },
  detailTextContainer: { flex: 1, marginLeft: 12 },
  detailLabel: { fontSize: 12, color: '#888888', marginBottom: 2 },
  detailValue: { fontSize: 14, fontWeight: '600', color: '#333333' },
  phoneText: { fontSize: 14, fontWeight: '600', color: '#28a745' },
  mapSection: { 
    backgroundColor: '#ffffff',
    marginTop: 8,
  },
  mapHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  mapHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mapHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mapTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  distanceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5e45d6',
    marginLeft: 4,
  },
  distanceSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 4,
  },
  etaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  etaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5e45d6',
    marginLeft: 4,
  },
  etaSubText: {
    fontSize: 10,
    fontWeight: '500',
    color: '#6b7280',
    marginLeft: 4,
  },
  mapContainer: { 
    height: screenHeight * 0.5, // 50% of screen height
  },
  map: { 
    ...StyleSheet.absoluteFillObject,
    borderRadius: 0,
  },
  routeLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  routeLoadingText: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#5e45d6',
  },
  markerContainer: {
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    backgroundColor: '#1d1d1d',
    justifyContent: 'center', 
    alignItems: 'center', 
    elevation: 5,
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, 
    shadowRadius: 2,
  },
  deliveryMarker: { backgroundColor: '#28a745' },

  itemsContainer: {
    marginBottom: 16,
  },
  itemContainer: {
    flexDirection: 'row', 
    justifyContent: 'space-between',
    alignItems: 'center', 
    paddingVertical: 16,
    borderBottomWidth: 1, 
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: { flex: 1, marginRight: 10 },
  itemName: { fontSize: 15, color: '#333', fontWeight: '600' },
  itemQuantity: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1d1d1d',
    paddingHorizontal: 4,
    minWidth: 30,
    textAlign: 'center',
  },
  itemPrice: {
    fontSize: 15,
    color: '#1f2937',
    fontWeight: '600',
  },
  billRow: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginBottom: 12,
  },
  billText: { fontSize: 15, color: '#666666' },
  awaitingConfirmationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  awaitingConfirmationText: {
    color: '#92400e',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  deliveredNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#d1fae5',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  deliveredText: {
    color: '#065f46',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  actionSection: {
    marginBottom: 15,
  },
  actionInstructions: {
    fontSize: 14,
    color: '#555',
    marginBottom: 10,
    fontStyle: 'italic',
  },
  actionButton: {
    backgroundColor: '#28a745', 
    paddingVertical: 14, 
    paddingHorizontal: 24, 
    borderRadius: 12, 
    elevation: 3, 
    shadowColor: '#28a745', 
    shadowOpacity: 0.3, 
    shadowRadius: 5, 
    shadowOffset: { width: 0, height: 3 },
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: { 
    color: '#ffffff', 
    fontWeight: 'bold', 
    fontSize: 16,
    marginLeft: 8,
  },
  locationControls: {
    marginBottom: 12,
  },
  locationButton: {
    backgroundColor: '#3b82f6',
  },
  stopLocationButton: {
    backgroundColor: '#dc3545',
  },
  locationSection: {
    backgroundColor: '#fff',
    marginTop: 8,
    padding: 16,
  },
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0fdf4',
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  locationIndicator: {
    marginLeft: 8,
  },
  locationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
    opacity: 0.8,
  },
  mapControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'column',
    gap: 12,
  },
  mapControlGroup: {
    alignItems: 'flex-end',
  },
  mapControlButton: {
    width: 44,
    height: 44,
    backgroundColor: '#5e45d6',
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    marginBottom: 4,
  },
  mapControlLabel: {
    fontSize: 10,
    color: '#5e45d6',
    fontWeight: '600',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    textAlign: 'center',
    minWidth: 60,
  },
  resetZoomButton: {
    backgroundColor: '#28a745', // Green color for reset
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 10,
  },
  errorMessage: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 20,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 10,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  cancelledNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fef3c7',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#f59e0b',
    marginTop: 10,
  },
  cancelledText: {
    color: '#92400e',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
});

export default OrderDetailsScreen;
