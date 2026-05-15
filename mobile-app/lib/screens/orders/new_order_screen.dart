import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../models/customer.dart';
import '../../models/product.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class CartItem {
  final Product product;
  int quantity;
  double discount;

  CartItem({required this.product, this.quantity = 1, this.discount = 0});

  double get lineTotal {
    final sub = product.sellingPrice * quantity * (1 - discount / 100);
    final tax = sub * (product.taxRate / 100);
    return sub + tax;
  }
}

class NewOrderScreen extends StatefulWidget {
  const NewOrderScreen({super.key});

  @override
  State<NewOrderScreen> createState() => _NewOrderScreenState();
}

class _NewOrderScreenState extends State<NewOrderScreen> {
  final _api = ApiService();
  Customer? _customer;
  List<Customer> _customers = [];
  List<Product> _products = [];
  List<CartItem> _cart = [];
  Map<String, int> _vanStock = {};
  bool _hasVanLoad = false;
  final _notesCtrl = TextEditingController();
  String _searchProduct = '';
  bool _loading = false;
  int _step = 0;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  Future<void> _loadData() async {
    try {
      final results = await Future.wait([
        _api.get('/customers'),
        _api.get('/products'),
        _api.get('/van-loads/my-stock'),
      ]);
      final vanData = results[2] as Map<String, dynamic>;
      final Map<String, int> vanStock = {};
      if (vanData['hasActiveLoad'] == true) {
        final items = vanData['vanLoad']['items'] as List;
        for (final item in items) {
          vanStock[item['productId'] as String] = item['availableQty'] as int;
        }
      }
      setState(() {
        _customers = (results[0] as List).map((e) => Customer.fromJson(e)).toList();
        _products = (results[1] as List).map((e) => Product.fromJson(e)).toList();
        _hasVanLoad = vanData['hasActiveLoad'] == true;
        _vanStock = vanStock;
      });
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppTheme.error));
    }
  }

  int _availableQty(Product p) => _hasVanLoad ? (_vanStock[p.id] ?? 0) : p.currentStock;

  List<Product> get _filteredProducts {
    final list = _hasVanLoad
      ? _products.where((p) => _vanStock.containsKey(p.id)).toList()
      : _products;
    return _searchProduct.isEmpty
      ? list
      : list.where((p) => p.name.toLowerCase().contains(_searchProduct.toLowerCase()) || p.sku.toLowerCase().contains(_searchProduct.toLowerCase())).toList();
  }

  double get _subtotal => _cart.fold(0, (s, i) => s + i.product.sellingPrice * i.quantity * (1 - i.discount / 100));
  double get _taxTotal => _cart.fold(0, (s, i) => s + i.product.sellingPrice * i.quantity * (1 - i.discount / 100) * (i.product.taxRate / 100));
  double get _total => _subtotal + _taxTotal;

  void _addToCart(Product p) {
    final maxQty = _availableQty(p);
    final existing = _cart.indexWhere((c) => c.product.id == p.id);
    setState(() {
      if (existing >= 0) {
        if (_cart[existing].quantity < maxQty) _cart[existing].quantity++;
      } else {
        if (maxQty > 0) _cart.add(CartItem(product: p));
      }
    });
  }

  Future<void> _submitOrder() async {
    if (_customer == null || _cart.isEmpty) return;
    setState(() => _loading = true);
    try {
      await _api.post('/orders', {
        'customerId': _customer!.id,
        'notes': _notesCtrl.text,
        'items': _cart.map((c) => {
          'productId': c.product.id,
          'quantity': c.quantity,
          'discount': c.discount,
        }).toList(),
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Order placed successfully!'), backgroundColor: AppTheme.success));
        Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('$e'), backgroundColor: AppTheme.error));
        setState(() => _loading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // ignore: unused_local_variable
    final user = context.watch<AuthProvider>().user;
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 0 ? 'Select Customer' : _step == 1 ? 'Add Products' : 'Review Order'),
        leading: IconButton(icon: const Icon(Icons.arrow_back, color: Colors.white), onPressed: () => _step > 0 ? setState(() => _step--) : Navigator.pop(context)),
      ),
      body: Column(children: [
        // Step indicator
        Container(
          color: AppTheme.primary,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          child: Row(children: List.generate(3, (i) => Expanded(child: Row(children: [
            Container(width: 24, height: 24, decoration: BoxDecoration(
              color: i <= _step ? AppTheme.gold : Colors.white.withValues(alpha: 0.3), shape: BoxShape.circle),
              child: Center(child: Text('${i+1}', style: TextStyle(color: i <= _step ? Colors.white : Colors.white60, fontSize: 11, fontWeight: FontWeight.bold)))),
            if (i < 2) Expanded(child: Container(height: 2, color: i < _step ? AppTheme.gold : Colors.white.withValues(alpha: 0.3), margin: const EdgeInsets.symmetric(horizontal: 4))),
          ])))),
        ),
        if (_hasVanLoad)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            color: const Color(0xFFFFF7ED),
            child: Row(children: [
              const Icon(Icons.local_shipping, size: 16, color: Color(0xFFF59E0B)),
              const SizedBox(width: 6),
              const Text('Selling from van stock', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFFB45309))),
            ]),
          ),

        Expanded(child: _step == 0 ? _buildCustomerStep() : _step == 1 ? _buildProductStep() : _buildReviewStep()),

        Container(
          padding: const EdgeInsets.all(16),
          decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: Color(0xFFF0F0F0)))),
          child: SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _loading ? null : () {
                if (_step == 0 && _customer != null) setState(() => _step = 1);
                else if (_step == 1 && _cart.isNotEmpty) setState(() => _step = 2);
                else if (_step == 2) _submitOrder();
              },
              child: _loading
                ? const CircularProgressIndicator(strokeWidth: 2, color: Colors.white)
                : Text(_step < 2 ? 'Continue' : 'Place Order'),
            ),
          ),
        ),
      ]),
    );
  }

  Widget _buildCustomerStep() => ListView.builder(
    padding: const EdgeInsets.all(16),
    itemCount: _customers.length,
    itemBuilder: (ctx, i) {
      final c = _customers[i];
      return Card(
        margin: const EdgeInsets.only(bottom: 8),
        child: ListTile(
          title: Text(c.shopName, style: const TextStyle(fontWeight: FontWeight.w600)),
          subtitle: Text('${c.ownerName} • ${c.area}', style: const TextStyle(fontSize: 12)),
          trailing: _customer?.id == c.id ? const Icon(Icons.check_circle, color: AppTheme.primary) : null,
          onTap: () => setState(() => _customer = c),
        ),
      );
    },
  );

  Widget _buildProductStep() => Column(children: [
    Padding(
      padding: const EdgeInsets.all(16),
      child: TextField(
        onChanged: (v) => setState(() => _searchProduct = v),
        decoration: const InputDecoration(hintText: 'Search products...', prefixIcon: Icon(Icons.search, size: 18, color: AppTheme.textGray)),
      ),
    ),
    Expanded(child: ListView.builder(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      itemCount: _filteredProducts.length,
      itemBuilder: (ctx, i) {
        final p = _filteredProducts[i];
        final cartQty = _cart.firstWhere((c) => c.product.id == p.id, orElse: () => CartItem(product: p, quantity: 0)).quantity;
        final availableQty = _availableQty(p);
        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          child: ListTile(
            title: Text(p.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
            subtitle: Text(
              '${p.sku} • QAR ${p.sellingPrice.toStringAsFixed(2)} • ${_hasVanLoad ? 'Van: $availableQty' : '$availableQty'} ${p.unit}',
              style: TextStyle(fontSize: 11, color: availableQty == 0 ? AppTheme.error : AppTheme.textGray),
            ),
            enabled: availableQty > 0,
            trailing: cartQty > 0
              ? SizedBox(
                  width: 100,
                  child: Row(mainAxisSize: MainAxisSize.min, children: [
                    GestureDetector(
                      onTap: () => setState(() {
                        final idx = _cart.indexWhere((c) => c.product.id == p.id);
                        if (_cart[idx].quantity > 1) _cart[idx].quantity--;
                        else _cart.removeAt(idx);
                      }),
                      child: Container(width: 26, height: 26, decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                        child: const Icon(Icons.remove, size: 14, color: AppTheme.primary)),
                    ),
                    Expanded(
                      child: TextField(
                        textAlign: TextAlign.center,
                        keyboardType: TextInputType.number,
                        controller: TextEditingController(text: '$cartQty')
                          ..selection = TextSelection.collapsed(offset: '$cartQty'.length),
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        decoration: const InputDecoration(
                          isDense: true,
                          contentPadding: EdgeInsets.symmetric(horizontal: 4, vertical: 6),
                          border: InputBorder.none,
                        ),
                        onChanged: (v) {
                          final n = int.tryParse(v);
                          if (n == null || n < 1) return;
                          setState(() {
                            final idx = _cart.indexWhere((c) => c.product.id == p.id);
                            if (idx >= 0) _cart[idx].quantity = n.clamp(1, availableQty);
                          });
                        },
                      ),
                    ),
                    GestureDetector(
                      onTap: cartQty < availableQty ? () => _addToCart(p) : null,
                      child: Container(width: 26, height: 26,
                        decoration: BoxDecoration(color: cartQty < availableQty ? AppTheme.primary : AppTheme.textGray, borderRadius: BorderRadius.circular(6)),
                        child: const Icon(Icons.add, size: 14, color: Colors.white)),
                    ),
                  ]),
                )
              : GestureDetector(
                  onTap: availableQty > 0 ? () => _addToCart(p) : null,
                  child: Container(width: 28, height: 28,
                    decoration: BoxDecoration(color: availableQty > 0 ? AppTheme.primary : AppTheme.textGray, borderRadius: BorderRadius.circular(8)),
                    child: const Icon(Icons.add, size: 16, color: Colors.white)),
                ),
          ),
        );
      },
    )),
    if (_cart.isNotEmpty)
      Container(
        padding: const EdgeInsets.all(16),
        color: AppTheme.primary.withValues(alpha: 0.05),
        child: Text('${_cart.length} products • QAR ${_total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.primary)),
      ),
  ]);

  Widget _buildReviewStep() => SingleChildScrollView(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF0F0F0))),
        child: Row(children: [
          Container(width: 40, height: 40, decoration: BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.circular(10)),
            child: Center(child: Text(_customer!.shopName[0], style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)))),
          const SizedBox(width: 12),
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(_customer!.shopName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            Text('${_customer!.ownerName} • ${_customer!.phone}', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
          ])),
        ])),
      const SizedBox(height: 16),

      ..._cart.map((item) => Container(
        margin: const EdgeInsets.only(bottom: 8),
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(12), border: Border.all(color: const Color(0xFFF0F0F0))),
        child: Row(children: [
          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(item.product.name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            Text('${item.quantity} × QAR ${item.product.sellingPrice.toStringAsFixed(2)}', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
          ])),
          Text('QAR ${item.lineTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary)),
        ]),
      )),

      const SizedBox(height: 12),
      Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF0F0F0))),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Subtotal', style: TextStyle(color: AppTheme.textGray)),
            Text('QAR ${_subtotal.toStringAsFixed(2)}'),
          ]),
          const SizedBox(height: 4),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Tax', style: TextStyle(color: AppTheme.textGray)),
            Text('QAR ${_taxTotal.toStringAsFixed(2)}'),
          ]),
          const Divider(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Text('QAR ${_total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.primary)),
          ]),
        ])),

      const SizedBox(height: 16),
      TextField(controller: _notesCtrl, maxLines: 3, decoration: const InputDecoration(hintText: 'Order notes (optional)', labelText: 'Notes')),
    ]),
  );
}
