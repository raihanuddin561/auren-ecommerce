'use client';

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

export function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const contact = String(data.get('contact') ?? '').trim();
    const _topic = String(data.get('topic') ?? 'general');
    const message = String(data.get('message') ?? '').trim();

    const newErrors: Record<string, string> = {};
    if (!name) newErrors.name = 'Please provide your full name.';
    if (!contact) newErrors.contact = 'Please provide your phone number or email.';
    if (!message || message.length < 10)
      newErrors.message = 'Please provide a message with at least 10 characters.';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    // Simulate sending / logging inquiry
    await new Promise((resolve) => setTimeout(resolve, 600));
    setLoading(false);
    setSubmitted(true);
    toast.success('Your message has been received by our concierge.');
  }

  if (submitted) {
    return (
      <div className="rounded-xs border border-line bg-page p-8 text-center">
        <span className="type-eyebrow text-accent-text">INQUIRY RECEIVED</span>
        <h3 className="mt-2 type-h2 font-display text-fg">Thank you for reaching out</h3>
        <p className="mx-auto mt-3 max-w-md type-body text-fg-muted">
          Your inquiry has been assigned to a senior concierge specialist. We will connect with you
          promptly via phone, WhatsApp, or email.
        </p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => {
            setSubmitted(false);
          }}
        >
          Send another inquiry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <FormField label="Full Name" error={errors.name} required>
        {(control) => (
          <Input {...control} name="name" autoComplete="name" placeholder="e.g. Tariq Rahman" />
        )}
      </FormField>

      <div className="grid gap-5 sm:grid-cols-2">
        <FormField
          label="Phone or Email"
          error={errors.contact}
          required
          hint="We will reply via WhatsApp or email"
        >
          {(control) => (
            <Input
              {...control}
              name="contact"
              autoComplete="tel"
              placeholder="+880 17... or email"
            />
          )}
        </FormField>

        <div>
          <label htmlFor="topic-select" className="mb-2 block type-eyebrow text-fg">
            Inquiry Topic
          </label>
          <select
            id="topic-select"
            name="topic"
            defaultValue="sizing"
            className="h-11 w-full border border-line bg-page px-3 py-2 type-body text-fg focus:border-gold focus:outline-hidden"
          >
            <option value="sizing">Sizing & Fit Advice</option>
            <option value="fitting">Private Studio Fitting Appointment</option>
            <option value="order">Order Verification or Status</option>
            <option value="bespoke">Bespoke / Corporate Commission</option>
            <option value="general">General Client Care</option>
          </select>
        </div>
      </div>

      <FormField label="Your Message" error={errors.message} required>
        {(control) => (
          <Textarea
            {...control}
            name="message"
            rows={5}
            placeholder="Tell us about your requirements, measurements, or the pieces you are interested in..."
          />
        )}
      </FormField>

      <Button type="submit" size="lg" loading={loading} className="w-full sm:w-auto">
        Send to Concierge
      </Button>
    </form>
  );
}
