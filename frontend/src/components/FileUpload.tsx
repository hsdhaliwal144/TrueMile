import { useState } from 'react';
import { Upload } from 'lucide-react';
import { API_URL } from '../config';

interface FileUploadProps {
  onUploadComplete?: () => void;
}

export default function FileUpload({ onUploadComplete }: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setError(null);

    const formData = new FormData();
    Array.from(files).forEach(file => {
      formData.append('files', file);
    });

    try {
      const response = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Uploaded ${files.length} file(s) successfully!`);
        onUploadComplete?.();
      } else {
        setError(data.error || 'Upload failed');
      }
    } catch (err) {
      setError('Failed to upload files');
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset input
    }
  };

  return (
    <div>
      <input
        type="file"
        id="file-upload"
        multiple
        accept=".pdf,.jpg,.jpeg,.png,.xlsx,.xls,.csv"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />
      <label htmlFor="file-upload">
        <button
          type="button"
          onClick={() => document.getElementById('file-upload')?.click()}
          disabled={uploading}
          style={{
            width: '100%',
            backgroundColor: uploading ? '#9ca3af' : '#2563eb',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '500',
            border: 'none',
            cursor: uploading ? 'not-allowed' : 'pointer',
            transition: 'background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
          }}
          onMouseEnter={(e) => {
            if (!uploading) e.currentTarget.style.backgroundColor = '#1d4ed8';
          }}
          onMouseLeave={(e) => {
            if (!uploading) e.currentTarget.style.backgroundColor = '#2563eb';
          }}
        >
          <Upload size={16} />
          {uploading ? 'Uploading...' : 'Choose Files'}
        </button>
      </label>
      {error && (
        <p style={{ color: '#dc2626', fontSize: '12px', marginTop: '8px' }}>
          {error}
        </p>
      )}
    </div>
  );
}
