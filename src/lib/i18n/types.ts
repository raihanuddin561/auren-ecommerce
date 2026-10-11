export type Locale = 'en' | 'bn';

export interface TranslationDictionary {
  locale: Locale;
  common: {
    loading: string;
    viewAll: string;
    explore: string;
    back: string;
    continue: string;
    save: string;
    saved: string;
    cancel: string;
    close: string;
    copy: string;
    copied: string;
  };
  nav: {
    shop: string;
    newArrivals: string;
    collections: string;
    lookbook: string;
    journal: string;
    atelier: string;
    clothing: string;
    shirts: string;
    trousers: string;
    tailoring: string;
    panjabi: string;
    accessories: string;
    discover: string;
    shopAll: string;
    winterLayers: string;
    summerEdit: string;
    tailoringForOccasions: string;
  };
  header: {
    search: string;
    searchPlaceholder: string;
    account: string;
    wishlist: string;
    bag: string;
    menu: string;
    language: string;
  };
  announcements: [string, string, string];
  product: {
    addToBag: string;
    addedToBag: string;
    selectSize: string;
    sizeGuide: string;
    inStock: string;
    outOfStock: string;
    deliveryNotice: string;
    codAvailable: string;
    details: string;
    fabric: string;
    craftsmanship: string;
    care: string;
    reviews: string;
    price: string;
  };
  cart: {
    yourBag: string;
    emptyBagTitle: string;
    emptyBagDesc: string;
    startShopping: string;
    subtotal: string;
    vat: string;
    shipping: string;
    free: string;
    total: string;
    checkout: string;
    remove: string;
    quantity: string;
  };
  footer: {
    earlyAccess: string;
    newsletterTitle: string;
    newsletterDesc: string;
    emailPlaceholder: string;
    subscribe: string;
    subscribedSuccess: string;
    clientCare: string;
    trackOrder: string;
    shippingDelivery: string;
    returnsExchanges: string;
    faq: string;
    contactConcierge: string;
    theHouse: string;
    aboutAuren: string;
    atelierCraft: string;
    naturalFibers: string;
    seasonalLookbooks: string;
    theJournal: string;
    tagline: string;
    location: string;
    rightsReserved: string;
  };
  notFound: {
    title: string;
    message: string;
    button: string;
  };
}
