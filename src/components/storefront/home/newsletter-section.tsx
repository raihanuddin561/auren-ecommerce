'use client';

import { useState, type FormEvent } from 'react';
import { Reveal } from '@/components/motion/reveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';

export function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@') || !email.includes('.')) {
      toast.error('Please enter a valid email address.');
      return;
    }

    setStatus('loading');
    await new Promise((r) => setTimeout(r, 600));
    setStatus('success');
    toast.success('Welcome to the AUREN Inner Circle.');
  }

  return (
    <section
      aria-labelledby="inner-circle-heading"
      className="border-t border-line bg-page py-20 md:py-28"
    >
      <div className="container-page">
        <Reveal>
          <div className="mx-auto max-w-2xl text-center">
            <span className="type-eyebrow text-accent-text">Privileged Access</span>
            <h2 id="inner-circle-heading" className="mt-3 type-display-lg font-display text-fg">
              The AUREN Inner Circle
            </h2>
            <p className="mt-4 type-body text-pretty text-fg-muted md:text-lg">
              Receive private invitations to seasonal capsule releases, bespoke fitting previews,
              and rare fabric dispatches. We send only deliberate, thoughtful communications.
            </p>

            {status === 'success' ? (
              <div className="mt-8 rounded-xs border border-line bg-raised/80 p-6">
                <p className="type-h3 font-medium text-fg">Thank you for joining</p>
                <p className="mt-1 type-small text-fg-muted">
                  A welcome dispatch has been prepared for {email}.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                noValidate
                className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
              >
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email address"
                  className="h-12 w-full max-w-md bg-raised text-fg sm:w-80"
                  required
                />
                <Button type="submit" size="lg" loading={status === 'loading'} className="h-12">
                  Join Inner Circle
                </Button>
              </form>
            )}

            <p className="mt-4 type-small text-fg-muted/70">
              By subscribing, you agree to our{' '}
              <a href="/privacy" className="underline hover:text-fg">
                Privacy Policy
              </a>
              . You may leave at any time.
            </p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
