import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/api_service.dart';
import '../../theme/app_theme.dart';
import '../../widgets/common/app_card.dart';
import 'package:iconsax/iconsax.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _api = ApiService();
  Map<String, dynamic>? _stats;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _loadStats();
  }

  Future<void> _loadStats() async {
    try {
      final data = await _api.get('/reports/dashboard');
      if (mounted) setState(() { _stats = data; _loading = false; });
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<AuthProvider>().user;

    return Scaffold(
      backgroundColor: AppTheme.background,
      appBar: AppBar(
        backgroundColor: AppTheme.primary,
        title: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          const Text('Dubyx', style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white)),
          Text('Welcome, ${user?.name ?? ''}', style: const TextStyle(fontSize: 11, color: Colors.white70)),
        ]),
        actions: [
          IconButton(
            icon: const Icon(Iconsax.notification, color: Colors.white),
            onPressed: () {},
          ),
          PopupMenuButton<String>(
            icon: CircleAvatar(
              radius: 16,
              backgroundColor: Colors.white24,
              child: Text(
                (user?.name ?? 'U').substring(0, 1).toUpperCase(),
                style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 13),
              ),
            ),
            onSelected: (val) async {
              if (val == 'logout') {
                final confirm = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    title: const Text('Logout'),
                    content: const Text('Are you sure you want to logout?'),
                    actions: [
                      TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, true),
                        child: const Text('Logout', style: TextStyle(color: AppTheme.error)),
                      ),
                    ],
                  ),
                );
                if (confirm == true && context.mounted) {
                  await context.read<AuthProvider>().logout();
                }
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                enabled: false,
                child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  Text(user?.name ?? '', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: AppTheme.textDark)),
                  Text(user?.role ?? '', style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
                ]),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(value: 'logout', child: Row(children: [
                Icon(Iconsax.logout, size: 18, color: AppTheme.error),
                SizedBox(width: 10),
                Text('Logout', style: TextStyle(color: AppTheme.error, fontWeight: FontWeight.w600)),
              ])),
            ],
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: AppTheme.primary,
        onRefresh: _loadStats,
        child: _loading
          ? const Center(child: CircularProgressIndicator(color: AppTheme.primary))
          : SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              // Greeting card
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(colors: [AppTheme.primary, Color(0xFFB22351)], begin: Alignment.topLeft, end: Alignment.bottomRight),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [BoxShadow(color: AppTheme.primary.withValues(alpha: 0.3), blurRadius: 16, offset: const Offset(0, 6))],
                ),
                child: Row(children: [
                  Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text('Good ${_greeting()}!', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                    const SizedBox(height: 4),
                    Text(user?.name ?? '', style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 8),
                    Container(padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4), decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
                      child: Text(user?.area ?? user?.role ?? '', style: const TextStyle(color: Colors.white, fontSize: 11))),
                  ])),
                  Container(width: 56, height: 56, decoration: BoxDecoration(color: Colors.white.withValues(alpha: 0.2), shape: BoxShape.circle),
                    child: Center(child: Text(user?.name[0].toUpperCase() ?? 'D', style: const TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w800)))),
                ]),
              ),

              const SizedBox(height: 20),
              const Text('Today', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
              const SizedBox(height: 12),

              Row(children: [
                Expanded(child: StatCard(title: "Today's Orders", value: '${_stats?['todayOrders'] ?? 0}', icon: Iconsax.shopping_cart, color: AppTheme.primary)),
                const SizedBox(width: 12),
                Expanded(child: StatCard(title: 'Collected Today', value: 'QAR ${((_stats?['todayCollections'] ?? 0) as num).toStringAsFixed(0)}', icon: Iconsax.money, color: AppTheme.gold)),
              ]),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: StatCard(title: 'Pending Amount', value: 'QAR ${((_stats?['pendingAmount'] ?? 0) as num).toStringAsFixed(0)}', icon: Iconsax.clock, color: const Color(0xFFF59E0B))),
                const SizedBox(width: 12),
                Expanded(child: StatCard(title: 'Customers', value: '${_stats?['totalCustomers'] ?? 0}', icon: Iconsax.people, color: const Color(0xFF3B82F6))),
              ]),

              const SizedBox(height: 24),
              const Text('Quick Actions', style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
              const SizedBox(height: 12),

              LayoutBuilder(builder: (ctx, constraints) {
                final w = constraints.maxWidth;
                final itemW = (w - 12) / 2;
                final aspect = itemW / 72;
                return GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: aspect.clamp(1.4, 2.2),
                  children: [
                    _QuickAction(icon: Iconsax.add_square, label: 'New Order', color: AppTheme.primary, onTap: () => Navigator.pushNamed(context, '/orders/new')),
                    _QuickAction(icon: Iconsax.people, label: 'Customers', color: const Color(0xFF3B82F6), onTap: () => Navigator.pushNamed(context, '/customers')),
                    _QuickAction(icon: Iconsax.document_text, label: 'Invoices', color: const Color(0xFF10B981), onTap: () => Navigator.pushNamed(context, '/invoices')),
                    _QuickAction(icon: Iconsax.money_recive, label: 'Collections', color: AppTheme.gold, onTap: () => Navigator.pushNamed(context, '/collections')),
                    _QuickAction(icon: Iconsax.calendar_1, label: 'My Journey', color: const Color(0xFF0EA5E9), onTap: () => Navigator.pushNamed(context, '/journey')),
                    _QuickAction(icon: Iconsax.truck, label: 'Van Stock', color: const Color(0xFF8B5CF6), onTap: () => Navigator.pushNamed(context, '/van-stock')),
                    _QuickAction(icon: Iconsax.box, label: 'Inventory', color: const Color(0xFFEF4444), onTap: () => Navigator.pushNamed(context, '/inventory')),
                  ],
                );
              }),

              if (_stats?['lowStockProducts'] != null && _stats!['lowStockProducts'] > 0) ...[
                const SizedBox(height: 20),
                GestureDetector(
                  onTap: () => Navigator.pushNamed(context, '/stock-request'),
                  child: AppCard(
                    color: const Color(0xFFFFF7ED),
                    child: Row(children: [
                      Container(width: 40, height: 40, decoration: BoxDecoration(color: const Color(0xFFF59E0B), borderRadius: BorderRadius.circular(10)),
                        child: const Icon(Iconsax.warning_2, color: Colors.white, size: 20)),
                      const SizedBox(width: 12),
                      Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        const Text('Low Stock Alert', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
                        Text('${_stats!['lowStockProducts']} products need restocking — tap to request', style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
                      ])),
                      const Icon(Icons.arrow_forward_ios, size: 14, color: AppTheme.textGray),
                    ]),
                  ),
                ),
              ],
            ]),
          ),
      ),
    );
  }

  String _greeting() {
    final h = DateTime.now().hour;
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
  }
}

class _QuickAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _QuickAction({required this.icon, required this.label, required this.color, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
            Icon(icon, color: color, size: 24),
            const SizedBox(height: 8),
            Text(label, style: TextStyle(fontWeight: FontWeight.w600, color: color, fontSize: 14)),
          ]),
        ),
      ),
    );
  }
}
