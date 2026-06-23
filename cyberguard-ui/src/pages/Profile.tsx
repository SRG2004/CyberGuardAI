import { motion } from 'framer-motion';
import { User, Mail, Shield, Calendar, BarChart3, Edit } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { GlowButton } from '@/components/ui/GlowButton';

export default function Profile() {
  const user = useAuthStore((s) => s.user);

  if (!user) return null;

  const roleLabel = user.role.charAt(0).toUpperCase() + user.role.slice(1);
  const joinedDate = new Date(user.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Profile Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8">
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-glow-cyan shrink-0">
            <User className="w-10 h-10 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-2xl font-bold text-foreground">{user.displayName}</h2>
            <p className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
              <Mail className="w-3.5 h-3.5" /> {user.email}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className={`px-2.5 py-0.5 text-[10px] font-bold rounded-md capitalize border ${
                user.role === 'admin' ? 'bg-destructive/10 text-destructive border-destructive/30' :
                user.role === 'moderator' ? 'bg-warning/10 text-warning border-warning/30' :
                'bg-primary/10 text-primary border-primary/20'
              }`}>{roleLabel}</span>
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Joined {joinedDate}</span>
            </div>
          </div>
          <GlowButton variant="ghost" size="sm"><Edit className="w-4 h-4" /> Edit</GlowButton>
        </div>
      </motion.div>

      {/* Account Info */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
        <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" /> Account Information
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-xs text-muted-foreground">User ID</span>
            <span className="text-xs font-mono text-foreground">{user._id}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-xs text-muted-foreground">Email</span>
            <span className="text-xs text-foreground">{user.email}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-xs text-muted-foreground">Role</span>
            <span className="text-xs text-foreground capitalize">{user.role}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-border/30">
            <span className="text-xs text-muted-foreground">Status</span>
            <span className={`text-xs ${user.isActive ? 'text-safe' : 'text-destructive'}`}>{user.isActive ? 'Active' : 'Inactive'}</span>
          </div>
          <div className="flex justify-between py-2">
            <span className="text-xs text-muted-foreground">Last Active</span>
            <span className="text-xs text-muted-foreground">
              {user.lastActive ? new Date(user.lastActive).toLocaleString() : 'Never'}
            </span>
          </div>
        </div>
      </motion.div>

      {/* Security */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
        <h3 className="font-display font-semibold text-foreground text-sm flex items-center gap-2 mb-4">
          <Shield className="w-4 h-4 text-primary" /> Account Security
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-foreground">Password</p>
              <p className="text-xs text-muted-foreground">Last changed 30 days ago</p>
            </div>
            <GlowButton variant="ghost" size="sm">Change</GlowButton>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-foreground">Two-Factor Auth</p>
              <p className="text-xs text-muted-foreground">Not enabled</p>
            </div>
            <GlowButton variant="ghost" size="sm">Enable</GlowButton>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm text-foreground">Active Sessions</p>
              <p className="text-xs text-muted-foreground">1 device</p>
            </div>
            <GlowButton variant="ghost" size="sm">Manage</GlowButton>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
