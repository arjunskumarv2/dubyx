import 'package:barcode/barcode.dart' as bc;
import 'package:flutter/services.dart' show rootBundle;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;
import 'package:intl/intl.dart';
import '../models/invoice.dart';
import '../models/order.dart';

class PdfService {
  static final PdfService _instance = PdfService._internal();
  factory PdfService() => _instance;
  PdfService._internal();

  static const _green = PdfColor.fromInt(0xFF1F6F4A); // Saudi flag green
  static const _maroon = PdfColor.fromInt(0xFF8D1B3D);
  static const _gold = PdfColor.fromInt(0xFFC9A84C);
  static const _gray = PdfColor.fromInt(0xFF6B7280);
  static const _lightGray = PdfColor.fromInt(0xFFF3F4F6);
  static const _whiteLight = PdfColor(1, 1, 1, 0.75);

  // Strip non-ASCII chars — PDF Type1 fonts are Latin-1 only; Arabic glyphs render blank
  String _safeCurrency(String? sym) {
    if (sym == null || sym.isEmpty) return 'SAR';
    final ascii = sym.replaceAll(RegExp(r'[^\x00-\x7F]'), '').trim();
    return ascii.isEmpty ? 'SAR' : ascii;
  }

  String _fmt(NumberFormat fmt, num? value) => fmt.format(value ?? 0);

  pw.Font? _arabicFont;
  pw.Font? _arabicBold;

  /// Arabic is mandatory on a Saudi tax invoice, and PDF core fonts cannot
  /// render it — Amiri is bundled with the app and loaded once.
  Future<void> _loadArabicFonts() async {
    if (_arabicFont != null) return;
    try {
      _arabicFont = pw.Font.ttf(await rootBundle.load('assets/fonts/Amiri-Regular.ttf'));
      _arabicBold = pw.Font.ttf(await rootBundle.load('assets/fonts/Amiri-Bold.ttf'));
    } catch (_) {
      // Font missing — the invoice still prints, in English only
    }
  }

  pw.Widget _ar(String text, {double size = 9, bool bold = false, PdfColor color = PdfColors.black}) {
    if (_arabicFont == null) return pw.SizedBox();
    return pw.Directionality(
      textDirection: pw.TextDirection.rtl,
      child: pw.Text(text, style: pw.TextStyle(
        font: bold ? _arabicBold : _arabicFont,
        fontSize: size, color: color,
        fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
      )),
    );
  }

