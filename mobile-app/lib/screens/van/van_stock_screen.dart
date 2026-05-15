import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'package:iconsax/iconsax.dart';

class VanStockScreen extends StatefulWidget {
  const VanStockScreen({super.key});

  @override
  State<VanStockScreen> createState() => _VanStockScreenState();
}

class _VanStockScreenState extends State<VanStockScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _vanData;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.get('/van-loads/my-stock');
      if (mounted) setState(() { _vanData = data; _loading = false; });
    } catch (e) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('My Van Stock'),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => Navigator.pop(context)),
      ),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: _load,
        child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _vanData == null || _vanData!['hasActiveLoad'] == false
            ? _buildNoLoad()
            : _buildVanStock(),
      ),
    );
  }

  Widget _buildNoLoad() => Center(
    child: Padding(
      padding: const EdgeInsets.all(32),
      child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
        Container(
          width: 80, height: 80,
          decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), shape: BoxShape.circle),
          child: const Icon(Iconsax.truck, size: 36, color: AppTheme.primary),
        ),
        const SizedBox(height: 20),
        const Text('No Active Van Load', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
        const SizedBox(height: 8),
        const Text('You have no products loaded to your van. Contact your manager to assign a van load.',
          textAlign: TextAlign.center, style: TextStyle(color: AppTheme.textGray, fontSize: 14)),
      ]),
    ),
  );

  Widget _buildVanStock() {
    final load = _vanData!['vanLoad'] as Map<String, dynamic>;
    final items = load['items'] as List;
    final loadNumber = load['loadNumber'] as String;
    final loadedAt = DateTime.tryParse(load['loadedAt'] ?? '');

    final totalLoaded = items.fold<int>(0, (s, i) => s + (i['loadedQty'] as int));
    final totalSold = items.fold<int>(0, (s, i) => s + (i['soldQty'] as int));
    final totalAvailable = items.fold<int>(0, (s, i) => s + (i['availableQty'] as int));

    return SingleChildScrollView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(16),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        Container(
          width: double.infinity,
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            gradient: const LinearGradient(colors: [AppTheme.primary, Color(0xFFB22351)], begin: Alignment.topLeft, end: Alignment.bottomRight),
            borderRadius: BorderRadius.circular(20),
            boxShadow: [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              const Icon(Iconsax.truck, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(loadNumber, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 18)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
                child: const Text('ACTIVE', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700)),
              ),
            ]),
            if (loadedAt != null) ...[
              const SizedBox(height: 4),
              Text('Loaded ${_formatDate(loadedAt)}', style: const TextStyle(color: Colors.white70, fontSize: 12)),
            ],
            const SizedBox(height: 16),
            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
              _StatPill(label: 'Loaded', value: '$totalLoaded'),
              _StatPill(label: 'Sold', value: '$totalSold'),
              _StatPill(label: 'Available', value: '$totalAvailable', highlight: true),
            ]),
          ]),
        ),

        const SizedBox(height: 20),
        Text('${items.length} Products', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
        const SizedBox(height: 12),

        ...items.map((item) {
          final product = item['product'] as Map<String, dynamic>;
          final loaded = item['loadedQty'] as int;
          final sold = item['soldQty'] as int;
          final returned = item['returnedQty'] as int;
          final available = item['availableQty'] as int;
          final soldFraction = loaded > 0 ? sold / loaded : 0.0;

          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF0F0F0)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(product['name'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.textDark)),
                  Text('${product['sku']} · ${product['unit']}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                ])),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                  decoration: BoxDecoration(
                    color: available > 0 ? AppTheme.primary.withValues(alpha: 0.1) : const Color(0xFFFEE2E2),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    '$available ${product['unit']}',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13,
                      color: available > 0 ? AppTheme.primary : const Color(0xFFDC2626),
                    ),
                  ),
                ),
              ]),
              const SizedBox(height: 12),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: soldFraction,
                  backgroundColor: const Color(0xFFF0F0F0),
                  valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.gold),
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 8),
              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                _SmallStat(label: 'Loaded', value: '$loaded', color: AppTheme.textGray),
                _SmallStat(label: 'Sold', value: '$sold', color: AppTheme.gold),
                _SmallStat(label: 'Returned', value: '$returned', color: const Color(0xFF3B82F6)),
                _SmallStat(label: 'Available', value: '$available', color: available > 0 ? AppTheme.primary : const Color(0xFFDC2626)),
              ]),
            ]),
          );
        }),
      ]),
    );
  }

  String _formatDate(DateTime d) {
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inDays == 0) return 'today';
    if (diff.inDays == 1) return 'yesterday';
    return '${d.day}/${d.month}/${d.year}';
  }
}

class _StatPill extends StatelessWidget {
  final String label;
  final String value;
  final bool highlight;

  const _StatPill({required this.label, required this.value, this.highlight = false});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: highlight ? Colors.white : Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(children: [
        Text(value, style: TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: highlight ? AppTheme.primary : Colors.white)),
        Text(label, style: TextStyle(fontSize: 10, color: highlight ? AppTheme.textGray : Colors.white70)),
      ]),
    );
  }
}

class _SmallStat extends StatelessWidget {
  final String label;
  final String value;
  final Color color;

  const _SmallStat({required this.label, required this.value, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(children: [
      Text(value, style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15, color: color)),
      Text(label, style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
    ]);
  }
}
