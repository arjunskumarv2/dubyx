import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:geolocator/geolocator.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'package:iconsax/iconsax.dart';
import 'package:intl/intl.dart';

class RouteScreen extends StatefulWidget {
  const RouteScreen({super.key});

  @override
  State<RouteScreen> createState() => _RouteScreenState();
}

class _RouteScreenState extends State<RouteScreen> {
  final _api = ApiService();
  List<dynamic> _routes = [];
  Map<String, dynamic>? _attendance;
  bool _loading = true;
  bool _checkingIn = false;
  bool _checkingOut = false;

  @override
  void initState() {
    super.initState();
    _loadAll();
  }

  Future<void> _loadAll() async {
    try {
      final results = await Future.wait([
        _api.get('/routes'),
        _api.get('/attendance/today'),
      ]);
      if (mounted) {
        setState(() {
          _routes = results[0] as List;
          _attendance = results[1] as Map<String, dynamic>?;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<Position?> _getLocation() async {
    // Check if location services are enabled
    final serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (mounted) _showError('Location services are disabled. Please enable GPS.');
      return null;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        if (mounted) _showError('Location permission denied');
        return null;
      }
    }
    if (permission == LocationPermission.deniedForever) {
      if (mounted) _showError('Location permission permanently denied. Enable in Settings.');
      await Geolocator.openAppSettings();
      return null;
    }

    try {
      return await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
      ).timeout(const Duration(seconds: 15));
    } catch (_) {
      if (mounted) _showError('Could not get location. Please try again.');
      return null;
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppTheme.error));
  }

  Future<void> _attendanceCheckIn() async {
    setState(() => _checkingIn = true);
    final position = await _getLocation();
    if (position == null) { setState(() => _checkingIn = false); return; }

    final picker = ImagePicker();
    final photo = await picker.pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 800);
    if (!mounted) { setState(() => _checkingIn = false); return; }

    try {
      final result = await _api.multipartPost(
        '/attendance/checkin',
        {
          'latitude': position.latitude.toString(),
          'longitude': position.longitude.toString(),
        },
        photo != null ? {'photo': photo.path} : {},
      );
      if (mounted) {
        setState(() { _attendance = result as Map<String, dynamic>?; _checkingIn = false; });
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Checked in successfully!'), backgroundColor: AppTheme.success));
      }
    } catch (e) {
      if (mounted) {
        _showError(e.toString().replaceAll('Exception: ', ''));
        setState(() => _checkingIn = false);
      }
    }
  }

  Future<void> _attendanceCheckOut() async {
    setState(() => _checkingOut = true);
    final position = await _getLocation();
    if (position == null) { setState(() => _checkingOut = false); return; }

    final picker = ImagePicker();
    final photo = await picker.pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 800);
    if (!mounted) { setState(() => _checkingOut = false); return; }

