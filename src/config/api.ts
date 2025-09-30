import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, Alert } from 'react-native';

// Determine the correct API base URL based on platform
const getApiBaseUrl = () => {
  // Check for environment variable first
  if (process.env.EXPO_PUBLIC_API_URL) {
    console.log('🔗 Using environment variable API URL:', process.env.EXPO_PUBLIC_API_URL);
    return process.env.EXPO_PUBLIC_API_URL;
  }

  if (process.env.NODE_ENV !== 'production') {
    // Development environment - platform-specific URLs
    if (Platform.OS === 'android') {
      // Android emulator uses 10.0.2.2 to reach host machine
      const apiUrl = process.env.EXPO_PUBLIC_DEV_API_URL || 'http://10.0.2.2:3000';
      console.log('🔗 Android Development API URL:', apiUrl, 'Platform:', Platform.OS);
      return apiUrl;
    } else {
      // iOS simulator and web use localhost or host IP
      const apiUrl = process.env.EXPO_PUBLIC_DEV_API_URL || 'http://localhost:3000';
      console.log('🔗 iOS/Web Development API URL:', apiUrl, 'Platform:', Platform.OS);
      return apiUrl;
    }
  }

  // Production - use environment variable or fallback
  const prodUrl = process.env.EXPO_PUBLIC_PROD_API_URL || 'https://agstore-backend.onrender.com';
  console.log('🔗 Production API URL:', prodUrl);
  return prodUrl;
};

export const API_BASE_URL = getApiBaseUrl();

// API Configuration - logs removed for production

// Utility function to validate token with enhanced checks
const isValidToken = (token: string | null): boolean => {
  if (!token || typeof token !== 'string') {
    console.log('❌ Token validation failed: null or not string');
    return false;
  }

  const trimmed = token.trim();

  // Check basic requirements
  if (trimmed.length < 10) {
    console.log('❌ Token validation failed: too short');
    return false;
  }

  // Check for null/undefined strings
  if (trimmed === 'null' || trimmed === 'undefined' || trimmed === '') {
    console.log('❌ Token validation failed: null/undefined string');
    return false;
  }

  // Basic JWT structure check (should have 3 parts separated by dots)
  const parts = trimmed.split('.');
  if (parts.length !== 3) {
    console.log('❌ Token validation failed: invalid JWT structure');
    return false;
  }

  // Validate each part is base64url encoded
  try {
    for (const part of parts) {
      // Check if it's valid base64url (no padding, valid characters)
      if (!/^[A-Za-z0-9_-]+$/.test(part)) {
        console.log('❌ Token validation failed: invalid base64url characters');
        return false;
      }
    }

    // Try to decode header and payload to ensure they're valid JSON
    const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check if payload has required JWT fields
    if (!payload.iat || !payload.exp) {
      console.log('❌ Token validation failed: missing iat/exp claims');
      return false;
    }

    console.log('✅ Token validation passed');
    return true;
  } catch (error) {
    console.log('❌ Token validation failed: decode error', error);
    return false;
  }
};

// Utility function to check if token is expired
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (error) {
    console.log('❌ Error checking token expiry:', error);
    return true; // Consider expired if we can't parse
  }
};

// Utility function to check if token is close to expiry (with buffer)
const isTokenCloseToExpiry = (token: string, bufferMinutes: number = 2): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const currentTime = Date.now() / 1000;
    const timeToExpiry = payload.exp - currentTime;
    const bufferTime = bufferMinutes * 60; // Convert minutes to seconds
    return timeToExpiry <= bufferTime;
  } catch (error) {
    console.log('❌ Error checking token expiry buffer:', error);
    return true; // Consider close to expiry if we can't parse
  }
};

// Utility function to check if token is ready for API calls
export const isTokenReady = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem('userToken');
    const tokenTimestamp = await AsyncStorage.getItem('tokenTimestamp');

    if (!isValidToken(token)) {
      console.log('❌ Token validation failed');
      return false;
    }

    // Check if token is expired (not just close to expiry)
    if (token && isTokenExpired(token)) {
      console.log('🔄 Token is expired');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error checking token readiness:', error);
    return false;
  }
};

// Utility function to wait for token to be ready with better error handling
export const waitForToken = async (maxWaitTime: number = 3000): Promise<boolean> => {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitTime) {
    try {
      if (await isTokenReady()) {
        return true;
      }
      // Wait 200ms before checking again (reduced frequency)
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.error('❌ Error during token wait:', error);
      return false;
    }
  }

  return false;
};

