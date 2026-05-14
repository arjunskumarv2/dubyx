import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/invoice.dart';
import '../models/order.dart';

class PdfService {
  static final PdfService _instance = PdfService._internal();
  factory PdfService() => _instance;
  PdfService._internal();

  static const _maroon = PdfColor.fromInt(0xFF8D1B3D);
  static const _gold = PdfColor.fromInt(0xFFC9A84C);
  static const _gray = PdfColor.fromInt(0xFF6B7280);
  static const _lightGray = PdfColor.fromInt(0xFFF3F4F6);

  Future<List<int>> generateInvoicePdf({
    required Invoice invoice,
    required List<OrderItem> items,
    Map<String, String>? settings,
  }) async {
    final doc = pw.Document();
    final currency = settings?['currency_symbol'] ?? 'QAR';
    final companyName = settings?['company_name'] ?? 'Dubyx Trading LLC';
    final companyAddress = settings?['company_address'] ?? 'Doha, Qatar';
    final companyPhone = settings?['company_phone'] ?? '';
    final companyEmail = settings?['company_email'] ?? '';
    final trn = settings?['company_trn'] ?? '';
    final fmt = NumberFormat('#,##0.00');

    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      build: (ctx) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          // Header
          pw.Container(
            padding: const pw.EdgeInsets.all(20),
            decoration: const pw.BoxDecoration(color: _maroon, borderRadius: pw.BorderRadius.all(pw.Radius.circular(12))),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Text(companyName, style: pw.TextStyle(color: PdfColors.white, fontSize: 22, fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 4),
                  pw.Text(companyAddress, style: const pw.TextStyle(color: PdfColors.white70, fontSize: 9)),
                  pw.Text('$companyPhone  |  $companyEmail', style: const pw.TextStyle(color: PdfColors.white70, fontSize: 9)),
                  if (trn.isNotEmpty) pw.Text('TRN: $trn', style: const pw.TextStyle(color: PdfColors.white70, fontSize: 9)),
                ]),
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                  pw.Text('INVOICE', style: pw.TextStyle(color: _gold, fontSize: 24, fontWeight: pw.FontWeight.bold)),
                  pw.Text(invoice.invoiceNumber, style: const pw.TextStyle(color: PdfColors.white, fontSize: 11)),
                ]),
              ],
            ),
          ),
          pw.SizedBox(height: 20),

          // Bill To / Invoice Info
          pw.Row(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
            pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text('BILL TO', style: pw.TextStyle(color: _gray, fontSize: 8, fontWeight: pw.FontWeight.bold)),
              pw.SizedBox(height: 4),
              pw.Text(invoice.customerName, style: pw.TextStyle(fontSize: 13, fontWeight: pw.FontWeight.bold)),
              pw.Text(invoice.customerPhone, style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 10)),
              pw.Text(invoice.customerAddress, style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 10)),
              if (invoice.customerTaxNumber != null)
                pw.Text('TRN: ${invoice.customerTaxNumber}', style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 10)),
            ])),
            pw.SizedBox(width: 40),
            pw.Expanded(child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
              _infoRow('Date:', DateFormat('dd MMM yyyy').format(invoice.createdAt)),
              _infoRow('Due Date:', invoice.dueDate != null ? DateFormat('dd MMM yyyy').format(invoice.dueDate!) : 'On Receipt'),
              _infoRow('Status:', invoice.paymentStatus),
            ])),
          ]),
          pw.SizedBox(height: 20),

          // Items Table
          pw.Table(
            columnWidths: {
              0: const pw.FlexColumnWidth(3),
              1: const pw.FixedColumnWidth(50),
              2: const pw.FixedColumnWidth(80),
              3: const pw.FixedColumnWidth(50),
              4: const pw.FixedColumnWidth(80),
            },
            children: [
              pw.TableRow(
                decoration: const pw.BoxDecoration(color: _maroon),
                children: ['Description', 'Qty', 'Unit Price', 'Tax', 'Total'].map((h) =>
                  pw.Padding(padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 8),
                    child: pw.Text(h, style: pw.TextStyle(color: PdfColors.white, fontSize: 9, fontWeight: pw.FontWeight.bold),
                      textAlign: h == 'Description' ? pw.TextAlign.left : pw.TextAlign.right)),
                ).toList(),
              ),
              ...items.asMap().entries.map((entry) {
                final i = entry.key;
                final item = entry.value;
                return pw.TableRow(
                  decoration: pw.BoxDecoration(color: i.isEven ? PdfColors.white : _lightGray),
                  children: [
                    _cell(item.productName),
                    _cell(item.quantity.toString(), right: true),
                    _cell('$currency ${fmt.format(item.price)}', right: true),
                    _cell('${item.taxRate.toStringAsFixed(0)}%', right: true),
                    _cell('$currency ${fmt.format(item.total)}', right: true),
                  ],
                );
              }),
            ],
          ),
          pw.SizedBox(height: 20),

          // Totals
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
            pw.SizedBox(width: 200, child: pw.Column(children: [
              _totalRow('Subtotal:', '$currency ${fmt.format(invoice.subtotal)}'),
              _totalRow('Tax:', '$currency ${fmt.format(invoice.taxAmount)}'),
              if (invoice.discount > 0)
                _totalRow('Discount (${invoice.discount.toStringAsFixed(0)}%):', '-$currency ${fmt.format(invoice.subtotal * invoice.discount / 100)}'),
              pw.Divider(color: _maroon),
              _totalRow('TOTAL:', '$currency ${fmt.format(invoice.total)}', bold: true),
              if (invoice.paidAmount > 0) ...[
                _totalRow('Paid:', '$currency ${fmt.format(invoice.paidAmount)}'),
                _totalRow('Balance Due:', '$currency ${fmt.format(invoice.balance)}', bold: true),
              ],
            ])),
          ]),

          if (invoice.notes != null) ...[
            pw.SizedBox(height: 16),
            pw.Text('Notes:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.Text(invoice.notes!, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
          ],

          pw.Spacer(),

          // Footer
          pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: const pw.BoxDecoration(color: _maroon, borderRadius: pw.BorderRadius.all(pw.Radius.circular(8))),
            child: pw.Center(child: pw.Text('Thank you for your business! | $companyName | Doha, Qatar',
              style: const pw.TextStyle(color: PdfColors.white70, fontSize: 9))),
          ),
        ],
      ),
    ));

    return doc.save();
  }

  pw.Widget _cell(String text, {bool right = false}) => pw.Padding(
    padding: const pw.EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    child: pw.Text(text, style: const pw.TextStyle(fontSize: 9),
      textAlign: right ? pw.TextAlign.right : pw.TextAlign.left),
  );

  pw.Widget _infoRow(String label, String value) => pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
      pw.Text(label, style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 9)),
      pw.SizedBox(width: 8),
      pw.Text(value, style: pw.TextStyle(fontSize: 9, fontWeight: pw.FontWeight.bold)),
    ]),
  );

  pw.Widget _totalRow(String label, String value, {bool bold = false}) => pw.Padding(
    padding: const pw.EdgeInsets.symmetric(vertical: 2),
    child: pw.Row(mainAxisAlignment: pw.MainAxisAlignment.spaceBetween, children: [
      pw.Text(label, style: pw.TextStyle(color: bold ? null : _gray, fontSize: bold ? 11 : 9, fontWeight: bold ? pw.FontWeight.bold : null)),
      pw.Text(value, style: pw.TextStyle(fontSize: bold ? 11 : 9, fontWeight: bold ? pw.FontWeight.bold : null,
        color: bold ? _maroon : null)),
    ]),
  );
}
