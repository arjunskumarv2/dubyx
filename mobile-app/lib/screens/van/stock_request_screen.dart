import 'package:flutter/material.dart';
import 'package:iconsax/iconsax.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';

class StockRequestScreen extends StatefulWidget {
  const StockRequestScreen({super.key});

  @override
  State<StockRequestScreen> createState() => _StockRequestScreenState();
}

class _StockRequestScreenState extends State<StockRequestScreen> {
  final _api = ApiService();
  final _searchCtrl = TextEditingController();
  final _notesCtrl = TextEditingController();

  List<dynamic> _products = [];
  List<dynamic> _myRequests = [];
  List<Map<String, dynamic>> _selectedItems = [];
  bool _loading = true;
  bool _submitting = false;
  int _tab = 0; // 0=New Request, 1=My Requests

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final results = await Future.wait([
        _api.get('/products'),
        _api.get('/stock-requests'),
      ]);
      if (mounted) {
        setState(() {
          _products = results[0] as List;
          _myRequests = results[1] as List;
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  List<dynamic> get _filteredProducts {
    final q = _searchCtrl.text.toLowerCase();
    return _products.where((p) {
      if (p['isActive'] != true) return false;
      if (q.isEmpty) return true;
      return (p['name'] as String).toLowerCase().contains(q) ||
          (p['sku'] as String).toLowerCase().contains(q);
    }).toList();
  }

  bool _isSelected(String productId) => _selectedItems.any((i) => i['productId'] == productId);

  void _toggleProduct(Map<String, dynamic> product) {
    if (_isSelected(product['id'])) {
      setState(() => _selectedItems.removeWhere((i) => i['productId'] == product['id']));
    } else {
      setState(() => _selectedItems.add({
        'productId': product['id'],
        'name': product['name'],
        'sku': product['sku'],
        'unit': product['unit'],
        'requestedQty': 1,
      }));
    }
  }

  void _updateQty(String productId, int qty) {
    if (qty < 1) return;
    setState(() {
      final idx = _selectedItems.indexWhere((i) => i['productId'] == productId);
      if (idx >= 0) _selectedItems[idx]['requestedQty'] = qty;
    });
  }

  Future<void> _submit() async {
    if (_selectedItems.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Select at least one product')),
      );
      return;
    }

    setState(() => _submitting = true);
    try {
      await _api.post('/stock-requests', {
        'items': _selectedItems.map((i) => {
          'productId': i['productId'],
          'requestedQty': i['requestedQty'],
        }).toList(),
        'notes': _notesCtrl.text.trim(),
      });

      if (!mounted) return;
      setState(() {
        _selectedItems = [];
        _notesCtrl.clear();
        _tab = 1;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Stock request submitted!'),
          backgroundColor: AppTheme.primary,
        ),
      );
      _load();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        title: const Text('Request Stock'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(44),
          child: Container(
            color: AppTheme.primary,
            child: Row(
              children: [
                _TabBtn(label: 'New Request', active: _tab == 0, onTap: () => setState(() => _tab = 0)),
                _TabBtn(label: 'My Requests', active: _tab == 1, onTap: () => setState(() => _tab = 1)),
              ],
            ),
          ),
        ),
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : _tab == 0
              ? _buildNewRequest()
              : _buildMyRequests(),
    );
  }

  Widget _buildNewRequest() {
    return Column(
      children: [
        // Selected items summary
        if (_selectedItems.isNotEmpty)
          Container(
            color: Colors.white,
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(children: [
                  Text('Selected (${_selectedItems.length})',
                      style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.primary)),
                  const Spacer(),
                  TextButton(
                    onPressed: () => setState(() => _selectedItems = []),
                    child: const Text('Clear all', style: TextStyle(fontSize: 12, color: AppTheme.textGray)),
                  ),
                ]),
                ...(_selectedItems.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(children: [
                    Expanded(child: Text(item['name'], style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600))),
                    Text(item['unit'], style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
                    const SizedBox(width: 8),
                    _QtyControl(
                      qty: item['requestedQty'],
                      onChanged: (v) => _updateQty(item['productId'], v),
                    ),
                    const SizedBox(width: 4),
                    GestureDetector(
                      onTap: () => setState(() => _selectedItems.removeWhere((i) => i['productId'] == item['productId'])),
                      child: const Icon(Icons.close, size: 16, color: AppTheme.textGray),
                    ),
                  ]),
                ))),
                const SizedBox(height: 4),
                TextField(
                  controller: _notesCtrl,
                  decoration: const InputDecoration(
                    hintText: 'Notes for manager (optional)',
                    border: OutlineInputBorder(),
                    contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    isDense: true,
                  ),
                  style: const TextStyle(fontSize: 13),
                  maxLines: 1,
                ),
                const SizedBox(height: 10),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _submitting ? null : _submit,
                    icon: _submitting
                        ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Icon(Iconsax.send_1, size: 16),
                    label: Text(_submitting ? 'Submitting...' : 'Submit Request'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),

        // Search bar
        Container(
          color: Colors.white,
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
          child: TextField(
            controller: _searchCtrl,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              hintText: 'Search products...',
              prefixIcon: const Icon(Iconsax.search_normal, size: 18, color: AppTheme.textGray),
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
              enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE5E7EB))),
              contentPadding: const EdgeInsets.symmetric(vertical: 10),
              isDense: true,
            ),
          ),
        ),

        // Product list
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
            itemCount: _filteredProducts.length,
            itemBuilder: (ctx, i) {
              final p = _filteredProducts[i];
              final selected = _isSelected(p['id']);
              final low = (p['currentStock'] as int) < (p['minStock'] as int? ?? 10);
              return GestureDetector(
                onTap: () => _toggleProduct(p),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 150),
                  margin: const EdgeInsets.only(bottom: 8),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: selected ? AppTheme.primary.withValues(alpha: 0.05) : Colors.white,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: selected ? AppTheme.primary : const Color(0xFFF0F0F0),
                      width: selected ? 1.5 : 1,
                    ),
                  ),
                  child: Row(children: [
                    Container(
                      width: 38, height: 38,
                      decoration: BoxDecoration(
                        color: selected ? AppTheme.primary : const Color(0xFFF5F5F5),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(
                        selected ? Icons.check : Iconsax.box,
                        color: selected ? Colors.white : AppTheme.textGray,
                        size: 18,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Row(children: [
                        Expanded(child: Text(p['name'], style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, color: AppTheme.textDark))),
                        if (low)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(color: const Color(0xFFFEF3C7), borderRadius: BorderRadius.circular(6)),
                            child: const Text('Low', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Color(0xFFD97706))),
                          ),
                      ]),
                      const SizedBox(height: 2),
                      Text('${p['sku']} · Stock: ${p['currentStock']} ${p['unit']}',
                          style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                    ])),
                  ]),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildMyRequests() {
    if (_myRequests.isEmpty) {
      return Center(
        child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
          Icon(Iconsax.box, size: 48, color: Colors.grey.shade300),
          const SizedBox(height: 12),
          const Text('No requests yet', style: TextStyle(color: AppTheme.textGray, fontSize: 15)),
        ]),
      );
    }

    return RefreshIndicator(
      onRefresh: _load,
      color: AppTheme.primary,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _myRequests.length,
        itemBuilder: (ctx, i) {
          final req = _myRequests[i];
          final status = req['status'] as String;
          final items = req['items'] as List;
          return Container(
            margin: const EdgeInsets.only(bottom: 12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFFF0F0F0)),
            ),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Text(req['requestNumber'], style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: AppTheme.primary)),
                const Spacer(),
                _StatusBadge(status: status),
              ]),
              const SizedBox(height: 4),
              Text(
                _formatDate(req['createdAt']),
                style: const TextStyle(fontSize: 11, color: AppTheme.textGray),
              ),
              const SizedBox(height: 10),
              ...items.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 4),
                child: Row(children: [
                  const Icon(Iconsax.box, size: 13, color: AppTheme.textGray),
                  const SizedBox(width: 6),
                  Expanded(child: Text(item['product']['name'], style: const TextStyle(fontSize: 12))),
                  Text('${item['requestedQty']} ${item['product']['unit']}',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppTheme.textDark)),
                ]),
              )),
              if (req['notes'] != null && (req['notes'] as String).isNotEmpty) ...[
                const SizedBox(height: 8),
                Text('Note: ${req['notes']}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray, fontStyle: FontStyle.italic)),
              ],
            ]),
          );
        },
      ),
    );
  }

  String _formatDate(String? isoStr) {
    if (isoStr == null) return '';
    final d = DateTime.tryParse(isoStr);
    if (d == null) return '';
    return '${d.day}/${d.month}/${d.year}  ${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}';
  }
}