// Utility function to refresh token automatically with deduplication
export const refreshTokenIfNeeded = async (): Promise<boolean> => {
  const now = Date.now();

  // Prevent multiple simultaneous refresh attempts
  if (authState.isRefreshing && authState.refreshPromise) {
    console.log('🔄 Token refresh already in progress, waiting...');
    try {
      return await authState.refreshPromise;
    } catch (error) {
      console.error('❌ Error waiting for token refresh:', error);
      return false;
    }
  }

  // Rate limit token refresh (minimum 30 seconds between attempts)
  if (now - authState.lastRefreshTime < 30000) {
    console.log('⏳ Token refresh rate limited, using existing token');
    return true;
  }

  let token: string | null = null;
  let refreshToken: string | null = null;

  try {
    [token, refreshToken] = await Promise.all([
      AsyncStorage.getItem('userToken'),
      AsyncStorage.getItem('refreshToken')
    ]);

    if (!token || !refreshToken) {
      console.log('❌ No tokens available for refresh');
      return false;
    }

    // Check if access token needs refresh (close to expiry with 3-minute buffer)
    if (!isTokenExpired(token) && !isTokenCloseToExpiry(token, 3)) {
      return true; // Token is still fresh (more than 3 minutes left)
    }

    console.log('🔄 Refreshing token...');
    authState.isRefreshing = true;
    authState.lastRefreshTime = now;

    authState.refreshPromise = (async () => {
      try {
        // Use direct axios call to avoid interceptor loops
        const response = await axios.post(`${API_BASE_URL}/auth/refresh-token`,
          { refreshToken },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 10000 // 10 second timeout for refresh
          }
        );

        if (response.data?.accessToken && response.data?.refreshToken) {
          await Promise.all([
            AsyncStorage.setItem('userToken', response.data.accessToken),
            AsyncStorage.setItem('refreshToken', response.data.refreshToken),
            AsyncStorage.setItem('tokenTimestamp', Date.now().toString())
          ]);

          authState.consecutiveFailures = 0;
          console.log('✅ Token refreshed successfully');
          return true;
        } else {
          throw new Error('Invalid refresh response - missing tokens');
        }
      } catch (error: any) {
        authState.consecutiveFailures++;
        console.error('❌ Token refresh failed:', error.message || error);

        // If multiple consecutive failures, clear tokens
        if (authState.consecutiveFailures >= 3) {
          console.log('🚨 Multiple refresh failures, clearing tokens');
          try {
            await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole']);
            // Clear caches as well
            requestCache.clear();
            pendingRequests.clear();
          } catch (clearError) {
            console.error('❌ Error clearing tokens after refresh failures:', clearError);
          }
        }

        // Re-throw error to be handled by caller
        throw error;
      }
    })();

    return await authState.refreshPromise;
  } catch (error) {
    console.error('❌ Error in refresh logic:', error);
    return false;
  } finally {
    authState.isRefreshing = false;
    authState.refreshPromise = null;
  }
};

// Utility function to check if an error is a first-time user case
export const isFirstTimeUserError = (error: any): boolean => {
  return (error as any)?.isFirstTimeUser === true ||
    (error as any)?.status === 404 && (
      error?.message?.includes('No active order')
    );
};

// Utility function to get friendly message for first-time users
export const getFirstTimeUserMessage = (error: any): string => {
  if (error?.message?.includes('order')) {
    return "You don't have any active orders yet. Explore products and place your first order!";
  }
  return "Welcome! Explore our products and start your first order!";
};

