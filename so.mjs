import { strictEqual, deepStrictEqual } from 'node:assert';
import oracledb from './index.js';

strictEqual(process.versions.node, '16.13.1' );
strictEqual(oracledb.versionString, '5.3.0' );
strictEqual(oracledb.oracleClientVersionString, '21.3.0.0.0');

// fetch (javascript) type
strictEqual(oracledb.DEFAULT, 0);
strictEqual(oracledb.STRING, 2001);
strictEqual(oracledb.BUFFER, 2006);
strictEqual(oracledb.DATE, 2014);
strictEqual(oracledb.ISO_STRING, 1999); 

strictEqual(oracledb.DB_TYPE_DATE, 2011);
strictEqual(oracledb.DB_TYPE_TIMESTAMP, 2012);
strictEqual(oracledb.DB_TYPE_TIMESTAMP_LTZ, 2014);
strictEqual(oracledb.DB_TYPE_TIMESTAMP_TZ, 2013);

const conn = await oracledb.getConnection({
  user: 'inesadm',
  password: 'inesadm',
  connectString: 'host.docker.internal/xepdb1',
});

strictEqual(conn.oracleServerVersionString, '21.3.0.0.0');

await conn.execute("ALTER SESSION SET NLS_NUMERIC_CHARACTERS = ', '"); // group separator work only in to_char with 'G' char

const numRes = await conn.execute(`SELECT 
    38.73 AS DEFAUT,
  1038.73 AS AS_STRING,
  1038.73 AS AS_ISO,
  TO_CHAR( 1038.73, 'FM999G999G999D999' ) AS AS_CHAR
  FROM DUAL`, {}, {
    fetchInfo: {
      AS_STRING: { type: oracledb.STRING },
      AS_ISO: { type: oracledb.ISO_STRING },
    },
    outFormat: oracledb.OUT_FORMAT_OBJECT,
  }
);

deepStrictEqual(
  numRes.rows[0], 
  { 
    DEFAUT: 38.730000000000004, 
    AS_STRING: '1038,73', 
    AS_CHAR: '1 038,73',
    AS_ISO: '1038.73',
  }
);

console.log(numRes.rows[0]);