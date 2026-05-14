import 'dart:async';
import 'package:geolocator/geolocator.dart';
import 'api_service.dart';

class GpsService {
  static final GpsService _instance = GpsService._internal();
  factory GpsService() => _instance;
  GpsService._internal();

  final _api = ApiService();
  Timer? _timer;
  Position? _lastPosition;
  bool _isTracking = false;

  bool get isTracking => _isTracking;
  Position? get lastPosition => _lastPosition;

  Future<bool> requestPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  Future<Position?> getCurrentLocation() async {
    final hasPermission = await requestPermission();
    if (!hasPermission) return null;
    try {
      return await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
    } catch (e) {
      return null;
    }
  }

  void startTracking() {
    if (_isTracking) return;
    _isTracking = true;
    _sendLocation();
    _timer = Timer.periodic(const Duration(seconds: 30), (_) => _sendLocation());
  }

  void stopTracking() {
    _timer?.cancel();
    _timer = null;
    _isTracking = false;
  }

  Future<void> _sendLocation() async {
    try {
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      _lastPosition = pos;
      await _api.post('/gps/log', {
        'latitude': pos.latitude,
        'longitude': pos.longitude,
        'accuracy': pos.accuracy,
        'speed': pos.speed >= 0 ? pos.speed : null,
        'heading': pos.heading >= 0 ? pos.heading : null,
      });
    } catch (_) {}
  }
}
