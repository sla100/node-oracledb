/* Copyright (c) 2017, 2022, Oracle and/or its affiliates. */

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
 *   122. urowidFunctionBindAsString2.js
 *
 * DESCRIPTION
 *   Testing UROWID(< 200 bytes) plsql function bind inout as String.
 *
 *****************************************************************************/
'use strict';

var oracledb = require('oracledb');
var assert   = require('assert');
var dbConfig = require('./dbconfig.js');
var sql      = require('./sqlClone.js');

describe('122. urowidFunctionBindAsString2.js', function() {
  var connection = null;
  var tableName = "nodb_rowid_plsql_inout";
  var insertID = 1;

  var fun_create_table = "BEGIN \n" +
                          "    DECLARE \n" +
                          "        e_table_missing EXCEPTION; \n" +
                          "        PRAGMA EXCEPTION_INIT(e_table_missing, -00942);\n" +
                          "    BEGIN \n" +
                          "        EXECUTE IMMEDIATE ('DROP TABLE " + tableName + " PURGE' ); \n" +
                          "    EXCEPTION \n" +
                          "        WHEN e_table_missing \n" +
                          "        THEN NULL; \n" +
                          "    END; \n" +
                          "    EXECUTE IMMEDIATE ( ' \n" +
                          "        CREATE TABLE " + tableName + " ( \n" +
                          "            ID       NUMBER, \n" +
                          "            content  UROWID \n" +
                          "        ) \n" +
                          "    '); \n" +
                          "END;  ";
  var drop_table = "DROP TABLE " + tableName + " PURGE";

  before('get connection and create table', async function() {
    try {
      connection = await oracledb.getConnection(dbConfig);
      assert(connection);
      await sql.executeSql(connection, fun_create_table, {}, {});
    } catch (err) {
      assert.ifError(err);
    }

  });

  after('release connection', async function() {
    try {
      await sql.executeSql(connection, drop_table, {}, {});
      await connection.release();
    } catch (err) {
      assert.ifError(err);
    }

  });

  beforeEach(function(done) {
    insertID++;
    done();
  });

  describe('122.1 FUNCTION BIND_INOUT as UROWID', function() {
    var fun_create = "CREATE OR REPLACE FUNCTION nodb_rowid_bind_inout_1121 (id_in IN NUMBER, content_inout IN OUT UROWID) RETURN UROWID\n" +
                     "IS \n" +
                     "    tmp UROWID; \n" +
                     "BEGIN \n" +
                     "    insert into " + tableName + " (id, content) values (id_in, CHARTOROWID(content_inout)); \n" +
                     "    select content into tmp from " + tableName + " where id = id_in; \n" +
                     "    select CHARTOROWID('AAACiZAAFAAAAJEAAA') into content_inout from dual; \n" +
                     "    return tmp; \n" +
                     "END; ";
    var fun_execute = "BEGIN :o := nodb_rowid_bind_inout_1121 (:i, :c); END;";
    var fun_drop = "DROP FUNCTION nodb_rowid_bind_inout_1121";

    before('create procedure', async function() {
      try {
        await sql.executeSql(connection, fun_create, {}, {});
      } catch (err) {
        assert.ifError(err);
      }
    });

    after('drop procedure', async function() {
      try {
        await sql.executeSql(connection, fun_drop, {}, {});
      } catch (err) {
        assert.ifError(err);
      }
    });

    it('122.1.1 works with null', async function() {
      await funBindInOut(fun_execute, null, null);
    });

    it('122.1.2 works with empty string', async function() {
      await funBindInOut(fun_execute, "", null);
    });

    it('122.1.3 works with undefined', async function() {

      await funBindInOut(fun_execute, undefined, null);
    });

    it('122.1.4 works with NaN', async function() {
      const content = NaN;
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_create, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }
    });

    it('122.1.5 works with extended ROWID', async function() {

      await funBindInOut(fun_execute, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('122.1.6 works with restricted ROWID', async function() {
      await funBindInOut(fun_execute, "00000DD5.0000.0101", "00000DD5.0000.0101");
    });

    it('122.1.7 works with string 0', async function() {
      const content = "0";

      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.equal(err.message.substring(0, 10), "ORA-01410:");
      }
    });

    it('122.1.8 works with number 0', async function() {
      const content = 0;
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }


    });

    it('122.1.9 works with default bind type/dir - extended ROWID', async function() {

      await funBindInOut_default(fun_execute, "AAAB1+AADAAAAwPAAA", "AAAB1+AADAAAAwPAAA");
    });

    it('122.1.10 works with default bind type/dir - null value', async function() {
      await funBindInOut_default(fun_execute, null, null);
    });

    it('122.1.11 works with default bind type/dir - empty string', async function() {
      await funBindInOut_default(fun_execute, "", null);
    });

    it('122.1.12 works with default bind type/dir - undefined', async function() {
      await funBindInOut_default(fun_execute, undefined, null);
    });

    it('122.1.13 bind error: NJS-037', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000 },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-037: invalid data type at array index 0 for bind ":c"');
      }
    });

    it('122.1.14 bind error: NJS-052', async function() {
      const bindVar = [ { type: oracledb.STRING, dir: oracledb.BIND_OUT }, insertID, { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000 } ];

      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-052: invalid data type at array index 0 for bind position 3');
      }
    });

  });

  describe('122.2 FUNCTION BIND_INOUT as string', function() {
    var fun_create = "CREATE OR REPLACE FUNCTION nodb_rowid_bind_inout_1121 (id_in IN NUMBER, content_inout IN OUT VARCHAR2) RETURN UROWID\n" +
                     "IS \n" +
                     "    tmp UROWID; \n" +
                     "BEGIN \n" +
                     "    insert into " + tableName + " (id, content) values (id_in, CHARTOROWID(content_inout)); \n" +
                     "    select content into tmp from " + tableName + " where id = id_in; \n" +
                     "    select CHARTOROWID('AAACiZAAFAAAAJEAAA') into content_inout from dual; \n" +
                     "    return tmp; \n" +
                     "END; ";
    var fun_execute = "BEGIN :o := nodb_rowid_bind_inout_1121 (:i, :c); END;";
    var fun_drop = "DROP FUNCTION nodb_rowid_bind_inout_1121";

    before('create procedure', async function() {
      try {
        await sql.executeSql(connection, fun_create, {}, {});
      } catch (err) {
        assert.ifError(err);
      }
    });

    after('drop procedure', async function() {
      try {
        await sql.executeSql(connection, fun_drop, {}, {});
      } catch (err) {
        assert.ifError(err);
      }

    });

    it('122.2.1 works with null', async function() {
      await funBindInOut(fun_execute, null, null);
    });

    it('122.2.2 works with empty string', async function() {
      await funBindInOut(fun_execute, "", null);
    });

    it('122.2.3 works with undefined', async function() {
      await funBindInOut(fun_execute, undefined, null);
    });

    it('122.2.4 works with NaN', async function() {
      const content = NaN;
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }
    });

    it('122.2.5 works with extended ROWID', async function() {
      await funBindInOut(fun_execute, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('122.2.6 works with restricted ROWID', async function() {
      await funBindInOut(fun_execute, "00000DD5.0000.0101", "00000DD5.0000.0101");
    });

    it('122.2.7 works with string 0', async function() {
      await funBindInOut(fun_execute, "0", "00000000.0000.0000");
    });

    it('122.2.8 works with number 0', async function() {
      const content = 0;
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }
    });

    it('122.2.9 works with default bind type/dir - extended ROWID', async function() {
      await funBindInOut_default(fun_execute, "AAAB1+AADAAAAwPAAA", "AAAB1+AADAAAAwPAAA");
    });

    it('122.2.10 works with default bind type/dir - null value', async function() {
      await funBindInOut_default(fun_execute, null, null);
    });

    it('122.2.11 works with default bind type/dir - empty string', async function() {
      await funBindInOut_default(fun_execute, "", null);
    });

    it('122.2.12 works with default bind type/dir - undefined', async function() {
      await funBindInOut_default(fun_execute, undefined, null);
    });

    it('122.2.13 bind error: NJS-037', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000 },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-037: invalid data type at array index 0 for bind ":c"');
      }
    });

    it('122.2.14 bind error: NJS-052', async function() {
      const bindVar = [ { type: oracledb.STRING, dir: oracledb.BIND_OUT }, insertID, { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000 } ];
      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-052: invalid data type at array index 0 for bind position 3');
      }
    });

  });

  describe('122.3 FUNCTION BIND_INOUT, UPDATE', function() {
    var fun_create = "CREATE OR REPLACE FUNCTION nodb_rowid_bind_1083 (id_in IN NUMBER, content_1 IN OUT VARCHAR2, content_2 IN OUT UROWID) RETURN UROWID\n" +
                     "IS \n" +
                     "    tmp UROWID; \n" +
                     "BEGIN \n" +
                     "    insert into " + tableName + " (id, content) values (id_in, CHARTOROWID(content_1)); \n" +
                     "    update " + tableName + " set content = content_2 where id = id_in; \n" +
                     "    select content into tmp from " + tableName + " where id = id_in; \n" +
                     "    select CHARTOROWID('AAACiZAAFAAAAJEAAA') into content_1 from dual; \n" +
                     "    return tmp; \n" +
                     "END; ";
    var fun_execute = "BEGIN :o := nodb_rowid_bind_1083 (:i, :c1, :c2); END;";
    var fun_drop = "DROP FUNCTION nodb_rowid_bind_1083";

    before('create procedure', async function() {
      try {
        await sql.executeSql(connection, fun_create, {}, {});
      } catch (err) {
        assert.ifError(err);
      }
    });

    after('drop procedure', async function() {
      try {
        await sql.executeSql(connection, fun_drop, {}, {});
      } catch (err) {
        assert.ifError(err);
      }
    });

    it('122.3.1 update null with UROWID', async function() {
      await funBindInOut_update(fun_execute, null, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('122.3.2 update empty string with UROWID', async function() {
      await funBindInOut_update(fun_execute, "", "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('122.3.3 update undefined with UROWID', async function() {
      await funBindInOut_update(fun_execute, undefined, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('122.3.4 works with default bind type/dir', async function() {
      const content_1 = "AAAB1+AADAAAAwPAAA";
      const content_2 = "0";
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c1: { val: content_1, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        c2: { val: content_2, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
        o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
      };

      try {
        await sql.executeSqlWithErr(connection, fun_execute, bindVar, {});
      } catch (err) {
        assert.equal(err.message.substring(0, 10), "ORA-01410:");
      }
      // ORA-01410: invalid ROWID
    });

    it('122.3.5 works with default bind type/dir - null value', async function() {
      await funBindInOut_update_default(fun_execute, "AAAB12AADAAAAwPAAA", null, null);
    });

    it('122.3.6 works with default bind type/dir - empty string', async function() {
      await funBindInOut_update_default(fun_execute, "AAAB12AADAAAAwPAAA", "", null);
    });

    it('122.3.7 works with default bind type/dir - undefined', async function() {
      await funBindInOut_update_default(fun_execute, "AAAB12AADAAAAwPAAA", undefined, null);
    });

  });

  var funBindInOut = async function(fun_exec, content_in, expected) {
    const bindVar_in = {
      i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
      c: { val: content_in, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    try {
      const result = await connection.execute(fun_exec, bindVar_in);
      const resultVal_1 = result.outBinds.c;
      const resultVal_2 = result.outBinds.o;
      assert.strictEqual(resultVal_2, expected);
      assert.strictEqual(resultVal_1, "AAACiZAAFAAAAJEAAA");
    } catch (err) {
      assert.ifError(err);
    }

  };

  var funBindInOut_default = async function(fun_exec, content_in, expected) {
    const bindVar_in = {
      i: insertID,
      c: { val: content_in, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    try {
      const result = await connection.execute(fun_exec, bindVar_in);
      const resultVal_1 = result.outBinds.c;
      const resultVal_2 = result.outBinds.o;
      assert.strictEqual(resultVal_2, expected);
      assert.strictEqual(resultVal_1, "AAACiZAAFAAAAJEAAA");
    } catch (err) {
      assert.ifError(err);
    }
  };

  var funBindInOut_update = async function(fun_exec, content_1, content_2, expected) {
    const bindVar_in = {
      i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
      c1: { val: content_1, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
      c2: { val: content_2, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    try {
      const result = await connection.execute(fun_exec, bindVar_in);
      const resultVal_1 = result.outBinds.c1;
      const resultVal_2 = result.outBinds.o;
      assert.strictEqual(resultVal_2, expected);
      assert.strictEqual(resultVal_1, "AAACiZAAFAAAAJEAAA");
    } catch (err) {
      assert.ifError(err);
    }
  };

  var funBindInOut_update_default = async function(fun_exec, content_1, content_2, expected) {
    const bindVar_in = {
      i: insertID,
      c1: { val: content_1, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
      c2: { val: content_2, type: oracledb.STRING, dir: oracledb.BIND_INOUT },
      o: { type: oracledb.STRING, dir: oracledb.BIND_OUT }
    };
    try {
      const result = await connection.execute(fun_exec, bindVar_in);
      const resultVal_1 = result.outBinds.c1;
      const resultVal_2 = result.outBinds.o;
      assert.strictEqual(resultVal_2, expected);
      assert.strictEqual(resultVal_1, "AAACiZAAFAAAAJEAAA");
    } catch (err) {
      assert.ifError(err);
    }
  };

});
