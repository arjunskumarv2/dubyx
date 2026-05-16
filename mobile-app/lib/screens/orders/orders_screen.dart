import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
  final fmt = NumberFormat('#,##0.00');

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.get('/orders', params: _statusFilter.isNotEmpty ? {'status': _statusFilter} : null);
      if (mounted) {
        setState(() {
          _orders = (data as List).map((o) => Order.fromJson(o)).toList();
          _loading = false;
        });
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _generateAndCollect(Order order) async {
    try {
      final invData = await _api.post('/invoices/generate', {'orderId': order.id});
      if (!mounted) return;
      await _load();
      _showCollectModal(invData['id'], invData['invoiceNumber'], invData['customer']?['shopName'] ?? order.customerName, (invData['total'] as num).toDouble(), 0.0);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: AppTheme.error));
    }
  }

  void _showCollectModal(String invoiceId, String invoiceNumber, String customerName, double total, double paidAmount) {
    final balance = total - paidAmount;
    final amountCtrl = TextEditingController(text: balance.toStringAsFixed(2));
    final refCtrl = TextEditingController();
    String method = 'CASH';
    bool collecting = false;

    showModalBottomSheet(
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
                Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('Collect Payment', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                    Text(invoiceNumber, style: const TextStyle(color: AppTheme.primary, fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                  ])),
                  IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close)),
                ]),
                const Divider(height: 20),

                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: AppTheme.background, borderRadius: BorderRadius.circular(12)),
                  child: Row(children: [
                    const Icon(Iconsax.shop, size: 16, color: AppTheme.textGray),
                    const SizedBox(width: 8),
                    Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(customerName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                      Text('Balance: QAR ${fmt.format(balance)}', style: const TextStyle(color: AppTheme.error, fontSize: 12, fontWeight: FontWeight.w600)),
                    ])),
                  ]),
                ),
                const SizedBox(height: 20),

                const Text('Payment Amount', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textGray)),
                const SizedBox(height: 8),
                TextField(
                  controller: amountCtrl,
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))],
                  style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w700),
                  decoration: InputDecoration(
                    prefixText: 'QAR ',
                    filled: true,
                    fillColor: AppTheme.background,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  for (final e in [('Full', balance), ('75%', balance * .75), ('50%', balance * .5), ('25%', balance * .25)]) ...[
                    Expanded(child: GestureDetector(
                      onTap: () => amountCtrl.text = e.$2.toStringAsFixed(2),
                      child: Container(
                        padding: const EdgeInsets.symmetric(vertical: 7),
                        margin: const EdgeInsets.only(right: 6),
                        decoration: BoxDecoration(border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)), borderRadius: BorderRadius.circular(8)),
                        child: Text(e.$1, style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
                      ),
                    )),
                  ],
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
                  const Text('Reference / Cheque No.', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textGray)),
                  const SizedBox(height: 8),
                  TextField(
                    controller: refCtrl,
                    decoration: InputDecoration(
                      hintText: method == 'CHEQUE' ? 'Cheque number' : 'Transaction reference',
                      filled: true, fillColor: AppTheme.background,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    ),
                  ),
                ],
                const SizedBox(height: 24),

                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
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
                        messenger.showSnackBar(SnackBar(content: Text('QAR ${fmt.format(amt)} collected'), backgroundColor: AppTheme.success));
                        if (mounted) _load();
                      } catch (e) {
                        setModal(() => collecting = false);
                        messenger.showSnackBar(SnackBar(content: Text(e.toString().replaceAll('Exception: ', '')), backgroundColor: AppTheme.error));
                      }
                    },
                    icon: collecting
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : const Icon(Iconsax.money_send, size: 18),
                    label: Text(collecting ? 'Processing...' : 'Confirm Collection'),
                    style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16), textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  ),
                ),
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

  Color _statusColor(String s) {
    switch (s) {
      case 'PENDING': return AppTheme.warning;
      case 'CONFIRMED': return Colors.blue;
      case 'DELIVERED': return AppTheme.success;
      case 'CANCELLED': return AppTheme.textGray;
      default: return AppTheme.warning;
    }
  }

  Color _payStatusColor(String s) {
    switch (s) {
      case 'PAID': return AppTheme.success;
      case 'PARTIAL': return Colors.blue;
      case 'OVERDUE': return AppTheme.error;
      default: return AppTheme.warning;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final ok = await Navigator.push(context, MaterialPageRoute(builder: (_) => const NewOrderScreen()));
          if (ok == true && mounted) _load();
        },
        backgroundColor: AppTheme.primary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: const Text('New Order', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
      ),
      body: Column(children: [
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
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 80),
                itemCount: _orders.length,
                itemBuilder: (ctx, i) {
                  final order = _orders[i];
                  final inv = order.invoice;
                  final canGenerateInvoice = !order.hasInvoice && !order.isCancelled;
                  final canCollect = inv != null && !inv.isPaid;

                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        // Header row
                        Row(children: [
                          Expanded(child: Text(order.orderNumber, style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary, fontFamily: 'monospace'))),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(color: _statusColor(order.status).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
                            child: Text(order.status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor(order.status))),
                          ),
                        ]),
                        const SizedBox(height: 6),

                        Row(children: [
                          const Icon(Iconsax.shop, size: 13, color: AppTheme.textGray),
                          const SizedBox(width: 4),
                          Expanded(child: Text(order.customerName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13), overflow: TextOverflow.ellipsis)),
                        ]),
                        const SizedBox(height: 2),
                        Text('${order.items.length} items • ${DateFormat('dd MMM, hh:mm a').format(order.createdAt)}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),

                        // Invoice status badge
                        if (inv != null) ...[
                          const SizedBox(height: 6),
                          Row(children: [
                            const Icon(Iconsax.receipt_1, size: 12, color: AppTheme.textGray),
                            const SizedBox(width: 4),
                            Text(inv.invoiceNumber, style: const TextStyle(fontSize: 11, color: AppTheme.textGray, fontFamily: 'monospace')),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(color: _payStatusColor(inv.paymentStatus).withValues(alpha: 0.12), borderRadius: BorderRadius.circular(10)),
                              child: Text(inv.paymentStatus, style: TextStyle(fontSize: 9, fontWeight: FontWeight.w700, color: _payStatusColor(inv.paymentStatus))),
                            ),
                          ]),
                        ],

                        const SizedBox(height: 10),
                        Row(children: [
                          Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text('QAR ${fmt.format(order.total)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.textDark)),
                            if (canCollect)
                              Text('Balance: QAR ${fmt.format(inv.balance)}', style: TextStyle(fontSize: 11, color: _payStatusColor(inv.paymentStatus), fontWeight: FontWeight.w600)),
                          ])),

                          // Action buttons
                          if (canGenerateInvoice)
                            _ActionBtn(
                              icon: Iconsax.receipt_edit,
                              label: 'Bill',
                              color: AppTheme.primary,
                              onTap: () => _generateAndCollect(order),
                            ),
                          if (canCollect) ...[
                            const SizedBox(width: 8),
                            _ActionBtn(
                              icon: Iconsax.money_send,
                              label: 'Collect',
                              color: AppTheme.success,
                              onTap: () => _showCollectModal(inv.id, inv.invoiceNumber, order.customerName, inv.total, inv.paidAmount),
                            ),
                          ],
                          if (inv != null && inv.isPaid)
                            const Row(mainAxisSize: MainAxisSize.min, children: [
                              Icon(Icons.check_circle, color: AppTheme.success, size: 16),
                              SizedBox(width: 4),
                              Text('Paid', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.w700, fontSize: 12)),
                            ]),
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

class _ActionBtn extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ActionBtn({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(10)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, size: 14, color: Colors.white),
          const SizedBox(width: 5),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 12)),
        ]),
      ),
    );
  }
}
