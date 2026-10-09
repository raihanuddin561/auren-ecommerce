'use client';

import { useEffect, useState } from 'react';
import { firstError, type FieldErrorMap } from '@/components/admin/action-feedback';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/storefront/checkout/native-select';
import { listThanas } from '@/modules/shipping/actions';

export interface AddressDraft {
  divisionId: string;
  districtId: string;
  thanaId: string;
  thanaName: string;
  area: string;
  line1: string;
  line2: string;
  postalCode: string;
}

export const EMPTY_ADDRESS: AddressDraft = {
  divisionId: '',
  districtId: '',
  thanaId: '',
  thanaName: '',
  area: '',
  line1: '',
  line2: '',
  postalCode: '',
};

export interface AreaLists {
  divisions: Array<{ id: string; name: string }>;
  districts: Array<{ id: string; name: string; divisionId: string }>;
}

/** The address as the server wants it: ids from the lists, names for anything typed by hand. */
export function addressPayload(draft: AddressDraft, areas: AreaLists) {
  const division = areas.divisions.find((item) => item.id === draft.divisionId);
  const district = areas.districts.find((item) => item.id === draft.districtId);
  return {
    divisionId: draft.divisionId,
    ...(division ? { divisionName: division.name } : {}),
    districtId: draft.districtId,
    ...(district ? { districtName: district.name } : {}),
    ...(draft.thanaId ? { thanaId: draft.thanaId } : {}),
    ...(!draft.thanaId && draft.thanaName.trim() ? { thanaName: draft.thanaName.trim() } : {}),
    area: draft.area.trim(),
    line1: draft.line1.trim(),
    ...(draft.line2.trim() ? { line2: draft.line2.trim() } : {}),
    ...(draft.postalCode.trim() ? { postalCode: draft.postalCode.trim() } : {}),
  };
}

/** Division, district and thana pickers plus the street fields (staff entry and edit). */
export function AddressFields({
  value,
  onChange,
  areas,
  errors = {},
  prefix = 'address',
}: {
  value: AddressDraft;
  onChange: (next: AddressDraft) => void;
  areas: AreaLists;
  errors?: FieldErrorMap;
  prefix?: string;
}) {
  // The thanas of the district they were loaded for; any other district shows none until they arrive.
  const [loaded, setLoaded] = useState<{
    districtId: string;
    thanas: Array<{ id: string; name: string }>;
  }>({ districtId: '', thanas: [] });
  const thanas = loaded.districtId === value.districtId ? loaded.thanas : [];
  const districts = areas.districts.filter((district) => district.divisionId === value.divisionId);

  useEffect(() => {
    if (!value.districtId) return;
    const districtId = value.districtId;
    let cancelled = false;
    listThanas({ parentId: districtId })
      .then((result) => {
        if (!cancelled) setLoaded({ districtId, thanas: result.ok ? result.data : [] });
      })
      .catch(() => {
        if (!cancelled) setLoaded({ districtId, thanas: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [value.districtId]);

  const patch = (change: Partial<AddressDraft>) => onChange({ ...value, ...change });
  const err = (key: string) => firstError(errors, `${prefix}.${key}`);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Division" required error={err('divisionId')}>
        {(control) => (
          <NativeSelect
            {...control}
            value={value.divisionId}
            onChange={(event) =>
              patch({ divisionId: event.target.value, districtId: '', thanaId: '', thanaName: '' })
            }
          >
            <option value="">Choose a division</option>
            {areas.divisions.map((division) => (
              <option key={division.id} value={division.id}>
                {division.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      <FormField label="District" required error={err('districtId')}>
        {(control) => (
          <NativeSelect
            {...control}
            value={value.districtId}
            disabled={!value.divisionId}
            onChange={(event) =>
              patch({ districtId: event.target.value, thanaId: '', thanaName: '' })
            }
          >
            <option value="">Choose a district</option>
            {districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </NativeSelect>
        )}
      </FormField>
      {thanas.length > 0 ? (
        <FormField
          label="Thana or upazila"
          hint="Not listed? Leave it empty and type it in the area field."
          error={err('thanaId')}
        >
          {(control) => (
            <NativeSelect
              {...control}
              value={value.thanaId}
              onChange={(event) => patch({ thanaId: event.target.value, thanaName: '' })}
            >
              <option value="">Not listed</option>
              {thanas.map((thana) => (
                <option key={thana.id} value={thana.id}>
                  {thana.name}
                </option>
              ))}
            </NativeSelect>
          )}
        </FormField>
      ) : (
        <FormField label="Thana or upazila" error={err('thanaName')}>
          {(control) => (
            <Input
              {...control}
              value={value.thanaName}
              maxLength={80}
              onChange={(event) => patch({ thanaName: event.target.value })}
            />
          )}
        </FormField>
      )}
      <FormField label="Area or locality" required error={err('area')}>
        {(control) => (
          <Input
            {...control}
            value={value.area}
            maxLength={120}
            onChange={(event) => patch({ area: event.target.value })}
          />
        )}
      </FormField>
      <FormField label="House, road" required error={err('line1')} className="sm:col-span-2">
        {(control) => (
          <Input
            {...control}
            value={value.line1}
            maxLength={200}
            onChange={(event) => patch({ line1: event.target.value })}
          />
        )}
      </FormField>
      <FormField label="Landmark or flat" error={err('line2')}>
        {(control) => (
          <Input
            {...control}
            value={value.line2}
            maxLength={200}
            onChange={(event) => patch({ line2: event.target.value })}
          />
        )}
      </FormField>
      <FormField label="Postal code" error={err('postalCode')}>
        {(control) => (
          <Input
            {...control}
            inputMode="numeric"
            value={value.postalCode}
            maxLength={12}
            onChange={(event) => patch({ postalCode: event.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}
