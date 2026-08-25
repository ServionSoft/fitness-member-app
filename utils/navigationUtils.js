export const navigateToDashboard = (navigation) => {
  if (navigation && navigation.canGoBack()) {
    navigation.navigate('Dashboard');
  }
};

export const handleBackPress = (navigation) => {
  navigateToDashboard(navigation);
};