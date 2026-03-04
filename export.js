function export_prom_yml()
{
  const nd_root = XmlService.getNamespace('g', 'http://base.google.com/ns/1.0');

  // Create elements in the namespace if needed
  const nd_shop = XmlService.createElement('shop', nd_root);
  const nd_categories = XmlService.createElement('categories', nd_root);
  const nd_offers = XmlService.createElement('offers', nd_root);
  
  // Build the document
  nd_shop.addContent(nd_categories);
  {
    const root_category = XmlService.createElement('category', nd_root)
                            .setAttribute('id', 0);
    nd_categories.addContent(root_category);
  }

  nd_shop.addContent(nd_offers); // add offers under shop

  const items = get_all_items_v2();

  items.forEach(offer => {
    if (offer.export_rules == null) {
      return;
    }

    const root = XmlService.parse(offer.export_rules).getRootElement();
    const ns = root.getNamespace();

    const prom = root.getChild("Prom", ns);
    if (!prom) throw new Error("Prom element not found");

    const src_offer = prom.getChild("offer", ns);
    if (!src_offer) throw new Error("offer element not found");

    if (src_offer){
      nd_offers.addContent(cloneXmlElement(src_offer));
    }
  });
  
  const doc = XmlService.createDocument(nd_shop);

  // Convert to string
  const xmlString = XmlService.getPrettyFormat().format(doc);

  //console.log(xmlString);

  uploadToS3(xmlString, 'prom.xml');

  writeRange(
  "Dashboard",
  [["Export", "Prom"],
   [getTimestamp(), 'https://idoo-public.s3.eu-central-1.amazonaws.com/prom.xml']],
  1,1,
  [
    ["#000000", "#000000"],
    ["#000000", "#000000"]
  ],
  [
    ["#00ff00", "#00ff00"],
    ["#00ff00", "#00ff00"]
  ]
);
}

