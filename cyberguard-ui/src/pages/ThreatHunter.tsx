import { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Shield, Upload, Hash } from 'lucide-react';
import { useSubmitReport } from '@/hooks/api/useReports';
import { GlowButton } from '@/components/ui/GlowButton';
import { toast } from 'sonner';

const reportTypes = ['Phishing Link', 'Malicious Email', 'Fake Website', 'Other'];

export default function ThreatHunter() {
  const [type, setType] = useState(reportTypes[0]);
  const [url, setUrl] = useState('');
  const [description, setDescription] = useState('');
  const [evidence, setEvidence] = useState<File | null>(null);
  const [submittedId, setSubmittedId] = useState<string | null>(null);

  const submitReport = useSubmitReport();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url && !description) {
      toast.error('Please provide a URL or description.');
      return;
    }

    const formData = new FormData();
    formData.append('type', type.toLowerCase().replace(' ', '_'));
    formData.append('url', url);
    formData.append('description', description);
    if (evidence) {
      formData.append('evidence', evidence);
    }

    submitReport.mutate(formData, {
      onSuccess: (res: { data?: { anonymousId?: string } }) => {
        setSubmittedId(res.data?.anonymousId || `CG-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
        setUrl('');
        setDescription('');
        setEvidence(null);
      },
      onError: () => {
        toast.error('Failed to submit report. Please try again.');
      },
    });
  };

  if (submittedId) {
    return (
      <div className="max-w-lg mx-auto">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-12 text-center">
          <div className="w-20 h-20 rounded-2xl bg-safe/10 flex items-center justify-center mx-auto mb-6 shadow-glow-green">
            <Shield className="w-10 h-10 text-safe" />
          </div>
          <h2 className="font-display text-2xl font-bold text-foreground mb-2">Report Submitted</h2>
          <p className="text-sm text-muted-foreground mb-4">Thank you for helping keep the community safe.</p>
          <p className="text-[10px] text-muted-foreground mt-3">You can view the status of this report in your Profile.</p>
          <GlowButton variant="ghost" className="mt-6" onClick={() => setSubmittedId(null)}>Submit Another</GlowButton>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <h2 className="font-display text-xl font-bold text-foreground flex items-center gap-2 mb-6">
          <AlertTriangle className="w-5 h-5 text-warning" /> Submit a Threat
        </h2>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs text-muted-foreground block mb-2">What are you reporting?</label>
            <div className="flex flex-wrap gap-2">
              {reportTypes.map(t => (
                <button
                  key={t} type="button" onClick={() => setType(t)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all ${type === t ? 'bg-primary/20 text-primary border border-primary/30' : 'text-muted-foreground bg-muted/30 border border-transparent hover:border-border'}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">URL or Source</label>
            <input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." className="w-full h-10 px-4 rounded-lg bg-muted/50 border border-border text-sm font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Describe the threat..." className="w-full px-4 py-3 rounded-lg bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 resize-none transition-all" />
          </div>
          <div className="relative p-3 rounded-lg border border-dashed border-border text-center cursor-pointer hover:border-primary/30 transition-colors">
            <input 
              type="file" 
              accept="image/*" 
              onChange={e => setEvidence(e.target.files?.[0] || null)} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
              title="Upload Evidence"
            />
            <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-xs text-muted-foreground">
              {evidence ? evidence.name : 'Upload evidence (screenshot)'}
            </p>
          </div>
          <GlowButton type="submit" className="w-full" size="lg" disabled={submitReport.isPending}>
            {submitReport.isPending ? 'Submitting...' : 'Submit Threat'}
          </GlowButton>
        </form>
      </motion.div>
    </div>
  );
}
