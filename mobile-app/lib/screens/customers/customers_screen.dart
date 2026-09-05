import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
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
    : _customers.where((c) =>
        c.shopName.toLowerCase().contains(_search.toLowerCase()) ||
        (c.arabicShopName ?? '').contains(_search) ||
        c.ownerName.toLowerCase().contains(_search.toLowerCase()) ||
        c.phone.contains(_search)).toList();

  void _showCreateModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CreateCustomerSheet(
        onCreated: () {
          _load();
          Navigator.pop(ctx);
        },
        api: _api,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Customers')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _showCreateModal,
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('Add Customer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: Column(children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            onChanged: (v) => setState(() => _search = v),
            decoration: const InputDecoration(
              hintText: 'Search customers...',
              prefixIcon: Icon(Icons.search, size: 18, color: AppTheme.textGray),
            ),
          ),
        ),
        Expanded(child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : RefreshIndicator(
            onRefresh: _load,
            color: AppTheme.primary,
            child: ListView.builder(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
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
                        decoration: BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
                        child: Center(child: Text(c.shopName[0].toUpperCase(), style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.w800, fontSize: 18))),
                      ),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Text(c.shopName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        if (c.arabicShopName != null && c.arabicShopName!.isNotEmpty)
                          Text(c.arabicShopName!, style: const TextStyle(fontFamily: 'Segoe UI', fontSize: 13, color: AppTheme.textGray), textDirection: TextDirection.rtl),
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
                        Text('SAR ${c.creditLimit.toStringAsFixed(0)}', style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
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

class _CreateCustomerSheet extends StatefulWidget {
  final VoidCallback onCreated;
  final ApiService api;
  const _CreateCustomerSheet({required this.onCreated, required this.api});

  @override
  State<_CreateCustomerSheet> createState() => _CreateCustomerSheetState();
}

class _CreateCustomerSheetState extends State<_CreateCustomerSheet> {
  final _formKey = GlobalKey<FormState>();
  final _shopNameCtrl = TextEditingController();
  final _arabicShopCtrl = TextEditingController();
  final _ownerCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _addressCtrl = TextEditingController();
  final _areaCtrl = TextEditingController();
  final _routeCtrl = TextEditingController();
  final _creditCtrl = TextEditingController(text: '0');
  bool _saving = false;
  bool _translating = false;

  Future<void> _autoTranslate() async {
    final text = _shopNameCtrl.text.trim();
    if (text.isEmpty) return;
    setState(() => _translating = true);
    try {
      final uri = Uri.parse(
        'https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=ar&dt=t&q=${Uri.encodeComponent(text)}',
      );
      final res = await http.get(uri).timeout(const Duration(seconds: 8));
      if (res.statusCode == 200) {
        final json = jsonDecode(res.body);
        final translated = (json[0] as List).map((part) => part[0] as String).join('');
        setState(() => _arabicShopCtrl.text = translated);
      }
    } catch (_) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Translation failed'), backgroundColor: AppTheme.error));
    } finally {
      if (mounted) setState(() => _translating = false);
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _saving = true);
    try {
      await widget.api.post('/customers', {
        'shopName': _shopNameCtrl.text.trim(),
        'arabicShopName': _arabicShopCtrl.text.trim().isEmpty ? null : _arabicShopCtrl.text.trim(),
        'ownerName': _ownerCtrl.text.trim(),
        'phone': _phoneCtrl.text.trim(),
        'email': _emailCtrl.text.trim().isEmpty ? null : _emailCtrl.text.trim(),
        'address': _addressCtrl.text.trim(),
        'area': _areaCtrl.text.trim(),
        'route': _routeCtrl.text.trim().isEmpty ? null : _routeCtrl.text.trim(),
        'creditLimit': double.tryParse(_creditCtrl.text) ?? 0,
      });
      widget.onCreated();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: AppTheme.error));
        setState(() => _saving = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: const BoxDecoration(color: Colors.white, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(color: AppTheme.primary, borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
            child: Row(children: [
              const Icon(Iconsax.shop_add, color: Colors.white, size: 20),
              const SizedBox(width: 10),
              const Expanded(child: Text('Add New Customer', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 16))),
              IconButton(icon: const Icon(Icons.close, color: Colors.white), onPressed: () => Navigator.pop(context), visualDensity: VisualDensity.compact),
            ]),
          ),
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Form(
                key: _formKey,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [

                  // Shop name + Arabic
                  _label('Shop Name *'),
                  TextFormField(
                    controller: _shopNameCtrl,
                    decoration: _inputDecor('Al Noor Trading'),
                    validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                    textCapitalization: TextCapitalization.words,
                  ),
                  const SizedBox(height: 10),
                  _label('Arabic Shop Name (اسم المحل)'),
                  Row(children: [
                    Expanded(child: TextFormField(
                      controller: _arabicShopCtrl,
                      decoration: _inputDecor('اسم المحل بالعربية'),
                      textDirection: TextDirection.rtl,
                    )),
                    const SizedBox(width: 8),
                    SizedBox(
                      height: 52,
                      child: ElevatedButton(
                        onPressed: _translating ? null : _autoTranslate,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.gold,
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _translating
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : const Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                              Icon(Icons.translate, color: Colors.white, size: 16),
                              Text('Auto', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.w700)),
                            ]),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 10),

                  _label('Owner Name *'),
                  TextFormField(
                    controller: _ownerCtrl,
                    decoration: _inputDecor('Owner full name'),
                    validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                    textCapitalization: TextCapitalization.words,
                  ),
                  const SizedBox(height: 10),

                  Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Phone *'),
                      TextFormField(
                        controller: _phoneCtrl,
                        decoration: _inputDecor('05XXXXXXXX'),
                        keyboardType: TextInputType.phone,
                        validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                      ),
                    ])),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Email'),
                      TextFormField(
                        controller: _emailCtrl,
                        decoration: _inputDecor('email@shop.com'),
                        keyboardType: TextInputType.emailAddress,
                      ),
                    ])),
                  ]),
                  const SizedBox(height: 10),

                  _label('Address *'),
                  TextFormField(
                    controller: _addressCtrl,
                    decoration: _inputDecor('Street, Building, Zone'),
                    validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                  ),
                  const SizedBox(height: 10),

                  Row(children: [
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Area *'),
                      TextFormField(
                        controller: _areaCtrl,
                        decoration: _inputDecor('e.g. Industrial Area'),
                        validator: (v) => v!.trim().isEmpty ? 'Required' : null,
                      ),
                    ])),
                    const SizedBox(width: 10),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      _label('Route'),
                      TextFormField(
                        controller: _routeCtrl,
                        decoration: _inputDecor('Route name'),
                      ),
                    ])),
                  ]),
                  const SizedBox(height: 10),

                  _label('Credit Limit (SAR)'),
                  TextFormField(
                    controller: _creditCtrl,
                    decoration: _inputDecor('0'),
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      onPressed: _saving ? null : _save,
                      icon: _saving
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.save_outlined, size: 18),
                      label: Text(_saving ? 'Saving...' : 'Save Customer'),
                      style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14), textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                    ),
                  ),
                  const SizedBox(height: 8),
                ]),
              ),
            ),
          ),
        ]),
      ),
    );
  }

  Widget _label(String text) => Padding(
    padding: const EdgeInsets.only(bottom: 4),
    child: Text(text, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textGray)),
  );

  InputDecoration _inputDecor(String hint) => InputDecoration(
    hintText: hint,
    filled: true,
    fillColor: AppTheme.background,
    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    isDense: true,
  );
}
