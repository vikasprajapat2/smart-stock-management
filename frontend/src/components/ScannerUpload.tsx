import React, { useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { UploadCloud, Image, Loader } from 'lucide-react';
import { playSuccessBeep, triggerHapticFeedback } from '../utils/parser';

interface ScannerUploadProps {
  onScanSuccess: (decodedText: string) => void;
  soundEnabled: boolean;
}

export const ScannerUpload: React.FC<ScannerUploadProps> = ({
  onScanSuccess,
  soundEnabled,
}) => {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file) return;
    setLoading(true);
    setErrorMessage('');

    try {
      // Create a hidden reader instance
      const html5Qrcode = new Html5Qrcode('upload-reader-hidden');
      
      const decodedText = await html5Qrcode.scanFile(file, true);
      
      if (soundEnabled) {
        playSuccessBeep();
      }
      triggerHapticFeedback();
      onScanSuccess(decodedText);
    } catch (err: any) {
      console.error('File scanning error', err);
      setErrorMessage(
        'Could not detect any valid QR code or barcode in this image. Please make sure the code is clearly visible, centered, and well-lit.'
      );
    } finally {
      setLoading(false);
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => {
    setIsDragging(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Hidden dummy node required by html5-qrcode file-scan API */}
      <div id="upload-reader-hidden" style={{ display: 'none' }}></div>

      <div
        className="upload-container"
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          borderColor: isDragging ? 'var(--accent-neon)' : 'rgba(0, 0, 0, 0.15)',
          background: isDragging ? 'rgba(16, 185, 129, 0.05)' : 'rgba(15, 18, 36, 0.3)',
        }}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          accept="image/*"
          style={{ display: 'none' }}
        />

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <Loader size={48} className="spin" style={{ color: 'var(--accent-neon)' }} />
            <p style={{ fontWeight: 600, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Decoding Image...</p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Parsing image pixels for barcodes or QR matrix...
            </p>
          </div>
        ) : (
          <>
            <div className="upload-icon-wrapper">
              <UploadCloud size={32} />
            </div>
            <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
              Drag & Drop Image
            </p>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1.5rem', maxWidth: '320px' }}>
              Upload a photo or screenshot from your gallery to instantly decode QR / barcode contents.
            </p>
            <button className="scan-action-btn btn-secondary" onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}>
              <Image size={18} />
              Browse Gallery
            </button>
          </>
        )}
      </div>

      {/* Error Output */}
      {errorMessage && (
        <div style={{
          padding: '1rem',
          borderRadius: '12px',
          background: 'rgba(244, 63, 94, 0.1)',
          border: '1px solid rgba(244, 63, 94, 0.2)',
          color: '#fda4af',
          fontSize: '0.9rem',
          textAlign: 'center'
        }}>
          {errorMessage}
        </div>
      )}
      
      {/* Dynamic inline styles for spin animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .spin {
          animation: spin 1.5s linear infinite;
        }
      `}</style>
    </div>
  );
};
