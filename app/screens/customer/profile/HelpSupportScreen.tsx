import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Linking,
  Platform,
  StatusBar,
  ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useBranch } from '../../../../src/context/BranchContext';

const HelpSupportScreen = () => {
  const navigation = useNavigation<any>();
  const { branches, loading: branchLoading, fetchBranches } = useBranch();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);

  const supportPhone = '9219488035';
  const supportWhatsApp = '9219488035';

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const handleCallSupport = () => {
    const phoneUrl = `tel:${supportPhone}`;
    Linking.canOpenURL(phoneUrl).then(supported => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'Unable to make phone call');
      }
    });
  };

  const handleWhatsAppSupport = () => {
    const whatsappUrl = `whatsapp://send?phone=+91${supportWhatsApp}&text=Hello, I need help with AgStore app`;
    
    Linking.canOpenURL(whatsappUrl).then(supported => {
      if (supported) {
        Linking.openURL(whatsappUrl);
      } else {
        // Fallback to web WhatsApp
        const webWhatsAppUrl = `https://wa.me/91${supportWhatsApp}?text=Hello, I need help with AgStore app`;
        Linking.openURL(webWhatsAppUrl);
      }
    }).catch(() => {
      Alert.alert('Error', 'WhatsApp is not installed on your device');
    });
  };

  const handleEmailSupport = () => {
    const emailUrl = 'mailto:support@agstore.com?subject=AgStore App Support';
    Linking.openURL(emailUrl);
  };

  const toggleFAQ = (index: number) => {
    setExpandedFAQ(expandedFAQ === index ? null : index);
  };

  const faqData = [
    {
      question: "What is the difference between retail and wholesale pricing?",
      answer: "Retail pricing is for individual customers buying small quantities. Wholesale pricing is available for subscribed users who buy in bulk quantities (bundles). Wholesale prices offer significant savings for larger purchases."
    },
    {
      question: "How do I subscribe for wholesale pricing?",
      answer: "To access wholesale pricing, please contact our support team at +91 9219488035. Our team will help you set up a wholesale account based on your business requirements."
    },
    {
      question: "What is the minimum order value for delivery?",
      answer: "We offer delivery for all order values. Delivery fees may vary based on your location and distance from our nearest branch."
    },
    {
      question: "How can I track my order?",
      answer: "Once your order is confirmed, you'll receive real-time tracking updates. You can view your active orders in the 'Orders' section of the app with live GPS tracking."
    },
    {
      question: "What is your return/refund policy?",
      answer: "We accept returns for damaged or incorrect items within 24 hours of delivery. For wholesale orders, please contact our support team for specific return policies."
    },
    {
      question: "How do I cancel my order?",
      answer: "Retail customers can cancel orders anytime before delivery through the order tracking screen. Wholesale customers should contact support for cancellation requests."
    }
  ];

  const formatBranchAddress = (branch: any) => {
    return branch.address || `${branch.location?.latitude || 'N/A'}, ${branch.location?.longitude || 'N/A'}`;
  };

  const handleCallBranch = (phone: string) => {
    const phoneUrl = `tel:${phone}`;
    Linking.canOpenURL(phoneUrl).then(supported => {
      if (supported) {
        Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Error', 'Unable to make phone call');
      }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      {Platform.OS === 'android' && (
        <StatusBar
          backgroundColor="transparent"
          barStyle="dark-content"
          translucent={true}
        />
      )}
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <View style={styles.logoContainer}>
            <MaterialCommunityIcons name="store" size={60} color="#22c55e" />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to AgStore!</Text>
          <Text style={styles.welcomeSubtitle}>
            We are AgStore - Your trusted partner for both retail and wholesale grocery needs.
          </Text>
          <Text style={styles.welcomeDescription}>
            Whether you&apos;re shopping for your home or running a business, we&apos;ve got you covered with 
            competitive prices, fresh products, and reliable delivery services.
          </Text>
        </View>

        {/* Quick Contact Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Need Immediate Help?</Text>
          <Text style={styles.sectionSubtitle}>Our support team is here to assist you</Text>
          
          <View style={styles.contactGrid}>
            <TouchableOpacity style={styles.contactCard} onPress={handleCallSupport}>
              <MaterialCommunityIcons name="phone" size={32} color="#3b82f6" />
              <Text style={styles.contactCardTitle}>Call Us</Text>
              <Text style={styles.contactCardSubtitle}>+91 {supportPhone}</Text>
              <Text style={styles.contactCardDescription}>Direct phone support</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleWhatsAppSupport}>
              <MaterialCommunityIcons name="whatsapp" size={32} color="#25d366" />
              <Text style={styles.contactCardTitle}>WhatsApp</Text>
              <Text style={styles.contactCardSubtitle}>+91 {supportWhatsApp}</Text>
              <Text style={styles.contactCardDescription}>Chat with us instantly</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.contactCard} onPress={handleEmailSupport}>
              <MaterialCommunityIcons name="email" size={32} color="#ef4444" />
              <Text style={styles.contactCardTitle}>Email</Text>
              <Text style={styles.contactCardSubtitle}>support@agstore.com</Text>
              <Text style={styles.contactCardDescription}>Send us your queries</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Available Branches Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Our Locations</Text>
          <Text style={styles.sectionSubtitle}>Find our branches near you</Text>
          
          {branchLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#22c55e" />
              <Text style={styles.loadingText}>Loading branches...</Text>
            </View>
          ) : branches.length > 0 ? (
            <View style={styles.branchesContainer}>
              {branches.map((branch, index) => (
                <View key={branch._id} style={styles.branchCard}>
                  <View style={styles.branchHeader}>
                    <MaterialCommunityIcons name="map-marker" size={24} color="#22c55e" />
                    <Text style={styles.branchName}>{branch.name}</Text>
                  </View>
                  <Text style={styles.branchAddress}>{formatBranchAddress(branch)}</Text>
                  
                  {/* Branch Phone Number */}
                  {branch.phone && (
                    <View style={styles.branchPhoneContainer}>
                      <MaterialCommunityIcons name="phone" size={16} color="#6b7280" />
                      <Text style={styles.branchPhone}>{branch.phone}</Text>
                    </View>
                  )}
                  
                  <View style={styles.branchActions}>
                    <TouchableOpacity 
                      style={styles.branchActionButton}
                      onPress={() => {
                        const url = `https://maps.google.com/?q=${branch.location?.latitude || 0},${branch.location?.longitude || 0}`;
                        Linking.openURL(url);
                      }}
                    >
                      <MaterialCommunityIcons name="directions" size={16} color="#3b82f6" />
                      <Text style={styles.branchActionText}>Get Directions</Text>
                    </TouchableOpacity>
                    
                    {/* Call Branch Button */}
                    {branch.phone && (
                      <TouchableOpacity 
                        style={[styles.branchActionButton, styles.callActionButton]}
                        onPress={() => handleCallBranch(branch.phone!)}
                      >
                        <MaterialCommunityIcons name="phone" size={16} color="#22c55e" />
                        <Text style={[styles.branchActionText, styles.callActionText]}>Call Branch</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.noBranchesContainer}>
              <MaterialCommunityIcons name="map-marker-off" size={48} color="#9ca3af" />
              <Text style={styles.noBranchesText}>No branches available at the moment</Text>
            </View>
          )}
        </View>

        {/* FAQ Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          <Text style={styles.sectionSubtitle}>Find quick answers to common questions</Text>
          
          <View style={styles.faqContainer}>
            {faqData.map((faq, index) => (
              <View key={index} style={styles.faqItem}>
                <TouchableOpacity
                  style={styles.faqQuestion}
                  onPress={() => toggleFAQ(index)}
                >
                  <Text style={styles.faqQuestionText}>{faq.question}</Text>
                  <MaterialCommunityIcons 
                    name={expandedFAQ === index ? "chevron-up" : "chevron-down"} 
                    size={24} 
                    color="#6b7280" 
                  />
                </TouchableOpacity>
                {expandedFAQ === index && (
                  <View style={styles.faqAnswer}>
                    <Text style={styles.faqAnswerText}>{faq.answer}</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <View style={styles.quickActionsGrid}>
            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="file-document" size={28} color="#8b5cf6" />
              <Text style={styles.quickActionTitle}>Terms & Conditions</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="shield-check" size={28} color="#10b981" />
              <Text style={styles.quickActionTitle}>Privacy Policy</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="truck-delivery" size={28} color="#f59e0b" />
              <Text style={styles.quickActionTitle}>Delivery Info</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.quickActionCard}>
              <MaterialCommunityIcons name="star" size={28} color="#ef4444" />
              <Text style={styles.quickActionTitle}>Rate Our App</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Business Hours */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Business Hours</Text>
          <View style={styles.hoursContainer}>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Monday - Saturday</Text>
              <Text style={styles.hoursTime}>9:00 AM - 8:00 PM</Text>
            </View>
            <View style={styles.hoursRow}>
              <Text style={styles.hoursDay}>Sunday</Text>
              <Text style={styles.hoursTime}>10:00 AM - 6:00 PM</Text>
            </View>
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? 'transparent' : '#ffffff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1d1d1d',
    flex: 1,
    textAlign: 'center',
    marginRight: 40, // Compensate for back button
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  
  // Welcome Section
  welcomeSection: {
    padding: 24,
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#22c55e',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeDescription: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },

  // Section Styles
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 16,
  },

  // Contact Grid
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  contactCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  contactCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 8,
  },
  contactCardSubtitle: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '500',
    marginTop: 4,
  },
  contactCardDescription: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
  },

  // Branches
  branchesContainer: {
    gap: 12,
  },
  branchCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  branchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  branchName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginLeft: 8,
  },
  branchAddress: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
    lineHeight: 20,
  },
  branchPhoneContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 4,
  },
  branchPhone: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  branchActions: {
    flexDirection: 'row',
    gap: 8,
  },
  branchActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#eff6ff',
    borderRadius: 6,
  },
  callActionButton: {
    backgroundColor: '#f0fdf4',
  },
  branchActionText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
    marginLeft: 4,
  },
  callActionText: {
    color: '#22c55e',
  },

  // Loading and No Data
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 8,
  },
  noBranchesContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  noBranchesText: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
  },

  // FAQ
  faqContainer: {
    gap: 8,
  },
  faqItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  faqQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  faqQuestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1f2937',
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    padding: 16,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  faqAnswerText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },

  // Quick Actions
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1f2937',
    textAlign: 'center',
    marginTop: 8,
  },

  // Business Hours
  hoursContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  hoursRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  hoursDay: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  hoursTime: {
    fontSize: 14,
    color: '#22c55e',
    fontWeight: '600',
  },

  bottomPadding: {
    height: 32,
  },
});

export default HelpSupportScreen;
