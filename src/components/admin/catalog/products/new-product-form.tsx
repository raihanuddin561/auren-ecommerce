'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition, type FormEvent } from 'react';
import { createProduct } from '@/modules/catalog/actions';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/toast';
import {
  failureMessage,
  fieldErrorsOf,
  firstError,
  type FieldErrorMap,
} from '../../action-feedback';
import { NONE, fromSelect } from './select-value';

interface NewProductFormProps {
  categories: Array<{ id: string; label: string }>;
}

/** The smallest form that can start a product. Everything else is edited on the product screen. */
export function NewProductForm({ categories }: NewProductFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState(NONE);
  const [productType, setProductType] = useState('');
  const [errors, setErrors] = useState<FieldErrorMap>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await createProduct({
        title,
        categoryId: fromSelect(categoryId),
        productType,
      });
      if (!result.ok) {
        setErrors(fieldErrorsOf(result));
        setFormError(failureMessage(result));
        return;
      }
      toast.success('Draft created', 'Add variants and images next.');
      router.push(`/admin/products/${result.data.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-5">
      <FormField label="Title" required error={firstError(errors, 'title')}>
        {(control) => (
          <Input
            {...control}
            name="title"
            value={title}
            maxLength={140}
            autoComplete="off"
            onChange={(event) => setTitle(event.target.value)}
          />
        )}
      </FormField>
      <FormField
        label="Category"
        hint="A product needs a category before it can go live."
        error={firstError(errors, 'categoryId')}
      >
        {(control) => (
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger
              id={control.id}
              aria-describedby={control['aria-describedby']}
              invalid={Boolean(control['aria-invalid'])}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>
      <FormField
        label="Product type"
        hint="For example Shirt or Trousers. Optional."
        error={firstError(errors, 'productType')}
      >
        {(control) => (
          <Input
            {...control}
            name="productType"
            value={productType}
            maxLength={60}
            onChange={(event) => setProductType(event.target.value)}
          />
        )}
      </FormField>
      {formError ? (
        <p role="alert" className="type-small text-danger-text">
          {formError}
        </p>
      ) : null}
      <div className="flex items-center gap-3">
        <Button type="submit" loading={pending}>
          {pending ? 'Creating' : 'Create draft'}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push('/admin/products')}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
