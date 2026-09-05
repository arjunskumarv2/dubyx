import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Building, Building2, DollarSign, FileText, Percent } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../services/api';

export default function Settings() {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get('/settings').then(r => r.data),
  });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const updateSettings = useMutation({
    mutationFn: (data: Record<string, string>) => api.put('/settings', data),
    onSuccess: () => toast.success('Settings saved!'),
    onError: () => toast.error('Failed to save'),
  });

  const Field = ({ k, label, type = 'text' }: { k: string; label: string; type?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={form[k] || ''} onChange={e => setForm({ ...form, [k]: e.target.value })} className="input" />
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      {/* Company Info */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building size={18} className="text-[#8D1B3D]" />
          <h3 className="font-semibold text-gray-900">Company Information</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2"><Field k="company_name" label="Company Name" /></div>
          <div className="col-span-2"><Field k="company_address" label="Address" /></div>
          <Field k="company_phone" label="Phone" />
          <Field k="company_email" label="Email" />
          <div className="col-span-2"><Field k="company_name_ar" label="Company Name (Arabic) — required on tax invoices" /></div>
        </div>
      </div>

      {/* ZATCA e-invoicing identifiers */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText size={18} className="text-[#8D1B3D]" />
          <h3 className="font-semibold text-gray-900">ZATCA / VAT Registration</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          These appear on every tax invoice and inside the QR code. The VAT number must be 15 digits starting and ending with 3.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field k="company_vat_number" label="VAT Registration Number (15 digits)" />
          <Field k="company_cr_number" label="Commercial Registration (10 digits)" />
        </div>
      </div>

      {/* Saudi National Address */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Building2 size={18} className="text-[#8D1B3D]" />
          <h3 className="font-semibold text-gray-900">Saudi National Address</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field k="company_building_number" label="Building Number" />
          <Field k="company_street" label="Street" />
          <Field k="company_district" label="District" />
          <Field k="company_city" label="City" />
          <Field k="company_postal_code" label="Postal Code" />
          <Field k="company_additional_number" label="Additional Number" />
        </div>
      </div>

      {/* Invoice Settings */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <FileText size={18} className="text-[#8D1B3D]" />
          <h3 className="font-semibold text-gray-900">Invoice Settings</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field k="invoice_prefix" label="Invoice Prefix (e.g. INV)" />
          <Field k="order_prefix" label="Order Prefix (e.g. ORD)" />
          <Field k="credit_note_prefix" label="Credit Note Prefix (e.g. CN)" />
          <Field k="debit_note_prefix" label="Debit Note Prefix (e.g. DN)" />
        </div>
      </div>

      {/* Currency & Tax */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Percent size={18} className="text-[#8D1B3D]" />
          <h3 className="font-semibold text-gray-900">Currency & Tax</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field k="currency" label="Currency Code (e.g. SAR)" />
          <Field k="currency_symbol" label="Currency Symbol (e.g. ر.س)" />
          <Field k="default_tax_rate" label="VAT Rate (%) — KSA standard rate is 15" type="number" />
        </div>
      </div>

      <button
        onClick={() => updateSettings.mutate(form)}
        disabled={updateSettings.isPending}
        className="btn-primary flex items-center gap-2"
      >
        <Save size={16} /> {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
