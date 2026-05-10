import { Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// Guideline sizes are based on standard ~5" screen mobile device
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const scale = (size) => (width / guidelineBaseWidth) * size;
export const verticalScale = (size) => (height / guidelineBaseHeight) * size;
export const moderateScale = (size, factor = 0.5) => size + (scale(size) - size) * factor;

export const wp = (percentage) => {
  const value = (percentage * width) / 100;
  return Math.round(value);
};

export const hp = (percentage) => {
  const value = (percentage * height) / 100;
  return Math.round(value);
};
