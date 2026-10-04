import { describe, expect, it } from 'vitest';
import {
  allocateLandedCosts,
  landedUnitCost,
  receiptLandedShare,
  receiptValue,
  weightedAverageCost,
  type CostLine,
  type LandedCostInput,
} from '../cost';

const BDT = 'BDT';

describe('weighted average cost (INV-F2: ARCHITECTURE 7.2)', () => {
  const avg = (
    onHandBefore: number,
    avgCostBeforeMinor: bigint,
    receivedQuantity: number,
    incomingValueMinor: bigint,
  ) =>
    weightedAverageCost({ onHandBefore, avgCostBeforeMinor, receivedQuantity, incomingValueMinor });

  it('first receipt: the average is the landed unit cost', () => {
    // 20 shirts at 1,000.00 each, nothing landed yet.
    expect(avg(0, 0n, 20, 20n * 100_000n)).toBe(100_000n);
  });

  it('a second receipt at a higher price blends by quantity', () => {
    // 20 on hand at 1,000.00, 10 more at 1,300.00: (20 x 1000 + 10 x 1300) / 30 = 1,100.00.
    expect(avg(20, 100_000n, 10, 10n * 130_000n)).toBe(110_000n);
  });

  it('with nothing on hand the old average is ignored', () => {
    expect(avg(0, 100_000n, 5, 5n * 150_000n)).toBe(150_000n);
  });

  it('landed costs raise the average: freight and duty are part of the cost', () => {
    // 10 units at 1,000.00 plus 500.00 landed: unit 1,050.00. On hand 10 at 1,000.00 before.
    const value = receiptValue(
      { quantity: 10, unitCostMinor: 100_000n, landedMinor: 50_000n },
      BDT,
    );
    expect(value.minor).toBe(1_050_000n);
    expect(avg(10, 100_000n, 10, value.minor)).toBe(102_500n);
  });

  it('rounds half to even on the final division only', () => {
    // (1 x 1000 + 1 x 1001) / 2 = 1000.5 -> 1000 (even); (1001 + 1002) / 2 = 1001.5 -> 1002 (even).
    expect(avg(1, 1000n, 1, 1001n)).toBe(1000n);
    expect(avg(1, 1001n, 1, 1002n)).toBe(1002n);
    // 3 x 1000 + 2 x 1001 = 5002 / 5 = 1000.4 -> 1000.
    expect(avg(3, 1000n, 2, 2002n)).toBe(1000n);
  });

  it('reserved units are still on hand, so a partial receipt averages over all of them', () => {
    // 6 on hand (2 of them reserved) at 500.00, 4 received at 600.00 -> 540.00.
    expect(avg(6, 50_000n, 4, 4n * 60_000n)).toBe(54_000n);
  });

  it('refuses nonsense quantities', () => {
    expect(() => avg(-1, 0n, 1, 0n)).toThrow();
    expect(() => avg(0, 0n, 0, 0n)).toThrow();
  });

  it('landed unit cost is the delivery value over its units, half to even', () => {
    // 3 x 1000 + 2 = 3002 / 3 = 1000.67 -> 1001; 2 x 1000 + 1 = 2001 / 2 = 1000.5 -> 1000 (even).
    expect(landedUnitCost({ quantity: 3, unitCostMinor: 1000n, landedMinor: 2n }, BDT)).toBe(1001n);
    expect(landedUnitCost({ quantity: 2, unitCostMinor: 1000n, landedMinor: 1n }, BDT)).toBe(1000n);
  });
});

