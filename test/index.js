import * as redis from "../src/index.js";

let redisURL = "redis://localhost:6379";

let cache = await redis.begin({
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


 // Přidej do test-cache.js

// === HASH TESTS ===
console.log('🗂️  Testing HASH operations:');

// Test hSet/hGet
await cache.hSet('test:hash', 'field1', 'value1');
testEq('hSet first field', await cache.hGet('test:hash', 'field1'), 'value1');

// Test multiple fields
await cache.hSet('test:hash', 'field2', 'value2');
await cache.hSet('test:hash', 'field3', 'value3');
testEq('hGet second field', await cache.hGet('test:hash', 'field2'), 'value2');
testEq('hGet third field', await cache.hGet('test:hash', 'field3'), 'value3');

// Test hGet non-existent field
testEq('hGet non-existent field', await cache.hGet('test:hash', 'nonexistent'), null);

// Test hGet non-existent hash
testEq('hGet from non-existent hash', await cache.hGet('nonexistent:hash', 'field1'), null);

// Test hGetAll
const allFields = await cache.hGetAll('test:hash');
const expectedAll = { field1: 'value1', field2: 'value2', field3: 'value3' };
testEq('hGetAll all fields', JSON.stringify(allFields), JSON.stringify(expectedAll));

// Test hGetAll empty hash
const emptyHash = await cache.hGetAll('nonexistent:hash');
testEq('hGetAll non-existent hash', JSON.stringify(emptyHash), JSON.stringify({}));

// Test field overwrite
await cache.hSet('test:hash', 'field1', 'newvalue1');
testEq('hSet overwrite field', await cache.hGet('test:hash', 'field1'), 'newvalue1');

const allAfterOverwrite = await cache.hGetAll('test:hash');
const expectedAfterOverwrite = { field1: 'newvalue1', field2: 'value2', field3: 'value3' };
testEq('hGetAll after overwrite', JSON.stringify(allAfterOverwrite), JSON.stringify(expectedAfterOverwrite));

// Test hDel
const deleted1 = await cache.hDel('test:hash', 'field2');
testEq('hDel existing field', deleted1, 1);
testEq('hGet after delete', await cache.hGet('test:hash', 'field2'), null);

const allAfterDelete = await cache.hGetAll('test:hash');
const expectedAfterDelete = { field1: 'newvalue1', field3: 'value3' };
testEq('hGetAll after delete', JSON.stringify(allAfterDelete), JSON.stringify(expectedAfterDelete));

// Test hDel non-existent field
const deleted2 = await cache.hDel('test:hash', 'nonexistent');
testEq('hDel non-existent field', deleted2, 0);

// Test hDel from non-existent hash
const deleted3 = await cache.hDel('nonexistent:hash', 'field1');
testEq('hDel from non-existent hash', deleted3, 0);

// Test delete all fields (hash cleanup)
await cache.hDel('test:hash', 'field1');
await cache.hDel('test:hash', 'field3');
const emptyAfterDeleteAll = await cache.hGetAll('test:hash');
testEq('hGetAll after deleting all fields', JSON.stringify(emptyAfterDeleteAll), JSON.stringify({}));

console.log('');

// === HASH EDGE CASES ===
console.log('🗂️  Testing HASH edge cases:');

// Empty field name
await cache.hSet('edge:hash', '', 'empty_field_value');
testEq('hSet/hGet empty field name', await cache.hGet('edge:hash', ''), 'empty_field_value');

// Empty field value
await cache.hSet('edge:hash', 'empty_value', '');
testEq('hSet/hGet empty field value', await cache.hGet('edge:hash', 'empty_value'), null);

// Special characters in field names
await cache.hSet('edge:hash', 'field:with:colons', 'colon_value');
await cache.hSet('edge:hash', 'field with spaces', 'space_value');
await cache.hSet('edge:hash', 'field_with_češstina', 'czech_value');

testEq('hGet field with colons', await cache.hGet('edge:hash', 'field:with:colons'), 'colon_value');
testEq('hGet field with spaces', await cache.hGet('edge:hash', 'field with spaces'), 'space_value');
testEq('hGet field with czech chars', await cache.hGet('edge:hash', 'field_with_češstina'), 'czech_value');

// Large hash
const largeHashKey = 'large:hash';
for (let i = 0; i < 100; i++) {
 await cache.hSet(largeHashKey, `field${i}`, `value${i}`);
}

testEq('large hash field count', Object.keys(await cache.hGetAll(largeHashKey)).length, 100);
testEq('large hash random field', await cache.hGet(largeHashKey, 'field42'), 'value42');

// Cleanup edge cases
await cache.del('edge:hash');
await cache.del('large:hash');

console.log('');


console.log('🎯 Testing zRangeByScore operations:');

// Příprava test dat
await cache.zAdd('score:test', 10, 'item10');
await cache.zAdd('score:test', 20, 'item20');
await cache.zAdd('score:test', 30, 'item30');
await cache.zAdd('score:test', 40, 'item40');
await cache.zAdd('score:test', 50, 'item50');

// Test základní range
const range1 = await cache.zRangeByScore('score:test', 20, 40);
testEq('zRangeByScore basic range (20-40)', 
  JSON.stringify(range1), 
  JSON.stringify(['item20', 'item30', 'item40'])
);

// Test inclusive boundaries
const range2 = await cache.zRangeByScore('score:test', 30, 30);
testEq('zRangeByScore exact score (30)', 
  JSON.stringify(range2), 
  JSON.stringify(['item30'])
);

// Test partial range from start
const range3 = await cache.zRangeByScore('score:test', 0, 25);
testEq('zRangeByScore from start (0-25)', 
  JSON.stringify(range3), 
  JSON.stringify(['item10', 'item20'])
);

// Test partial range to end
const range4 = await cache.zRangeByScore('score:test', 35, 100);
testEq('zRangeByScore to end (35-100)', 
  JSON.stringify(range4), 
  JSON.stringify(['item40', 'item50'])
);

// Test full range
const range5 = await cache.zRangeByScore('score:test', 0, 100);
testEq('zRangeByScore full range (0-100)', 
  JSON.stringify(range5), 
  JSON.stringify(['item10', 'item20', 'item30', 'item40', 'item50'])
);

// Test empty range
const range6 = await cache.zRangeByScore('score:test', 60, 80);
testEq('zRangeByScore empty range (60-80)', 
  JSON.stringify(range6), 
  JSON.stringify([])
);

// Test inverted range (min > max)
const range7 = await cache.zRangeByScore('score:test', 40, 20);
testEq('zRangeByScore inverted range (40-20)', 
  JSON.stringify(range7), 
  JSON.stringify([])
);

// Test negative scores
await cache.zAdd('negative:test', -10, 'neg10');
await cache.zAdd('negative:test', -5, 'neg5');
await cache.zAdd('negative:test', 0, 'zero');
await cache.zAdd('negative:test', 5, 'pos5');

const range8 = await cache.zRangeByScore('negative:test', -10, 0);
testEq('zRangeByScore with negatives (-10 to 0)', 
  JSON.stringify(range8), 
  JSON.stringify(['neg10', 'neg5', 'zero'])
);

const range9 = await cache.zRangeByScore('negative:test', -6, 6);
testEq('zRangeByScore crossing zero (-6 to 6)', 
  JSON.stringify(range9), 
  JSON.stringify(['neg5', 'zero', 'pos5'])
);

// Test decimal scores
await cache.zAdd('decimal:test', 1.5, 'one_half');
await cache.zAdd('decimal:test', 2.7, 'two_seven');
await cache.zAdd('decimal:test', 3.1, 'three_one');

const range10 = await cache.zRangeByScore('decimal:test', 1.0, 3.0);
testEq('zRangeByScore with decimals (1.0-3.0)', 
  JSON.stringify(range10), 
  JSON.stringify(['one_half', 'two_seven'])
);

const range11 = await cache.zRangeByScore('decimal:test', 2.6, 3.2);
testEq('zRangeByScore decimal precision (2.6-3.2)', 
  JSON.stringify(range11), 
  JSON.stringify(['two_seven', 'three_one'])
);

// Test non-existent key
const range12 = await cache.zRangeByScore('nonexistent:zset', 0, 100);
testEq('zRangeByScore non-existent key', 
  JSON.stringify(range12), 
  JSON.stringify([])
);

// Test with duplicate scores
await cache.zAdd('duplicate:test', 10, 'first');
await cache.zAdd('duplicate:test', 10, 'second');
await cache.zAdd('duplicate:test', 10, 'third');
await cache.zAdd('duplicate:test', 20, 'twenty');

const range13 = await cache.zRangeByScore('duplicate:test', 10, 10);
testEq('zRangeByScore duplicate scores', 
  range13.includes('second') && range13.includes('third'), 
  true
);

// Test large range
await cache.zAdd('large:test', 1000000, 'million');
await cache.zAdd('large:test', 999999, 'almost_million');

const range14 = await cache.zRangeByScore('large:test', 999998, 1000001);
testEq('zRangeByScore large numbers', 
  JSON.stringify(range14), 
  JSON.stringify(['almost_million', 'million'])
);

// Cleanup test data
await cache.del('score:test');
await cache.del('negative:test'); 
await cache.del('decimal:test');
await cache.del('nonexistent:zset');
await cache.del('duplicate:test');
await cache.del('large:test');

console.log('');

// === EDGE CASES pro zRangeByScore ===
console.log('🎯 Testing zRangeByScore edge cases:');

// Test with very close decimal scores
await cache.zAdd('precision:test', 1.0001, 'precise1');
await cache.zAdd('precision:test', 1.0002, 'precise2'); 
await cache.zAdd('precision:test', 1.0003, 'precise3');

const range15 = await cache.zRangeByScore('precision:test', 1.0001, 1.0002);
testEq('zRangeByScore high precision', 
  JSON.stringify(range15), 
  JSON.stringify(['precise1', 'precise2'])
);

// Test infinity values (JavaScript specific)
await cache.zAdd('infinity:test', -Infinity, 'neg_inf');
await cache.zAdd('infinity:test', Infinity, 'pos_inf');
await cache.zAdd('infinity:test', 0, 'zero');

const range16 = await cache.zRangeByScore('infinity:test', -Infinity, Infinity);
testEq('zRangeByScore with infinity', 
  JSON.stringify(range16), 
  JSON.stringify(['neg_inf', 'zero', 'pos_inf'])
);

// Test zero range (min = max = specific value)
await cache.zAdd('zero:range:test', 42, 'answer');
await cache.zAdd('zero:range:test', 41, 'close');
await cache.zAdd('zero:range:test', 43, 'also_close');

const range17 = await cache.zRangeByScore('zero:range:test', 42, 42);
testEq('zRangeByScore zero width range', 
  JSON.stringify(range17), 
  JSON.stringify(['answer'])
);

// Cleanup edge cases
await cache.del('precision:test');
await cache.del('infinity:test');
await cache.del('zero:range:test');

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