class _TabBtn extends StatelessWidget {
  final String label;
  final bool active;
  final VoidCallback onTap;
  const _TabBtn({required this.label, required this.active, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: active ? Colors.white : Colors.transparent, width: 2.5)),
          ),
          child: Text(label, style: TextStyle(color: active ? Colors.white : Colors.white54, fontWeight: active ? FontWeight.w700 : FontWeight.w400, fontSize: 13)),
        ),
      ),
    );
  }
}

class _QtyControl extends StatelessWidget {
  final int qty;
  final ValueChanged<int> onChanged;
  const _QtyControl({required this.qty, required this.onChanged});

  @override
  Widget build(BuildContext context) {
    return Row(mainAxisSize: MainAxisSize.min, children: [
      _Btn(icon: Icons.remove, onTap: () => onChanged(qty - 1)),
      SizedBox(
        width: 32,
        child: Text('$qty', textAlign: TextAlign.center, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
      ),
      _Btn(icon: Icons.add, onTap: () => onChanged(qty + 1)),
    ]);
  }
}

class _Btn extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;
  const _Btn({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 24, height: 24,
        decoration: BoxDecoration(color: const Color(0xFFF3F4F6), borderRadius: BorderRadius.circular(6)),
        child: Icon(icon, size: 14, color: AppTheme.textDark),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  final String status;
  const _StatusBadge({required this.status});

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'ACCEPTED':
        bg = const Color(0xFFD1FAE5); fg = const Color(0xFF065F46);
      case 'REJECTED':
        bg = const Color(0xFFFEE2E2); fg = const Color(0xFF991B1B);
      default:
        bg = const Color(0xFFFEF3C7); fg = const Color(0xFF92400E);
    }
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(8)),
      child: Text(status, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: fg)),
    );
  }
}
