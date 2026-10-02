import { Info } from 'lucide-react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button, IconButton } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip } from '@/components/ui/tooltip';
import { GuideGroup, GuideSection } from './guide-section';
import { ToastDemo } from './toast-demo';

export function OverlaysSection() {
  return (
    <GuideSection
      id="overlays"
      title="Overlays"
      description="Dialogs, drawers, popovers and tooltips trap or restore focus, close on Escape and name themselves for assistive tech."
    >
      <GuideGroup label="Open each one">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="secondary">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove this piece from your bag?</DialogTitle>
              <DialogDescription>
                You can add it back at any time while it is in stock.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Keep it</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button>Remove</Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open drawer (right)</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>Your bag</SheetTitle>
              <SheetDescription>Complimentary delivery over ৳5,000.</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <p className="type-body text-fg-muted">Your bag is empty.</p>
            </SheetBody>
            <SheetFooter>
              <Button fullWidth size="lg">
                Continue shopping
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="secondary">Open drawer (bottom)</Button>
          </SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader>
              <SheetTitle>Size guide</SheetTitle>
              <SheetDescription>Model is 183 cm and wears M.</SheetDescription>
            </SheetHeader>
            <SheetBody>
              <p className="type-body text-fg-muted">Measurements in centimetres.</p>
            </SheetBody>
          </SheetContent>
        </Sheet>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="secondary">Open popover</Button>
          </PopoverTrigger>
          <PopoverContent>
            <p className="type-small font-medium text-fg">Delivery estimate</p>
            <p className="mt-1 type-small text-fg-muted">Dhaka: 1 to 2 working days.</p>
          </PopoverContent>
        </Popover>

        <Tooltip content="Fits true to size">
          <IconButton aria-label="About the fit" variant="secondary">
            <Icon icon={Info} />
          </IconButton>
        </Tooltip>
      </GuideGroup>

      <GuideGroup label="Accordion" className="block">
        <Accordion type="single" collapsible defaultValue="details" className="max-w-2xl">
          <AccordionItem value="details">
            <AccordionTrigger>Details and fit</AccordionTrigger>
            <AccordionContent>Regular fit. Model is 183 cm and wears size M.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="fabric">
            <AccordionTrigger>Fabric and care</AccordionTrigger>
            <AccordionContent>100% Egyptian cotton. Machine wash cold.</AccordionContent>
          </AccordionItem>
          <AccordionItem value="delivery">
            <AccordionTrigger>Delivery and returns</AccordionTrigger>
            <AccordionContent>Easy size exchange within seven days.</AccordionContent>
          </AccordionItem>
        </Accordion>
      </GuideGroup>

      <GuideGroup label="Tabs" className="block">
        <Tabs defaultValue="description" className="max-w-2xl">
          <TabsList aria-label="Product information">
            <TabsTrigger value="description">Description</TabsTrigger>
            <TabsTrigger value="reviews">Reviews</TabsTrigger>
            <TabsTrigger value="care">Care</TabsTrigger>
            <TabsTrigger value="disabled" disabled>
              Disabled
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description">
            <p className="type-body text-fg-muted">
              A softly structured collar and a clean placket.
            </p>
          </TabsContent>
          <TabsContent value="reviews">
            <p className="type-body text-fg-muted">Reviews appear here.</p>
          </TabsContent>
          <TabsContent value="care">
            <p className="type-body text-fg-muted">Machine wash cold, warm iron.</p>
          </TabsContent>
        </Tabs>
      </GuideGroup>

      <GuideGroup label="Toast">
        <ToastDemo />
      </GuideGroup>
    </GuideSection>
  );
}
