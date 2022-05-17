/* Copyright (c) 2015, 2022, Oracle and/or its affiliates. */

/******************************************************************************
 *
 * You may not use the identified files except in compliance with the Apache
 * License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0.
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * NAME
 *   1. connection.js
 *
 * DESCRIPTION
 *   Testing a basic connection to the database.
 *
 *****************************************************************************/
'use strict';

const oracledb = require('oracledb');
const assert   = require('assert');
const dbConfig = require('./dbconfig.js');

describe('1. connection.js', function() {

  const credentials = {
    user:          dbConfig.user,
    password:      dbConfig.password,
    connectString: dbConfig.connectString
  };

  describe('1.1 can run SQL query with different output formats', function() {

    var connection = null;
    const script =
      "BEGIN \
          DECLARE \
              e_table_missing EXCEPTION; \
              PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \
          BEGIN \
              EXECUTE IMMEDIATE ('DROP TABLE nodb_conn_dept1 PURGE'); \
          EXCEPTION \
              WHEN e_table_missing \
              THEN NULL; \
          END; \
          EXECUTE IMMEDIATE (' \
              CREATE TABLE nodb_conn_dept1 ( \
                  department_id NUMBER,  \
                  department_name VARCHAR2(20) \
              ) \
          '); \
          EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_dept1  \
                   (department_id, department_name) VALUES \
                   (40,''Human Resources'') \
          '); \
          EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_dept1  \
                   (department_id, department_name) VALUES \
                   (20, ''Marketing'') \
          '); \
      END; ";

    before(async function() {
      try {
        connection = await oracledb.getConnection(credentials);
        assert(connection);
        await connection.execute(script);
      } catch (error) {
        assert.fail(error);
      }
    });

    after(async function() {
      try {
        await connection.execute('DROP TABLE nodb_conn_dept1 PURGE');
        await connection.release();
      } catch (error) {
        assert.fail(error);
      }
    });

    const query = "SELECT department_id, department_name " +
                "FROM nodb_conn_dept1 " +
                "WHERE department_id = :id";

    it('1.1.1 ARRAY format by default', async function() {
      try {
        const defaultFormat = oracledb.outFormat;
        assert.strictEqual(defaultFormat, oracledb.OUT_FORMAT_ARRAY);
        assert(connection);
        const result = await connection.execute(query, [40]);
        assert(result);
        assert.deepStrictEqual(result.rows, [[ 40, 'Human Resources' ]]);
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.1.2 ARRAY format explicitly', async function() {
      try {
        assert(connection);
        const result = await connection.execute(query, {id: 20}, {outFormat: oracledb.OUT_FORMAT_ARRAY});
        assert(result);
        assert.deepStrictEqual(result.rows, [[ 20, 'Marketing' ]]);
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.1.3 OBJECT format', async function() {
      try {
        assert(connection);
        const result = await connection.execute(query, {id: 20}, {outFormat: oracledb.OUT_FORMAT_OBJECT});
        assert(result);
        assert.deepStrictEqual(result.rows, [{ DEPARTMENT_ID: 20, DEPARTMENT_NAME: 'Marketing' }]);
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.1.4 Negative test - invalid outFormat value', async function() {
      try {
        assert(connection);
        await assert.rejects(
          async () => {
            await connection.execute(query, {id: 20}, {outFormat:0 });
          },
          /NJS-004:/
        );
      } catch (error) {
        assert.fail(error);
      }
    });
  });

  describe('1.2 can call PL/SQL procedures', function() {
    var connection = false;

    const proc = "CREATE OR REPLACE PROCEDURE nodb_bindingtest (p_in IN VARCHAR2, p_inout IN OUT VARCHAR2, p_out OUT VARCHAR2) "
                + "AS "
                + "BEGIN "
                + "  p_out := p_in || ' ' || p_inout; "
                + "END; ";

    before(async function() {
      try {
        connection = await oracledb.getConnection(credentials);
        await connection.execute(proc);
      } catch (error) {
        assert.fail(error);
      }
    });

    after(async function() {
      try {
        await connection.execute("DROP PROCEDURE nodb_bindingtest");
        await connection.release();
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.2.1 bind parameters in various ways', async function() {
      try {
        const bindValues = {
          i: 'Alan', // default is type STRING and direction Infinity
          io: { val: 'Turing', type: oracledb.STRING, dir: oracledb.BIND_INOUT },
          o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
        };
        assert(connection);
        const result = await connection.execute("BEGIN nodb_bindingtest(:i, :io, :o); END;", bindValues);
        assert(result);
        assert.strictEqual(result.outBinds.io, 'Turing');
        assert.strictEqual(result.outBinds.o, 'Alan Turing');
      } catch (error) {
        assert.fail(error);
      }
    });
  });

  describe('1.3 statementCacheSize controls statement caching', function() {
    const makeTable =
        "BEGIN \
            DECLARE \
                e_table_missing EXCEPTION; \
                PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \
            BEGIN \
                EXECUTE IMMEDIATE ('DROP TABLE nodb_conn_emp4 PURGE'); \
            EXCEPTION \
                WHEN e_table_missing \
                THEN NULL; \
            END; \
            EXECUTE IMMEDIATE (' \
                CREATE TABLE nodb_conn_emp4 ( \
                    id NUMBER,  \
                    name VARCHAR2(4000) \
                ) \
            '); \
            EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_emp4  \
                   VALUES \
                   (1001,''Chris Jones'') \
            '); \
            EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_emp4  \
                   VALUES \
                   (1002,''Tom Kyte'') \
            '); \
            EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_emp4  \
                   VALUES \
                   (2001, ''Karen Morton'') \
            '); \
        END; ";

    var connection = false;
    const defaultStmtCache = oracledb.stmtCacheSize; // 30

    beforeEach('get connection and prepare table', async function() {
      try {
        connection = await oracledb.getConnection(credentials);
        await connection.execute(makeTable);
      } catch (error) {
        assert.fail(error);
      }
    });

    afterEach('drop table and release connection', async function() {
      try {
        oracledb.stmtCacheSize = defaultStmtCache;
        await connection.execute("DROP TABLE nodb_conn_emp4 PURGE");
        await connection.release();
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.3.1 stmtCacheSize = 0, which disable statement caching', async function() {
      try {
        assert(connection);
        oracledb.stmtCacheSize = 0;

        await connection.execute("INSERT INTO nodb_conn_emp4 VALUES (:num, :str)",
          { num: 1003, str: 'Robyn Sands' },
          { autoCommit: true });
        await connection.execute("INSERT INTO nodb_conn_emp4 VALUES (:num, :str)",
          { num: 1004, str: 'Bryant Lin' },
          { autoCommit: true });
        await connection.execute("INSERT INTO nodb_conn_emp4 VALUES (:num, :str)",
          { num: 1005, str: 'Patrick Engebresson' },
          { autoCommit: true });
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.3.2 works well when statement cache enabled (stmtCacheSize > 0) ', async function() {
      try {
        assert(connection);
        oracledb.stmtCacheSize = 100;

        await connection.execute("INSERT INTO nodb_conn_emp4 VALUES (:num, :str)",
          { num: 1003, str: 'Robyn Sands' },
          { autoCommit: true });
        await connection.execute("INSERT INTO nodb_conn_emp4 VALUES (:num, :str)",
          { num: 1004, str: 'Bryant Lin' },
          { autoCommit: true });
        await connection.execute("INSERT INTO nodb_conn_emp4 VALUES (:num, :str)",
          { num: 1005, str: 'Patrick Engebresson' },
          { autoCommit: true });
      } catch (error) {
        assert.fail(error);
      }
    });

  });

  describe('1.4 Testing commit() & rollback() functions', function() {
    const makeTable =
        "BEGIN \
            DECLARE \
                e_table_missing EXCEPTION; \
                PRAGMA EXCEPTION_INIT(e_table_missing, -00942); \
            BEGIN \
                EXECUTE IMMEDIATE ('DROP TABLE nodb_conn_emp5 PURGE'); \
            EXCEPTION \
                WHEN e_table_missing \
                THEN NULL; \
            END; \
            EXECUTE IMMEDIATE (' \
                CREATE TABLE nodb_conn_emp5 ( \
                    id NUMBER,  \
                    name VARCHAR2(4000) \
                ) \
            '); \
            EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_emp5  \
                   VALUES \
                   (1001,''Tom Kyte'') \
            '); \
            EXECUTE IMMEDIATE (' \
              INSERT INTO nodb_conn_emp5  \
                   VALUES \
                   (1002, ''Karen Morton'') \
            '); \
        END; ";

    var conn1 = false;
    var conn2 = false;
    beforeEach('get 2 connections and create the table', async function() {
      try {
        conn1 = await oracledb.getConnection(credentials);
        conn2 = await oracledb.getConnection(credentials);
        assert(conn1);
        await conn1.execute(makeTable, [], { autoCommit: true });
      } catch (error) {
        assert.fail(error);
      }
    });

    afterEach('drop table and release connections', async function() {
      try {
        assert(conn1);
        assert(conn2);
        await conn2.execute("DROP TABLE nodb_conn_emp5 PURGE");
        await conn1.release();
        await conn2.release();
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.4.1 commit() function works well', async function() {
      try {
        await conn2.execute("INSERT INTO nodb_conn_emp5 VALUES (:num, :str)",
          { num: 1003, str: 'Patrick Engebresson' });
        let result = await conn1.execute("SELECT COUNT(*) FROM nodb_conn_emp5");
        assert(result);
        assert.strictEqual(result.rows[0][0], 2);
        result = await conn2.execute("SELECT COUNT(*) FROM nodb_conn_emp5");
        assert.strictEqual(result.rows[0][0], 3);
        await conn2.commit();
        result = await conn1.execute("SELECT COUNT(*) FROM nodb_conn_emp5");
        assert.strictEqual(result.rows[0][0], 3);
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.4.2 rollback() function works well', async function() {
      try {
        await conn2.execute("INSERT INTO nodb_conn_emp5 VALUES (:num, :str)",
          { num: 1003, str: 'Patrick Engebresson' });

        var result = await conn1.execute("SELECT COUNT(*) FROM nodb_conn_emp5");
        assert(result);
        assert.strictEqual(result.rows[0][0], 2);

        result = await conn2.execute("SELECT COUNT(*) FROM nodb_conn_emp5");
        assert.strictEqual(result.rows[0][0], 3);
        await conn2.rollback();
        result = await conn2.execute("SELECT COUNT(*) FROM nodb_conn_emp5");
        assert.strictEqual(result.rows[0][0], 2);
      } catch (error) {
        assert.fail(error);
      }
    });
  });

  describe('1.5 Close method', function() {

    it('1.5.1 close can be used as an alternative to release', async function() {
      try {
        const conn = await oracledb.getConnection(credentials);
        await conn.close();
      } catch (error) {
        assert.fail(error);
      }
    });
  });

  describe('1.6 connectionString alias', function() {

    it('1.6.1 allows connectionString to be used as an alias for connectString', async function() {
      try {
        const connection = await oracledb.getConnection({
          user: dbConfig.user,
          password: dbConfig.password,
          connectionString: dbConfig.connectString
        });
        assert(connection);
        await connection.close();
      } catch (error) {
        assert.fail(error);
      }
    });

  });

  describe('1.7 privileged connections', function() {

    it('1.7.1 Negative value - null', async function() {
      try {
        const credential = {
          user: dbConfig.user,
          password: dbConfig.password,
          connectString: dbConfig.connectString,
          privilege: null
        };
        await assert.rejects(
          async () => {
            await oracledb.getConnection(credential);
          },
          /NJS-007: invalid value for "privilege" in parameter 1/
        );
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.7.2 Negative - invalid type, a String', async function() {
      try {
        const credential = {
          user: dbConfig.user,
          password: dbConfig.password,
          connectString: dbConfig.connectString,
          privilege: 'sysdba'
        };
        await assert.rejects(
          async () => {
            await oracledb.getConnection(credential);
          },
          /NJS-007: invalid value for "privilege" in parameter 1/
        );
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.7.3 Negative value - random constants', async function() {
      try {
        const credential = {
          user: dbConfig.user,
          password: dbConfig.password,
          connectString: dbConfig.connectString,
          privilege: 23
        };

        await assert.rejects(
          async () => {
            await oracledb.getConnection(credential);
          },
          /ORA-24300/
        );// ORA-24300: bad value for mode
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.7.4 Negative value - NaN', async function() {
      try {
        const credential = {
          user: dbConfig.user,
          password: dbConfig.password,
          connectString: dbConfig.connectString,
          privilege: NaN
        };

        await assert.rejects(
          async () => {
            await oracledb.getConnection(credential);
          },
          /NJS-007: invalid value for "privilege" in parameter 1/
        );
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.7.5 gets ignored when acquiring a connection from Pool', async function() {
      try {
        const credential = {
          user: dbConfig.user,
          password: dbConfig.password,
          connectString: dbConfig.connectString,
          privilege: null,
          poolMin: 1
        };
        const pool = await oracledb.createPool(credential);
        const conn = await pool.getConnection();
        await conn.close();
        await pool.close();
      } catch (error) {
        assert.fail(error);
      }
    });

  }); // 1.7

  describe('1.8 Ping method', function() {

    it('1.8.1 ping() checks the connection is usable', async function() {
      try {
        const conn = await oracledb.getConnection(dbConfig);
        assert(conn);
        await conn.ping();
        await conn.close();
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.8.2 closed connection', async function() {
      try {
        const conn = await oracledb.getConnection(dbConfig);
        assert(conn);
        await conn.close();
        await assert.rejects(
          async () => {
            await conn.ping();
          },
          /NJS-003: invalid connection/
        );
      } catch (error) {
        assert.fail(error);
      }
    });
  }); // 1.8


  describe('1.9 connectString & connectionString specified', function() {

    it('1.9.1 both connectString & ConnectionString specified', async function() {
      try {
        const credential = {
          user : dbConfig.user,
          password : dbConfig.password,
          connectString : dbConfig.connectString,
          connectionString : dbConfig.connectString
        };

        await assert.rejects(
          async () => {
            await oracledb.getConnection(credential);
          },
          /NJS-075:/
        );
      } catch (error) {
        assert.fail(error);
      }
    });
  }); //1.9

  describe('1.10 user & username specified', function() {

    it('1.10.1 both user & username specified', async function() {
      try {
        const credential = {
          user : dbConfig.user,
          username : dbConfig.user,
          password : dbConfig.password,
          connectString : dbConfig.connectString
        };

        await assert.rejects(
          async () => {
            await oracledb.getConnection(credential);
          },
          /NJS-080:/
        );
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.10.2 allows username to be used as an alias for user', async function() {
      try {
        const credential = {
          username : dbConfig.user,
          password : dbConfig.password,
          connectString : dbConfig.connectString
        };

        const conn = await oracledb.getConnection(credential);
        assert(conn);
      } catch (error) {
        assert.fail(error);
      }
    });

    it('1.10.3 uses username alias to login with SYSDBA privilege', async function() {
      if (!dbConfig.test.DBA_PRIVILEGE) this.skip();
      try {
        const credential = {
          username : dbConfig.test.DBA_user,
          password : dbConfig.test.DBA_password,
          connectString : dbConfig.connectString,
          privilege : oracledb.SYSDBA
        };

        const conn = await oracledb.getConnection(credential);
        assert(conn);
      } catch (error) {
        assert.fail(error);
      }
    });
  }); //1.10
});
