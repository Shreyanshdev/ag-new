import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Linking
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getOrderById, API_BASE_URL, confirmDeliveryReceipt, cancelOrder } from '../../../../src/config/api';
import io from 'socket.io-client';
import { Order } from '../../../../types/types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';



// Simple linear interpolation for custom path points (fallback)
const interpolateLine = (start: { latitude: number; longitude: number }, end: { latitude: number; longitude: number }, steps = 20) => {
  const coords = [];
  for (let i = 0; i <= steps; i++) {
    coords.push({
      latitude: start.latitude + (end.latitude - start.latitude) * (i / steps),
      longitude: start.longitude + (end.longitude - start.longitude) * (i / steps),
    });
  }
  return coords;
};

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  // Validate coordinates
  if (!isFinite(lat1) || !isFinite(lon1) || !isFinite(lat2) || !isFinite(lon2)) {
    console.error('❌ Invalid coordinates for distance calculation:', { lat1, lon1, lat2, lon2 });
    return 0;
  }

  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c; // Distance in kilometers

  // Validate result
  if (!isFinite(distance) || distance < 0) {
    console.error('❌ Invalid distance calculation result:', distance);
    return 0;
  }

  return distance;
};

const OrderTrackingScreen = () => {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const router = useRouter();

  // ALL HOOKS MUST BE DECLARED FIRST
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [, setUserId] = useState<string | null>(null);
  const [deliveryPartnerLocation, setDeliveryPartnerLocation] = useState({
    latitude: 37.78825,
    longitude: -122.4324
  });
  const [routeCoordinates, setRouteCoordinates] = useState<{ latitude: number; longitude: number }[]>([]);
  const [estimatedTime, setEstimatedTime] = useState<string>('Estimating...');
  const [estimatedDistance, setEstimatedDistance] = useState<string>('Calculating...');
  const [branchToPartnerRoute, setBranchToPartnerRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [partnerToCustomerRoute, setPartnerToCustomerRoute] = useState<{ latitude: number; longitude: number }[]>([]);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const mapRef = useRef<MapView>(null);
  const locationUpdateInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const updateRouteRef = useRef<typeof updateRoute | null>(null);
  const [currentZoom, setCurrentZoom] = useState(0.01);
  const [orderStartTime, setOrderStartTime] = useState<Date | null>(null);
  const [totalTime, setTotalTime] = useState<string>('Calculating...');
  const [userIsSubscribed, setUserIsSubscribed] = useState(false);

  console.log('✅ OrderTrackingScreen initialized with orderId:', orderId);
  console.log('🔍 OrderTrackingScreen params:', { orderId });

  // Get directions from backend Google Maps service
  const getDirectionsFromBackend = async (
    origin: { latitude: number; longitude: number; address?: string },
    destination: { latitude: number; longitude: number; address?: string },
    routeType: string
  ) => {
    if (!orderId) return null;

    try {
      console.log('🗺️ Fetching directions from backend...');

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
          updateOrder: false // Don't update order for real-time tracking
        })
      });

      const result = await response.json();

      if (response.ok && result.routeData) {
        console.log('✅ Directions fetched from backend:', {
          distance: result.routeData.distance?.text,
          duration: result.routeData.duration?.text,
          coordinates: result.routeData.coordinates?.length
        });

        return {
          route: result.routeData.coordinates || [],
          duration: result.routeData.duration?.text || 'Calculating...',
          distance: result.routeData.distance?.text || 'Calculating...',
          durationValue: result.routeData.duration?.value || 0,
          distanceValue: result.routeData.distance?.value || 0,
          steps: result.routeData.steps || [],
          summary: result.routeData.summary || 'Route',
          warnings: result.routeData.warnings || [],
          bounds: result.routeData.bounds,
          overviewPolyline: result.routeData.overviewPolyline
        };
      } else {
        console.warn('⚠️ Backend directions error:', result.message);
        throw new Error(result.message || 'Failed to get directions');
      }
    } catch (error) {
      console.error('❌ Error fetching directions from backend:', error);
      // Re-throw the error so updateRoute can handle the fallback calculation
      throw error;
    }
  };

  // Map control functions
  const centerOnCustomerLocation = () => {
    if (order?.deliveryLocation) {
      mapRef.current?.animateToRegion({
        latitude: order.deliveryLocation.latitude || 0,
        longitude: order.deliveryLocation.longitude || 0,
        latitudeDelta: currentZoom,
        longitudeDelta: currentZoom,
      });
    }
  };

  const centerOnDeliveryPartner = () => {
    mapRef.current?.animateToRegion({
      latitude: deliveryPartnerLocation.latitude,
      longitude: deliveryPartnerLocation.longitude,
      latitudeDelta: currentZoom,
      longitudeDelta: currentZoom,
    });
  };

  const zoomIn = () => {
    const newZoom = Math.max(currentZoom * 0.7, 0.001);
    setCurrentZoom(newZoom);

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
        latitudeDelta: newZoom,
        longitudeDelta: newZoom,
      }, 300);
    }
  };

  const zoomOut = () => {
    const newZoom = Math.min(currentZoom * 1.5, 1);
    setCurrentZoom(newZoom);

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
        latitudeDelta: newZoom,
        longitudeDelta: newZoom,
      }, 300);
    }
  };

  const resetZoom = () => {
    const defaultZoom = 0.01;
    setCurrentZoom(defaultZoom);

    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: mapRegion.latitude,
        longitude: mapRegion.longitude,
        latitudeDelta: defaultZoom,
        longitudeDelta: defaultZoom,
      }, 500);
    }
  };

  useEffect(() => {
    let socket: any;
    let isComponentMounted = true;

    const setupSocket = async () => {
      try {
        const customerId = await AsyncStorage.getItem('userId');
        if (!customerId || !isComponentMounted) return;

        if (orderId) {
          socket = io(API_BASE_URL, {
            timeout: 20000,
            forceNew: true,
          });

          socket.on('connect', () => {
            if (!isComponentMounted) return;
            console.log('🔌 Socket connected for order tracking');
            socket.emit('joinOrderRoom', orderId);
            socket.emit('joinCustomerRoom', customerId);
          });

          socket.on('orderConfirmed', (updatedOrder: any) => {
            if (!isComponentMounted) return;
            console.log('✅ Order confirmed:', updatedOrder);
            setOrder(updatedOrder);
            if (updatedOrder.deliveryPartner && updatedOrder.deliveryPersonLocation) {
              setDeliveryPartnerLocation(updatedOrder.deliveryPersonLocation);
            }

            // If order is now in-progress, trigger initial route calculation
            if (updatedOrder.status === 'in-progress' && updatedOrder.deliveryLocation?.latitude && updatedOrder.deliveryLocation?.longitude) {
              console.log('🚀 Order now in-progress, calculating initial route...');
              // Small delay to ensure state is updated
              setTimeout(() => {
                if (isComponentMounted && updatedOrder.deliveryPersonLocation) {
                  updateRoute(updatedOrder.deliveryPersonLocation, updatedOrder.deliveryLocation, 'partner-to-customer');
                }
              }, 500);
            }
          });

          socket.on('orderLocationUpdated', (data: { orderId: string, location: any }) => {
            if (!isComponentMounted || data.orderId !== orderId) return;
            console.log('📍 Real-time location update received:', data.location);
            setDeliveryPartnerLocation(data.location);

            // Get latest order state to check status and delivery location
            setOrder(currentOrder => {
              if (!isComponentMounted || currentOrder?.status !== 'in-progress' ||
                !currentOrder?.deliveryLocation?.latitude || !currentOrder?.deliveryLocation?.longitude) {
                return currentOrder;
              }

              // Update route with real-time location
              updateRoute(data.location, {
                latitude: currentOrder.deliveryLocation.latitude,
                longitude: currentOrder.deliveryLocation.longitude
              }, 'partner-to-customer');

              // Update map region to follow delivery partner
              if (mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: data.location.latitude,
                  longitude: data.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }, 500);
              }
              return currentOrder;
            });
          });

          // Handle delivery partner location updates (newer event)
          socket.on('deliveryPartnerLocationUpdate', (data: any) => {
            if (!isComponentMounted || data.orderId !== orderId) return;
            console.log('🚚 Delivery partner location update:', data);
            setDeliveryPartnerLocation(data.location);

            // Get latest order state to check status and delivery location
            setOrder(currentOrder => {
              if (!isComponentMounted || currentOrder?.status !== 'in-progress' ||
                !currentOrder?.deliveryLocation?.latitude || !currentOrder?.deliveryLocation?.longitude) {
                return currentOrder;
              }

              // Update route with real-time location
              updateRoute(data.location, {
                latitude: currentOrder.deliveryLocation.latitude,
                longitude: currentOrder.deliveryLocation.longitude
              }, 'partner-to-customer');

              // Update map region to follow delivery partner
              if (mapRef.current) {
                mapRef.current.animateToRegion({
                  latitude: data.location.latitude,
                  longitude: data.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }, 500);
              }
              return currentOrder;
            });
          });

          socket.on('orderInProgress', (updatedOrder: any) => {
            if (!isComponentMounted) return;
            console.log('🚀 Order status changed to in-progress:', updatedOrder);
            setOrder(updatedOrder);

            // Calculate route when order becomes in-progress
            if (updatedOrder.deliveryPersonLocation &&
              updatedOrder.deliveryLocation?.latitude &&
              updatedOrder.deliveryLocation?.longitude) {
              console.log('🗺️ Calculating route for newly in-progress order...');
              setTimeout(() => {
                if (isComponentMounted) {
                  updateRoute(updatedOrder.deliveryPersonLocation, updatedOrder.deliveryLocation, 'partner-to-customer');
                }
              }, 300);
            }
          });

          socket.on('awaitingCustomer', (updatedOrder: any) => {
            if (!isComponentMounted) return;
            setOrder(updatedOrder);
          });

          socket.on('deliveryConfirmed', (updatedOrder: any) => {
            if (!isComponentMounted) return;
            setOrder(updatedOrder);
          });

          socket.on('error', (error: any) => {
            console.error('🔌 Socket error:', error);
          });

          socket.on('disconnect', (reason: string) => {
            console.log('🔌 Socket disconnected:', reason);
          });

          // Start real-time location updates only if component is mounted
          if (isComponentMounted) {
            startLocationUpdates();
          }
        }
      } catch (error) {
        console.error('❌ Error setting up socket:', error);
      }
    };

    setupSocket();

    return () => {
      isComponentMounted = false;
      console.log('🧹 Cleaning up OrderTrackingScreen socket and location updates');

      if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
      }

      stopLocationUpdates();
    };
  }, [orderId]);

  // Monitor order status changes and cleanup when delivered
  useEffect(() => {
    if (order?.status === 'delivered') {
      // Calculate total delivery time
      if (orderStartTime) {
        const endTime = new Date();
        const timeDiff = endTime.getTime() - orderStartTime.getTime();
        const minutes = Math.floor(timeDiff / (1000 * 60));
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (hours > 0) {
          setTotalTime(`${hours}h ${remainingMinutes}m`);
        } else {
          setTotalTime(`${remainingMinutes}m`);
        }
        console.log('⏱️ Total delivery time calculated:', { startTime: orderStartTime, endTime, totalTime: `${hours}h ${remainingMinutes}m` });
      }

      // Note: Socket cleanup is handled in the main useEffect cleanup
    }
  }, [order?.status, orderStartTime]);

  // Get optimized route from backend
  const getOptimizedRouteFromBackend = async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }) => {
    if (!orderId) return null;

    const response = await fetch(`${API_BASE_URL}/order/${orderId}/optimize-route`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await AsyncStorage.getItem('userToken')}`
      },
      body: JSON.stringify({ origin, destination })
    });

    if (response.ok) {
      const data = await response.json();
      return data.routeData;
    }
    throw new Error('Backend route optimization failed');
  };

  // Update route between two points with real-time optimization
  const updateRoute = useCallback(async (origin: { latitude: number; longitude: number }, destination: { latitude: number; longitude: number }, routeType: string = 'partner-to-customer') => {
    try {
      console.log('🔄 Updating route from:', origin, 'to:', destination, 'type:', routeType);

      // Validate coordinates
      if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
        console.warn('⚠️ Invalid coordinates for route calculation');
        return;
      }

      // Check if coordinates are valid numbers
      if (isNaN(origin.latitude) || isNaN(origin.longitude) || isNaN(destination.latitude) || isNaN(destination.longitude)) {
        console.warn('⚠️ Non-numeric coordinates detected');
        return;
      }

      // Use backend Google Maps service
      const directions = await getDirectionsFromBackend(
        { ...origin, address: 'Current location' },
        { ...destination, address: 'Destination' },
        routeType
      );

      if (directions && directions.route && directions.route.length > 0) {
        setRouteCoordinates(directions.route);
        setEstimatedTime(directions.duration);
        setEstimatedDistance(directions.distance);

        // Update map region
        updateMapRegion(directions.route);

        console.log('✅ Route updated successfully:', {
          points: directions.route.length,
          duration: directions.duration,
          distance: directions.distance,
          routeType
        });
      } else {
        throw new Error('No route data received from backend');
      }
    } catch (error) {
      console.error('❌ Error updating route:', error);
      console.log('🚨 Entering fallback calculation mode');

      // Set fallback route with better visual feedback
      console.log('🔄 Calculating fallback route...');

      // Validate coordinates for fallback calculation
      if (!origin?.latitude || !origin?.longitude || !destination?.latitude || !destination?.longitude) {
        console.warn('⚠️ Cannot calculate fallback route - invalid coordinates');
        setRouteCoordinates([]);
        setEstimatedTime('Unable to calculate');
        setEstimatedDistance('Route unavailable');
        return;
      }

      const fallbackRoute = interpolateLine(origin, destination, 30); // Fewer points for cleaner look
      setRouteCoordinates(fallbackRoute);

      // Calculate fallback ETA using distance
      const distance = calculateDistance(
        origin.latitude,
        origin.longitude,
        destination.latitude,
        destination.longitude
      );

      console.log('📏 Fallback distance calculation:', distance);

      let estimatedTimeFallback: string;
      let estimatedDistanceFallback: string;

      if (distance <= 0 || !isFinite(distance)) {
        console.log('⚠️ Invalid distance calculation, using default values');
        estimatedTimeFallback = 'Calculating...';
        estimatedDistanceFallback = 'Distance unavailable';
      } else {
        // Estimate time based on distance (assuming average speed of 25 km/h in city traffic)
        const estimatedMinutes = Math.max(5, Math.ceil((distance / 25) * 60)); // Minimum 5 minutes
        estimatedTimeFallback = `${estimatedMinutes} mins`;
        estimatedDistanceFallback = `${distance.toFixed(1)} km`;

        console.log('✅ Fallback calculation successful:', {
          distance: distance.toFixed(2) + ' km',
          estimatedMinutes,
          estimatedTime: estimatedTimeFallback
        });
      }

      setEstimatedTime(estimatedTimeFallback);
      setEstimatedDistance(estimatedDistanceFallback);

      // Update map region even with fallback route
      updateMapRegion(fallbackRoute);

      console.log('✅ Fallback route set with estimated values:', {
        routePoints: fallbackRoute.length,
        estimatedTime: estimatedTimeFallback,
        estimatedDistance: estimatedDistanceFallback
      });
    }
  }, [orderId]);

  // Update the ref whenever updateRoute changes
  useEffect(() => {
    updateRouteRef.current = updateRoute;
  }, [updateRoute]);

  // Start real-time location updates with GPS
  const startLocationUpdates = useCallback(() => {
    // Prevent multiple intervals
    if (locationUpdateInterval.current) {
      console.log('🔄 Location updates already running, skipping...');
      return;
    }

    let isLocationUpdateActive = true;

    // Get real GPS location
    const getCurrentLocation = async () => {
      if (!isLocationUpdateActive) return;

      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.warn('Location permission denied');
          return;
        }

        let location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
          timeInterval: 10000, // 10 seconds
          distanceInterval: 10, // 10 meters
        });

        if (!isLocationUpdateActive) return; // Check again after async operation

        const newLocation = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };

        console.log('📍 Real-time location update:', newLocation);
        setDeliveryPartnerLocation(newLocation);

        // Update route with new location only if order is still active
        if (order?.deliveryLocation?.latitude && order?.deliveryLocation?.longitude && isLocationUpdateActive && updateRouteRef.current) {
          updateRouteRef.current(newLocation, {
            latitude: order.deliveryLocation.latitude,
            longitude: order.deliveryLocation.longitude
          });
        }

        // Update map to follow delivery partner
        if (mapRef.current && isLocationUpdateActive) {
          mapRef.current.animateToRegion({
            latitude: newLocation.latitude,
            longitude: newLocation.longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }, 1000);
        }
      } catch (error) {
        console.error('Error getting location:', error);
        // Don't stop the interval on single error, but log it
      }
    };

    // Get initial location
    getCurrentLocation();

    // Update location every 15 seconds (optimized interval)
    locationUpdateInterval.current = setInterval(() => {
      if (isLocationUpdateActive) {
        getCurrentLocation();
      }
    }, 15000);

    console.log('📍 Location updates started');

    // Return cleanup function
    return () => {
      isLocationUpdateActive = false;
      if (locationUpdateInterval.current) {
        clearInterval(locationUpdateInterval.current);
        locationUpdateInterval.current = null;
      }
    };
  }, [order?.deliveryLocation?.latitude, order?.deliveryLocation?.longitude]);

  // Stop location updates
  const stopLocationUpdates = useCallback(() => {
    console.log('⏹️ Stopping location updates');
    if (locationUpdateInterval.current) {
      clearInterval(locationUpdateInterval.current);
      locationUpdateInterval.current = null;
    }
  }, []);

  // Update map region to show route
  const updateMapRegion = (coordinates: { latitude: number; longitude: number }[]) => {
    if (coordinates.length === 0) return;

    const lats = coordinates.map(point => point.latitude);
    const lngs = coordinates.map(point => point.longitude);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const midLat = (minLat + maxLat) / 2;
    const midLng = (minLng + maxLng) / 2;
    const latDelta = Math.max((maxLat - minLat) * 1.2, 0.01);
    const lngDelta = Math.max((maxLng - minLng) * 1.2, 0.01);

    setMapRegion({
      latitude: midLat,
      longitude: midLng,
      latitudeDelta: latDelta,
      longitudeDelta: lngDelta,
    });
  };

  useEffect(() => {
    const getUserId = async () => {
      const id = await AsyncStorage.getItem('userId');
      setUserId(id);
    };
    getUserId();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        if (orderId) {
          const orderResponse = await getOrderById(orderId);
          setOrder(orderResponse.data.order);

          // Set order start time for calculating total delivery time
          if (!orderStartTime && orderResponse.data.order.status !== 'delivered') {
            setOrderStartTime(new Date());
            console.log('⏱️ Order start time set:', new Date().toISOString());
          }

          // Also initialize delivery partner location if available
          if (orderResponse.data.order.deliveryPersonLocation) {
            setDeliveryPartnerLocation(orderResponse.data.order.deliveryPersonLocation);
          }

          // If order is already in-progress, calculate initial route
          const fetchedOrder = orderResponse.data.order;
          if (fetchedOrder.status === 'in-progress' &&
            fetchedOrder.deliveryPersonLocation &&
            fetchedOrder.deliveryLocation?.latitude &&
            fetchedOrder.deliveryLocation?.longitude) {
            console.log('🚀 Initial route calculation for in-progress order...');
            setTimeout(() => {
              updateRoute(fetchedOrder.deliveryPersonLocation, fetchedOrder.deliveryLocation, 'partner-to-customer');
            }, 1000); // Longer delay to ensure component is fully mounted
          }
        }
      } catch {
        Alert.alert("Error", "Failed to fetch order data.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [orderId]);

  // Check subscription status
  useEffect(() => {
    const getSubscriptionStatus = async () => {
      try {
        const flag = await AsyncStorage.getItem('isSubscription');
        setUserIsSubscribed(flag === 'true');
      } catch (error) {
        console.error('Error loading subscription status:', error);
        setUserIsSubscribed(false);
      }
    };
    getSubscriptionStatus();
  }, []);

  // Generate routes to show on map based on order status
  useEffect(() => {
    if (!order) {
      setBranchToPartnerRoute([]);
      setPartnerToCustomerRoute([]);
      return;
    }

    const branchLocation = (order.branch as any)?.location;
    const deliveryLocation = order.deliveryLocation;

    // Clear previous routes
    setBranchToPartnerRoute([]);
    setPartnerToCustomerRoute([]);

    if (order.status === 'accepted' && branchLocation && deliveryPartnerLocation) {
      // Show route from branch to delivery partner
      if (branchLocation.latitude && branchLocation.longitude &&
        deliveryPartnerLocation.latitude && deliveryPartnerLocation.longitude) {
        setBranchToPartnerRoute(interpolateLine(
          { latitude: branchLocation.latitude, longitude: branchLocation.longitude },
          deliveryPartnerLocation
        ));
      }
    } else if (order.status === 'in-progress' && deliveryLocation && deliveryPartnerLocation) {
      // Show route from delivery partner to customer
      if (deliveryLocation.latitude && deliveryLocation.longitude &&
        deliveryPartnerLocation.latitude && deliveryPartnerLocation.longitude) {
        setPartnerToCustomerRoute(interpolateLine(
          deliveryPartnerLocation,
          { latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude }
        ));
      }
    } else if (!order.deliveryPartner && branchLocation && deliveryLocation) {
      // No delivery partner assigned yet - show branch to customer
      if (branchLocation.latitude && branchLocation.longitude &&
        deliveryLocation.latitude && deliveryLocation.longitude) {
        setBranchToPartnerRoute(interpolateLine(
          { latitude: branchLocation.latitude, longitude: branchLocation.longitude },
          { latitude: deliveryLocation.latitude, longitude: deliveryLocation.longitude }
        ));
      }
    }
  }, [order, deliveryPartnerLocation]);

  // Early return AFTER all hooks are declared
  if (!orderId) {
    console.error('❌ OrderTrackingScreen: orderId is missing from params');
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.noDataContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.noDataTitle}>Error: Order ID Missing</Text>
          <Text style={styles.noDataSubtitle}>Please try again from the orders screen.</Text>
          <TouchableOpacity style={styles.shopButton} onPress={() => router.back()}>
            <Text style={styles.shopButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Cancel order handler
  const handleCancelOrder = async () => {
    if (!order || !orderId) return;

    // Check if order can be cancelled
    if (['delivered', 'cancelled'].includes(order.status)) {
      Alert.alert('Cannot Cancel', 'This order cannot be cancelled as it has already been delivered or cancelled.');
      return;
    }

    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order? This action cannot be undone.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await cancelOrder(orderId as string, 'Customer requested cancellation');
              Alert.alert('Order Cancelled', 'Your order has been cancelled successfully.');
              // Navigate back or refresh the order
              router.back();
            } catch (error) {
              console.error('Cancel order error:', error);
              Alert.alert('Error', 'Failed to cancel order. Please try again.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      if (orderId) {
        const orderResponse = await getOrderById(orderId);
        setOrder(orderResponse.data.order);
      }
    } catch (error) {
      console.log('Refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getOrderStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return '#f59e0b';
      case 'accepted': return '#3b82f6';
      case 'in-progress': return '#3b82f6';
      case 'awaitconfirmation': return '#f59e0b';
      case 'delivered': return '#22c55e';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getOrderStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'pending': return 'clock-outline';
      case 'accepted': return 'truck-delivery-outline';
      case 'in-progress': return 'truck-delivery-outline';
      case 'awaitconfirmation': return 'help-circle-outline';
      case 'delivered': return 'check-circle';
      case 'cancelled': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  };

  const handleConfirmDelivery = async () => {
    if (!order || !orderId) return;
    try {
      await confirmDeliveryReceipt(orderId as string);
      Alert.alert('Success', 'Delivery confirmed!');
    } catch {
      Alert.alert('Error', 'Failed to confirm delivery.');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
          <Text style={styles.loadingText}>Loading your order details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.noDataContainer}>
          <MaterialCommunityIcons name="package-variant-closed" size={64} color="#9ca3af" />
          <Text style={styles.noDataTitle}>No Active Order</Text>
          <Text style={styles.noDataSubtitle}>You currently have no orders in progress.</Text>
          <TouchableOpacity
            style={styles.shopButton}
            onPress={() => router.push('/screens/customer/orders/OrderHistoryScreen')}
          >
            <Text style={styles.shopButtonText}>View Past Orders</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={26} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Track Your Order</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
          <MaterialCommunityIcons name="refresh" size={20} color="#1d1d1d" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Order Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Status</Text>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name={getOrderStatusIcon(order.status || 'pending')}
              size={24}
              color="#28a745"
            />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Current Status</Text>
              <View style={styles.statusContainer}>
                <View style={[styles.statusBadge, { backgroundColor: getOrderStatusColor(order.status || 'pending') }]}>
                  <Text style={styles.statusText}>
                    {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="information-outline" size={24} color="#28a745" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Status Details</Text>
              <Text style={styles.detailValue}>{order.deliveryStatus || 'Processing your order'}</Text>
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="receipt" size={24} color="#28a745" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Order ID</Text>
              <Text style={styles.detailValue}>#{order.orderId}</Text>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Progress Steps Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Progress</Text>

          <View style={styles.progressSteps}>
            <View style={[styles.step, order.status === 'pending' || order.status === 'accepted' || order.status === 'in-progress' || order.status === 'delivered' ? styles.stepCompleted : styles.stepPending]}>
              <View style={[styles.stepDot, order.status === 'pending' || order.status === 'accepted' || order.status === 'in-progress' || order.status === 'delivered' ? styles.stepDotCompleted : styles.stepDotPending]} />
              <Text style={styles.stepText}>Order Placed</Text>
            </View>
            <View style={[styles.step, order.status === 'accepted' || order.status === 'in-progress' || order.status === 'delivered' ? styles.stepCompleted : styles.stepPending]}>
              <View style={[styles.stepDot, order.status === 'accepted' || order.status === 'in-progress' || order.status === 'delivered' ? styles.stepDotCompleted : styles.stepDotPending]} />
              <Text style={styles.stepText}>Preparing</Text>
            </View>
            <View style={[styles.step, order.status === 'in-progress' || order.status === 'delivered' ? styles.stepCompleted : styles.stepPending]}>
              <View style={[styles.stepDot, order.status === 'in-progress' || order.status === 'delivered' ? styles.stepDotCompleted : styles.stepDotPending]} />
              <Text style={styles.stepText}>On the Way</Text>
            </View>
            <View style={[styles.step, order.status === 'delivered' ? styles.stepCompleted : styles.stepPending]}>
              <View style={[styles.stepDot, order.status === 'delivered' ? styles.stepDotCompleted : styles.stepDotPending]} />
              <Text style={styles.stepText}>Delivered</Text>
            </View>
          </View>

          {order.status === 'awaitconfirmation' && (
            <TouchableOpacity style={styles.actionButton} onPress={handleConfirmDelivery}>
              <MaterialCommunityIcons name="check-circle" size={20} color="#fff" />
              <Text style={styles.actionButtonText}>Confirm Delivery</Text>
            </TouchableOpacity>
          )}

          {/* Cancel Order Button for Non-Subscribed Users */}
          {!userIsSubscribed && !['delivered', 'cancelled'].includes(order.status) && (
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelOrder}>
              <MaterialCommunityIcons name="close-circle" size={20} color="#fff" />
              <Text style={styles.cancelButtonText}>Cancel Order</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.divider} />

        {/* Live Tracking Map */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Live Tracking</Text>

          <View style={styles.mapContainer}>
            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={mapRegion}
              showsUserLocation={true}
              showsMyLocationButton={false}
              showsCompass={true}
              showsScale={true}
              mapType="standard"
              followsUserLocation={false}
              zoomEnabled={true}
              scrollEnabled={true}
              pitchEnabled={true}
              rotateEnabled={true}
            >
              {/* Branch Marker with custom icon */}
              {(order?.branch as any)?.location && (order.branch as any).location.latitude && (order.branch as any).location.longitude && (
                <Marker
                  coordinate={{
                    latitude: (order.branch as any).location.latitude,
                    longitude: (order.branch as any).location.longitude,
                  }}
                  title="Store Location"
                  description="Pickup Point"
                >
                  <View style={styles.branchMarker}>
                    <MaterialCommunityIcons name="storefront" size={24} color="#FFFFFF" />
                  </View>
                </Marker>
              )}

              {/* Delivery Partner Marker with custom icon */}
              <Marker
                coordinate={deliveryPartnerLocation}
                title="Delivery Partner"
                description="Your order is here"
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={styles.deliveryMarker}>
                  <MaterialCommunityIcons name="truck-delivery" size={20} color="#FFFFFF" />
                </View>
              </Marker>

              {/* Customer Location Marker with custom icon */}
              {order?.deliveryLocation && (
                <Marker
                  coordinate={{
                    latitude: order.deliveryLocation.latitude || 0,
                    longitude: order.deliveryLocation.longitude || 0,
                  }}
                  title="Delivery Address"
                  description="Your location"
                >
                  <View style={styles.customerMarker}>
                    <MaterialCommunityIcons name="home-variant" size={20} color="#FFFFFF" />
                  </View>
                </Marker>
              )}

              {/* Route Polyline with gradient effect */}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#28a745"
                  strokeWidth={5}
                  strokeColors={['#28a745', '#20c997', '#17a2b8']}
                  lineDashPattern={[1]}
                />
              )}

              {/* Branch to Partner Route (when order is accepted) */}
              {order?.status === 'accepted' && branchToPartnerRoute.length > 0 && (
                <Polyline
                  coordinates={branchToPartnerRoute}
                  strokeColor="#3b82f6"
                  strokeWidth={4}
                  strokeColors={['#3b82f6', '#1d4ed8']}
                  lineDashPattern={[5, 5]}
                />
              )}

              {/* Partner to Customer Route (when order is in-progress) */}
              {order?.status === 'in-progress' && partnerToCustomerRoute.length > 0 && (
                <Polyline
                  coordinates={partnerToCustomerRoute}
                  strokeColor="#28a745"
                  strokeWidth={5}
                  strokeColors={['#28a745', '#16a34a']}
                  lineDashPattern={[1]}
                />
              )}
            </MapView>

            {/* Map Control Buttons */}
            <View style={styles.mapControls}>
              <View style={styles.mapControlGroup}>
                <TouchableOpacity
                  style={styles.mapControlButton}
                  onPress={centerOnCustomerLocation}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="home-variant" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mapControlLabel}>My Location</Text>
              </View>

              <View style={styles.mapControlGroup}>
                <TouchableOpacity
                  style={styles.mapControlButton}
                  onPress={centerOnDeliveryPartner}
                  activeOpacity={0.8}
                >
                  <MaterialCommunityIcons name="truck-delivery" size={20} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.mapControlLabel}>Partner</Text>
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

          <View style={styles.trackingInfo}>
            {order?.status === 'delivered' ? (
              // Show total time for delivered orders
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="clock-outline" size={24} color="#22c55e" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>Total Delivery Time</Text>
                  <Text style={[styles.detailValue, styles.timeValue]}>
                    {totalTime}
                  </Text>
                  <Text style={styles.subText}>Order completed successfully</Text>
                </View>
              </View>
            ) : (
              // Show ETA and distance for active orders
              <>
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="clock-fast" size={24} color="#28a745" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Estimated Time</Text>
                    <Text style={[styles.detailValue, styles.timeValue]}>
                      {estimatedTime || 'Estimating...'}
                    </Text>
                    {order?.status === 'accepted' && (
                      <Text style={styles.subText}>Partner heading to branch</Text>
                    )}
                    {order?.status === 'in-progress' && (
                      <Text style={styles.subText}>Partner heading to you</Text>
                    )}
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="map-marker-distance" size={24} color="#28a745" />
                  <View style={styles.detailTextContainer}>
                    <Text style={styles.detailLabel}>Distance</Text>
                    <Text style={[styles.detailValue, styles.distanceValue]}>
                      {estimatedDistance || 'Calculating...'}
                    </Text>
                    {order?.status === 'accepted' && (
                      <Text style={styles.subText}>To pickup location</Text>
                    )}
                    {order?.status === 'in-progress' && (
                      <Text style={styles.subText}>To delivery location</Text>
                    )}
                  </View>
                </View>
              </>
            )}

            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name={order?.status === 'in-progress' ? "truck-delivery" : "storefront"}
                size={24}
                color="#3b82f6"
              />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Current Phase</Text>
                <Text style={[styles.detailValue, styles.phaseValue]}>
                  {order?.status === 'accepted' && 'Heading to Branch'}
                  {order?.status === 'in-progress' && 'On the Way to You'}
                  {order?.status === 'awaitconfirmation' && 'Arrived at Location'}
                  {order?.status === 'delivered' && 'Delivery Complete'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="currency-inr" size={24} color="#28a745" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Order Total</Text>
              <Text style={styles.detailValue}>₹{order.totalPrice.toFixed(2)}</Text>
            </View>
          </View>

          {order.deliveryFee !== undefined && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="truck-delivery" size={24} color="#28a745" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Delivery Fee</Text>
                <Text style={styles.detailValue}>₹{order.deliveryFee.toFixed(2)}</Text>
              </View>
            </View>
          )}

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="calculator" size={24} color="#28a745" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Total Amount</Text>
              <Text style={[styles.detailValue, styles.totalAmount]}>₹{(order.totalPrice + (order.deliveryFee || 0)).toFixed(2)}</Text>
            </View>
          </View>

          {/* Download Invoice Button */}
          <TouchableOpacity 
            style={styles.invoiceButton} 
            onPress={() => {
              const orderData = JSON.stringify(order);
              router.push({
                pathname: '/screens/customer/orders/InvoiceScreen',
                params: { orderData }
              });
            }}
          >
            <MaterialCommunityIcons name="file-download" size={20} color="#fff" />
            <Text style={styles.invoiceButtonText}>Download Invoice</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        {/* Delivery Partner */}
        {order.deliveryPartner && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Delivery Partner</Text>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account-circle" size={24} color="#28a745" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Partner Name</Text>
                <Text style={styles.detailValue}>{order.deliveryPartner.name}</Text>
              </View>
            </View>

            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="phone" size={24} color="#28a745" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Contact Number</Text>
                <Text style={styles.detailValue}>{order.deliveryPartner.phone}</Text>
              </View>
              {order.deliveryPartner.phone && (
                <TouchableOpacity
                  style={styles.callButton}
                  onPress={() => Linking.openURL(`tel:${order.deliveryPartner?.phone}`)}
                >
                  <MaterialCommunityIcons name="phone" size={18} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {order.deliveryPartner && <View style={styles.divider} />}

        {/* Order Items */}
        {order.items && order.items.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Items</Text>

            {order.items.map((item, idx) => (
              <View key={typeof item.product === 'object' ? item.product._id : item.product || idx} style={styles.detailRow}>
                <MaterialCommunityIcons name="package-variant" size={24} color="#28a745" />
                <View style={styles.detailTextContainer}>
                  <Text style={styles.detailLabel}>{item.name}</Text>
                  <Text style={styles.detailValue}>Qty: {item.unitsBought} × ₹{(item.unitPrice || 0).toFixed(2)}</Text>
                </View>
                <Text style={styles.itemPriceText}>₹{(item.totalPrice || 0).toFixed(2)}</Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#ffffff',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  backButton: {
    marginRight: 16
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1d1d1d',
    flex: 1,
  },
  refreshButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },

  scrollView: {
    backgroundColor: '#f7f7f7'
  },
  scrollContentContainer: {
    paddingBottom: 20
  },
  section: {
    backgroundColor: '#ffffff',
    padding: 16
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  divider: {
    height: 8,
    backgroundColor: '#f7f7f7'
  },

  // Detail row styles (matching checkout)
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eaeaea',
    marginBottom: 8,
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12
  },
  detailLabel: {
    fontSize: 12,
    color: '#888888',
    marginBottom: 2
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333'
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1d1d1d',
  },

  // Status badge
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },

  // Progress Steps (preserved with status dots)
  progressSteps: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  step: {
    alignItems: 'center',
    flex: 1,
  },
  stepCompleted: {
    opacity: 1,
  },
  stepPending: {
    opacity: 0.4,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginBottom: 8,
  },
  stepDotCompleted: {
    backgroundColor: '#28a745',
  },
  stepDotPending: {
    backgroundColor: '#d1d5db',
  },
  stepText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    textAlign: 'center',
  },

  // Map styles
  mapContainer: {
    height: 400, // Increased from 200 to 400 for better visibility
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 16,
  },
  map: {
    flex: 1,
  },

  // Custom marker styles (preserved)
  branchMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  deliveryMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#28a745',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  customerMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },

  // Tracking info
  trackingInfo: {
    marginTop: 8,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#28a745',
  },
  distanceValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3b82f6',
  },
  phaseValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  subText: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Button styles
  actionButton: {
    backgroundColor: '#28a745',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },

  // Cancel button styles
  cancelButton: {
    backgroundColor: '#dc2626',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },

  // Invoice button styles
  invoiceButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  invoiceButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    marginLeft: 8,
  },
  callButton: {
    backgroundColor: '#28a745',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemPriceText: {
    fontSize: 15,
    color: '#1d1d1d',
    fontWeight: '600',
  },

  // Loading States
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  noDataContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ffffff',
  },
  noDataTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  noDataSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  shopButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  shopButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Map control styles
  mapControls: {
    position: 'absolute',
    top: 20,
    right: 20,
    flexDirection: 'column',
    gap: 8,
  },
  mapControlGroup: {
    alignItems: 'flex-end',
  },
  mapControlButton: {
    width: 40,
    height: 40,
    backgroundColor: '#5e45d6',
    borderRadius: 20,
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
    minWidth: 50,
  },
  resetZoomButton: {
    backgroundColor: '#28a745', // Green color for reset
  },
});

export default OrderTrackingScreen;
