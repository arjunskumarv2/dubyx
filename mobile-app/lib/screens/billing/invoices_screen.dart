import 'package:flutter/material.dart';
import '../../models/invoice.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import 'invoice_preview_screen.dart';
import 'package:intl/intl.dart';

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

  @override
  Widget build(BuildContext context) {
    final fmt = NumberFormat('#,##0.00');

    return Scaffold(
      appBar: AppBar(title: const Text('Invoices')),
      body: Column(children: [
        // Filter tabs
        Container(
          color: AppTheme.primary,
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(children: ['', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE'].map((s) =>
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
                              decoration: BoxDecoration(color: _statusColor(inv.paymentStatus).withOpacity(0.1), borderRadius: BorderRadius.circular(20)),
                              child: Text(inv.paymentStatus, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: _statusColor(inv.paymentStatus))),
                            ),
                          ]),
                          const SizedBox(height: 6),
                          Text(inv.customerName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          Text(inv.customerPhone, style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
                          const SizedBox(height: 8),
                          Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                            Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              const Text('Total', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
                              Text('QAR ${fmt.format(inv.total)}', style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16, color: AppTheme.textDark)),
                            ]),
                            if (inv.balance > 0) Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                              const Text('Balance Due', style: TextStyle(fontSize: 11, color: AppTheme.textGray)),
                              Text('QAR ${fmt.format(inv.balance)}', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: _statusColor(inv.paymentStatus))),
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
