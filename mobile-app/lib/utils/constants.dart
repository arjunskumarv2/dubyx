class AppConstants {
  static const String appName = 'Dubyx';
  /// API host. Override at build time without touching source:
  ///   flutter build apk --release --dart-define=API_BASE_URL=https://api.example.com/api
  static const String apiBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'https://dubyx.onrender.com/api',
  );

  // Brand colors
  static const int primaryColor = 0xFF8D1B3D;
  static const int goldColor = 0xFFC9A84C;
  static const int backgroundColor = 0xFFF8F5F0;

  // Storage keys
  static const String tokenKey = 'dubyx_token';
  static const String userKey = 'dubyx_user';

  // GPS
  static const int gpsIntervalSeconds = 30;

  // WhatsApp
  static const String whatsappScheme = 'whatsapp://send';
}
