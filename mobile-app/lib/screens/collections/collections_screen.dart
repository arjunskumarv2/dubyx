import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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
    setState(() => _loading = true);
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

  void _showCollectModal(Map inv) {
    final balance = ((inv['total'] as num) - (inv['paidAmount'] as num)).toDouble();
    final amountCtrl = TextEditingController(text: balance.toStringAsFixed(2));
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
              // Header
              Row(children: [
                Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  const Text('Collect Payment', style: TextStyle(fontSize: 18, fontWeight: FontWeight.w800)),
                  const SizedBox(height: 2),
                  Text(inv['invoiceNumber'] ?? '', style: const TextStyle(color: AppTheme.primary, fontFamily: 'monospace', fontWeight: FontWeight.w600)),
                ])),
                IconButton(onPressed: () => Navigator.pop(ctx), icon: const Icon(Icons.close)),
              ]),
              const Divider(height: 20),

              // Customer info
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: AppTheme.background, borderRadius: BorderRadius.circular(12)),
                child: Row(children: [
                  const Icon(Iconsax.shop, size: 16, color: AppTheme.textGray),
                  const SizedBox(width: 8),
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(inv['customer']?['shopName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    Text('Balance Due: QAR ${fmt.format(balance)}', style: const TextStyle(color: AppTheme.error, fontSize: 12, fontWeight: FontWeight.w600)),
                  ])),
                ]),
              ),
              const SizedBox(height: 20),

              // Amount field
              const Text('Payment Amount', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textGray)),
              const SizedBox(height: 8),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: [FilteringTextInputFormatter.allow(RegExp(r'^\d+\.?\d{0,2}'))],
                decoration: InputDecoration(
                  prefixText: 'QAR ',
                  hintText: '0.00',
                  filled: true,
                  fillColor: AppTheme.background,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                ),
                style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
              ),

              // Quick amount buttons
              const SizedBox(height: 8),
              Row(children: [
                _quickAmountBtn('Full', balance, amountCtrl),
                const SizedBox(width: 8),
                _quickAmountBtn('75%', balance * 0.75, amountCtrl),
                const SizedBox(width: 8),
                _quickAmountBtn('50%', balance * 0.5, amountCtrl),
                const SizedBox(width: 8),
                _quickAmountBtn('25%', balance * 0.25, amountCtrl),
              ]),
              const SizedBox(height: 20),

              // Payment method
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

              // Reference (for non-cash)
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

              // Notes
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

              // Submit
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: collecting ? null : () async {
                    final amt = double.tryParse(amountCtrl.text);
                    if (amt == null || amt <= 0) {
                      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter a valid amount'), backgroundColor: AppTheme.error));
                      return;
                    }
                    setModal(() => collecting = true);
                    final messenger = ScaffoldMessenger.of(context);
                    try {
                      await _api.post('/invoices/${inv['id']}/payment', {
                        'amount': amt,
                        'method': method,
                        'reference': refCtrl.text.isEmpty ? null : refCtrl.text,
                        'notes': notesCtrl.text.isEmpty ? null : notesCtrl.text,
                      });
                      if (mounted) Navigator.pop(ctx);
                      messenger.showSnackBar(
                        SnackBar(content: Text('QAR ${fmt.format(amt)} collected successfully'), backgroundColor: AppTheme.success),
                      );
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

  Widget _quickAmountBtn(String label, double amount, TextEditingController ctrl) {
    return Expanded(child: GestureDetector(
      onTap: () => ctrl.text = amount.toStringAsFixed(2),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 7),
        decoration: BoxDecoration(
          border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
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
                      final status = inv['paymentStatus'] as String;
                      final isOverdue = status == 'OVERDUE';
                      Color statusColor = isOverdue ? AppTheme.error : status == 'PARTIAL' ? Colors.blue : AppTheme.warning;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: Padding(
                          padding: const EdgeInsets.all(14),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                              Text(inv['invoiceNumber'] ?? '', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary, fontSize: 13, fontFamily: 'monospace')),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(color: statusColor.withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                                child: Text(status, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: statusColor)),
                              ),
                            ]),
                            const SizedBox(height: 4),
                            Text(inv['customer']?['shopName'] ?? '', style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                            Text('${inv['customer']?['area'] ?? ''} • ${inv['customer']?['phone'] ?? ''}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                            if (inv['dueDate'] != null) ...[
                              const SizedBox(height: 4),
                              Row(children: [
                                Icon(Iconsax.calendar, size: 11, color: isOverdue ? AppTheme.error : AppTheme.textGray),
                                const SizedBox(width: 4),
                                Text(
                                  'Due: ${DateFormat('dd MMM yyyy').format(DateTime.parse(inv['dueDate']))}',
                                  style: TextStyle(fontSize: 11, color: isOverdue ? AppTheme.error : AppTheme.textGray, fontWeight: isOverdue ? FontWeight.w600 : FontWeight.normal),
                                ),
                              ]),
                            ],
                            const SizedBox(height: 8),
                            if (status == 'PARTIAL') ...[
                              Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                                Text('Total: QAR ${fmt.format(inv['total'])}', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                                Text('Paid: QAR ${fmt.format(inv['paidAmount'])}', style: const TextStyle(fontSize: 11, color: AppTheme.success)),
                              ]),
                              const SizedBox(height: 4),
                              LinearProgressIndicator(
                                value: (inv['paidAmount'] as num) / (inv['total'] as num),
                                backgroundColor: Colors.grey.shade200,
                                color: AppTheme.success,
                                borderRadius: BorderRadius.circular(4),
                                minHeight: 4,
                              ),
                              const SizedBox(height: 8),
                            ],
                            Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                              Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                const Text('Balance Due', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
                                Text('QAR ${fmt.format(balance)}', style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: statusColor)),
                              ]),
                              ElevatedButton.icon(
                                onPressed: () => _showCollectModal(inv),
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
                child: _recent.isEmpty
                  ? const Center(child: Text('No collections yet', style: TextStyle(color: AppTheme.textGray)))
                  : ListView.builder(
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
                          subtitle: Text('${c['collectedBy']?['name'] ?? ''} • ${(c['method'] as String).replaceAll('_', ' ')}', style: const TextStyle(fontSize: 11)),
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
