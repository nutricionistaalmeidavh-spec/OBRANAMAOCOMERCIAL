// Pure comparator shared by the storefront and its regression tests.
// Items without published offers always sort after purchasable items.
export function canonicalPriceCents(item, offers, offerKey) {
 const value=offers.get(offerKey(item.title))?.priceCents;
 return Number.isSafeInteger(value)&&value>0?value:null;
}
export function compareCanonicalPrice(a,b,direction,offers,offerKey){
 const pa=canonicalPriceCents(a,offers,offerKey);
 const pb=canonicalPriceCents(b,offers,offerKey);
 if(pa===null||pb===null)return (pa===null?1:0)-(pb===null?1:0)||a.id.localeCompare(b.id);
 return direction*(pa-pb)||a.id.localeCompare(b.id);
}
