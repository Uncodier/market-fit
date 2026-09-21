import { getDemoData } from "./index";
import { applyNotFilter, applySelectEmbeds, getRowValue } from "./mock-query";
import {
  mutateDemoOrderLineUnits,
  cascadeDeleteDemoOrderItems,
  syncDemoUnitDelivery,
  syncDemoUnitsFromOrderItems,
} from "./mock-order-line-units"

// Mock instance for the demo data cache 
const memoryCache: Record<string, Record<string, any[]>> = {};

const getMemoryCache = (siteId: string, demoData: any) => {
  if (!memoryCache[siteId]) {
    // Deep clone the demo data into memory cache so mutations only affect the current session
    memoryCache[siteId] = JSON.parse(JSON.stringify(demoData || {}));
  } else if (
    !Array.isArray(memoryCache[siteId].sale_order_item_units) &&
    Array.isArray(demoData?.sale_order_item_units)
  ) {
    memoryCache[siteId].sale_order_item_units = JSON.parse(
      JSON.stringify(demoData.sale_order_item_units),
    )
  } else {
    for (const sourceOrder of demoData?.sale_orders || []) {
      const cachedOrder = memoryCache[siteId].sale_orders?.find(
        (order) => order.id === sourceOrder.id,
      )
      if (cachedOrder && sourceOrder.scheduled_for) {
        cachedOrder.scheduled_for = sourceOrder.scheduled_for
      }
    }
    for (const sourceItem of demoData?.sale_order_items || []) {
      const cachedItems = memoryCache[siteId].sale_order_items || []
      const cachedItem = cachedItems.find((item) => item.id === sourceItem.id)
      if (!cachedItem) {
        cachedItems.push(JSON.parse(JSON.stringify(sourceItem)))
      } else if (sourceItem.shipment_id && !cachedItem.shipment_id) {
        cachedItem.shipment_id = sourceItem.shipment_id
      }
    }
    for (const sourceUnit of demoData?.sale_order_item_units || []) {
      const cachedUnit = memoryCache[siteId].sale_order_item_units?.find(
        (unit) => unit.id === sourceUnit.id,
      )
      for (const key of [
        "shipment_id",
        "in_progress_at",
        "ready_at",
        "delivered_at",
      ]) {
        if (
          cachedUnit &&
          (cachedUnit[key] === undefined ||
            (sourceUnit[key] && !cachedUnit[key]))
        ) {
          cachedUnit[key] = sourceUnit[key]
        }
      }
    }
  }
  return memoryCache[siteId];
};

/**
 * Crea un cliente mock para el MODO DEMO, utilizando datos simulados
 */