// Utility function to check and recover token persistence
export const checkTokenPersistence = async (): Promise<{
  isValid: boolean;
  userRole?: string;
  needsRecovery: boolean;
}> => {
  try {
    console.log('🔍 Checking token persistence...');

    const [userToken, refreshToken, userRole, tokenTimestamp] = await Promise.all([
      AsyncStorage.getItem('userToken'),
      AsyncStorage.getItem('refreshToken'),
      AsyncStorage.getItem('userRole'),
      AsyncStorage.getItem('tokenTimestamp'),
    ]);

    // Check if all required data exists
    if (!userToken || !refreshToken || !userRole) {
      console.log('❌ Missing authentication data');
      return { isValid: false, needsRecovery: true };
    }

    // Validate token format
    if (!isValidToken(userToken)) {
      console.log('❌ Invalid token format');
      return { isValid: false, needsRecovery: true };
    }

    // Check token age (refresh if older than 12 minutes to account for 15min expiry)
    const tokenAge = Date.now() - parseInt(tokenTimestamp || '0');
    const needsRefresh = tokenAge > 12 * 60 * 1000; // 12 minutes

    if (needsRefresh) {
      console.log('🔄 Token needs refresh (age check)');
      try {
        const refreshSuccess = await refreshTokenIfNeeded();

        if (!refreshSuccess) {
          console.log('❌ Token refresh failed during persistence check');
          // Don't immediately invalidate - might be network issue
          return { isValid: true, userRole, needsRecovery: false };
        }
      } catch (error) {
        console.log('❌ Token refresh error during persistence check:', error);
        // Don't fail persistence check on refresh errors
        return { isValid: true, userRole, needsRecovery: false };
      }
    }

    console.log('✅ Token persistence check passed');
    return {
      isValid: true,
      userRole,
      needsRecovery: false
    };

  } catch (error) {
    console.error('❌ Error checking token persistence:', error);
    return { isValid: false, needsRecovery: true };
  }
};

// Utility function to reset logout state (call after successful login)
export const resetLogoutState = () => {
  global.logoutInProgress = false;
  global.sessionExpiredAlertShown = false;
  console.log('🔄 Reset logout state flags');
};

// Utility function to initialize authentication state on app start
export const initializeAuthState = async (): Promise<{
  isAuthenticated: boolean;
  userRole?: string;
  redirectRoute: string;
}> => {
  try {
    console.log('🚀 Initializing authentication state...');

    // Reset global logout flag on app start
    resetLogoutState();

    const persistenceCheck = await checkTokenPersistence();

    if (persistenceCheck.isValid) {
      // Determine correct route based on user role
      let route: string;
      const userRole = persistenceCheck.userRole;

      if (userRole === 'DeliveryPartner') {
        route = 'screens/deliveryPartner/DeliveryOrderScreen';
        console.log('🚗 Redirecting delivery partner to DeliveryOrderScreen');
      } else if (userRole === 'Customer') {
        route = 'index'; // HomeScreen for customer
        console.log('🏠 Redirecting customer to HomeScreen');
      } else {
        console.log('⚠️ Unknown user role:', userRole, '- defaulting to HomeScreen');
        route = 'screens/auth/LoginScreen';
      }

      return {
        isAuthenticated: true,
        userRole: persistenceCheck.userRole,
        redirectRoute: route,
      };
    } else {
      console.log('ℹ️ Authentication check failed, redirecting to login');
      // Only clear tokens if they are actually invalid, not on network errors
      if (persistenceCheck.needsRecovery) {
        await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole']);
      }
      return {
        isAuthenticated: false,
        redirectRoute: 'screens/auth/LoginScreen',
      };
    }
  } catch (error) {
    console.error('❌ Error initializing auth state:', error);
    // Don't clear tokens on initialization errors - might be network issues
    console.log('⚠️ Keeping existing tokens due to initialization error');
    return {
      isAuthenticated: false,
      redirectRoute: 'screens/auth/LoginScreen',
    };
  }
};

// Utility function to clear cache
export const clearApiCache = (pattern?: string): void => {
  if (pattern) {
    // Clear specific cache entries matching pattern
    for (const [key] of requestCache) {
      if (key.includes(pattern)) {
        requestCache.delete(key);
      }
    }
    console.log(`🧹 Cleared cache for pattern: ${pattern}`);
  } else {
    // Clear all cache
    requestCache.clear();
    pendingRequests.clear();
    console.log('🧹 Cleared all API cache');
  }
};

