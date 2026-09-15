const domain = "mail.makinari.com";
const zones = [{ name: "makinari.com" }, { name: "other.com" }];

const matchingZones = zones.filter(z => 
  domain === z.name || domain.endsWith('.' + z.name)
);
console.log(matchingZones);
