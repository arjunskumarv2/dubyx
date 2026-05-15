import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'providers/auth_provider.dart';
import 'screens/auth/login_screen.dart';
import 'screens/dashboard/dashboard_screen.dart';
import 'screens/orders/orders_screen.dart';
import 'screens/orders/new_order_screen.dart';
import 'screens/customers/customers_screen.dart';
import 'screens/billing/invoices_screen.dart';
import 'screens/collections/collections_screen.dart';
import 'screens/inventory/inventory_screen.dart';
import 'screens/routes/route_screen.dart';
import 'theme/app_theme.dart';
import 'package:iconsax/iconsax.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: AppTheme.primary,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const DubYxApp());
}

class DubYxApp extends StatelessWidget {
  const DubYxApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AuthProvider()..checkAuth(),
      child: MaterialApp(
        title: 'Dubyx',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.theme,
        routes: {
          '/orders/new': (_) => const NewOrderScreen(),
          '/orders': (_) => const OrdersScreen(),
          '/customers': (_) => const CustomersScreen(),
          '/invoices': (_) => const InvoicesScreen(),
          '/collections': (_) => const CollectionsScreen(),
          '/inventory': (_) => const InventoryScreen(),
        },
        home: const AuthGate(),
      ),
    );
  }
}

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AuthProvider>(
      builder: (ctx, auth, _) {
        if (auth.isLoading) {
          return const Scaffold(
            backgroundColor: AppTheme.primary,
            body: Center(child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
              Text('D', style: TextStyle(color: Colors.white, fontSize: 80, fontWeight: FontWeight.w900)),
              SizedBox(height: 8),
              Text('Dubyx', style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w700, letterSpacing: 2)),
              SizedBox(height: 40),
              CircularProgressIndicator(color: Color(0xFFC9A84C), strokeWidth: 3),
            ])),
          );
        }
        return auth.isLoggedIn ? const MainShell() : const LoginScreen();
      },
    );
  }
}

class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  int _index = 0;

  final _pages = [
    const DashboardScreen(),
    const OrdersScreen(),
    const CustomersScreen(),
    const RouteScreen(),
    const InvoicesScreen(),
    const CollectionsScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: const Border(top: BorderSide(color: Color(0xFFF0F0F0))),
          boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, -4))],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(mainAxisAlignment: MainAxisAlignment.spaceAround, children: [
              _NavItem(icon: Iconsax.home, label: 'Home', index: 0, current: _index, onTap: () => setState(() => _index = 0)),
              _NavItem(icon: Iconsax.shopping_cart, label: 'Orders', index: 1, current: _index, onTap: () => setState(() => _index = 1)),
              _NavItem(icon: Iconsax.people, label: 'Customers', index: 2, current: _index, onTap: () => setState(() => _index = 2)),
              _NavItem(icon: Icons.route_outlined, label: 'Routes', index: 3, current: _index, onTap: () => setState(() => _index = 3)),
              _NavItem(icon: Iconsax.document_text, label: 'Invoices', index: 4, current: _index, onTap: () => setState(() => _index = 4)),
              _NavItem(icon: Iconsax.money_recive, label: 'Collect', index: 5, current: _index, onTap: () => setState(() => _index = 5)),
            ]),
          ),
        ),
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  final IconData icon;
  final String label;
  final int index;
  final int current;
  final VoidCallback onTap;

  const _NavItem({required this.icon, required this.label, required this.index, required this.current, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final active = index == current;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: active ? BoxDecoration(color: AppTheme.primary.withOpacity(0.08), borderRadius: BorderRadius.circular(12)) : null,
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: active ? AppTheme.primary : const Color(0xFF9CA3AF), size: 22),
          const SizedBox(height: 2),
          Text(label, style: TextStyle(fontSize: 10, fontWeight: active ? FontWeight.w700 : FontWeight.normal, color: active ? AppTheme.primary : const Color(0xFF9CA3AF))),
        ]),
      ),
    );
  }
}