// Utility function to optimize API calls by batching and reducing frequency
export const createOptimizedApiCall = <T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  options: {
    debounceMs?: number;
    cacheKey?: string;
    skipCache?: boolean;
  } = {}
): T => {
  const { debounceMs = 500, cacheKey, skipCache = false } = options;

  return ((...args: any[]) => {
    // Generate cache key if not provided
    const key = cacheKey || `${apiFunction.name}_${JSON.stringify(args)}`;

    // Check cache first (unless skipped)
    if (!skipCache) {
      const cached = requestCache.get(key);
      if (cached) {
        const now = Date.now();
        if (now - cached.timestamp < cached.ttl) {
          console.log(`📦 Using optimized cached response for ${apiFunction.name}`);
          return Promise.resolve(cached.data);
        } else {
          requestCache.delete(key);
        }
      }
    }

    // Check for pending request (deduplication)
    if (pendingRequests.has(key)) {
      console.log(`🔄 Using pending optimized request for ${apiFunction.name}`);
      return pendingRequests.get(key);
    }

    // Debounce if specified
    if (debounceMs > 0) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(async () => {
          try {
            const result = await apiFunction(...args);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, debounceMs);

        // Store debounced promise for potential cancellation
        pendingRequests.set(key, new Promise((res, rej) => {
          // This promise will resolve when the debounced call completes
        }));
      });
    }

    // Execute the API call
    const requestPromise = apiFunction(...args);
    pendingRequests.set(key, requestPromise);

    // Clean up and cache successful response
    requestPromise
      .then((result) => {
        if (!skipCache && result) {
          const ttl = getCacheTTL(apiFunction.name);
          requestCache.set(key, {
            data: result,
            timestamp: Date.now(),
            ttl
          });
        }
      })
      .finally(() => {
        pendingRequests.delete(key);
      });

    return requestPromise;
  }) as T;
};

// Debounce utility for frequently called APIs
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

export const debounceApiCall = <T extends (...args: any[]) => Promise<any>>(
  apiFunction: T,
  delay: number = 1000,
  key?: string
): T => {
  return ((...args: any[]) => {
    const debounceKey = key || apiFunction.name;

    return new Promise((resolve, reject) => {
      // Clear existing timer
      if (debounceTimers.has(debounceKey)) {
        clearTimeout(debounceTimers.get(debounceKey)!);
      }

      // Set new timer
      const timer = setTimeout(async () => {
        try {
          const result = await apiFunction(...args);
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          debounceTimers.delete(debounceKey);
        }
      }, delay);

      debounceTimers.set(debounceKey, timer);
    });
  }) as T;
};

// API Configuration - logs removed for production

// Request deduplication cache with improved management
const pendingRequests = new Map<string, Promise<any>>();
const requestCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Authentication state management
let authState = {
  isRefreshing: false,
  refreshPromise: null as Promise<any> | null,
  lastRefreshTime: 0,
  consecutiveFailures: 0,
};

// Global logout flag to stop all intervals
declare global {
  var logoutInProgress: boolean;
}

// Cache TTL settings (in milliseconds)
const CACHE_TTL = {
  PRODUCTS: 10 * 60 * 1000, // 10 minutes (increased for better performance)
  CATEGORIES: 30 * 60 * 1000, // 30 minutes (categories rarely change)
  BRANCHES: 60 * 60 * 1000, // 1 hour (branches rarely change)
  ADDRESSES: 5 * 60 * 1000, // 5 minutes (increased for better UX)
  FEATURED: 15 * 60 * 1000, // 15 minutes for featured products

  ORDERS: 30 * 1000, // 30 seconds
  DELIVERY_STATUS: 10 * 1000, // 10 seconds
  DEFAULT: 60 * 1000, // 1 minute (increased default)
};

// Get cache TTL for specific endpoint
const getCacheTTL = (url: string): number => {
  if (url.includes('/products')) return CACHE_TTL.PRODUCTS;
  if (url.includes('/categories')) return CACHE_TTL.CATEGORIES;
  if (url.includes('/branch')) return CACHE_TTL.BRANCHES;
  if (url.includes('/addresses')) return CACHE_TTL.ADDRESSES;
  if (url.includes('/featured')) return CACHE_TTL.FEATURED;

  if (url.includes('/order')) return CACHE_TTL.ORDERS;
  if (url.includes('/update-delivery-statuses')) return CACHE_TTL.DELIVERY_STATUS;
  return CACHE_TTL.DEFAULT;
};

// Check if request is cached and valid
const getCachedRequest = (url: string, params?: any): any | null => {
  const cacheKey = `${url}${params ? JSON.stringify(params) : ''}`;
  const cached = requestCache.get(cacheKey);

  if (cached) {
    const now = Date.now();
    if (now - cached.timestamp < cached.ttl) {
      console.log(`📦 [${url}] Using cached response`);
      return cached.data;
    } else {
      requestCache.delete(cacheKey);
    }
  }
  return null;
};

