/* Copyright (c) 2019, 2022, Oracle and/or its affiliates. */

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
 *   221. connectionClass.js
 *
 * DESCRIPTION
 *   Test "oracledb.connectionClass".
 *
 *****************************************************************************/
'use strict';

const oracledb  = require('oracledb');
const assert    = require('assert');
const dbconfig  = require('./dbconfig.js');

describe('221. connectionClass.js', () => {

  after(() => {
    oracledb.connectionClass = '';
  });

  it('221.1 set the property when using a connection pool', async () => {
    try {
      oracledb.connectionClass = 'NODB_TEST';
      const pool = await oracledb.createPool(dbconfig);
      const conn = await pool.getConnection();

      const result = await conn.execute('SELECT (1+4) FROM DUAL');
      assert.strictEqual(result.rows[0][0], 5);

      await conn.close();
      await pool.close();

    } catch (err) {
      assert.fail(err);
    }
  }); // 221.1

  it('221.2 set the property when using a standalone connection', async () => {
    try {
      oracledb.connectionClass = 'NODB_TEST';
      const conn = await oracledb.getConnection(dbconfig);

      await conn.close();
    } catch (err) {
      assert.fail(err);
    }
  }); // 221.2
});
