import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, UploadCloud, AlertCircle, CheckCircle, Brain, Target, Shield } from 'lucide-react';
import { useScanQR } from '@/hooks/api/useScans';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';
import { getRiskColor } from '@/lib/theme';

export default function QRScanner() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const scanQR = useScanQR();

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      scanQR.reset();
    }
  };

  const handleScan = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    try {
      await scanQR.mutateAsync(formData);
      toast.success('QR Code analyzed successfully');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'QR Scan failed');
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 text-center">
        <h2 className="font-display text-2xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
          <QrCode className="w-6 h-6 text-primary" /> QR Code Scanner
        </h2>
        <p className="text-sm text-muted-foreground mb-8">Upload a suspicious QR code (Quishing) to extract and analyze its hidden URL.</p>

        <div className="flex flex-col items-center gap-6">
          <div 
            className="w-full max-w-sm border-2 border-dashed border-border rounded-2xl p-8 hover:bg-muted/50 transition-colors cursor-pointer relative overflow-hidden"
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
              <img src={previewUrl} alt="QR Preview" className="w-full h-auto rounded shadow-lg" />
            ) : (
              <div className="flex flex-col items-center gap-4 opacity-70">
                <UploadCloud className="w-12 h-12 text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-medium">Click to upload QR code image</p>
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
        {scanQR.data && scanQR.data.data && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-6">
            
            {scanQR.data.data.error ? (
              <div className="glass-card p-6 bg-destructive/10 border-destructive/30 text-center">
                <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-3" />
                <h3 className="text-destructive font-bold text-lg mb-1">Decryption Failed</h3>
                <p className="text-sm text-muted-foreground">{scanQR.data.data.error}</p>
              </div>
            ) : (
              <>
                <div className="glass-card p-8 text-center">
                  <h3 className="font-display font-bold text-lg mb-4 text-muted-foreground uppercase tracking-wider">Extracted Payload</h3>
                  <div className="bg-background/50 p-4 rounded-lg font-mono text-primary text-lg break-all border border-border inline-block px-8">
                    {scanQR.data.data.url}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Score Card */}
                  <div className="glass-card p-8 text-center flex flex-col items-center justify-center">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Threat Analysis</p>
                    <div className={`stat-number text-6xl ${getRiskColor(scanQR.data.data.riskScore)}`}>
                      {scanQR.data.data.riskScore}%
                    </div>
                    <p className={`text-sm font-bold mt-2 ${getRiskColor(scanQR.data.data.riskScore)}`}>
                      {scanQR.data.data.verdict.toUpperCase()}
                    </p>
                  </div>

                  {/* XAI Analysis */}
                  {scanQR.data.data.explainability && scanQR.data.data.explainability.length > 0 && (
                    <div className="glass-card p-6">
                      <h3 className="font-display font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
                        <Brain className="w-4 h-4 text-primary" /> AI Reasoning (XAI)
                      </h3>
                      <div className="space-y-3">
                        {scanQR.data.data.explainability.map((exp: any, i: number) => (
                          <div key={i} className="text-sm p-3 rounded-lg border bg-destructive/10 border-destructive/20 text-destructive flex items-start gap-3">
                            <Target className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold">{exp.text} <span className="font-normal text-xs opacity-70 ml-2">({exp.type})</span></p>
                              <p className="text-xs opacity-80 mt-1">{exp.reason}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {(!scanQR.data.data.explainability || scanQR.data.data.explainability.length === 0) && scanQR.data.data.verdict === 'safe' && (
                    <div className="glass-card p-6 flex flex-col items-center justify-center text-center">
                      <Shield className="w-12 h-12 text-safe opacity-50 mb-4" />
                      <p className="text-safe font-medium">No malicious indicators detected.</p>
                      <p className="text-xs text-muted-foreground mt-1">This QR code appears to point to a legitimate domain.</p>
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