// Cache successful response
const setCachedRequest = (url: string, data: any, params?: any): void => {
  const cacheKey = `${url}${params ? JSON.stringify(params) : ''}`;
  const ttl = getCacheTTL(url);
  requestCache.set(cacheKey, {
    data,
    timestamp: Date.now(),
    ttl
  });
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 second timeout for mobile networks
});

// Add a request interceptor to include the token and implement caching
api.interceptors.request.use(
  async (config) => {
    try {
      // Skip token check for login, logout, and OTP endpoints (no authentication required)
      const isUnauthenticatedEndpoint = config.url?.includes('/login') ||
        config.url?.includes('/register') ||
        config.url?.includes('/refresh-token') ||
        config.url?.includes('/auth/logout') ||
        config.url?.includes('/otp/');

      if (isUnauthenticatedEndpoint) {
        return config;
      }

      // Check cache first for GET requests (skip for auth and OTP endpoints)
      if (config.method === 'get' && !config.url?.includes('/auth/') && !config.url?.includes('/otp/')) {
        const cachedResponse = getCachedRequest(config.url!, config.params);
        if (cachedResponse) {
          console.log(`📦 [${config.url}] Using cached response`);
          // Return cached response by rejecting with a special error that response interceptor will handle
          const cacheError = new Error('CACHED_RESPONSE') as any;
          cacheError.cachedData = cachedResponse;
          return Promise.reject(cacheError);
        }
      }

      // Check for pending identical requests (deduplication)
      const requestKey = `${config.method}:${config.url}:${JSON.stringify(config.params || {})}`;
      if (pendingRequests.has(requestKey)) {
        console.log(`🔄 [${config.url}] Deduplicating request - using pending request`);
        return pendingRequests.get(requestKey)!;
      }

      // Try to refresh token if needed (don't fail the request if refresh fails)
      const tokenRefreshed = await refreshTokenIfNeeded();
      if (!tokenRefreshed) {
        console.log(`⚠️ [${config.url}] Token refresh failed, but continuing with existing token`);
      }

      const token = await AsyncStorage.getItem('userToken');

      // Check if token is valid and not expired
      if (isValidToken(token) && token && !isTokenExpired(token)) {
        config.headers.Authorization = `Bearer ${token}`;
        console.log(`✅ [${config.url}] Authorization header set successfully`);
      } else {
        console.log(`⚠️ [${config.url}] Token not valid for request`);
        // Don't clear tokens immediately - let the API call fail and handle it in response interceptor
        return Promise.reject(new Error('Token not valid'));
      }

      // Store pending request for deduplication
      const requestPromise = Promise.resolve(config);
      pendingRequests.set(requestKey, requestPromise);

      // Clean up pending request after completion
      requestPromise.finally(() => {
        pendingRequests.delete(requestKey);
      });

    } catch (error) {
      console.error(`❌ [${config.url}] Error in request interceptor:`, error);
      return Promise.reject(error);
    }
    return config;
  },
  (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Add response interceptor for better error handling and caching
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses
    if (response.config.method === 'get' && response.status === 200) {
      setCachedRequest(response.config.url!, response.data, response.config.params);
    }
    return response;
  },
  async (error) => {
    // Handle cached responses
    if (error.message === 'CACHED_RESPONSE') {
      console.log(`📦 [${error.config?.url}] Returning cached response`);
      return Promise.resolve({ data: error.cachedData, status: 200, config: error.config });
    }

    const status = error.response?.status;
    const message = error.response?.data?.message;
    const url = error.config?.url;

    // Handle network errors
    if (!error.response) {
      console.error('❌ Network Error:', error.message);
      const networkError = new Error('Network connection failed. Please check your internet connection.') as any;
      networkError.isNetworkError = true;
      networkError.originalError = error;
      return Promise.reject(networkError);
    }

    // Handle 404 errors gracefully for first-time users
    if (status === 404) {
      const isFirstTimeUser =
        url?.includes('/order/active/user');

      if (isFirstTimeUser) {
        console.log(`ℹ️ [${url}] First-time user - no active orders/subscriptions yet`);
        // Don't log as error, just return a custom error with a friendly flag
        const friendlyError = new Error(message) as any;
        friendlyError.isFirstTimeUser = true;
        friendlyError.status = 404;
        return Promise.reject(friendlyError);
      }
    }

    // Log other errors with more context
    console.error('❌ API Response Error:', {
      status,
      message,
      url,
      method: error.config?.method,
      timestamp: new Date().toISOString()
    });

    // Handle rate limiting errors with retry
    if (status === 429) {
      console.log(`⏳ [${url}] Rate limited, implementing backoff strategy`);

      // Clear any cached responses for rate limited endpoints
      if (url) {
        const cacheKey = `${url}${error.config?.params ? JSON.stringify(error.config.params) : ''}`;
        requestCache.delete(cacheKey);
      }

      // Don't retry for auth endpoints immediately
      if (url?.includes('/auth/')) {
        console.log('🚫 Auth endpoint rate limited, not retrying');
        return Promise.reject(error);
      }

      // Implement exponential backoff for other endpoints
      const retryAfter = error.response?.headers?.['retry-after'] || 5;
      const delay = Math.min(parseInt(retryAfter) * 1000, 30000); // Max 30 seconds

      console.log(`⏳ Retrying ${url} after ${delay}ms`);
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          api.request(error.config)
            .then(resolve)
            .catch(reject);
        }, delay);
      });
    }

    // Handle authentication errors with better logic to prevent auto-logout
    if (status === 401) {
      console.log(`🚫 [${url}] Authentication failed:`, message);

      // Only clear tokens for specific auth failures that indicate session is truly expired
      const isSessionExpired = message?.includes('Token expired') ||
        message?.includes('Invalid token') ||
        message?.includes('Token revoked') ||
        message?.includes('Refresh token expired');

      if (isSessionExpired) {
        console.log('🔐 Session expired, clearing tokens');

        try {
          // Clear stored tokens on actual session expiry
          await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole']);

          // Reset auth state
          authState = {
            isRefreshing: false,
            refreshPromise: null,
            lastRefreshTime: 0,
            consecutiveFailures: 0,
          };

          // Clear all caches
          requestCache.clear();
          pendingRequests.clear();

          // Show alert to user (only if not already showing)
          if (!global.sessionExpiredAlertShown) {
            global.sessionExpiredAlertShown = true;
            Alert.alert(
              'Session Expired',
              'Your session has expired. Please login again.',
              [
                {
                  text: 'OK',
                  onPress: () => {
                    global.sessionExpiredAlertShown = false;
                    console.log('User notified of session expiry');
                  }
                }
              ]
            );
          }
        } catch (clearError) {
          console.error('❌ Error clearing tokens on auth failure:', clearError);
        }
      } else {
        console.log('⚠️ Authentication failed but not clearing tokens:', message);
        // Don't clear tokens for other 401 errors (network issues, temporary server problems, etc.)
      }
    }

    // Handle server errors (5xx)
    if (status >= 500) {
      console.error(`🔥 Server Error [${status}]:`, message);
      const serverError = new Error('Server is temporarily unavailable. Please try again later.') as any;
      serverError.isServerError = true;
      serverError.status = status;
      serverError.originalMessage = message;
      return Promise.reject(serverError);
    }

    // Handle client errors (4xx) with user-friendly messages
    if (status >= 400 && status < 500) {
      const clientError = new Error(message || 'Request failed. Please check your input and try again.') as any;
      clientError.isClientError = true;
      clientError.status = status;
      return Promise.reject(clientError);
    }

    return Promise.reject(error);
  }
);

