class Product {
  final String id;
  final String name;
  final String sku;
  final String? barcode;
  final String? categoryName;
  final double sellingPrice;
  final double costPrice;
  final double taxRate;
  final String unit;
  final int currentStock;
  final int minStock;
  final bool isActive;

  Product({
    required this.id, required this.name, required this.sku, this.barcode,
    this.categoryName, required this.sellingPrice, required this.costPrice,
    required this.taxRate, required this.unit, required this.currentStock,
    required this.minStock, required this.isActive,
  });

  factory Product.fromJson(Map<String, dynamic> j) => Product(
    id: j['id'], name: j['name'], sku: j['sku'], barcode: j['barcode'],
    categoryName: j['category']?['name'],
    sellingPrice: (j['sellingPrice'] as num).toDouble(),
    costPrice: (j['costPrice'] as num).toDouble(),
    taxRate: (j['taxRate'] as num?)?.toDouble() ?? 0,
    unit: j['unit'] ?? 'PCS',
    currentStock: j['currentStock'] ?? 0,
    minStock: j['minStock'] ?? 10,
    isActive: j['isActive'] ?? true,
  );

  bool get isLowStock => currentStock <= minStock;
}
