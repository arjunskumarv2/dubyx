class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String? phone;
  final String? area;
  final String? avatar;

  User({required this.id, required this.name, required this.email, required this.role, this.phone, this.area, this.avatar});

  factory User.fromJson(Map<String, dynamic> j) => User(
    id: j['id'], name: j['name'], email: j['email'], role: j['role'],
    phone: j['phone'], area: j['area'], avatar: j['avatar'],
  );

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'email': email, 'role': role, 'phone': phone, 'area': area};

  bool get isSuperAdmin => role == 'SUPER_ADMIN';
  bool get isAdmin => role == 'ADMIN' || isSuperAdmin;
  bool get isManager => role == 'MANAGER' || isAdmin;
  bool get isSalesman => role == 'SALESMAN';
}
