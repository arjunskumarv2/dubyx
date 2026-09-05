import 'dart:io';
import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:iconsax/iconsax.dart';
import 'package:image_picker/image_picker.dart';
import 'package:intl/intl.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

/// Journey = the trip a van makes on a given day.
/// Either PLANNED (from the weekly journey plan the admin created) or
/// EMERGENCY (an unplanned run — urgent stock drop, customer call-out).
class JourneyScreen extends StatefulWidget {
  const JourneyScreen({super.key});

  @override
  State<JourneyScreen> createState() => _JourneyScreenState();
}

const _dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const _emergencyReasons = [
  'Emergency stock delivery — stock not available at shop',
  'Urgent customer request',
  'Urgent payment collection',
  'Vehicle breakdown / route change',
  'Other',
];

class _JourneyScreenState extends State<JourneyScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  late final TabController _tabs = TabController(length: 2, vsync: this);

  Map<String, dynamic>? _today;
  List<dynamic> _customers = [];
  bool _loading = true;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _tabs.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait([
        _api.get('/journeys/today'),
        _api.get('/customers'),
      ]);
      if (!mounted) return;
      setState(() {
        _today = results[0] as Map<String, dynamic>?;
        _customers = (results[1] as List?) ?? [];
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppTheme.error));
  }

  void _showOk(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg), backgroundColor: AppTheme.success));
  }

  List<dynamic> get _journeys => (_today?['journeys'] as List?) ?? [];
  Map<String, dynamic>? get _activeJourney {
    final active = _today?['activeJourney'];
    if (active is Map<String, dynamic>) return active;
    for (final j in _journeys) {
      if (j['status'] == 'IN_PROGRESS') return j as Map<String, dynamic>;
    }
    return null;
  }

  /* ─────────────── actions ─────────────── */

  Future<void> _startPlanned() async {
    setState(() => _busy = true);
    try {
      await _api.post('/journeys/start', {});
      await _load();
      _showOk('Journey started');
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _completeJourney(String journeyId) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Complete journey?', style: TextStyle(fontWeight: FontWeight.w700)),
        content: const Text('Mark this journey as finished for today.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
          ElevatedButton(onPressed: () => Navigator.pop(ctx, true), child: const Text('Complete')),
        ],
      ),
    );
    if (confirm != true) return;

    setState(() => _busy = true);
    try {
      await _api.post('/journeys/$journeyId/complete', {});
      await _load();
      _showOk('Journey completed');
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _setStopStatus(String journeyId, String stopId, String status) async {
    try {
      await _api.patch('/journeys/$journeyId/stops/$stopId', {'status': status});
      await _load();
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<void> _startEmergency() async {
    final result = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _EmergencySheet(customers: _customers),
    );
    if (result == null || !mounted) return;

    setState(() => _busy = true);
    try {
      await _api.post('/journeys/emergency', result);
      await _load();
      _showOk('Emergency journey started');
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _addStop(String journeyId) async {
    final customer = await showModalBottomSheet<Map<String, dynamic>>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => _CustomerPickerSheet(customers: _customers),
    );
    if (customer == null || !mounted) return;

    try {
      await _api.post('/journeys/$journeyId/stops', {'customerId': customer['id']});
      await _load();
      _showOk('${customer['shopName']} added to journey');
    } catch (e) {
      _showError(e.toString().replaceAll('Exception: ', ''));
    }
  }

  Future<Position?> _getLocation() async {
    if (!await Geolocator.isLocationServiceEnabled()) {
      _showError('Location services are disabled. Please enable GPS.');
      return null;
    }
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        _showError('Location permission denied');
        return null;
      }
    }
    if (permission == LocationPermission.deniedForever) {
      _showError('Location permission permanently denied. Enable in Settings.');
      await Geolocator.openAppSettings();
      return null;
    }
    try {
      return await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high)
          .timeout(const Duration(seconds: 15));
    } catch (_) {
      _showError('Could not get location. Please try again.');
      return null;
    }
  }

  /// Selfie + GPS check-in at a shop, which also marks the journey stop as visited.
  Future<void> _checkInAtStop(String journeyId, Map<String, dynamic> stop) async {
    final customer = (stop['customer'] as Map<String, dynamic>?) ?? {};
    final position = await _getLocation();
    if (position == null || !mounted) return;

    final photo = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 70, maxWidth: 800);
    if (!mounted) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text('Confirm Check-in', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Customer: ${customer['shopName']}', style: const TextStyle(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text('GPS: ${position.latitude.toStringAsFixed(5)}, ${position.longitude.toStringAsFixed(5)}',
              style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
          if (photo != null) ...[
            const SizedBox(height: 12),
            ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: Image.file(File(photo.path), height: 120, width: double.infinity, fit: BoxFit.cover),
            ),
          ],
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
          'customerId': customer['id'] as String,
          'latitude': position.latitude.toString(),
          'longitude': position.longitude.toString(),
        },
        photo != null ? {'selfie': photo.path} : {},
      );
      await _setStopStatus(journeyId, stop['id'] as String, 'VISITED');
      _showOk('Checked in at ${customer['shopName']}');
    } catch (e) {
      _showError('Check-in failed: ${e.toString().replaceAll('Exception: ', '')}');
    }
  }

  /* ─────────────── UI ─────────────── */

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('My Journey', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        bottom: TabBar(
          controller: _tabs,
          indicatorColor: AppTheme.gold,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          labelStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
          tabs: const [Tab(text: 'Today'), Tab(text: 'Weekly Plan')],
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _busy ? null : _startEmergency,
        backgroundColor: const Color(0xFFB45309),
        icon: const Icon(Iconsax.warning_2, color: Colors.white, size: 18),
        label: const Text('Emergency Visit', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : TabBarView(
              controller: _tabs,
              children: [_todayTab(), _weekTab()],
            ),
    );
  }

  Widget _todayTab() {
    final hasPlan = _today?['hasPlanToday'] == true;
    final plannedRoute = _today?['plannedRoute'] as Map<String, dynamic>?;
    final planDay = _today?['planDay'] as Map<String, dynamic>?;
    final dayName = _today?['dayName'] ?? _dayNames[DateTime.now().weekday % 7];

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          // Today's plan header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: hasPlan
                    ? [AppTheme.primary, const Color(0xFF7A1535)]
                    : [const Color(0xFF6B7280), const Color(0xFF4B5563)],
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Iconsax.calendar_1, color: Colors.white, size: 20),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('$dayName • ${DateFormat('dd MMM yyyy').format(DateTime.now())}',
                        style: const TextStyle(color: Colors.white70, fontSize: 11)),
                    const SizedBox(height: 2),
                    Text(
                      hasPlan ? (plannedRoute?['name'] ?? 'Planned route') : 'No route planned today',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16),
                    ),
                  ]),
                ),
              ]),
              const SizedBox(height: 8),
              Text(
                hasPlan
                    ? '${(plannedRoute?['stops'] as List?)?.length ?? 0} shops'
                        '${planDay?['startTime'] != null ? ' • starts ${planDay!['startTime']}' : ''}'
                    : 'You can still go out with an emergency visit.',
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
              if (hasPlan && _activeJourney == null) ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _busy ? null : _startPlanned,
                    icon: const Icon(Iconsax.play, size: 16, color: AppTheme.primary),
                    label: Text(_busy ? 'Starting...' : 'Start Journey',
                        style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w700)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 10),
                    ),
                  ),
                ),
              ],
            ]),
          ),
          const SizedBox(height: 16),

          if (_journeys.isEmpty)
            _emptyJourneys(hasPlan, plannedRoute)
          else
            ..._journeys.map((j) => _journeyCard(j as Map<String, dynamic>)),
        ],
      ),
    );
  }

  Widget _emptyJourneys(bool hasPlan, Map<String, dynamic>? plannedRoute) {
    final stops = (plannedRoute?['stops'] as List?) ?? [];
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      if (hasPlan && stops.isNotEmpty) ...[
        const Padding(
          padding: EdgeInsets.only(bottom: 8),
          child: Text("Today's shops", style: TextStyle(fontWeight: FontWeight.w700, color: AppTheme.textDark)),
        ),
        Container(
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF0F0F0)),
          ),
          child: Column(
            children: stops.asMap().entries.map((e) {
              final customer = (e.value['customer'] as Map<String, dynamic>?) ?? {};
              return _stopTile(
                index: e.value['stopOrder'] ?? (e.key + 1),
                customer: customer,
                status: 'PENDING',
                showDivider: e.key < stops.length - 1,
                trailing: const Text('Start journey', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
              );
            }).toList(),
          ),
        ),
      ] else
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF0F0F0)),
          ),
          child: Column(children: [
            Icon(Iconsax.map, size: 48, color: Colors.grey.shade300),
            const SizedBox(height: 10),
            Text('No journey today', style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w700)),
            const SizedBox(height: 4),
            const Text(
              'Nothing is scheduled. If you need to go out anyway, start an emergency visit.',
              textAlign: TextAlign.center,
              style: TextStyle(color: AppTheme.textGray, fontSize: 12),
            ),
          ]),
        ),
    ]);
  }

  Widget _journeyCard(Map<String, dynamic> journey) {
    final isEmergency = journey['type'] == 'EMERGENCY';
    final status = journey['status'] as String? ?? 'PENDING';
    final stops = (journey['stops'] as List?) ?? [];
    final visited = stops.where((s) => s['status'] == 'VISITED').length;
    final journeyId = journey['id'] as String;
    final accent = isEmergency ? const Color(0xFFB45309) : AppTheme.primary;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFF0F0F0)),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 2))],
      ),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: accent,
            borderRadius: const BorderRadius.only(topLeft: Radius.circular(16), topRight: Radius.circular(16)),
          ),
          child: Row(children: [
            Icon(isEmergency ? Iconsax.warning_2 : Icons.route, color: Colors.white, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(
                  isEmergency ? 'Emergency Visit' : (journey['route']?['name'] ?? 'Planned Journey'),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 15),
                ),
                Text('${journey['journeyNumber']} • $visited/${stops.length} visited',
                    style: const TextStyle(color: Colors.white70, fontSize: 11)),
              ]),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
              child: Text(status.replaceAll('_', ' '),
                  style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.w700)),
            ),
          ]),
        ),

        if (journey['reason'] != null)
          Container(
            width: double.infinity,
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            color: const Color(0xFFFFF7ED),
            child: Text('Reason: ${journey['reason']}', style: const TextStyle(fontSize: 11, color: Color(0xFF92400E))),
          ),

        if (stops.isEmpty)
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text('No shops added yet — tap "Add shop" below.', style: TextStyle(color: AppTheme.textGray, fontSize: 12)),
          )
        else
          ...stops.asMap().entries.map((e) {
            final stop = e.value as Map<String, dynamic>;
            final customer = (stop['customer'] as Map<String, dynamic>?) ?? {};
            final stopStatus = stop['status'] as String? ?? 'PENDING';
            final done = stopStatus != 'PENDING';
            return _stopTile(
              index: stop['stopOrder'] ?? (e.key + 1),
              customer: customer,
              status: stopStatus,
              showDivider: e.key < stops.length - 1,
              trailing: status == 'IN_PROGRESS' && !done
                  ? Row(mainAxisSize: MainAxisSize.min, children: [
                      IconButton(
                        tooltip: 'Skip',
                        onPressed: () => _setStopStatus(journeyId, stop['id'] as String, 'SKIPPED'),
                        icon: const Icon(Icons.skip_next, size: 18, color: AppTheme.textGray),
                        constraints: const BoxConstraints(),
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                      ),
                      ElevatedButton.icon(
                        onPressed: () => _checkInAtStop(journeyId, stop),
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
                    ])
                  : Text(
                      stopStatus == 'VISITED' ? 'Visited' : stopStatus == 'SKIPPED' ? 'Skipped' : '',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: stopStatus == 'VISITED' ? AppTheme.success : AppTheme.textGray,
                      ),
                    ),
            );
          }),

        if (status == 'IN_PROGRESS')
          Padding(
            padding: const EdgeInsets.all(12),
            child: Row(children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _addStop(journeyId),
                  icon: const Icon(Iconsax.add, size: 16),
                  label: const Text('Add shop'),
                  style: OutlinedButton.styleFrom(foregroundColor: AppTheme.primary),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _busy ? null : () => _completeJourney(journeyId),
                  icon: const Icon(Iconsax.tick_circle, size: 16),
                  label: const Text('Finish'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.success, foregroundColor: Colors.white),
                ),
              ),
            ]),
          ),
      ]),
    );
  }

  Widget _stopTile({
    required int index,
    required Map<String, dynamic> customer,
    required String status,
    required bool showDivider,
    required Widget trailing,
  }) {
    final visited = status == 'VISITED';
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        border: showDivider ? const Border(bottom: BorderSide(color: Color(0xFFF5F5F5))) : null,
      ),
      child: Row(children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: visited ? AppTheme.success.withValues(alpha: 0.15) : AppTheme.primary.withValues(alpha: 0.1),
            shape: BoxShape.circle,
          ),
          child: Center(
            child: visited
                ? const Icon(Icons.check, size: 15, color: AppTheme.success)
                : Text('$index', style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w800, fontSize: 12)),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(customer['shopName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            Text('${customer['ownerName'] ?? ''} • ${customer['area'] ?? ''}',
                style: const TextStyle(color: AppTheme.textGray, fontSize: 11)),
            if (customer['phone'] != null)
              Text(customer['phone'], style: const TextStyle(color: AppTheme.textGray, fontSize: 11)),
          ]),
        ),
        trailing,
      ]),
    );
  }

  Widget _weekTab() {
    final plan = _today?['plan'] as Map<String, dynamic>?;
    final days = (plan?['days'] as List?) ?? [];
    final todayDow = _today?['dayOfWeek'] as int? ?? (DateTime.now().weekday % 7);

    if (plan == null) {
      return RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: _load,
        child: ListView(padding: const EdgeInsets.all(32), children: [
          const SizedBox(height: 60),
          Icon(Iconsax.calendar_remove, size: 56, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          Center(child: Text('No journey plan assigned', style: TextStyle(color: Colors.grey.shade600, fontWeight: FontWeight.w700))),
          const SizedBox(height: 4),
          const Center(child: Text('Your manager has not created a weekly plan yet.',
              textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray, fontSize: 12))),
        ]),
      );
    }

    return RefreshIndicator(
      color: AppTheme.primary,
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 96),
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(14), border: Border.all(color: const Color(0xFFF0F0F0))),
            child: Row(children: [
              const Icon(Iconsax.calendar_1, color: AppTheme.primary, size: 18),
              const SizedBox(width: 10),
              Expanded(child: Text(plan['name'] ?? 'Weekly plan', style: const TextStyle(fontWeight: FontWeight.w700))),
              if (plan['vehicle'] != null)
                Text(plan['vehicle']['vehicleNumber'] ?? '', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
            ]),
          ),
          const SizedBox(height: 12),
          ...List.generate(7, (dow) {
            final day = days.cast<Map<String, dynamic>?>().firstWhere(
                  (d) => d?['dayOfWeek'] == dow,
                  orElse: () => null,
                );
            final isToday = dow == todayDow;
            final route = day?['route'] as Map<String, dynamic>?;
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: isToday ? AppTheme.primary.withValues(alpha: 0.06) : Colors.white,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: isToday ? AppTheme.primary.withValues(alpha: 0.35) : const Color(0xFFF0F0F0)),
              ),
              child: Row(children: [
                SizedBox(
                  width: 78,
                  child: Text(
                    _dayNames[dow],
                    style: TextStyle(
                      fontWeight: isToday ? FontWeight.w800 : FontWeight.w600,
                      fontSize: 13,
                      color: day == null ? AppTheme.textGray : AppTheme.textDark,
                    ),
                  ),
                ),
                Expanded(
                  child: day == null
                      ? const Text('Off', style: TextStyle(color: AppTheme.textGray, fontSize: 12))
                      : Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Text(route?['name'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                          Text(
                            '${(route?['stops'] as List?)?.length ?? 0} shops'
                            '${day['startTime'] != null ? ' • ${day['startTime']}' : ''}',
                            style: const TextStyle(color: AppTheme.textGray, fontSize: 11),
                          ),
                        ]),
                ),
                if (isToday)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(20)),
                    child: const Text('TODAY', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w800)),
                  ),
              ]),
            );
          }),
        ],
      ),
    );
  }
}