// Declare global flags
declare global {
  var sessionExpiredAlertShown: boolean;
  var logoutInProgress: boolean;
}

// Address Routes
export const addAddress = (addressData: any) => api.post('/addresses', addressData);
export const getAddresses = async () => {
  // userId is now retrieved from JWT token in backend
  return api.get('/addresses');
};
export const updateAddress = (addressId: string, addressData: any) => api.put(`/addresses/${addressId}`, addressData);
export const deleteAddress = (addressId: string) => api.delete(`/addresses/${addressId}`);
export const getAddressById = (addressId: string) => api.get(`/addresses/${addressId}`);

// Auth Routes
export const customerLogin = async (credentials: any) => {
  try {
    // Clear any existing tokens first
    await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole']);

    const response = await api.post('/customer/login', credentials);

    // Validate response structure
    if (response.data?.accessToken && response.data?.refreshToken) {
      const { accessToken, refreshToken, customer } = response.data;

      console.log('✅ Customer login successful');

      // Store tokens securely with timestamp
      await AsyncStorage.setItem('userToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('tokenTimestamp', Date.now().toString());
      await AsyncStorage.setItem('userId', customer?._id || '');
      await AsyncStorage.setItem('userRole', 'Customer');
      await AsyncStorage.setItem('isSubscription', customer?.isSubscription?.toString() || 'false');

      console.log('✅ Customer tokens stored successfully');

      return response;
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (error) {
    console.error('❌ Customer login error:', error);

    // Clear any partial tokens on error
    await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp']);

    throw error;
  }
};

export const deliveryLogin = async (credentials: any) => {
  try {
    // Clear any existing tokens first
    await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole']);

    const response = await api.post('/delivery/login', credentials);

    // Validate response structure
    if (response.data?.accessToken && response.data?.refreshToken) {
      const { accessToken, refreshToken, deliveryPartner } = response.data;

      console.log('✅ Delivery partner login successful');

      // Store tokens securely with timestamp
      await AsyncStorage.setItem('userToken', accessToken);
      await AsyncStorage.setItem('refreshToken', refreshToken);
      await AsyncStorage.setItem('tokenTimestamp', Date.now().toString());
      await AsyncStorage.setItem('userId', deliveryPartner?._id || '');
      await AsyncStorage.setItem('userRole', 'DeliveryPartner');

      console.log('✅ Delivery partner tokens stored successfully');

      return response;
    } else {
      throw new Error('Invalid response structure');
    }
  } catch (error) {
    console.error('❌ Delivery login error:', error);

    // Clear any partial tokens on error
    await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp']);

    throw error;
  }
};
export const refreshToken = () => api.post('/auth/refresh-token');
export const logout = async () => {
  try {
    console.log('🚪 Starting logout process...');

    // Set global logout flag FIRST to prevent any new API calls
    global.logoutInProgress = true;
    global.sessionExpiredAlertShown = false; // Reset alert flag
    console.log('🚫 Set global logout flag to stop all intervals and API calls');

    // Get refresh token for server-side logout
    const refreshToken = await AsyncStorage.getItem('refreshToken');

    // Clear local storage first to prevent token issues
    await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole', 'isSubscription']);
    console.log('🗑️ Cleared local storage on logout');

    // Clear all caches and pending requests
    requestCache.clear();
    pendingRequests.clear();
    console.log('🧹 Cleared all API caches and pending requests');

    // Reset authentication state
    authState = {
      isRefreshing: false,
      refreshPromise: null,
      lastRefreshTime: 0,
      consecutiveFailures: 0,
    };
    console.log('🔄 Reset authentication state');

    // Try server-side logout if we have a refresh token
    // Use a direct axios call to bypass the request interceptor
    if (refreshToken) {
      try {
        await axios.post(`${API_BASE_URL}/auth/logout`, { refreshToken }, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000 // Shorter timeout for logout
        });
        console.log('✅ Server logout successful');
      } catch (serverError) {
        console.warn('⚠️ Server logout failed, but local logout successful');
      }
    }

    // Give a small delay to ensure all contexts see the logout flag
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('🚪 Logout completed successfully');
    return { success: true, message: 'Logged out successfully' };
  } catch (error) {
    console.error('❌ Logout error:', error);
    // Even if API call fails, ensure local data is cleared
    try {
      global.logoutInProgress = true;
      global.sessionExpiredAlertShown = false;
      await AsyncStorage.multiRemove(['userToken', 'refreshToken', 'tokenTimestamp', 'userId', 'userRole', 'isSubscription']);
      requestCache.clear();
      pendingRequests.clear();
    } catch (clearError) {
      console.error('❌ Failed to clear data during logout error:', clearError);
    }
    throw error;
  }
};
export const fetchUser = () => api.get('/user');
export const updateUser = (userData: any) => api.put('/user/', userData);
export const getProfile = () => api.get('/user/profile');
export const updateProfile = (profileData: any) => api.put('/user/profile', profileData);

// Order Routes
export const createOrder = (orderData: any) => api.post('/order', orderData);

// Create Razorpay order for payment
export const createPaymentOrder = (orderData: any) => api.post('/create-order', orderData);

export const getDeliveryPartnerById = (id: string) => api.get(`/delivery-partner/${id}`);

// Get orders with optional filtering
export const getOrders = (params: { customerId?: string; status?: string | string[]; deliveryPartnerId?: string; branchId?: string }) => {
  const queryParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      if (Array.isArray(value)) {
        // Handle array values by joining with comma
        queryParams.append(key, value.join(','));
      } else {
        queryParams.append(key, value);
      }
    }
  });

  const queryString = queryParams.toString();
  return api.get(`/order?${queryString}`);
};

