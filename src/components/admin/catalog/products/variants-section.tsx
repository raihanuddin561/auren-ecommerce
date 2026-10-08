import type { ProductView } from './types';
import { FormSection } from '../../form-section';
import { OptionsGenerator } from './options-generator';
import { VariantsTable } from './variants-table';

interface VariantsSectionProps {
  product: ProductView;
  sizeCharts?: Array<{ id: string; label: string; sizes: string[] }>;
  canWrite: boolean;
  /** Show the average cost column (cost of goods is not for every role). */
  showCost?: boolean;
  /** Link to the inventory screen (needs inventory.read). */
  canSeeStock?: boolean;
}

/** Options and variants: the matrix generator above, the editable rows below. */
export function VariantsSection({
  product,
  sizeCharts,
  canWrite,
  showCost = false,
  canSeeStock = false,
}: VariantsSectionProps) {
  // The rows start over when the server changes the set, the status or the labels of variants
  // (generate, reactivate, rename), never on a plain edit.
  const rowsKey = product.variants
    .map((v) => `${v.id}:${v.status}:${v.labels.join('/')}`)
    .join('|');
  // The generator starts from the saved options again after a generate, so new rows carry their
  // ids and a later rename keeps its variants.
  const optionsKey = product.options
    .map((o) => `${o.id}:${o.name}:${o.values.map((v) => `${v.id}=${v.label}`).join(',')}`)
    .join('|');
  return (
    <FormSection
      title="Options and variants"
      description="Set up options, then price and number each variant. Selling price is set here; cost comes from purchase receipts or from the unit cost entered when adding stock."
    >
      {canWrite ? (
        <OptionsGenerator key={optionsKey} product={product} sizeCharts={sizeCharts} />
      ) : (
        <p className="type-small text-fg-muted">You can view variants but not change them.</p>
      )}
      <VariantsTable
        key={rowsKey}
        product={product}
        canWrite={canWrite}
        showCost={showCost}
        canSeeStock={canSeeStock}
      />
    </FormSection>
  );
}
