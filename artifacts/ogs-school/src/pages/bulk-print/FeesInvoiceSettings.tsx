import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Settings, Plus, Trash2, Save, Eye, FileText } from 'lucide-react';

interface FeeItem {
  name: string;
  amount: number;
}

interface InvoiceSettings {
  schoolName: string;
  address: string;
  sessionName: string;
  feeItems: FeeItem[];
}

const DEFAULT_SETTINGS: InvoiceSettings = {
  schoolName: 'Greenfield Academy',
  address: '123 School Lane, Education City',
  sessionName: '2024/2025',
  feeItems: [
    { name: 'School Fees', amount: 500 },
    { name: 'Development Levy', amount: 100 },
    { name: 'Library Fee', amount: 50 },
  ],
};

const STORAGE_KEY = 'feesInvoiceSettings';

const FeesInvoiceSettings: React.FC = () => {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<InvoiceSettings>(DEFAULT_SETTINGS);
  const [showPreview, setShowPreview] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setSettings(JSON.parse(stored));
      } catch {}
    }
  }, []);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addFeeItem = () => {
    setSettings((prev) => ({
      ...prev,
      feeItems: [...prev.feeItems, { name: '', amount: 0 }],
    }));
  };

  const removeFeeItem = (idx: number) => {
    setSettings((prev) => ({
      ...prev,
      feeItems: prev.feeItems.filter((_, i) => i !== idx),
    }));
  };

  const updateFeeItem = (idx: number, field: keyof FeeItem, value: string | number) => {
    setSettings((prev) => ({
      ...prev,
      feeItems: prev.feeItems.map((item, i) =>
        i === idx ? { ...item, [field]: field === 'amount' ? Number(value) : value } : item
      ),
    }));
  };

  const total = settings.feeItems.reduce((sum, item) => sum + item.amount, 0);
  const fmt = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-100 p-2 rounded-lg">
              <Settings className="text-emerald-600" size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">Fees Invoice Settings</h1>
              <p className="text-gray-500 text-sm">Configure invoice template and fee structure</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 border border-emerald-600 text-emerald-600 px-4 py-2.5 rounded-lg hover:bg-emerald-50 transition-colors font-medium text-sm"
            >
              <Eye size={16} />
              {showPreview ? 'Hide Preview' : 'Preview'}
            </button>
            <button
              onClick={handleSave}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg hover:bg-emerald-700 transition-colors font-medium text-sm"
            >
              <Save size={16} />
              {saved ? 'Saved!' : 'Save Settings'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-5">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <FileText size={18} className="text-emerald-600" />
                School Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">School Name</label>
                  <input
                    type="text"
                    value={settings.schoolName}
                    onChange={(e) => setSettings((p) => ({ ...p, schoolName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="Enter school name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">School Address</label>
                  <textarea
                    value={settings.address}
                    onChange={(e) => setSettings((p) => ({ ...p, address: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none"
                    placeholder="Enter school address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Session / Academic Year</label>
                  <input
                    type="text"
                    value={settings.sessionName}
                    onChange={(e) => setSettings((p) => ({ ...p, sessionName: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    placeholder="e.g. 2024/2025"
                  />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-700 flex items-center gap-2">
                  <Settings size={18} className="text-emerald-600" />
                  Fee Line Items
                </h2>
                <button
                  onClick={addFeeItem}
                  className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-800 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Plus size={15} />
                  Add Item
                </button>
              </div>
              <div className="space-y-3">
                {settings.feeItems.map((item, idx) => (
                  <div key={idx} className="flex gap-3 items-center">
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateFeeItem(idx, 'name', e.target.value)}
                      placeholder="Fee description"
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                    />
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-gray-400 text-sm">$</span>
                      <input
                        type="number"
                        value={item.amount}
                        onChange={(e) => updateFeeItem(idx, 'amount', e.target.value)}
                        placeholder="0.00"
                        className="w-28 border border-gray-300 rounded-lg pl-7 pr-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                        min="0"
                        step="0.01"
                      />
                    </div>
                    <button
                      onClick={() => removeFeeItem(idx)}
                      className="text-red-400 hover:text-red-600 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {settings.feeItems.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No fee items. Click "Add Item" to add fees.</p>
                )}
              </div>
              {settings.feeItems.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between items-center">
                  <span className="text-sm font-semibold text-gray-600">Total</span>
                  <span className="text-base font-bold text-emerald-700">${fmt(total)}</span>
                </div>
              )}
            </div>
          </div>

          {showPreview && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Eye size={18} className="text-emerald-600" />
                Invoice Preview
              </h2>
              <div style={{ border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden', fontSize: '13px' }}>
                <div style={{ background: '#059669', color: 'white', padding: '16px 20px', display: 'flex', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ fontWeight: 'bold', fontSize: '16px', marginBottom: '2px' }}>{settings.schoolName || 'School Name'}</p>
                    <p style={{ fontSize: '11px', opacity: 0.85 }}>{settings.address || 'Address'}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 'bold', fontSize: '14px' }}>INVOICE</p>
                    <p style={{ fontSize: '11px', opacity: 0.85 }}>Session: {settings.sessionName}</p>
                  </div>
                </div>
                <div style={{ padding: '12px 20px', background: '#f0fdf4', borderBottom: '1px solid #e5e7eb' }}>
                  <p style={{ color: '#374151', marginBottom: '2px' }}><strong>Student:</strong> Sample Student Name</p>
                  <p style={{ color: '#374151', marginBottom: '2px' }}><strong>Student ID:</strong> STU-0001</p>
                  <p style={{ color: '#374151', marginBottom: '2px' }}><strong>Class:</strong> Grade 5A</p>
                  <p style={{ color: '#374151' }}><strong>Term:</strong> First Term</p>
                </div>
                <div style={{ padding: '12px 20px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '11px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Description</th>
                        <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '11px', fontWeight: '600', color: '#374151', borderBottom: '1px solid #e5e7eb' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {settings.feeItems.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 10px' }}>{item.name || '(empty)'}</td>
                          <td style={{ padding: '6px 10px', textAlign: 'right' }}>${fmt(item.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr style={{ background: '#f0fdf4' }}>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', color: '#059669' }}>Total Due</td>
                        <td style={{ padding: '8px 10px', fontWeight: 'bold', textAlign: 'right', color: '#059669' }}>${fmt(total)}</td>
                      </tr>
                    </tfoot>
                  </table>
                  <p style={{ fontSize: '10px', color: '#9ca3af', textAlign: 'center', borderTop: '1px dashed #e5e7eb', paddingTop: '10px' }}>
                    Please make payment to the school bursary. This invoice is valid for 30 days.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!showPreview && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h2 className="font-semibold text-gray-700 mb-4">Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">School Name</span>
                  <span className="text-sm font-medium text-gray-800">{settings.schoolName || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Session</span>
                  <span className="text-sm font-medium text-gray-800">{settings.sessionName || '-'}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-50">
                  <span className="text-sm text-gray-600">Fee Items</span>
                  <span className="text-sm font-medium text-gray-800">{settings.feeItems.length} items</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm font-semibold text-gray-700">Total Fee Amount</span>
                  <span className="text-base font-bold text-emerald-700">${fmt(total)}</span>
                </div>
              </div>
              <div className="mt-4 p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs text-emerald-700">
                  Settings are saved to browser storage and will be applied when printing invoices from the Fees Invoice Print page.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeesInvoiceSettings;
