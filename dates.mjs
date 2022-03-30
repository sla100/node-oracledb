import oracledb from 'oracledb';
import {deepStrictEqual} from 'node:assert/strict';

const conn = await oracledb.getConnection({
  user: 'inesadm',
  password: 'inesadm',
  connectString: 'host.docker.internal/xepdb1',
});

await conn.execute("ALTER SESSION SET NLS_TERRITORY = 'SPAIN'" );  // Yes, not all people live in the US 
const {rows} = await conn.execute(`
  SELECT 38.73 AS TEMPERATURE, -- SQL literals only use periods 
         1999.99 AS PRICE
   FROM DUAL
  `, {}, {
  fetchInfo: {
    PRICE:{ type: oracledb.STRING },
  },
  outFormat: oracledb.OUT_FORMAT_OBJECT, // Suppose the price is to be shown according to the user's location 
});

deepStrictEqual( rows[0], {
  TEMPERATURE: 38.730000000000004,  // Yes, double conversion NUMBER -> double -> number has some limitations
  PRICE: '1999,99',
});
