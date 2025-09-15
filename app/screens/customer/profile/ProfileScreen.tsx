import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";

import { getProfile, updateProfile, logout as logoutApi } from "../../../../src/config/api";
import { Address } from "../../../../types/types";
import { useAddressStore } from "../../../../src/store/addressStore";
import { useCart } from "../../../../src/context/CartContext";
import { useBranch } from "../../../../src/context/BranchContext";


const ProfileScreen = () => {
  const navigation = useNavigation();
  const router = useRouter();
  const { addresses, setDefaultAddress } = useAddressStore();
  const { clearCart } = useCart();
  const { clearBranches } = useBranch();
  

  // State for user data
  const [profile, setProfile] = useState<any>(null);
  const [isAddressModalVisible, setAddressModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);

  // Form state for edits
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const fetchUserProfile = useCallback(async () => {
    try {
      const resp = await getProfile();
      if (resp?.data) {
        const data = resp.data;
        setProfile(data);
        setName(data.name || "");
        setEmail(data.email || "");
      } else {
        Alert.alert("Error", "Failed to fetch profile data");
      }
    } catch (error) {
      console.error("Fetch profile error:", error);
      Alert.alert("Error", "Failed to fetch profile data");
    }
  }, []);

  const defaultAddress = addresses.find((addr: Address) => addr.isDefault) || null;

  useEffect(() => {
    setLoading(true);
    fetchUserProfile().finally(() => setLoading(false));
  }, [fetchUserProfile]);

  // Save updated profile
  async function saveProfile() {
    if (name.trim() === "") {
      Alert.alert("Validation Error", "Name cannot be empty");
      return;
    }

    try {
      setLoading(true);
      const resp = await updateProfile({ name, email });

      if (resp.status === 200 || resp.status === 201) {
        Alert.alert("Success", "Profile updated successfully");
        setIsEditing(false);
        await fetchUserProfile();
      } else {
        Alert.alert("Error", resp.data?.message || "Failed to update profile");
      }
    } catch (error) {
      console.error("Update profile error:", error);
      Alert.alert("Error", "Failed to update profile");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefaultAddress(address: Address) {
    try {
      await setDefaultAddress(address._id);
      setAddressModalVisible(false);
      Alert.alert("Success", "Default address updated successfully");
    } catch (error) {
      console.error("Set default address error:", error);
      Alert.alert("Error", "Failed to update default address");
    }
  }

  // Logout handler
  async function handleLogout() {
    try {
      console.log('🚪 Starting user logout...');
      await logoutApi();
      console.log('✅ API logout successful');
    } catch (error) {
      console.error('⚠️ Logout API error:', error);
      // Continue with logout even if API fails
    }

    // Clear all context data
    console.log('🧹 Clearing context data...');
    clearCart();
    clearBranches();
    

    // Note: AsyncStorage is already cleared by logoutApi(), no need to clear again

    // Navigate to login screen using expo-router
    console.log('🔄 Redirecting to login screen...');
    router.replace('/screens/auth/LoginScreen');
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#22c55e" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
      </View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContentContainer}
        keyboardShouldPersistTaps="handled"
      >
        {/* Personal Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>
          
          {/* Profile Avatar */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <MaterialCommunityIcons name="account" size={32} color="#22c55e" />
            </View>
            <Text style={styles.userName}>{profile?.name || "User"}</Text>
          </View>

          {/* Form Fields */}
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="account-outline" size={24} color="#22c55e" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Full Name</Text>
              {isEditing ? (
                <TextInput
                  style={styles.detailInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  returnKeyType="done"
                />
              ) : (
                <Text style={styles.detailValue}>{name || "Not provided"}</Text>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="email-outline" size={24} color="#22c55e" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Email Address</Text>
              {isEditing ? (
                <TextInput
                  style={styles.detailInput}
                  value={email || ""}
                  onChangeText={setEmail}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  returnKeyType="done"
                />
              ) : (
                <Text style={styles.detailValue}>{email || "Not provided"}</Text>
              )}
            </View>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="phone-outline" size={24} color="#22c55e" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Phone Number</Text>
              <Text style={styles.detailValue}>{profile?.phone || "Not provided"}</Text>
            </View>
          </View>

          {/* Action Buttons */}
          {!isEditing ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => setIsEditing(true)}>
              <Text style={styles.actionButtonText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.saveButton} onPress={saveProfile}>
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => {
                  setIsEditing(false);
                  setName(profile?.name || "");
                  setEmail(profile?.email || "");
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <View style={styles.divider} />

        

        <View style={styles.divider} />

        {/* Delivery Address Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Address</Text>
          
          {defaultAddress ? (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="home" size={24} color="#22c55e" />
              <View style={styles.detailTextContainer}>
                <Text style={styles.detailLabel}>Default Address</Text>
                <Text style={styles.detailValue} numberOfLines={2}>
                  {defaultAddress.addressLine1}, {defaultAddress.city}, {defaultAddress.state} - {defaultAddress.zipCode}
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyStateContainer}>
              <MaterialCommunityIcons name="map-marker-off" size={48} color="#6b7280" />
              <Text style={styles.emptyStateText}>No default address set</Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => setAddressModalVisible(true)}
            >
              <Text style={styles.secondaryButtonText}>Change Address</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => (navigation as any).navigate("screens/customer/profile/AddressScreen")}
            >
              <Text style={styles.secondaryButtonText}>Manage Addresses</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => (navigation as any).navigate("screens/customer/orders/OrderHistoryScreen")}
          >
            <MaterialCommunityIcons name="history" size={24} color="#22c55e" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Order History</Text>
              <Text style={styles.detailValue}>View your past orders</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>

          

          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => (navigation as any).navigate("screens/customer/profile/AddressScreen")}
          >
            <MaterialCommunityIcons name="map-marker-multiple" size={24} color="#22c55e" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Addresses</Text>
              <Text style={styles.detailValue}>Manage delivery addresses</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.detailRow}
            onPress={() => console.log('Support pressed')}
          >
            <MaterialCommunityIcons name="help-circle" size={24} color="#22c55e" />
            <View style={styles.detailTextContainer}>
              <Text style={styles.detailLabel}>Support</Text>
              <Text style={styles.detailValue}>Get help and support</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Fixed Footer with Logout */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <MaterialCommunityIcons name="logout" size={20} color="#fff" />
          <Text style={styles.logoutButtonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Address Selection Modal */}
      <Modal
        visible={isAddressModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAddressModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Default Address</Text>
            <FlatList
              data={addresses}
              keyExtractor={(item) => item._id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.addressOption}
                  onPress={() => handleSetDefaultAddress(item)}
                >
                  <Text style={styles.modalAddressText}>
                    {item.addressLine1}, {item.city}, {item.state} - {item.zipCode}
                  </Text>
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setAddressModalVisible(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#ffffff'
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    backgroundColor: '#ffffff',
  },
  backButton: {
    marginRight: 16
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1f2937'
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#f9fafb'
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 100
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  divider: {
    height: 12,
    backgroundColor: '#f9fafb'
  },
  
  // Avatar styles
  avatarContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#d1fae5",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#22c55e",
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1f2937",
  },

  // Detail row styles (matching subscription calendar theme)
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  detailTextContainer: {
    flex: 1,
    marginLeft: 12
  },
  detailLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937'
  },
  detailInput: {
    fontSize: 14,
    color: '#1f2937',
    padding: 0,
    margin: 0,
  },

  // Status badge
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },

  // Button styles (matching subscription calendar theme)
  actionButton: {
    backgroundColor: '#22c55e',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: '#ffffff',
    fontWeight: '600',
    fontSize: 16
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#22c55e",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  saveButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: "#ef4444",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#22c55e",
  },
  secondaryButtonText: {
    color: "#22c55e",
    fontWeight: "600",
    fontSize: 14,
  },

  // Empty state
  emptyStateContainer: {
    alignItems: 'center',
    paddingVertical: 24
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center'
  },

  // Footer
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingBottom: 34,
  },
  logoutButton: {
    backgroundColor: "#ef4444",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  logoutButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
    marginLeft: 8,
  },

  // Modal styles (matching subscription calendar theme)
  modalContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 24,
    width: "90%",
    maxHeight: "80%",
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 20,
    textAlign: "center",
    color: "#1f2937",
  },
  addressOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    borderRadius: 8,
    marginBottom: 8,
  },
  modalAddressText: {
    fontSize: 16,
    color: "#1f2937",
    fontWeight: '500',
  },
  closeButton: {
    marginTop: 20,
    backgroundColor: "#22c55e",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  closeButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
});

export default ProfileScreen;
