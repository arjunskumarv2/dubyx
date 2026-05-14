import 'package:flutter/material.dart';
import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'new_order_screen.dart';
import 'package:intl/intl.dart';
import 'package:iconsax/iconsax.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  final _api = ApiService();
  List<Order> _orders = [];
  bool _loading = true;
  String _statusFilter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/orders', params: _statusFilter.isNotEmpty ? {'status': _statusFilter} : null);
      setState(() {
        _orders = (data as List).map((o) => Order.fromJson(o)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  Color _statusColor(String s) {
    switch (s) {
      case 'PENDING': return AppTheme.warning;
      case 'CONFIRMED': return Colors.blue;
      case 'DELIVERED': return AppTheme.success;
      case 'CANCELLED': return AppTheme.textGray;
      default: return AppTheme.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00');

    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final ok = await Navigator.push(context, MaterialPageRoute(builder: (_) => const NewOrderScreen()));
          if (ok == true) _load();
        },
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Order', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: Column(children: [
        // Status Filter
        Container(
          color: AppTheme.primary,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: ['', 'PENDING', 'CONFIRMED', 'DELIVERED', 'CANCELLED'].map((s) =>
              GestureDetector(
                onTap: () { setState(() { _statusFilter = s; _loading = true; }); _load(); },
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(color: _statusFilter == s ? Colors.white : Colors.white24, borderRadius: BorderRadius.circular(20)),
                  child: Text(s.isEmpty ? 'All' : s, style: TextStyle(color: _statusFilter == s ? AppTheme.primary : Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
                ),
              ),
            ).toList()),
          ),
        ),

        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
            onRefresh: _load,
            color: AppTheme.primary,
            child: _orders.isEmpty
              ? const Center(child: Text('No orders found', style: TextStyle(color: AppTheme.textGray)))
              : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _orders.length,
                itemBuilder: (ctx, i) {
                  final order = _orders[i];
                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Text(order.orderNumber, style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary, fontFamily: 'monospace')),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: _statusColor(order.status).withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                            child: Text(order.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor(order.status))),
                          ),
                        ]),
                        const SizedBox(height: 6),
                        Row(children: [
                          const Icon(Iconsax.shop, size: 13, color: AppTheme.textGray),
                          const SizedBox(width: 4),
                          Text(order.customerName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        ]),
                        const SizedBox(height: 2),
                        Text('${order.items.length} items • ${DateFormat('dd MMM yyyy, hh:mm a').format(order.createdAt)}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                        const SizedBox(height: 8),
                        Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                          Text('QAR ${fmt.format(order.total)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 17, color: AppTheme.textDark)),
                          if (order.notes != null && order.notes!.isNotEmpty)
                            const Icon(Iconsax.note_text, size: 14, color: AppTheme.textGray),
                        ]),
                      ]),
                    ),
                  );
                },
              ),
          )),
      ]),
    );
  }
}
