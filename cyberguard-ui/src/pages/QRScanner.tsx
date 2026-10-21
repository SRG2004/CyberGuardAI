import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  UploadCloud,
  AlertCircle,
  Brain,
  Target,
  Shield,
  Copy,
  Check,
  ExternalLink,
  Route,
  Search,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useScanQR } from '@/hooks/api/useScans';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';
import { getRiskColor } from '@/lib/theme';

export default function QRScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [clientDetectedUrl, setClientDetectedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  
  const scanQR = useScanQR();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setClientDetectedUrl(null);
      scanQR.reset();

      // Client-side QR detection via browser BarcodeDetector API if available
      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
          const img = new Image();
          img.src = URL.createObjectURL(selectedFile);
          img.onload = async () => {
            try {
              const barcodes = await detector.detect(img);
              if (barcodes.length > 0 && barcodes[0].rawValue) {
                setClientDetectedUrl(barcodes[0].rawValue);
              }
            } catch {
              // Ignore client detection error, will be processed by server
            }
          };
        } catch {
          // Ignore
        }
      }
    }
  };

  const handleScan = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    if (clientDetectedUrl) {
      formData.append('detectedUrl', clientDetectedUrl);
    }

    try {
      await scanQR.mutateAsync(formData);
      toast.success('QR Code analyzed successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'QR Scan failed');
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const data = scanQR.data?.data;
  const isFailed = Boolean(
    data?.error ||
    (!data?.url && (data?.failed || data?.verdict === 'unknown'))
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          <QrCode className="w-6 h-6 text-primary" /> QR Code Scanner
        </h2>
        <p className="text-sm text-muted-foreground mb-8">
          Upload a suspicious QR code (Quishing) to extract and analyze its hidden URL before scanning with your mobile device.
        </p>

        <div className="flex flex-col items-center gap-6">
          <div 
            className="w-full max-w-sm border-2 border-dashed border-border rounded-2xl p-8 hover:bg-muted/50 transition-colors cursor-pointer relative overflow-hidden group"
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*" 
              onChange={handleFileSelect}
            />
            {previewUrl ? (
              <div className="space-y-3">
                <img src={previewUrl} alt="QR Preview" className="w-full h-auto max-h-56 object-contain rounded-lg shadow-lg mx-auto" />
                <p className="text-xs text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-center gap-1.5">
                  <RefreshCw className="w-3.5 h-3.5" /> Click to choose a different image
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-70 group-hover:opacity-100 transition-opacity">
                <UploadCloud className="w-12 h-12 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="text-sm text-muted-foreground font-medium">Click to upload QR code image</p>
                <p className="text-xs text-muted-foreground/60">Supports PNG, JPG, WEBP</p>
              </div>
            )}
          </div>

          <GlowButton size="lg" onClick={handleScan} disabled={!file || scanQR.isPending} className="w-full max-w-sm">
            {scanQR.isPending ? 'Decoding & Analyzing...' : 'Scan QR Code'}
          </GlowButton>
        </div>
      </motion.div>

      {/* Results Section */}
      <AnimatePresence>
        {data && (
          <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
            {isFailed ? (
              <div className="glass-card p-8 bg-destructive/10 border-destructive/30 text-center space-y-3">
                <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
                <h3 className="text-destructive font-bold text-lg">QR Detection Failed</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  {data.error || 'No readable QR code was found in this image. Please ensure the QR code is centered, well-lit, and not cropped or blurry.'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-3 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-semibold transition-colors"
                >
                  Upload Another Image
                </button>
              </div>
            ) : (
              <>
                {/* Extracted Payload */}
                <div className="glass-card p-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="font-display font-bold text-sm text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <QrCode className="w-4 h-4 text-primary" /> Extracted Payload
                    </h3>
                    {data.url && (
                      <button
                        type="button"
                        onClick={() => handleCopy(data.url)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
                        <span>{copied ? 'Copied' : 'Copy URL'}</span>
                      </button>
                    )}
                  </div>

                  <div className="bg-background/80 p-4 rounded-xl font-mono text-primary text-base break-all border border-border/80 shadow-inner select-all">
                    {data.url || 'No URL decoded'}
                  </div>

                  {data.url && (
                    <div className="flex items-center gap-2 pt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => navigate('/unshortener', { state: { url: data.url } })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-medium border border-primary/20 transition-colors"
                      >
                        <Route className="w-3.5 h-3.5" />
                        <span>Trace Route & Unshorten</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => navigate('/link-scanner', { state: { url: data.url } })}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-secondary-foreground text-xs font-medium border border-border transition-colors"
                      >
                        <Search className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>Deep Scan in Link Scanner</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Score Card */}
                  <div className="glass-card p-8 text-center flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Threat Analysis</p>
                    <div className={`stat-number text-6xl ${getRiskColor(data.riskScore)}`}>
                      {data.riskScore}%
                    </div>
                    <p className={`text-base font-bold mt-2 ${getRiskColor(data.riskScore)} uppercase tracking-wide`}>
                      {data.verdict}
                    </p>
                    {data.confidence ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        Model Confidence: <span className="font-semibold text-foreground">{Math.round(data.confidence)}%</span>
                      </p>
                    ) : null}
                  </div>

                  {/* XAI Analysis */}
                  {data.explainability && data.explainability.length > 0 ? (
                    <div className="glass-card p-6">
                      <h3 className="font-display font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                        <Brain className="w-4 h-4 text-primary" /> AI Reasoning & Indicators
                      </h3>
                      <div className="space-y-3">
                        {data.explainability.map((exp: any, i: number) => (
                          <div key={i} className="text-sm p-3 rounded-lg border bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-3">
                            <Target className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">{exp.text} <span className="font-normal text-xs opacity-70 ml-2">({exp.type || 'Signal'})</span></p>
                              <p className="text-xs opacity-80 mt-1">{exp.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                      <Shield className="w-12 h-12 text-safe opacity-60 mb-4" />
                      <p className="text-safe font-medium">No malicious indicators detected.</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                        This QR code points to a standard domain with clean reputation parameters.
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
