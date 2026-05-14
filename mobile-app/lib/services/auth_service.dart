import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user.dart';
import '../utils/constants.dart';
import 'api_service.dart';

class AuthService {
  static final AuthService _instance = AuthService._internal();
  factory AuthService() => _instance;
  AuthService._internal();

  final _api = ApiService();
  User? _currentUser;
  User? get currentUser => _currentUser;

  Future<User?> getSavedUser() async {
    if (_currentUser != null) return _currentUser;
    final prefs = await SharedPreferences.getInstance();
    final userJson = prefs.getString(AppConstants.userKey);
    if (userJson != null) {
      _currentUser = User.fromJson(jsonDecode(userJson));
      return _currentUser;
    }
    return null;
  }

  Future<User> login(String email, String password) async {
    final data = await _api.post('/auth/login', {'email': email, 'password': password});
    final token = data['token'] as String;
    final user = User.fromJson(data['user']);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.tokenKey, token);
    await prefs.setString(AppConstants.userKey, jsonEncode(user.toJson()));

    _api.setToken(token);
    _currentUser = user;
    return user;
  }

  Future<void> logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.tokenKey);
    await prefs.remove(AppConstants.userKey);
    _api.clearToken();
    _currentUser = null;
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.containsKey(AppConstants.tokenKey);
  }
}
