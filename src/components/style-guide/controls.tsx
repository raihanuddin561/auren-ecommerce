import { ArrowRight, Heart, Search } from 'lucide-react';
import { Button, IconButton } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { GuideGroup, GuideSection, Specimen } from './guide-section';

const VARIANTS = ['primary', 'secondary', 'ghost', 'link', 'danger'] as const;

export function ButtonsSection() {
  return (
    <GuideSection
      id="buttons"
      title="Buttons"
      description="Ink primary for the one main action, outline for secondary, gold-underlined link for quiet actions."
    >
      <GuideGroup label="Variants">
        {VARIANTS.map((variant) => (
          <Button key={variant} variant={variant}>
            {variant === 'link' ? 'Read the story' : `Add to bag`}
          </Button>
        ))}
      </GuideGroup>

      <GuideGroup label="Sizes">
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
        <IconButton aria-label="Search" variant="secondary">
          <Icon icon={Search} />
        </IconButton>
        <IconButton aria-label="Add to wishlist">
          <Icon icon={Heart} />
        </IconButton>
      </GuideGroup>

      <GuideGroup label="States">
        <Specimen label="Default">
          <Button>Checkout</Button>
        </Specimen>
        <Specimen label="Focus ring (2px gold, 2px offset)">
          <Button className="outline-2 outline-offset-2 outline-gold">Checkout</Button>
        </Specimen>
        <Specimen label="Loading">
          <Button loading>Placing order</Button>
        </Specimen>
        <Specimen label="Disabled">
          <Button disabled>Checkout</Button>
        </Specimen>
        <Specimen label="Secondary disabled">
          <Button variant="secondary" disabled>
            Checkout
          </Button>
        </Specimen>
        <Specimen label="With icon">
          <Button>
            Continue
            <Icon icon={ArrowRight} size={16} />
          </Button>
        </Specimen>
      </GuideGroup>

      <GuideGroup label="Full width (mobile checkout)">
        <div className="w-full max-w-sm">
          <Button fullWidth size="lg">
            Place order
          </Button>
        </div>
      </GuideGroup>
    </GuideSection>
  );
}

export function FormsSection() {
  return (
    <GuideSection
      id="forms"
      title="Form controls"
      description="Visible labels, hints and errors wired to the control. Errors are announced and never rely on colour alone."
    >
      <GuideGroup label="Text input states" className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <FormField label="Full name" hint="As it appears on your delivery">
          {(control) => <Input {...control} placeholder="Ayaan Rahman" />}
        </FormField>
        <FormField label="Mobile number" error="Enter a mobile number, for example 01712 345678">
          {(control) => <Input {...control} defaultValue="017" />}
        </FormField>
        <FormField label="Email" disabled hint="Not editable">
          {(control) => <Input {...control} defaultValue="ayaan@example.com" />}
        </FormField>
        <FormField label="Order reference" required>
          {(control) => <Input {...control} defaultValue="AU-10482" readOnly />}
        </FormField>
        <FormField label="Search" hideLabel>
          {(control) => <Input {...control} type="search" placeholder="Search the collection" />}
        </FormField>
      </GuideGroup>

      <GuideGroup label="Textarea and select" className="grid gap-6 md:grid-cols-2">
        <FormField label="Delivery note" hint="Optional">
          {(control) => <Textarea {...control} placeholder="Landmark, floor, gate code" />}
        </FormField>
        <FormField label="Division">
          {(control) => (
            <Select defaultValue="dhaka">
              <SelectTrigger id={control.id} aria-describedby={control['aria-describedby']}>
                <SelectValue placeholder="Choose a division" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dhaka">Dhaka</SelectItem>
                <SelectItem value="chattogram">Chattogram</SelectItem>
                <SelectItem value="sylhet">Sylhet</SelectItem>
                <SelectItem value="rajshahi">Rajshahi</SelectItem>
              </SelectContent>
            </Select>
          )}
        </FormField>
      </GuideGroup>

      <GuideGroup label="Checkbox, radio and switch" className="gap-10">
        <div>
          <Checkbox label="Remember my details" defaultChecked />
          <Checkbox label="Receive early access to new collections" />
          <Checkbox label="Gift wrap" description="Hand-wrapped with a handwritten card" />
          <Checkbox label="Indeterminate" checked="indeterminate" />
          <Checkbox label="Disabled" disabled />
          <Checkbox label="Invalid choice" invalid />
        </div>
        <RadioGroup defaultValue="cod" aria-label="Payment method">
          <RadioItem value="cod" label="Cash on delivery" description="Pay when it arrives" />
          <RadioItem value="bkash" label="bKash" />
          <RadioItem value="card" label="Card" />
          <RadioItem value="soon" label="Unavailable" disabled />
        </RadioGroup>
        <div>
          <Switch label="Show low stock warnings" defaultChecked />
          <Switch label="Weekly summary email" />
          <Switch label="Disabled" disabled />
        </div>
      </GuideGroup>
    </GuideSection>
  );
}
