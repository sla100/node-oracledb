/* eslint-disable linebreak-style */
/* Copyright (c) 2018, Oracle and/or its affiliates. All rights reserved. */

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
 * The node-oracledb test suite uses 'mocha', 'should'.
 * See LICENSE.md for relevant licenses.
 *
 * NAME
 *   162. namedBindParameters.js
 *
 * DESCRIPTION
 *   Test parsing a statement and returns information about it.
 *
 *****************************************************************************/
'use strict';

const oracledb = require('../index');
const dbConfig = require('./dbconfig.js');
const {deepEqual} = require('should');

describe('162.namedBindParameters.js', () => {

  let conn;

  before(async ()=>{
    conn = await oracledb.getConnection(dbConfig);
  });

  after(async ()=> await conn.close());

  describe('Named parameters which need double quotes', () => {

    it('Non-ascii name must be quoted', ()=> conn.getStatementInfo('SELECT 🐘 from DUAL').should.be.rejectedWith(/^ORA-00911: /)); // invalid character

    const sql = 'SELECT :"Name !", :"🐘" FROM DUAL';

    it('Statement info retreive names without quotes', async ()=>{
      const {bindNames} = await conn.getStatementInfo(sql);
      deepEqual(bindNames, ['Name !', '🐘']);
    });

    it('Bind varibles with space requires qoutes', () => conn.execute('SELECT :"Name !" FROM DUAL', {
      'Name !': null,
    }).should.be.rejectedWith(/^ORA-01036: /)); // illegal variable name/number

    it('Bind varibles with non-ascii requires qoutes', async () => await conn.execute('SELECT :" 🐘ż" FROM DUAL', {
      '1 🐘ż': null,
    }).should.be.rejectedWith(/^ORA-01036: /)); // illegal variable name/number

    it('Bind varibles requires qoutes', async () => {
      const {rows} = await conn.execute(sql, {
        '"Name !"': 1,
        '"🐘"': 2,
      });
      deepEqual(rows[0], [1, 2]);
    });


  });

  describe('Named parameters which dont need double quotes', () => {
  });

  /*
  testCase({
    namedBindParameters: ['Unnecessary_Quotes_0$#', 'unnecessary_quotes_0$#', 'UNNECESSARY_QUOTES_0$#', '"UNNECESSARY_QUOTES_0$#"'],
    statementInfoName: 'UNNECESSARY_QUOTES_0$#',
  });

  testCase({
    namedBindParameters: ['"Need Double Quotes !"'],
    statementInfoName: 'Need Double Quotes !',
  });

  testCase({
    namedBindParameters: ['"( ͡° ͜ʖ ͡°)"'],
    statementInfoName: '( ͡° ͜ʖ ͡°)',
  });
*/
  it('Last arguments wins', async ()=>{

    const res1 = await conn.execute('SELECT :name FROM DUAL', {
      name: 1,
      NAME: 2,
      '"NAME"': 3,
    });
    deepEqual(res1.rows, [[3]]);

    const res2 = await conn.execute('SELECT :name FROM DUAL', {
      NAME: 2,
      '"NAME"': 3,
      name: 1,
    });
    deepEqual(res2.rows, [[1]]);

  });

});
