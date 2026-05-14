import 'package:flutter/material.dart';
import 'package:printing/printing.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../models/invoice.dart';
import '../../models/order.dart';
import '../../services/api_service.dart';
import '../../services/pdf_service.dart';
import '../../theme/app_theme.dart';
import 'package:intl/intl.dart';

class InvoicePreviewScreen extends StatefulWidget {
  final Invoice invoice;

  const InvoicePreviewScreen({super.key, required this.invoice});

  @override
  State<InvoicePreviewScreen> createState() => _InvoicePreviewScreenState();
}

class _InvoicePreviewScreenState extends State<InvoicePreviewScreen> {
  final _api = ApiService();
  final _pdf = PdfService();
  Map<String, String> _settings = {};
  bool _generatingPdf = false;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    try {
      final data = await _api.get('/settings');
      setState(() {
        _settings = Map<String, String>.from(data);
        _loading = false;
      });
    } catch (_) {
      setState(() => _loading = false);
    }
  }

  List<OrderItem> get _items {
    final rawItems = widget.invoice.order?['items'] as List? ?? [];
    return rawItems.map((i) => OrderItem.fromJson(i)).toList();
  }

  Future<void> _generateAndPreview() async {
    setState(() => _generatingPdf = true);
    try {
      final pdfBytes = await _pdf.generateInvoicePdf(
        invoice: widget.invoice,
        items: _items,
        settings: _settings,
      );
      if (!mounted) return;
      await Printing.layoutPdf(onLayout: (_) async => pdfBytes, name: widget.invoice.invoiceNumber);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('PDF Error: $e'), backgroundColor: AppTheme.error));
    } finally {
      if (mounted) setState(() => _generatingPdf = false);
    }
  }

  Future<void> _shareViaWhatsApp() async {
    setState(() => _generatingPdf = true);
    try {
      final pdfBytes = await _pdf.generateInvoicePdf(
        invoice: widget.invoice,
        items: _items,
        settings: _settings,
      );
      if (!mounted) return;

      // Share via system share sheet which includes WhatsApp
      await Printing.sharePdf(bytes: pdfBytes, filename: '${widget.invoice.invoiceNumber}.pdf');
    } catch (e) {
      if (mounted) {
        // Fallback: open WhatsApp with text
        final phone = widget.invoice.customerPhone.replaceAll(RegExp(r'[^\d+]'), '');
        final message = Uri.encodeComponent(
          'Hello ${widget.invoice.customerName},\n\n'
          'Your invoice ${widget.invoice.invoiceNumber} is ready.\n'
          'Amount: QAR ${widget.invoice.total.toStringAsFixed(2)}\n'
          'Please check your WhatsApp for the PDF.\n\nDubyx Trading LLC'
        );
        final waUrl = 'whatsapp://send?phone=$phone&text=$message';
        if (await canLaunchUrl(Uri.parse(waUrl))) {
          await launchUrl(Uri.parse(waUrl));
        }
      }
    } finally {
      if (mounted) setState(() => _generatingPdf = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final inv = widget.invoice;
    final fmt = NumberFormat('#,##0.00');
    final currency = _settings['currency_symbol'] ?? 'QAR';

    return Scaffold(
      appBar: AppBar(
        title: Text(inv.invoiceNumber),
        actions: [
          if (!_loading)
            IconButton(icon: const Icon(Icons.print, color: Colors.white), onPressed: _generatingPdf ? null : _generateAndPreview),
        ],
      ),
      body: _loading
        ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
        : SingleChildScrollView(
          child: Column(children: [
            // Invoice header
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: const BoxDecoration(
                gradient: LinearGradient(colors: [AppTheme.primary, Color(0xFFB22351)], begin: Alignment.topLeft, end: Alignment.bottomRight),
              ),
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Text(_settings['company_name'] ?? 'Dubyx', style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800)),
                  const Text('INVOICE', style: TextStyle(color: Color(0xFFC9A84C), fontSize: 20, fontWeight: FontWeight.w900)),
                ]),
                const SizedBox(height: 4),
                Text(_settings['company_address'] ?? 'Doha, Qatar', style: const TextStyle(color: Colors.white60, fontSize: 11)),
                const SizedBox(height: 16),
                Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
                  Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    const Text('BILL TO', style: TextStyle(color: Colors.white40, fontSize: 9, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 2),
                    Text(inv.customerName, style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                    Text(inv.customerPhone, style: const TextStyle(color: Colors.white60, fontSize: 11)),
                  ]),
                  Column(crossAxisAlignment: CrossAxisAlignment.end, children: [
                    Text(inv.invoiceNumber, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontFamily: 'monospace')),
                    Text(DateFormat('dd MMM yyyy').format(inv.createdAt), style: const TextStyle(color: Colors.white60, fontSize: 11)),
                    _statusBadge(inv.paymentStatus),
                  ]),
                ]),
              ]),
            ),

            // Items
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(children: [
                // Items header
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(color: AppTheme.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(8)),
                  child: Row(children: const [
                    Expanded(flex: 3, child: Text('ITEM', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textGray))),
                    SizedBox(width: 60, child: Text('QTY', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textGray), textAlign: TextAlign.right)),
                    SizedBox(width: 80, child: Text('TOTAL', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppTheme.textGray), textAlign: TextAlign.right)),
                  ]),
                ),
                const SizedBox(height: 4),

                ..._items.map((item) => Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(border: Border(bottom: BorderSide(color: const Color(0xFFF0F0F0)))),
                  child: Row(children: [
                    Expanded(flex: 3, child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(item.productName, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                      Text('$currency ${fmt.format(item.price)} × ${item.quantity} ${item.unit}${item.taxRate > 0 ? ' (+${item.taxRate.toStringAsFixed(0)}% VAT)' : ''}',
                        style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                    ])),
                    SizedBox(width: 60, child: Text('${item.quantity}', style: const TextStyle(fontWeight: FontWeight.w600), textAlign: TextAlign.right)),
                    SizedBox(width: 80, child: Text('$currency ${fmt.format(item.total)}', style: const TextStyle(fontWeight: FontWeight.w700, color: AppTheme.primary), textAlign: TextAlign.right)),
                  ]),
                )),

                const SizedBox(height: 16),
                // Totals
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(color: const Color(0xFFF8F5F0), borderRadius: BorderRadius.circular(12)),
                  child: Column(children: [
                    _totalRow('Subtotal', '$currency ${fmt.format(inv.subtotal)}'),
                    _totalRow('Tax (VAT)', '$currency ${fmt.format(inv.taxAmount)}'),
                    if (inv.discount > 0) _totalRow('Discount', '-$currency ${fmt.format(inv.subtotal * inv.discount / 100)}'),
                    const Divider(height: 16),
                    _totalRow('TOTAL', '$currency ${fmt.format(inv.total)}', bold: true, valueColor: AppTheme.primary),
                    if (inv.paidAmount > 0) ...[
                      _totalRow('Paid', '$currency ${fmt.format(inv.paidAmount)}', valueColor: AppTheme.success),
                      _totalRow('Balance Due', '$currency ${fmt.format(inv.balance)}', bold: true, valueColor: AppTheme.error),
                    ],
                  ]),
                ),

                if (inv.notes != null && inv.notes!.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Container(width: double.infinity, padding: const EdgeInsets.all(12), decoration: BoxDecoration(color: Colors.blue.shade50, borderRadius: BorderRadius.circular(8)),
                    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      const Text('Notes', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 12)),
                      const SizedBox(height: 4),
                      Text(inv.notes!, style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
                    ])),
                ],
              ]),
            ),
          ]),
        ),

      bottomNavigationBar: !_loading ? SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: _generatingPdf ? null : _generateAndPreview,
                icon: _generatingPdf ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary)) : const Icon(Icons.picture_as_pdf),
                label: const Text('Preview PDF'),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: ElevatedButton.icon(
                onPressed: _generatingPdf ? null : _shareViaWhatsApp,
                icon: const Icon(Icons.send, size: 18),
                label: const Text('Send via WhatsApp'),
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF25D366)),
              ),
            ),
          ]),
        ),
      ) : null,
    );
  }

  Widget _statusBadge(String status) {
    final colors = {'PAID': Colors.green, 'PENDING': Colors.orange, 'PARTIAL': Colors.blue, 'OVERDUE': Colors.red};
    final color = colors[status] ?? Colors.grey;
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(color: color.withOpacity(0.2), borderRadius: BorderRadius.circular(20)),
      child: Text(status, style: TextStyle(color: color.shade200, fontSize: 10, fontWeight: FontWeight.w600)),
    );
  }

  Widget _totalRow(String label, String value, {bool bold = false, Color? valueColor}) => Padding(
    padding: const EdgeInsets.symmetric(vertical: 3),
    child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
      Text(label, style: TextStyle(fontSize: bold ? 15 : 13, fontWeight: bold ? FontWeight.w700 : FontWeight.normal, color: bold ? AppTheme.textDark : AppTheme.textGray)),
      Text(value, style: TextStyle(fontSize: bold ? 15 : 13, fontWeight: bold ? FontWeight.w800 : FontWeight.w600, color: valueColor ?? AppTheme.textDark)),
    ]),
  );
}
