import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
class RouteScreen extends StatefulWidget {
  const RouteScreen({super.key});

  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  final _api = ApiService();
  List<dynamic> _routes = [];
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadRoutes();
  }

  Future<void> _loadRoutes() async {
    try {
      final data = await _api.get('/routes');
      if (mounted) setState(() { _routes = data as List; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _checkIn(Map<String, dynamic> customer) async {
    final hasPermission = await _requestLocationPermission();
    if (!hasPermission) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Location permission required'), backgroundColor: AppTheme.error));
      return;
    }

    // Get GPS
    late Position position;
    try {
      position = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high).timeout(const Duration(seconds: 10));
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Could not get location'), backgroundColor: AppTheme.error));
      return;
    }

    // Take selfie
    final picker = ImagePicker();
    final photo = await picker.pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 800);

    if (!mounted) return;

    // Show confirmation dialog
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Confirm Check-in', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Customer: ${customer['shopName']}', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('GPS: ${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}', style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
          if (photo != null) ...[
            const SizedBox(height: 12),
            ClipRRect(borderRadius: BorderRadius.circular(8), child: Image.file(File(photo.path), height: 120, width: double.infinity, fit: BoxFit.cover)),
          ] else
            const Padding(padding: EdgeInsets.only(top: 8), child: Text('No selfie captured', style: TextStyle(fontSize: 12, color: AppTheme.textGray))),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Check In')),
        ],
      ),
    );

    if (confirm != true || !mounted) return;

    try {
      final request = await _api.multipartPost(
        '/checkins',
        {
          'customerId': customer['id'],
          'latitude': position.latitude.toString(),
          'longitude': position.longitude.toString(),
        },
        photo != null ? {'selfie': photo.path} : {},
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Checked in at ${customer['shopName']}'),
          backgroundColor: AppTheme.success,
        ));
      }
      debugPrint('Check-in response: $request');
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Check-in failed: $e'), backgroundColor: AppTheme.error));
    }
  }

  Future<bool> _requestLocationPermission() async {
    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    return permission == LocationPermission.always || permission == LocationPermission.whileInUse;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(title: const Text('My Routes', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700))),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
        : RefreshIndicator(
          color: AppTheme.primary,
          onRefresh: _loadRoutes,
          child: _routes.isEmpty
            ? Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                Icon(Icons.route_outlined, size: 64, color: Colors.grey.shade300),
                const SizedBox(height: 12),
                Text('No routes assigned', style: TextStyle(color: Colors.grey.shade500, fontSize: 16)),
                const SizedBox(height: 4),
                Text('Contact your manager', style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
              ]))
            : ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _routes.length,
              itemBuilder: (ctx, i) {
                final route = _routes[i];
                final stops = (route['stops'] as List?) ?? [];
                return Container(
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFF0F0F0)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 10, offset: const Offset(0, 2))],
                  ),
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: const BoxDecoration(
                        color: AppTheme.primary,
                        borderRadius: BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16)),
                      ),
                      child: Row(children: [
                        const Icon(Icons.route, color: Colors.white, size: 18),
                        const SizedBox(width: 8),
                        Expanded(child: Text(route['name'] ?? '', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15))),
                        Text('${stops.length} stops', style: const TextStyle(color: Colors.white70, fontSize: 12)),
                      ]),
                    ),
                    if (stops.isEmpty)
                      const Padding(padding: EdgeInsets.all(16), child: Text('No stops', style: TextStyle(color: AppTheme.textGray)))
                    else
                      ...stops.asMap().entries.map((e) {
                        final idx = e.key;
                        final stop = e.value;
                        final customer = stop['customer'] as Map<String, dynamic>? ?? {};
                        return Container(
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                          decoration: BoxDecoration(
                            border: idx < stops.length - 1 ? const Border(bottom: BorderSide(color: Color(0xFFF5F5F5))) : null,
                          ),
                          child: Row(children: [
                            Container(
                              width: 28, height: 28,
                              decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.1), shape: BoxShape.circle),
                              child: Center(child: Text('${stop['stopOrder']}', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w800, fontSize: 12))),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Text(customer['shopName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                              Text('${customer['ownerName'] ?? ''} • ${customer['area'] ?? ''}', style: const TextStyle(color: AppTheme.textGray, fontSize: 11)),
                              if (customer['phone'] != null)
                                Text(customer['phone'], style: const TextStyle(color: AppTheme.textGray, fontSize: 11)),
                            ])),
                            ElevatedButton.icon(
                              onPressed: () => _checkIn(customer),
                              icon: const Icon(Icons.camera_alt_outlined, size: 14),
                              label: const Text('Check In', style: TextStyle(fontSize: 12)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppTheme.gold,
                                foregroundColor: Colors.white,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ]),
                        );
                      }),
                  ]),
                );
              },
            ),
        ),
    );
  }
}
