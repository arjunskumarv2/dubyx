import 'package:flutter/material.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'package:intl/intl.dart';
import 'package:iconsax/iconsax.dart';

class CollectionsScreen extends StatefulWidget {
  const CollectionsScreen({super.key});

  @override
  State<CollectionsScreen> createState() => _CollectionsScreenState();
}

class _CollectionsScreenState extends State<CollectionsScreen> with SingleTickerProviderStateMixin {
  final _api = ApiService();
  late TabController _tab;
  List _pending = [];
  List _recent = [];
  Map? _todayData;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _tab = TabController(length: 2, vsync: this);
    _load();
  }

  @override
  void dispose() { _tab.dispose(); super.dispose(); }

  Future<void> _load() async {
    try {
      final [pending, recent, today] = await Future.wait([
        _api.get('/collections/pending'),
        _api.get('/collections'),
        _api.get('/collections/today'),
      ]);
      setState(() {
        _pending = pending as List;
        _recent = recent as List;
        _todayData = today as Map;
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00');

    return Scaffold(
      appBar: AppBar(
        title: const Text('Collections'),
        bottom: TabBar(
          controller: _tab,
          indicatorColor: AppTheme.gold,
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white60,
          tabs: [
            Tab(text: 'Pending (${_pending.length})'),
            Tab(text: 'Recent'),
          ],
        ),
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
        : Column(children: [
          // Today's summary
          if (_todayData != null)
            Container(
              padding: const EdgeInsets.all(16),
              color: AppTheme.success.withOpacity(0.08),
              child: Row(children: [
                Container(width: 40, height: 40, decoration: BoxDecoration(color: AppTheme.success, borderRadius: BorderRadius.circular(10)),
                  child: const Icon(Iconsax.money_recive, color: Colors.white, size: 20)),
                const SizedBox(width: 12),
                Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Today\'s Collections', style: TextStyle(fontSize: 12, color: AppTheme.textGray)),
                  Text('QAR ${fmt.format(_todayData!['total'] ?? 0)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.success)),
                ]),
                const Spacer(),
                Text('${_todayData!['count'] ?? 0} txns', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
              ]),
            ),

          Expanded(child: TabBarView(
            controller: _tab,
            children: [
              // Pending
              RefreshIndicator(
                onRefresh: _load,
                color: AppTheme.primary,
                child: _pending.isEmpty
                  ? const Center(child: Text('No pending collections', style: TextStyle(color: AppTheme.textGray)))
                  : ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _pending.length,
                    itemBuilder: (ctx, i) {
                      final inv = _pending[i];
                      final balance = (inv['total'] as num) - (inv['paidAmount'] as num);
                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                              Text(inv['invoiceNumber'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary, fontSize: 13, fontFamily: 'monospace')),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: AppTheme.warning.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                                child: Text(inv['paymentStatus'] ?? '', style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppTheme.warning)),
                              ),
                            ]),
                            const SizedBox(height: 4),
                            Text(inv['customer']?['shopName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            Text('${inv['customer']?['area'] ?? ''} • ${inv['customer']?['phone'] ?? ''}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                            const SizedBox(height: 8),
                            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                const Text('Balance Due', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
                                Text('QAR ${fmt.format(balance)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.error)),
                              ]),
                              ElevatedButton.icon(
                                onPressed: () {},
                                icon: const Icon(Iconsax.money_send, size: 16),
                                label: const Text('Collect'),
                                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8), textStyle: const TextStyle(fontSize: 12)),
                              ),
                            ]),
                          ]),
                        ),
                      );
                    },
                  ),
              ),

              // Recent
              RefreshIndicator(
                onRefresh: _load,
                color: AppTheme.primary,
                child: ListView.builder(
                  padding: const EdgeInsets.all(16),
                  itemCount: _recent.length,
                  itemBuilder: (ctx, i) {
                    final c = _recent[i];
                    return Card(
                      margin: const EdgeInsets.only(bottom: 8),
                      child: ListTile(
                        leading: Container(width: 40, height: 40, decoration: BoxDecoration(color: AppTheme.success.withOpacity(0.1), borderRadius: BorderRadius.circular(10)),
                          child: const Icon(Iconsax.money_recive, color: AppTheme.success, size: 20)),
                        title: Text(c['customer']?['shopName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        subtitle: Text('${c['collectedBy']?['name'] ?? ''} • ${c['method']?.replaceAll('_', ' ')}', style: const TextStyle(fontSize: 11)),
                        trailing: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.end, children: [
                          Text('QAR ${fmt.format((c['amount'] as num))}', style: const TextStyle(fontWeight: FontWeight.w800, color: AppTheme.success)),
                          Text(DateFormat('dd MMM').format(DateTime.parse(c['collectedAt'])), style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
                        ]),
                      ),
                    );
                  },
                ),
              ),
            ],
          )),
        ]),
    );
  }
}
