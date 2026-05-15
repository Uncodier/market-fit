import { getDemoData } from "./index";

import { Database } from '../database.types';

// Mock instance for the demo data cache 
const memoryCache: Record<string, Record<string, any[]>> = {};

const getMemoryCache = (siteId: string, demoData: any) => {
  if (!memoryCache[siteId]) {
    // Deep clone the demo data into memory cache so mutations only affect the current session
    memoryCache[siteId] = JSON.parse(JSON.stringify(demoData || {}));
  }
  return memoryCache[siteId];
};

/**
 * Crea un cliente mock para el MODO DEMO, utilizando datos simulados
 */
export function createDemoMockClient(demoSiteId: string) {
  const baseDemoData = getDemoData(demoSiteId);
  const user = baseDemoData?.profiles?.[0] || null;
  const memoryData = getMemoryCache(demoSiteId, baseDemoData);
  const session = user ? {
    access_token: 'demo-token',
    refresh_token: 'demo-refresh',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    token_type: 'bearer',
    user: {
      id: user.id,
      email: user.email,
      role: 'authenticated',
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: { full_name: user.full_name, avatar_url: user.avatar_url },
      created_at: new Date().toISOString(),
    }
  } : null;

  // Simple query builder simulator
  const buildQuery = (tableData: any[], tableName: string) => {
    let result = [...(tableData || [])];
    
    const queryBuilder: any = {
      select: () => queryBuilder,
      eq: (column: string, value: any) => {
        result = result.filter(item => item[column] === value);
        return queryBuilder;
      },
      neq: (column: string, value: any) => {
        result = result.filter(item => item[column] !== value);
        return queryBuilder;
      },
      match: (query: Record<string, any>) => {
        result = result.filter(item => {
          return Object.entries(query).every(([k, v]) => item[k] === v);
        });
        return queryBuilder;
      },
      or: (condition: string) => {
        // Very basic mock for 'or'
        return queryBuilder;
      },
      in: (column: string, values: any[]) => {
        result = result.filter(item => values.includes(item[column]));
        return queryBuilder;
      },
      gte: (column: string, value: any) => {
        result = result.filter(item => item[column] >= value);
        return queryBuilder;
      },
      lte: (column: string, value: any) => {
        result = result.filter(item => item[column] <= value);
        return queryBuilder;
      },
      gt: (column: string, value: any) => {
        result = result.filter(item => item[column] > value);
        return queryBuilder;
      },
      lt: (column: string, value: any) => {
        result = result.filter(item => item[column] < value);
        return queryBuilder;
      },
      is: (column: string, value: any) => {
        result = result.filter(item => item[column] === value);
        return queryBuilder;
      },
      not: (column: string, operator: string, value: any) => queryBuilder,
      filter: (column: string, operator: string, value: any) => queryBuilder,
      ilike: (column: string, value: string) => {
        const regex = new RegExp(value.replace(/%/g, '.*'), 'i');
        result = result.filter(item => item[column] && regex.test(item[column]));
        return queryBuilder;
      },
      like: (column: string, value: string) => {
        const regex = new RegExp(value.replace(/%/g, '.*'));
        result = result.filter(item => item[column] && regex.test(item[column]));
        return queryBuilder;
      },
      contains: (column: string, value: any) => queryBuilder,
      containedBy: (column: string, value: any) => queryBuilder,
      single: () => {
        return Promise.resolve({ data: result.length > 0 ? result[0] : null, error: null });
      },
      maybeSingle: () => {
        return Promise.resolve({ data: result.length > 0 ? result[0] : null, error: null });
      },
      limit: (count: number) => {
        result = result.slice(0, count);
        return queryBuilder;
      },
      range: (from: number, to: number) => {
        result = result.slice(from, to + 1);
        return queryBuilder;
      },
      order: (column: string, { ascending } = { ascending: true }) => {
        result = result.sort((a, b) => {
          if (a[column] < b[column]) return ascending ? -1 : 1;
          if (a[column] > b[column]) return ascending ? 1 : -1;
          return 0;
        });
        return queryBuilder;
      },
      csv: () => queryBuilder,
      then: (resolve: any) => resolve({ data: result, error: null, count: result.length })
    };
    
    // Add Promise chaining support
    queryBuilder.catch = (reject: any) => Promise.resolve({ data: result, error: null, count: result.length }).catch(reject);
    
    return queryBuilder;
  };

  return {
    _isMock: true,
    _isDemo: true,
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: { user: session?.user, session }, error: null }),
      signInWithOAuth: async () => ({ data: { provider: null, url: null }, error: null }),
      signUp: async () => ({ data: { user: session?.user, session }, error: null }),
      signOut: async () => ({ error: null })
    },
    from: (table: string) => {
      let tableData = memoryData[table] || [];
      return {
        select: (columns?: string, options?: any) => {
          let enrichedData = [...tableData];
          
          // Embed relations for conversations if requested
          if (columns && typeof columns === 'string' && table === 'conversations') {
            if (columns.includes('messages')) {
               enrichedData = enrichedData.map(conv => ({
                 ...conv,
                 messages: (memoryData['messages'] || []).filter((m: any) => m.conversation_id === conv.id)
               }));
            }
            if (columns.includes('leads')) {
               enrichedData = enrichedData.map(conv => ({
                 ...conv,
                 leads: (memoryData['leads'] || []).find((l: any) => l.id === conv.lead_id) || null
               }));
            }
          }

          // If asking for count, add it
          const query = buildQuery(enrichedData, table);
          const needsCount = (columns && columns.includes('count')) || (options && options.count);
          if (needsCount) {
            const originalThen = query.then;
            query.then = (resolve: any) => {
              return originalThen((res: any) => resolve({ ...res, count: res.data?.length || 0 }));
            };
          }
          return query;
        },
        upsert: (data: any) => {
          const inserted = Array.isArray(data) ? data.map(d => ({...d, id: d.id || `demo-id-${Date.now()}`})) : {...data, id: data.id || `demo-id-${Date.now()}`};
          if (!memoryData[table]) memoryData[table] = [];
          
          if (Array.isArray(inserted)) {
             inserted.forEach(item => {
               const idx = memoryData[table].findIndex((i: any) => i.id === item.id);
               if (idx >= 0) memoryData[table][idx] = { ...memoryData[table][idx], ...item };
               else memoryData[table].push(item);
             });
          } else {
             const idx = memoryData[table].findIndex((i: any) => i.id === inserted.id);
             if (idx >= 0) memoryData[table][idx] = { ...memoryData[table][idx], ...inserted };
             else memoryData[table].push(inserted);
          }

          return {
            select: () => ({
              single: () => Promise.resolve({ data: Array.isArray(inserted) ? inserted[0] : inserted, error: null }),
              then: (resolve: any) => resolve({ data: inserted, error: null })
            }),
            then: (resolve: any) => resolve({ data: inserted, error: null })
          };
        },
        insert: (data: any) => {
          // Simulate insert by returning the data with a fake ID
          const inserted = Array.isArray(data) ? data.map(d => ({...d, id: d.id || `demo-id-${Date.now()}`})) : {...data, id: data.id || `demo-id-${Date.now()}`};
          
          if (!memoryData[table]) memoryData[table] = [];
          if (Array.isArray(inserted)) {
             memoryData[table].push(...inserted);
          } else {
             memoryData[table].push(inserted);
          }

          return {
            select: () => ({
              single: () => Promise.resolve({ data: Array.isArray(inserted) ? inserted[0] : inserted, error: null }),
              then: (resolve: any) => resolve({ data: inserted, error: null })
            }),
            single: () => Promise.resolve({ data: Array.isArray(inserted) ? inserted[0] : inserted, error: null }),
            then: (resolve: any) => resolve({ data: inserted, error: null })
          };
        },
        update: (data: any) => {
          const updateBuilder = (column: string, value: any) => {
            // Update local memory copy
            let updatedItem = null;
            if (memoryData[table]) {
              const itemIndex = memoryData[table].findIndex((item: any) => item[column] === value);
              if (itemIndex >= 0) {
                memoryData[table][itemIndex] = { ...memoryData[table][itemIndex], ...data };
                updatedItem = memoryData[table][itemIndex];
              }
            }
            
            return {
              select: () => ({
                single: () => Promise.resolve({ data: updatedItem || {...data, [column]: value}, error: null })
              }),
              then: (resolve: any) => resolve({ data: null, error: null }) 
            }
          };
          
          return { 
            eq: updateBuilder,
            in: (column: string, values: any[]) => {
               // Update multiple
               if (memoryData[table]) {
                 values.forEach(val => {
                    const itemIndex = memoryData[table].findIndex((item: any) => item[column] === val);
                    if (itemIndex >= 0) {
                      memoryData[table][itemIndex] = { ...memoryData[table][itemIndex], ...data };
                    }
                 });
               }
               return {
                  select: () => ({
                    then: (resolve: any) => resolve({ data: [], error: null })
                  }),
                  then: (resolve: any) => resolve({ data: null, error: null })
               }
            }
          };
        },
        delete: () => {
          return { 
            eq: (column: string, value: any) => {
               // Remove from memory
               if (memoryData[table]) {
                 const itemIndex = memoryData[table].findIndex((item: any) => item[column] === value);
                 if (itemIndex >= 0) {
                   memoryData[table].splice(itemIndex, 1);
                 }
               }
               return {
                 then: (resolve: any) => resolve({ data: null, error: null }) 
               }
            },
            in: (column: string, values: any[]) => {
               // Remove multiple
               if (memoryData[table]) {
                 values.forEach(val => {
                    const itemIndex = memoryData[table].findIndex((item: any) => item[column] === val);
                    if (itemIndex >= 0) {
                      memoryData[table].splice(itemIndex, 1);
                    }
                 });
               }
               return {
                 then: (resolve: any) => resolve({ data: null, error: null }) 
               }
            } 
          };
        }
      };
    },
    rpc: (fn: string, params: any) => {
       console.log(`🤖 DEMO RPC INTERCEPT: ${fn}`, params);
       return Promise.resolve({ data: null, error: null });
    },
    channel: (channel: string) => {
      const mockChannel = {
        on: () => mockChannel,
        subscribe: () => mockChannel,
        unsubscribe: () => {}
      };
      return mockChannel;
    },
    removeChannel: () => {},
    removeAllChannels: () => {}
  };
}