/* ─────────────── bottom sheets ─────────────── */

class _EmergencySheet extends StatefulWidget {
  final List<dynamic> customers;
  const _EmergencySheet({required this.customers});

  @override
  State<_EmergencySheet> createState() => _EmergencySheetState();
}

class _EmergencySheetState extends State<_EmergencySheet> {
  String _reason = _emergencyReasons.first;
  final _customReason = TextEditingController();
  final _notes = TextEditingController();
  final Set<String> _selected = {};

  @override
  void dispose() {
    _customReason.dispose();
    _notes.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final finalReason = _reason == 'Other' ? _customReason.text.trim() : _reason;
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.85),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFFB45309),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Row(children: [
              const Icon(Iconsax.warning_2, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              const Expanded(
                child: Text('Emergency Visit', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16)),
              ),
              IconButton(onPressed: () => Navigator.pop(context), icon: const Icon(Icons.close, color: Colors.white70)),
            ]),
          ),
          Flexible(
            child: ListView(padding: const EdgeInsets.all(16), shrinkWrap: true, children: [
              const Text('Going out without a plan? Tell the office why.',
                  style: TextStyle(color: AppTheme.textGray, fontSize: 12)),
              const SizedBox(height: 12),
              const Text('Reason', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
              const SizedBox(height: 6),
              ..._emergencyReasons.map((r) {
                final selected = _reason == r;
                return InkWell(
                  onTap: () => setState(() => _reason = r),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    child: Row(children: [
                      Icon(
                        selected ? Icons.radio_button_checked : Icons.radio_button_unchecked,
                        size: 18,
                        color: selected ? AppTheme.primary : AppTheme.textGray,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          r,
                          style: TextStyle(fontSize: 13, fontWeight: selected ? FontWeight.w600 : FontWeight.w400),
                        ),
                      ),
                    ]),
                  ),
                );
              }),
              if (_reason == 'Other')
                TextField(
                  controller: _customReason,
                  onChanged: (_) => setState(() {}),
                  decoration: const InputDecoration(hintText: 'Describe the reason', isDense: true),
                ),
              const SizedBox(height: 12),
              TextField(
                controller: _notes,
                decoration: const InputDecoration(labelText: 'Notes (optional)', isDense: true),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              Row(children: [
                const Text('Shops to visit', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                const Spacer(),
                Text('${_selected.length} selected', style: const TextStyle(color: AppTheme.textGray, fontSize: 11)),
              ]),
              const SizedBox(height: 4),
              const Text('Optional — you can also add shops later during the trip.',
                  style: TextStyle(color: AppTheme.textGray, fontSize: 11)),
              const SizedBox(height: 6),
              ...widget.customers.map((c) {
                final id = c['id'] as String;
                return CheckboxListTile(
                  value: _selected.contains(id),
                  onChanged: (v) => setState(() => v == true ? _selected.add(id) : _selected.remove(id)),
                  title: Text(c['shopName'] ?? '', style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
                  subtitle: Text(c['area'] ?? '', style: const TextStyle(fontSize: 11)),
                  dense: true,
                  contentPadding: EdgeInsets.zero,
                  controlAffinity: ListTileControlAffinity.leading,
                  activeColor: AppTheme.primary,
                );
              }),
            ]),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: finalReason.isEmpty
                      ? null
                      : () => Navigator.pop(context, {
                            'reason': finalReason,
                            'notes': _notes.text.trim(),
                            'customerIds': _selected.toList(),
                          }),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFB45309),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text('Start Emergency Journey', style: TextStyle(fontWeight: FontWeight.w700)),
                ),
              ),
            ),
          ),
        ]),
      ),
    );
  }
}

