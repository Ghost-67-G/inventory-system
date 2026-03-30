export type ProductTemplate = {
  name: string;
  skuPrefix: string;
  categoryName: string;
  unit: string;
  costPrice: number;
  sellingPrice: number;
  threshold: number;
  tags: string[];
};

export const PRODUCT_TEMPLATES: ProductTemplate[] = [
  { name: 'iPhone 15 Pro 256GB', skuPrefix: 'APL', categoryName: 'Smartphones', unit: 'pcs', costPrice: 850, sellingPrice: 1099, threshold: 5, tags: ['apple', 'iphone', '5g'] },
  { name: 'Samsung Galaxy S24 Ultra', skuPrefix: 'SAM', categoryName: 'Smartphones', unit: 'pcs', costPrice: 780, sellingPrice: 999, threshold: 5, tags: ['samsung', 'android', '5g'] },
  { name: 'Google Pixel 8 Pro', skuPrefix: 'GGL', categoryName: 'Smartphones', unit: 'pcs', costPrice: 620, sellingPrice: 799, threshold: 5, tags: ['google', 'pixel', 'android'] },
  { name: 'OnePlus 12 5G', skuPrefix: 'OPL', categoryName: 'Smartphones', unit: 'pcs', costPrice: 480, sellingPrice: 649, threshold: 5, tags: ['oneplus', 'android'] },
  { name: 'Motorola Edge 40 Pro', skuPrefix: 'MOT', categoryName: 'Smartphones', unit: 'pcs', costPrice: 340, sellingPrice: 449, threshold: 8, tags: ['motorola', 'android'] },
  { name: 'iPhone 15 Screen Protector', skuPrefix: 'SPR', categoryName: 'Smartphones', unit: 'pcs', costPrice: 4, sellingPrice: 14.99, threshold: 50, tags: ['accessory', 'screen'] },

  { name: 'MacBook Pro 14" M3', skuPrefix: 'MBP', categoryName: 'Laptops', unit: 'pcs', costPrice: 1450, sellingPrice: 1799, threshold: 3, tags: ['apple', 'macbook', 'm3'] },
  { name: 'Dell XPS 15 OLED', skuPrefix: 'DXP', categoryName: 'Laptops', unit: 'pcs', costPrice: 1100, sellingPrice: 1399, threshold: 3, tags: ['dell', 'xps', 'oled'] },
  { name: 'Lenovo ThinkPad X1 Carbon', skuPrefix: 'LTP', categoryName: 'Laptops', unit: 'pcs', costPrice: 990, sellingPrice: 1249, threshold: 3, tags: ['lenovo', 'thinkpad', 'business'] },
  { name: 'ASUS ROG Strix G16', skuPrefix: 'ARG', categoryName: 'Laptops', unit: 'pcs', costPrice: 1200, sellingPrice: 1549, threshold: 3, tags: ['asus', 'gaming', 'rog'] },
  { name: 'HP Pavilion 15 Ryzen 7', skuPrefix: 'HPV', categoryName: 'Laptops', unit: 'pcs', costPrice: 550, sellingPrice: 699, threshold: 5, tags: ['hp', 'amd', 'budget'] },
  { name: 'Laptop Cooling Pad', skuPrefix: 'LCP', categoryName: 'Laptops', unit: 'pcs', costPrice: 18, sellingPrice: 39.99, threshold: 20, tags: ['accessory', 'cooling'] },

  { name: 'Sony WH-1000XM5', skuPrefix: 'SNY', categoryName: 'Audio', unit: 'pcs', costPrice: 240, sellingPrice: 349, threshold: 10, tags: ['sony', 'anc', 'wireless'] },
  { name: 'Apple AirPods Pro 2nd Gen', skuPrefix: 'APP', categoryName: 'Audio', unit: 'pcs', costPrice: 180, sellingPrice: 249, threshold: 10, tags: ['apple', 'airpods', 'anc'] },
  { name: 'Bose QuietComfort 45', skuPrefix: 'BQC', categoryName: 'Audio', unit: 'pcs', costPrice: 220, sellingPrice: 299, threshold: 8, tags: ['bose', 'anc', 'wireless'] },
  { name: 'JBL Charge 5 Speaker', skuPrefix: 'JBL', categoryName: 'Audio', unit: 'pcs', costPrice: 110, sellingPrice: 159, threshold: 15, tags: ['jbl', 'bluetooth', 'portable'] },
  { name: 'Sennheiser HD 560S', skuPrefix: 'SHD', categoryName: 'Audio', unit: 'pcs', costPrice: 130, sellingPrice: 179, threshold: 10, tags: ['sennheiser', 'wired', 'audiophile'] },
  { name: 'USB-C Audio Adapter', skuPrefix: 'UAD', categoryName: 'Audio', unit: 'pcs', costPrice: 6, sellingPrice: 15.99, threshold: 40, tags: ['adapter', 'usbc'] },

  { name: 'USB-C to USB-C Cable 2m', skuPrefix: 'UCC', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 3.5, sellingPrice: 12.99, threshold: 100, tags: ['usbc', 'cable', '2m'] },
  { name: 'HDMI 2.1 Cable 3m', skuPrefix: 'HDM', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 8, sellingPrice: 24.99, threshold: 50, tags: ['hdmi', '4k', 'cable'] },
  { name: 'Lightning to USB-C Cable', skuPrefix: 'LTC', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 5, sellingPrice: 18.99, threshold: 80, tags: ['lightning', 'apple', 'cable'] },
  { name: 'USB-C Hub 7-in-1', skuPrefix: 'UCH', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 22, sellingPrice: 49.99, threshold: 30, tags: ['hub', 'usbc', 'multiport'] },
  { name: 'DisplayPort to HDMI Adapter', skuPrefix: 'DPA', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 9, sellingPrice: 22.99, threshold: 30, tags: ['displayport', 'hdmi', 'adapter'] },
  { name: 'Thunderbolt 4 Cable 1m', skuPrefix: 'TB4', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 28, sellingPrice: 59.99, threshold: 20, tags: ['thunderbolt', 'usbc', 'fast'] },
  { name: 'USB-A to Micro USB Cable', skuPrefix: 'UMU', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 1.5, sellingPrice: 7.99, threshold: 100, tags: ['microusb', 'legacy', 'cable'] },
  { name: 'HDMI Splitter 1x4', skuPrefix: 'HDS', categoryName: 'Cables & Adapters', unit: 'pcs', costPrice: 16, sellingPrice: 35.99, threshold: 20, tags: ['hdmi', 'splitter'] },

  { name: 'Anker PowerCore 26800mAh', skuPrefix: 'APB', categoryName: 'Batteries', unit: 'pcs', costPrice: 38, sellingPrice: 69.99, threshold: 20, tags: ['anker', 'powerbank', '26800'] },
  { name: 'Duracell AA 24-Pack', skuPrefix: 'DAA', categoryName: 'Batteries', unit: 'pack', costPrice: 8.5, sellingPrice: 18.99, threshold: 50, tags: ['duracell', 'aa', 'alkaline'] },
  { name: 'Duracell AAA 16-Pack', skuPrefix: 'DAB', categoryName: 'Batteries', unit: 'pack', costPrice: 7, sellingPrice: 16.99, threshold: 50, tags: ['duracell', 'aaa', 'alkaline'] },
  { name: 'Energizer 9V 4-Pack', skuPrefix: 'E9V', categoryName: 'Batteries', unit: 'pack', costPrice: 9, sellingPrice: 19.99, threshold: 30, tags: ['energizer', '9v'] },
  { name: 'Laptop Replacement Battery', skuPrefix: 'LRB', categoryName: 'Batteries', unit: 'pcs', costPrice: 45, sellingPrice: 89.99, threshold: 10, tags: ['laptop', 'battery', 'replacement'] },

  { name: 'LG 27" 4K IPS Monitor', skuPrefix: 'LGM', categoryName: 'Monitors', unit: 'pcs', costPrice: 280, sellingPrice: 399, threshold: 5, tags: ['lg', '4k', 'ips', '27inch'] },
  { name: 'Samsung 32" Curved VA', skuPrefix: 'SCM', categoryName: 'Monitors', unit: 'pcs', costPrice: 240, sellingPrice: 329, threshold: 5, tags: ['samsung', 'curved', '32inch'] },
  { name: 'ASUS 24" 144Hz Gaming', skuPrefix: 'AGM', categoryName: 'Monitors', unit: 'pcs', costPrice: 180, sellingPrice: 249, threshold: 5, tags: ['asus', '144hz', 'gaming'] },
  { name: 'Dell 27" USB-C Monitor', skuPrefix: 'DCM', categoryName: 'Monitors', unit: 'pcs', costPrice: 350, sellingPrice: 479, threshold: 3, tags: ['dell', 'usbc', '27inch'] },
  { name: 'Monitor Stand Arm', skuPrefix: 'MSA', categoryName: 'Monitors', unit: 'pcs', costPrice: 35, sellingPrice: 69.99, threshold: 15, tags: ['stand', 'ergonomic', 'vesa'] },

  { name: 'Logitech MX Keys Advanced', skuPrefix: 'LMX', categoryName: 'Keyboards & Mice', unit: 'pcs', costPrice: 70, sellingPrice: 109, threshold: 15, tags: ['logitech', 'keyboard', 'wireless'] },
  { name: 'Apple Magic Keyboard', skuPrefix: 'AMK', categoryName: 'Keyboards & Mice', unit: 'pcs', costPrice: 85, sellingPrice: 129, threshold: 10, tags: ['apple', 'keyboard', 'usbc'] },
  { name: 'Logitech MX Master 3S', skuPrefix: 'LMS', categoryName: 'Keyboards & Mice', unit: 'pcs', costPrice: 75, sellingPrice: 99, threshold: 15, tags: ['logitech', 'mouse', 'wireless'] },
  { name: 'Razer BlackWidow V4', skuPrefix: 'RBW', categoryName: 'Keyboards & Mice', unit: 'pcs', costPrice: 90, sellingPrice: 139, threshold: 10, tags: ['razer', 'mechanical', 'gaming'] },
  { name: 'Mouse Pad XL', skuPrefix: 'MPX', categoryName: 'Keyboards & Mice', unit: 'pcs', costPrice: 8, sellingPrice: 19.99, threshold: 30, tags: ['mousepad', 'xl', 'desk'] },

  { name: 'Samsung 1TB NVMe SSD', skuPrefix: 'SNV', categoryName: 'Storage', unit: 'pcs', costPrice: 65, sellingPrice: 99, threshold: 20, tags: ['samsung', 'nvme', '1tb'] },
  { name: 'WD Blue 2TB HDD', skuPrefix: 'WDH', categoryName: 'Storage', unit: 'pcs', costPrice: 42, sellingPrice: 69, threshold: 15, tags: ['wd', 'hdd', '2tb'] },
  { name: 'SanDisk 256GB USB 3.2', skuPrefix: 'SDU', categoryName: 'Storage', unit: 'pcs', costPrice: 14, sellingPrice: 29.99, threshold: 40, tags: ['sandisk', 'usb', '256gb'] },
  { name: 'Samsung T7 1TB Portable SSD', skuPrefix: 'ST7', categoryName: 'Storage', unit: 'pcs', costPrice: 70, sellingPrice: 109, threshold: 15, tags: ['samsung', 'portable', 'ssd'] },
  { name: 'Seagate 4TB Backup Plus', skuPrefix: 'SGT', categoryName: 'Storage', unit: 'pcs', costPrice: 75, sellingPrice: 109, threshold: 10, tags: ['seagate', '4tb', 'external'] },
  { name: 'microSD 128GB Class 10', skuPrefix: 'MSD', categoryName: 'Storage', unit: 'pcs', costPrice: 9, sellingPrice: 19.99, threshold: 50, tags: ['microsd', '128gb', 'class10'] },

  { name: 'TP-Link AX3000 WiFi 6 Router', skuPrefix: 'TPR', categoryName: 'Networking', unit: 'pcs', costPrice: 75, sellingPrice: 119, threshold: 8, tags: ['tplink', 'wifi6', 'router'] },
  { name: 'Netgear 8-Port Gigabit Switch', skuPrefix: 'NGS', categoryName: 'Networking', unit: 'pcs', costPrice: 35, sellingPrice: 59, threshold: 10, tags: ['netgear', 'switch', 'gigabit'] },
  { name: 'Cat6 Ethernet Cable 10m', skuPrefix: 'CAT', categoryName: 'Networking', unit: 'pcs', costPrice: 5, sellingPrice: 13.99, threshold: 50, tags: ['cat6', 'ethernet', '10m'] },
  { name: 'WiFi Range Extender', skuPrefix: 'WRE', categoryName: 'Networking', unit: 'pcs', costPrice: 22, sellingPrice: 39.99, threshold: 15, tags: ['extender', 'wifi', 'repeater'] },
  { name: 'Raspberry Pi 4 Model B 8GB', skuPrefix: 'RPI', categoryName: 'Networking', unit: 'pcs', costPrice: 62, sellingPrice: 89, threshold: 5, tags: ['raspberry', 'pi', 'sbc'] },

  { name: 'Anker 65W GaN Charger', skuPrefix: 'AGC', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 22, sellingPrice: 44.99, threshold: 30, tags: ['anker', 'gan', '65w', 'usbc'] },
  { name: 'Apple 20W USB-C Adapter', skuPrefix: 'ACA', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 12, sellingPrice: 24.99, threshold: 40, tags: ['apple', '20w', 'usbc'] },
  { name: 'Belkin 10000mAh Power Bank', skuPrefix: 'BPB', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 28, sellingPrice: 54.99, threshold: 20, tags: ['belkin', 'powerbank', '10000'] },
  { name: 'APC 650VA UPS', skuPrefix: 'APC', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 65, sellingPrice: 99, threshold: 5, tags: ['apc', 'ups', '650va'] },
  { name: 'Surge Protector 6-Outlet', skuPrefix: 'SRG', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 14, sellingPrice: 29.99, threshold: 25, tags: ['surge', '6outlet', 'power'] },
  { name: 'Wireless Charging Pad 15W', skuPrefix: 'WCP', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 12, sellingPrice: 27.99, threshold: 30, tags: ['wireless', 'qi', '15w'] },
  { name: 'Solar Power Bank 20000mAh', skuPrefix: 'SPK', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 32, sellingPrice: 64.99, threshold: 15, tags: ['solar', 'powerbank', 'outdoor'] },
  { name: 'Car Charger Dual USB-C 45W', skuPrefix: 'CCC', categoryName: 'Power & Charging', unit: 'pcs', costPrice: 11, sellingPrice: 24.99, threshold: 30, tags: ['car', 'charger', 'dual'] },
];
