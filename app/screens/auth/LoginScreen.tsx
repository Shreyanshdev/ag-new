import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { customerLogin, deliveryLogin, sendOTP, verifyOTP, resendOTP } from '../../../src/config/api';
import { useRouter } from 'expo-router';
import OtpInput from '../../components/auth/OtpInput';

const LoginScreen = () => {
  const router = useRouter();

  // --- All original state and login logic is preserved ---
  const [loginType, setLoginType] = useState<'customer' | 'delivery'>('customer');
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // OTP verification states
  const [showOtpInput, setShowOtpInput] = useState<boolean>(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpSent, setOtpSent] = useState<boolean>(false);

  const handleSendOtp = async () => {
    setError(null);
    setOtpError(null);

    if (!phoneNumber || phoneNumber.length !== 10 || !/^\d+$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    // Ensure phone number starts with valid digit for India
    const validStarts = ['6', '7', '8', '9'];
    if (!validStarts.includes(phoneNumber.charAt(0))) {
      setError('Please enter a valid Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    setLoading(true);

    try {
      // Send OTP via MSG91 API
      console.log('📱 Sending OTP via MSG91...');
      const response = await sendOTP(phoneNumber);

      if (response.data?.success) {
        setShowOtpInput(true);
        setOtpSent(true);
        console.log('✅ OTP sent successfully via MSG91');
      } else {
        throw new Error(response.data?.message || 'Failed to send OTP');
      }

    } catch (error: any) {
      console.error('❌ Error sending OTP:', error);
      setError(error.response?.data?.message || error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpVerify = async (otp: string): Promise<boolean> => {
    if (!otpSent) {
      setOtpError('Please request OTP first.');
      return false;
    }

    setOtpError(null);

    try {
      // Verify OTP with backend (which uses MSG91)
      console.log('🔐 Verifying OTP with backend...');
      const response = await verifyOTP(phoneNumber, otp);

      if (response.data?.success) {
        console.log('✅ OTP verified successfully');

        // OTP verified, now login with backend
        const payload = { phone: phoneNumber, otp: otp };
        const loginResponse = await customerLogin(payload);

        if (loginResponse.status === 200) {
          console.log('✅ Customer login successful');

          // Navigate to home
          router.replace('/');
          return true;
        } else {
          setOtpError(loginResponse.data?.message || 'Login failed. Please check your credentials.');
          return false;
        }
      } else {
        setOtpError(response.data?.message || 'Invalid OTP. Please try again.');
        return false;
      }
    } catch (error: any) {
      console.error('❌ OTP verification error:', error);
      setOtpError(error.response?.data?.message || error.message || 'Invalid OTP. Please try again.');
      return false;
    }
  };

  const handleResendOtp = async () => {
    setOtpError(null);
    setOtpSent(false);

    if (!phoneNumber || phoneNumber.length !== 10 || !/^\d+$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number.');
      return;
    }

    setLoading(true);

    try {
      // Resend OTP via MSG91 API
      console.log('📱 Resending OTP via MSG91...');
      const response = await resendOTP(phoneNumber);

      if (response.data?.success) {
        setOtpSent(true);
        console.log('✅ OTP resent successfully via MSG91');
      } else {
        throw new Error(response.data?.message || 'Failed to resend OTP');
      }

    } catch (error: any) {
      console.error('❌ Error resending OTP:', error);
      setError(error.response?.data?.message || error.message || 'Failed to resend OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    if (loginType === 'customer') {
      await handleSendOtp();
    } else {
      // Delivery partner login (existing logic)
      setError(null);
      setLoading(true);

      if (!email || !password) {
        setError('Please enter both email and password.');
        setLoading(false);
        return;
      }
      if (!/\S+@\S+\.\S+/.test(email)) {
        setError('Please enter a valid email address.');
        setLoading(false);
        return;
      }

      try {
        const response = await deliveryLogin({ email, password });
        const data = response.data;

        if (response.status === 200) {
          console.log('✅ Delivery partner login successful');
          router.replace('/screens/deliveryPartner/DeliveryOrderScreen');
          return;
        } else {
          setError(data.message || 'Login failed. Please check your credentials.');
        }
      } catch (e) {
        console.error('Network or unexpected error:', e);
        setError('Could not connect to the server. Please check your internet connection.');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />

      <KeyboardAvoidingView
        style={styles.keyboardAvoidingView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            {/* Brand Logo */}
            <View style={styles.brandContainer}>
              <View style={styles.logoWrapper}>
                <MaterialCommunityIcons name="store" size={48} color="#10b981" />
              </View>
              <Text style={styles.brandName}>AgStore</Text>
              <Text style={styles.brandTagline}>Your Daily Essentials Store</Text>
            </View>

            {/* Welcome Message */}
            <View style={styles.welcomeSection}>
              <Text style={styles.welcomeTitle}>Welcome Back!</Text>
              <Text style={styles.welcomeSubtitle}>
                {loginType === 'customer'
                  ? 'Get your daily essentials delivered to your doorstep'
                  : 'Ready to serve our valued customers'
                }
              </Text>
            </View>
          </View>

          {/* Login Form */}
          <View style={styles.formSection}>
            {/* User Type Selection */}
            <View style={styles.userTypeSection}>
              <Text style={styles.sectionLabel}>Login as</Text>
              <View style={styles.toggleContainer}>
                <TouchableOpacity
                  style={[styles.toggleButton, loginType === 'customer' && styles.toggleButtonActive]}
                  onPress={() => setLoginType('customer')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="account"
                    size={20}
                    color={loginType === 'customer' ? '#ffffff' : '#6b7280'}
                  />
                  <Text style={[styles.toggleButtonText, loginType === 'customer' && styles.toggleButtonTextActive]}>
                    Customer
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.toggleButton, loginType === 'delivery' && styles.toggleButtonActive]}
                  onPress={() => setLoginType('delivery')}
                  activeOpacity={0.7}
                >
                  <MaterialCommunityIcons
                    name="truck-delivery"
                    size={20}
                    color={loginType === 'delivery' ? '#ffffff' : '#6b7280'}
                  />
                  <Text style={[styles.toggleButtonText, loginType === 'delivery' && styles.toggleButtonTextActive]}>
                    Delivery Partner
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Input Fields */}
            <View style={styles.inputSection}>
              {loginType === 'customer' ? (
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mobile Number</Text>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputIconWrapper}>
                      <Feather name="smartphone" size={20} color="#6b7280" />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      placeholder="Enter your 10-digit mobile number"
                      placeholderTextColor="#9ca3af"
                      keyboardType="phone-pad"
                      value={phoneNumber}
                      onChangeText={setPhoneNumber}
                      maxLength={10}
                    />
                  </View>
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Email Address</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.inputIconWrapper}>
                        <Feather name="mail" size={20} color="#6b7280" />
                      </View>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your email address"
                        placeholderTextColor="#9ca3af"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        value={email}
                        onChangeText={setEmail}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Password</Text>
                    <View style={styles.inputContainer}>
                      <View style={styles.inputIconWrapper}>
                        <Feather name="lock" size={20} color="#6b7280" />
                      </View>
                      <TextInput
                        style={styles.textInput}
                        placeholder="Enter your password"
                        placeholderTextColor="#9ca3af"
                        secureTextEntry
                        value={password}
                        onChangeText={setPassword}
                      />
                    </View>
                  </View>
                </>
              )}
            </View>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <MaterialCommunityIcons name="alert-circle-outline" size={18} color="#ef4444" />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {/* OTP Input for Customer */}
            {showOtpInput && loginType === 'customer' && (
              <View style={styles.otpSection}>
                <OtpInput
                  phoneNumber={phoneNumber}
                  onOtpVerify={handleOtpVerify}
                  onResendOtp={handleResendOtp}
                  loading={loading}
                  error={otpError}
                />
                <TouchableOpacity
                  style={styles.backToLoginButton}
                  onPress={() => {
                    setShowOtpInput(false);
                    setOtpError(null);
                    setOtpSent(false);
                  }}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Login Button */}
            {!showOtpInput && (
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" size="small" />
                ) : (
                  <>
                    <Text style={styles.loginButtonText}>
                      {loginType === 'customer' ? 'Send OTP' : 'Sign In'}
                    </Text>
                    <Feather name="arrow-right" size={18} color="#ffffff" />
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          {/* Footer */}
          <View style={styles.footerSection}>
            <View style={styles.featuresContainer}>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="truck-fast" size={24} color="#10b981" />
                <Text style={styles.featureText}>Fast Delivery</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="shield-check" size={24} color="#10b981" />
                <Text style={styles.featureText}>Quality Products</Text>
              </View>
              <View style={styles.featureItem}>
                <MaterialCommunityIcons name="cash-multiple" size={24} color="#10b981" />
                <Text style={styles.featureText}>Best Prices</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 30,
  },

  // Header Section
  headerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoWrapper: {
    backgroundColor: '#f0fdf4',
    width: 90,
    height: 90,
    borderRadius: 45,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: '#dcfce7',
  },
  brandName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#111827',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  brandTagline: {
    fontSize: 16,
    color: '#6b7280',
    fontWeight: '500',
  },
  welcomeSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 24,
  },

  // Form Section
  formSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  userTypeSection: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  toggleButtonActive: {
    backgroundColor: '#10b981',
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6b7280',
  },
  toggleButtonTextActive: {
    color: '#ffffff',
  },

  // Input Section
  inputSection: {
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    minHeight: 52,
  },
  inputIconWrapper: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    paddingRight: 16,
    paddingVertical: 14,
  },

  // Error Section
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#fecaca',
    gap: 8,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },

  // OTP Section
  otpSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },

  // Back to Login Button
  backToLoginButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
  },
  backToLoginText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '600',
  },

  // Login Button
  loginButton: {
    backgroundColor: '#10b981',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  loginButtonDisabled: {
    backgroundColor: '#9ca3af',
    shadowOpacity: 0.1,
    elevation: 2,
  },
  loginButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },

  // Footer Section
  footerSection: {
    alignItems: 'center',
  },
  featuresContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingHorizontal: 20,
  },
  featureItem: {
    alignItems: 'center',
    flex: 1,
  },
  featureText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
});

export default LoginScreen;