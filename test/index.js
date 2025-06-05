import * as redis from "../src/index.js";

let redisURL = "redis://localhost:6379";

let cache = await redis.createClient({
    url: redisURL
});


const runTests = async () => {
 console.log('🧪 Spouštím cache test suite...\n');

 let passed = 0;
 let failed = 0;

 const test = (name, condition, value=null) => {
   if (condition) {
     console.log(`✅ ${name}`);
     passed++;
   } else {
     console.log(`❌ ${name} ${value}`);
     failed++;
     //process.exit()
   }
 };

 const testEq = (name, value, expected) => {
    if (value === expected) {
        console.log(`✅ ${name}`);
        passed++;
    } else {
        console.log(`❌ ${name} ${value} !== ${expected}`);
        failed++;
    }
};

 // === STRING TESTS ===
 console.log('📝 Testing STRING operations:');
 
 // Test set/get
 await cache.set('test:string', 'hello world');
 test('set/get string', await cache.get('test:string') === 'hello world');
 
 // Test get non-existent
 test('get non-existent key', await cache.get('non:existent') === null);
 
 // Test overwrite
 await cache.set('test:string', 'new value');
 test('overwrite string', await cache.get('test:string') === 'new value');
 
 // Test delete
 const deleted = await cache.del('test:string');
 test('delete existing key', deleted === true);
 test('get after delete', await cache.get('test:string') === null);
 
 // Test delete non-existent
 const deletedNonExistent = await cache.del('non:existent');
 test('delete non-existent key', deletedNonExistent === false);

 console.log('');

 // === LIST TESTS ===
 console.log('📋 Testing LIST operations:');
 
 // Test lPush
 const len1 = await cache.lPush('test:list', 'item1');
 testEq('lPush first item', len1, 1);
 
 const len2 = await cache.lPush('test:list', 'item2');
 testEq('lPush second item', len2, 2);
 
 const len3 = await cache.lPush('test:list', 'item3');
 testEq('lPush third item', len3, 3);
 
 // Test lRange
 const fullList = await cache.lRange('test:list', 0, -1);
 testEq('lRange full list', JSON.stringify(fullList), JSON.stringify(['item3', 'item2', 'item1']));
 
 const partialList = await cache.lRange('test:list', 0, 1);
 testEq('lRange partial list', JSON.stringify(partialList), JSON.stringify(['item3', 'item2']));
 
 // Test lRange non-existent
    const emptyList = await cache.lRange('non:existent:list', 0, -1);
 testEq('lRange non-existent list', emptyList.length, 0);
 
 // Test rPop
 const popped1 = await cache.rPop('test:list');
 testEq('rPop first item', popped1, 'item1');
 
 const popped2 = await cache.rPop('test:list');
 testEq('rPop second item', popped2, 'item2');
 
 const remainingList = await cache.lRange('test:list', 0, -1);
 testEq('list after 2 pops', JSON.stringify(remainingList), JSON.stringify(['item3']));
 
 const popped3 = await cache.rPop('test:list');
 testEq('rPop last item', popped3, 'item3');
 
 // Test rPop empty list
 const poppedEmpty = await cache.rPop('test:list');
 testEq('rPop from empty list', poppedEmpty, null);
 
 const poppedNonExistent = await cache.rPop('non:existent:list');
 testEq('rPop from non-existent list', poppedNonExistent, null);

 console.log('');

 // === SORTED SET TESTS ===
 console.log('🏆 Testing SORTED SET operations:');
 
 // Test zAdd
 const size1 = await cache.zAdd('test:zset', 100, 'player1');
 testEq('zAdd first item', size1, 1);
 
 const size2 = await cache.zAdd('test:zset', 200, 'player2');
 testEq('zAdd second item', size2, 2);
 
 const size3 = await cache.zAdd('test:zset', 150, 'player3');
 testEq('zAdd third item', size3, 3);
 
 // Test zRange (should be sorted by score)
 const sortedPlayers = await cache.zRange('test:zset', 0, -1);
 testEq('zRange sorted order', JSON.stringify(sortedPlayers), JSON.stringify(['player1', 'player3', 'player2']));
 
 // Test zRange partial
 const topTwo = await cache.zRange('test:zset', 0, 1);
 testEq('zRange top 2', JSON.stringify(topTwo), JSON.stringify(['player1', 'player3']));
 
 // Test zAdd duplicate (should update score)
 const sizeAfterUpdate = await cache.zAdd('test:zset', 50, 'player1');
 testEq('zAdd duplicate player', sizeAfterUpdate, 3);
 
 const reorderedPlayers = await cache.zRange('test:zset', 0, -1);
 testEq('zRange after score update', 
   JSON.stringify(reorderedPlayers), JSON.stringify(['player1', 'player3', 'player2']));
 
 // Test zRem
 const removed = await cache.zRem('test:zset', 'player3');
testEq('zRem existing item', removed, 1);
 
 const playersAfterRem = await cache.zRange('test:zset', 0, -1);
 testEq('zRange after removal', JSON.stringify(playersAfterRem), JSON.stringify(['player1', 'player2']));
 
 // Test zRem non-existent
 const removedNonExistent = await cache.zRem('test:zset', 'player99');
 testEq('zRem non-existent item', removedNonExistent, 0);
 
 // Test zRange non-existent
 const emptyZset = await cache.zRange('non:existent:zset', 0, -1);
 testEq('zRange non-existent zset', emptyZset.length, 0);
 
 // Clean up
 await cache.zRem('test:zset', 'player1');
 await cache.zRem('test:zset', 'player2');

 console.log('');

 // === INTEGRATION TESTS ===
 console.log('🔗 Testing INTEGRATION scenarios:');
 
 // Test mixed operations
 await cache.set('user:1', 'John');
 await cache.lPush('notifications:1', 'Welcome!');
 await cache.zAdd('leaderboard', 1000, 'John');
 
 testEq('mixed operations - string', await cache.get('user:1'), 'John');
 testEq('mixed operations - list', (await cache.lRange('notifications:1', 0, -1))[0], 'Welcome!');
 testEq('mixed operations - zset', (await cache.zRange('leaderboard', 0, 0))[0], 'John');
 
 // Cleanup
 await cache.del('user:1');
 await cache.rPop('notifications:1');
 await cache.zRem('leaderboard', 'John');

 console.log('');

 // === EDGE CASES ===
 console.log('⚠️  Testing EDGE CASES:');
 
 // Empty values
 await cache.set('empty:string', '');
 testEq('empty string value', await cache.get('empty:string'), null);
 
 // Number values
 await cache.set('number:value', '123');
 testEq('number as string', await cache.get('number:value'), '123');
 
 // Special characters
 await cache.set('special:chars', 'áčďěščřžýí!@#$%^&*()');
 testEq('special characters', await cache.get('special:chars'), 'áčďěščřžýí!@#$%^&*()');
 
 // Long keys
 const longKey = 'a'.repeat(100);
 await cache.set(longKey, 'long key test');
 testEq('long key name', await cache.get(longKey), 'long key test');
 
 // Cleanup edge cases
 await cache.del('empty:string');
 await cache.del('number:value');
 await cache.del('special:chars');
 await cache.del(longKey);

 console.log('');

 // === RESULTS ===
 console.log('📊 TEST RESULTS:');
 console.log(`✅ Passed: ${passed}`);
 console.log(`❌ Failed: ${failed}`);
 console.log(`📈 Success rate: ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
 
 if (failed === 0) {
   console.log('🎉 All tests passed! Cache implementation is working correctly.');
 } else {
   console.log('🔧 Some tests failed. Check implementation.');
 }

 return { passed, failed };
};

export { runTests };

await runTests();

process.exit(0);