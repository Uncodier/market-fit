import type { MarketingChannel } from "./form-schema"

// Convert any existing marketing channels data to the correct format
export const formatMarketingChannels = (channels: any[]): MarketingChannel[] => {
  if (!channels || !Array.isArray(channels)) return [];
  
  return channels.map(channel => {
    if (typeof channel === 'string') {
      return { name: channel };
    } else if (typeof channel === 'object' && channel !== null) {
      return { 
        name: channel.name || '', 
        type: channel.type 
      };
    }
    return { name: '' };
  });
}

// Convert existing social media data to the new format with all fields
export const formatSocialMedia = (socialMedia: any[]): any[] => {
  if (!socialMedia || !Array.isArray(socialMedia)) return [];
  
  return socialMedia.map(sm => {
    // Check if isActive is present, otherwise try to infer from connectedPages (e.g. for Facebook)
    let isActive = sm.isActive;
    
    // If isActive is not explicitly set or is false, but we have connectedPages (and it's not empty), consider it active
    if (!isActive && sm.connectedPages && Array.isArray(sm.connectedPages) && sm.connectedPages.length > 0) {
      isActive = true;
    }

    // Ensure every social media item has the required fields
    // URL is still marked as required for backward compatibility
    const formattedItem = {
      ...sm, // Spread all existing properties to preserve data not explicitly handled below
      platform: sm.platform || '',
      url: sm.url || '',
      handle: sm.handle || '',
      phone: sm.phone || '',
      phoneCode: sm.phoneCode || '',
      inviteCode: sm.inviteCode || '',
      channelId: sm.channelId || '',
      // Explicitly set isActive based on our logic
      isActive: isActive,
      // Ensure specific fields are preserved if they exist (though spread covers most)
      username: sm.username,
      nickname: sm.nickname,
      profile_picture_url: sm.profile_picture_url,
      connectedPages: sm.connectedPages
    };
    
    return formattedItem;
  });
}

/** Matches SocialSection "Connected" / formatSocialMedia active state for publish UIs. */
export function isSocialMediaEntryConnected(sm: any): boolean {
  if (!sm?.platform) return false
  if (sm.isActive === true || sm.isActive === 1) return true
  if (Array.isArray(sm.connectedPages) && sm.connectedPages.length > 0) return true
  return false
}

// Convert products data to the new format with name, description, and pricing fields
export const formatProducts = (products: any[]): any[] => {
  if (!products || !Array.isArray(products)) return [];
  
  return products.map(product => {
    // Handle migration from string to object format
    if (typeof product === 'string') {
      return {
        name: product,
        description: '',
        cost: 0,
        lowest_sale_price: 0,
        target_sale_price: 0
      };
    } else if (typeof product === 'object' && product !== null) {
      return {
        name: product.name || '',
        description: product.description || '',
        cost: typeof product.cost === 'number' ? product.cost : 0,
        lowest_sale_price: typeof product.lowest_sale_price === 'number' ? product.lowest_sale_price : 0,
        target_sale_price: typeof product.target_sale_price === 'number' ? product.target_sale_price : 0
      };
    }
    return {
      name: '',
      description: '',
      cost: 0,
      lowest_sale_price: 0,
      target_sale_price: 0
    };
  });
}

// Convert services data to the new format with name, description, and pricing fields
export const formatServices = (services: any[]): any[] => {
  if (!services || !Array.isArray(services)) return [];
  
  return services.map(service => {
    // Handle migration from string to object format
    if (typeof service === 'string') {
      return {
        name: service,
        description: '',
        cost: 0,
        lowest_sale_price: 0,
        target_sale_price: 0
      };
    } else if (typeof service === 'object' && service !== null) {
      return {
        name: service.name || '',
        description: service.description || '',
        cost: typeof service.cost === 'number' ? service.cost : 0,
        lowest_sale_price: typeof service.lowest_sale_price === 'number' ? service.lowest_sale_price : 0,
        target_sale_price: typeof service.target_sale_price === 'number' ? service.target_sale_price : 0
      };
    }
    return {
      name: '',
      description: '',
      cost: 0,
      lowest_sale_price: 0,
      target_sale_price: 0
    };
  });
}

// Convert locations data to the new format with restrictions field
export const formatLocations = (locations: any[]): any[] => {
  if (!locations || !Array.isArray(locations)) return [];
  
  return locations.map(location => {
    // Handle migration from old format to new format with restrictions
    if (typeof location === 'object' && location !== null) {
      return {
        name: location.name || '',
        address: location.address || '',
        city: location.city || '',
        state: location.state || '',
        zip: location.zip || '',
        country: location.country || '',
        restrictions: location.restrictions || {
          enabled: false,
          included_addresses: [],
          excluded_addresses: []
        }
      };
    }
    return {
      name: '',
      address: '',
      city: '',
      state: '',
      zip: '',
      country: '',
      restrictions: {
        enabled: false,
        included_addresses: [],
        excluded_addresses: []
      }
    };
  });
}

