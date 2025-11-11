// ============================================================================
// EXPENSES - CSV UPLOAD ONLY
// ============================================================================
// Simplified page for uploading expense CSVs
// ============================================================================

import { useState } from 'react';
import { Upload, CheckCircle, Trash2 } from 'lucide-react';
import { API_URL } from '../config';

export default function ExpensesPage() {
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('csv', file);

      const response = await fetch(`${API_URL}/api/expenses/import`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        setUploadResult(data);
        alert(`✅ Imported ${data.imported} expenses!\nSkipped ${data.skipped} payments ($${data.paymentTotal.toLocaleString()})`);
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      alert(`❌ Upload error: ${error.message}`);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ Delete ALL uploaded expenses? This cannot be undone!')) return;

    setDeleting(true);
    try {
      const response = await fetch(`${API_URL}/api/expenses/bulk/all`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        alert(`✅ Deleted ${data.deleted} expenses`);
        setUploadResult(null);
      } else {
        alert(`❌ Failed: ${data.error}`);
      }
    } catch (error: any) {
      console.error('Delete error:', error);
      alert(`❌ Delete error: ${error.message}`);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ padding: '48px 64px' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: '#111827', marginBottom: '8px' }}>
            Upload Expenses
          </h1>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>
            Import credit card statements to track expenses and calculate profit
          </p>
        </div>
        
        {/* Delete All Button */}
        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: deleting ? '#9ca3af' : '#fee2e2',
            color: '#dc2626',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: deleting ? 'not-allowed' : 'pointer'
          }}
        >
          <Trash2 size={16} />
          {deleting ? 'Deleting...' : 'Delete All Expenses'}
        </button>
      </div>

      {/* Upload Section */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '16px',
        border: '2px dashed #e5e7eb',
        padding: '48px',
        textAlign: 'center',
        maxWidth: '600px',
        margin: '0 auto'
      }}>
        <Upload size={48} color="#9ca3af" style={{ margin: '0 auto 16px' }} />
        <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginBottom: '8px' }}>
          Upload Credit Card Statement
        </h3>
        <p style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
          CSV file with Date, Description, Card Member, Amount columns
        </p>

        <input
          type="file"
          id="csv-upload"
          accept=".csv"
          onChange={handleCSVUpload}
          style={{ display: 'none' }}
        />

        <label htmlFor="csv-upload">
          <button
            type="button"
            onClick={() => document.getElementById('csv-upload')?.click()}
            disabled={uploading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: uploading ? '#9ca3af' : '#2563eb',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: uploading ? 'not-allowed' : 'pointer'
            }}
          >
            <Upload size={16} />
            {uploading ? 'Processing...' : 'Upload CSV'}
          </button>
        </label>

        {uploading && (
          <p style={{ marginTop: '16px', fontSize: '13px', color: '#6b7280' }}>
            Processing expenses... this may take a few seconds
          </p>
        )}
      </div>

      {/* Success Message */}
      {uploadResult && (
        <div style={{
          marginTop: '32px',
          padding: '24px',
          backgroundColor: '#f0fdf4',
          borderRadius: '12px',
          border: '1px solid #86efac',
          maxWidth: '600px',
          margin: '32px auto 0'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <CheckCircle size={24} color="#16a34a" />
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#16a34a' }}>
              Import Complete!
            </h3>
          </div>
          
          <div style={{ fontSize: '14px', color: '#166534', lineHeight: '1.6' }}>
            <p><strong>Imported:</strong> {uploadResult.imported} expenses</p>
            <p><strong>Skipped:</strong> {uploadResult.skipped} payments (${uploadResult.paymentTotal?.toLocaleString()})</p>
            
            {uploadResult.categoryBreakdown && (
              <div style={{ marginTop: '16px' }}>
                <p style={{ fontWeight: '600', marginBottom: '8px' }}>Categories:</p>
                <ul style={{ listStyle: 'none', padding: 0 }}>
                  {Object.entries(uploadResult.categoryBreakdown).map(([category, amount]: [string, any]) => (
                    <li key={category}>
                      {category}: ${parseFloat(amount).toLocaleString()}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          
          <p style={{ marginTop: '16px', fontSize: '13px', color: '#166534' }}>
            💡 View the expense summary in the <strong>Dispatch Engine</strong> tab
          </p>
        </div>
      )}
    </div>
  );
}