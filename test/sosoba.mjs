import oracledb from 'oracledb';
import dbconfig from './dbconfig.js';
import {strictEqual, ok} from 'node:assert/strict';

oracledb.errorOnConcurrentExecute = true;

describe('000. sosoba.mjs', () => {

  let conn;

  before(async () => {
    conn = await oracledb.getConnection(dbconfig);
    await conn.execute("ALTER SESSION SET NLS_TERRITORY = 'SPAIN'" );
  });

  after(async () => {
    if (conn) {
      await conn.close();
    }
  });

  const date = new Date(Date.UTC(2022,1,24,1,55,0));

  [
    // VARCHAR2 from string
    {val: '38,73', dump: 'Typ=1 Len=5: 51,56,44,55,51'},
    {val: '38,73', type: oracledb.DB_TYPE_VARCHAR, dump: 'Typ=1 Len=5: 51,56,44,55,51'},

    // NUMBER/FLOAT from number
    {val: 38.73, output: '38,73', dump: 'Typ=2 Len=3: 193,39,74'},
    {val: 38.73, type: oracledb.DB_TYPE_NUMBER, output: '38,73', dump: 'Typ=2 Len=3: 193,39,74'},

    // NUMBER from string
    {val: '38.73', type: oracledb.DB_TYPE_NUMBER, output: '38,73', dump: 'Typ=2 Len=3: 193,39,74', nativeType: oracledb.DB_TYPE_BYTES },

    // NUMBER from string but without nativeType - NJS-011: encountered bind value and type mismatch
    // {val: '38.73', type: oracledb.DB_TYPE_NUMBER, output: '38,73', dump: 'Typ=2 Len=3: 193,39,74' },

    // NUMBER from bigint
    {val: 123n, type: oracledb.DB_TYPE_NUMBER, output: '123', dump: 'Typ=2 Len=3: 194,2,24', nativeType: oracledb.DB_TYPE_BYTES},

    // NUMBER from bigint but without nativeType - NJS-011: encountered bind value and type mismatch
    // {val: 123n, type: oracledb.DB_TYPE_NUMBER, output: '123', dump: 'Typ=2 Len=3: 194,2,24'},

    // TIMESTAMP from Date
    {val: date, dump: 'Typ=231 Len=7: 120,122,2,24,2,56,1', output: '24/02/22 03:55:00,000000000'},
    
    // DATE from Date
    {val: date, type: oracledb.DB_TYPE_DATE, dump: 'Typ=12 Len=7: 120,122,2,24,2,56,1', output: '24/02/22'},
    
    // DATE from string
    {val: '2022-02-24T01:55:00.000Z', type: oracledb.DB_TYPE_DATE, dump: 'Typ=12 Len=7: 120,122,2,24,2,56,1', output: '24/02/22', nativeType: 3005},

  ].forEach(({val, type, output, dump, nativeType},i)=>it(`${i} ${typeof val} ${type ?? 'default'}`, async ()=>{
    const {rows, metaData} = await conn.execute(`SELECT :A${i}, DUMP(:A${i}) AS D FROM DUAL`, {
      [`A${i}`]: {dir: oracledb.BIND_IN, val, type, nativeType},
    },{
      extendedMetaData: true,
      fetchInfo: {
        [`:A${i}`]: {type: oracledb.STRING},
      },
    },);

    if( type !== undefined) {
      strictEqual( metaData[0].dbType, type ); 
    }
    strictEqual( metaData[0].fetchType, oracledb.STRING); 

    strictEqual( rows[0][0], output ?? val);
    strictEqual( rows[0][1], dump);
  }));


});
