import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface OtpInputProps {
  onOtpVerify: (otp: string) => Promise<boolean>;
  onResendOtp?: () => Promise<void>;
  phoneNumber: string;
  loading?: boolean;
  error?: string | null;
}

const OtpInput: React.FC<OtpInputProps> = ({
  onOtpVerify,
  onResendOtp,
  phoneNumber,
  loading = false,
  error = null,
}) => {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [verifying, setVerifying] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(true);
  const [countdown, setCountdown] = useState(30);

  const inputRefs = useRef<(TextInput | null)[]>([]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setResendDisabled(false);
    }
  }, [countdown]);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
      setFocusedIndex(index + 1);
    }

    // Auto-verify when all digits are entered
    if (newOtp.every(digit => digit !== '') && !verifying) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && index > 0 && !otp[index]) {
      // Move to previous input on backspace if current is empty
      inputRefs.current[index - 1]?.focus();
      setFocusedIndex(index - 1);
    }
  };

  const handleVerifyOtp = async (otpValue: string) => {
    if (otpValue.length !== 6) return;

    setVerifying(true);
    try {
      const success = await onOtpVerify(otpValue);
      if (!success) {
        // Clear OTP on verification failure
        setOtp(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        setFocusedIndex(0);
      }
    } catch (error) {
      console.error('OTP verification error:', error);
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setFocusedIndex(0);
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendDisabled || !onResendOtp) return;

    try {
      setResendDisabled(true);
      setCountdown(30);
      await onResendOtp();
    } catch (error) {
      console.error('Resend OTP error:', error);
      setResendDisabled(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify OTP</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to +91 {phoneNumber}
      </Text>

      {/* OTP Input Fields */}
      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (inputRefs.current[index] = ref)}
            style={[
              styles.otpInput,
              focusedIndex === index && styles.otpInputFocused,
              error && styles.otpInputError,
            ]}
            value={digit}
            onChangeText={(value) => handleOtpChange(index, value)}
            onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
            keyboardType="numeric"
            maxLength={1}
            selectTextOnFocus
            editable={!verifying}
          />
        ))}
      </View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={16} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* Resend OTP */}
      {onResendOtp && (
        <TouchableOpacity
          style={[styles.resendButton, resendDisabled && styles.resendButtonDisabled]}
          onPress={handleResendOtp}
          disabled={resendDisabled || verifying}
        >
          {verifying ? (
            <ActivityIndicator size="small" color="#10b981" />
          ) : (
            <>
              <Text style={[styles.resendText, resendDisabled && styles.resendTextDisabled]}>
                {resendDisabled ? `Resend OTP in ${countdown}s` : 'Resend OTP'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: 280,
    marginBottom: 20,
  },
  otpInput: {
    width: 40,
    height: 50,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  otpInputFocused: {
    borderColor: '#10b981',
    backgroundColor: '#f0fdf4',
  },
  otpInputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
    flex: 1,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: '#10b981',
    marginTop: 8,
  },
  resendButtonDisabled: {
    backgroundColor: '#d1d5db',
  },
  resendText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  resendTextDisabled: {
    color: '#9ca3af',
  },
});

export default OtpInput;
