// Copyright IBM Corp. 2013,2016. All Rights Reserved.
// Node module: loopback-connector-postgresql
// This file is licensed under the Artistic License 2.0.
// License text available at https://opensource.org/licenses/Artistic-2.0

'use strict';
var assert = require('assert');
var _ = require('lodash');
var ds, properties, SimpleEmployee, Emp1, Emp2;

before(function() {
  ds = getDataSource();
});

describe('autoupdate', function() {
  describe('should update properties', function() {
    before(function(done) {
      properties = {
        name: {
          type: String,
        },
        age: {
          type: Number,
        },
        dateJoined: {
          type: String,
        },
      };
      SimpleEmployee = ds.define('SimpleEmployee', properties);
      ds.automigrate(done);
    });

    after(function(done) {
      SimpleEmployee.destroyAll(done);
    });

    it('get old model properties', function(done) {
      ds.discoverModelProperties('simpleemployee', {schema: 'public'},
        function(err, props) {
          assert(!err);
          assert.equal(props[0].dataType, 'text');
          assert.equal(props[1].dataType, 'integer');
          assert.equal(props[2].dataType, 'text');
          done();
        });
    });

    it('perform autoupdate and get new model properties', function(done) {
      properties.age.type = String;
      properties.dateJoined.type = Date;
      SimpleEmployee = ds.define('SimpleEmployee', properties);
      ds.autoupdate(function(err) {
        assert(!err);
        ds.discoverModelProperties('simpleemployee', {schema: 'public'},
          function(err, props) {
            assert(!err);
            assert.equal(props[0].dataType, 'text');
            assert.equal(props[1].dataType, 'text');
            assert.equal(props[2].dataType, 'timestamp with time zone');
            done();
          });
      });
    });
  });

  describe('update model with same table name but different schema', function() {
    before(function(done) {
      properties = {
        name: {
          type: String,
        },
        age: {
          type: Number,
        },
      };
      Emp1 = ds.define('Employee', properties, {
        'postgresql': {
          'table': 'employee',
          'schema': 'schema1',
        }});
      Emp2 = ds.define('Employee1', properties, {
        'postgresql': {
          'table': 'employee',
          'schema': 'schema2',
        }});
      ds.automigrate(done);
    });

    after(function(done) {
      Emp1.destroyAll(function(err) {
        assert(!err);
        Emp2.destroyAll(done);
      });
    });

    it('should autoupdate successfully', function(done) {
      properties['code'] = {
        type: String,
      };
      Emp1 = ds.define('Employee', properties, {
        'postgresql': {
          'table': 'employee',
          'schema': 'schema1',
        }});
      ds.autoupdate('Employee', function(err) {
        assert(!err);
        ds.discoverModelProperties('employee', {schema: 'schema1'},
          function(err, props) {
            assert(!err);
            assert(props);
            props = _.filter(props, function(prop) {
              return prop.columnName === 'code';
            });
            assert(props);
            assert(props[0].columnName);
            assert.equal(props[0].columnName, 'code');
            assert.equal(props[0].dataType, 'text');
            ds.discoverModelProperties('employee', {schema: 'schema2'},
              function(err, props) {
                assert(!err);
                assert(props);
                props = _.filter(props, function(prop) {
                  return prop.columnName === 'code';
                });
                assert.equal(props.length, 0);
                done();
              });
          });
      });
    });
  });

  it('should auto migrate/update tables', function(done) {
    var schema_v1 =
      {
        'name': 'CustomerTest',
        'options': {
          'idInjection': false,
          'postgresql': {
            'schema': 'public',
            'table': 'customer_test',
          },
        },
        'properties': {
          'id': {
            'type': 'String',
            'length': 20,
            'id': 1,
          },
          'name': {
            'type': 'String',
            'required': false,
            'length': 40,
          },
          'email': {
            'type': 'String',
            'required': true,
            'length': 40,
            'index': {
              'unique': false,
              'type': 'hash',
            },
          },
          'age': {
            'type': 'Number',
            'required': false,
          },
        },
      };

    var schema_v2 =
      {
        'name': 'CustomerTest',
        'options': {
          'idInjection': false,
          'postgresql': {
            'schema': 'public',
            'table': 'customer_test',
          },
        },
        'properties': {
          'id': {
            'type': 'String',
            'length': 20,
            'id': 1,
            'index': {'unique': true},
          },
          'email': {
            'type': 'String',
            'required': false,
            'length': 60,
            'postgresql': {
              'columnName': 'email',
              'dataType': 'varchar',
              'dataLength': 60,
              'nullable': 'YES',
            },
            'index': true,
          },
          'firstName': {
            'type': 'String',
            'required': false,
            'length': 40,
            'index': true,
          },
          'lastName': {
            'type': 'String',
            'required': false,
            'length': 40,
          },
        },
      };

    ds.createModel(schema_v1.name, schema_v1.properties, schema_v1.options);

    ds.automigrate(function() {
      ds.discoverModelProperties('customer_test', function(err, props) {
        assert.equal(props.length, 4);
        var names = props.map(function(p) {
          return p.columnName;
        });
        assert.equal(props[0].nullable, 'NO');
        assert.equal(props[1].nullable, 'YES');
        assert.equal(props[2].nullable, 'NO');
        assert.equal(props[3].nullable, 'YES');
        assert.equal(names[0], 'id');
        assert.equal(names[1], 'name');
        assert.equal(names[2], 'email');
        assert.equal(names[3], 'age');

        // check indexes
        ds.connector.discoverModelIndexes('CustomerTest', function(err, indexes) {
          assert.deepEqual(indexes, {
            customer_test_email_idx: {
              table: 'customer_test',
              type: 'hash',
              primary: false,
              unique: false,
              keys: ['email'],
              order: ['ASC']},

            customer_test_pkey: {
              table: 'customer_test',
              type: 'btree',
              primary: true,
              unique: true,
              keys: ['id'],
              order: ['ASC']},
          });

          ds.createModel(schema_v2.name, schema_v2.properties, schema_v2.options);

          ds.autoupdate(function(err, result) {
            ds.discoverModelProperties('customer_test', function(err, props) {
              assert.equal(props.length, 4);
              var names = props.map(function(p) {
                return p.columnName;
              });
              assert.equal(names[0], 'id');
              assert.equal(names[1], 'email');
              assert.equal(names[2], 'firstname');
              assert.equal(names[3], 'lastname');

              // verify that indexes have been updated
              ds.connector.discoverModelIndexes('CustomerTest', function(err, indexes) {
                assert.deepEqual(indexes, {
                  customer_test_pkey: {
                    table: 'customer_test',
                    type: 'btree',
                    primary: true,
                    unique: true,
                    keys: ['id'],
                    order: ['ASC']},

                  customer_test_id_idx: {
                    table: 'customer_test',
                    type: 'btree',
                    primary: false,
                    unique: true,
                    keys: ['id'],
                    order: ['ASC']},

                  customer_test_email_idx: {
                    table: 'customer_test',
                    type: 'hash',
                    primary: false,
                    unique: false,
                    keys: ['email'],
                    order: ['ASC']},

                  customer_test_firstname_idx: {
                    table: 'customer_test',
                    type: 'btree',
                    primary: false,
                    unique: false,
                    keys: ['firstname'],
                    order: ['ASC']},
                });

                // console.log(err, result);
                done(err, result);
              });
            });
          });
        });
      });
    });
  });

  it('should report errors for automigrate', function() {
    ds.automigrate('XYZ', function(err) {
      assert(err);
    });
  });

  it('should report errors for autoupdate', function() {
    ds.autoupdate('XYZ', function(err) {
      assert(err);
    });
  });

  it('should produce valid sql for setting column nullability', function(done) {
    // Initial schema
    var schema_v1 =
      {
        'name': 'NamePersonTest',
        'options': {
          'idInjection': false,
          'postgresql': {
            'schema': 'public',
            'table': 'name_person_test',
          },
        },
        'properties': {
          'id': {
            'type': 'String',
            'length': 20,
            'id': 1,
          },
          'name': {
            'type': 'String',
            'required': false,
            'length': 40,
          },
        },
      };

    // Change nullability
    var schema_v2 = JSON.parse(JSON.stringify(schema_v1));
    schema_v2.properties.name.required = true;

    // Create initial schema
    ds.createModel(schema_v1.name, schema_v1.properties, schema_v1.options);
    ds.automigrate(function() {
      // Create updated schema
      ds.createModel(schema_v2.name, schema_v2.properties, schema_v2.options);
      ds.connector.getTableStatus(schema_v2.name, function(err, actualFields) {
        var sql = ds.connector.getPropertiesToModify(schema_v2.name, actualFields)[0];
        assert.equal(sql, 'ALTER COLUMN "name" SET NOT NULL', 'Check that the SQL is correctly spaced.');
        done();
      });
    });
  });
});
