'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  createMarketingCampaignAction,
  deleteMarketingCampaignAction,
} from '@/modules/finance/actions';
import type { MarketingCampaignChannel, MarketingCampaignItem } from '@/modules/finance/types';
import { fromDecimalString } from '@/lib/money';
import { Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface CampaignsTableProps {
  campaigns: MarketingCampaignItem[];
}

export function CampaignsTable({ campaigns }: CampaignsTableProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [channel, setChannel] = useState<MarketingCampaignChannel>('meta');
  const [utmCampaign, setUtmCampaign] = useState('');
  const [startsOn, setStartsOn] = useState(new Date().toISOString().split('T')[0] ?? '');
  const [endsOn, setEndsOn] = useState('');
  const [budgetBdt, setBudgetBdt] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let budgetMinor = 0n;
    if (budgetBdt.trim()) {
      try {
        budgetMinor = fromDecimalString(budgetBdt.trim(), 'BDT').minor;
      } catch {
        toast.error('Invalid budget amount');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const res = await createMarketingCampaignAction({
        name: name.trim(),
        channel,
        utmCampaign: utmCampaign.trim() ? utmCampaign.trim() : null,
        startsOn,
        endsOn: endsOn ? endsOn : null,
        budgetMinor,
      });

      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to launch campaign');
        return;
      }

      toast.success('Campaign registered successfully');
      setOpen(false);
      setName('');
      setUtmCampaign('');
      setBudgetBdt('');
      setEndsOn('');
      router.refresh();
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, campName: string) => {
    if (!confirm(`Are you sure you want to delete campaign "${campName}"?`)) return;

    setDeletingId(id);
    try {
      const res = await deleteMarketingCampaignAction(id);
      if (!res.ok) {
        toast.error(res.error?.message ?? 'Failed to delete campaign');
        return;
      }
      toast.success('Campaign deleted');
      router.refresh();
    } catch {
      toast.error('An error occurred');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-canvas flex items-center justify-between rounded-sm border border-line p-4">
        <div>
          <h2 className="text-sm font-semibold text-ink">Marketing Campaigns & ROAS</h2>
          <p className="text-stone text-xs">
            Track performance advertising spend, UTM attribution, orders, and Return On Ad Spend
            (ROAS).
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="text-canvas gap-1.5 bg-ink text-xs hover:bg-ink/90">
              <Plus className="h-3.5 w-3.5" />
              Launch Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-canvas max-w-md border-line">
            <form onSubmit={handleSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle className="font-serif text-lg text-ink">
                  Register Marketing Campaign
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-1.5">
                <Label htmlFor="campName" className="text-stone text-xs">
                  Campaign Name *
                </Label>
                <Input
                  id="campName"
                  required
                  placeholder="e.g. Autumn Riviera Linen Drop"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-surface h-9 border-line text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="channel" className="text-stone text-xs">
                    Ad Channel *
                  </Label>
                  <select
                    id="channel"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value as MarketingCampaignChannel)}
                    className="bg-surface h-9 w-full rounded-sm border border-line px-3 text-xs text-ink focus:ring-1 focus:ring-gold focus:outline-hidden"
                  >
                    <option value="meta">Meta Ads (Instagram / FB)</option>
                    <option value="google">Google Performance Max</option>
                    <option value="tiktok">TikTok Fashion</option>
                    <option value="influencer">Influencer Collaboration</option>
                    <option value="email">Atelier Dispatch / Newsletter</option>
                    <option value="offline">Showroom / Offline Print</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="utmCampaign" className="text-stone text-xs">
                    UTM Campaign Tag
                  </Label>
                  <Input
                    id="utmCampaign"
                    placeholder="autumn_linen_2026"
                    value={utmCampaign}
                    onChange={(e) => setUtmCampaign(e.target.value)}
                    className="bg-surface h-9 border-line font-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startsOn" className="text-stone text-xs">
                    Start Date *
                  </Label>
                  <Input
                    id="startsOn"
                    type="date"
                    required
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="endsOn" className="text-stone text-xs">
                    End Date (Optional)
                  </Label>
                  <Input
                    id="endsOn"
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="bg-surface h-9 border-line text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="budgetBdt" className="text-stone text-xs">
                  Allocated Budget (BDT ৳)
                </Label>
                <Input
                  id="budgetBdt"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="50000.00"
                  value={budgetBdt}
                  onChange={(e) => setBudgetBdt(e.target.value)}
                  className="bg-surface h-9 border-line font-mono text-xs"
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="border-line text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                  className="text-canvas bg-ink text-xs hover:bg-ink/90"
                >
                  {isSubmitting ? 'Registering...' : 'Save Campaign'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-canvas overflow-hidden rounded-sm border border-line">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface/50 text-stone border-b border-line text-left">
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Campaign</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Channel</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">UTM Tag</th>
                <th className="px-4 py-2.5 font-medium tracking-wider uppercase">Dates</th>
                <th className="w-28 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Budget
                </th>
                <th className="w-28 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Total Spend
                </th>
                <th className="w-24 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Orders
                </th>
                <th className="w-32 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Revenue
                </th>
                <th className="w-20 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  ROAS
                </th>
                <th className="w-16 px-4 py-2.5 text-right font-medium tracking-wider uppercase">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {campaigns.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-stone py-8 text-center">
                    No marketing campaigns registered yet.
                  </td>
                </tr>
              ) : (
                campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-surface/30 transition-colors">
                    <td className="px-4 py-3 font-semibold text-ink">{camp.name}</td>
                    <td className="px-4 py-3 capitalize">
                      <Badge tone="neutral">{camp.channel}</Badge>
                    </td>
                    <td className="text-stone px-4 py-3 font-mono text-xs">
                      {camp.utmCampaign ?? '-'}
                    </td>
                    <td className="text-stone px-4 py-3 font-mono text-xs">
                      {camp.startsOn} {camp.endsOn ? `→ ${camp.endsOn}` : '(Ongoing)'}
                    </td>
                    <td className="text-stone px-4 py-3 text-right font-mono whitespace-nowrap">
                      {camp.budgetFormatted}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium whitespace-nowrap text-ink">
                      {camp.spendFormatted}
                    </td>
                    <td className="text-stone px-4 py-3 text-right font-mono">
                      {camp.attributedOrdersCount}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-semibold whitespace-nowrap text-ink">
                      {camp.attributedRevenueFormatted}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {camp.roas ? (
                        <Badge tone="gold" className="font-mono font-bold">
                          {camp.roas}
                        </Badge>
                      ) : (
                        <span className="text-stone">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={deletingId === camp.id}
                        onClick={() => handleDelete(camp.id, camp.name)}
                        className="text-stone h-7 w-7 p-0 hover:text-oxblood"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="sr-only">Delete campaign</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
