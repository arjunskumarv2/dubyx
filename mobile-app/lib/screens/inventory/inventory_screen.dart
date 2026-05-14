import 'package:flutter/material.dart';
import '../../models/product.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'package:iconsax/iconsax.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  final _api = ApiService();
  List<Product> _products = [];
  bool _loading = true;
  String _search = '';
  bool _lowStockOnly = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final data = await _api.get('/products');
      setState(() {
        _products = (data as List).map((p) => Product.fromJson(p)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Product> get _filtered {
    var list = _products;
    if (_lowStockOnly) list = list.where((p) => p.isLowStock).toList();
    if (_search.isNotEmpty) list = list.where((p) => p.name.toLowerCase().contains(_search.toLowerCase())).toList();
    return list;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inventory'),
        actions: [
          IconButton(
            icon: Icon(_lowStockOnly ? Iconsax.warning_2 : Iconsax.warning_2, color: _lowStockOnly ? AppTheme.gold : Colors.white70),
            onPressed: () => setState(() => _lowStockOnly = !_lowStockOnly),
            tooltip: 'Low Stock Only',
          ),
        ],
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: const InputDecoration(hintText: 'Search products...', prefixIcon: Icon(Icons.search, size: 18, color: AppTheme.textGray)),
          ),
        ),
        if (_lowStockOnly)
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(color: AppTheme.warning.withOpacity(0.1), borderRadius: BorderRadius.circular(8)),
            child: Row(children: [
              const Icon(Iconsax.warning_2, size: 14, color: AppTheme.warning),
              const SizedBox(width: 8),
              Text('Showing ${_filtered.length} low stock products', style: const TextStyle(fontSize: 12, color: AppTheme.warning, fontWeight: FontWeight.w600)),
            ]),
          ),
        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
            onRefresh: _load,
            color: AppTheme.primary,
            child: ListView.builder(
              padding: const EdgeInsets.all(16),
              itemCount: _filtered.length,
              itemBuilder: (ctx, i) {
                final p = _filtered[i];
                return Card(
                  margin: const EdgeInsets.only(bottom: 8),
                  color: p.isLowStock ? AppTheme.error.withOpacity(0.03) : Colors.white,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(children: [
                      Container(
                        width: 44, height: 44,
                        decoration: BoxDecoration(
                          color: p.isLowStock ? AppTheme.error.withOpacity(0.1) : AppTheme.primary.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(Iconsax.box, color: p.isLowStock ? AppTheme.error : AppTheme.primary, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          Expanded(child: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13))),
                          if (p.isLowStock) const Icon(Iconsax.warning_2, size: 14, color: AppTheme.error),
                        ]),
                        Text('${p.sku} • ${p.categoryName ?? ''}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                        const SizedBox(height: 4),
                        Row(children: [
                          Text('QAR ${p.sellingPrice.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary, fontSize: 13)),
                          if (p.taxRate > 0) Text(' +${p.taxRate.toStringAsFixed(0)}% VAT', style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
                        ]),
                      ])),
                      Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                        Text('${p.currentStock}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 20, color: p.isLowStock ? AppTheme.error : AppTheme.success)),
                        Text(p.unit, style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
                        Text('Min: ${p.minStock}', style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
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