// New separate API functions for delivery partner orders
export const getAvailableOrders = (branchId: string) =>
  api.get(`/order/available/${branchId}`);

export const getCurrentOrders = (deliveryPartnerId: string) =>
  api.get(`/order/current/${deliveryPartnerId}`);

export const getHistoryOrders = (deliveryPartnerId: string) =>
  api.get(`/order/history/${deliveryPartnerId}`);
export const getOrderById = (orderId: string) => api.get(`/order/${orderId}`);
export const getActiveOrderForUser = () => api.get('/order/active/user');
export const getMyOrderHistory = () => api.get('/orders/my-history');
export const confirmOrder = (orderId: string, data: any) => api.post(`/order/${orderId}/confirm`, data);

// New order status flow functions
export const acceptOrder = (orderId: string, deliveryPartnerId: string) =>
  api.post(`/order/${orderId}/accept`, { deliveryPartnerId });

export const pickupOrder = (orderId: string, deliveryPartnerId: string, pickupLocation?: any) =>
  api.post(`/order/${orderId}/pickup`, { deliveryPartnerId, pickupLocation });

export const markOrderAsDelivered = (orderId: string, deliveryPartnerId: string, deliveryLocation: any) =>
  api.post(`/order/${orderId}/mark-delivered`, { deliveryPartnerId, deliveryLocation });

