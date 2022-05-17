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
 *   120. urowidProcedureBindAsString3.js
 *
 * DESCRIPTION
 *   Testing UROWID(< 200 bytes) plsql procedure bind inout as String.
 *
 *****************************************************************************/
'use strict';

const oracledb = require('oracledb');
const assert  = require('assert');
const dbConfig = require('./dbconfig.js');
const sql = require('./sqlClone.js');

describe('120. urowidProcedureBindAsString3.js', function() {
  var connection = null;
  var tableName = "nodb_rowid_plsql_inout";
  var insertID = 1;

  var proc_create_table = "BEGIN \n" +
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
      await sql.executeSql(connection, proc_create_table, {}, {});
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

  beforeEach(function() {
    insertID++;
  });

  describe('120.1 PROCEDURE BIND_INOUT as UROWID', function() {
    var proc_create = "CREATE OR REPLACE PROCEDURE nodb_rowid_bind_inout (id_in IN NUMBER, content IN OUT UROWID)\n" +
                      "AS \n" +
                      "BEGIN \n" +
                      "    insert into " + tableName + " (id, content) values (id_in, CHARTOROWID(content)); \n" +
                      "    select content into content from " + tableName + " where id = id_in; \n" +
                      "END nodb_rowid_bind_inout; ";
    var proc_execute = "BEGIN nodb_rowid_bind_inout (:i, :c); END;";
    var proc_drop = "DROP PROCEDURE nodb_rowid_bind_inout";

    before('create procedure', async function() {
      await sql.executeSql(connection, proc_create, {}, {});
    });

    after('drop procedure', async function() {
      await sql.executeSql(connection, proc_drop, {}, {});
    });

    it('120.1.1 works with null', async function() {
      await procedureBindInout(proc_execute, null, null);
    });

    it('120.1.2 works with empty string', async function() {
      await procedureBindInout(proc_execute, "", null);
    });

    it('120.1.3 works with undefined', async function() {
      await procedureBindInout(proc_execute, undefined, null);
    });

    it('120.1.4 works with NaN', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: NaN, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000 }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }

    });

    it('120.1.5 works with extended ROWID', async function() {
      await procedureBindInout(proc_execute, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('120.1.6 works with restricted ROWID', async function() {
      await procedureBindInout(proc_execute, "00000DD5.0000.0101", "00000DD5.0000.0101");
    });

    it('120.1.7 works with string 0', async function() {
      const content = "0";
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: content, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000 }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.equal(err.message.substring(0, 10), "ORA-01410:");
      }
      // ORA-01410: invalid ROWID

    });

    it('120.1.8 works with number 0', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: 0, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000 }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }

    });

    it('120.1.9 works with default bind type/dir - extended ROWID', async function() {
      await procedureBindInout_default(proc_execute, "AAAB1+AADAAAAwPAAA", "AAAB1+AADAAAAwPAAA");
    });

    it('120.1.10 works with default bind type/dir - null value', async function() {
      await procedureBindInout_default(proc_execute, null, null);
    });

    it('120.1.11 works with default bind type/dir - empty string', async function() {
      await procedureBindInout_default(proc_execute, "", null);
    });

    it('120.1.12 works with default bind type/dir - undefined', async function() {
      await procedureBindInout_default(proc_execute, undefined, null);
    });

    it('120.1.13 bind error: NJS-037', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000  }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-037: invalid data type at array index 0 for bind ":c"');
      }

    });

    it('120.1.14 bind error: NJS-052', async function() {
      const bindVar = [ insertID, { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000  }];
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-052: invalid data type at array index 0 for bind position 2');
      }
    });

  });

  describe('120.2 PROCEDURE BIND_INOUT as string', function() {
    var proc_create = "CREATE OR REPLACE PROCEDURE nodb_rowid_bind_inout (id_in IN NUMBER, content IN OUT VARCHAR2)\n" +
                      "AS \n" +
                      "BEGIN \n" +
                      "    insert into " + tableName + " (id, content) values (id_in, CHARTOROWID(content)); \n" +
                      "    select content into content from " + tableName + " where id = id_in; \n" +
                      "END nodb_rowid_bind_inout; ";
    var proc_execute = "BEGIN nodb_rowid_bind_inout (:i, :c); END;";
    var proc_drop = "DROP PROCEDURE nodb_rowid_bind_inout";

    before('create procedure', async function() {
      try {
        await sql.executeSql(connection, proc_create, {}, {});
      } catch (err) {
        assert.fail(err);
      }
    });

    after('drop procedure', async function() {
      try {
        await sql.executeSql(connection, proc_drop, {}, {});
      } catch (err) {
        assert.fail(err);
      }
    });

    it('120.2.1 works with null', async function() {
      await procedureBindInout(proc_execute, null, null);
    });

    it('120.2.2 works with empty string', async function() {
      await procedureBindInout(proc_execute, "", null);
    });

    it('120.2.3 works with undefined', async function() {
      await procedureBindInout(proc_execute, undefined, null);
    });

    it('120.2.4 works with NaN', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: NaN, type: oracledb.STRING, dir: oracledb.BIND_INOUT }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }
    });

    it('120.2.5 works with extended ROWID', async function() {
      await procedureBindInout(proc_execute, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('120.2.6 works with restricted ROWID', async function() {
      await procedureBindInout(proc_execute, "00000DD5.0000.0101", "00000DD5.0000.0101");
    });

    it('120.2.7 works with string 0', async function() {
      await procedureBindInout(proc_execute, "0", "00000000.0000.0000");
    });

    it('120.2.8 works with number 0', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: 0, type: oracledb.STRING, dir: oracledb.BIND_INOUT }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-011: encountered bind value and type mismatch');
      }

    });

    it('120.2.9 works with default bind type/dir - extended ROWID', async function() {
      await procedureBindInout_default(proc_execute, "AAAB1+AADAAAAwPAAA", "AAAB1+AADAAAAwPAAA");
    });

    it('120.2.10 works with default bind type/dir - null value', async function() {
      await procedureBindInout_default(proc_execute, null, null);
    });

    it('120.2.11 works with default bind type/dir - empty string', async function() {
      await procedureBindInout_default(proc_execute, "", null);
    });

    it('120.2.12 works with default bind type/dir - undefined', async function() {
      await procedureBindInout_default(proc_execute, undefined, null);
    });

    it('120.2.13 bind error: NJS-037', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c: { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000  }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-037: invalid data type at array index 0 for bind ":c"');
      }
    });

    it('120.2.14 bind error: NJS-052', async function() {
      const bindVar = [ insertID, { val: [0], type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxArraySize: 1000  }];
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.strictEqual(err.message, 'NJS-052: invalid data type at array index 0 for bind position 2');
      }
    });

  });
  describe('120.3 PROCEDURE BIND_INOUT, UPDATE', function() {
    var proc_create = "CREATE OR REPLACE PROCEDURE nodb_rowid_bind_1083 (id_in IN NUMBER, content_1 IN OUT UROWID, content_2 IN OUT UROWID)\n" +
                      "AS \n" +
                      "BEGIN \n" +
                      "    insert into " + tableName + " (id, content) values (id_in, CHARTOROWID(content_1)); \n" +
                      "    update " + tableName + " set content = content_2 where id = id_in; \n" +
                      "    select content into content_1 from " + tableName + " where id = id_in; \n" +
                      "END nodb_rowid_bind_1083; ";
    var proc_execute = "BEGIN nodb_rowid_bind_1083 (:i, :c1, :c2); END;";
    var proc_drop = "DROP PROCEDURE nodb_rowid_bind_1083";

    before('create procedure', async function() {
      try {
        await sql.executeSql(connection, proc_create, {}, {});
      } catch (err) {
        assert.ifError(err);
      }

    });

    after('drop procedure', async function() {
      try {
        await sql.executeSql(connection, proc_drop, {}, {});
      } catch (err) {
        assert.ifError(err);
      }
    });

    it('120.3.1 update null with UROWID', async function() {
      await procedureBindInout_update(proc_execute, null, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('120.3.2 update empty string with UROWID', async function() {
      await procedureBindInout_update(proc_execute, "", "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('120.3.3 update undefined with UROWID', async function() {
      await procedureBindInout_update(proc_execute, undefined, "AAAB12AADAAAAwPAAA", "AAAB12AADAAAAwPAAA");
    });

    it('120.3.4 works with default bind type/dir', async function() {
      const bindVar = {
        i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
        c1: { val: "AAAB1+AADAAAAwPAAA", type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  },
        c2: { val: "0", type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  }
      };
      try {
        await sql.executeSqlWithErr(connection, proc_execute, bindVar, {});
      } catch (err) {
        assert.equal(err.message.substring(0, 10), "ORA-01410:");
      }
      // ORA-01410: invalid ROWID
    });

    it('120.3.5 works with default bind type/dir - null value', async function() {
      await procedureBindInout_update_default(proc_execute, "AAAB12AADAAAAwPAAA", null, null);
    });

    it('120.3.6 works with default bind type/dir - empty string', async function() {
      await procedureBindInout_update_default(proc_execute, "AAAB12AADAAAAwPAAA", "", null);
    });

    it('120.3.7 works with default bind type/dir - undefined', async function() {
      await procedureBindInout_update_default(proc_execute, "AAAB12AADAAAAwPAAA", undefined, null);
    });

  });

  var procedureBindInout = async function(proc_execute, content_in, expected) {
    const bindVar_out = {
      i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
      c: { val: content_in, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000 }
    };
    const result = await connection.execute(proc_execute, bindVar_out);
    assert(result);
    const resultVal = result.outBinds.c;
    assert.strictEqual(resultVal, expected);
  };

  var procedureBindInout_default = async function(proc_execute, content_in, expected) {
    const bindVar_out = {
      i: insertID,
      c: { val: content_in, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  }
    };
    const result = await connection.execute(proc_execute, bindVar_out);
    assert(result);
    const resultVal = result.outBinds.c;
    assert.strictEqual(resultVal, expected);
  };

  var procedureBindInout_update = async function(proc_execute, content_1, content_2, expected) {
    const bindVar_in = {
      i: { val: insertID, type: oracledb.NUMBER, dir: oracledb.BIND_IN },
      c1: { val: content_1, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  },
      c2: { val: content_2, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  }
    };
    const result = await connection.execute(proc_execute, bindVar_in);
    assert(result);
    const resultVal = result.outBinds.c2;
    assert.strictEqual(resultVal, expected);
  };

  var procedureBindInout_update_default = async function(proc_execute, content_1, content_2, expected) {
    const bindVar_in = {
      i: insertID,
      c1: { val: content_1, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  },
      c2: { val: content_2, type: oracledb.STRING, dir: oracledb.BIND_INOUT, maxSize: 1000  }
    };
    const result = await connection.execute(proc_execute, bindVar_in);
    assert(result);
    const resultVal = result.outBinds.c2;
    assert.strictEqual(resultVal, expected);
  };
});
