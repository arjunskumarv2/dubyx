import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Save, Building, DollarSign, FileText, Percent } from 'lucide-react';
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
          <div className="col-span-2"><Field k="company_trn" label="Tax Registration Number (TRN)" /></div>
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
        </div>
      </div>

      {/* Currency & Tax */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-5">
          <Percent size={18} className="text-[#8D1B3D]" />
          <h3 className="font-semibold text-gray-900">Currency & Tax</h3>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field k="currency" label="Currency Code (e.g. QAR)" />
          <Field k="currency_symbol" label="Currency Symbol (e.g. ر.ق)" />
          <Field k="default_tax_rate" label="Default Tax Rate (%)" type="number" />
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
