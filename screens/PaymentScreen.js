import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  TextInput,
  Image,
  ActivityIndicator,
  Linking,
  Platform
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HeaderBar from '../components/HeaderBar';
import MenuModal from '../components/MenuModal';
import ModernAlert from '../components/ModernAlert';
import menuItems, { handleMenuItemAction } from '../components/menuItems';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStripe, useConfirmPayment, CardField } from '@stripe/stripe-react-native';
import { API_BASE_URL as ENV_API_BASE_URL } from '@env';

// InputField component defined outside to prevent recreation on each render
const InputField = React.memo(({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, maxLength }) => (
  <View style={styles.inputContainer}>
    <Text style={styles.inputLabel}>{label}</Text>
    <TextInput
      style={styles.input}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
      keyboardType={keyboardType}
      maxLength={maxLength}
      secureTextEntry={secureTextEntry}
      autoCorrect={false}
      autoCapitalize="none"
      blurOnSubmit={false}
      returnKeyType="next"
      editable={true}
    />
  </View>
), (prevProps, nextProps) => {
  // Only re-render if value or onChangeText changes
  return (
    prevProps.value === nextProps.value &&
    prevProps.onChangeText === nextProps.onChangeText
  );
});

// Card Details Form component using Stripe's secure CardField
const CardDetailsForm = React.memo(({ 
  stripe, 
  cardHolder,
  onCardHolderChange,
  onCardFieldChange
}) => {
  const cardFieldRef = useRef(null);
  if (!stripe) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Card Details</Text>
        <View style={styles.errorCard}>
          <Ionicons name="alert-circle-outline" size={20} color="#F44336" />
          <Text style={styles.errorCardText}>
            Payment processing is not available. Please configure Stripe or contact support.
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Card Details</Text>
      
      {/* Stripe CardField - handles card number, expiry, and CVV securely */}
      <View style={styles.cardFieldContainer}>
        <CardField
          ref={cardFieldRef}
          postalCodeEnabled={false}
          placeholders={{
            number: '4242 4242 4242 4242',
          }}
          cardStyle={{
            backgroundColor: '#FFFFFF',
            textColor: '#000000',
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 8,
            fontSize: 16,
            placeholderColor: '#999999',
          }}
          style={styles.cardField}
          onCardChange={(cardDetails) => {
            // Log raw CardField data
            console.log('=== CardField onCardChange RAW ===', {
              cardDetails,
              type: typeof cardDetails,
              isNull: cardDetails === null,
              isUndefined: cardDetails === undefined,
              keys: cardDetails ? Object.keys(cardDetails) : 'no keys',
              complete: cardDetails?.complete,
            });
            
            // Always call the parent handler - CardField may pass null initially
            if (onCardFieldChange) {
              onCardFieldChange(cardDetails);
            }
          }}
          onFocus={(focusedField) => {
            console.log('=== CardField Focused ===', focusedField);
          }}
        />
      </View>

      {/* Card Holder Name - separate field as it's not part of CardField */}
      <InputField
        label="Card Holder Name"
        value={cardHolder}
        onChangeText={onCardHolderChange}
        placeholder="John Doe"
        keyboardType="default"
      />
    </View>
  );
});

