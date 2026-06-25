import { motion } from 'framer-motion';
import { Download, Settings, FileCheck, Shield, ChevronRight } from 'lucide-react';
import { GlowButton } from '@/components/ui/GlowButton';

export default function Install() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-4">
        <h1 className="font-display text-4xl md:text-5xl font-bold text-foreground">
          Get CyberGuard AI
        </h1>
        <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
          Install the browser extension in Developer Mode to get real-time protection against zero-day phishing and malicious links.
        </p>
        <div className="pt-4">
          <a href="/cyberguard-extension.zip" download>
            <GlowButton size="lg" className="w-full sm:w-auto">
              <Download className="w-5 h-5 mr-2" />
              Download Extension (.zip)
            </GlowButton>
          </a>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }} 
        animate={{ opacity: 1, y: 0 }} 
        transition={{ delay: 0.2 }}
        className="glass-card p-8"
      >
        <h2 className="font-display text-2xl font-bold mb-6 flex items-center gap-2">
          <Shield className="w-6 h-6 text-primary" />
          Installation Guide
        </h2>
        
        <div className="space-y-8">
          <div className="relative pl-10">
            <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">1</div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Download & Extract</h3>
            <p className="text-muted-foreground">Download the <span className="text-primary font-mono text-sm">cyberguard-extension.zip</span> file using the button above. Once downloaded, extract (unzip) the folder to a location on your computer like your Desktop or Documents.</p>
          </div>

          <div className="relative pl-10">
            <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">2</div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Open Extensions Page</h3>
            <p className="text-muted-foreground">Open Google Chrome or Brave browser. In the address bar at the top, type <span className="font-mono text-primary bg-primary/10 px-2 py-0.5 rounded text-sm">chrome://extensions/</span> and press Enter.</p>
          </div>

          <div className="relative pl-10">
            <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">3</div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Enable Developer Mode</h3>
            <p className="text-muted-foreground">In the top right corner of the Extensions page, you will see a toggle switch labeled <strong>"Developer mode"</strong>. Turn it on.</p>
          </div>

          <div className="relative pl-10">
            <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-primary/20 text-primary font-bold text-sm">4</div>
            <h3 className="font-semibold text-lg text-foreground mb-1">Load the Extension</h3>
            <p className="text-muted-foreground mb-3">Click the <strong>"Load unpacked"</strong> button that appears in the top left corner. Select the extracted folder from Step 1.</p>
            <div className="bg-muted/30 border border-border rounded-xl p-4 flex items-start gap-3">
              <FileCheck className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">Success!</p>
                <p className="text-sm text-muted-foreground">CyberGuard AI is now active. You will see the shield icon in your browser toolbar, protecting you from malicious links across the web.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
