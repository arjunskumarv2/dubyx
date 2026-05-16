import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../models/invoice.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'invoice_preview_screen.dart';
import 'package:intl/intl.dart';
import 'package:iconsax/iconsax.dart';

class InvoicesScreen extends StatefulWidget {
  const InvoicesScreen({super.key});

  @override
  State<InvoicesScreen> createState() => _InvoicesScreenState();
}

class _InvoicesScreenState extends State<InvoicesScreen> {
  final _api = ApiService();
  List<Invoice> _invoices = [];
  bool _loading = true;
  String _filter = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    try {
      final data = await _api.get('/invoices');
      setState(() {
        _invoices = (data as List).map((i) => Invoice.fromJson(i)).toList();
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<Invoice> get _filtered => _filter.isEmpty ? _invoices : _invoices.where((i) => i.paymentStatus == _filter).toList();

  Color _statusColor(String s) {
    switch (s) {
      case 'PAID': return AppTheme.success;
      case 'PENDING': return AppTheme.warning;
      case 'PARTIAL': return Colors.blue;
      case 'OVERDUE': return AppTheme.error;
      default: return AppTheme.textGray;
    }
  }

  void _showCollectModal(Invoice inv) {
    final amountCtrl = TextEditingController(text: inv.balance.toStringAsFixed(2));
    final refCtrl = TextEditingController();
    final notesCtrl = TextEditingController();
    String method = 'CASH';
    bool collecting = false;
    final fmt = NumberFormat('#,##0.00');

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModal) => Container(
          padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Collect Payment', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  Text(inv.invoiceNumber, style: const TextStyle(color: AppTheme.primary, fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                ])),
                IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close)),
              ]),
              const Divider(height: 20),

              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppTheme.background, borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(inv.customerName, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    Text('Balance Due: QAR ${fmt.format(inv.balance)}', style: const TextStyle(color: AppTheme.error, fontSize: 12, fontWeight: FontWeight.w600)),
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
                decoration: InputDecoration(
                  prefixText: 'QAR ',
                  filled: true,
                  fillColor: AppTheme.background,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Row(children: [
                _quickBtn('Full', inv.balance, amountCtrl),
                const SizedBox(width: 8),
                _quickBtn('75%', inv.balance * 0.75, amountCtrl),
                const SizedBox(width: 8),
                _quickBtn('50%', inv.balance * 0.5, amountCtrl),
                const SizedBox(width: 8),
                _quickBtn('25%', inv.balance * 0.25, amountCtrl),
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
                        decoration: BoxDecoration(
                          color: method == m ? AppTheme.primary : AppTheme.background,
                          borderRadius: BorderRadius.circular(10),
                        ),
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
                    filled: true,
                    fillColor: AppTheme.background,
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              const Text('Notes (optional)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textGray)),
              const SizedBox(height: 8),
              TextField(
                controller: notesCtrl,
                maxLines: 2,
                decoration: InputDecoration(
                  hintText: 'Add a note...',
                  filled: true,
                  fillColor: AppTheme.background,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
              ),
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
                      await _api.post('/invoices/${inv.id}/payment', {
                        'amount': amt,
                        'method': method,
                        'reference': refCtrl.text.isEmpty ? null : refCtrl.text,
                        'notes': notesCtrl.text.isEmpty ? null : notesCtrl.text,
                      });
                      if (mounted) Navigator.pop(ctx);
                      messenger.showSnackBar(SnackBar(
                        content: Text('QAR ${fmt.format(amt)} collected'),
                        backgroundColor: AppTheme.success,
                      ));
                      if (mounted) _load();
                    } catch (e) {
                      setModal(() => collecting = false);
                      messenger.showSnackBar(SnackBar(
                        content: Text(e.toString().replaceAll('Exception: ', '')),
                        backgroundColor: AppTheme.error,
                      ));
                    }
                  },
                  icon: collecting
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Iconsax.money_send, size: 18),
                  label: Text(collecting ? 'Processing...' : 'Confirm Collection'),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    textStyle: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
              const SizedBox(height: 8),
            ]),
          ),
        ),
      ),
    );
  }

  Widget _quickBtn(String label, double amount, TextEditingController ctrl) {
    return Expanded(child: GestureDetector(
      onTap: () => ctrl.text = amount.toStringAsFixed(2),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.primary.withValues(alpha: 0.3)),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(label, style: const TextStyle(fontSize: 11, color: AppTheme.primary, fontWeight: FontWeight.w600), textAlign: TextAlign.center),
      ),
    ));
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
    final fmt = NumberFormat('#,##0.00');

    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: Column(children: [
        // Filter chips
        Container(
          color: AppTheme.primary,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: ['', 'PENDING', 'PARTIAL', 'OVERDUE', 'PAID'].map((s) =>
              GestureDetector(
                onTap: () => setState(() => _filter = s),
                child: Container(
                  margin: const EdgeInsets.only(right: 8),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                  decoration: BoxDecoration(
                    color: _filter == s ? Colors.white : Colors.white24,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(s.isEmpty ? 'All' : s, style: TextStyle(color: _filter == s ? AppTheme.primary : Colors.white, fontWeight: FontWeight.w600, fontSize: 12)),
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
            child: _filtered.isEmpty
              ? const Center(child: Text('No invoices found', style: TextStyle(color: AppTheme.textGray)))
              : ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _filtered.length,
                itemBuilder: (ctx, i) {
                  final inv = _filtered[i];
                  final statusColor = _statusColor(inv.paymentStatus);
                  final isOverdue = inv.paymentStatus == 'OVERDUE';

                  return Card(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: InkWell(
                      borderRadius: BorderRadius.circular(16),
                      onTap: () => Navigator.push(ctx, MaterialPageRoute(builder: (_) => InvoicePreviewScreen(invoice: inv))),
                      child: Padding(
                        padding: const EdgeInsets.all(14),
                        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Text(inv.invoiceNumber, style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary, fontFamily: 'monospace')),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(color: statusColor.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20)),
                              child: Text(inv.paymentStatus, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                            ),
                          ]),
                          const SizedBox(height: 6),
                          Text(inv.customerName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          Row(children: [
                            Text(inv.customerPhone, style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
                            if (inv.dueDate != null) ...[
                              const Text(' • ', style: TextStyle(color: AppTheme.textGray)),
                              Icon(Iconsax.calendar, size: 11, color: isOverdue ? AppTheme.error : AppTheme.textGray),
                              const SizedBox(width: 3),
                              Text(
                                'Due ${DateFormat('dd MMM').format(inv.dueDate!)}',
                                style: TextStyle(fontSize: 12, color: isOverdue ? AppTheme.error : AppTheme.textGray, fontWeight: isOverdue ? FontWeight.w600 : FontWeight.normal),
                              ),
                            ],
                          ]),

                          // Partial payment progress bar
                          if (inv.paymentStatus == 'PARTIAL') ...[
                            const SizedBox(height: 8),
                            LinearProgressIndicator(
                              value: inv.paidAmount / inv.total,
                              backgroundColor: Colors.grey.shade200,
                              color: Colors.blue,
                              borderRadius: BorderRadius.circular(4),
                              minHeight: 4,
                            ),
                            const SizedBox(height: 4),
                            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                              Text('Paid: QAR ${fmt.format(inv.paidAmount)}', style: const TextStyle(fontSize: 10, color: AppTheme.success)),
                              Text('${((inv.paidAmount / inv.total) * 100).toStringAsFixed(0)}%', style: const TextStyle(fontSize: 10, color: AppTheme.textGray)),
                            ]),
                          ],

                          const SizedBox(height: 8),
                          Row(children: [
                            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Text('Total', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
                              Text('QAR ${fmt.format(inv.total)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15, color: AppTheme.textDark)),
                            ])),
                            if (!inv.isPaid && inv.balance > 0) ...[
                              Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                                const Text('Balance', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
                                Text('QAR ${fmt.format(inv.balance)}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: statusColor)),
                              ]),
                              const SizedBox(width: 8),
                            ],
                            if (!inv.isPaid)
                              ElevatedButton.icon(
                                onPressed: () => _showCollectModal(inv),
                                icon: const Icon(Iconsax.money_send, size: 13),
                                label: const Text('Collect'),
                                style: ElevatedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                                  textStyle: const TextStyle(fontSize: 11),
                                ),
                              ),
                            if (inv.isPaid)
                              const Row(children: [
                                Icon(Icons.check_circle, color: AppTheme.success, size: 16),
                                SizedBox(width: 4),
                                Text('Paid', style: TextStyle(color: AppTheme.success, fontWeight: FontWeight.w700, fontSize: 12)),
                              ]),
                          ]),
                        ]),
                      ),
                    ),
                  );
                },
              ),
          )),
      ]),
    );
  }
}
