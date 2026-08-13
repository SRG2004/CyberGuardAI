import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { FileSearch, UploadCloud, File, ShieldAlert, CheckCircle, Shield, FileType, HardDrive, Clock, Hash } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';

type FileInfo = {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  hash?: string;
};

export default function FileAnalyzer() {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);

  const calculateHash = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const buffer = e.target?.result as ArrayBuffer;
          const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          resolve(hashHex);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFile = async (file: File) => {
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large', { description: 'Please select a file smaller than 50MB.' });
      return;
    }

    setIsAnalyzing(true);
    setFileInfo({
      name: file.name,
      size: file.size,
      type: file.type || 'Unknown',
      lastModified: file.lastModified,
    });

    try {
      const hash = await calculateHash(file);
      setFileInfo(prev => prev ? { ...prev, hash } : null);
    } catch (error) {
      toast.error('Hash calculation failed', { description: 'Could not generate SHA-256 hash for this file.' });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
          <FileSearch className="w-8 h-8 text-primary" /> Local File Metadata Analyzer
        </h1>
        <p className="text-muted-foreground mt-2">
          Securely analyze files directly in your browser. Extracts metadata and generates cryptographic hashes (SHA-256) locally without uploading your files to any server.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload Zone */}
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="h-full">
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            className={`glass-card p-10 h-full min-h-[300px] flex flex-col items-center justify-center text-center border-2 border-dashed transition-all duration-300 ${
              isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
            }`}
          >
            {isAnalyzing ? (
              <div className="space-y-4">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="text-sm font-medium animate-pulse">Calculating cryptographic hash...</p>
              </div>
            ) : (
              <>
                <UploadCloud className={`w-16 h-16 mb-4 ${isDragging ? 'text-primary' : 'text-muted-foreground opacity-50'}`} />
                <h3 className="text-lg font-semibold mb-2">Drag & Drop a File Here</h3>
                <p className="text-sm text-muted-foreground mb-6">or click to browse your local device.</p>
                <input
                  type="file"
                  id="fileInput"
                  className="hidden"
                  onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                />
                <GlowButton onClick={() => document.getElementById('fileInput')?.click()}>
                  Browse Files
                </GlowButton>
                <p className="text-[10px] text-muted-foreground mt-4">Max file size: 50MB. Processed 100% locally.</p>
              </>
            )}
          </div>
        </motion.div>

        {/* Results Pane */}
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}>
          <div className="glass-card p-6 h-full min-h-[300px] flex flex-col">
            <h3 className="font-semibold text-lg mb-6 flex items-center gap-2">
              <File className="w-5 h-5 text-primary" /> Analysis Results
            </h3>

            {fileInfo ? (
              <div className="space-y-4 flex-1">
                <div className="p-3 bg-muted/30 rounded-lg border border-border/50 flex items-center gap-3">
                  <File className="w-8 h-8 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate text-foreground">{fileInfo.name}</p>
                    <p className="text-xs text-muted-foreground">Original Filename</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <FileType className="w-4 h-4 text-secondary" />
                      <span className="text-xs text-muted-foreground">MIME Type</span>
                    </div>
                    <p className="text-sm font-medium truncate">{fileInfo.type || 'application/octet-stream'}</p>
                  </div>
                  
                  <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                    <div className="flex items-center gap-2 mb-1">
                      <HardDrive className="w-4 h-4 text-secondary" />
                      <span className="text-xs text-muted-foreground">File Size</span>
                    </div>
                    <p className="text-sm font-medium">{formatSize(fileInfo.size)}</p>
                  </div>
                </div>

                <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-secondary" />
                    <span className="text-xs text-muted-foreground">Last Modified</span>
                  </div>
                  <p className="text-sm font-medium">{new Date(fileInfo.lastModified).toLocaleString()}</p>
                </div>

                {fileInfo.hash && (
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Hash className="w-4 h-4 text-primary" />
                      <span className="text-xs font-semibold text-primary uppercase tracking-wider">SHA-256 Hash</span>
                    </div>
                    <p className="text-xs font-mono break-all text-foreground bg-background/50 p-2 rounded border border-border/50 select-all">
                      {fileInfo.hash}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      You can use this hash to search threat databases (like VirusTotal) without uploading the file content.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50">
                <Shield className="w-12 h-12 mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Waiting for a file to analyze...</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
