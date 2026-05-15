export function createDemoMockClient(demoSiteId: string) {
  // We defer importing the implementation and the data
  let realClientPromise: Promise<any> | null = null;
  
  const getClient = async () => {
    if (!realClientPromise) {
      realClientPromise = import('./mock-client-impl').then(m => m.createDemoMockClientImpl(demoSiteId));
    }
    return realClientPromise;
  };

  return {
    _isMock: true,
    _isDemo: true,
    auth: {
      getSession: async () => (await getClient()).auth.getSession(),
      getUser: async () => (await getClient()).auth.getUser(),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async (...args: any[]) => (await getClient()).auth.signInWithPassword(...args),
      signInWithOAuth: async (...args: any[]) => (await getClient()).auth.signInWithOAuth(...args),
      signUp: async (...args: any[]) => (await getClient()).auth.signUp(...args),
      signOut: async () => (await getClient()).auth.signOut()
    },
    from: (table: string) => {
      // Create a chainable proxy for the query builder
      const createChainProxy = (path: string[], argsList: any[][]): any => {
         const executor = async () => {
             const client = await getClient();
             let current: any = client.from(table);
             for (let i = 0; i < path.length; i++) {
                 current = current[path[i]](...argsList[i]);
             }
             return current;
         };

         return new Proxy({}, {
             get(target, prop) {
                 if (prop === 'then') {
                     return async (resolve: any, reject: any) => {
                         try {
                             // executor() returns the builder promise from real client
                             const builder = await executor();
                             const result = await builder;
                             return resolve ? resolve(result) : result;
                         } catch (e) {
                             if (reject) return reject(e);
                             throw e;
                         }
                     }
                 }
                 if (prop === 'catch') {
                     return (reject: any) => executor().then(builder => builder).catch(reject);
                 }
                 if (prop === 'finally') {
                     return (cb: any) => executor().then(builder => builder).finally(cb);
                 }
                 
                 // If prop is a string and not a promise method, we add it to the chain
                 if (typeof prop === 'string') {
                     return (...args: any[]) => {
                         return createChainProxy([...path, prop], [...argsList, args]);
                     }
                 }
                 return undefined;
             }
         });
      };
      
      return createChainProxy([], []);
    },
    rpc: async (fn: string, params: any) => (await getClient()).rpc(fn, params),
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
