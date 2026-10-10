'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import { updateProfileAction } from '@/modules/customer/actions';

interface ProfileFormProps {
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    createdAt?: Date | string;
  };
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    const name = String(formData.get('name') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();

    if (!name || name.length < 2) {
      setError('Name must be at least 2 characters.');
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await updateProfileAction({
        name,
        phone: phone || null,
      });

      if (res.ok) {
        toast.success('Your profile details have been updated.');
      } else {
        setError(res.error?.message ?? 'Could not update profile.');
      }
    });
  }

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
      })
    : null;

  return (
    <div className="space-y-6">
      <div className="border-b border-line pb-4">
        <h1 className="type-h2 font-display text-fg">Client Profile & Preferences</h1>
        <p className="type-body-sm text-fg-muted">
          Manage your contact credentials and private client identifiers.
        </p>
      </div>

      <div className="rounded-xs border border-line bg-raised p-6">
        <form action={handleSubmit} className="space-y-5">
          {error && (
            <div
              role="alert"
              className="rounded-xs border border-danger/20 bg-danger/5 px-4 py-3 type-body-sm text-danger"
            >
              {error}
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField label="Full Name" required>
              {(props) => (
                <Input
                  {...props}
                  name="name"
                  defaultValue={user.name}
                  placeholder="Your Full Name"
                  required
                />
              )}
            </FormField>

            <FormField
              label="Primary Phone Number"
              hint="Used by client concierge for order verification"
            >
              {(props) => (
                <Input
                  {...props}
                  name="phone"
                  type="tel"
                  defaultValue={user.phone ?? ''}
                  placeholder="01XXXXXXXXX"
                />
              )}
            </FormField>
          </div>

          <FormField
            label="Email Address"
            hint="Primary login and receipt destination. Contact concierge to update your registered email."
          >
            {(props) => (
              <Input
                {...props}
                name="email"
                type="email"
                defaultValue={user.email}
                readOnly
                className="cursor-not-allowed opacity-70"
              />
            )}
          </FormField>

          {memberSince && (
            <div className="rounded-xs border border-line/60 bg-page p-4">
              <span className="type-eyebrow text-accent-text">MEMBERSHIP STATUS</span>
              <p className="mt-1 type-body-sm font-medium text-fg">AUREN Private Client</p>
              <p className="type-body-xs text-fg-muted">Member since {memberSince}</p>
            </div>
          )}

          <div className="flex items-center justify-end border-t border-line pt-4">
            <Button
              type="submit"
              variant="primary"
              disabled={isPending}
              className="text-xs tracking-widest uppercase"
            >
              {isPending ? 'Updating...' : 'Save Profile Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
