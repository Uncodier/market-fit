export interface ICPProfileData {
  id: string;
  name: string;
  description: string;
  demographics: {
    ageRange?: {
      primary?: string;
      secondary?: string;
    };
    gender?: {
      distribution?: string;
    };
    locations?: Array<{
      type: string;
      name: string;
      relevance: string;
    }>;
    education?: {
      primary?: string;
      secondary?: string[] | string;
    };
    income?: {
      currency?: string;
      level?: string;
      range?: string;
    };
    languages?: Array<{
      name: string;
      proficiency: string;
      relevance: string;
    }>;
  };
}

export interface DemographicsTabProps {
  icpProfile: ICPProfileData | null;
}

// Función para extraer el rango numérico del texto
export const extractAgeRange = (rangeStr: string): [number, number] => {
  const match = rangeStr.match(/(\d+)-(\d+)/);
  if (match) {
    return [parseInt(match[1]), parseInt(match[2])];
  }
  return [0, 100]; // Valor por defecto
};

// Función para determinar el nivel de educación
export const getEducationLevel = (education: string): number => {
  const levels: Record<string, number> = {
    "High School": 1,
    "Associate's Degree": 2,
    "Bachelor's Degree": 3,
    "Master's Degree": 4,
    "Doctorate": 5,
    "Professional Degree": 5
  };
  
  return levels[education] || 0;
};

// Función para determinar el valor en el slider de ingresos
export const getIncomeSliderValue = (level: string): number => {
  const levels: Record<string, number> = {
    "Very Low": 10,
    "Low": 25,
    "Medium-Low": 40,
    "Medium": 50,
    "Medium-High": 65,
    "High": 80,
    "Very High": 95
  };
  
  return levels[level] || 50;
};

// Función para obtener coordenadas basadas en la región
export const getLocationCoordinates = (locationName: string): [number, number] => {
  // Normalizar el nombre de la ubicación
  const normalizedLocationName = locationName.toLowerCase().trim();
  
  const coordinatesMap: Record<string, [number, number]> = {
    // Regiones principales
    "north america": [-95.7129, 37.0902],
    "south america": [-58.3816, -23.4425],
    "latin america": [-66.1936, 7.1367],
    "europe": [9.1405, 48.6908],
    "asia": [103.8198, 36.5617],
    "oceania": [134.7751, -25.2744],
    "africa": [19.4902, 8.7832],
    "middle east": [53.4949, 24.4667],
    
    // Países de América del Norte
    "united states": [-95.7129, 37.0902],
    "usa": [-95.7129, 37.0902],
    "united states of america": [-95.7129, 37.0902],
    "canada": [-106.3468, 56.1304],
    "mexico": [-102.5528, 23.6345],
    "guatemala": [-90.2308, 15.7835],
    "cuba": [-77.7812, 21.5218],
    "jamaica": [-77.2975, 18.1096],
    
    // Países de América del Sur
    "brazil": [-51.9253, -14.2350],
    "argentina": [-63.6167, -38.4161],
    "colombia": [-74.2973, 4.5709],
    "chile": [-71.5430, -35.6751],
    "peru": [-75.0152, -9.1900],
    "venezuela": [-66.5897, 6.4238],
    "ecuador": [-78.1834, -1.8312],
    "bolivia": [-63.5887, -16.2902],
    
    // Países de Europa
    "united kingdom": [-3.4359, 55.3781],
    "uk": [-3.4359, 55.3781],
    "germany": [10.4515, 51.1657],
    "france": [2.2137, 46.2276],
    "spain": [-3.7492, 40.4637],
    "italy": [12.5674, 41.8719],
    "russia": [105.3188, 61.5240],
    "ukraine": [31.1656, 48.3794],
    "poland": [19.1451, 51.9194],
    
    // Países de Asia
    "china": [104.1954, 35.8617],
    "japan": [138.2529, 36.2048],
    "india": [78.9629, 20.5937],
    "south korea": [127.7669, 35.9078],
    "indonesia": [113.9213, -0.7893],
    "vietnam": [108.2772, 14.0583],
    "thailand": [100.9925, 15.8700],
    
    // Países de Oceanía
    "australia": [133.7751, -25.2744],
    "new zealand": [174.8860, -40.9006],
    
    // Países de África
    "south africa": [22.9375, -30.5595],
    "nigeria": [8.6753, 9.0820],
    "egypt": [30.8025, 26.8206],
    "kenya": [37.9062, -0.0236],
    "morocco": [-7.0926, 31.7917],
    
    // Países de Oriente Medio
    "saudi arabia": [45.0792, 23.8859],
    "uae": [53.8478, 23.4241],
    "united arab emirates": [53.8478, 23.4241],
    "israel": [34.8516, 31.0461],
    "turkey": [35.2433, 38.9637],
    "iran": [53.6880, 32.4279]
  };
  
  // Buscar coincidencias exactas primero
  for (const [region, coords] of Object.entries(coordinatesMap)) {
    if (normalizedLocationName === region) {
      return coords;
    }
  }
  
  // Luego buscar coincidencias parciales
  for (const [region, coords] of Object.entries(coordinatesMap)) {
    if (normalizedLocationName.includes(region) || region.includes(normalizedLocationName)) {
      return coords;
    }
  }
  
  return [0, 0]; // Coordenadas predeterminadas si no se encuentra coincidencia
};

// Función para obtener color basado en la relevancia
export const getRelevanceColor = (relevance: string): string => {
  if (relevance.toLowerCase().includes('very high')) {
    return "#4338ca"; // Indigo-700
  } else if (relevance.toLowerCase().includes('high')) {
    return "#6366f1"; // Indigo-500
  } else if (relevance.toLowerCase().includes('medium-high')) {
    return "#8b5cf6"; // Violet-500
  } else if (relevance.toLowerCase().includes('medium')) {
    return "#a78bfa"; // Violet-400
  } else {
    return "#c4b5fd"; // Violet-300
  }
};

