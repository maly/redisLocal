import * as redis from "redis";

let client = null;  
let myClient = null;

const localCache = {
    strings: new Map(),
    lists: new Map(),
    sortedSets: new Map(),
    hashes: new Map(),
    sets: new Map()
  };


const recoverFromRedis = async (client) => {
    console.log('🔄 Načítám data z Redis do lokální cache...');
    
  
    // Bezpečné načtení všech klíčů
    const keys = [];
    let cursor = 0;
    
    for await (const key of client.scanIterator()) {
        keys.push(key);
      }
  
    console.log(`📦 Nalezeno ${keys.length} klíčů`);
  
    // Načti každý klíč podle typu
    for (const keyA of keys) {
      try {
        const key=keyA[0];
        const type = await client.type(key);

//        console.log(key, type);
        
        switch (type) {
          case 'string':
            localCache.strings.set(key, await client.get(key));
            break;
            
          case 'list':
            localCache.lists.set(key, await client.lRange(key, 0, -1));
            break;
            
          case 'zset':
            // Pro sorted sets zachovej i scores
            const zsetData = await client.zRangeWithScores(key, 0, -1);
            localCache.sortedSets.set(key, zsetData);
            break;
            
          case 'hash':
            localCache.hashes.set(key, await client.hGetAll(key));
            break;
            
          case 'set':
            localCache.sets.set(key, await client.sMembers(key));
            break;
        }
      } catch (error) {
        console.error(`❌ Chyba při načítání klíče ${key}:`, error);
      }
    }
  
    console.log('✅ Recovery dokončen');
    return localCache;
  };


export const createClient = () => {
    return {
        set: async (key, value) => {
            localCache.strings.set(key, value);
            await client.set(key, value);
        },
        get: async (key) => {
            return localCache.strings.get(key) || null;
        },
        del: async (key) => {
            const existed = localCache.strings.delete(key);
            await client.del(key);
            return existed;
        },
        // === LIST operace ===
        lPush: async (key, value) => {
            if (!localCache.lists.has(key)) {
                localCache.lists.set(key, []);
            }
            localCache.lists.get(key).unshift(value);
            await client.lPush(key, value);
            return localCache.lists.get(key).length;
        },
        rPop: async (key) => {
            const list = localCache.lists.get(key);
            if (!list || list.length === 0) return null;
            const value = list.pop();
            if (list.length === 0) {
                localCache.lists.delete(key);
              }
            await client.rPop(key);
            return value;
        },
        lRange: async (key, start, stop) => {
            const list = localCache.lists.get(key);
            if (!list) return [];
            if (stop===-1) stop=list.length-1;
            return list.slice(start, stop+1);
        },
        lLen: async (key) => {
            const list = localCache.lists.get(key);
            if (!list) return 0;
            return list.length;
        },
        // === SORTED SET operace ===
        zAdd: async (key, score, value) => {
            if (!localCache.sortedSets.has(key)) {
                localCache.sortedSets.set(key, []);
            }
            let zset = localCache.sortedSets.get(key);
            const index = zset.findIndex(item => item.value === value);
            if (index !== -1) {
                zset.splice(index, 1);
            }
            zset.push({ score, value });
            zset.sort((a, b) => a.score - b.score);
            await client.zAdd(key, { score, value });
            return zset.length;
        },
        zRange: async (key, start, stop) => {
            const zset = localCache.sortedSets.get(key);
            if (!zset) return [];
            if (stop===-1) stop=zset.length-1;
            return zset.slice(start, stop+1).map(item => item.value);
        },
        zRangeByScore: async (key, min, max) => {
            const zset = localCache.sortedSets.get(key);
            if (!zset) return [];
            const filtered = zset.filter(item => item.score >= min && item.score <= max);
            return filtered.map(item => item.value);
        },
        zRem: async (key, value) => {
            const zset = localCache.sortedSets.get(key);
            if (!zset) return 0;
            const index = zset.findIndex(item => item.value === value);
            if (index === -1) return 0;
            zset.splice(index, 1);
            if (zset.length === 0) {
                localCache.sortedSets.delete(key);
            }
            await client.zRem(key, value);
            return 1;
        },
        // === HASH operace ===
        hSet: async (key, field, value) => {
            if (!localCache.hashes.has(key)) {
                localCache.hashes.set(key, new Map());
            }
            localCache.hashes.get(key).set(field, value);
            await client.hSet(key, field, value);
            return 1;
        },
        hGet: async (key, field) => {
            const hash = localCache.hashes.get(key);
            return hash ? hash.get(field) || null : null;
        },
        hGetAll: async (key) => {
            const hash = localCache.hashes.get(key);
            if (!hash) return {};
            const result = {};
            for (const [field, value] of hash.entries()) {
                result[field] = value;
            }
            return result;
        },
        hDel: async (key, field) => {
            const hash = localCache.hashes.get(key);
            if (!hash) return 0;
            const deleted = hash.delete(field);
            if (hash.size === 0) {
                localCache.hashes.delete(key);
            }
            await client.hDel(key, field);
            return deleted ? 1 : 0;
        }
    }
};

export const getClient = () => {
    return myClient;
};

export const begin = async (options) => {
    client = await redis.createClient(options);
    await client.connect();
    //read všeho
    await recoverFromRedis(client);
    myClient = createClient();
    return myClient;
}
