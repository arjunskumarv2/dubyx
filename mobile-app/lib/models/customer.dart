class Customer {
  final String id;
  final String shopName;
  final String ownerName;
  final String phone;
  final String? email;
  final String address;
  final String area;
  final String? route;
  final double? latitude;
  final double? longitude;
  final double creditLimit;
  final String? taxNumber;
  final bool isActive;

  Customer({
    required this.id, required this.shopName, required this.ownerName,
    required this.phone, this.email, required this.address, required this.area,
    this.route, this.latitude, this.longitude, required this.creditLimit,
    this.taxNumber, required this.isActive,
  });

  factory Customer.fromJson(Map<String, dynamic> j) => Customer(
    id: j['id'], shopName: j['shopName'], ownerName: j['ownerName'],
    phone: j['phone'], email: j['email'], address: j['address'], area: j['area'],
    route: j['route'], latitude: (j['latitude'] as num?)?.toDouble(),
    longitude: (j['longitude'] as num?)?.toDouble(),
    creditLimit: (j['creditLimit'] as num?)?.toDouble() ?? 0,
    taxNumber: j['taxNumber'], isActive: j['isActive'] ?? true,
  );
}
