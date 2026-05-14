class OrderItem {
  final String id;
  final String productId;
  final String productName;
  final String unit;
  final int quantity;
  final double price;
  final double discount;
  final double taxRate;
  final double total;

  OrderItem({
    required this.id, required this.productId, required this.productName,
    required this.unit, required this.quantity, required this.price,
    this.discount = 0, this.taxRate = 0, required this.total,
  });

  factory OrderItem.fromJson(Map<String, dynamic> j) => OrderItem(
    id: j['id'] ?? '', productId: j['productId'],
    productName: j['product']?['name'] ?? '',
    unit: j['product']?['unit'] ?? 'PCS',
    quantity: j['quantity'], price: (j['price'] as num).toDouble(),
    discount: (j['discount'] as num?)?.toDouble() ?? 0,
    taxRate: (j['taxRate'] as num?)?.toDouble() ?? 0,
    total: (j['total'] as num).toDouble(),
  );
}

class Order {
  final String id;
  final String orderNumber;
  final String customerId;
  final String customerName;
  final String customerPhone;
  final String salesmanId;
  final String salesmanName;
  final String status;
  final double subtotal;
  final double taxAmount;
  final double discount;
  final double total;
  final String? notes;
  final List<OrderItem> items;
  final DateTime createdAt;

  Order({
    required this.id, required this.orderNumber, required this.customerId,
    required this.customerName, required this.customerPhone,
    required this.salesmanId, required this.salesmanName, required this.status,
    required this.subtotal, required this.taxAmount, required this.discount,
    required this.total, this.notes, required this.items, required this.createdAt,
  });

  factory Order.fromJson(Map<String, dynamic> j) => Order(
    id: j['id'], orderNumber: j['orderNumber'],
    customerId: j['customerId'] ?? j['customer']?['id'] ?? '',
    customerName: j['customer']?['shopName'] ?? '',
    customerPhone: j['customer']?['phone'] ?? '',
    salesmanId: j['salesmanId'] ?? j['salesman']?['id'] ?? '',
    salesmanName: j['salesman']?['name'] ?? '',
    status: j['status'],
    subtotal: (j['subtotal'] as num).toDouble(),
    taxAmount: (j['taxAmount'] as num?)?.toDouble() ?? 0,
    discount: (j['discount'] as num?)?.toDouble() ?? 0,
    total: (j['total'] as num).toDouble(),
    notes: j['notes'],
    items: (j['items'] as List? ?? []).map((i) => OrderItem.fromJson(i)).toList(),
    createdAt: DateTime.parse(j['createdAt']),
  );

  bool get isPending => status == 'PENDING';
  bool get isCancelled => status == 'CANCELLED';
}
