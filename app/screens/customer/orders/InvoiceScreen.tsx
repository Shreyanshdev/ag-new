import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  StatusBar,
  Alert,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { captureRef } from 'react-native-view-shot';
import * as MediaLibrary from 'expo-media-library';

const InvoiceScreen = () => {
  const router = useRouter();
  const { orderData } = useLocalSearchParams();
  const invoiceRef = useRef<View>(null);
  const [isProcessing, setIsProcessing] = React.useState(false);
  
  // Parse order data
  const order = orderData ? JSON.parse(orderData as string) : null;

  if (!order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons name="alert-circle" size={64} color="#ef4444" />
          <Text style={styles.errorText}>Invoice data not found</Text>
          <TouchableOpacity onPress={() => router.back()} style={styles.errorButton}>
            <Text style={styles.errorButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const getCurrentDate = () => {
    return new Date().toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getPaymentMethod = () => {
    if (!order.paymentDetails?.method) {
      return 'Online Payment';
    }
    
    const method = order.paymentDetails.method.toLowerCase();
    switch (method) {
      case 'card':
        return 'Credit/Debit Card';
      case 'netbanking':
        return 'Net Banking';
      case 'wallet':
        return 'Digital Wallet';
      case 'upi':
        return 'UPI';
      default:
        return order.paymentDetails.method.toUpperCase();
    }
  };

  const getOrderDate = () => {
    return new Date(order.createdAt).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return '#22c55e';
      case 'in-progress': return '#3b82f6';
      case 'pending': return '#f59e0b';
      case 'cancelled': return '#ef4444';
      default: return '#6b7280';
    }
  };

  const getStatusText = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'Delivered';
      case 'in-progress': return 'In Progress';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled';
      case 'accepted': return 'Accepted';
      case 'awaitconfirmation': return 'Awaiting Confirmation';
      default: return status || 'Unknown';
    }
  };

  const downloadInvoice = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);
      
      // Request media library permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        setIsProcessing(false);
        Alert.alert(
          'Permission Required', 
          'Please grant permission to save the invoice to your gallery',
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Grant Permission', 
              onPress: async () => {
                const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
                if (newStatus === 'granted') {
                  downloadInvoice(); // Retry download
                }
              }
            }
          ]
        );
        return;
      }

      // Capture the invoice as high-quality image
      const uri = await captureRef(invoiceRef.current!, {
        format: 'png',
        quality: 1.0,
        width: 800, // Fixed width for better quality
        height: undefined, // Auto height to maintain aspect ratio
      });

      // Create filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `AgStore_Invoice_${order.orderId}_${timestamp}.png`;

      // Save to device gallery
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      // Try to create album or add to existing one
      try {
        const album = await MediaLibrary.getAlbumAsync('AgStore Invoices');
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync('AgStore Invoices', asset, false);
        }
      } catch (albumError) {
        console.log('Album creation/addition failed, but image saved to gallery:', albumError);
      }
      
      Alert.alert(
        'Success!', 
        `Invoice has been saved to your gallery as "${filename}".\n\nYou can find it in the "AgStore Invoices" album or in your main photo gallery.`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Download error:', error);
      Alert.alert(
        'Download Failed', 
        'Sorry, we couldn\'t save the invoice. Please check your device storage and permissions.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const shareInvoice = async () => {
    if (isProcessing) return;
    
    try {
      setIsProcessing(true);

      // Capture the invoice as image
      const uri = await captureRef(invoiceRef.current!, {
        format: 'png',
        quality: 0.9,
        width: 800,
        height: undefined,
      });

      // Share the image
      const result = await Share.share({
        url: uri,
        title: `AgStore Invoice - Order #${order.orderId}`,
        message: `AgStore Invoice for Order #${order.orderId}\nTotal: ₹${totalAmount.toFixed(2)}\nStatus: ${getStatusText(order.status)}`,
      });

      if (result.action === Share.sharedAction) {
        console.log('Invoice shared successfully');
      }
    } catch (error) {
      console.error('Share error:', error);
      
      // Fallback to text sharing if image sharing fails
      try {
        const invoiceText = `
🧾 AgStore Invoice - Order #${order.orderId}

📅 Order Date: ${getOrderDate()}
📊 Status: ${getStatusText(order.status)}
👤 Customer: ${order.customer?.name || 'Customer'}

🛒 Items:
${order.items?.map((item: any) => `• ${item.name} - Qty: ${item.unitsBought} × ₹${(item.unitPrice || 0).toFixed(2)} = ₹${(item.totalPrice || 0).toFixed(2)}`).join('\n')}

💰 Subtotal: ₹${subtotal.toFixed(2)}
🚚 Delivery Fee: ₹${deliveryFee.toFixed(2)}
💳 Total Amount: ₹${totalAmount.toFixed(2)}

💳 Payment Method: ${getPaymentMethod()}
${order.deliveryAddress ? `📍 Delivery Address: ${order.deliveryAddress.street}, ${order.deliveryAddress.city}` : ''}

Thank you for choosing AgStore! 🌿
📞 Support: +91 9219488035
        `;

        await Share.share({
          message: invoiceText.trim(),
          title: `AgStore Invoice - Order #${order.orderId}`,
        });
      } catch {
        Alert.alert('Share Failed', 'Unable to share the invoice. Please try again.');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const subtotal = order.items?.reduce((sum: number, item: any) => sum + (item.totalPrice || 0), 0) || 0;
  const deliveryFee = order.deliveryFee || 0;
  const totalAmount = subtotal + deliveryFee;

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
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color="#1d1d1d" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Invoice</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={shareInvoice} 
            style={[styles.headerButton, isProcessing && styles.headerButtonDisabled]}
            disabled={isProcessing}
          >
            <MaterialCommunityIcons 
              name={isProcessing ? "loading" : "share"} 
              size={24} 
              color={isProcessing ? "#9ca3af" : "#1d1d1d"} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={downloadInvoice} 
            style={[styles.headerButton, isProcessing && styles.headerButtonDisabled]}
            disabled={isProcessing}
          >
            <MaterialCommunityIcons 
              name={isProcessing ? "loading" : "download"} 
              size={24} 
              color={isProcessing ? "#9ca3af" : "#1d1d1d"} 
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View ref={invoiceRef} style={styles.invoiceContainer}>
          {/* Invoice Header */}
          <View style={styles.invoiceHeader}>
            <View style={styles.companyInfo}>
              <View style={styles.logoContainer}>
                <MaterialCommunityIcons name="store" size={40} color="#22c55e" />
              </View>
              <Text style={styles.companyName}>AgStore</Text>
              <Text style={styles.companyTagline}>Your Trusted Grocery Partner</Text>
              <Text style={styles.companyAddress}>Retail & Wholesale Grocery Store</Text>
            </View>
            
            <View style={styles.invoiceInfo}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
              <View style={styles.invoiceDetails}>
                <Text style={styles.invoiceDetailLabel}>Invoice #:</Text>
                <Text style={styles.invoiceDetailValue}>INV-{order.orderId}</Text>
              </View>
              <View style={styles.invoiceDetails}>
                <Text style={styles.invoiceDetailLabel}>Date:</Text>
                <Text style={styles.invoiceDetailValue}>{getCurrentDate()}</Text>
              </View>
              <View style={styles.invoiceDetails}>
                <Text style={styles.invoiceDetailLabel}>Order Date:</Text>
                <Text style={styles.invoiceDetailValue}>{getOrderDate()}</Text>
              </View>
            </View>
          </View>

          {/* Order Status */}
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(order.status) }]}>
              <Text style={styles.statusText}>{getStatusText(order.status)}</Text>
            </View>
          </View>

          {/* Customer & Delivery Info */}
          <View style={styles.customerSection}>
            <View style={styles.customerInfo}>
              <Text style={styles.sectionTitle}>Bill To:</Text>
              <Text style={styles.customerName}>{order.customer?.name || 'Customer'}</Text>
              {order.customer?.email && (
                <Text style={styles.customerDetail}>{order.customer.email}</Text>
              )}
              {order.customer?.phone && (
                <Text style={styles.customerDetail}>+91 {order.customer.phone}</Text>
              )}
            </View>

            <View style={styles.deliveryInfo}>
              <Text style={styles.sectionTitle}>Deliver To:</Text>
              {order.deliveryLocation && (
                <>
                  <Text style={styles.addressText}>
                    {order.deliveryLocation.address || 'Delivery Address'}
                  </Text>
                  <Text style={styles.addressDetail}>
                    Coordinates: {order.deliveryLocation.latitude?.toFixed(4)}, {order.deliveryLocation.longitude?.toFixed(4)}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Order Items Table */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Order Items</Text>
            
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, styles.itemColumn]}>Item</Text>
              <Text style={[styles.tableHeaderText, styles.qtyColumn]}>Qty</Text>
              <Text style={[styles.tableHeaderText, styles.priceColumn]}>Price</Text>
              <Text style={[styles.tableHeaderText, styles.totalColumn]}>Total</Text>
            </View>

            {/* Table Rows */}
            {order.items?.map((item: any, index: number) => (
              <View key={index} style={styles.tableRow}>
                <View style={styles.itemColumn}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  {item.mode === 'wholesale' && (
                    <Text style={styles.itemMode}>Wholesale</Text>
                  )}
                </View>
                <Text style={[styles.tableText, styles.qtyColumn]}>
                  {item.unitsBought}
                  {item.mode === 'wholesale' && item.bundlesBought && (
                    <Text style={styles.bundleText}> ({item.bundlesBought} bundles)</Text>
                  )}
                </Text>
                <Text style={[styles.tableText, styles.priceColumn]}>
                  ₹{(item.unitPrice || 0).toFixed(2)}
                </Text>
                <Text style={[styles.tableText, styles.totalColumn]}>
                  ₹{(item.totalPrice || 0).toFixed(2)}
                </Text>
              </View>
            ))}
          </View>

          {/* Pricing Summary */}
          <View style={styles.summarySection}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>₹{subtotal.toFixed(2)}</Text>
            </View>
            
            {deliveryFee > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Delivery Fee:</Text>
                <Text style={styles.summaryValue}>₹{deliveryFee.toFixed(2)}</Text>
              </View>
            )}
            
            <View style={styles.dividerLine} />
            
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Amount:</Text>
              <Text style={styles.totalValue}>₹{totalAmount.toFixed(2)}</Text>
            </View>
          </View>

          {/* Additional Information */}
          <View style={styles.additionalInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Method:</Text>
              <Text style={styles.infoValue}>{getPaymentMethod()}</Text>
            </View>
            
            {order.deliveryPartner && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Delivery Partner:</Text>
                <Text style={styles.infoValue}>{order.deliveryPartner.name}</Text>
              </View>
            )}
            
            {order.branch && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Branch:</Text>
                <Text style={styles.infoValue}>{order.branch.name || 'Main Branch'}</Text>
              </View>
            )}
          </View>

          {/* Footer */}
          <View style={styles.invoiceFooter}>
            <Text style={styles.footerText}>Thank you for choosing AgStore!</Text>
            <Text style={styles.footerSubtext}>For support, contact us at +91 9219488035</Text>
            <Text style={styles.footerNote}>
              This is a computer-generated invoice and does not require a signature.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Platform.OS === 'android' ? 'transparent' : '#ffffff',
  },
  
  // Header
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
    marginLeft: 8,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    padding: 8,
  },
  headerButtonDisabled: {
    opacity: 0.5,
  },
  
  // Error State
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginTop: 16,
    textAlign: 'center',
  },
  errorButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#22c55e',
    borderRadius: 8,
  },
  errorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Invoice Container
  scrollView: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  invoiceContainer: {
    margin: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  
  // Invoice Header
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#e5e7eb',
  },
  companyInfo: {
    flex: 1,
  },
  logoContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#f0fdf4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  companyName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#22c55e',
    marginBottom: 4,
  },
  companyTagline: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  companyAddress: {
    fontSize: 12,
    color: '#9ca3af',
  },
  invoiceInfo: {
    alignItems: 'flex-end',
  },
  invoiceTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
  },
  invoiceDetails: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  invoiceDetailLabel: {
    fontSize: 12,
    color: '#6b7280',
    width: 80,
  },
  invoiceDetailValue: {
    fontSize: 12,
    color: '#1f2937',
    fontWeight: '500',
  },
  
  // Status
  statusContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  
  // Customer Section
  customerSection: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 24,
  },
  customerInfo: {
    flex: 1,
  },
  deliveryInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 8,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 4,
  },
  customerDetail: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  addressText: {
    fontSize: 14,
    color: '#1f2937',
    marginBottom: 4,
  },
  addressDetail: {
    fontSize: 12,
    color: '#9ca3af',
  },
  
  // Items Table
  itemsSection: {
    marginBottom: 24,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f9fafb',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  tableHeaderText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemColumn: {
    flex: 2,
  },
  qtyColumn: {
    flex: 1,
    textAlign: 'center',
  },
  priceColumn: {
    flex: 1,
    textAlign: 'right',
  },
  totalColumn: {
    flex: 1,
    textAlign: 'right',
  },
  itemName: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  itemMode: {
    fontSize: 11,
    color: '#059669',
    fontWeight: '500',
    marginTop: 2,
  },
  bundleText: {
    fontSize: 10,
    color: '#6b7280',
  },
  tableText: {
    fontSize: 14,
    color: '#1f2937',
  },
  
  // Summary
  summarySection: {
    marginBottom: 24,
    paddingLeft: '50%',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  summaryValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  dividerLine: {
    height: 1,
    backgroundColor: '#e5e7eb',
    marginVertical: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  
  // Additional Info
  additionalInfo: {
    marginBottom: 24,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 14,
    color: '#1f2937',
    fontWeight: '500',
  },
  
  // Footer
  invoiceFooter: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#22c55e',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 8,
  },
  footerNote: {
    fontSize: 11,
    color: '#9ca3af',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default InvoiceScreen;
