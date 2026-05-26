import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Sparkles, Volume2, VolumeX, Check } from 'lucide-react';
import { playSuccessBeep, triggerHapticFeedback } from '../utils/parser';

interface ScannerActiveProps {
  onScanSuccess: (decodedText: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
}

export const ScannerActive: React.FC<ScannerActiveProps> = ({
  onScanSuccess,
  soundEnabled,
  setSoundEnabled,
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [scanMode, setScanMode] = useState<'single' | 'continuous'>('single');
  const [scanCompleted, setScanCompleted] = useState<boolean>(false);
  const lastScannedTextRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const elementId = 'scanner-viewfinder-reader';

  // Initialize and list cameras
  useEffect(() => {
    // Request temporary access to get accurate labels
    Html5Qrcode.getCameras()
      .then((devices) => {
        setCameras(devices);
        if (devices.length > 0) {
          // Select back camera or first camera by default
          const backCam = devices.find(d => 
            d.label.toLowerCase().includes('back') || 
            d.label.toLowerCase().includes('rear') || 
            d.label.toLowerCase().includes('environment')
          );
          setSelectedCameraId(backCam ? backCam.id : devices[0].id);
        }
      })
      .catch((err) => {
        console.error('Failed to get cameras', err);
        setErrorMessage('Camera access denied or not found. Please enable camera permissions.');
      });

    return () => {
      // Cleanup on unmount
      stopScanning();
    };
  }, []);

  // Handle start scanning
  const startScanning = async (cameraId: string) => {
    if (!cameraId) return;
    
    // Stop current scan if running
    if (scannerRef.current && isScanning) {
      await stopScanning();
    }

    setErrorMessage('');
    
    try {
      const html5Qrcode = new Html5Qrcode(elementId);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        cameraId,
        {
          fps: 15,
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.65;
            return { width: size, height: size };
          },
          aspectRatio: 1.333333,
        },
        (decodedText) => {
          // Success callback
          const now = Date.now();
          if (scanMode === 'continuous') {
            // Prevent duplicate scans of the same code within 3 seconds
            if (decodedText === lastScannedTextRef.current && now - lastScannedTimeRef.current < 3000) {
              return;
            }
            lastScannedTextRef.current = decodedText;
            lastScannedTimeRef.current = now;
          }

          if (soundEnabled) {
            playSuccessBeep();
          }
          triggerHapticFeedback();

          if (scanMode === 'single') {
            // Stop scanning and mark completed to prevent rapid multiple additions
            setScanCompleted(true);
            stopScanning();
          }
          
          onScanSuccess(decodedText);
        },
        (_errorMessage) => {
          // Verbal warnings ignored to avoid console spamming
        }
      );

      setIsScanning(true);
      
      // Check if torch/flashlight is supported
      try {
        const state = html5Qrcode.getRunningTrackCameraCapabilities();
        if (state && (state as any).torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch (e) {
        setHasTorch(false);
      }

    } catch (err: any) {
      console.error('Failed to start scanner', err);
      setErrorMessage(`Failed to start camera: ${err.message || err}`);
      setIsScanning(false);
    }
  };

  // Handle stop scanning
  const stopScanning = async () => {
    if (scannerRef.current && isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error('Error stopping scanner', err);
      }
    }
    setIsScanning(false);
    setTorchActive(false);
    setHasTorch(false);
  };

  // Toggle torch / flash
  const toggleTorch = async () => {
    if (!scannerRef.current || !isScanning || !hasTorch) return;
    const newTorchState = !torchActive;
    try {
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: newTorchState } as any]
      });
      setTorchActive(newTorchState);
    } catch (e) {
      console.error('Flash toggle failed', e);
    }
  };

  // Trigger scanning when camera selection changes
  useEffect(() => {
    if (selectedCameraId && isScanning) {
      startScanning(selectedCameraId);
    }
  }, [selectedCameraId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Scanner Wrapper */}
      <div className={`scanner-viewport-wrapper ${isScanning ? 'active' : ''}`}>
        <div id={elementId} style={{ display: isScanning ? 'block' : 'none', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}></div>
        
        {/* Animated Scan Box Overlay when running */}
        {isScanning && (
          <div className="scan-overlay-container">
            <div className="scan-target-box">
              <div className="scan-laser-line"></div>
              <div className="scan-corner-bl"></div>
              <div className="scan-corner-br"></div>
            </div>
          </div>
        )}

        {/* Placeholder if camera not running */}
        {!isScanning && (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
            {scanCompleted ? (
              <>
                <div style={{
                  width: '60px',
                  height: '60px',
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.12)',
                  color: '#22c55e',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 1.5rem',
                  border: '1px solid rgba(34, 197, 94, 0.3)'
                }}>
                  <Check size={32} />
                </div>
                <p style={{ fontWeight: 700, fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--accent-neon)' }}>
                  Scan Successful!
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
                  The item barcode has been sent to the database. Ready for the next scan.
                </p>
                <button 
                  className="scan-action-btn btn-primary"
                  onClick={() => {
                    setScanCompleted(false);
                    startScanning(selectedCameraId);
                  }}
                  style={{ margin: '0 auto' }}
                >
                  <Camera size={18} />
                  Scan Next Product
                </button>
              </>
            ) : (
              <>
                <CameraOff size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.5 }} />
                <p style={{ fontWeight: 600, fontSize: '1.1rem', marginBottom: '0.5rem', color: '#fff' }}>
                  Camera Scanner is Off
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto 1.5rem' }}>
                  Launch your camera to scan any QR code, Google Pay payment code, or product barcode.
                </p>
                <button 
                  className="scan-action-btn btn-primary"
                  onClick={() => startScanning(selectedCameraId)}
                  style={{ margin: '0 auto' }}
                >
                  <Camera size={18} />
                  Start Camera Scanner
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Error Message */}
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

      {/* Controls panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        
        {/* Toggle Mode */}
        <div className="glass-panel" style={{
          padding: '0.5rem 0.75rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          background: 'rgba(255, 255, 255, 0.01)',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '8px'
        }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Scanner Mode:</span>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.2)', borderRadius: '6px', border: '1px solid var(--border-glass)', padding: '2px', width: '220px' }}>
            <button
              type="button"
              onClick={() => {
                setScanMode('single');
                setScanCompleted(false);
              }}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '4px',
                padding: '0.35rem 0.5rem',
                background: scanMode === 'single' ? 'rgba(6, 182, 212, 0.15)' : 'transparent',
                color: scanMode === 'single' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              🎯 Single Scan
            </button>
            <button
              type="button"
              onClick={() => {
                setScanMode('continuous');
                setScanCompleted(false);
              }}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: '4px',
                padding: '0.35rem 0.5rem',
                background: scanMode === 'continuous' ? 'rgba(139, 92, 246, 0.15)' : 'transparent',
                color: scanMode === 'continuous' ? '#c084fc' : 'var(--text-muted)',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'var(--transition-smooth)'
              }}
            >
              🔄 Continuous
            </button>
          </div>
        </div>

        {isScanning && (
          <div className="scanner-controls" style={{ marginTop: '0.25rem' }}>
            {/* Camera Selection */}
            {cameras.length > 1 && (
              <select 
                className="camera-select"
                value={selectedCameraId}
                onChange={(e) => setSelectedCameraId(e.target.value)}
              >
                {cameras.map((device) => (
                  <option key={device.id} value={device.id}>
                    {device.label || `Camera ${cameras.indexOf(device) + 1}`}
                  </option>
                ))}
              </select>
            )}

            {/* Flashlight toggle */}
            {hasTorch && (
              <button 
                className={`btn-icon-only ${torchActive ? 'active' : ''}`}
                onClick={toggleTorch}
                title={torchActive ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
              >
                <Sparkles size={20} />
              </button>
            )}

            {/* Audio Beep Switch */}
            <div className="sound-toggle-wrapper" style={{ marginLeft: 'auto' }}>
              <button 
                className={`btn-icon-only ${soundEnabled ? 'active' : ''}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Mute Scan Sounds' : 'Unmute Scan Sounds'}
              >
                {soundEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              </button>
              <span style={{ fontSize: '0.85rem' }}>{soundEnabled ? 'Sound On' : 'Mute'}</span>
            </div>

            {/* Stop Button */}
            <button 
              className="scan-action-btn btn-danger"
              onClick={stopScanning}
            >
              <CameraOff size={18} />
              Stop
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
