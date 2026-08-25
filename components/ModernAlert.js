import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const ModernAlert = ({ visible, title, message, type = 'info', onClose, buttons = [] }) => {
  const scaleValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.spring(scaleValue, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      scaleValue.setValue(0);
    }
  }, [visible]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return { name: 'checkmark-circle', color: '#4CAF50' };
      case 'error':
        return { name: 'close-circle', color: '#F44336' };
      case 'warning':
        return { name: 'warning', color: '#FF9800' };
      case 'info':
      default:
        return { name: 'information-circle', color: '#2196F3' };
    }
  };

  const icon = getIcon();

  const defaultButtons = buttons.length > 0 
    ? buttons 
    : [{ text: 'OK', onPress: onClose, style: 'primary' }];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.alertContainer,
            {
              transform: [{ scale: scaleValue }],
            },
          ]}
        >
          <View style={styles.iconContainer}>
            <View style={[styles.iconCircle, { backgroundColor: `${icon.color}15` }]}>
              <Ionicons name={icon.name} size={48} color={icon.color} />
            </View>
          </View>

          {title && <Text style={styles.title}>{title}</Text>}
          {message && <Text style={styles.message}>{message}</Text>}

          <View style={styles.buttonContainer}>
            {defaultButtons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  button.style === 'primary' && styles.primaryButton,
                  button.style === 'secondary' && styles.secondaryButton,
                  button.style === 'danger' && styles.dangerButton,
                  defaultButtons.length > 1 && styles.buttonWithMargin,
                ]}
                onPress={() => {
                  if (button.onPress) {
                    button.onPress();
                  }
                  if (button.autoClose !== false) {
                    onClose();
                  }
                }}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.buttonText,
                    button.style === 'primary' && styles.primaryButtonText,
                    button.style === 'secondary' && styles.secondaryButtonText,
                    button.style === 'danger' && styles.dangerButtonText,
                  ]}
                >
                  {button.text}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  alertContainer: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  iconContainer: {
    marginBottom: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#222',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonWithMargin: {
    marginHorizontal: 6,
  },
  primaryButton: {
    backgroundColor: '#222',
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
  dangerButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#222', // Default color
  },
  primaryButtonText: {
    color: '#fff',
  },
  secondaryButtonText: {
    color: '#222',
  },
  dangerButtonText: {
    color: '#fff',
  },
});

export default ModernAlert;