class _CustomerPickerSheet extends StatefulWidget {
  final List<dynamic> customers;
  const _CustomerPickerSheet({required this.customers});

  @override
  State<_CustomerPickerSheet> createState() => _CustomerPickerSheetState();
}

class _CustomerPickerSheetState extends State<_CustomerPickerSheet> {
  String _query = '';

  @override
  Widget build(BuildContext context) {
    final filtered = widget.customers.where((c) {
      final q = _query.toLowerCase();
      return q.isEmpty ||
          (c['shopName'] ?? '').toString().toLowerCase().contains(q) ||
          (c['area'] ?? '').toString().toLowerCase().contains(q);
    }).toList();

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
        constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.8),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              autofocus: true,
              onChanged: (v) => setState(() => _query = v),
              decoration: const InputDecoration(hintText: 'Search shop or area', prefixIcon: Icon(Iconsax.search_normal, size: 18), isDense: true),
            ),
          ),
          Flexible(
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: filtered.length,
              itemBuilder: (ctx, i) {
                final c = filtered[i] as Map<String, dynamic>;
                return ListTile(
                  dense: true,
                  title: Text(c['shopName'] ?? '', style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text('${c['ownerName'] ?? ''} • ${c['area'] ?? ''}', style: const TextStyle(fontSize: 11)),
                  onTap: () => Navigator.pop(context, c),
                );
              },
            ),
          ),
          const SafeArea(top: false, child: SizedBox(height: 8)),
        ]),
      ),
    );
  }
}
