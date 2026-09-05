class Invoice {
  final String id;
  final String invoiceNumber;
  /// Null for credit and debit notes — they correct an invoice rather than an order.
  final String? orderId;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final String? customerTaxNumber;
  final String? customerVatNumber;
  final String generatedByName;
  final String paymentStatus;
  final double subtotal;
  final double taxAmount;
  final double discount;
  final double total;
  final double paidAmount;
  final DateTime? dueDate;
  final String? notes;
  final DateTime createdAt;
  final dynamic order;

  // ZATCA e-invoicing
  final String? uuid;
  final String invoiceType; // STANDARD | SIMPLIFIED
  final String invoiceKind; // INVOICE | CREDIT_NOTE | DEBIT_NOTE
  final String? qrCode;     // Base64 TLV payload printed as a QR on the invoice
  final String? noteReason;

  Invoice({
    required this.id, required this.invoiceNumber, this.orderId,
    required this.customerId, required this.customerName, required this.customerPhone,
    required this.customerAddress, this.customerTaxNumber, this.customerVatNumber,
    required this.generatedByName,
    required this.paymentStatus, required this.subtotal, required this.taxAmount,
    required this.discount, required this.total, required this.paidAmount,
    this.dueDate, this.notes, required this.createdAt, this.order,
    this.uuid, this.invoiceType = 'STANDARD', this.invoiceKind = 'INVOICE',
    this.qrCode, this.noteReason,
  });

  factory Invoice.fromJson(Map<String, dynamic> j) => Invoice(
    id: j['id'], invoiceNumber: j['invoiceNumber'], orderId: j['orderId'],
    customerId: j['customerId'], customerName: j['customer']?['shopName'] ?? '',
    customerPhone: j['customer']?['phone'] ?? '',
    customerAddress: j['customer']?['address'] ?? '',
    customerTaxNumber: j['customer']?['taxNumber'],
    customerVatNumber: j['customer']?['vatNumber'],
    generatedByName: j['generatedBy']?['name'] ?? '',
    paymentStatus: j['paymentStatus'],
    subtotal: (j['subtotal'] as num).toDouble(),
    taxAmount: (j['taxAmount'] as num?)?.toDouble() ?? 0,
    discount: (j['discount'] as num?)?.toDouble() ?? 0,
    total: (j['total'] as num).toDouble(),
    paidAmount: (j['paidAmount'] as num?)?.toDouble() ?? 0,
    dueDate: j['dueDate'] != null ? DateTime.parse(j['dueDate']) : null,
    notes: j['notes'],
    createdAt: DateTime.parse(j['createdAt']),
    order: j['order'],
    uuid: j['uuid'],
    invoiceType: j['invoiceType'] ?? 'STANDARD',
    invoiceKind: j['invoiceKind'] ?? 'INVOICE',
    qrCode: j['qrCode'],
    noteReason: j['noteReason'],
  );

  double get balance => total - paidAmount;
  bool get isPaid => paymentStatus == 'PAID';
  bool get isSimplified => invoiceType == 'SIMPLIFIED';
  bool get isNote => invoiceKind != 'INVOICE';

  /// Bilingual document title required by ZATCA.
  String get titleEn => invoiceKind == 'CREDIT_NOTE'
      ? 'CREDIT NOTE'
      : invoiceKind == 'DEBIT_NOTE'
          ? 'DEBIT NOTE'
          : isSimplified ? 'SIMPLIFIED TAX INVOICE' : 'TAX INVOICE';

  String get titleAr => invoiceKind == 'CREDIT_NOTE'
      ? 'إشعار دائن'
      : invoiceKind == 'DEBIT_NOTE'
          ? 'إشعار مدين'
          : isSimplified ? 'فاتورة ضريبية مبسطة' : 'فاتورة ضريبية';
}
