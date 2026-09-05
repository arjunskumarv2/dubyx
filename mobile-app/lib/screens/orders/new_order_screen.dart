import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:iconsax/iconsax.dart';
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
      // 1. Create order
      final order = await _api.post('/orders', {
        'customerId': _customer!.id,
        'notes': _notesCtrl.text,
        'items': _cart.map((c) => {
          'productId': c.product.id,
          'quantity': c.quantity,
          'discount': c.discount,
        }).toList(),
      });

      // 2. Auto-generate cash invoice
      final inv = await _api.post('/invoices/generate', {'orderId': order['id']});

      if (!mounted) return;
      setState(() => _loading = false);

      // 3. Show collect sheet FIRST (context still valid), then pop on dismiss
      await _showCashInvoiceSheet(
        invoiceId: inv['id'],
        invoiceNumber: inv['invoiceNumber'],
        customerName: _customer!.shopName,
        total: (inv['total'] as num).toDouble(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: AppTheme.error));
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _showCashInvoiceSheet({
    required String invoiceId,
    required String invoiceNumber,
    required String customerName,
    required double total,
  }) async {
    final fmt = NumberFormat('#,##0.00');
    final amountCtrl = TextEditingController(text: total.toStringAsFixed(2));
    final refCtrl = TextEditingController();
    String method = 'CASH';
    bool collecting = false;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => Padding(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                // Header with invoice badge
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: AppTheme.success.withValues(alpha: 0.08), borderRadius: BorderRadius.circular(16)),
                  child: Row(children: [
                    Container(width: 44, height: 44, decoration: BoxDecoration(color: AppTheme.success, borderRadius: BorderRadius.circular(12)),
                      child: const Icon(Icons.receipt_long, color: Colors.white, size: 22)),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Invoice Generated!', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppTheme.success)),
                      Text(invoiceNumber, style: const TextStyle(fontFamily: 'monospace', fontSize: 12, color: AppTheme.textGray)),
                      Text(customerName, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600)),
                    ])),
                    IconButton(icon: const Icon(Icons.close, color: AppTheme.textGray), onPressed: () => Navigator.pop(ctx)),
                  ]),
                ),
                const SizedBox(height: 20),

                const Text('Collect Payment', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
                const SizedBox(height: 4),
                Text('Total: SAR ${fmt.format(total)}', style: const TextStyle(color: AppTheme.textGray, fontSize: 13)),
                const SizedBox(height: 16),

                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))],
                  style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800),
                  decoration: InputDecoration(
                    prefixText: 'SAR ',
                    filled: true, fillColor: AppTheme.background,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  for (final e in [('Full', total), ('75%', total * .75), ('50%', total * .5), ('25%', total * .25)])
                    Expanded(child: GestureDetector(
                      onTap: () => amountCtrl.text = e.$2.toStringAsFixed(2),
                      child: Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        decoration: BoxDecoration(border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(8)),
                        child: Text(e.$1, textAlign: TextAlign.center, style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600)),
                      ),
                    )),
                ]),
                const SizedBox(height: 20),

                const Text('Payment Method', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textGray)),
                const SizedBox(height: 8),
                Row(children: [
                  for (final m in ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD'])
                    Expanded(child: Padding(
                      padding: const EdgeInsets.only(right: 6),
                      child: GestureDetector(
                        onTap: () => setModal(() => method = m),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(color: method == m ? AppTheme.primary : AppTheme.background, borderRadius: BorderRadius.circular(10)),
                          child: Column(children: [
                            Icon(_methodIcon(m), size: 18, color: method == m ? Colors.white : AppTheme.textGray),
                            const SizedBox(height: 4),
                            Text(_methodLabel(m), style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: method == m ? Colors.white : AppTheme.textGray), textAlign: TextAlign.center),
                          ]),
                        ),
                      ),
                    )),
                ]),

                if (method != 'CASH') ...[
                  const SizedBox(height: 16),
                  TextField(
                    controller: refCtrl,
                    decoration: InputDecoration(
                      hintText: method == 'CHEQUE' ? 'Cheque number' : 'Transaction reference',
                      labelText: 'Reference / Cheque No.',
                      filled: true, fillColor: AppTheme.background,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ],
                const SizedBox(height: 24),

                Row(children: [
                  Expanded(child: OutlinedButton(
                    onPressed: () => Navigator.pop(ctx),
                    style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                    child: const Text('Pay Later'),
                  )),
                  const SizedBox(width: 12),
                  Expanded(flex: 2, child: ElevatedButton.icon(
                    onPressed: collecting ? null : () async {
                      final amt = double.tryParse(amountCtrl.text);
                      if (amt == null || amt <= 0) return;
                      setModal(() => collecting = true);
                      final messenger = ScaffoldMessenger.of(context);
                      try {
                        await _api.post('/invoices/$invoiceId/payment', {
                          'amount': amt, 'method': method,
                          if (refCtrl.text.isNotEmpty) 'reference': refCtrl.text,
                        });
                        if (ctx.mounted) Navigator.pop(ctx);
                        messenger.showSnackBar(SnackBar(content: Text('SAR ${fmt.format(amt)} collected!'), backgroundColor: AppTheme.success));
                      } catch (e) {
                        setModal(() => collecting = false);
                        messenger.showSnackBar(SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: AppTheme.error));
                      }
                    },
                    icon: collecting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Iconsax.money_send, size: 18),
                    label: Text(collecting ? 'Processing...' : 'Collect Now'),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), textStyle: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  )),
                ]),
                const SizedBox(height: 8),
              ]),
            ),
          ),
        ),
      ),
    );
  }

  IconData _methodIcon(String m) {
    switch (m) {
      case 'CASH': return Iconsax.money;
      case 'BANK_TRANSFER': return Iconsax.bank;
      case 'CHEQUE': return Iconsax.document_text;
      default: return Iconsax.card;
    }
  }

  String _methodLabel(String m) {
    switch (m) {
      case 'CASH': return 'Cash';
      case 'BANK_TRANSFER': return 'Bank';
      case 'CHEQUE': return 'Cheque';
      default: return 'Card';
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
              '${p.sku} • SAR ${p.sellingPrice.toStringAsFixed(2)} • ${_hasVanLoad ? 'Van: $availableQty' : '$availableQty'} ${p.unit}',
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
        child: Text('${_cart.length} products • SAR ${_total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w600, color: AppTheme.primary)),
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
            Text('${item.quantity} × SAR ${item.product.sellingPrice.toStringAsFixed(2)}', style: const TextStyle(color: AppTheme.textGray, fontSize: 12)),
          ])),
          Text('SAR ${item.lineTotal.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary)),
        ]),
      )),

      const SizedBox(height: 12),
      Container(padding: const EdgeInsets.all(16), decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF0F0F0))),
        child: Column(children: [
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Subtotal', style: TextStyle(color: AppTheme.textGray)),
            Text('SAR ${_subtotal.toStringAsFixed(2)}'),
          ]),
          const SizedBox(height: 4),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Tax', style: TextStyle(color: AppTheme.textGray)),
            Text('SAR ${_taxTotal.toStringAsFixed(2)}'),
          ]),
          const Divider(height: 16),
          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
            const Text('Total', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
            Text('SAR ${_total.toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 18, color: AppTheme.primary)),
          ]),
        ])),

      const SizedBox(height: 16),
      TextField(controller: _notesCtrl, maxLines: 3, decoration: const InputDecoration(hintText: 'Order notes (optional)', labelText: 'Notes')),
    ]),
  );
}
