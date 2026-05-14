class Invoice {
  final String id;
  final String invoiceNumber;
  final String orderId;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final String? customerTaxNumber;
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

  Invoice({
    required this.id, required this.invoiceNumber, required this.orderId,
    required this.customerId, required this.customerName, required this.customerPhone,
    required this.customerAddress, this.customerTaxNumber, required this.generatedByName,
    required this.paymentStatus, required this.subtotal, required this.taxAmount,
    required this.discount, required this.total, required this.paidAmount,
    this.dueDate, this.notes, required this.createdAt, this.order,
  });

  factory Invoice.fromJson(Map<String, dynamic> j) => Invoice(
    id: j['id'], invoiceNumber: j['invoiceNumber'], orderId: j['orderId'],
    customerId: j['customerId'], customerName: j['customer']?['shopName'] ?? '',
    customerPhone: j['customer']?['phone'] ?? '',
    customerAddress: j['customer']?['address'] ?? '',
    customerTaxNumber: j['customer']?['taxNumber'],
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
  );

  double get balance => total - paidAmount;
  bool get isPaid => paymentStatus == 'PAID';
}
