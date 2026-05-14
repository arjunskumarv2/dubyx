import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Welcome to Dubyx!');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left: Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#8D1B3D] flex-col items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#C9A84C] rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-72 h-72 bg-white rounded-full translate-y-1/2 -translate-x-1/2" />
        </div>
        <div className="relative z-10 text-center">
          <div className="w-24 h-24 bg-[#C9A84C] rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <span className="text-white font-black text-5xl">D</span>
          </div>
          <h1 className="text-white font-black text-5xl mb-3">Dubyx</h1>
          <p className="text-white/70 text-xl font-light mb-8">B2B Sales Intelligence Platform</p>
          <div className="flex flex-col gap-3 text-left">
            {['GPS Sales Tracking', 'Smart Order Management', 'Real-time Invoicing', 'Collection Dashboard'].map(f => (
              <div key={f} className="flex items-center gap-3 bg-white/10 rounded-xl px-5 py-3">
                <div className="w-2 h-2 bg-[#C9A84C] rounded-full" />
                <span className="text-white font-medium">{f}</span>
              </div>
            ))}
          </div>
          <p className="text-white/40 text-sm mt-10">Designed for Qatar's Retail Landscape</p>
        </div>
      </div>

      {/* Right: Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="text-center mb-8 lg:hidden">
            <div className="w-16 h-16 bg-[#8D1B3D] rounded-xl flex items-center justify-center mx-auto mb-3">
              <span className="text-white font-black text-3xl">D</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Dubyx</h1>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h2>
            <p className="text-gray-500 text-sm mb-8">Sign in to your admin portal</p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="input pl-10"
                    placeholder="your@email.com"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPwd ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    required
                  />
                  <button type="button" onClick={() => setShowPwd(!showPwd)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#8D1B3D] hover:bg-[#7a1836] text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Sign In'}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-gray-400 mt-6">
            Dubyx Trading LLC &mdash; Doha, Qatar &copy; {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
}