const PaymentScreen = () => {
  const insets = useSafeAreaInsets();
  const [menuVisible, setMenuVisible] = useState(false);
  const [cardHolder, setCardHolder] = useState('');
  const [cardDetails, setCardDetails] = useState(null); // Store CardField completion status
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' or 'payment'
  const [invoices, setInvoices] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigation = useNavigation();
  const { logout } = useAuth();
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', buttons: [] });
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  
  // Always call hooks - required by React rules
  const stripe = useStripe();
  const { confirmPayment } = useConfirmPayment();

  const API_BASE_URL = ENV_API_BASE_URL;

  // Debug: Log component mount
  useEffect(() => {
    console.log('=== PaymentScreen Mounted ===');
    console.log('Initial state:', {
      selectedInvoice: selectedInvoice?.id || null,
      activeTab,
      cardHolder,
      cardDetails: cardDetails?.complete || null,
    });
  }, []);

  // Debug: Log selectedInvoice changes
  useEffect(() => {
    console.log('=== selectedInvoice Changed ===', {
      invoiceId: selectedInvoice?.id || null,
      invoiceNumber: selectedInvoice?.invoice_number || null,
      amount: selectedInvoice?.amount || null,
    });
  }, [selectedInvoice]);

  // Debug: Log activeTab changes
  useEffect(() => {
    console.log('=== activeTab Changed ===', activeTab);
  }, [activeTab]);

  // Debug: Log cardHolder changes
  useEffect(() => {
    console.log('=== cardHolder Changed ===', {
      value: cardHolder,
      length: cardHolder.length,
      trimmedLength: cardHolder.trim().length,
    });
  }, [cardHolder]);

  // Debug: Log cardDetails changes
  useEffect(() => {
    console.log('=== cardDetails Changed ===', {
      complete: cardDetails?.complete,
      validNumber: cardDetails?.validNumber,
      validCVC: cardDetails?.validCVC,
      validExpiryDate: cardDetails?.validExpiryDate,
      brand: cardDetails?.brand,
      last4: cardDetails?.last4,
    });
  }, [cardDetails]);

  // Debug: Log button state changes
  useEffect(() => {
    const buttonDisabled = !selectedInvoice || isProcessingPayment || !isCardValid;
    console.log('=== Pay Button State ===', {
      selectedInvoice: selectedInvoice ? 'Yes' : 'No',
      isProcessingPayment,
      isCardValid,
      buttonDisabled,
      disabledReason: !selectedInvoice ? 'No invoice selected' : 
                      isProcessingPayment ? 'Processing payment' : 
                      !isCardValid ? 'Card not valid' : 'Enabled',
    });
  }, [selectedInvoice, isProcessingPayment, isCardValid]);

  // Validate card details using CardField completion status
  const validateCardDetails = useCallback(() => {
    // Card holder name must be provided
    const cardHolderValid = cardHolder.trim().length > 0;
    
    // If cardDetails is null, CardField hasn't reported state yet
    // This can happen if user hasn't interacted with CardField or callback isn't firing
    // For now, we'll be lenient and allow payment if cardHolder is filled
    // Stripe will validate the card during confirmPayment anyway
    if (!cardDetails || typeof cardDetails !== 'object') {
      console.log('Card validation: cardDetails is null - allowing if cardHolder is valid (Stripe will validate during payment)');
      // TEMPORARY: Allow if card holder is filled - Stripe will validate during payment
      // This is a workaround for CardField callback not firing
      return cardHolderValid;
    }

    // Primary check: use complete flag from CardField
    const cardComplete = cardDetails.complete === true;
    
    // Fallback check: validate individual fields if complete flag is not reliable
    const individualFieldsValid = (
      cardDetails.validNumber === true &&
      cardDetails.validCVC === true &&
      cardDetails.validExpiryDate === true
    );
    
    // Card is valid if either complete flag is true OR all individual fields are valid
    const cardValid = cardComplete || individualFieldsValid;
    
    const isValid = cardValid && cardHolderValid;
    
    console.log('=== Card validation check ===', {
      isValid,
      cardComplete,
      individualFieldsValid,
      cardValid,
      cardHolderValid,
      cardDetailsComplete: cardDetails.complete,
      cardDetailsValidNumber: cardDetails.validNumber,
      cardDetailsValidCVC: cardDetails.validCVC,
      cardDetailsValidExpiryDate: cardDetails.validExpiryDate,
    });
    
    return isValid;
  }, [cardDetails, cardHolder]);

  // Memoize validation result to prevent unnecessary re-renders
  const isCardValid = useMemo(() => {
    const result = validateCardDetails();
    console.log('=== isCardValid Recalculated ===', result);
    return result;
  }, [cardDetails, cardHolder, validateCardDetails]);

  // Handler for CardField changes
  const handleCardFieldChange = useCallback((details) => {
    console.log('=== handleCardFieldChange Called ===', {
      details,
      detailsType: typeof details,
      isNull: details === null,
      isUndefined: details === undefined,
      keys: details ? Object.keys(details) : 'no keys',
      complete: details?.complete,
      completeType: typeof details?.complete,
      brand: details?.brand,
      last4: details?.last4,
      expiryMonth: details?.expiryMonth,
      expiryYear: details?.expiryYear,
      postalCode: details?.postalCode,
      validNumber: details?.validNumber,
      validCVC: details?.validCVC,
      validExpiryDate: details?.validExpiryDate,
    });
    
    // Always update state, even if details is null (to track state changes)
    setCardDetails(details);
  }, []);

  const handleCardHolderChange = useCallback((text) => {
    console.log('Card holder changed:', text);
    setCardHolder(text);
  }, []);

  const getAuthHeader = async () => {
    const userToken = await AsyncStorage.getItem('userToken');

    if (!userToken) {
      throw new Error('Authentication required');
    }

    if (userToken.startsWith('Bearer ')) {
      return userToken;
    }

    return `Bearer ${userToken}`;
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Get the stored token
      let authHeader;
      try {
        authHeader = await getAuthHeader();
      } catch (e) {
        console.error('No token found');
        setError('Authentication required');
        setLoading(false);
        return null;
      }
  
      const response = await fetch(`${API_BASE_URL}/mobile/invoices`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
      });
  
      if (response.ok) {
        const data = await response.json();
        console.log('Invoices data:', data.data);
        setInvoices(data.data || []);
        return data;
      } else {
        // Get the error response body
        const errorData = await response.json();
        console.error('Error response:', errorData);
        console.error('Failed to fetch invoices:', response.status);
        setError('Failed to fetch invoices');
        return null;
      }
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setError('Network error occurred');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const handleLogoutRequest = (logoutFunction) => {
    setAlertConfig({
      title: 'Logout',
      message: 'Are you sure you want to logout?',
      type: 'warning',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'secondary',
        },
        {
          text: 'Logout',
          onPress: () => logoutFunction(),
          style: 'secondary',
        },
      ],
    });
    setAlertVisible(true);
  };

  const handleMenuItemPress = (item) => {
    setMenuVisible(false);
    handleMenuItemAction(item, navigation, logout, handleLogoutRequest);
  };

  const renderMenuIcon = (item, idx) => {
    let IconComponent = MaterialCommunityIcons;
    if (item.lib === 'Feather') IconComponent = require('react-native-vector-icons/Feather').default;
    if (item.lib === 'Ionicons') IconComponent = Ionicons;
    return (
      <View key={item.label} style={styles.menuItem}>
        <IconComponent name={item.icon} size={32} color="#222" />
        <Text style={styles.menuItemLabel}>{item.label}</Text>
      </View>
    );
  };

  const createPaymentIntent = async (invoice) => {
    try {
      const authHeader = await getAuthHeader();

      const response = await fetch(`${API_BASE_URL}/mobile/payments/create-payment-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          invoice_id: invoice.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to create payment intent:', data);
        throw new Error(data?.message || 'Unable to start payment. Please try again.');
      }

      if (!data?.clientSecret) {
        throw new Error('Invalid payment configuration from server.');
      }

      return {
        clientSecret: data.clientSecret,
        paymentIntentId: data.payment_intent_id,
      };
    } catch (err) {
      console.error('Error creating payment intent:', err);
      throw err;
    }
  };

  const confirmPaymentWithBackend = async (paymentIntentId, invoiceId) => {
    try {
      const authHeader = await getAuthHeader();

      const response = await fetch(`${API_BASE_URL}/mobile/payments/confirm-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader,
        },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          invoice_id: invoiceId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Failed to confirm payment:', data);
        // Don't throw - payment might still succeed via webhook
        return { success: false, message: data?.message };
      }

      return { success: true, data: data.data };
    } catch (err) {
      console.error('Error confirming payment with backend:', err);
      // Don't throw - payment might still succeed via webhook
      return { success: false, message: err.message };
    }
  };

  const handlePayment = async () => {
    console.log('=== handlePayment Called ===', {
      selectedInvoice: selectedInvoice?.id || null,
      isCardValid,
      cardDetails: cardDetails?.complete || null,
      cardHolder: cardHolder || 'empty',
    });

    if (!selectedInvoice) {
      console.log('Payment blocked: No invoice selected');
      setAlertConfig({
        title: 'Error',
        message: 'Please select an invoice to pay',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    // Validate card details using CardField completion status
    const validationResult = validateCardDetails();
    console.log('Payment validation result:', validationResult);
    
    if (!validationResult) {
      console.log('Payment blocked: Card validation failed');
      setAlertConfig({
        title: 'Incomplete Card Details',
        message: 'Please enter complete card details. Make sure all card fields are filled correctly and card holder name is provided.',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    if (!stripe) {
      setAlertConfig({
        title: 'Error',
        message: 'Payment system is not available. Please contact support.',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
      return;
    }

    // Note: CardField validation happens during confirmPayment
    // If cardDetails is null or incomplete, we'll still proceed
    // Stripe will validate the card during confirmPayment and return an error if invalid
    if (cardDetails && !cardDetails.complete) {
      console.warn('CardField reports incomplete, but proceeding - Stripe will validate during payment');
      // Don't block - let Stripe validate during confirmPayment
    }

    try {
      setIsProcessingPayment(true);

      // Validate card holder name
      const cleanedCardHolder = cardHolder.trim();
      if (!cleanedCardHolder || cleanedCardHolder.length === 0) {
        setAlertConfig({
          title: 'Invalid Card Holder',
          message: 'Please enter the card holder name.',
          type: 'error',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
        setIsProcessingPayment(false);
        return;
      }

      // Step 1: Create PaymentIntent on backend (no card data sent)
      const { clientSecret, paymentIntentId } = await createPaymentIntent(selectedInvoice);

      // Step 2: Confirm PaymentIntent using CardField
      // CardField handles card data securely - we only pass billing details
      console.log('Confirming payment with Stripe CardField...');
      
      const { paymentIntent, error: confirmError } = await confirmPayment(clientSecret, {
        paymentMethodType: 'Card',
        billingDetails: {
          name: cleanedCardHolder,
        },
      });

      if (confirmError) {
        console.error('Stripe confirmPayment error:', confirmError);
        setAlertConfig({
          title: 'Payment Failed',
          message: confirmError.message || 'Unable to confirm payment. Please try again.',
          type: 'error',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
        setIsProcessingPayment(false);
        return;
      }

      // Step 3: Handle payment result
      if (paymentIntent && paymentIntent.status === 'Succeeded') {
        // Confirm payment with backend to update invoice status
        await confirmPaymentWithBackend(paymentIntentId, selectedInvoice.id);

        setAlertConfig({
          title: 'Payment Successful',
          message: `Your payment of $${selectedInvoice.amount} for invoice ${selectedInvoice.invoice_number} has been processed successfully!`,
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: async () => {
                setSelectedInvoice(null);
                setCardHolder('');
                setCardDetails(null);
                setActiveTab('invoices');
                await fetchInvoices();
                navigation.goBack();
              },
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else if (paymentIntent && paymentIntent.status === 'Processing') {
        // Payment is processing - confirm with backend anyway
        await confirmPaymentWithBackend(paymentIntentId, selectedInvoice.id);
        setAlertConfig({
          title: 'Payment Processing',
          message: 'Your payment is being processed. Please check your invoices shortly.',
          type: 'info',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else if (paymentIntent && paymentIntent.status === 'RequiresAction') {
        // Payment requires 3D Secure - this is handled automatically by confirmPayment
        // But if it still requires action, we need to handle it
        setAlertConfig({
          title: 'Authentication Required',
          message: 'Your card requires additional authentication. Please complete the verification.',
          type: 'warning',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
        setIsProcessingPayment(false);
      } else {
        setAlertConfig({
          title: 'Payment Pending',
          message: 'Your payment is being processed. Please check your invoices shortly.',
          type: 'info',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      }
    } catch (err) {
      console.error('Payment error:', err);
      const message = err instanceof Error ? err.message : 'Unexpected error occurred while processing payment.';
      setAlertConfig({
        title: 'Payment Error',
        message: message,
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Download invoice PDF
  const downloadInvoicePDF = async (invoice) => {
    try {
      // Try different possible PDF URL fields
      const pdfUrl = invoice.pdf_url || 
                     invoice.invoice_url || 
                     invoice.download_url || 
                     invoice.file_url ||
                     invoice.pdf_file ||
                     invoice.invoice_pdf;
      
      // If no direct URL, construct it from invoice ID
      let finalUrl = pdfUrl;
      
      if (!finalUrl) {
        // Construct PDF URL from API base URL
        const BASE_URL = API_BASE_URL.replace('/api', '');
        finalUrl = `${BASE_URL}/invoices/${invoice.id}/pdf`;
      }
      
      // Ensure URL is absolute
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        const BASE_URL = API_BASE_URL.replace('/api', '');
        if (finalUrl.startsWith('/')) {
          finalUrl = `${BASE_URL}${finalUrl}`;
        } else {
          finalUrl = `${BASE_URL}/${finalUrl}`;
        }
      }
      
      console.log('Downloading invoice PDF:', finalUrl);
      
      // Check if URL can be opened
      const canOpen = await Linking.canOpenURL(finalUrl);
      
      if (canOpen) {
        // Open the URL - this will trigger download on most devices
        await Linking.openURL(finalUrl);
        
        setAlertConfig({
          title: 'Download Started',
          message: `Invoice ${invoice.invoice_number || invoice.id} is being downloaded. Check your downloads folder.`,
          type: 'success',
          buttons: [
            {
              text: 'OK',
              onPress: () => {},
              style: 'primary',
            },
          ],
        });
        setAlertVisible(true);
      } else {
        throw new Error('Unable to open download URL');
      }
    } catch (error) {
      console.error('Error downloading invoice PDF:', error);
      setAlertConfig({
        title: 'Download Error',
        message: 'Failed to download invoice PDF. Please try again later or use the View option.',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    }
  };

  // Open invoice PDF
  const openInvoicePDF = async (invoice) => {
    try {
      // Try different possible PDF URL fields
      const pdfUrl = invoice.pdf_url || 
                     invoice.invoice_url || 
                     invoice.download_url || 
                     invoice.file_url ||
                     invoice.pdf_file ||
                     invoice.invoice_pdf;
      
      // If no direct URL, construct it from invoice ID
      let finalUrl = pdfUrl;
      
      if (!finalUrl) {
        // Construct PDF URL from API base URL
        const BASE_URL = API_BASE_URL.replace('/api', '');
        finalUrl = `${BASE_URL}/invoices/${invoice.id}/pdf`;
      }
      
      // Ensure URL is absolute
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        const BASE_URL = API_BASE_URL.replace('/api', '');
        if (finalUrl.startsWith('/')) {
          finalUrl = `${BASE_URL}${finalUrl}`;
        } else {
          finalUrl = `${BASE_URL}/${finalUrl}`;
        }
      }
      
      console.log('Opening invoice PDF:', finalUrl);
      
      // Check if URL can be opened
      const canOpen = await Linking.canOpenURL(finalUrl);
      
      if (canOpen) {
        await Linking.openURL(finalUrl);
      } else {
        // If direct opening fails, try to open anyway (some PDFs might work)
        try {
          await Linking.openURL(finalUrl);
        } catch (error) {
          console.error('Error opening PDF:', error);
          setAlertConfig({
            title: 'Error',
            message: 'Unable to open invoice PDF. Please try downloading it instead.',
            type: 'error',
            buttons: [
              {
                text: 'OK',
                onPress: () => {},
                style: 'primary',
              },
            ],
          });
          setAlertVisible(true);
        }
      }
    } catch (error) {
      console.error('Error opening invoice PDF:', error);
      setAlertConfig({
        title: 'Error',
        message: 'Failed to open invoice PDF. Please try again later.',
        type: 'error',
        buttons: [
          {
            text: 'OK',
            onPress: () => {},
            style: 'primary',
          },
        ],
      });
      setAlertVisible(true);
    }
  };

  const handleInvoiceAction = (invoice, action) => {
    console.log('=== handleInvoiceAction ===', {
      action,
      invoiceId: invoice?.id,
      invoiceNumber: invoice?.invoice_number,
      amount: invoice?.amount,
    });
    
    if (action === 'pay') {
      console.log('Setting invoice for payment:', invoice);
      setActiveTab('payment');
      setSelectedInvoice(invoice); // Set the selected invoice for payment
      // You could also set the payment amount based on the invoice
    } else if (action === 'download') {
      // Download PDF invoice
      downloadInvoicePDF(invoice);
    } else if (action === 'view') {
      // Open PDF invoice
      openInvoicePDF(invoice);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'overdue': return '#F44336';
      case 'unpaid': return '#F44336';
      default: return '#666';
    }
  };

  const getStatusText = (status) => {
    switch (status?.toLowerCase()) {
      case 'paid': return 'Paid';
      case 'pending': return 'Pending';
      case 'overdue': return 'Overdue';
      case 'unpaid': return 'Unpaid';
      default: return 'Unknown';
    }
  };

  const InvoiceCard = ({ invoice }) => (
    <View style={styles.invoiceCard}>
      <View style={styles.invoiceHeader}>
        <View style={styles.invoiceInfo}>
          <Text style={styles.invoiceId}>{invoice.invoice_number}</Text>
          <Text style={styles.invoiceDate}>{invoice.created_at}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(invoice.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(invoice.status) }]}>
            {getStatusText(invoice.status)}
          </Text>
        </View>
      </View>
      
      <Text style={styles.invoiceDescription}>{invoice.description}</Text>
      
      <View style={styles.invoiceDetails}>
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Due Date:</Text>
          <Text style={styles.invoiceValue}>{invoice.due_date}</Text>
        </View>
        <View style={styles.invoiceRow}>
          <Text style={styles.invoiceLabel}>Amount:</Text>
          <Text style={styles.invoiceAmount}>${invoice.amount}</Text>
        </View>
        {invoice.subscription_plan && (
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Plan:</Text>
            <Text style={styles.invoiceValue}>{invoice.subscription_plan.name}</Text>
          </View>
        )}
        {invoice.paid_date && invoice.status === 'paid' && (
          <View style={styles.invoiceRow}>
            <Text style={styles.invoiceLabel}>Paid Date:</Text>
            <Text style={styles.invoiceValue}>{invoice.paid_date}</Text>
          </View>
        )}
      </View>

      <View style={styles.invoiceActions}>
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleInvoiceAction(invoice, 'view')}
        >
          <Ionicons name="eye-outline" size={14} color="#666" />
          <Text style={styles.actionButtonText}>View</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.actionButton} 
          onPress={() => handleInvoiceAction(invoice, 'download')}
        >
          <Ionicons name="download-outline" size={14} color="#666" />
          <Text style={styles.actionButtonText}>Download</Text>
        </TouchableOpacity>
        
        {invoice.status === 'pending' || invoice.status === 'overdue' || invoice.status === 'unpaid' ? (
          <TouchableOpacity 
            style={[styles.actionButton, styles.payActionButton]} 
            onPress={() => handleInvoiceAction(invoice, 'pay')}
          >
            <Ionicons name="card-outline" size={14} color="#fff" />
            <Text style={[styles.actionButtonText, styles.payActionButtonText]}>Pay</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );



  // Show loading state
  if (loading) {
    return (
      <View style={styles.container}>
        <HeaderBar
          onMenuPress={() => setMenuVisible(true)}
        />
        <View style={[styles.loadingContainer, { paddingTop: insets.top + 80 }]}>
          <ActivityIndicator size="large" color="#222" />
          <Text style={styles.loadingText}>Loading invoices...</Text>
        </View>
      </View>
    );
  }

  // Show error state
  if (error) {
    return (
      <View style={styles.container}>
        <HeaderBar
          onMenuPress={() => setMenuVisible(true)}
        />
        <View style={[styles.errorContainer, { paddingTop: insets.top + 80 }]}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchInvoices}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Menu Modal */}
      <MenuModal
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        menuItems={menuItems}
        renderMenuIcon={renderMenuIcon}
        onMenuItemPress={handleMenuItemPress}
      />
      
      {/* Fixed Header */}
      <HeaderBar
        onMenuPress={() => setMenuVisible(true)}
      />
      
      <ScrollView 
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 80 }]} 
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        {/* Title */}
        <Text style={styles.title}>Payment & Invoices</Text>
        
        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'invoices' && styles.activeTab]} 
            onPress={() => {
              console.log('=== Invoices Tab Pressed ===');
              setActiveTab('invoices');
              setSelectedInvoice(null);
            }}
          >
            <Text style={[styles.tabText, activeTab === 'invoices' && styles.activeTabText]}>
              Invoices ({invoices.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.tab, activeTab === 'payment' && styles.activeTab]} 
            onPress={() => {
              console.log('=== Payment Tab Pressed ===', {
                invoicesCount: invoices.length,
                selectedInvoice: selectedInvoice?.id || null,
              });
              if (invoices.length === 0) {
                setAlertConfig({
                  title: 'No Invoices',
                  message: 'You need to have invoices to make a payment. Please check back later.',
                  type: 'info',
                  buttons: [
                    {
                      text: 'OK',
                      onPress: () => {},
                      style: 'primary',
                    },
                  ],
                });
                setAlertVisible(true);
                return;
              }
              setActiveTab('payment');
            }}
          >
            <Text style={[styles.tabText, activeTab === 'payment' && styles.activeTabText]}>
              Make Payment
            </Text>
          </TouchableOpacity>
        </View>

        {/* Invoices Tab */}
        {activeTab === 'invoices' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Invoices</Text>
            
            {invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} />
            ))}
            
            {invoices.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="document-outline" size={40} color="#ccc" />
                <Text style={styles.emptyStateText}>No invoices found</Text>
                <Text style={styles.emptyStateSubtext}>Your invoices will appear here</Text>
                <TouchableOpacity style={styles.refreshButton} onPress={fetchInvoices}>
                  <MaterialCommunityIcons name="refresh" size={16} color="#fff" />
                  <Text style={styles.refreshButtonText}>Refresh</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Payment Tab */}
        {activeTab === 'payment' && (
          <>
            {!selectedInvoice && (
              <View style={styles.section}>
                <View style={styles.infoCard}>
                  <Ionicons name="information-circle-outline" size={20} color="#2196F3" />
                  <Text style={styles.infoText}>
                    To make a payment, please go to the Invoices tab and select an invoice to pay.
                  </Text>
                  <TouchableOpacity 
                    style={styles.infoButton}
                    onPress={() => setActiveTab('invoices')}
                  >
                    <Text style={styles.infoButtonText}>Go to Invoices</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            
            {/* Card Details Form */}
            <CardDetailsForm
              stripe={stripe}
              cardHolder={cardHolder}
              onCardHolderChange={handleCardHolderChange}
              onCardFieldChange={handleCardFieldChange}
            />

            {/* Payment Summary */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {selectedInvoice ? 'Payment Summary' : 'Select an Invoice to Pay'}
              </Text>
              
              {selectedInvoice ? (
                <View style={styles.summaryCard}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>
                      {selectedInvoice.subscription_plan?.name || 'Premium Membership'}
                    </Text>
                    <Text style={styles.summaryValue}>${selectedInvoice.amount}</Text>
                  </View>
                  {selectedInvoice.description && (
                    <View style={styles.summaryRow}>
                      <Text style={styles.summaryLabel}>Description:</Text>
                      <Text style={styles.summaryValue}>{selectedInvoice.description}</Text>
                    </View>
                  )}
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Invoice Number:</Text>
                    <Text style={styles.summaryValue}>{selectedInvoice.invoice_number}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>Due Date:</Text>
                    <Text style={styles.summaryValue}>{selectedInvoice.due_date}</Text>
                  </View>
                  <View style={[styles.summaryRow, styles.summaryTotal]}>
                    <Text style={styles.summaryTotalLabel}>Total Amount</Text>
                    <Text style={styles.summaryTotalValue}>${selectedInvoice.amount}</Text>
                  </View>
                </View>
              ) : (
                <View style={styles.noInvoiceSelected}>
                  <Ionicons name="document-outline" size={40} color="#ccc" />
                  <Text style={styles.noInvoiceText}>No invoice selected</Text>
                  <Text style={styles.noInvoiceSubtext}>Go to the Invoices tab and select an invoice to pay</Text>
                </View>
              )}
            </View>

            {/* Debug Info - Remove after debugging */}
            {__DEV__ && (
              <View style={styles.debugContainer}>
                <Text style={styles.debugText}>
                  Debug: selectedInvoice={selectedInvoice ? 'Yes' : 'No'}, 
                  isProcessing={isProcessingPayment ? 'Yes' : 'No'}, 
                  isCardValid={isCardValid ? 'Yes' : 'No'}
                </Text>
                <Text style={styles.debugText}>
                  cardDetails.complete={cardDetails?.complete?.toString() || 'null'}, 
                  cardHolder={`${cardHolder}`}
                </Text>
              </View>
            )}

            {/* Pay Button */}
            <TouchableOpacity 
              style={[
                styles.payButton, 
                (!selectedInvoice || isProcessingPayment || !isCardValid) && styles.payButtonDisabled
              ]} 
              onPress={handlePayment}
              disabled={
                !selectedInvoice || 
                isProcessingPayment || 
                !isCardValid
              }
            >
              <Text style={[
                styles.payButtonText, 
                (!selectedInvoice || isProcessingPayment || !isCardValid) && styles.payButtonTextDisabled
              ]}>
                {isProcessingPayment
                  ? 'Processing...'
                  : selectedInvoice
                    ? `Pay $${selectedInvoice.amount}`
                    : 'Select Invoice to Pay'}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Back Button */}
      <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={16} color="#fff" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>
      
      {/* Modern Alert */}
      <ModernAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f8f2',
  },
  scrollContent: {
    paddingBottom: 140,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 13,
    color: '#888',
    marginTop: 12,
    fontWeight: '500',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 13,
    color: '#e74c3c',
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '500',
  },
  retryButton: {
    backgroundColor: '#222',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: '#1a1a1a',
    marginBottom: 18,
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 4,
    marginBottom: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#222',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
    letterSpacing: 0.3,
  },
  activeTabText: {
    color: '#fff',
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  invoiceCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  invoiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 18,
  },
  invoiceDate: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  invoiceDescription: {
    fontSize: 13,
    color: '#1a1a1a',
    marginBottom: 10,
    lineHeight: 18,
    fontWeight: '500',
  },
  invoiceDetails: {
    marginBottom: 10,
  },
  invoiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  invoiceLabel: {
    fontSize: 11,
    color: '#666',
    fontWeight: '600',
  },
  invoiceValue: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: '500',
  },
  invoiceAmount: {
    fontSize: 13,
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
  invoiceActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f8f8f8',
  },
  actionButtonText: {
    fontSize: 11,
    color: '#666',
    marginLeft: 4,
    fontWeight: '600',
  },
  payActionButton: {
    backgroundColor: '#222',
  },
  payActionButtonText: {
    color: '#fff',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    marginTop: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 6,
    marginBottom: 20,
    textAlign: 'center',
  },
  refreshButton: {
    backgroundColor: '#222',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  inputContainer: {
    marginBottom: 12,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#1a1a1a',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfWidth: {
    width: '48%',
  },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#888',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 10,
  },
  summaryTotalLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  summaryTotalValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1a1a1a',
  },
  payButton: {
    backgroundColor: '#222',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    marginTop: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  payButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  backButton: {
    position: 'absolute',
    bottom: '5%',
    left: '50%',
    transform: [{ translateX: -50 }],
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  backText: {
    color: '#fff',
    marginLeft: 8,
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.3,
  },
  menuItem: {
    flexDirection: 'column',
    alignItems: 'center',
    padding: 10,
  },
  menuItemLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 5,
    color: '#000',
  },
  payButtonDisabled: {
    backgroundColor: '#ccc',
  },
  payButtonTextDisabled: {
    color: '#999',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFCDD2',
  },
  errorCardText: {
    fontSize: 13,
    color: '#C62828',
    marginLeft: 10,
    flex: 1,
    lineHeight: 18,
  },
  cardFieldContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  cardField: {
    width: '100%',
    height: 50,
  },
  noInvoiceSelected: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 30,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  noInvoiceText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
    marginBottom: 6,
  },
  noInvoiceSubtext: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginTop: 6,
  },
  infoCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BBDEFB',
  },
  infoText: {
    fontSize: 13,
    color: '#1976D2',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 10,
    marginBottom: 12,
    fontWeight: '500',
  },
  infoButton: {
    backgroundColor: '#2196F3',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  debugContainer: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FFC107',
  },
  debugText: {
    fontSize: 11,
    color: '#856404',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

export default PaymentScreen;
