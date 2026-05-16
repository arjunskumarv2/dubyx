import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
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
import 'screens/van/van_stock_screen.dart';
import 'screens/van/stock_request_screen.dart';
import 'theme/app_theme.dart';
import 'package:iconsax/iconsax.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: AppTheme.primary,
    statusBarIconBrightness: Brightness.light,
  ));
  try {
    await Firebase.initializeApp();
  } catch (_) {}
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
          '/van-stock': (_) => const VanStockScreen(),
          '/stock-request': (_) => const StockRequestScreen(),
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

  final _pages = const [
    DashboardScreen(),
    OrdersScreen(),
    CustomersScreen(),
    InvoicesScreen(),
    CollectionsScreen(),
    RouteScreen(),
  ];

  static const _navItems = [
    _NavDef(icon: Iconsax.home, label: 'Home'),
    _NavDef(icon: Iconsax.shopping_cart, label: 'Orders'),
    _NavDef(icon: Iconsax.people, label: 'Customers'),
    _NavDef(icon: Iconsax.document_text, label: 'Invoices'),
    _NavDef(icon: Iconsax.money_recive, label: 'Collect'),
    _NavDef(icon: Icons.route_outlined, label: 'Routes'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: IndexedStack(index: _index, children: _pages),
      bottomNavigationBar: _BottomNav(
        current: _index,
        items: _navItems,
        onTap: (i) => setState(() => _index = i),
      ),
    );
  }
}

class _NavDef {
  final IconData icon;
  final String label;
  const _NavDef({required this.icon, required this.label});
}

class _BottomNav extends StatelessWidget {
  final int current;
  final List<_NavDef> items;
  final ValueChanged<int> onTap;

  const _BottomNav({required this.current, required this.items, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(top: BorderSide(color: Color(0xFFF0F0F0))),
        boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.06), blurRadius: 12, offset: const Offset(0, -3))],
      ),
      child: SafeArea(
        top: false,
        child: SizedBox(
          height: 56,
          child: Row(
            children: List.generate(items.length, (i) {
              final active = i == current;
              final item = items[i];
              return Expanded(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onTap(i),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                        decoration: active
                          ? BoxDecoration(color: AppTheme.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(20))
                          : null,
                        child: Icon(item.icon, size: 20, color: active ? AppTheme.primary : const Color(0xFF9CA3AF)),
                      ),
                      Text(
                        item.label,
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: active ? FontWeight.w700 : FontWeight.w400,
                          color: active ? AppTheme.primary : const Color(0xFF9CA3AF),
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
              );
            }),
          ),
        ),
      ),
    );
  }
}
