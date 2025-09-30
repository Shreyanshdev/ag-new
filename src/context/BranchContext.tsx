import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getAllBranches } from '../config/api';

export type Branch = {
  _id: string;
  name: string;
  address: string;
  phone?: string;
  location: {
    latitude: number;
    longitude: number;
  };
};

type BranchContextType = {
  selectedBranch: Branch | null;
  setSelectedBranch: (branch: Branch | null) => void;
  branches: Branch[];
  loading: boolean;
  error: string | null;
  nearestBranch: Branch | null;
  isBranchAvailable: boolean;
  branchDistance: number | null;
  fetchBranches: () => Promise<void>;
  findNearestBranchForAddress: (addressLat: number, addressLng: number) => Promise<Branch | null>;
  checkBranchAvailability: (addressLat: number, addressLng: number) => Promise<boolean>;
  clearError: () => void;
  // Add function to manually trigger branch availability check
  refreshBranchAvailability: () => Promise<void>;
  // Add function to refresh branch availability for a specific address
  refreshBranchAvailabilityForAddress: (address: any) => Promise<void>;
  clearBranches: () => void;
};

const BranchContext = createContext<BranchContextType | undefined>(undefined);

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nearestBranch, setNearestBranch] = useState<Branch | null>(null);
  const [isBranchAvailable, setIsBranchAvailable] = useState(false);
  const [branchDistance, setBranchDistance] = useState<number | null>(null);
  const [currentAddressCoords, setCurrentAddressCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = useCallback((lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth's radius in kilometers
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }, []);

  // Fetch all branches
  const fetchBranches = useCallback(async () => {
    // Don't fetch branches if logout is in progress
    if (global.logoutInProgress) {
      console.log('🚫 Logout in progress, skipping branch fetch');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await getAllBranches();
      if (response?.data) {
        console.log('🔍 BranchContext - Raw branch data:', response.data);
        console.log('🔍 BranchContext - First branch _id:', response.data[0]?._id);
        setBranches(response.data);
      }
    } catch (err: any) {
      // Don't show errors during logout or if no auth token
      if (!global.logoutInProgress && err?.type !== 'auth') {
        console.error('Error fetching branches:', err);
        setError('Failed to load branches');
      } else {
        console.log('🚫 Skipping branch error during logout/auth issue');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Find nearest branch for a given address
  const findNearestBranchForAddress = useCallback(async (addressLat: number, addressLng: number): Promise<Branch | null> => {
    try {
      if (branches.length === 0) {
        await fetchBranches();
      }

      let nearest: Branch | null = null;
      let minDistance = Infinity;

      for (const branch of branches) {
        if (branch.location?.latitude && branch.location?.longitude) {
          const distance = calculateDistance(
            addressLat,
            addressLng,
            branch.location.latitude,
            branch.location.longitude
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            nearest = branch;
          }
        }
      }

      if (nearest && minDistance <= 30) {
        setNearestBranch(nearest);
        setBranchDistance(minDistance);
        // Always update to the nearest branch when address changes
        console.log('🌿 BranchContext: Setting nearest branch as selected:', nearest.name);
        setSelectedBranch(nearest);
        return nearest;
      }

      // Clear selected branch if no branch is available within 30km
      console.log('🌿 BranchContext: No branch available within 30km, clearing selection');
      setNearestBranch(null);
      setBranchDistance(null);
      setSelectedBranch(null);
      return null;
    } catch (err) {
      console.error('Error finding nearest branch:', err);
      return null;
    }
  }, [branches, calculateDistance, fetchBranches]);

  // Check if any branch is available within 30km of the address
  const checkBranchAvailability = useCallback(async (addressLat: number, addressLng: number): Promise<boolean> => {
    // Don't check branch availability if logout is in progress
    if (global.logoutInProgress) {
      console.log('🚫 Logout in progress, skipping branch availability check');
      return false;
    }

    try {
      console.log('🌿 BranchContext: Checking branch availability...', { lat: addressLat, lng: addressLng });
      
      // Always fetch fresh branch data to ensure we have the latest information
      await fetchBranches();
      
      const nearest = await findNearestBranchForAddress(addressLat, addressLng);
      const available = nearest !== null;
      
      console.log('🌿 BranchContext: Branch availability result:', { 
        available, 
        nearestBranch: nearest?.name || 'None',
        distance: nearest ? calculateDistance(addressLat, addressLng, nearest.location.latitude, nearest.location.longitude) : 'N/A'
      });
      
      setIsBranchAvailable(available);
      return available;
    } catch (err: any) {
      // Don't show errors during logout or if no auth token
      if (!global.logoutInProgress && err?.type !== 'auth') {
        console.error('Error checking branch availability:', err);
      } else {
        console.log('🚫 Skipping branch availability error during logout/auth issue');
      }
      setIsBranchAvailable(false);
      return false;
    }
  }, [findNearestBranchForAddress, fetchBranches, calculateDistance]);

  // Function to manually refresh branch availability
  const refreshBranchAvailability = useCallback(async () => {
    if (currentAddressCoords) {
      await checkBranchAvailability(currentAddressCoords.lat, currentAddressCoords.lng);
    }
  }, [currentAddressCoords, checkBranchAvailability]);

  // Function to refresh branch availability for a specific address
  const refreshBranchAvailabilityForAddress = useCallback(async (address: any) => {
    if (address && address.latitude && address.longitude) {
      console.log('🌿 BranchContext: Refreshing branch availability for specific address:', address.addressLine1);
      await checkBranchAvailability(address.latitude, address.longitude);
    } else {
      console.log('🌿 BranchContext: Invalid address provided for branch availability refresh');
    }
  }, [checkBranchAvailability]);

  // Load branches on mount
  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  // Function to handle address changes
  const handleAddressChange = useCallback((address: any) => {
    if (address && address.latitude && address.longitude) {
      const newCoords = { lat: address.latitude, lng: address.longitude };
      
      // Always refresh branch availability, even for the same address
      console.log('🌿 BranchContext: Address changed, refreshing branch availability...', {
        address: address.addressLine1 || 'Unknown',
        lat: address.latitude,
        lng: address.longitude,
        isDefault: address.isDefault || false
      });
      
      setCurrentAddressCoords(newCoords);
      checkBranchAvailability(address.latitude, address.longitude);
    } else {
      console.log('🌿 BranchContext: Address change received but no valid coordinates, clearing branch availability');
      setCurrentAddressCoords(null);
      setIsBranchAvailable(false);
      setNearestBranch(null);
      setBranchDistance(null);
    }
  }, [checkBranchAvailability]);

  // Expose the address change handler to be called from AddressContext
  useEffect(() => {
    // This will be called by AddressContext when it mounts
    if (typeof window !== 'undefined') {
      (window as any).__BRANCH_CONTEXT_HANDLER__ = handleAddressChange;
    }
  }, [handleAddressChange]);

  const clearError = () => {
    setError(null);
  };

  const clearBranches = () => {
    setSelectedBranch(null);
    setNearestBranch(null);
    setBranches([]);
    setIsBranchAvailable(false);
    setBranchDistance(null);
    setCurrentAddressCoords(null);
  };

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      setSelectedBranch,
      branches,
      loading,
      error,
      nearestBranch,
      isBranchAvailable,
      branchDistance,
      fetchBranches,
      findNearestBranchForAddress,
      checkBranchAvailability,
      clearError,
      refreshBranchAvailability,
      refreshBranchAvailabilityForAddress,
      clearBranches,
    }}>
      {children}
    </BranchContext.Provider>
  );
};

export const useBranch = () => {
  const context = useContext(BranchContext);
  if (!context) throw new Error("useBranch must be used within a BranchProvider");
  return context;
};
