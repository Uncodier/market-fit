const fs = require('fs');
const path = './app/context/locales/es.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

data['common.search'] = 'Search';
data['common.status'] = 'Status';
data['leads.tabs.all'] = 'All Companies';
data['leads.tabs.new'] = 'New';
data['leads.tabs.contacted'] = 'Contacted';
data['leads.tabs.qualified'] = 'Qualified';
data['leads.tabs.cold'] = 'Cold';
data['leads.tabs.converted'] = 'Converted';
data['leads.tabs.lost'] = 'Lost';
data['leads.tabs.notQualified'] = 'Not Qualified';
data['leads.sort.newest'] = 'Newest';
data['leads.sort.oldest'] = 'Oldest';
data['leads.filters.clear'] = 'Clear filters';
data['leads.sortBy'] = 'Sort by';

fs.writeFileSync(path, JSON.stringify(data, null, 2));
