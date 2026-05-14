import 'package:flutter/material.dart';
import '../../models/customer.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'package:iconsax/iconsax.dart';
import 'package:url_launcher/url_launcher.dart';

class CustomersScreen extends StatefulWidget {
  const CustomersScreen({super.key});

  @override
  State<CustomersScreen> createState() => _CustomersScreenState();
}

class _CustomersScreenState extends State<CustomersScreen> {
  final _api = ApiService();
  List<Customer> _customers = [];
  bool _loading = true;
  String _search = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/customers');
      setState(() {
        _customers = (data as List).map((c) => Customer.fromJson(c)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Customer> get _filtered => _search.isEmpty
    ? _customers
    : _customers.where((c) => c.shopName.toLowerCase().contains(_search.toLowerCase()) || c.ownerName.toLowerCase().contains(_search.toLowerCase()) || c.phone.contains(_search)).toList();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: const InputDecoration(hintText: 'Search customers...', prefixIcon: Icon(Icons.search, size: 18, color: AppTheme.textGray)),
          ),
        ),
        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
            onRefresh: _load,
            color: AppTheme.primary,
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              itemCount: _filtered.length,
              itemBuilder: (ctx, i) {
                final c = _filtered[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.1), borderRadius: BorderRadius.circular(12)),
                        child: Center(child: Text(c.shopName[0].toUpperCase(), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w800, fontSize: 18))),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(c.shopName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        Text(c.ownerName, style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
                        Row(children: [
                          const Icon(Iconsax.location, size: 11, color: AppTheme.textGray),
                          const SizedBox(width: 2),
                          Text('${c.area}${c.route != null ? ' • ${c.route}' : ''}', style: const TextStyle(color: AppTheme.textGray, fontSize: 11)),
                        ]),
                      ])),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        IconButton(
                          onPressed: () => launchUrl(Uri.parse('tel:${c.phone}')),
                          icon: const Icon(Iconsax.call, size: 18, color: AppTheme.primary),
                          visualDensity: VisualDensity.compact,
                        ),
                        Text('QAR ${c.creditLimit.toStringAsFixed(0)}', style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
                        const Text('Credit', style: TextStyle(fontSize: 9, color: AppTheme.textGray)),
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