export async function createDemoMockClientImpl(demoSiteId: string) {
  const baseDemoData = await getDemoData(demoSiteId);
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
    let countBeforeWindow: number | null = null;
    const rootOrder: Array<{ column: string; ascending: boolean }> = []
    const embeddedOrder = new Map<
      string,
      Array<{ column: string; ascending: boolean }>
    >()

    const compareRows = (
      leftRow: Record<string, any>,
      rightRow: Record<string, any>,
      order: Array<{ column: string; ascending: boolean }>
    ) => {
      for (const { column, ascending } of order) {
        const left = getRowValue(leftRow, column)
        const right = getRowValue(rightRow, column)
        if (left < right) return ascending ? -1 : 1
        if (left > right) return ascending ? 1 : -1
      }
      return 0
    }
    
    const queryBuilder: any = {
      select: () => queryBuilder,
      eq: (column: string, value: any) => {
        result = result.filter(item => getRowValue(item, column) === value);
        return queryBuilder;
      },
      neq: (column: string, value: any) => {
        result = result.filter(item => getRowValue(item, column) !== value);
        return queryBuilder;
      },
      match: (query: Record<string, any>) => {
        result = result.filter(item => {
          return Object.entries(query).every(([k, v]) => item[k] === v);
        });
        return queryBuilder;
      },
      or: (
        condition: string,
        options?: { referencedTable?: string }
      ) => {
        if (options?.referencedTable) {
          const relation = options.referencedTable
          const alternatives = condition.split(",").map((part) => {
            const [column, operator, ...rawValue] = part.split(".")
            return { column, operator, value: rawValue.join(".") }
          })

          result = result.map((item) => {
            const embeddedRows = Array.isArray(item[relation])
              ? item[relation]
              : []
            const filteredRows = embeddedRows.filter((embeddedItem: any) =>
              alternatives.some(({ column, operator, value }) =>
                operator === "eq" && getRowValue(embeddedItem, column) === value
              )
            )
            return { ...item, [relation]: filteredRows }
          })
        }
        return queryBuilder;
      },
      in: (column: string, values: any[]) => {
        result = result.filter(item => values.includes(getRowValue(item, column)));
        return queryBuilder;
      },
      gte: (column: string, value: any) => {
        result = result.filter(item => getRowValue(item, column) >= value);
        return queryBuilder;
      },
      lte: (column: string, value: any) => {
        result = result.filter(item => getRowValue(item, column) <= value);
        return queryBuilder;
      },
      gt: (column: string, value: any) => {
        result = result.filter(item => getRowValue(item, column) > value);
        return queryBuilder;
      },
      lt: (column: string, value: any) => {
        result = result.filter(item => getRowValue(item, column) < value);
        return queryBuilder;
      },
      is: (column: string, value: any) => {
        result = result.filter(item => value === null ? getRowValue(item, column) == null : getRowValue(item, column) === value);
        return queryBuilder;
      },
      not: (column: string, operator: string, value: any) => {
        result = applyNotFilter(result, column, operator, value);
        return queryBuilder;
      },
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
      limit: (
        count: number,
        options?: { referencedTable?: string }
      ) => {
        if (options?.referencedTable) {
          const relation = options.referencedTable
          result = result.map((item) => ({
            ...item,
            [relation]: Array.isArray(item[relation])
              ? item[relation].slice(0, count)
              : item[relation],
          }))
          return queryBuilder
        }

        countBeforeWindow ??= result.length;
        result = result.slice(0, count);
        return queryBuilder;
      },
      range: (from: number, to: number) => {
        countBeforeWindow ??= result.length;
        result = result.slice(from, to + 1);
        return queryBuilder;
      },
      order: (
        column: string,
        {
          ascending = true,
          referencedTable,
        }: { ascending?: boolean; referencedTable?: string } = {}
      ) => {
        if (referencedTable) {
          const relationOrder = embeddedOrder.get(referencedTable) || []
          relationOrder.push({ column, ascending })
          embeddedOrder.set(referencedTable, relationOrder)
          result = result.map((item) => {
            if (!Array.isArray(item[referencedTable])) return item
            const embeddedRows = [...item[referencedTable]].sort((a, b) =>
              compareRows(a, b, relationOrder)
            )
            return { ...item, [referencedTable]: embeddedRows }
          })
          return queryBuilder
        }

        rootOrder.push({ column, ascending })
        result = result.sort((a, b) => compareRows(a, b, rootOrder));
        return queryBuilder;
      },
      csv: () => queryBuilder,
      then: (resolve: any) =>
        resolve({
          data: result,
          error: null,
          count: countBeforeWindow ?? result.length,
        })
    };
    
    // Add Promise chaining support
    queryBuilder.catch = (reject: any) =>
      Promise.resolve({
        data: result,
        error: null,
        count: countBeforeWindow ?? result.length,
      }).catch(reject);
    
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
          const enrichedData = applySelectEmbeds(
            [...tableData],
            table,
            typeof columns === "string" ? columns : undefined,
            memoryData
          );

          // If asking for count, add it
          const query = buildQuery(enrichedData, table);
          const needsCount = (columns && columns.includes('count')) || (options && options.count);
          if (needsCount) {
            const originalThen = query.then;
            query.then = (resolve: any) => {
              return originalThen((res: any) =>
                resolve({ ...res, count: res.count ?? res.data?.length ?? 0 }),
              );
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
          if (table === "sale_order_items") {
            for (const changes of Array.isArray(inserted) ? inserted : [inserted]) {
              const item = memoryData[table].find(
                (candidate: any) => candidate.id === changes.id,
              )
              if (item) syncDemoUnitsFromOrderItems(memoryData, [item], changes)
            }
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
          if (table === "sale_order_items") {
            for (const item of Array.isArray(inserted) ? inserted : [inserted]) {
              syncDemoUnitsFromOrderItems(memoryData, [item], item)
            }
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
          const filters: Array<(item: any) => boolean> = [];
          const apply = () => {
            const rows = memoryData[table] || [];
            const updated: any[] = [];
            memoryData[table] = rows.map((item: any) => {
              if (!filters.every((match) => match(item))) return item;
              const next = { ...item, ...data };
              updated.push(next);
              return next;
            });
            if (table === "sale_order_items") {
              syncDemoUnitsFromOrderItems(memoryData, updated, data)
            } else if (table === "shipments") {
              syncDemoUnitDelivery(memoryData, updated)
            }
            return updated;
          };
          const builder: any = {
            eq: (column: string, value: any) => {
              filters.push((item) => item[column] === value);
              return builder;
            },
            in: (column: string, values: any[]) => {
              filters.push((item) => values.includes(item[column]));
              return builder;
            },
            lt: (column: string, value: any) => {
              filters.push((item) => item[column] < value);
              return builder;
            },
            lte: (column: string, value: any) => {
              filters.push((item) => item[column] <= value);
              return builder;
            },
            gt: (column: string, value: any) => {
              filters.push((item) => item[column] > value);
              return builder;
            },
            gte: (column: string, value: any) => {
              filters.push((item) => item[column] >= value);
              return builder;
            },
            select: () => ({
              single: () => Promise.resolve({ data: apply()[0] || null, error: null }),
              then: (resolve: any) => resolve({ data: apply(), error: null }),
            }),
            then: (resolve: any) => resolve({ data: apply(), error: null }),
          };
          builder.catch = (reject: any) => Promise.resolve({ data: apply(), error: null }).catch(reject);
          return builder;
        },
        delete: () => {
          return { 
            eq: (column: string, value: any) => {
               // Remove from memory
               if (memoryData[table]) {
                 const itemIndex = memoryData[table].findIndex((item: any) => item[column] === value);
                 if (itemIndex >= 0) {
                    const [removed] = memoryData[table].splice(itemIndex, 1);
                    if (table === "sale_order_items") {
                      cascadeDeleteDemoOrderItems(memoryData, [removed])
                    }
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
                      const [removed] = memoryData[table].splice(itemIndex, 1);
                      if (table === "sale_order_items") {
                        cascadeDeleteDemoOrderItems(memoryData, [removed])
                      }
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
       if (fn === "get_my_accessible_sites") {
         return Promise.resolve({ data: memoryData.sites || [], error: null });
       }
       if (fn === "get_my_site_capabilities") {
         return Promise.resolve({
           data: {
             role: "owner",
             is_owner: true,
             select: true,
             insert: true,
             update: true,
             delete: true,
           },
           error: null,
         });
       }
       if (fn === "mutate_sale_order_item_units") {
         return Promise.resolve(
           mutateDemoOrderLineUnits(memoryData, params || {}),
         );
       }
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
