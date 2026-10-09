'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

type Unit = 'in' | 'cm';

const SHIRT_DATA = [
  {
    size: 'S (38)',
    collar: { in: 15.0, cm: 38.0 },
    chest: { in: 39.5, cm: 100.0 },
    length: { in: 29.5, cm: 75.0 },
    sleeve: { in: 33.0, cm: 84.0 },
  },
  {
    size: 'M (40)',
    collar: { in: 15.7, cm: 40.0 },
    chest: { in: 41.5, cm: 105.5 },
    length: { in: 30.0, cm: 76.0 },
    sleeve: { in: 34.0, cm: 86.5 },
  },
  {
    size: 'L (42)',
    collar: { in: 16.5, cm: 42.0 },
    chest: { in: 44.0, cm: 112.0 },
    length: { in: 30.5, cm: 77.5 },
    sleeve: { in: 35.0, cm: 89.0 },
  },
  {
    size: 'XL (44)',
    collar: { in: 17.3, cm: 44.0 },
    chest: { in: 46.5, cm: 118.0 },
    length: { in: 31.0, cm: 79.0 },
    sleeve: { in: 35.5, cm: 90.0 },
  },
  {
    size: 'XXL (46)',
    collar: { in: 18.0, cm: 46.0 },
    chest: { in: 49.0, cm: 124.5 },
    length: { in: 31.5, cm: 80.0 },
    sleeve: { in: 36.0, cm: 91.5 },
  },
];

const TROUSER_DATA = [
  {
    size: '30',
    waist: { in: 31.0, cm: 79.0 },
    hip: { in: 39.0, cm: 99.0 },
    inseam: { in: 31.5, cm: 80.0 },
    thigh: { in: 24.0, cm: 61.0 },
    opening: { in: 14.5, cm: 37.0 },
  },
  {
    size: '32',
    waist: { in: 33.0, cm: 84.0 },
    hip: { in: 41.0, cm: 104.0 },
    inseam: { in: 32.0, cm: 81.0 },
    thigh: { in: 25.0, cm: 63.5 },
    opening: { in: 15.0, cm: 38.0 },
  },
  {
    size: '34',
    waist: { in: 35.0, cm: 89.0 },
    hip: { in: 43.0, cm: 109.0 },
    inseam: { in: 32.0, cm: 81.0 },
    thigh: { in: 26.0, cm: 66.0 },
    opening: { in: 15.5, cm: 39.5 },
  },
  {
    size: '36',
    waist: { in: 37.0, cm: 94.0 },
    hip: { in: 45.0, cm: 114.0 },
    inseam: { in: 32.5, cm: 82.5 },
    thigh: { in: 27.0, cm: 68.5 },
    opening: { in: 16.0, cm: 40.5 },
  },
  {
    size: '38',
    waist: { in: 39.0, cm: 99.0 },
    hip: { in: 47.0, cm: 119.5 },
    inseam: { in: 32.5, cm: 82.5 },
    thigh: { in: 28.0, cm: 71.0 },
    opening: { in: 16.5, cm: 42.0 },
  },
];

const BLAZER_DATA = [
  {
    size: '38R',
    chest: { in: 40.0, cm: 101.5 },
    shoulder: { in: 17.5, cm: 44.5 },
    jacketLength: { in: 29.5, cm: 75.0 },
    sleeve: { in: 25.0, cm: 63.5 },
  },
  {
    size: '40R',
    chest: { in: 42.0, cm: 106.5 },
    shoulder: { in: 18.0, cm: 45.7 },
    jacketLength: { in: 30.0, cm: 76.0 },
    sleeve: { in: 25.5, cm: 64.8 },
  },
  {
    size: '42R',
    chest: { in: 44.0, cm: 111.8 },
    shoulder: { in: 18.5, cm: 47.0 },
    jacketLength: { in: 30.5, cm: 77.5 },
    sleeve: { in: 26.0, cm: 66.0 },
  },
  {
    size: '44R',
    chest: { in: 46.0, cm: 116.8 },
    shoulder: { in: 19.0, cm: 48.3 },
    jacketLength: { in: 31.0, cm: 78.7 },
    sleeve: { in: 26.5, cm: 67.3 },
  },
];

