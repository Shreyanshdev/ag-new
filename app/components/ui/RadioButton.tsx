import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import { RadioButtonProps } from '../../../types/types';

const RadioButton: React.FC<RadioButtonProps> = ({
  label,
  value,
  selectedValue,
  onPress,
}) => {
  const isSelected = value === selectedValue;

  return (
    <TouchableOpacity style={styles.radioButton} onPress={() => onPress(value)}>
      <View style={styles.radioCircle}>
        {isSelected && <View style={styles.selectedRadioCircle} />}
      </View>
      <Text style={styles.radioLabel}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  radioButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginRight: 20,
  },
  radioCircle: {
    height: 20,
    width: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  selectedRadioCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#22c55e',
  },
  radioLabel: {
    fontSize: 16,
    color: '#333',
  },
});

export default RadioButton;