  Future<List<int>> generateInvoicePdf({
    required Invoice invoice,
    required List<OrderItem> items,
    Map<String, String>? settings,
  }) async {
    await _loadArabicFonts();

    final doc = pw.Document();
    final currency = _safeCurrency(settings?['currency']);
    final companyName = settings?['company_name'] ?? 'Dubyx Trading Est.';
    final companyNameAr = settings?['company_name_ar'] ?? '';
    final companyAddress = settings?['company_address'] ?? 'Riyadh, Saudi Arabia';
    final companyPhone = settings?['company_phone'] ?? '';
    final companyEmail = settings?['company_email'] ?? '';
    final sellerVat = settings?['company_vat_number'] ?? '';
    final sellerCr = settings?['company_cr_number'] ?? '';
    final vatRate = settings?['default_tax_rate'] ?? '15';
    // Force 'en' locale — device Arabic locale would emit non-ASCII numerals that PDF Type1 fonts can't render
    final fmt = NumberFormat('#,##0.00', 'en');

    doc.addPage(pw.Page(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(32),
      build: (ctx) => pw.Column(
        crossAxisAlignment: pw.CrossAxisAlignment.start,
        children: [
          // Header
          pw.Container(
            padding: const pw.EdgeInsets.all(20),
            decoration: const pw.BoxDecoration(color: _green, borderRadius: pw.BorderRadius.all(pw.Radius.circular(12))),
            child: pw.Row(
              mainAxisAlignment: pw.MainAxisAlignment.spaceBetween,
              children: [
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                  pw.Text(companyName, style: pw.TextStyle(color: PdfColors.white, fontSize: 22, fontWeight: pw.FontWeight.bold)),
                  pw.SizedBox(height: 4),
                  if (companyNameAr.isNotEmpty) _ar(companyNameAr, size: 12, bold: true, color: PdfColors.white),
                  pw.Text(companyAddress, style: const pw.TextStyle(color: _whiteLight, fontSize: 9)),
                  pw.Text('$companyPhone  |  $companyEmail', style: const pw.TextStyle(color: _whiteLight, fontSize: 9)),
                  if (sellerVat.isNotEmpty) pw.Text('VAT No: $sellerVat', style: const pw.TextStyle(color: _whiteLight, fontSize: 9)),
                  if (sellerCr.isNotEmpty) pw.Text('CR No: $sellerCr', style: const pw.TextStyle(color: _whiteLight, fontSize: 9)),
                ]),
                pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.end, children: [
                  pw.Text(invoice.titleEn, style: pw.TextStyle(color: _gold, fontSize: 15, fontWeight: pw.FontWeight.bold)),
                  _ar(invoice.titleAr, size: 14, bold: true, color: PdfColors.white),
                  pw.SizedBox(height: 2),
                  pw.Text(invoice.invoiceNumber, style: const pw.TextStyle(color: PdfColors.white, fontSize: 11)),
                  if (invoice.uuid != null)
                    pw.Text('UUID: ${invoice.uuid}', style: const pw.TextStyle(color: _whiteLight, fontSize: 6)),
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
              if (invoice.customerVatNumber != null)
                pw.Text('VAT No: ${invoice.customerVatNumber}', style: const pw.TextStyle(color: PdfColors.grey600, fontSize: 10)),
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
                decoration: const pw.BoxDecoration(color: _green),
                children: ['Description', 'Qty', 'Unit Price', 'VAT %', 'Total'].map((h) =>
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
                    _cell('$currency ${_fmt(fmt, item.price)}', right: true),
                    _cell('${item.taxRate.toStringAsFixed(0)}%', right: true),
                    _cell('$currency ${_fmt(fmt, item.total)}', right: true),
                  ],
                );
              }),
            ],
          ),
          pw.SizedBox(height: 20),

          // Totals
          pw.Row(mainAxisAlignment: pw.MainAxisAlignment.end, children: [
            pw.SizedBox(width: 200, child: pw.Column(children: [
              _totalRow('Total (excl. VAT):', '$currency ${_fmt(fmt, invoice.subtotal)}'),
              _totalRow('VAT ($vatRate%):', '$currency ${_fmt(fmt, invoice.taxAmount)}'),
              if (invoice.discount > 0)
                _totalRow('Discount (${invoice.discount.toStringAsFixed(0)}%):', '-$currency ${_fmt(fmt, invoice.subtotal * invoice.discount / 100)}'),
              pw.Divider(color: _green),
              _totalRow('Total (incl. VAT):', '$currency ${_fmt(fmt, invoice.total)}', bold: true),
              if (invoice.paidAmount > 0) ...[
                _totalRow('Paid:', '$currency ${_fmt(fmt, invoice.paidAmount)}'),
                _totalRow('Balance Due:', '$currency ${_fmt(fmt, invoice.balance)}', bold: true),
              ],
            ])),
          ]),

          if (invoice.isNote && invoice.noteReason != null) ...[
            pw.SizedBox(height: 16),
            pw.Text('Reason for issue:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.Text(invoice.noteReason!, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
          ] else if (invoice.notes != null) ...[
            pw.SizedBox(height: 16),
            pw.Text('Notes:', style: pw.TextStyle(fontWeight: pw.FontWeight.bold, fontSize: 9)),
            pw.Text(invoice.notes!, style: const pw.TextStyle(fontSize: 9, color: PdfColors.grey700)),
          ],

          // ZATCA QR code — the Base64 TLV payload issued with the invoice
          if (invoice.qrCode != null && invoice.qrCode!.isNotEmpty) ...[
            pw.SizedBox(height: 16),
            pw.Row(children: [
              pw.BarcodeWidget(
                barcode: bc.Barcode.qrCode(errorCorrectLevel: bc.BarcodeQRCorrectionLevel.medium),
                data: invoice.qrCode!,
                width: 80,
                height: 80,
                drawText: false,
              ),
              pw.SizedBox(width: 10),
              pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
                pw.Text('Scan to verify — ZATCA e-invoice',
                    style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
                _ar('امسح للتحقق من الفاتورة', size: 8, color: PdfColors.grey600),
              ]),
            ]),
          ],

          pw.Spacer(),

          // Footer
          pw.Container(
            padding: const pw.EdgeInsets.all(12),
            decoration: const pw.BoxDecoration(color: _green, borderRadius: pw.BorderRadius.all(pw.Radius.circular(8))),
            child: pw.Column(children: [
              pw.Text('$companyName  |  VAT $sellerVat  |  $companyAddress',
                  style: const pw.TextStyle(color: _whiteLight, fontSize: 8)),
              pw.SizedBox(height: 2),
              pw.Text('Electronically generated tax invoice issued under the KSA VAT Law and ZATCA e-invoicing regulations.',
                  style: const pw.TextStyle(color: _whiteLight, fontSize: 6)),
            ]),
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