    try {
      final result = await _api.multipartPost(
        '/attendance/checkout',
        {
          'latitude': position.latitude.toString(),
          'longitude': position.longitude.toString(),
        },
        photo != null ? {'photo': photo.path} : {},
      );
      if (mounted) {
        setState(() { _attendance = result as Map<String, dynamic>?; _checkingOut = false; });
        final mins = (result as Map<String, dynamic>)['totalMinutes'] as int? ?? 0;
        final h = mins ~/ 60;
        final m = mins % 60;
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
          content: Text('Checked out! Time: ${h}h ${m}m'),
          backgroundColor: AppTheme.success,
        ));
      }
    } catch (e) {
      if (mounted) {
        _showError(e.toString().replaceAll('Exception: ', ''));
        setState(() => _checkingOut = false);
      }
    }
  }

  Future<void> _customerCheckIn(Map<String, dynamic> customer) async {
    final position = await _getLocation();
    if (position == null) return;
    if (!mounted) return;

    final picker = ImagePicker();
    final photo = await picker.pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 800);
    if (!mounted) return;

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
      await _api.multipartPost(
        '/checkins',
        {
          'customerId': customer['id'],
          'latitude': position.latitude.toString(),
          'longitude': position.longitude.toString(),
        },
        photo != null ? {'selfie': photo.path} : {},
      );
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Checked in at ${customer['shopName']}'), backgroundColor: AppTheme.success));
    } catch (e) {
      if (mounted) _showError('Check-in failed: $e');
    }
  }

  Widget _buildAttendanceCard() {
    final hasCheckedIn = _attendance != null;
    final hasCheckedOut = hasCheckedIn && _attendance!['checkOutAt'] != null;
    final fmt = DateFormat('hh:mm a');

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: hasCheckedOut
            ? [AppTheme.textGray, AppTheme.textGray.withValues(alpha: 0.7)]
            : hasCheckedIn
              ? [AppTheme.success, const Color(0xFF16A34A)]
              : [AppTheme.primary, const Color(0xFF7A1535)],
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.1), blurRadius: 10, offset: const Offset(0, 4))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Row(children: [
          Container(padding: const EdgeInsets.all(8), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(10)),
            child: Icon(hasCheckedOut ? Iconsax.clock : hasCheckedIn ? Iconsax.location_tick : Iconsax.location, color: Colors.white, size: 20)),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(
              hasCheckedOut ? 'Day Completed' : hasCheckedIn ? 'Checked In' : 'Not Checked In',
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 15),
            ),
            Text(
              hasCheckedOut
                ? 'Checkout: ${fmt.format(DateTime.parse(_attendance!['checkOutAt']))}'
                : hasCheckedIn
                  ? 'Since: ${fmt.format(DateTime.parse(_attendance!['checkInAt']))}'
                  : 'Check in to start your day',
              style: const TextStyle(color: Colors.white70, fontSize: 12),
            ),
          ])),
          if (hasCheckedIn && !hasCheckedOut) ...[
            const SizedBox(width: 8),
            _DurationBadge(checkInAt: DateTime.parse(_attendance!['checkInAt'])),
          ],
        ]),

        if (hasCheckedOut && _attendance!['totalMinutes'] != null) ...[
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.15), borderRadius: BorderRadius.circular(10)),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _statItem('Check In', fmt.format(DateTime.parse(_attendance!['checkInAt']))),
              Container(width: 1, height: 30, color: Colors.white30),
              _statItem('Check Out', fmt.format(DateTime.parse(_attendance!['checkOutAt']))),
              Container(width: 1, height: 30, color: Colors.white30),
              _statItem('Duration', _formatDuration(_attendance!['totalMinutes'] as int)),
            ]),
          ),
        ],

        const SizedBox(height: 14),
        if (!hasCheckedIn)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _checkingIn ? null : _attendanceCheckIn,
              icon: _checkingIn
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary))
                : const Icon(Iconsax.location, size: 16, color: AppTheme.primary),
              label: Text(_checkingIn ? 'Getting location...' : 'Check In Now', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppTheme.primary, padding: const EdgeInsets.symmetric(vertical: 10)),
            ),
          )
        else if (!hasCheckedOut)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: _checkingOut ? null : _attendanceCheckOut,
              icon: _checkingOut
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.success))
                : const Icon(Iconsax.logout, size: 16, color: AppTheme.success),
              label: Text(_checkingOut ? 'Getting location...' : 'Check Out', style: const TextStyle(color: AppTheme.success, fontWeight: FontWeight.w700)),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.white, foregroundColor: AppTheme.success, padding: const EdgeInsets.symmetric(vertical: 10)),
            ),
          ),
      ]),
    );
  }

  Widget _statItem(String label, String value) => Column(children: [
    Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13)),
    Text(label, style: const TextStyle(color: Colors.white60, fontSize: 10)),
  ]);

  String _formatDuration(int minutes) {
    final h = minutes ~/ 60;
    final m = minutes % 60;
    return h > 0 ? '${h}h ${m}m' : '${m}m';
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
          onRefresh: _loadAll,
          child: CustomScrollView(
            slivers: [
              SliverToBoxAdapter(child: _buildAttendanceCard()),
              if (_routes.isEmpty)
                SliverFillRemaining(
                  child: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                    Icon(Icons.route_outlined, size: 64, color: Colors.grey.shade300),
                    const SizedBox(height: 12),
                    Text('No routes assigned', style: TextStyle(color: Colors.grey.shade500, fontSize: 16)),
                    const SizedBox(height: 4),
                    Text('Contact your manager', style: TextStyle(color: Colors.grey.shade400, fontSize: 13)),
                  ])),
                )
              else
                SliverList(
                  delegate: SliverChildBuilderDelegate(
                    (ctx, i) {
                      final route = _routes[i];
                      final stops = (route['stops'] as List?) ?? [];
                      return Container(
                        margin: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: const Color(0xFFF0F0F0)),
                          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 2))],
                        ),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Container(
                            padding: const EdgeInsets.all(14),
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
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                                decoration: BoxDecoration(
                                  border: idx < stops.length - 1 ? const Border(bottom: BorderSide(color: Color(0xFFF5F5F5))) : null,
                                ),
                                child: Row(children: [
                                  Container(
                                    width: 28, height: 28,
                                    decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
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
                                    onPressed: () => _customerCheckIn(customer),
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
                    childCount: _routes.length,
                  ),
                ),
            ],
          ),
        ),
    );
  }
}

class _DurationBadge extends StatefulWidget {
  final DateTime checkInAt;
  const _DurationBadge({required this.checkInAt});

  @override
  State<_DurationBadge> createState() => _DurationBadgeState();
}

class _DurationBadgeState extends State<_DurationBadge> {
  late final Stream<int> _stream;

  @override
  void initState() {
    super.initState();
    _stream = Stream.periodic(const Duration(minutes: 1), (_) {
      return DateTime.now().difference(widget.checkInAt).inMinutes;
    });
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<int>(
      stream: _stream,
      initialData: DateTime.now().difference(widget.checkInAt).inMinutes,
      builder: (ctx, snap) {
        final mins = snap.data ?? 0;
        final h = mins ~/ 60;
        final m = mins % 60;
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
          decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
          child: Text(h > 0 ? '${h}h ${m}m' : '${m}m', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
        );
      },
    );
  }
}
