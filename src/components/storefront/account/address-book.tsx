'use client';

import { Check, Edit2, Plus, Star, Trash2 } from 'lucide-react';
import { useMemo, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/toast';
import {
  deleteAddressAction,
  saveAddressAction,
  setDefaultAddressAction,
} from '@/modules/customer/actions';
export interface AreaOption {
  id: string;
  name: string;
  nameBn?: string | null;
}

export interface DistrictOption extends AreaOption {
  divisionId: string;
}

export interface SavedAddressItem {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  divisionId: string;
  districtId: string;
  thanaId: string | null;
  thanaName: string | null;
  area: string | null;
  line1: string;
  line2: string | null;
  postalCode: string | null;
  country: string;
  isDefault: boolean;
}

interface AddressBookProps {
  addresses: SavedAddressItem[];
  divisions: AreaOption[];
  districts: DistrictOption[];
}

export function AddressBook({ addresses, divisions, districts }: AddressBookProps) {
  const [isPending, startTransition] = useTransition();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddressItem | null>(null);

  // Form states
  const [selectedDivision, setSelectedDivision] = useState<string>(
    editingAddress?.divisionId || divisions[0]?.id || '',
  );
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    editingAddress?.districtId || '',
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const availableDistricts = useMemo(() => {
    if (!selectedDivision) return [];
    return districts.filter((d) => d.divisionId === selectedDivision);
  }, [districts, selectedDivision]);

  function openCreateForm() {
    setEditingAddress(null);
    setSelectedDivision(divisions[0]?.id || '');
    setSelectedDistrict('');
    setErrorMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(addr: SavedAddressItem) {
    setEditingAddress(addr);
    setSelectedDivision(addr.divisionId);
    setSelectedDistrict(addr.districtId);
    setErrorMessage(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingAddress(null);
    setErrorMessage(null);
  }

  function handleSetDefault(addressId: string) {
    startTransition(async () => {
      const res = await setDefaultAddressAction({ addressId });
      if (res.ok) {
        toast.success('Default delivery address updated.');
      } else {
        toast.error('Could not update default address.');
      }
    });
  }

  function handleDelete(addressId: string) {
    if (!confirm('Are you sure you want to remove this address?')) return;
    startTransition(async () => {
      const res = await deleteAddressAction({ addressId });
      if (res.ok) {
        toast.success('Address removed from your address book.');
      } else {
        toast.error('Failed to remove address.');
      }
    });
  }

  async function handleSave(formData: FormData) {
    const label = String(formData.get('label') ?? 'Home').trim();
    const fullName = String(formData.get('fullName') ?? '').trim();
    const phone = String(formData.get('phone') ?? '').trim();
    const line1 = String(formData.get('line1') ?? '').trim();
    const area = String(formData.get('area') ?? '').trim();
    const thanaName = String(formData.get('thanaName') ?? '').trim();
    const postalCode = String(formData.get('postalCode') ?? '').trim();
    const isDefault = formData.get('isDefault') === 'on';

    if (!fullName || !phone || !line1 || !selectedDivision || !selectedDistrict) {
      setErrorMessage('Please fill in all required fields.');
      return;
    }

    startTransition(async () => {
      const res = await saveAddressAction({
        id: editingAddress ? editingAddress.id : undefined,
        label,
        fullName,
        phone,
        divisionId: selectedDivision,
        districtId: selectedDistrict,
        line1,
        area: area || undefined,
        thanaName: thanaName || undefined,
        postalCode: postalCode || undefined,
        isDefault,
      });

      if (res.ok) {
        toast.success(editingAddress ? 'Address updated.' : 'New address saved.');
        closeForm();
      } else {
        setErrorMessage(res.error?.message ?? 'Failed to save address.');
      }
    });
  }

  const divisionMap = useMemo(() => {
    return new Map(divisions.map((d) => [d.id, d.name]));
  }, [divisions]);

  const districtMap = useMemo(() => {
    return new Map(districts.map((d) => [d.id, d.name]));
  }, [districts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="type-h2 font-display text-fg">Address Book</h1>
          <p className="type-body-sm text-fg-muted">
            Manage your personal ateliers, residences, and private delivery addresses across
            Bangladesh.
          </p>
        </div>
        {!isFormOpen && (
          <Button
            variant="primary"
            onClick={openCreateForm}
            className="gap-2 self-start sm:self-auto"
          >
            <Icon icon={Plus} className="size-4" />
            <span>Add New Address</span>
          </Button>
        )}
      </div>

      {isFormOpen && (
        <div className="shadow-sm rounded-xs border border-line bg-raised p-6">
          <div className="mb-6 flex items-center justify-between border-b border-line pb-4">
            <h2 className="type-h3 font-display text-fg">
              {editingAddress ? 'Edit Delivery Address' : 'New Delivery Address'}
            </h2>
            <Button variant="ghost" onClick={closeForm} className="text-xs uppercase">
              Cancel
            </Button>
          </div>

          <form action={handleSave} className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="type-body-sm rounded-xs border border-danger/20 bg-danger/5 px-4 py-3 text-danger"
              >
                {errorMessage}
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Address Label (e.g. Residence, Atelier, Office)">
                {(props) => (
                  <Input
                    {...props}
                    name="label"
                    defaultValue={editingAddress?.label ?? 'Home'}
                    placeholder="Home"
                  />
                )}
              </FormField>

              <FormField label="Full Recipient Name" required>
                {(props) => (
                  <Input
                    {...props}
                    name="fullName"
                    defaultValue={editingAddress?.fullName ?? ''}
                    placeholder="Full Name"
                    required
                  />
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone Number" hint="Used for courier delivery dispatch" required>
                {(props) => (
                  <Input
                    {...props}
                    name="phone"
                    type="tel"
                    defaultValue={editingAddress?.phone ?? ''}
                    placeholder="01XXXXXXXXX"
                    required
                  />
                )}
              </FormField>

              <FormField label="Division" required>
                {() => (
                  <select
                    value={selectedDivision}
                    onChange={(e) => {
                      setSelectedDivision(e.target.value);
                      setSelectedDistrict('');
                    }}
                    className="h-12 w-full rounded-xs border border-line bg-page px-4 type-body text-fg"
                    required
                  >
                    <option value="" disabled>
                      Select Division
                    </option>
                    {divisions.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.nameBn ? `(${d.nameBn})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="District" required>
                {() => (
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    disabled={!selectedDivision}
                    className="h-12 w-full rounded-xs border border-line bg-page px-4 type-body text-fg disabled:opacity-50"
                    required
                  >
                    <option value="" disabled>
                      Select District
                    </option>
                    {availableDistricts.map((dist) => (
                      <option key={dist.id} value={dist.id}>
                        {dist.name}
                      </option>
                    ))}
                  </select>
                )}
              </FormField>

              <FormField label="Thana / Upazila (Optional)">
                {(props) => (
                  <Input
                    {...props}
                    name="thanaName"
                    defaultValue={editingAddress?.thanaName ?? ''}
                    placeholder="e.g. Gulshan, Banani, Uttara"
                  />
                )}
              </FormField>
            </div>

            <FormField label="Street Address & House / Apartment" required>
              {(props) => (
                <Input
                  {...props}
                  name="line1"
                  defaultValue={editingAddress?.line1 ?? ''}
                  placeholder="House 14, Road 7, Block D"
                  required
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Area / Locality (Optional)">
                {(props) => (
                  <Input
                    {...props}
                    name="area"
                    defaultValue={editingAddress?.area ?? ''}
                    placeholder="e.g. Baridhara DOHS"
                  />
                )}
              </FormField>

              <FormField label="Postal Code (Optional)">
                {(props) => (
                  <Input
                    {...props}
                    name="postalCode"
                    defaultValue={editingAddress?.postalCode ?? ''}
                    placeholder="e.g. 1212"
                  />
                )}
              </FormField>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="isDefault"
                name="isDefault"
                defaultChecked={editingAddress?.isDefault ?? addresses.length === 0}
                className="size-4 accent-accent-text"
              />
              <label htmlFor="isDefault" className="type-body-sm cursor-pointer text-fg">
                Set as my default delivery destination
              </label>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-line pt-4">
              <Button type="button" variant="ghost" onClick={closeForm}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={isPending}>
                {isPending ? 'Saving...' : editingAddress ? 'Update Address' : 'Save Address'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {addresses.length === 0 && !isFormOpen ? (
        <div className="rounded-xs border border-dashed border-line bg-page p-12 text-center">
          <p className="type-body text-fg-muted">
            You do not have any saved delivery destinations yet.
          </p>
          <Button variant="secondary" onClick={openCreateForm} className="mt-4 gap-2">
            <Icon icon={Plus} className="size-4" />
            <span>Add Your First Address</span>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {addresses.map((addr) => {
            const divName = divisionMap.get(addr.divisionId) || 'Division';
            const distName = districtMap.get(addr.districtId) || 'District';

            return (
              <div
                key={addr.id}
                className="relative flex flex-col justify-between rounded-xs border border-line bg-page p-5 transition-colors hover:border-fg/40"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="type-eyebrow text-accent-text uppercase">
                      {addr.label || 'Destination'}
                    </span>
                    {addr.isDefault && (
                      <span className="bg-accent-muted type-body-xs inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-accent-text">
                        <Icon icon={Star} className="size-3 fill-accent-text" />
                        Default
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 type-h3 font-display text-fg">{addr.fullName}</h3>
                  <p className="type-body-sm text-fg-muted">{addr.phone}</p>

                  <div className="type-body-sm mt-3 space-y-0.5 border-t border-line/50 pt-3 text-fg-muted">
                    <p>{addr.line1}</p>
                    {addr.area && <p>{addr.area}</p>}
                    {addr.thanaName && <p>{addr.thanaName}</p>}
                    <p>
                      {distName}, {divName} {addr.postalCode ? `- ${addr.postalCode}` : ''}
                    </p>
                  </div>
                </div>

                <div className="type-body-xs mt-6 flex items-center justify-between border-t border-line/60 pt-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => openEditForm(addr)}
                      className="inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-fg"
                    >
                      <Icon icon={Edit2} className="size-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(addr.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 text-fg-muted transition-colors hover:text-danger"
                    >
                      <Icon icon={Trash2} className="size-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {!addr.isDefault && (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(addr.id)}
                      disabled={isPending}
                      className="inline-flex items-center gap-1 font-medium text-accent-text transition-colors hover:text-accent-text/80"
                    >
                      <Icon icon={Check} className="size-3.5" />
                      <span>Set as Default</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