export function SizeGuideTables() {
  const [unit, setUnit] = useState<Unit>('in');

  return (
    <div className="space-y-12">
      {/* Unit Selector Toggle */}
      <div className="flex items-center justify-between border-b border-line pb-4">
        <h2 className="type-h2 font-display text-fg">Measurement Tables</h2>
        <div className="flex items-center gap-1 rounded-xs border border-line bg-raised p-1">
          <Button
            type="button"
            size="sm"
            variant={unit === 'in' ? 'primary' : 'ghost'}
            onClick={() => setUnit('in')}
            className="h-8 px-3 type-small"
          >
            Inches (&quot;)
          </Button>
          <Button
            type="button"
            size="sm"
            variant={unit === 'cm' ? 'primary' : 'ghost'}
            onClick={() => setUnit('cm')}
            className="h-8 px-3 type-small"
          >
            Centimeters (cm)
          </Button>
        </div>
      </div>

      {/* Shirts Table */}
      <div>
        <h3 className="type-h3 font-medium text-fg">Tailored & Casual Shirts</h3>
        <p className="mt-1 type-small text-fg-muted">Garment measurements when laid flat.</p>
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full text-left type-small">
            <thead className="border-b border-line bg-raised/60 type-eyebrow text-fg">
              <tr>
                <th className="p-3">Size</th>
                <th className="p-3">Collar ({unit})</th>
                <th className="p-3">Chest ({unit})</th>
                <th className="p-3">Length ({unit})</th>
                <th className="p-3">Sleeve ({unit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {SHIRT_DATA.map((row) => (
                <tr key={row.size} className="hover:bg-raised/20">
                  <td className="p-3 font-medium text-fg">{row.size}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.collar[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.chest[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.length[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.sleeve[unit]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Trousers Table */}
      <div>
        <h3 className="type-h3 font-medium text-fg">Tailored Trousers & Chinos</h3>
        <p className="mt-1 type-small text-fg-muted">
          Cut with a mid-rise and refined gentle taper.
        </p>
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full text-left type-small">
            <thead className="border-b border-line bg-raised/60 type-eyebrow text-fg">
              <tr>
                <th className="p-3">Waist Size</th>
                <th className="p-3">True Waist ({unit})</th>
                <th className="p-3">Seat / Hip ({unit})</th>
                <th className="p-3">Inseam ({unit})</th>
                <th className="p-3">Thigh ({unit})</th>
                <th className="p-3">Leg Opening ({unit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {TROUSER_DATA.map((row) => (
                <tr key={row.size} className="hover:bg-raised/20">
                  <td className="p-3 font-medium text-fg">{row.size}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.waist[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.hip[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.inseam[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.thigh[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.opening[unit]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Blazers Table */}
      <div>
        <h3 className="type-h3 font-medium text-fg">Tailored Blazers & Jackets</h3>
        <p className="mt-1 type-small text-fg-muted">Unconstructed soft shoulder tailoring.</p>
        <div className="mt-4 overflow-x-auto border border-line">
          <table className="w-full text-left type-small">
            <thead className="border-b border-line bg-raised/60 type-eyebrow text-fg">
              <tr>
                <th className="p-3">Jacket Size</th>
                <th className="p-3">Chest ({unit})</th>
                <th className="p-3">Shoulder ({unit})</th>
                <th className="p-3">Jacket Length ({unit})</th>
                <th className="p-3">Sleeve ({unit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/60">
              {BLAZER_DATA.map((row) => (
                <tr key={row.size} className="hover:bg-raised/20">
                  <td className="p-3 font-medium text-fg">{row.size}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.chest[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.shoulder[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.jacketLength[unit]}</td>
                  <td className="p-3 font-mono text-fg-muted">{row.sleeve[unit]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
