import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class AppCard extends StatelessWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;
  final Color? color;

  const AppCard({super.key, required this.child, this.padding, this.onTap, this.color});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: color ?? Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(16),
        child: Container(
          padding: padding ?? const EdgeInsets.all(16),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFF0F0F0)),
          ),
          child: child,
        ),
      ),
    );
  }
}

class StatCard extends StatelessWidget {
  final String title;
  final String value;
  final String? subtitle;
  final IconData icon;
  final Color color;

  const StatCard({super.key, required this.title, required this.value, this.subtitle, required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Row(children: [
        Container(
          width: 44, height: 44,
          decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(12)),
          child: Icon(icon, color: Colors.white, size: 20),
        ),
        const SizedBox(width: 12),
        Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(title, style: const TextStyle(fontSize: 12, color: AppTheme.textGray)),
          const SizedBox(height: 2),
          Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: AppTheme.textDark)),
          if (subtitle != null) Text(subtitle!, style: const TextStyle(fontSize: 11, color: AppTheme.textGray)),
        ])),
      ]),
    );
  }
}