export const updateDeliveryPartnerLocation = (orderId: string, deliveryPartnerId: string, location: any) =>
  api.patch(`/order/${orderId}/location`, { deliveryPartnerId, location });

export const updateOrderStatus = (orderId: string, statusData: any) => api.patch(`/order/${orderId}/status`, statusData);
export const deleteAppOrder = (orderId: string) => api.delete(`/orders/${orderId}`);
export const getOrderTrackingInfo = (orderId: string) => api.get(`/order/${orderId}/tracking`);
export const confirmDeliveryReceipt = (orderId: string) => api.patch(`/order/${orderId}/confirm-receipt`); // New API call

// Cancel order
export const cancelOrder = (orderId: string, reason: string) => 
  api.post(`/order/${orderId}/cancel`, { reason, cancelledBy: 'customer' });

// Google Maps Directions API
export const getGoogleMapsDirections = (orderId: string, origin: any, destination: any, routeType?: string, updateOrder?: boolean) =>
  api.post(`/order/${orderId}/google-directions`, { origin, destination, routeType, updateOrder });

// Branch Routes
export const getAllBranches = () => api.get('/branch');
export const getBranchById = (branchId: string) => api.get(`/branch/${branchId}`);

// Payment Routes
export const verifyPayment = (paymentData: any) => api.post('/verify-payment', paymentData);

// Product Routes
export const getAllProducts = (params?: any) => api.get('/products', { params });
export const getProductByCategoryId = (categoryId: string, params?: any) => api.get(`/products/${categoryId}`, { params });
export const getProductById = (productId: string) => api.get(`/product/${productId}`);
export const getAllCategories = () => api.get('/categories');

// Search and Filter Routes
export const searchProducts = (params?: any) => api.get('/search', { params });
export const getAllTags = () => api.get('/tags');
export const getAllBrands = () => api.get('/brands');

// Special Product Collections
export const getFeaturedProducts = (params?: any) => api.get('/featured', { params });

// Product Details and Variants
export const getRelatedProducts = (productId: string, params?: any) => api.get(`/product/${productId}/related`, { params });
export const getProductVariants = (productId: string) => api.get(`/product/${productId}/variants`);
export const getProductsByIds = (productIds: string[]) => api.post('/products/by-ids', { ids: productIds });

// OTP Routes (MSG91)
export const sendOTP = (phoneNumber: string) => api.post('/otp/send', { phoneNumber });
export const verifyOTP = (phoneNumber: string, otp: string) => api.post('/otp/verify', { phoneNumber, otp });
export const resendOTP = (phoneNumber: string) => api.post('/otp/resend', { phoneNumber });


