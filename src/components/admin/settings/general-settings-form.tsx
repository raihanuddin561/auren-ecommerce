'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';
import { saveStoreGeneralSettingsAction } from '@/modules/settings/actions';
import type { StoreGeneralSettings } from '@/modules/settings/schemas';

interface GeneralSettingsFormProps {
  initial: StoreGeneralSettings;
}

export function GeneralSettingsForm({ initial }: GeneralSettingsFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<StoreGeneralSettings>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const update = <K extends keyof StoreGeneralSettings>(key: K, value: StoreGeneralSettings[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const res = await saveStoreGeneralSettingsAction(form);
      if (res.ok) {
        toast.success('Store settings saved successfully');
        router.refresh();
      } else {
        toast.error(res.error.message ?? 'Failed to save store settings');
        if (res.error.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.error.fieldErrors)) {
            if (Array.isArray(v) && v[0]) {
              mapped[k] = v[0];
            }
          }
          setErrors(mapped);
        }
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {/* Brand & Identity */}
      <section className="border border-line bg-raised p-6">
        <h2 className="type-h3 font-display text-fg">Brand & Identity</h2>
        <p className="mt-1 type-admin text-fg-muted">
          Basic brand information displayed across the digital storefront and customer documents.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="storeName">Store Name (required)</Label>
            <Input
              id="storeName"
              value={form.storeName}
              onChange={(e) => update('storeName', e.target.value)}
              placeholder="AUREN"
              disabled={isPending}
              required
            />
            {errors.storeName ? <p className="type-admin text-danger">{errors.storeName}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tagline">Tagline / Brand Statement</Label>
            <Input
              id="tagline"
              value={form.tagline}
              onChange={(e) => update('tagline', e.target.value)}
              placeholder="Modern, Refined Menswear"
              disabled={isPending}
            />
            {errors.tagline ? <p className="type-admin text-danger">{errors.tagline}</p> : null}
          </div>
        </div>
      </section>

      {/* Concierge & Contact */}
      <section className="border border-line bg-raised p-6">
        <h2 className="type-h3 font-display text-fg">Concierge & Contact Details</h2>
        <p className="mt-1 type-admin text-fg-muted">
          Customer support channels, WhatsApp concierge, and registered studio location.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supportEmail">Support Email (required)</Label>
            <Input
              id="supportEmail"
              type="email"
              value={form.supportEmail}
              onChange={(e) => update('supportEmail', e.target.value)}
              placeholder="concierge@auren.com"
              disabled={isPending}
              required
            />
            {errors.supportEmail ? (
              <p className="type-admin text-danger">{errors.supportEmail}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="supportPhone">Support Phone (required)</Label>
            <Input
              id="supportPhone"
              value={form.supportPhone}
              onChange={(e) => update('supportPhone', e.target.value)}
              placeholder="+880 1700-000000"
              disabled={isPending}
              required
            />
            {errors.supportPhone ? (
              <p className="type-admin text-danger">{errors.supportPhone}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="whatsappNumber">WhatsApp Concierge Desk</Label>
            <Input
              id="whatsappNumber"
              value={form.whatsappNumber}
              onChange={(e) => update('whatsappNumber', e.target.value)}
              placeholder="+880 1700-000000"
              disabled={isPending}
            />
            {errors.whatsappNumber ? (
              <p className="type-admin text-danger">{errors.whatsappNumber}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="address">Physical Studio & Atelier Address</Label>
            <Textarea
              id="address"
              rows={2}
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              placeholder="House 12, Road 11, Banani, Dhaka 1213, Bangladesh"
              disabled={isPending}
            />
            {errors.address ? <p className="type-admin text-danger">{errors.address}</p> : null}
          </div>
        </div>
      </section>

      {/* Fiscal & Tax (VAT) */}
      <section className="border border-line bg-raised p-6">
        <h2 className="type-h3 font-display text-fg">Tax & Fiscal Configuration</h2>
        <p className="mt-1 type-admin text-fg-muted">
          Bangladesh VAT registration (BIN), standard tax rate, and pricing display rules.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="binNumber">Business Identification Number (BIN / VAT)</Label>
            <Input
              id="binNumber"
              value={form.binNumber}
              onChange={(e) => update('binNumber', e.target.value)}
              placeholder="001234567-0101"
              disabled={isPending}
            />
            {errors.binNumber ? <p className="type-admin text-danger">{errors.binNumber}</p> : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vatPercentage">Standard VAT Rate (%)</Label>
            <Input
              id="vatPercentage"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.vatPercentage}
              onChange={(e) => update('vatPercentage', Number(e.target.value) || 0)}
              disabled={isPending}
            />
            {errors.vatPercentage ? (
              <p className="type-admin text-danger">{errors.vatPercentage}</p>
            ) : null}
          </div>

          <div className="border-t border-line pt-4 sm:col-span-2">
            <Switch
              label="Prices displayed to clients already include applicable VAT"
              checked={form.pricesIncludeVat}
              onCheckedChange={(checked) => update('pricesIncludeVat', checked)}
              disabled={isPending}
            />
          </div>
        </div>
      </section>

      {/* Social Channels */}
      <section className="border border-line bg-raised p-6">
        <h2 className="type-h3 font-display text-fg">Social Channels & Presence</h2>
        <p className="mt-1 type-admin text-fg-muted">
          Official social links embedded in the digital storefront footer and communications.
        </p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="socialInstagram">Instagram URL</Label>
            <Input
              id="socialInstagram"
              value={form.socialInstagram}
              onChange={(e) => update('socialInstagram', e.target.value)}
              placeholder="https://instagram.com/auren.menswear"
              disabled={isPending}
            />
            {errors.socialInstagram ? (
              <p className="type-admin text-danger">{errors.socialInstagram}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="socialFacebook">Facebook URL</Label>
            <Input
              id="socialFacebook"
              value={form.socialFacebook}
              onChange={(e) => update('socialFacebook', e.target.value)}
              placeholder="https://facebook.com/auren.menswear"
              disabled={isPending}
            />
            {errors.socialFacebook ? (
              <p className="type-admin text-danger">{errors.socialFacebook}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="socialYoutube">YouTube URL (Optional)</Label>
            <Input
              id="socialYoutube"
              value={form.socialYoutube}
              onChange={(e) => update('socialYoutube', e.target.value)}
              placeholder="https://youtube.com/@auren"
              disabled={isPending}
            />
            {errors.socialYoutube ? (
              <p className="type-admin text-danger">{errors.socialYoutube}</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={() => router.push('/admin/settings')}>
          Cancel
        </Button>
        <Button type="submit" loading={isPending} disabled={isPending}>
          Save Store Settings
        </Button>
      </div>
    </form>
  );
}
