import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Camera, CameraOff, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { playSuccessBeep, triggerHapticFeedback } from '../utils/parser';

interface ScannerActiveProps {
  onScanSuccess: (decodedText: string) => void;
  soundEnabled: boolean;
  setSoundEnabled: (enabled: boolean) => void;
  topControls?: React.ReactNode;
}

export const ScannerActive: React.FC<ScannerActiveProps> = ({
  onScanSuccess,
  soundEnabled,
  setSoundEnabled,
  topControls
}) => {
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [torchActive, setTorchActive] = useState<boolean>(false);
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const lastScannedTextRef = useRef<string>('');
  const lastScannedTimeRef = useRef<number>(0);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef<boolean>(false);  // hard lock - blocks ALL callbacks once set
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

    // Reset ALL locks for fresh session
    isProcessingRef.current = false;
    lastScannedTextRef.current = '';
    lastScannedTimeRef.current = 0;
    setErrorMessage('');
    
    try {
      const html5Qrcode = new Html5Qrcode(elementId);
      scannerRef.current = html5Qrcode;

      await html5Qrcode.start(
        cameraId,
        {
          fps: 5, // Reduced from 15 → 5 to limit callback rate
          qrbox: (width, height) => {
            const size = Math.min(width, height) * 0.65;
            return { width: size, height: size };
          },
          aspectRatio: 1.777778
        },
        (decodedText) => {
          // ════════════════════════════════════════════
          // HARD SCAN GUARD — blocks duplicate callbacks
          // ════════════════════════════════════════════
          
          // FIRST LINE OF DEFENSE: hard boolean lock for any async work (though we don't do async here anymore)
          if (isProcessingRef.current) return;

          const now = Date.now();

          // Continuous mode: 3-second dedup window per barcode
          if (
            decodedText === lastScannedTextRef.current &&
            now - lastScannedTimeRef.current < 3000
          ) {
            return;
          }
          
          lastScannedTextRef.current = decodedText;
          lastScannedTimeRef.current = now;

          if (soundEnabled) playSuccessBeep();
          triggerHapticFeedback();
          
          onScanSuccess(decodedText);
          
          // ════════════════════════════════════════════
        },
        (_errorMessage) => {
          // Scan frame errors ignored (not a problem)
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
      
      {/* Unified Top Controls Panel */}
      <div className="glass-panel" style={{
        padding: '1.25rem',
        border: '1px solid rgba(139, 92, 246, 0.2)',
        background: 'rgba(139, 92, 246, 0.03)',
        borderRadius: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        {/* Render the injected topControls (e.g. Warehouse Adjuster) */}
        {topControls}
      </div>

      {/* Scanner Wrapper */}
      <div className={`scanner-viewport-wrapper ${isScanning ? 'active' : ''}`}>
        {/* html5-qrcode container - MUST always be in DOM and visible for camera to work */}
        <div
          id={elementId}
          style={{
            width: '100%',
            height: '100%',
            borderRadius: '12px',
            overflow: 'hidden',
            display: isScanning ? 'block' : 'none',
            minHeight: '240px',
            background: '#000',
          }}
        />

        {/* Animated Scan Box Overlay when running - pointer-events none so it doesn't block video */}
        {isScanning && (
          <>
            {/* Controls Overlay inside Camera Viewport */}
            <div style={{ 
              position: 'absolute', 
              top: '1rem', 
              right: '1rem', 
              zIndex: 20, 
              display: 'flex', 
              gap: '0.5rem',
              background: 'rgba(0,0,0,0.5)',
              padding: '0.5rem',
              borderRadius: '8px',
              backdropFilter: 'blur(4px)'
            }}>
              {cameras.length > 1 && (
                <select 
                  className="camera-select"
                  value={selectedCameraId}
                  onChange={(e) => setSelectedCameraId(e.target.value)}
                  style={{ maxWidth: '100px', background: 'transparent', border: 'none', color: '#fff' }}
                >
                  {cameras.map((device) => (
                    <option key={device.id} value={device.id} style={{ color: '#000' }}>
                      {device.label || `Cam ${cameras.indexOf(device) + 1}`}
                    </option>
                  ))}
                </select>
              )}

              {hasTorch && (
                <button 
                  className={`btn-icon-only ${torchActive ? 'active' : ''}`}
                  onClick={toggleTorch}
                  title={torchActive ? 'Turn Flashlight Off' : 'Turn Flashlight On'}
                  style={{ background: 'transparent', border: 'none' }}
                >
                  <Sparkles size={18} />
                </button>
              )}

              <button 
                className={`btn-icon-only ${soundEnabled ? 'active' : ''}`}
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Mute Scan Sounds' : 'Unmute Scan Sounds'}
                style={{ background: 'transparent', border: 'none' }}
              >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
              </button>

              <button 
                className="scan-action-btn btn-danger"
                onClick={stopScanning}
                style={{ padding: '0.3rem 0.75rem', fontSize: '0.75rem', height: '32px' }}
              >
                <CameraOff size={14} />
                Stop
              </button>
            </div>

            <div className="scan-overlay-container" style={{ pointerEvents: 'none' }}>
              <div className="scan-target-box">
                <div className="scan-laser-line"></div>
                <div className="scan-corner-bl"></div>
                <div className="scan-corner-br"></div>
              </div>
            </div>
          </>
        )}

        {/* Placeholder if camera not running */}
        {!isScanning && (
          <div className="camera-overlay" style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.8)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 10,
            textAlign: 'center',
            padding: '2rem'
          }}>
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

      {/* Controls panel removed from bottom, moved to top */}
    </div>
  );
};