// Función para obtener valor numérico basado en la relevancia (para el tamaño del marcador)
export const getRelevanceValue = (relevance: string): number => {
  if (relevance.toLowerCase().includes('very high')) {
    return 65;
  } else if (relevance.toLowerCase().includes('high')) {
    return 45;
  } else if (relevance.toLowerCase().includes('medium-high')) {
    return 30;
  } else if (relevance.toLowerCase().includes('medium')) {
    return 20;
  } else {
    return 15;
  }
};

// Función para obtener opacidad basada en la relevancia
export const getRelevanceOpacity = (relevance: string): number => {
  if (relevance.toLowerCase().includes('very high')) {
    return 0.8;
  } else if (relevance.toLowerCase().includes('high')) {
    return 0.65;
  } else if (relevance.toLowerCase().includes('medium-high')) {
    return 0.5;
  } else if (relevance.toLowerCase().includes('medium')) {
    return 0.4;
  } else {
    return 0.3;
  }
};

// Función para verificar si un país/región pertenece a una región más grande
export const isCountryInRegion = (countryName: string, regionName: string): boolean => {
  // Verificar que ambos parámetros son strings válidos
  if (!countryName || !regionName) return false;
  
  // Normalizar los nombres para comparación
  const normalizedCountryName = countryName.toLowerCase().trim();
  const normalizedRegionName = regionName.toLowerCase().trim();
  
  // Si el país y la región son iguales o similares, devolver true
  if (normalizedCountryName === normalizedRegionName || 
      normalizedCountryName.includes(normalizedRegionName) || 
      normalizedRegionName.includes(normalizedCountryName)) {
    return true;
  }
  
  const regionMapping: Record<string, string[]> = {
    "north america": [
      "united states", "canada", "mexico", "usa", "u.s.a", "us", "north america",
      "united states of america", "greenland", "guatemala", "cuba", "haiti", "dominican rep.", "jamaica", 
      "bahamas", "belize", "costa rica", "panama", "honduras", "el salvador", "nicaragua", "puerto rico"
    ],
    "south america": [
      "brazil", "argentina", "colombia", "chile", "peru", "venezuela", "south america",
      "ecuador", "bolivia", "paraguay", "uruguay", "guyana", "suriname", "french guiana", "falkland is."
    ],
    "latin america": [
      "mexico", "brazil", "argentina", "colombia", "chile", "peru", "venezuela", "latin america",
      "ecuador", "bolivia", "paraguay", "uruguay", "guyana", "suriname", "french guiana",
      "guatemala", "cuba", "haiti", "dominican rep.", "jamaica", "bahamas", "belize", 
      "costa rica", "panama", "honduras", "el salvador", "nicaragua", "puerto rico"
    ],
    "europe": [
      "united kingdom", "germany", "france", "italy", "spain", "uk", "great britain", "europe",
      "portugal", "ireland", "switzerland", "austria", "belgium", "netherlands", "denmark", 
      "norway", "sweden", "finland", "iceland", "poland", "ukraine", "belarus", "czechia", 
      "slovakia", "hungary", "romania", "bulgaria", "serbia", "croatia", "slovenia", 
      "bosnia and herz.", "montenegro", "albania", "greece", "macedonia", "estonia", 
      "latvia", "lithuania", "moldova", "cyprus", "luxembourg", "malta"
    ],
    "asia": [
      "china", "japan", "india", "south korea", "indonesia", "asia",
      "russia", "kazakhstan", "mongolia", "north korea", "vietnam", "laos", "cambodia", 
      "thailand", "myanmar", "malaysia", "philippines", "taiwan", "bangladesh", "bhutan", 
      "nepal", "pakistan", "afghanistan", "tajikistan", "kyrgyzstan", "uzbekistan", 
      "turkmenistan", "sri lanka", "brunei", "timor-leste", "singapore"
    ],
    "oceania": [
      "australia", "new zealand", "oceania", "papua new guinea", "solomon is.", 
      "fiji", "vanuatu", "new caledonia"
    ],
    "africa": [
      "south africa", "nigeria", "egypt", "kenya", "africa", "morocco", "algeria", 
      "tunisia", "libya", "sudan", "south sudan", "ethiopia", "somalia", "djibouti", 
      "eritrea", "uganda", "rwanda", "burundi", "tanzania", "kenya", "mozambique", 
      "zimbabwe", "zambia", "malawi", "botswana", "namibia", "angola", "congo", 
      "dem. rep. congo", "central african rep.", "cameroon", "gabon", "eq. guinea", 
      "ivory coast", "côte d'ivoire", "liberia", "sierra leone", "guinea", "guinea-bissau", 
      "senegal", "gambia", "mali", "burkina faso", "ghana", "togo", "benin", "niger", 
      "chad", "mauritania", "western sahara", "w. sahara", "lesotho", "eswatini"
    ],
    "middle east": [
      "saudi arabia", "uae", "israel", "turkey", "middle east", "iran", "iraq", "syria", 
      "lebanon", "jordan", "kuwait", "bahrain", "qatar", "oman", "yemen", "united arab emirates", 
      "palestine", "azerbaijan", "armenia", "georgia"
    ]
  };

  // Verificar si el país está en la lista de la región
  const countries = regionMapping[normalizedRegionName] || [];
  return countries.some(country => {
    return normalizedCountryName.includes(country) || country.includes(normalizedCountryName);
  });
};