describe('landed cost allocation (INV-F3)', () => {
  const lines: CostLine[] = [
    { id: 'A', quantityOrdered: 10, unitCostMinor: 100_000n },
    { id: 'B', quantityOrdered: 5, unitCostMinor: 200_000n },
  ];

  it('worked example: freight by value, duty by quantity', () => {
    const costs: LandedCostInput[] = [
      { amountMinor: 150_000n, method: 'by_value' },
      { amountMinor: 100_000n, method: 'by_quantity' },
    ];
    const result = allocateLandedCosts(lines, costs, BDT);
    // Value weights are equal (10 x 1000 = 5 x 2000): 75,000 each. Quantity 10:5 of 100,000 is
    // 66,667 and 33,333 (largest remainder gives the spare unit to line A).
    expect(result.perLine.get('A')).toBe(75_000n + 66_667n);
    expect(result.perLine.get('B')).toBe(75_000n + 33_333n);
    expect(result.total).toBe(250_000n);
  });

  it('by value weights the dearer line more', () => {
    const result = allocateLandedCosts(
      [
        { id: 'cheap', quantityOrdered: 10, unitCostMinor: 100n },
        { id: 'dear', quantityOrdered: 10, unitCostMinor: 300n },
      ],
      [{ amountMinor: 400n, method: 'by_value' }],
      BDT,
    );
    expect(result.perLine.get('cheap')).toBe(100n);
    expect(result.perLine.get('dear')).toBe(300n);
  });

  it('by quantity ignores price', () => {
    const result = allocateLandedCosts(
      [
        { id: 'cheap', quantityOrdered: 10, unitCostMinor: 100n },
        { id: 'dear', quantityOrdered: 10, unitCostMinor: 300n },
      ],
      [{ amountMinor: 400n, method: 'by_quantity' }],
      BDT,
    );
    expect(result.perLine.get('cheap')).toBe(200n);
    expect(result.perLine.get('dear')).toBe(200n);
  });

  it('the allocations always add up to the landed total, for many random orders', () => {
    let seed = 12345;
    const next = (max: number) => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return (seed % max) + 1;
    };
    for (let round = 0; round < 300; round += 1) {
      const randomLines: CostLine[] = Array.from({ length: next(7) }, (_, index) => ({
        id: `L${index}`,
        quantityOrdered: next(40),
        unitCostMinor: BigInt(next(500_000)),
      }));
      const costs: LandedCostInput[] = Array.from({ length: next(4) }, () => ({
        amountMinor: BigInt(next(2_000_000)),
        method: next(2) === 1 ? ('by_quantity' as const) : ('by_value' as const),
      }));
      const result = allocateLandedCosts(randomLines, costs, BDT);
      const sum = [...result.perLine.values()].reduce((acc, value) => acc + value, 0n);
      expect(sum).toBe(costs.reduce((acc, cost) => acc + cost.amountMinor, 0n));
      expect(result.total).toBe(sum);
      for (const value of result.perLine.values()) expect(value >= 0n).toBe(true);
    }
  });

  it('refuses to spread by value when every line is worth nothing', () => {
    expect(() =>
      allocateLandedCosts(
        [{ id: 'free', quantityOrdered: 5, unitCostMinor: 0n }],
        [{ amountMinor: 100n, method: 'by_value' }],
        BDT,
      ),
    ).toThrow(/zero value/);
  });

  it('partial deliveries carry the whole line landed cost, exactly, whatever the split', () => {
    const lineLanded = 141_667n;
    const ordered = 10;
    for (const split of [[10], [4, 6], [1, 1, 1, 7], [3, 3, 3, 1], [9, 1]]) {
      let received = 0;
      let carried = 0n;
      for (const part of split) {
        received += part;
        carried += receiptLandedShare({
          lineLandedMinor: lineLanded,
          quantityOrdered: ordered,
          receivedAfter: received,
          alreadyAllocatedMinor: carried,
          currency: BDT,
        });
      }
      expect(received).toBe(ordered);
      expect(carried).toBe(lineLanded);
    }
  });

  it('a landed cost added after a first delivery is caught up on the next one', () => {
    // 4 of 10 received with 1,000 landed (400 carried); 500 more is added: line total 1,500.
    const second = receiptLandedShare({
      lineLandedMinor: 1_500n,
      quantityOrdered: 10,
      receivedAfter: 7,
      alreadyAllocatedMinor: 400n,
      currency: BDT,
    });
    expect(second).toBe(1_050n - 400n);
    const last = receiptLandedShare({
      lineLandedMinor: 1_500n,
      quantityOrdered: 10,
      receivedAfter: 10,
      alreadyAllocatedMinor: 400n + second,
      currency: BDT,
    });
    expect(400n + second + last).toBe(1_500n);
  });
});
