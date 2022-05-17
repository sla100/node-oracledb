/* Copyright (c) 2018, 2022, Oracle and/or its affiliates. */

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
 *   deferLibInit3.js
 *
 * DESCRIPTION
 *   Testing late loading of Oracle Client libraries
 *
 *****************************************************************************/

const oracledb = require('oracledb');
const assert   = require('assert');
const testsUtil = require('./testsUtil.js');
const dbconfig = require('./dbconfig.js');

describe('deferLibInit3.js', () => {

  it('child process #3 of test/deferLibInit.js', async () => {
    delete process.env.ORACLE_HOME;

    let conn;
    await testsUtil.assertThrowsAsync(
      async () => conn = await oracledb.getConnection(dbconfig),
      /DPI-1047:/
    );
    // DPI-1047: 64-bit Oracle Client library cannot be loaded...

    assert.ifError(conn);
  });
});
