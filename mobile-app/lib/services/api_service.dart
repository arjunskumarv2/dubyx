import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import '../utils/constants.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String? _token;

  Future<String?> get token async {
    if (_token != null) return _token;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(AppConstants.tokenKey);
    return _token;
  }

  void setToken(String t) => _token = t;
  void clearToken() => _token = null;

  Future<Map<String, String>> get _headers async {
    final t = await token;
    return {
      'Content-Type': 'application/json',
      if (t != null) 'Authorization': 'Bearer $t',
    };
  }

  Future<dynamic> get(String path, {Map<String, String>? params}) async {
    var uri = Uri.parse('${AppConstants.apiBaseUrl}$path');
    if (params != null) uri = uri.replace(queryParameters: params);
    final res = await http.get(uri, headers: await _headers);
    return _handle(res);
  }

  Future<dynamic> post(String path, Map<String, dynamic> body) async {
    final res = await http.post(
      Uri.parse('${AppConstants.apiBaseUrl}$path'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    return _handle(res);
  }

  Future<dynamic> patch(String path, Map<String, dynamic> body) async {
    final res = await http.patch(
      Uri.parse('${AppConstants.apiBaseUrl}$path'),
      headers: await _headers,
      body: jsonEncode(body),
    );
    return _handle(res);
  }

  Future<List<int>> getBytes(String path) async {
    final res = await http.get(Uri.parse('${AppConstants.apiBaseUrl}$path'), headers: await _headers);
    if (res.statusCode == 200) return res.bodyBytes;
    throw Exception('Failed to fetch file');
  }

  dynamic _handle(http.Response res) {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      if (res.body.isEmpty) return null;
      return jsonDecode(res.body);
    }
    final body = jsonDecode(res.body);
    throw Exception(body['message'] ?? 'Request failed (${res.statusCode})');
  }
}
