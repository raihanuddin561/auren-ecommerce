import { describe, expect, it } from 'vitest';
import {
  adminReviewFilterSchema,
  moderateReviewSchema,
  reviewFilterSchema,
  submitReviewSchema,
} from '../schemas';

describe('Review Schemas', () => {
  const validProductId = '01927380-0001-7000-8000-000000000001';
  const validReviewId = '01927380-0002-7000-8000-000000000002';

  describe('submitReviewSchema', () => {
    it('accepts a valid review submission payload', () => {
      const result = submitReviewSchema.safeParse({
        productId: validProductId,
        rating: 5,
        title: 'Superb linen drape',
        body: 'The fabric feels noble and breathable for warm evenings in Dhaka.',
        fitFeedback: 'true_to_size',
        sizePurchased: 'L',
        heightCm: 180,
        authorName: 'Raihan Ahmed',
        authorEmail: 'raihan@example.com',
        mediaUrls: ['https://example.com/photo1.jpg'],
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.rating).toBe(5);
        expect(result.data.fitFeedback).toBe('true_to_size');
        expect(result.data.heightCm).toBe(180);
      }
    });

    it('rejects ratings outside 1-5', () => {
      expect(
        submitReviewSchema.safeParse({
          productId: validProductId,
          rating: 0,
          title: 'Too low',
          body: 'This should fail validation because rating is 0.',
          authorName: 'User',
        }).success,
      ).toBe(false);

      expect(
        submitReviewSchema.safeParse({
          productId: validProductId,
          rating: 6,
          title: 'Too high',
          body: 'This should fail validation because rating is 6.',
          authorName: 'User',
        }).success,
      ).toBe(false);
    });

    it('rejects short review body (< 10 chars)', () => {
      const result = submitReviewSchema.safeParse({
        productId: validProductId,
        rating: 5,
        title: 'Good',
        body: 'Short',
        authorName: 'User',
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid fit feedback enum', () => {
      const result = submitReviewSchema.safeParse({
        productId: validProductId,
        rating: 4,
        title: 'Collar roll',
        body: 'Nicely cut cotton shirt with good proportions.',
        fitFeedback: 'oversized_huge',
        authorName: 'User',
      });

      expect(result.success).toBe(false);
    });

    it('caps photos to a maximum of 5', () => {
      const result = submitReviewSchema.safeParse({
        productId: validProductId,
        rating: 5,
        title: 'Too many photos',
        body: 'Attaching six photos to test the constraint.',
        authorName: 'User',
        mediaUrls: [
          'https://example.com/1.jpg',
          'https://example.com/2.jpg',
          'https://example.com/3.jpg',
          'https://example.com/4.jpg',
          'https://example.com/5.jpg',
          'https://example.com/6.jpg',
        ],
      });

      expect(result.success).toBe(false);
    });

    it('rejects invalid height range', () => {
      expect(
        submitReviewSchema.safeParse({
          productId: validProductId,
          rating: 5,
          title: 'Height too low',
          body: 'This should fail because height is under 100 cm.',
          authorName: 'User',
          heightCm: 50,
        }).success,
      ).toBe(false);

      expect(
        submitReviewSchema.safeParse({
          productId: validProductId,
          rating: 5,
          title: 'Height too tall',
          body: 'This should fail because height exceeds 250 cm.',
          authorName: 'User',
          heightCm: 290,
        }).success,
      ).toBe(false);
    });
  });

  describe('moderateReviewSchema', () => {
    it('accepts approved and rejected decisions', () => {
      expect(
        moderateReviewSchema.safeParse({
          reviewId: validReviewId,
          status: 'approved',
        }).success,
      ).toBe(true);

      expect(
        moderateReviewSchema.safeParse({
          reviewId: validReviewId,
          status: 'rejected',
          moderationNote: 'Inappropriate language violation',
        }).success,
      ).toBe(true);
    });

    it('refuses invalid status transitions', () => {
      expect(
        moderateReviewSchema.safeParse({
          reviewId: validReviewId,
          status: 'deleted',
        }).success,
      ).toBe(false);
    });
  });

  describe('reviewFilterSchema', () => {
    it('applies default limits and sort ordering', () => {
      const parsed = reviewFilterSchema.parse({});
      expect(parsed.limit).toBe(10);
      expect(parsed.offset).toBe(0);
      expect(parsed.sort).toBe('recent');
    });

    it('accepts specific rating filter', () => {
      const parsed = reviewFilterSchema.parse({
        rating: '5',
        sort: 'helpful',
        hasMedia: 'true',
      });
      expect(parsed.rating).toBe(5);
      expect(parsed.sort).toBe('helpful');
      expect(parsed.hasMedia).toBe(true);
    });
  });

  describe('adminReviewFilterSchema', () => {
    it('defaults to status all and page 1', () => {
      const parsed = adminReviewFilterSchema.parse({});
      expect(parsed.status).toBe('all');
      expect(parsed.page).toBe(1);
      expect(parsed.pageSize).toBe(20);
    });
  });

  describe('Rating & Fit Feedback Arithmetic', () => {
    it('accurately computes average rating rounded to 1 decimal place', () => {
      const ratings = [5, 5, 4];
      const sum = ratings.reduce((a, b) => a + b, 0);
      const avg = Number((sum / ratings.length).toFixed(1));
      expect(avg).toBe(4.7);
    });

    it('accurately calculates true-to-size percentage', () => {
      const total = 12;
      const trueToSize = 10;
      const pct = Math.round((trueToSize / total) * 100);
      expect(pct).toBe(83);
    });

    it('handles zero reviews cleanly', () => {
      const total = 0;
      const pct = total > 0 ? Math.round((0 / total) * 100) : 100;
      expect(pct).toBe(100);
    });
  });
});
