import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../theme/app_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _emailCtrl = TextEditingController();
  final _pwdCtrl = TextEditingController();
  bool _showPwd = false;

  @override
  void dispose() {
    _emailCtrl.dispose();
    _pwdCtrl.dispose();
    super.dispose();
  }

  Future<void> _login() async {
    final auth = context.read<AuthProvider>();
    final ok = await auth.login(_emailCtrl.text.trim(), _pwdCtrl.text);
    if (!mounted) return;
    if (!ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(auth.error ?? 'Login failed'), backgroundColor: AppTheme.error),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Column(
              children: [
                const SizedBox(height: 40),

                // Logo
                Container(
                  width: 90, height: 90,
                  decoration: BoxDecoration(
                    color: AppTheme.primary,
                    borderRadius: BorderRadius.circular(24),
                    boxShadow: [BoxShadow(color: AppTheme.primary.withOpacity(0.3), blurRadius: 24, offset: const Offset(0, 8))],
                  ),
                  child: const Center(
                    child: Text('D', style: TextStyle(color: Colors.white, fontSize: 48, fontWeight: FontWeight.w900)),
                  ),
                ),
                const SizedBox(height: 20),
                const Text('Dubyx', style: TextStyle(fontSize: 32, fontWeight: FontWeight.w800, color: AppTheme.textDark)),
                const Text('Sales Intelligence Platform', style: TextStyle(fontSize: 14, color: AppTheme.textGray)),
                const SizedBox(height: 48),

                // Form Card
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(24),
                    border: Border.all(color: const Color(0xFFF0F0F0)),
                    boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 20, offset: const Offset(0, 4))],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Welcome back', style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
                      const SizedBox(height: 4),
                      const Text('Sign in to your account', style: TextStyle(fontSize: 14, color: AppTheme.textGray)),
                      const SizedBox(height: 24),

                      const Text('Email', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _emailCtrl,
                        keyboardType: TextInputType.emailAddress,
                        decoration: const InputDecoration(
                          hintText: 'your@email.com',
                          prefixIcon: Icon(Icons.email_outlined, size: 18, color: AppTheme.textGray),
                        ),
                      ),
                      const SizedBox(height: 16),

                      const Text('Password', style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppTheme.textDark)),
                      const SizedBox(height: 8),
                      TextField(
                        controller: _pwdCtrl,
                        obscureText: !_showPwd,
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          prefixIcon: const Icon(Icons.lock_outline, size: 18, color: AppTheme.textGray),
                          suffixIcon: IconButton(
                            icon: Icon(_showPwd ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 18, color: AppTheme.textGray),
                            onPressed: () => setState(() => _showPwd = !_showPwd),
                          ),
                        ),
                        onSubmitted: (_) => _login(),
                      ),
                      const SizedBox(height: 24),

                      Consumer<AuthProvider>(
                        builder: (ctx, auth, _) => SizedBox(
                          width: double.infinity,
                          child: ElevatedButton(
                            onPressed: auth.isLoading ? null : _login,
                            child: auth.isLoading
                              ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                              : const Text('Sign In'),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 32),
                // Feature list
                ...['GPS Sales Tracking', 'Smart Order Booking', 'Invoice & Billing', 'Collection Management'].map((f) =>
                  Padding(
                    padding: const EdgeInsets.symmetric(vertical: 4),
                    child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Container(width: 6, height: 6, decoration: const BoxDecoration(color: AppTheme.gold, shape: BoxShape.circle)),
                      const SizedBox(width: 8),
                      Text(f, style: const TextStyle(fontSize: 13, color: AppTheme.textGray)),
                    ]),
                  ),
                ),
                const SizedBox(height: 24),
                const Text('Dubyx Trading LLC — Doha, Qatar', style: TextStyle(fontSize: 11, color: Color(0xFFBDBDBD))),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
