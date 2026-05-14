import 'package:flutter/foundation.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/gps_service.dart';

class AuthProvider extends ChangeNotifier {
  final _auth = AuthService();
  final _gps = GpsService();

  User? _user;
  bool _isLoading = false;
  String? _error;

  User? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isLoggedIn => _user != null;

  Future<void> checkAuth() async {
    _user = await _auth.getSavedUser();
    if (_user != null) _startGps();
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _user = await _auth.login(email, password);
      _startGps();
      _isLoading = false;
      notifyListeners();
      return true;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    _gps.stopTracking();
    await _auth.logout();
    _user = null;
    notifyListeners();
  }

  void _startGps() {
    if (_user?.isSalesman == true) _gps.startTracking();
  }
}
